import { connection } from "next/server";
import { listTrash } from "@/lib/songs";

export async function GET() {
  await connection();
  return Response.json({ items: listTrash() });
}
