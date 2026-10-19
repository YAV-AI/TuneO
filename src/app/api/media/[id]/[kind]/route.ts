import { gradientCover } from "@/lib/gradientCover";
import { streamObject } from "@/lib/media";
import { getSong } from "@/lib/songs";
import { taggedDownload, tagsFor } from "@/lib/songTags";

// Archived audio/cover from object storage. Falls back to KIE's URL until archived.
export async function GET(req: Request, ctx: RouteContext<"/api/media/[id]/[kind]">) {
  const { id, kind } = await ctx.params;
  if (kind !== "audio" && kind !== "cover") return new Response("Not found", { status: 404 });

  const song = getSong(id);
  if (!song) return new Response("Not found", { status: 404 });

  const key = kind === "audio" ? song.audio_key : song.image_key;
  if (!key && kind === "cover" && song.task_id === "upload") {
    return new Response(gradientCover(song.id), {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
    });
  }
  if (!key) {
    const remote = kind === "audio" ? song.audio_url || song.stream_url : song.image_url;
    return remote ? Response.redirect(remote, 302) : new Response("Not found", { status: 404 });
  }
  // Downloads get proper tags (title, artist, album, cover, lyrics); playback streams the file as is.
  if (kind === "audio" && key.endsWith(".mp3") && new URL(req.url).searchParams.has("download")) {
    return taggedDownload(key, await tagsFor(song), song.title);
  }
  return streamObject(req, key, song.title);
}
