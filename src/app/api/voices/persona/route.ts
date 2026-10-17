import { getSong } from "@/lib/songs";
import { createPersona } from "@/lib/voices";

// Make a reusable voice from one of your generated songs.
export async function POST(req: Request) {
  const b = (await req.json()) as {
    songId?: string;
    name?: string;
    description?: string;
    start?: number;
    style?: string;
  };
  const song = b.songId ? getSong(b.songId) : undefined;
  if (!song) return Response.json({ error: "Song not found" }, { status: 404 });
  const name = (b.name ?? "").trim().slice(0, 60);
  const description = (b.description ?? "").trim().slice(0, 500);
  if (!name || !description)
    return Response.json({ error: "Give the voice a name and a description" }, { status: 400 });
  try {
    const id = await createPersona(song, { name, description, start: b.start ?? 0, style: (b.style ?? "").trim() });
    return Response.json({ id });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
