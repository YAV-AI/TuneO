import { KieError } from "@/lib/kie";
import { submitJob, type JobKind } from "@/lib/jobs";
import { markVoiceBroken, personaFor } from "@/lib/voices";

const MODELS = new Set(["V6", "V6_MINI", "V6_WILD"]);

export type GenerateBody = {
  mode: "simple" | "advanced";
  model: string;
  instrumental: boolean;
  prompt?: string;
  lyrics?: string;
  style?: string;
  title?: string;
  negativeTags?: string;
  vocalGender?: "m" | "f" | "";
  weirdness?: number;
  styleInfluence?: number;
  variety?: number;
  duration?: number;
  // KIE temp URLs from /api/upload
  audioUrls?: string[];
  imageUrls?: string[];
  voiceId?: string;
  audioWeight?: number;
  // With an uploaded audio file: cover it (default) or keep it as the vocal and add music.
  audioMode?: "cover" | "vocal";
};

const clean = (s?: string) => (s ?? "").trim();
const round2 = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;

// Builds the KIE input. Rules come from docs/MUSIC_API.md.
function build(b: GenerateBody): { kind: JobKind; input: Record<string, unknown> } | string {
  if (!MODELS.has(b.model)) return "Unknown model";
  const base = { model: b.model, instrumental: !!b.instrumental };
  const audioUrls = (b.audioUrls ?? []).slice(0, 1);
  const imageUrls = (b.imageUrls ?? []).slice(0, 5);

  if (b.mode === "simple") {
    const prompt = clean(b.prompt);
    if (!prompt && !audioUrls.length && !imageUrls.length) return "Describe the song you want";
    if (prompt.length > 3000) return "Description is limited to 3000 characters";
    const input: Record<string, unknown> = { ...base, custom_mode: false };
    if (prompt) input.prompt = prompt;
    if (audioUrls.length) input.audio_urls = audioUrls;
    if (imageUrls.length) input.image_urls = imageUrls;
    return { kind: "generate", input };
  }

  const style = clean(b.style);
  const lyrics = b.instrumental ? "" : clean(b.lyrics);
  const negative = clean(b.negativeTags);
  if (style.length > 1000) return "Styles are limited to 1000 characters";
  if (lyrics.length > 5000) return "Lyrics are limited to 5000 characters";
  const title = clean(b.title).slice(0, 80);

  const knobs: Record<string, unknown> = {};
  // Persona/voice only applies in custom mode, so a selected voice lives here.
  if (b.voiceId) {
    const persona = personaFor(b.voiceId);
    if (!persona) return "That voice is not ready yet";
    Object.assign(knobs, persona);
    // audio_weight is how strongly the voice reference is followed; not valid without vocals.
    if (!b.instrumental && typeof b.audioWeight === "number") knobs.audio_weight = round2(b.audioWeight);
  }
  if (negative) knobs.negative_tags = negative.slice(0, 200);
  if (!b.instrumental && b.vocalGender) knobs.vocal_gender = b.vocalGender;
  if (typeof b.weirdness === "number") knobs.weirdness_constraint = round2(b.weirdness);
  if (typeof b.styleInfluence === "number") knobs.style_weight = round2(b.styleInfluence);
  if (typeof b.variety === "number") knobs.variety = Math.min(4, Math.max(0, Math.round(b.variety)));
  if (typeof b.duration === "number") knobs.duration = Math.min(360, Math.max(10, Math.round(b.duration)));

  // Advanced + uploaded vocal, kept as recorded with music built around it.
  if (audioUrls.length && b.audioMode === "vocal") {
    if (!style) return "Describe the music to build around your vocal";
    const input: Record<string, unknown> = {
      model: b.model,
      upload_url: audioUrls[0],
      title: title || "My Vocal",
      tags: style,
      negative_tags: negative.slice(0, 200) || "low quality, distorted",
    };
    for (const k of ["vocal_gender", "style_weight", "weirdness_constraint", "audio_weight", "variety"]) {
      if (k in knobs) input[k] = knobs[k];
    }
    return { kind: "addInstrumental", input };
  }

  // Advanced + uploaded audio = cover of that audio (the "+ Audio" button).
  if (audioUrls.length) {
    const input: Record<string, unknown> = { ...base, upload_url: audioUrls[0], title: title || "Untitled", ...knobs };
    if (style) input.style = style;
    if (lyrics) input.lyrics = lyrics;
    return { kind: "cover", input };
  }

  if (!style && !lyrics && !negative) return "Add lyrics or styles";
  const input: Record<string, unknown> = { ...base, custom_mode: true, title: title || "Untitled", ...knobs };
  if (style) input.style = style;
  if (lyrics) input.lyrics = lyrics;
  return { kind: "generate", input };
}

export async function POST(req: Request) {
  const body = (await req.json()) as GenerateBody;
  const job = build(body);
  if (typeof job === "string") return Response.json({ error: job }, { status: 400 });

  try {
    const taskId = await submitJob(job.kind, job.input);
    return Response.json({ taskId });
  } catch (err) {
    const message = (err as Error).message;
    if (body.voiceId && /voice persona/i.test(message)) {
      markVoiceBroken(body.voiceId);
      return Response.json(
        { error: "This voice did not finish building, so it can't be used. Create it again from + Voice." },
        { status: 409 },
      );
    }
    const status = err instanceof KieError && err.code === 402 ? 402 : 502;
    return Response.json({ error: message }, { status });
  }
}
