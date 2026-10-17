# TuneO: guide for coding agents

TuneO is a self-hosted AI music studio: a Next.js web app, a background worker and S3 storage that drive the KIE AI music API (v6, v6-mini, v6-wild models). Read this file before changing anything. Human-facing docs live in `README.md` and `CONTRIBUTING.md`.

## Architecture in one minute

- **web** (`src/app`, `src/components`): Next.js 16 App Router UI plus an internal REST API under `src/app/api`. It creates KIE tasks and reads SQLite. It must never poll KIE.
- **worker** (`src/worker/index.ts`, logic in `src/lib/pipeline.ts`): polls unfinished tasks every 2 s, upserts tracks, records `creditsConsumed`, archives media to storage.
- **storage**: RustFS (S3 compatible) via `src/lib/storage.ts`. Media is served through `/api/media/:id/(audio|cover)` and `/api/assets/:id` with HTTP Range support.
- **database**: SQLite through Node 24's built-in `node:sqlite` (`src/lib/db.ts`). The `tasks` table is the job queue. Migrations are additive `add(table, column, def)` calls in `migrate()`.
- **AI writing** (optional): `src/app/api/lyrics` and `src/app/api/prompt-rewrite` call OpenAI.

Key modules: `kie.ts` (API client), `jobs.ts` (registry of every KIE job: model id, whether it produces songs), `pipeline.ts` (polling, result normalisation, archiving), `voices.ts` (custom voices and personas), `songTags.ts` + `id3.ts` (tagged MP3 downloads), `usage.ts` (credits page).

## Commands

```bash
npm run dev            # web app on http://localhost:3000 (needs: docker compose up -d rustfs)
npm run worker         # background worker
npm run format         # Prettier, project config
npm run format:check   # what CI runs
npm run lint
npm run typecheck      # generates Next route types, then tsc
npm run build
docker compose up -d --build   # full stack (web, worker, rustfs), bound to 127.0.0.1
```

Before handing work back: `format:check`, `lint`, `typecheck` and `build` must all pass. CI runs exactly these plus Docker image builds.

## Rules that bite in this codebase

**Next.js 16**

- `GET` route handlers are prerendered by default (`cacheComponents` is on). Any route that reads SQLite must `await connection()` from `next/server` first, or it serves stale build-time data. `export const dynamic` is rejected; do not use it.
- Route handler params are async: `ctx: RouteContext<"/api/songs/[id]">`, then `await ctx.params`. New routes need `npx next typegen` before `tsc` knows their types (`npm run typecheck` does this).
- Read `node_modules/next/dist/docs/` before using an unfamiliar Next API (see the managed block below).

**SQLite**

- `db` is a lazy proxy: never open the database at import time (parallel `next build` workers would lock it).
- Keep migrations additive and idempotent. Never rename or drop columns that hold user data.

**KIE API**

- Always check the body `code`, not the HTTP status. `401` on one model means the key lacks permission for it.
- Result shapes differ per job: songs in `response.data[]`, files in `resultUrls`, analysis in `resultObject`. Some endpoints answer synchronously (`timeStamped-lyrics`, `generate-persona`, `check-voice`): `createTask` returns the result, not a `taskId`.
- Every generation returns two takes; store each as its own song keyed by `audio_id`, grouped by `task_id`.
- KIE deletes media after 14 days and uploads after 24 hours. Archive to storage; never treat KIE URLs as permanent. Uploaded audio (`task_id = 'upload'`) has no KIE task, so task-only actions (WAV, video, cover art, synced lyrics) are unavailable for it.
- Add new KIE features through `jobs.ts` and the song actions route, not ad hoc fetches.
- Do not spend credits to test without the maintainer's approval. Free endpoints (cover art, personas, voice phrase steps) are fine.

**Storage and media**

- Downloads (`?download=<title>`) are tagged on the fly and sent with `Cache-Control: no-store`; links include the title so renames bust caches.
- `previewFor()` in `voices.ts` decides what a voice thumbnail plays.

## UI conventions

- Design tokens live in `src/app/globals.css` (`--bg`, `--surface`, `--fg`, `--muted`, `--dim`, `--accent`...). Use the Tailwind token classes (`bg-surface`, `text-dim`), not raw hex.
- No native `<select>`: use `src/components/Select.tsx`. Dialogs use `Modal.tsx`; menus close on outside click and Escape.
- Dialog swaps keep the backdrop steady (see `Modal.tsx`); keep dialog heights stable while loading.
- Shared app state (library, player, queue, dialogs) lives in `StudioContext.tsx`.
- User-facing text: plain, short sentences. **No em dashes or en dashes** anywhere (UI, docs, commits).
- Do not use third-party brand names in the UI or code; describe features generically. The README is the only place the upstream service is named, descriptively.

## Commits and safety

- Never commit, push or open pull requests unless the maintainer explicitly asks for that specific action.
- Commit messages are enforced by commitlint (`commitlint.config.mjs`) in CI:

  ```text
  type(scope): short imperative summary

  - Issue: | Feature: | Context: what you understood the task to be
  - one bullet per meaningful change (max 6, max 100 chars each)
  ```

  No paragraphs, no session summaries. Details in `CONTRIBUTING.md#commit-messages`.

- Never commit `.env`, API keys, `data/` or `.claude/`. Never put keys or personal data in code, logs or screenshots.
- The app has no authentication and is bound to `127.0.0.1` on purpose. Do not expose ports or add public endpoints without an auth layer.
- Respect the AGPL-3.0 license and the CLA in `CONTRIBUTING.md`; do not add dependencies with incompatible licenses.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
