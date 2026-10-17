// Lyrics writer for Advanced mode, backed by OpenAI (OPENAI_KEY).
// Writes lyrics with arrangement metatags and delivery cues the music model understands,
// and suggests a title and styles when those are empty.
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
// Reasoning models think before writing; "low" halves the wait with little quality loss.
// Only reasoning models (gpt-5.x, o-series) accept this setting.
const REASONING = process.env.OPENAI_REASONING || "low";
const SUPPORTS_REASONING = /^(gpt-5|gpt-6|o\d)/.test(MODEL);

const SYSTEM = `You are a hit songwriter and arranger writing lyrics for an AI music generator.
The lyrics field doubles as an arrangement map: bracketed tags and short cues steer structure, energy and delivery.

FORMAT RULES
- Every section starts with a square-bracket tag on its own line, then its lyric lines, then a blank line.
- Use numbered sections when they differ: [Verse 1], [Verse 2]. Typical map:
  [Intro] [Verse 1] [Pre-Chorus] [Chorus] [Verse 2] [Pre-Chorus] [Chorus] [Bridge] [Final Chorus] [Outro] [End]
- Arrangement tags you may use where they serve the song: [Intro], [Instrumental Break], [Build-Up], [Drop], [Breakdown], [Interlude], [Guitar Solo], [Outro], [End]. Instrumental tags have no lyric lines under them.
- Add a local modifier only where a section must sound different, one or two short audible cues after a dash:
  [Verse 1 - intimate, sparse] [Pre-Chorus - rising tension] [Chorus - stacked harmonies, full band]
  [Bridge - half-time, drop drums] [Final Chorus - bigger, key lift] [Outro - stripped back]
- Delivery cues go in parentheses on their own line before the lines they affect, 1 to 3 words: (whispered) (spoken) (belted) (softly) (building)
- Ad-libs and backing vocals: short, in parentheses at the end of a line, e.g. "I keep holding on (holding on)", or on their own line as (ad-lib: yeah, oh). At most one or two per section.
- Vocal tags allowed sparingly: [Spoken Word], [Harmony], [Group Vocals], [Rap Verse].

WRITING RULES
- Lines of 4 to 8 words, one breath each. Natural stress, concrete imagery, no cliches.
- Keep a clear rhyme scheme per section (AABB or ABAB), with internal rhyme where it flows. Rhyme different words (never a word with itself), and prefer fresh multi-syllable or slant rhymes over obvious ones. Matching line lengths within a section so it sits on a steady melody.
- Delivery cues are seasoning: at most one per section and only where delivery changes. Sung is the default; use (spoken) only for a deliberate spoken moment.
- The chorus is the hook: short, memorable, repeated. Write every repeat out in full; never use (x2) or "repeat chorus".
- Make the final chorus the energy peak; vary one line or word for payoff.
- Use ALL CAPS for at most one or two punchy hook words, and a stretched vowel (e.g. "knowww") at most once.
- Aim for about 200 to 300 words for a 3 to 4 minute song unless asked otherwise.
- Genre and overall sound belong in "style", never inside section tags.
- Never write stage directions as lyric lines (they would be sung). Never name real artists or reuse existing lyrics.
- Match the language of the idea or draft.

STYLE FIELD (only if asked to suggest one)
- Comma-separated, under 200 characters: genre, mood, tempo/BPM, key instruments, then vocal type and delivery early in the list. No artist names.

Return JSON only: {"title": string, "style": string, "lyrics": string}.`;

export async function POST(req: Request) {
  const key = process.env.OPENAI_KEY;
  if (!key) return Response.json({ error: "OPENAI_KEY is not set" }, { status: 500 });

  const { idea, style, lyrics, title } = (await req.json()) as {
    idea?: string;
    style?: string;
    lyrics?: string;
    title?: string;
  };
  const brief = [
    idea && `Song idea: ${idea}`,
    title && `Title: ${title}`,
    style ? `Style (keep it, write lyrics that fit it): ${style}` : "No style given: suggest one.",
    lyrics &&
      `Existing draft. Improve and arrange it with tags and cues, keeping its meaning and best lines:\n${lyrics}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (!idea && !style && !lyrics && !title) {
    return Response.json({ error: "Give a title, idea or style first" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      // A hard limit so a slow answer becomes a clear error, never a dropped connection.
      signal: AbortSignal.timeout(120_000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        ...(SUPPORTS_REASONING ? { reasoning_effort: REASONING } : {}),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: brief },
        ],
      }),
    });
  } catch (err) {
    const timedOut = (err as Error).name === "TimeoutError";
    return Response.json(
      {
        error: timedOut ? "The lyric writer took too long. Try again." : "Could not reach OpenAI. Try again.",
      },
      { status: 504 },
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return Response.json({ error: data.error?.message ?? "OpenAI request failed" }, { status: 502 });
  }

  let out: { title?: string; style?: string; lyrics?: string } = {};
  try {
    out = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return Response.json({ error: "The lyric writer returned an unexpected answer, try again" }, { status: 502 });
  }
  if (!out.lyrics?.trim()) return Response.json({ error: "No lyrics came back, try again" }, { status: 502 });

  return Response.json({
    lyrics: out.lyrics.trim().slice(0, 5000),
    title: (out.title ?? "").trim().slice(0, 80),
    style: (out.style ?? "").trim().slice(0, 1000),
  });
}
