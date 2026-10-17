// Long-running pipeline worker. Run with `npm run worker`.
import { archiveAssets, archiveSongs, backfillCredits, pollTasks } from "../lib/pipeline";
import { ensureBucket } from "../lib/storage";

const TICK_MS = 2_000;
let stopping = false;

async function main() {
  if (!process.env.KIE_API_KEY) throw new Error("KIE_API_KEY is not set");
  await waitForStorage();
  console.log("[worker] started");

  while (!stopping) {
    try {
      await pollTasks();
      await archiveSongs();
      await archiveAssets();
      await backfillCredits();
    } catch (err) {
      console.error("[worker] tick failed", err);
    }
    await sleep(TICK_MS);
  }
  console.log("[worker] stopped");
}

async function waitForStorage() {
  for (let i = 1; ; i++) {
    try {
      await ensureBucket();
      return;
    } catch (err) {
      if (i >= 30) throw err;
      console.log(`[worker] waiting for storage (${(err as Error).message})`);
      await sleep(2_000);
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    stopping = true;
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
