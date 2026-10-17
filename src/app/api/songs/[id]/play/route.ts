import { db } from "@/lib/db";

// Counts a play (shown on Library rows) and feeds the History tab.
export async function POST(_req: Request, ctx: RouteContext<"/api/songs/[id]/play">) {
  const { id } = await ctx.params;
  db.prepare("UPDATE songs SET play_count = play_count + 1 WHERE id = ?").run(id);
  db.prepare("INSERT INTO plays (song_id, played_at) VALUES (?, ?)").run(id, Date.now());
  return Response.json({ ok: true });
}
