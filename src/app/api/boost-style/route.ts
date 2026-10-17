import { db } from "@/lib/db";
import { createTask, recordInfo } from "@/lib/kie";

// Magic-wand style enhancer. KIE runs it as a short task, so wait for it inline.
export async function POST(req: Request) {
  const { content } = (await req.json()) as { content?: string };
  const text = (content ?? "").trim();
  if (!text) return Response.json({ error: "Write a style first" }, { status: 400 });

  try {
    const input = { content: text.slice(0, 1000) };
    const { taskId } = await createTask("ai-music-api/boost-music-style", input);
    // Logged as a finished task so it shows in the credits breakdown (the worker never polls it).
    db.prepare(
      "INSERT INTO tasks (id, kind, state, params, created_at, credits_checked) VALUES (?, 'boost', 'success', ?, ?, 0)",
    ).run(taskId, JSON.stringify(input), Date.now());
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      const info = await recordInfo(taskId);
      if (info.state === "fail") return Response.json({ error: info.failMsg ?? "Boost failed" }, { status: 502 });
      if (info.state === "success") {
        const style = findText(info.response);
        return style
          ? Response.json({ style: style.slice(0, 1000) })
          : Response.json({ error: "No style returned" }, { status: 502 });
      }
    }
    return Response.json({ error: "Timed out" }, { status: 504 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}

// The boosted style comes back as the longest string in the response.
function findText(v: unknown): string {
  if (typeof v === "string") return /^https?:/.test(v) ? "" : v;
  if (Array.isArray(v)) return v.map(findText).sort((a, b) => b.length - a.length)[0] ?? "";
  if (v && typeof v === "object") return findText(Object.values(v));
  return "";
}
