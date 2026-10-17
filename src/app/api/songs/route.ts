import { connection } from "next/server";
import { listLibrary } from "@/lib/songs";

// Read-only: the worker (src/worker) advances tasks and archives media.
export async function GET() {
  // Sync SQLite reads are invisible to Next's prerender detection; force request time.
  await connection();
  return Response.json({ items: listLibrary() });
}
