import { connection } from "next/server";
import { SITE } from "@/lib/site";

type Latest = { version: string; url: string };

const DAY = 24 * 60 * 60 * 1000;
let cache: { at: number; latest: Latest | null } | null = null;

// "1.2.10" > "1.2.9"; ignores a leading "v" and any "-beta" suffix.
function newer(a: string, b: string) {
  const parse = (v: string) =>
    v
      .replace(/^v/, "")
      .split("-")[0]
      .split(".")
      .map((n) => Number(n) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

// Latest GitHub release, fetched at most once a day. Sends no user data.
async function latestRelease(): Promise<Latest | null> {
  if (cache && Date.now() - cache.at < DAY) return cache.latest;
  let latest: Latest | null = null;
  try {
    const res = await fetch(`https://api.github.com/repos/${SITE.repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "TuneO" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const body = (await res.json()) as { tag_name: string; html_url: string };
      latest = { version: body.tag_name.replace(/^v/, ""), url: body.html_url };
    }
  } catch {}
  cache = { at: Date.now(), latest };
  return latest;
}

// Whether a newer release than the running version is out.
export async function GET() {
  await connection();
  const current = SITE.version;
  const latest = await latestRelease();
  return Response.json({ current, update: latest && newer(latest.version, current) ? latest : null });
}
