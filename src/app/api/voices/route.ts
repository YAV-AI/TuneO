import { connection } from "next/server";
import { getSong } from "@/lib/songs";
import { listVoices, startVoice } from "@/lib/voices";

export async function GET() {
  await connection();
  return Response.json({ voices: listVoices() });
}

// Start a custom voice from an uploaded/recorded sample or a library song.
export async function POST(req: Request) {
  const form = await req.formData();
  const start = Number(form.get("start"));
  const end = Number(form.get("end"));
  const language = String(form.get("language") ?? "en");
  const songId = form.get("songId");
  const file = form.get("file");
  try {
    let id: string;
    if (typeof songId === "string" && songId) {
      const song = getSong(songId);
      if (!song) return Response.json({ error: "Song not found" }, { status: 404 });
      id = await startVoice({ song, start, end, language });
    } else if (file instanceof File && file.type.startsWith("audio/")) {
      id = await startVoice({
        file: { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name || "voice.webm", type: file.type },
        start,
        end,
        language,
      });
    } else {
      return Response.json({ error: "Record or upload some audio first" }, { status: 400 });
    }
    return Response.json({ id });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
