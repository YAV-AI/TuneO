import { connection } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";

export async function GET() {
  await connection();
  return Response.json(getSettings());
}

export async function PUT(req: Request) {
  const body = (await req.json()) as { artistName?: string };
  const artistName = (body.artistName ?? "").trim().slice(0, 50);
  return Response.json(saveSettings({ artistName }));
}
