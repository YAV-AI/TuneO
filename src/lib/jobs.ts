// Registry of every KIE job tuneo can run, and how to submit one.
import { db, type SongRow } from "./db";
import { createTask, uploadFile } from "./kie";
import { getObject } from "./storage";

export type JobKind =
  | "generate"
  | "extend"
  | "uploadExtend"
  | "addInstrumental"
  | "cover"
  | "replace"
  | "wav"
  | "stems"
  | "video"
  | "art"
  | "timestamps";

type JobSpec = {
  model: string;
  // Jobs that return new tracks (stored as songs); the rest produce assets.
  producesSongs: boolean;
  origin?: string;
};

export const JOBS: Record<JobKind, JobSpec> = {
  generate: { model: "ai-music-api/generate", producesSongs: true },
  extend: { model: "ai-music-api/extend", producesSongs: true, origin: "Extend" },
  uploadExtend: { model: "ai-music-api/upload-and-extend-audio", producesSongs: true, origin: "Extend" },
  // Keeps the source vocal exactly as recorded and builds the music around it.
  addInstrumental: { model: "ai-music-api/add-instrumental", producesSongs: true, origin: "Vocal" },
  cover: { model: "ai-music-api/upload-and-cover-audio", producesSongs: true, origin: "Cover" },
  replace: { model: "ai-music-api/replace-section", producesSongs: true, origin: "Replace" },
  wav: { model: "ai-music-api/convert-to-wav-format", producesSongs: false },
  stems: { model: "ai-music-api/separate-vocals", producesSongs: false },
  video: { model: "ai-music-api/create-music-video", producesSongs: false },
  art: { model: "ai-music-api/cover-generate", producesSongs: false },
  timestamps: { model: "ai-music-api/timeStamped-lyrics", producesSongs: false },
};

export async function submitJob(kind: JobKind, input: Record<string, unknown>, songId: string | null = null) {
  const { taskId } = await createTask(JOBS[kind].model, input);
  if (!taskId) throw new Error(`${kind} did not return a task`);
  db.prepare("INSERT INTO tasks (id, kind, state, params, song_id, created_at) VALUES (?, ?, 'waiting', ?, ?, ?)").run(
    taskId,
    kind,
    JSON.stringify(input),
    songId,
    Date.now(),
  );
  return taskId;
}

const KIE_URL_TTL_MS = 12 * 86_400_000;

// A URL KIE can fetch for this song's audio. KIE's own link lasts 14 days;
// after that, re-upload the archived copy to KIE's temp storage.
export async function publicAudioUrl(song: SongRow) {
  if (song.audio_url && Date.now() - song.created_at < KIE_URL_TTL_MS) return song.audio_url;
  if (!song.audio_key) throw new Error("Song audio is not available");
  const obj = await getObject(song.audio_key);
  const bytes = await obj.Body!.transformToByteArray();
  return uploadFile(bytes, `${song.id}.mp3`, obj.ContentType ?? "audio/mpeg");
}

const TIMESTAMPS_PRICE = 0.5;

export type AlignedWord = { word: string; startS: number; endS: number };

// Timestamped lyrics are synchronous on KIE: fetch once, cache as an asset.
export async function getTimestamps(song: SongRow) {
  const cached = db
    .prepare("SELECT data FROM assets WHERE song_id = ? AND kind = 'timestamps' ORDER BY id DESC LIMIT 1")
    .get(song.id) as { data: string } | undefined;
  if (cached) return JSON.parse(cached.data) as { alignedWords: AlignedWord[] };

  const res = await createTask(JOBS.timestamps.model, { task_id: song.task_id, audio_id: song.id });
  const inner = res as unknown as { code?: number; msg?: string; data?: { alignedWords?: AlignedWord[] } };
  if (inner.code !== undefined && inner.code !== 200) throw new Error(inner.msg ?? "No timestamps");
  const words = (inner.data?.alignedWords ?? []).map(({ word, startS, endS }) => ({ word, startS, endS }));
  const data = { alignedWords: words };
  // Synchronous on KIE, so no task record to read the charge from: log the listed price.
  db.prepare(
    `INSERT INTO tasks (id, kind, state, params, song_id, created_at, credits, credits_checked, estimated)
     VALUES (?, 'timestamps', 'success', '{}', ?, ?, ?, 1, 1)`,
  ).run(`sync-${song.id}-${Date.now()}`, song.id, Date.now(), TIMESTAMPS_PRICE);
  db.prepare(
    "INSERT INTO assets (song_id, task_id, kind, label, data, created_at) VALUES (?, ?, 'timestamps', 'timestamps', ?, ?)",
  ).run(song.id, song.task_id, JSON.stringify(data), Date.now());
  return data;
}
