import { streamObject } from "@/lib/media";
import { getAsset, getSong } from "@/lib/songs";
import { taggedDownload, tagsFor } from "@/lib/songTags";

export async function GET(req: Request, ctx: RouteContext<"/api/assets/[id]">) {
  const { id } = await ctx.params;
  const asset = getAsset(Number(id));
  if (!asset) return new Response("Not found", { status: 404 });
  if (!asset.storage_key) {
    return asset.url ? Response.redirect(asset.url, 302) : new Response("Not found", { status: 404 });
  }
  const song = getSong(asset.song_id);
  const title = song?.title ?? "song";
  // Stem MP3s are tagged like songs, e.g. "Title (Vocals)".
  if (song && asset.storage_key.endsWith(".mp3") && new URL(req.url).searchParams.has("download")) {
    return taggedDownload(asset.storage_key, await tagsFor(song, asset.label), `${title} ${asset.label}`);
  }
  return streamObject(req, asset.storage_key, `${title} ${asset.label}`);
}
