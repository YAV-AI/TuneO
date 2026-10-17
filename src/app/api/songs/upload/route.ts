import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { putObject } from "@/lib/storage";

const MAX_BYTES = 100 * 1024 * 1024;

// "+ Audio" on the Library page: your own audio becomes a song you can cover, extend or split.
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("audio/")) {
    return Response.json({ error: "Upload an audio file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: "File is too large (100 MB max)" }, { status: 413 });

  const duration = Number(form.get("duration"));
  const id = randomUUID();
  const ext = file.name.match(/\.(\w{2,4})$/)?.[1]?.toLowerCase() ?? "mp3";
  const key = `uploads/${id}.${ext}`;
  await putObject(key, new Uint8Array(await file.arrayBuffer()), file.type);

  const title = file.name.replace(/\.\w{2,4}$/, "").slice(0, 100) || "Upload";
  const now = Date.now();
  db.prepare(
    `INSERT INTO songs (id, task_id, title, duration, created_at, audio_key, archived_at, origin)
     VALUES (?, 'upload', ?, ?, ?, ?, ?, 'Upload')`,
  ).run(id, title, Number.isFinite(duration) && duration > 0 ? duration : null, now, key, now);
  return Response.json({ id });
}
