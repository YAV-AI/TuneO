import { KieError } from "@/lib/kie";
import { getTimestamps, publicAudioUrl, submitJob, type JobKind } from "@/lib/jobs";
import { getSettings } from "@/lib/settings";
import { getSong } from "@/lib/songs";

const MODELS = new Set(["V6", "V6_MINI", "V6_WILD"]);

type Body = {
  action: JobKind;
  model?: string;
  title?: string;
  style?: string;
  lyrics?: string;
  instrumental?: boolean;
  continueAt?: number;
  start?: number;
  end?: number;
  sectionLyrics?: string;
  negativeTags?: string;
  author?: string;
};

const clean = (s?: string) => (s ?? "").trim();
const round2 = (n: number) => Math.round(n * 100) / 100;

// The song "..." menu actions, each mapped onto a KIE job (see docs/MUSIC_API.md).
export async function POST(req: Request, ctx: RouteContext<"/api/songs/[id]/actions">) {
  const { id } = await ctx.params;
  const song = getSong(id);
  if (!song || song.deleted_at) return Response.json({ error: "Song not found" }, { status: 404 });

  const b = (await req.json()) as Body;
  // Uploaded audio has no KIE task, so only actions that accept an audio URL work on it.
  const uploaded = song.task_id === "upload";
  if (uploaded && ["wav", "video", "art", "timestamps"].includes(b.action)) {
    return Response.json({ error: "Not available for uploaded audio" }, { status: 400 });
  }
  const ref = { task_id: song.task_id, audio_id: song.id };
  const model = MODELS.has(b.model ?? "") ? b.model! : song.model && MODELS.has(song.model) ? song.model : "V6";
  const instrumental = !!b.instrumental;
  const style = clean(b.style);
  const lyrics = instrumental ? "" : clean(b.lyrics);
  const title = clean(b.title);

  let input: Record<string, unknown>;
  switch (b.action) {
    case "extend": {
      input = uploaded
        ? { upload_url: await publicAudioUrl(song), model, instrumental }
        : { audio_id: song.id, model, instrumental };
      if (b.continueAt !== undefined) {
        if (!(b.continueAt > 0) || (song.duration && b.continueAt >= song.duration)) {
          return Response.json({ error: "Extend point must be inside the song" }, { status: 400 });
        }
        input.continue_at = round2(b.continueAt);
      }
      if (style) input.style = style.slice(0, 1000);
      if (lyrics) input.lyrics = lyrics.slice(0, 5000);
      input.title = (title || `${song.title} (Extended)`).slice(0, 100);
      break;
    }
    case "cover": {
      input = { upload_url: await publicAudioUrl(song), model, instrumental };
      if (style) input.style = style.slice(0, 1000);
      if (lyrics) input.lyrics = lyrics.slice(0, 5000);
      input.title = (title || `${song.title} (Cover)`).slice(0, 80);
      break;
    }
    case "replace": {
      const start = round2(b.start ?? NaN);
      const end = round2(b.end ?? NaN);
      if (!(start >= 0) || !(end - start >= 10)) {
        return Response.json({ error: "Pick a section of at least 10 seconds" }, { status: 400 });
      }
      if (song.duration && end - start > song.duration / 2) {
        return Response.json({ error: "Section can be at most half the song" }, { status: 400 });
      }
      const section = clean(b.sectionLyrics);
      const full = clean(b.lyrics) || song.lyrics || "";
      if (!section) return Response.json({ error: "Write the new lyrics for this section" }, { status: 400 });
      input = {
        ...(uploaded ? { upload_url: await publicAudioUrl(song), model } : ref),
        prompt: section,
        full_lyrics: full || section,
        tags: style || song.tags || "",
        title: title || song.title,
        infill_start_s: start,
        infill_end_s: end,
      };
      break;
    }
    case "addInstrumental": {
      if (!style) return Response.json({ error: "Describe the music to build around the vocal" }, { status: 400 });
      input = {
        upload_url: await publicAudioUrl(song),
        model,
        title: (title || song.title).slice(0, 80),
        tags: style.slice(0, 1000),
        // Required by the API; a sensible default keeps the form simple.
        negative_tags: (clean(b.negativeTags) || "low quality, distorted").slice(0, 200),
      };
      break;
    }
    case "timestamps":
      try {
        return Response.json(await getTimestamps(song));
      } catch (err) {
        return Response.json({ error: (err as Error).message }, { status: 502 });
      }
    case "stems":
      input = uploaded ? { audio_url: await publicAudioUrl(song) } : { ...ref };
      break;
    case "wav":
      input = { ...ref };
      break;
    case "video":
      {
        const author = clean(b.author) || getSettings().artistName;
        input = { ...ref, ...(author ? { author: author.slice(0, 50) } : {}) };
      }
      break;
    case "art":
      input = { task_id: song.task_id };
      break;
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const kind: JobKind = uploaded && b.action === "extend" ? "uploadExtend" : b.action;
    const taskId = await submitJob(kind, input, song.id);
    return Response.json({ taskId });
  } catch (err) {
    const status = err instanceof KieError && err.code === 402 ? 402 : 502;
    return Response.json({ error: (err as Error).message }, { status });
  }
}
