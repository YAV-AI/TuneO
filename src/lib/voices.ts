// Custom voices (record or upload your voice) and personas (a voice taken from one of your songs).
// Both end up as a persona_id passed to Generate, with persona_model voice_persona or style_persona.
import { db, type SongRow, type VoiceRow } from "./db";
import { createTask, KieError, recordInfo, uploadFile } from "./kie";
import { putObject } from "./storage";
import { publicAudioUrl } from "./jobs";

const LANGUAGES = new Set(["en", "zh", "es", "fr", "pt", "de", "ja", "ko", "hi", "ru"]);

export function listVoices() {
  const rows = db.prepare("SELECT * FROM voices ORDER BY created_at DESC").all() as VoiceRow[];
  return rows.map((v) => ({ ...v, preview: previewFor(v) }));
}

export function getVoice(id: string) {
  return db.prepare("SELECT * FROM voices WHERE id = ?").get(id) as VoiceRow | undefined;
}

function update(id: string, patch: Partial<VoiceRow>) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  db.prepare(`UPDATE voices SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).run(
    ...keys.map((k) => (patch as Record<string, string | number | null>)[k]),
    id,
  );
}

// KIE keeps this one model behind a per-key permission; say so plainly instead of "401".
function friendly(err: unknown): never {
  if (err instanceof KieError && err.code === 401) {
    throw new Error(
      "Your KIE API key is not enabled for custom voices yet. Ask KIE support to enable ai-music-api/validation-phrase, or create a voice from one of your songs instead.",
    );
  }
  throw err;
}

// Step 1: send a 10 to 30 second sample; KIE answers with a phrase to sing back.
export async function startVoice(opts: {
  // Either a file the user recorded/uploaded, or a song from the library.
  file?: { bytes: Uint8Array; name: string; type: string };
  song?: SongRow;
  start: number;
  end: number;
  language: string;
}) {
  const start = Math.max(0, Math.floor(opts.start));
  const end = Math.floor(opts.end);
  if (end - start < 10 || end - start > 30) throw new Error("Pick a section between 10 and 30 seconds long");
  const language = LANGUAGES.has(opts.language) ? opts.language : "en";
  const url = opts.song
    ? await publicAudioUrl(opts.song)
    : await uploadFile(opts.file!.bytes, opts.file!.name, opts.file!.type);
  const { taskId } = await createTask("ai-music-api/validation-phrase", {
    voice_url: url,
    vocal_start_s: start,
    vocal_end_s: end,
    language,
  }).catch(friendly);
  // Keep the sample so the voice can be previewed later (KIE deletes its copy after 24h).
  let sampleKey: string | null = null;
  if (opts.file) {
    const ext = opts.file.name.match(/\.(\w{2,4})$/)?.[1]?.toLowerCase() ?? "webm";
    sampleKey = `voices/${taskId}.${ext}`;
    await putObject(sampleKey, opts.file.bytes, opts.file.type).catch(() => (sampleKey = null));
  }
  db.prepare(
    `INSERT INTO voices (id, kind, name, status, language, created_at, sample_key, sample_start, sample_end, source_song_id)
     VALUES (?, 'voice', 'My Voice', 'phrase', ?, ?, ?, ?, ?, ?)`,
  ).run(taskId, language, Date.now(), sampleKey, start, end, opts.song?.id ?? null);
  return taskId;
}

// KIE swaps the phrase on the original task a few seconds later, so remember the old one
// and keep waiting until a different phrase shows up.
export async function regeneratePhrase(v: VoiceRow) {
  await createTask("ai-music-api/regenerate-phrase", { task_id: v.id });
  update(v.id, { status: "phrase", stale_phrase: v.phrase ?? v.stale_phrase, phrase: null, error: null });
}

const VERIFY_TIMEOUT_MS = 20 * 60_000;

// KIE only says "AiModels callback failed" when verification fails; explain what usually causes it.
const VERIFY_HINT =
  "The recording could not be verified. Sing the exact phrase shown, in the same voice as the sample (the sample must be your own voice), somewhere quiet. Start over to try again.";

// Step 2: the user's recording of the phrase proves the voice is theirs.
export async function verifyVoice(
  v: VoiceRow,
  opts: { bytes: Uint8Array; contentType: string; name: string; description: string; style: string; skill: string },
) {
  // Guard against singing an outdated phrase: confirm with KIE first.
  const info = await recordInfo(v.id);
  const current = findKey(
    { ...info, resultJson: parseJson((info as { resultJson?: unknown }).resultJson), param: undefined },
    /phrase_?text|validate_?info/i,
  );
  if (current && current !== v.phrase) {
    update(v.id, { phrase: current, status: "ready_to_verify" });
    throw new Error(`The phrase changed to "${current}". Record it again with the new words.`);
  }
  if (info.state === "fail") {
    update(v.id, { status: "failed", error: "This voice session expired. Start over to get a new phrase." });
    throw new Error("This voice session expired. Start over to get a new phrase.");
  }
  const url = await uploadFile(opts.bytes, `${v.id}-verify.webm`, opts.contentType);
  const input: Record<string, unknown> = { task_id: v.id, verify_url: url };
  if (opts.name) input.voice_name = opts.name;
  if (opts.description) input.description = opts.description;
  if (opts.style) input.style = opts.style;
  if (["beginner", "intermediate", "advanced", "professional"].includes(opts.skill))
    input.singer_skill_level = opts.skill;
  const { taskId } = await createTask("ai-music-api/create-voice", input);
  update(v.id, {
    status: "verifying",
    task_id: taskId,
    name: opts.name || v.name,
    description: opts.description || null,
    style: opts.style || null,
    error: null,
  });
}

// A persona: "Remix > Voice" on a finished song. Free, once per track.
export async function createPersona(
  song: SongRow,
  opts: { name: string; description: string; start: number; style: string },
) {
  if (song.task_id === "upload") throw new Error("Personas need a song generated here, not an upload");
  const start = Math.max(0, Math.floor(opts.start));
  const input = {
    task_id: song.task_id,
    audio_id: song.id,
    name: opts.name,
    description: opts.description,
    vocal_start: start,
    vocal_end: start + 30,
    ...(opts.style ? { style: opts.style } : {}),
  };
  // Synchronous on KIE: the persona id comes straight back.
  const res = (await createTask("ai-music-api/generate-persona", input)) as unknown as {
    persona_id?: string;
    taskId?: string;
  };
  const personaId = res.persona_id;
  const id = personaId ?? res.taskId;
  if (!id) throw new Error("KIE did not return a persona");
  db.prepare(
    `INSERT INTO voices (id, kind, name, description, style, status, task_id, persona_id, source_song_id, image_url, created_at, sample_start, sample_end)
     VALUES (?, 'persona', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    opts.name,
    opts.description,
    opts.style || null,
    personaId ? "ready" : "verifying",
    res.taskId ?? null,
    personaId ?? null,
    song.id,
    song.image_key ? `/api/media/${song.id}/cover` : song.image_url,
    Date.now(),
    start,
    start + 30,
  );
  return id;
}

