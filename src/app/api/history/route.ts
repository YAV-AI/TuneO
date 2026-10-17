import { connection } from "next/server";
import { listHistory } from "@/lib/songs";

export async function GET() {
  await connection();
  return Response.json({ items: listHistory() });
}
