import { db } from "@/lib/db";

// Remove a failed job from the library. Running jobs can't be dismissed; the record stays for Credits.
export async function DELETE(_req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  const task = db.prepare("SELECT state FROM tasks WHERE id = ?").get(id) as { state: string } | undefined;
  if (!task) return Response.json({ error: "Not found" }, { status: 404 });
  if (task.state !== "fail") return Response.json({ error: "Only failed jobs can be removed" }, { status: 400 });
  db.prepare("UPDATE tasks SET dismissed_at = ? WHERE id = ?").run(Date.now(), id);
  return Response.json({ ok: true });
}
