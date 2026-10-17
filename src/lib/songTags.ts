import type { SongRow } from "./db";
import { tagMp3, type Tags } from "./id3";
import { getSettings } from "./settings";
import { SITE } from "./site";
import { getObject } from "./storage";

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// Metadata embedded in downloaded MP3s so players show the right title, artist and cover.
export async function tagsFor(song: SongRow, part?: string): Promise<Tags> {
  const artist = getSettings().artistName || SITE.name;
  let cover: Tags["cover"];
  if (song.image_key) {
    try {
      const obj = await getObject(song.image_key);
      cover = { data: await obj.Body!.transformToByteArray(), mime: obj.ContentType ?? "image/jpeg" };
    } catch {
      // No cover is better than a failed download.
    }
  }
  const genre = song.tags?.split(",")[0]?.trim();
  return {
    title: part ? `${song.title} (${titleCase(part.replace(/_/g, " "))})` : song.title,
    artist,
    albumArtist: artist,
    album: song.title,
    year: String(new Date(song.created_at).getFullYear()),
    genre: genre ? titleCase(genre) : undefined,
    lyrics: part && !/vocal/i.test(part) ? undefined : (song.lyrics ?? undefined),
    comment: `Made with ${SITE.name}`,
    cover,
  };
}

// Full tagged MP3 as a download response.
export async function taggedDownload(key: string, tags: Tags, fileName: string) {
  const obj = await getObject(key);
  const tagged = tagMp3(await obj.Body!.transformToByteArray(), tags);
  const name = fileName.replace(/[^\w\- ()]+/g, "").trim() || "song";
  return new Response(tagged as BodyInit, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(tagged.length),
      "Content-Disposition": `attachment; filename="${name}.mp3"`,
      "Cache-Control": "no-store",
    },
  });
}
