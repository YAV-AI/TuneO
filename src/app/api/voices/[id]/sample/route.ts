import { streamObject } from "@/lib/media";
import { getVoice } from "@/lib/voices";

// The recorded sample a custom voice was made from, for previews.
export async function GET(req: Request, ctx: RouteContext<"/api/voices/[id]/sample">) {
  const { id } = await ctx.params;
  const v = getVoice(id);
  if (!v?.sample_key) return new Response("Not found", { status: 404 });
  return streamObject(req, v.sample_key, `${v.name} sample`);
}
