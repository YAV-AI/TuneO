// Background pipeline run by the worker: poll KIE tasks, then archive finished
// media into object storage so it outlives KIE's 14 day retention.
import { db, type AssetRow, type SongRow, type TaskRow } from "./db";
import { JOBS, type JobKind } from "./jobs";
import { recordInfo, type MusicTrack } from "./kie";
import { putObject } from "./storage";

const POLL_MS = 3_000;
const MAX_POLL_MS = 30_000;
const TASK_TIMEOUT_MS = 20 * 60_000;
const MAX_ARCHIVE_ATTEMPTS = 5;

export async function pollTasks(now = Date.now()) {
  const due = db
    .prepare(
      "SELECT * FROM tasks WHERE state NOT IN ('success','fail') AND next_poll_at <= ? ORDER BY created_at LIMIT 20",
    )
    .all(now) as TaskRow[];

  await Promise.all(due.map((task) => pollTask(task, now)));
  return due.length;
}

async function pollTask(task: TaskRow, now: number) {
  try {
    const info = await recordInfo(task.id);
    const params = JSON.parse(task.params) as Record<string, unknown>;
    const spec = JOBS[task.kind as JobKind] ?? JOBS.generate;
    if (spec.producesSongs) {
      for (const t of info.response?.data ?? []) upsertTrack(task, params, t, spec.origin ?? null);
    } else if (info.state === "success" && task.song_id) {
      saveAssets(task, info.response ?? {});
    }
    // Song jobs are fully captured in the songs table; only keep the raw response for asset jobs.
    if (info.state === "success" && !spec.producesSongs) {
      db.prepare("UPDATE tasks SET result = ? WHERE id = ?").run(JSON.stringify(info.response), task.id);
    }

    let state: string = info.state;
    let error = info.state === "fail" ? (info.failMsg ?? "Generation failed") : null;
    if (state !== "success" && state !== "fail" && now - task.created_at > TASK_TIMEOUT_MS) {
      state = "fail";
      error = "Timed out waiting for KIE";
    }
    db.prepare("UPDATE tasks SET state = ?, error = ?, attempts = 0, next_poll_at = ? WHERE id = ?").run(
      state,
      error,
      now + POLL_MS,
      task.id,
    );
    if (state === "success" || state === "fail") recordCredits(task.id, info.creditsConsumed);
  } catch (err) {
    // Network or KIE error: back off and retry on a later tick.
    const attempts = task.attempts + 1;
    const delay = Math.min(MAX_POLL_MS, POLL_MS * 2 ** attempts);
    db.prepare("UPDATE tasks SET attempts = ?, next_poll_at = ? WHERE id = ?").run(attempts, now + delay, task.id);
    console.error(`[poll] ${task.id} failed (attempt ${attempts})`, (err as Error).message);
  }
}

function upsertTrack(task: TaskRow, params: Record<string, unknown>, t: MusicTrack, origin: string | null) {
  db.prepare(
    `INSERT INTO songs (id, task_id, title, tags, lyrics, model, audio_url, stream_url, image_url, duration, created_at, parent_id, origin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, tags = excluded.tags, lyrics = excluded.lyrics,
       audio_url = COALESCE(excluded.audio_url, songs.audio_url),
       stream_url = COALESCE(excluded.stream_url, songs.stream_url),
       image_url = COALESCE(excluded.image_url, songs.image_url),
       duration = COALESCE(excluded.duration, songs.duration)`,
  ).run(
    t.id,
    task.id,
    t.title || String(params.title ?? "Untitled"),
    t.tags ?? (params.style as string | undefined) ?? null,
    t.prompt ?? null,
    String(params.model ?? "") || parentModel(task.song_id),
    t.audio_url || null,
    t.stream_audio_url || null,
    t.image_url || null,
    t.duration ?? null,
    task.created_at,
    task.song_id,
    origin,
  );
}

// Replace Section takes no model; inherit the source song's.
function parentModel(songId: string | null) {
  if (!songId) return "";
  const row = db.prepare("SELECT model FROM songs WHERE id = ?").get(songId) as { model: string | null } | undefined;
  return row?.model ?? "";
}

// Walk a KIE response and collect every media URL with a readable label
// (e.g. vocal_url -> "vocal", resultUrls[1] -> "2"). Shapes differ per endpoint.
function collectUrls(value: unknown, key = "", out: { label: string; url: string }[] = []) {
  if (typeof value === "string") {
    if (/^https?:\/\//.test(value) && !out.some((o) => o.url === value)) {
      // Prefer a name from the key (vocal_url), else the file name (..._Vocals.mp3), else a counter.
      const fromKey = /^\d*$/.test(key) ? "" : key.replace(/_?url$/i, "");
      const fromFile = new URL(value).pathname.match(/_([A-Za-z][\w-]*)\.\w+$/)?.[1]?.toLowerCase() ?? "";
      out.push({ label: fromKey || fromFile || String(out.length + 1), url: value });
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collectUrls(v, /^\d*$/.test(key) || key === "resultUrls" ? String(i + 1) : key, out));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "origin_url" || k === "stream_audio_url") continue;
      collectUrls(v, k, out);
    }
  }
  return out;
}

