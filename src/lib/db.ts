import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "tuneo.db");

export type TaskRow = {
  id: string;
  kind: string;
  state: string;
  params: string;
  error: string | null;
  created_at: number;
  attempts: number;
  next_poll_at: number;
  song_id: string | null;
  result: string | null;
  credits: number | null;
  credits_checked: number;
  estimated: number;
};

export type SongRow = {
  id: string;
  task_id: string;
  title: string;
  tags: string | null;
  lyrics: string | null;
  model: string | null;
  audio_url: string | null;
  stream_url: string | null;
  image_url: string | null;
  duration: number | null;
  rating: number;
  created_at: number;
  audio_key: string | null;
  image_key: string | null;
  archived_at: number | null;
  archive_attempts: number;
  parent_id: string | null;
  origin: string | null;
  deleted_at: number | null;
  play_count: number;
};

export type AssetRow = {
  id: number;
  song_id: string;
  task_id: string;
  kind: string;
  label: string;
  url: string | null;
  storage_key: string | null;
  data: string | null;
  archive_attempts: number;
  created_at: number;
};

const globalForDb = globalThis as unknown as { tuneoDb?: DatabaseSync };

function open(): DatabaseSync {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      state TEXT NOT NULL,
      params TEXT NOT NULL,
      error TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      tags TEXT,
      lyrics TEXT,
      model TEXT,
      audio_url TEXT,
      stream_url TEXT,
      image_url TEXT,
      duration REAL,
      rating INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS songs_task ON songs(task_id);
  `);
  migrate(db);
  return db;
}

// Additive column migrations for the worker pipeline.
function migrate(db: DatabaseSync) {
  const add = (table: string, column: string, def: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  };
  add("tasks", "attempts", "INTEGER NOT NULL DEFAULT 0");
  add("tasks", "next_poll_at", "INTEGER NOT NULL DEFAULT 0");
  add("songs", "audio_key", "TEXT");
  add("songs", "image_key", "TEXT");
  add("songs", "archived_at", "INTEGER");
  add("songs", "archive_attempts", "INTEGER NOT NULL DEFAULT 0");
  // Song actions (extend, cover, stems...) reference a source song.
  add("tasks", "song_id", "TEXT");
  add("tasks", "result", "TEXT");
  add("songs", "parent_id", "TEXT");
  add("songs", "origin", "TEXT");
  add("songs", "deleted_at", "INTEGER");
  // Credits KIE actually charged per task (null until known); estimated for sync calls with no task.
  add("songs", "play_count", "INTEGER NOT NULL DEFAULT 0");
  // The phrase being replaced, so a regenerate never shows the stale one again.
  add("voices", "stale_phrase", "TEXT");
  add("tasks", "credits", "REAL");
  // Failed jobs the user removed from the library (still counted on the Credits page).
  add("tasks", "dismissed_at", "INTEGER");
  // Voice previews: the stored sample (custom voices) or a section of the source song (personas).
  add("voices", "sample_key", "TEXT");
  add("voices", "sample_start", "REAL");
  add("voices", "sample_end", "REAL");
  add("tasks", "credits_checked", "INTEGER NOT NULL DEFAULT 0");
  add("tasks", "estimated", "INTEGER NOT NULL DEFAULT 0");
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT,
      storage_key TEXT,
      data TEXT,
      archive_attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS assets_song ON assets(song_id);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS voices (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      style TEXT,
      status TEXT NOT NULL,
      phrase TEXT,
      language TEXT,
      task_id TEXT,
      persona_id TEXT,
      source_song_id TEXT,
      image_url TEXT,
      error TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id TEXT NOT NULL,
      played_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS plays_song ON plays(song_id);
  `);
}

function instance(): DatabaseSync {
  return (globalForDb.tuneoDb ??= open());
}

// Opened lazily on first use, so importing this module (e.g. during `next build`) never touches the file.
export const db = new Proxy({} as DatabaseSync, {
  get(_, prop) {
    const real = instance();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

// kind: "voice" (custom voice, persona_model voice_persona) or "persona" (from a song, style_persona).
// status: phrase (waiting for the phrase to sing) -> ready_to_verify -> verifying -> ready | failed.
export type VoiceRow = {
  id: string;
  kind: "voice" | "persona";
  name: string;
  description: string | null;
  style: string | null;
  status: "phrase" | "ready_to_verify" | "verifying" | "ready" | "failed";
  phrase: string | null;
  stale_phrase: string | null;
  sample_key: string | null;
  sample_start: number | null;
  sample_end: number | null;
  language: string | null;
  task_id: string | null;
  persona_id: string | null;
  source_song_id: string | null;
  image_url: string | null;
  error: string | null;
  favorite: number;
  created_at: number;
};
