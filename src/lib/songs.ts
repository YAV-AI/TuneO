import { db, type AssetRow, type SongRow, type TaskRow } from "./db";

const TERMINAL = new Set(["success", "fail"]);

// Archived media is served through /api/media so URLs stay stable after KIE expires them.
export function withMediaUrls(s: SongRow): SongRow {
  return {
    ...s,
    audio_url: s.audio_key ? `/api/media/${s.id}/audio` : s.audio_url,
    // Uploads have no art of their own; the media route draws a gradient for them.
    image_url: s.image_key || s.task_id === "upload" ? `/api/media/${s.id}/cover` : s.image_url,
  };
}

export type LibraryItem =
  | ({ kind: "song"; extras: string[] } & SongRow)
  | { kind: "pending"; id: string; title: string; model: string; created_at: number; error: string | null };

export type AssetView = Omit<AssetRow, "url" | "storage_key"> & { href: string | null; archived: boolean };

export function songDetail(id: string) {
  const song = getSong(id);
  if (!song) return null;
  const assets = db.prepare("SELECT * FROM assets WHERE song_id = ? ORDER BY created_at, id").all(id) as AssetRow[];
  // Asset jobs still running, so the UI can show spinners per action.
  const running = db
    .prepare("SELECT kind FROM tasks WHERE song_id = ? AND state NOT IN ('success','fail')")
    .all(id) as { kind: string }[];
  const failed = db
    .prepare("SELECT kind, error FROM tasks WHERE song_id = ? AND state = 'fail' ORDER BY created_at DESC")
    .all(id) as { kind: string; error: string | null }[];
  return {
    song: withMediaUrls(song),
    parent: song.parent_id ? (getSong(song.parent_id) ?? null) : null,
    assets: assets.map(({ url, storage_key, ...a }): AssetView => ({
      ...a,
      href: storage_key ? `/api/assets/${a.id}` : url,
      archived: !!storage_key,
    })),
    running: running.map((r) => r.kind),
    failed,
  };
}

export function getAsset(id: number) {
  return db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as AssetRow | undefined;
}

export function listLibrary(): LibraryItem[] {
  const songs = db
    .prepare("SELECT * FROM songs WHERE deleted_at IS NULL ORDER BY created_at DESC, id")
    .all() as SongRow[];
  // Tasks without any tracks yet render as placeholder rows (2 per task).
  const placeholders = db
    .prepare(
      `SELECT * FROM tasks t WHERE t.kind IN ('generate','extend','uploadExtend','addInstrumental','cover','replace')
       AND NOT EXISTS (SELECT 1 FROM songs s WHERE s.task_id = t.id)
       AND t.dismissed_at IS NULL
       ORDER BY created_at DESC`,
    )
    .all() as TaskRow[];

  // Downloadable extras per song (stems, video, wav), shown as row badges.
  const extras = new Map<string, string[]>();
  for (const r of db
    .prepare("SELECT DISTINCT song_id, kind FROM assets WHERE kind IN ('stems','video','wav') AND url IS NOT NULL")
    .all() as { song_id: string; kind: string }[]) {
    extras.set(r.song_id, [...(extras.get(r.song_id) ?? []), r.kind]);
  }

  const items: LibraryItem[] = songs.map((s) => ({
    kind: "song",
    extras: extras.get(s.id) ?? [],
    ...withMediaUrls(s),
  }));
  for (const t of placeholders) {
    const p = JSON.parse(t.params) as Record<string, unknown>;
    const n = TERMINAL.has(t.state) || t.kind === "replace" ? 1 : 2;
    for (let i = 0; i < n; i++) {
      items.push({
        kind: "pending",
        id: `${t.id}:${i}`,
        title: String(
          p.title ||
            p.prompt ||
            (t.kind === "generate" ? "Generating" : `${t.kind[0].toUpperCase()}${t.kind.slice(1)}...`),
        ),
        model: String(p.model ?? ""),
        created_at: t.created_at,
        error: t.error,
      });
    }
  }
  return items.sort((a, b) => b.created_at - a.created_at);
}

export function getSong(id: string) {
  return db.prepare("SELECT * FROM songs WHERE id = ?").get(id) as SongRow | undefined;
}

export function listTrash() {
  const songs = db
    .prepare("SELECT * FROM songs WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
    .all() as SongRow[];
  return songs.map((s) => ({ kind: "song" as const, extras: [] as string[], ...withMediaUrls(s) }));
}

// Most recently played first, one row per song.
export function listHistory() {
  const songs = db
    .prepare(
      `SELECT s.*, MAX(p.played_at) AS last_played FROM plays p JOIN songs s ON s.id = p.song_id
       WHERE s.deleted_at IS NULL GROUP BY s.id ORDER BY last_played DESC LIMIT 200`,
    )
    .all() as (SongRow & { last_played: number })[];
  return songs.map((s) => ({ kind: "song" as const, extras: [] as string[], ...withMediaUrls(s) }));
}

// Every cover image: current song covers plus all generated cover art.
export function listArt() {
  const covers = (
    db
      .prepare(
        "SELECT * FROM songs WHERE deleted_at IS NULL AND (image_key IS NOT NULL OR image_url IS NOT NULL) ORDER BY created_at DESC",
      )
      .all() as SongRow[]
  ).map((s) => ({
    id: `cover-${s.id}`,
    song_id: s.id,
    title: s.title,
    src: withMediaUrls(s).image_url!,
    kind: "cover",
    created_at: s.created_at,
  }));
  const art = (
    db
      .prepare(
        `SELECT a.*, s.title FROM assets a JOIN songs s ON s.id = a.song_id
       WHERE a.kind = 'art' AND s.deleted_at IS NULL ORDER BY a.created_at DESC`,
      )
      .all() as (AssetRow & { title: string })[]
  ).map((a) => ({
    id: `art-${a.id}`,
    song_id: a.song_id,
    title: a.title,
    src: a.storage_key ? `/api/assets/${a.id}` : a.url!,
    kind: "art",
    created_at: a.created_at,
  }));
  return { covers, art };
}
