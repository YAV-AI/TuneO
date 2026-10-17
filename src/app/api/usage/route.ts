import { connection } from "next/server";
import { usageReport } from "@/lib/usage";

// Credits spent from this app, per action and per task, from KIE's own charge records.
export async function GET() {
  await connection();
  return Response.json(usageReport());
}
