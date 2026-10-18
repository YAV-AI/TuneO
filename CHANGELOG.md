# Changelog

All notable changes to TuneO are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-18

First public release.

### Added

- Create songs in Simple and Advanced modes with the v6, v6-wild and v6-mini models.
- AI lyric writer that produces arranged lyrics with section tags, delivery cues and ad-libs, plus title and style suggestions.
- Magic wand that rewrites a short idea into a compact, genre-first prompt.
- Style boost, vocal gender, weirdness, style influence, variety and duration controls.
- Remix tools: cover, extend, replace section, add instrumental and reuse prompt, for generated and uploaded audio.
- Custom voices (record or upload, verification phrase) and voices from a song, with a voice influence control and previews.
- Library with search, filters, sorting, play counts, cover art gallery, history and trash.
- Persistent player with queue, shuffle, repeat and synced karaoke lyrics.
- Downloads: tagged MP3 (title, artist, album, lyrics, cover art), WAV, stems, music video and cover art.
- Credits page with balance, spend per action and an activity log from KIE's charge records.
- Background worker that completes generations without an open browser and archives all media to RustFS.
- Docker Compose setup with web, worker and RustFS services, bound to localhost by default.
- Sidebar notice when a newer TuneO release is available on GitHub.

[0.1.0]: https://github.com/YAV-AI/TuneO/releases/tag/v0.1.0
