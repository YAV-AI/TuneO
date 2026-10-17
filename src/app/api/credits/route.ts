import { connection } from "next/server";

// KIE account balance, shown in the sidebar.
export async function GET() {
  await connection();
  const res = await fetch("https://api.kie.ai/api/v1/chat/credit", {
    headers: { Authorization: `Bearer ${process.env.KIE_API_KEY}` },
    cache: "no-store",
  });
  const body = (await res.json()) as { code: number; msg: string; data: number };
  if (body.code !== 200) return Response.json({ error: body.msg }, { status: 502 });
  return Response.json({ credits: body.data });
}