function saveAssets(task: TaskRow, response: Record<string, unknown>) {
  const exists = db.prepare("SELECT 1 FROM assets WHERE task_id = ?").get(task.id);
  if (exists) return;
  const insert = db.prepare(
    "INSERT INTO assets (song_id, task_id, kind, label, url, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  if (task.kind === "timestamps") {
    // Word-level timings: keep the JSON, there is no file to archive.
    insert.run(task.song_id, task.id, task.kind, "timestamps", null, JSON.stringify(response), Date.now());
    return;
  }
  for (const { label, url } of collectUrls(response)) {
    insert.run(task.song_id, task.id, task.kind, label, url, null, Date.now());
  }
}

// Copy finished tracks (task succeeded, final MP3 present) into storage.
export async function archiveSongs() {
  const songs = db
    .prepare(
      `SELECT s.* FROM songs s JOIN tasks t ON t.id = s.task_id
       WHERE t.state = 'success' AND s.audio_url IS NOT NULL AND s.archived_at IS NULL
         AND s.archive_attempts < ?
       ORDER BY s.created_at LIMIT 4`,
    )
    .all(MAX_ARCHIVE_ATTEMPTS) as SongRow[];

  for (const song of songs) {
    try {
      const audioKey = song.audio_key ?? (await copy(song.audio_url!, `songs/${song.id}/audio`, "audio/mpeg"));
      db.prepare("UPDATE songs SET audio_key = ? WHERE id = ?").run(audioKey, song.id);
      const imageKey = song.image_url
        ? (song.image_key ?? (await copy(song.image_url, `songs/${song.id}/cover`, "image/jpeg")))
        : null;
      // Once the cover is in our storage, drop the upstream CDN link; it is never used again.
      db.prepare(
        "UPDATE songs SET image_key = ?, archived_at = ?, image_url = CASE WHEN ? IS NULL THEN image_url ELSE NULL END WHERE id = ?",
      ).run(imageKey, Date.now(), imageKey, song.id);
      console.log(`[archive] ${song.id} "${song.title}" stored`);
    } catch (err) {
      db.prepare("UPDATE songs SET archive_attempts = archive_attempts + 1 WHERE id = ?").run(song.id);
      console.error(`[archive] ${song.id} failed`, (err as Error).message);
    }
  }
  return songs.length;
}

const EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "video/mp4": "mp4",
  "audio/midi": "mid",
  "audio/mid": "mid",
};

async function copy(url: string, base: string, fallbackType: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const type = (res.headers.get("content-type") || fallbackType).split(";")[0].trim();
  const fromUrl = new URL(url).pathname.match(/\.(\w{2,4})$/)?.[1]?.toLowerCase();
  const key = `${base}.${EXT[type] ?? fromUrl ?? EXT[fallbackType] ?? "bin"}`;
  await putObject(key, new Uint8Array(await res.arrayBuffer()), type);
  return key;
}

// Copy finished asset files (WAV, stems, video, cover art) into storage.
export async function archiveAssets() {
  const assets = db
    .prepare(
      `SELECT * FROM assets WHERE url IS NOT NULL AND storage_key IS NULL AND archive_attempts < ?
       ORDER BY created_at LIMIT 4`,
    )
    .all(MAX_ARCHIVE_ATTEMPTS) as AssetRow[];

  for (const a of assets) {
    try {
      const key = await copy(a.url!, `assets/${a.song_id}/${a.kind}-${a.id}`, "application/octet-stream");
      db.prepare("UPDATE assets SET storage_key = ? WHERE id = ?").run(key, a.id);
      // Generated cover art replaces the song's cover (first image wins).
      if (a.kind === "art" && /\.(jpg|png|webp)$/.test(key)) {
        db.prepare(
          "UPDATE songs SET image_key = ? WHERE id = ? AND NOT EXISTS (SELECT 1 FROM assets WHERE song_id = ? AND kind = 'art' AND id < ? AND storage_key IS NOT NULL)",
        ).run(key, a.song_id, a.song_id, a.id);
      }
      console.log(`[archive] asset ${a.id} (${a.kind}/${a.label}) stored`);
    } catch (err) {
      db.prepare("UPDATE assets SET archive_attempts = archive_attempts + 1 WHERE id = ?").run(a.id);
      console.error(`[archive] asset ${a.id} failed`, (err as Error).message);
    }
  }
  return assets.length;
}

function recordCredits(taskId: string, credits: number | null | undefined) {
  db.prepare("UPDATE tasks SET credits = ?, credits_checked = 1 WHERE id = ?").run(
    typeof credits === "number" ? credits : null,
    taskId,
  );
}

// One-off backfill for finished tasks recorded before credit tracking existed.
// KIE keeps task records for about two months.
export async function backfillCredits() {
  const tasks = db
    .prepare(
      `SELECT id FROM tasks WHERE state IN ('success','fail') AND credits_checked = 0 AND estimated = 0
       ORDER BY created_at LIMIT 5`,
    )
    .all() as { id: string }[];
  for (const t of tasks) {
    try {
      const info = await recordInfo(t.id);
      recordCredits(t.id, info.creditsConsumed);
    } catch (err) {
      // Unknown or expired record: stop retrying it.
      db.prepare("UPDATE tasks SET credits_checked = 1 WHERE id = ?").run(t.id);
      console.error(`[credits] ${t.id}`, (err as Error).message);
    }
  }
  return tasks.length;
}
