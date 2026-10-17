# TuneO: notes for Claude Code

The project guide for all coding agents lives in AGENTS.md and is imported here, so there is one source of truth:

@AGENTS.md

## Claude Code specifics

- **Plan first** for anything touching `pipeline.ts`, `db.ts` migrations or the KIE job registry; these affect stored user data and credit spend.
- **Verify in the running app**, not just with types: start the stack (`docker compose up -d --build`) and check the change in the browser before reporting it done. Say what you did not verify.
- **Rebuilds restart the app.** Warn the maintainer before `docker compose up --build` while they may be using it.
- **Paid API calls** (generate, cover, extend, stems, video...) need the maintainer's go-ahead each time. State the credit cost first.
- **Commits:** only when asked, using the enforced format in AGENTS.md. Add the `Co-Authored-By: Claude ...` trailer; it is allowed in this repository.
- Keep replies and commit messages short. No em dashes or en dashes.
