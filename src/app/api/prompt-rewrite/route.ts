// Simple mode's magic wand: turns a short idea into a vivid, specific song description.
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const REASONING = process.env.OPENAI_REASONING || "low";
const SUPPORTS_REASONING = /^(gpt-5|gpt-6|o\d)/.test(MODEL);

const system = (
  instrumental: boolean,
) => `You rewrite a user's short song idea into a compact song description for an AI music generator that writes the lyrics itself.
Format: comma-separated descriptors in priority order, then a semicolon and a very short topic phrase. Example:
Roots dub, bittersweet, dreamy, 72 BPM, deep rolling bass, tape-echo guitar, melodica, soft soulful male vocal; about loving someone who never looks back
Rules:
- Start with the most specific genre (e.g. "Synth-pop", not "pop").
- Then 6 to 10 descriptors: one mood direction (no contradictions), tempo as a number (e.g. 96 BPM), ${
  instrumental
    ? '2 to 4 key instruments or sounds, and end the descriptors with "instrumental, no vocals". This is an instrumental: never mention a singer, voice, vocal, choir, rap or chant.'
    : "2 to 4 key instruments or sounds, and the vocal (gender, tone, delivery)."
}
- End with "; about ..." in under 10 words.
- Keep the user's genre, language and any details they gave; add specifics, never contradict them.
- Hard limit: 200 characters total. No sentences, no artist names, no real song titles, no quotes.
Return only the description.`;

export async function POST(req: Request) {
  const key = process.env.OPENAI_KEY;
  if (!key) return Response.json({ error: "OPENAI_KEY is not set" }, { status: 500 });
  const { prompt, instrumental } = (await req.json()) as { prompt?: string; instrumental?: boolean };
  const idea = (prompt ?? "").trim();
  if (!idea) return Response.json({ error: "Type a short idea first" }, { status: 400 });

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        ...(SUPPORTS_REASONING ? { reasoning_effort: REASONING } : {}),
        messages: [
          { role: "system", content: system(!!instrumental) },
          { role: "user", content: idea.slice(0, 3000) },
        ],
      }),
    });
  } catch (err) {
    const timedOut = (err as Error).name === "TimeoutError";
    return Response.json(
      { error: timedOut ? "That took too long. Try again." : "Could not reach OpenAI." },
      { status: 504 },
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json({ error: data.error?.message ?? "OpenAI request failed" }, { status: 502 });
  const text: string = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) return Response.json({ error: "Nothing came back, try again" }, { status: 502 });
  return Response.json({ prompt: fit(text.replace(/^"|"$/g, ""), 200) });
}

// Enforce the length budget without cutting a descriptor in half.
function fit(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = Math.max(cut.lastIndexOf(","), cut.lastIndexOf(";"));
  return (at > max / 2 ? cut.slice(0, at) : cut).trim();
}
