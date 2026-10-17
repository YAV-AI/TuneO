import { connection } from "next/server";
import { db, type AssetRow, type SongRow } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import { songDetail } from "@/lib/songs";

export async function GET(_req: Request, ctx: RouteContext<"/api/songs/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const detail = songDetail(id);
  return detail ? Response.json(detail) : Response.json({ error: "Not found" }, { status: 404 });
}

// rating: 1 = liked, -1 = disliked, 0 = none. title: rename.
export async function PATCH(req: Request, ctx: RouteContext<"/api/songs/[id]">) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { rating?: number; title?: string; restore?: boolean };
  if (body.restore) db.prepare("UPDATE songs SET deleted_at = NULL WHERE id = ?").run(id);
  if (body.rating !== undefined) {
    if (![1, 0, -1].includes(body.rating)) {
      return Response.json({ error: "rating must be 1, 0 or -1" }, { status: 400 });
    }
    db.prepare("UPDATE songs SET rating = ? WHERE id = ?").run(body.rating, id);
  }
  if (body.title !== undefined) {
    const title = body.title.trim().slice(0, 100);
    if (!title) return Response.json({ error: "Title is required" }, { status: 400 });
    db.prepare("UPDATE songs SET title = ? WHERE id = ?").run(title, id);
  }
  return Response.json({ ok: true });
}

// Move to trash (soft delete). With ?forever=1, permanently delete a trashed song and its files.
export async function DELETE(req: Request, ctx: RouteContext<"/api/songs/[id]">) {
  const { id } = await ctx.params;
  if (!new URL(req.url).searchParams.has("forever")) {
    db.prepare("UPDATE songs SET deleted_at = ? WHERE id = ?").run(Date.now(), id);
    return Response.json({ ok: true });
  }

  const song = db.prepare("SELECT * FROM songs WHERE id = ?").get(id) as SongRow | undefined;
  if (!song) return Response.json({ error: "Not found" }, { status: 404 });
  if (!song.deleted_at) return Response.json({ error: "Move the song to trash first" }, { status: 400 });

  const assets = db.prepare("SELECT * FROM assets WHERE song_id = ?").all(id) as AssetRow[];
  const keys = [song.audio_key, song.image_key, ...assets.map((a) => a.storage_key)].filter(Boolean) as string[];
  // Another song (e.g. art reused as a cover) may share a key; only delete files nobody else uses.
  for (const key of new Set(keys)) {
    const shared = db
      .prepare("SELECT 1 FROM songs WHERE id != ? AND (audio_key = ? OR image_key = ?)")
      .get(id, key, key);
    if (!shared) await deleteObject(key).catch((err) => console.error("[delete]", key, err));
  }
  db.prepare("DELETE FROM assets WHERE song_id = ?").run(id);
  db.prepare("DELETE FROM plays WHERE song_id = ?").run(id);
  db.prepare("DELETE FROM songs WHERE id = ?").run(id);
  return Response.json({ ok: true });
}
