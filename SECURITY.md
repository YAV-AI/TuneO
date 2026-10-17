# Security Policy

## Supported versions

TuneO is developed on the `main` branch. Security fixes are made there and are not backported.

| Version                 | Supported |
| ----------------------- | --------- |
| `main` (latest)         | Yes       |
| Older commits and forks | No        |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report vulnerabilities privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Include:

- what the issue is and where it lives (file, route or setting),
- steps to reproduce or a proof of concept,
- the impact you expect (for example, spending someone's API credits or reading their files).

You should get an acknowledgement within a few days. Once a fix is ready we will publish it with credit to you, unless you prefer to stay anonymous.

## Deployment model

TuneO is designed as a **single-user app on your own machine** and has no built-in authentication. Please read the README's Security section before deploying. In particular:

- By default the app and storage listen on `127.0.0.1` only. Exposing them to a network or the internet without an authentication layer lets anyone spend your KIE credits and delete your library. That is a deployment choice, not a vulnerability in TuneO.
- Change the default storage credentials (`S3_ACCESS_KEY`, `S3_SECRET_KEY`).
- Keep your `.env` file private; it contains your API keys.

Reports about these documented trade-offs are welcome as feature requests (for example, adding optional login).