// Find a value by key name anywhere in a KIE response (shapes vary per endpoint).
function findKey(v: unknown, pattern: RegExp): string | null {
  if (!v || typeof v !== "object") return null;
  for (const [k, val] of Object.entries(v)) {
    if (pattern.test(k) && typeof val === "string" && val.trim()) return val.trim();
    const inner = findKey(val, pattern);
    if (inner) return inner;
  }
  return null;
}

function parseJson(s: unknown) {
  if (typeof s !== "string") return s;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// Advances a voice by asking KIE; called while the UI is waiting on it.
export async function refreshVoice(v: VoiceRow): Promise<VoiceRow> {
  if (v.status === "ready" || v.status === "failed" || v.status === "ready_to_verify") return v;

  if (v.kind === "persona") {
    const info = await recordInfo(v.task_id!);
    if (info.state === "fail") update(v.id, { status: "failed", error: info.failMsg ?? "Persona failed" });
    if (info.state === "success") {
      const raw = { ...info, resultJson: parseJson((info as { resultJson?: unknown }).resultJson) };
      const personaId =
        findKey(raw, /persona_?id/i) ?? (info.response as { resultUrls?: string[] })?.resultUrls?.[0] ?? null;
      update(
        v.id,
        personaId ? { status: "ready", persona_id: personaId } : { status: "failed", error: "No persona id returned" },
      );
    }
    return getVoice(v.id)!;
  }

  if (v.status === "phrase") {
    const info = await recordInfo(v.id);
    const raw = { ...info, resultJson: parseJson((info as { resultJson?: unknown }).resultJson), param: undefined };
    // KIE returns data.verify_phrase_text (plus ids like verify_phrase_id we must skip).
    const phrase = findKey(raw, /phrase_?text|validate_?info/i) ?? findKey(raw, /^(phrase|text|lyrics?)$/i);
    if (info.state === "fail")
      update(v.id, { status: "failed", error: info.failMsg ?? "Could not analyse the sample" });
    else if (phrase && phrase !== v.stale_phrase)
      update(v.id, { status: "ready_to_verify", phrase, stale_phrase: null });
    return getVoice(v.id)!;
  }

  // verifying: the voice id is the validation task id, and the voice is ready when that task succeeds.
  const info = await recordInfo(v.id).catch(() => null);
  if (info?.state === "fail") {
    update(v.id, { status: "failed", error: VERIFY_HINT });
  } else if (info?.state === "success") {
    // The task finishing is not enough: generation rejects voices check-voice reports as unavailable.
    const check = (await createTask("ai-music-api/check-voice", { task_id: v.id }).catch(() => null)) as unknown as {
      isAvailable?: boolean;
    } | null;
    if (check?.isAvailable === true) update(v.id, { status: "ready" });
    else if (Date.now() - v.created_at > VERIFY_TIMEOUT_MS) update(v.id, { status: "failed", error: VERIFY_HINT });
  }
  return getVoice(v.id)!;
}

// What Generate needs to sing with this voice.
export function personaFor(id: string) {
  const v = getVoice(id);
  if (!v || v.status !== "ready") return null;
  return {
    persona_id: v.persona_id ?? v.id,
    persona_model: v.kind === "voice" ? "voice_persona" : "style_persona",
  };
}

// Generation told us the voice is unusable ("Voice persona generation failed..."): stop offering it.
export function markVoiceBroken(id: string) {
  update(id, {
    status: "failed",
    error: "This voice could not be built. Create it again with a clean recording of your own singing.",
  });
}

export function deleteVoice(id: string) {
  db.prepare("DELETE FROM voices WHERE id = ?").run(id);
}

export function setFavorite(id: string, favorite: boolean) {
  update(id, { favorite: favorite ? 1 : 0 });
}

// Where to play a voice's preview from, if anything is available.
export function previewFor(v: VoiceRow) {
  if (v.sample_key) return { src: `/api/voices/${v.id}/sample`, start: v.sample_start ?? 0, end: v.sample_end ?? null };
  if (v.source_song_id) {
    return {
      src: `/api/media/${v.source_song_id}/audio`,
      start: v.sample_start ?? 0,
      end: v.sample_end ?? (v.sample_start ?? 0) + 30,
    };
  }
  return null;
}
