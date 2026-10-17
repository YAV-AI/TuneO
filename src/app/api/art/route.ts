import { connection } from "next/server";
import { listArt } from "@/lib/songs";

export async function GET() {
  await connection();
  return Response.json(listArt());
}
