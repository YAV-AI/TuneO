import { connection } from "next/server";
import { deleteVoice, getVoice, refreshVoice, regeneratePhrase, setFavorite, verifyVoice } from "@/lib/voices";

// Polled by the UI while a voice is being prepared; advances it with KIE.
export async function GET(_req: Request, ctx: RouteContext<"/api/voices/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const v = getVoice(id);
  if (!v) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    return Response.json({ voice: await refreshVoice(v) });
  } catch (err) {
    return Response.json({ voice: v, warning: (err as Error).message });
  }
}

// action=verify (multipart: recording + details), action=regenerate, or JSON { favorite }.
export async function POST(req: Request, ctx: RouteContext<"/api/voices/[id]">) {
  const { id } = await ctx.params;
  const v = getVoice(id);
  if (!v) return Response.json({ error: "Not found" }, { status: 404 });
  const action = new URL(req.url).searchParams.get("action");
  try {
    if (action === "regenerate") {
      await regeneratePhrase(v);
    } else if (action === "verify") {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return Response.json({ error: "Record the phrase first" }, { status: 400 });
      await verifyVoice(v, {
        bytes: new Uint8Array(await file.arrayBuffer()),
        contentType: file.type || "audio/webm",
        name: String(form.get("name") ?? "")
          .trim()
          .slice(0, 60),
        description: String(form.get("description") ?? "")
          .trim()
          .slice(0, 500),
        style: String(form.get("style") ?? "")
          .trim()
          .slice(0, 200),
        skill: String(form.get("skill") ?? "beginner"),
      });
    } else {
      const b = (await req.json()) as { favorite?: boolean };
      setFavorite(id, !!b.favorite);
    }
    return Response.json({ voice: getVoice(id) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/voices/[id]">) {
  const { id } = await ctx.params;
  deleteVoice(id);
  return Response.json({ ok: true });
}
