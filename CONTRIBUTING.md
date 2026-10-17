# Contributing to TuneO

Thanks for helping make TuneO better. Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Bugs and ideas:** open an issue describing what happened, what you expected and how to reproduce it.
- **Larger changes:** open an issue first so we can agree on the approach before you spend time on it.

## Development

```bash
npm install
docker compose up -d rustfs   # storage only
npm run dev                   # web app on http://localhost:3000
npm run worker                # background worker
```

### Formatting

The project uses **Prettier** with a shared config (`.prettierrc.json`) and an `.editorconfig`, so every editor produces identical files and saving a file never creates an unrelated diff.

- **VS Code:** install the recommended extensions when prompted. The workspace settings format with the project's Prettier on save.
- **Other editors:** enable Prettier and EditorConfig support, or run `npm run format` before committing.
- Do not change the Prettier config in an unrelated pull request. CI fails if any file is not formatted.

Before opening a pull request:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
```

CI runs the same steps on every pull request, plus a build of both Docker images, and a pull request cannot be merged until they pass.

Keep changes focused, match the existing code style, and describe in the pull request what changed and how you tested it. Never commit API keys or your `.env` file.

## Commit messages

Every commit must follow [Conventional Commits](https://www.conventionalcommits.org) **and** this project's body format. This is enforced: pull requests whose commits or title do not comply fail the **Commit messages** check and cannot be merged.

```text
type(scope): short imperative summary

- Issue: what was wrong, as you understood it
- what you changed
- what you changed

Co-Authored-By: Name <email>
```

**Header**

- `type` is one of: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- `scope` is optional, lowercase, and names the area: `create`, `library`, `voices`, `player`, `worker`, `api`, `downloads`, `docker`, `docs`...
- The summary starts lowercase, uses the imperative ("add", not "added"), has no full stop, and the whole header is at most 72 characters.

**Body (required)**

- Bullet points only (`- ...`). No paragraphs.
- The **first bullet states what was understood**: `- Issue: ...` for fixes, `- Feature: ...` for new behaviour, or `- Context: ...` for docs, refactors and chores.
- Then one bullet per meaningful change. At most 6 bullets, each at most 100 characters.
- Trailers such as `Co-Authored-By:`, `Signed-off-by:` or `Closes #12` go after a blank line and do not count as bullets.

**Examples**

```text
fix(library): save title edits when clicking away

- Issue: renames were lost unless Enter was pressed
- Save on blur, Enter or the check button; Escape cancels
- Reset the editor when another song is opened

Closes #12
```

```text
feat(voices): add voice influence slider

- Feature: custom voices did not sound close enough to the sample
- Show Voice influence above Lyrics when a voice is selected
- Send it as audio_weight, default 85%
```

Rejected: `update stuff`, `Fixed bug.`, a body written as paragraphs, or a long essay from a coding agent.

Check a message locally before committing:

```bash
npx commitlint --edit .git/COMMIT_EDITMSG
```

**Pull request titles** follow the same header format, since squash merges use the title as the commit header.

### AI coding agents

Commits written by AI coding agents follow exactly the same rules: a conventional header and a short bullet list that starts with what was understood. No long explanations, no summaries of the whole session, no restating the diff line by line. Keep the agent's `Co-Authored-By` trailer if you want to credit it.

## Licensing of contributions (CLA)

TuneO is copyright YAV.AI and licensed under the **GNU AGPL-3.0-only**. YAV.AI also reserves the option to offer TuneO under separate commercial terms (dual licensing).

To keep that possible, contributions are accepted under this contributor licence agreement. By submitting a pull request, you agree that:

1. You wrote the contribution yourself, or otherwise have the right to submit it.
2. Your contribution is licensed to the public under the **AGPL-3.0-only**, like the rest of the project.
3. You also grant YAV.AI a perpetual, worldwide, non-exclusive, royalty-free, irrevocable licence to use, modify, sublicense and distribute your contribution under other licence terms, including commercial ones.
4. You keep the copyright in your contribution and may use it however you like.
5. Your contribution is provided "as is", without warranty.

If you cannot agree to these terms, please say so in your pull request before it is merged.
