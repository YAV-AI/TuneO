// Commit message rules for TuneO. Checked locally with `npm run commitlint` and in CI on every pull request.
// Format (see CONTRIBUTING.md):
//
//   type(scope): short imperative summary
//
//   - Issue: what was wrong / Feature: what was asked for   <- first bullet, required
//   - what changed
//   - what changed
//
//   Co-Authored-By: ...                                      <- optional trailers

const TRAILER = /^([A-Za-z]+(-[A-Za-z]+)*: .+|BREAKING CHANGE: .+|(Closes|Fixes|Refs) #\d+)$/;
const FIRST_BULLET = /^- (Issue|Feature|Context): \S/;
const MAX_BULLETS = 6;
const MAX_LINE = 100;

// Body lines between the header and any trailers.
function bodyLines(raw) {
  const lines = raw.replace(/\r/g, "").split("\n");
  const rest = lines.slice(1);
  while (rest.length && !rest[rest.length - 1].trim()) rest.pop();
  while (rest.length && TRAILER.test(rest[rest.length - 1].trim())) rest.pop();
  while (rest.length && !rest[rest.length - 1].trim()) rest.pop();
  return rest
    .filter((l) => !l.startsWith("#"))
    .map((l) => l.trimEnd())
    .filter((l, i, a) => l || (i > 0 && a[i - 1]));
}

const bulletBody = {
  rules: {
    "body-bullets": ({ raw, header }) => {
      if (/^(Merge|Revert) /.test(header ?? "")) return [true];
      const body = bodyLines(raw ?? "").filter((l) => l.trim());
      if (!body.length) {
        return [
          false,
          "add a body of bullet points, starting with '- Issue: ...', '- Feature: ...' or '- Context: ...'",
        ];
      }
      const notBullet = body.find((l) => !l.startsWith("- "));
      if (notBullet)
        return [false, `body must be bullet points only ("- ..."), no paragraphs. Found: "${notBullet.slice(0, 60)}"`];
      if (!FIRST_BULLET.test(body[0])) {
        return [
          false,
          "first bullet must say what was understood: '- Issue: ...', '- Feature: ...' or '- Context: ...'",
        ];
      }
      if (body.length > MAX_BULLETS)
        return [false, `keep it to the point: at most ${MAX_BULLETS} bullets (found ${body.length})`];
      const long = body.find((l) => l.length > MAX_LINE);
      if (long) return [false, `each bullet must be at most ${MAX_LINE} characters: "${long.slice(0, 60)}..."`];
      return [true];
    },
  },
};

const config = {
  extends: ["@commitlint/config-conventional"],
  plugins: [bulletBody],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"],
    ],
    "header-max-length": [2, "always", 72],
    // Start lowercase; acronyms like MP3 or KIE inside the summary are fine.
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
    "subject-full-stop": [2, "never", "."],
    "body-leading-blank": [2, "always"],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
    "body-bullets": [2, "always"],
  },
};

export default config;
