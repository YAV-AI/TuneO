# KIE music API reference (for TuneO)

Pulled live from `api.kie.ai` on 2026-10-16. Raw OpenAPI per model: `GET https://api.kie.ai/api/v1/models/ai-music-api/<model>/schema` (needs `KIE_API_KEY`).

## Transport (same for all 23 endpoints)

- `POST https://api.kie.ai/api/v1/jobs/createTask` with `{ model, input: {...}, callBackUrl? }`
- Returns `{code, msg, data: {taskId}}`. Always check body `code`, not HTTP status.
- Poll `GET /api/v1/jobs/recordInfo?taskId=...` (max 10 req/s per task). `state`: waiting, queuing, generating, success, fail.
- `createTask` limit: 20 per 10s per account.
- Errors: 401 auth, 402 no credits, 422 validation, 429 rate limit, 455 unavailable.
- Uploads (user audio/images): `https://kieai.redpandaai.co/api/file-stream-upload` (multipart) or `file-base64-upload`. Files deleted after 24h.
- Generated media deleted after **14 days**: the app must copy audio/cover to its own storage.
- Balance: `GET /api/v1/chat/credit`.

### Result shapes

| Kind                                                                                                                 | Where results live                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| generate, extend, sounds, upload-and-cover, upload-and-extend, add-vocals, add-instrumental, mashup, replace-section | `response.data[]` -> `{id (audio_id), audio_url, stream_audio_url, image_url, prompt, title, tags, duration, model_name, createTime}`. **Two tracks per request.** |
| generate-lyrics, generate-midi, timeStamped-lyrics                                                                   | `response.resultObject` (lyrics in `resultObject.lyricsData[].text`)                                                                                               |
| convert-to-wav, separate-vocals, cover-generate, create-music-video                                                  | `response.resultUrls`                                                                                                                                              |

Callbacks fire in 3 stages: `text`, `first` (first track streamable), `complete`. `stream_audio_url` lets the UI play before the MP3 is final, so playback can start while the track renders.

## Model versions (`model` field inside `input`)

Live: `V6` (default, best vocals), `V6_MINI` (fast, cheap), `V6_WILD` (experimental). Everything V4 to V5_5 is marked discontinued. UI dropdown should offer only the three V6 variants.

## Shared "custom" knobs

Used by generate (custom mode), extend, cover, upload-extend, add-vocals, add-instrumental, mashup, replace-section:

| Field                          | Type                               | Notes                                     |
| ------------------------------ | ---------------------------------- | ----------------------------------------- |
| `style` / `tags`               | string <=1000                      | Name differs per endpoint (see below)     |
| `negative_tags`                | string (<=200 on some)             | Exclude styles                            |
| `vocal_gender`                 | `m` \| `f`                         | Probabilistic only                        |
| `style_weight`                 | 0..1, 2dp                          |                                           |
| `weirdness_constraint`         | 0..1, 2dp                          |                                           |
| `audio_weight`                 | 0..1, 2dp                          | Not with instrumental                     |
| `variety`                      | int 0..4, default 1                | 0 exact, 1 normal, 2 high, 3 extra, 4 max |
| `persona_id` + `persona_model` | `style_persona` \| `voice_persona` | From generate-persona or create-voice     |
| `duration`                     | 10..360 s                          | V6 family only                            |

`lyrics` beats `prompt` wherever both exist. When `instrumental: true`, do not send `lyrics`, `prompt`, `vocal_gender`.

## Endpoints

### Core creation (12 credits each unless noted)

**`ai-music-api/generate`** : the Create button.

- Required: `custom_mode`, `instrumental`, `model`.
- **Simple mode** (`custom_mode:false`): `prompt` is an idea (<=3000), lyrics auto-written. Needs at least one of `prompt`-adjacent attachments: `style`, `lyrics`, `image_urls` (<=5, 10MB), `video_urls` (1, <=241s), `audio_urls` (6s..30min). Total attachments <=10. Do NOT send duration/vocal_gender/weights/variety. This maps to the screenshot's "+ Audio / + Voice / + Image" chips.
- **Advanced mode** (`custom_mode:true`): `title` required (<=80). At least one of `style`, `lyrics`, `negative_tags`. Unlocks all shared knobs above plus `duration`.

**`extend`**: `audio_id`_, `model`_, `continue_at` (s), `instrumental`, `lyrics`/`prompt`, `style`, `title` (<=100), shared knobs. Note: no `task_id`, only `audio_id`.

**`upload-and-extend-audio`**: `upload_url`* (<=8 min), `model`*, `continue_at`, rest as extend.

**`upload-and-cover-audio`**: `upload_url`* (<=8 min), `instrumental`_, `model`_, `title` (<=80), `style`, `lyrics`, shared knobs, `duration`.

**`add-vocals`**: `upload_url`_, `title`_, `style`_, `negative_tags`_, `lyrics`/`prompt`, `model` (default V6), shared knobs.

**`add-instrumental`**: `upload_url`_, `title`_, `tags`_, `negative_tags`_, `lyrics`, `model`, shared knobs. (uses `tags`, not `style`)

**`mashup`**: `upload_url_list`* (2 URLs), `style`_, `title`_, `model`*, lyrics/prompt, shared knobs, `duration` (default 20).

**`replace-section`** (5 cr): oneOf source `{task_id, audio_id}` OR `{upload_url, model}`, plus required `prompt` (new lyrics), `tags`, `title`, `infill_start_s`, `infill_end_s` (>=10s window, <=50% of song), `full_lyrics`; optional `lyrics`, shared knobs.

**`sounds`** (2.5 cr): `prompt`* (<=500), `model`* (V5..V6 family), `sound_loop`, `sound_tempo` (1..300 BPM), `sound_key` (Any, C..B, Cm..Bm), `grab_lyrics`. SFX/loops.

### Post-processing on a generated track (`task_id` + `audio_id`)

| Model                      | Cost         | Extra fields                                                                 | Output                      |
| -------------------------- | ------------ | ---------------------------------------------------------------------------- | --------------------------- |
| `convert-to-wav-format`    | 0.4          |                                                                              | WAV url                     |
| `separate-vocals`          | 10 / 20 / 50 | oneOf `{task_id,audio_id}` or `{audio_url}` (<=20MB)                         | stems                       |
| `generate-midi-from-audio` | free         | `task_id` of a **separation** task, optional stem `audio_id`                 | MIDI                        |
| `timeStamped-lyrics`       | 0.5          |                                                                              | word timings (karaoke view) |
| `create-music-video`       | 2            | `author` (<=50), `domain_name` (<=50)                                        | MP4                         |
| `cover-generate`           | free         | `task_id` only                                                               | cover images                |
| `generate-persona`         | free         | `name`_, `description`_, `vocal_start`/`vocal_end` (10..30s window), `style` | persona_id                  |

### Helpers

- `generate-lyrics` (0.4): `prompt`* (<=200 chars). Lyrics button in Advanced.
- `boost-music-style` (0.4): `content`* style text -> enriched style. "Magic wand" on the style box.

### Custom voice flow ("+ Voice" in the screenshot), all free

1. `validation-phrase`: `voice_url`_, `vocal_start_s`_, `vocal_end_s`*, `language` (en, zh, es, fr, pt, de, ja, ko, hi, ru) -> returns a phrase (`validateInfo`) the user must sing.
2. `regenerate-phrase`: `task_id`* if they want a different phrase.
3. `create-voice`: `task_id`_, `verify_url`_ (user recording of the phrase), `voice_name`, `description`, `style`, `singer_skill_level` (beginner..professional).
4. `check-voice`: `task_id`* -> status; resulting id goes into `persona_id` with `persona_model: "voice_persona"`.

## Gotchas for the app

1. Field naming is inconsistent: `style` vs `tags`, `upload_url` vs `audio_url` vs `voice_url`, `vocal_start` vs `vocal_start_s`. Wrap each endpoint in its own typed adapter.
2. Every generation returns 2 songs: store each as its own library row keyed by `audio_id`, grouped by `task_id`.
3. Most follow-ups need **both** `task_id` and `audio_id`: persist both.
4. Media expires in 14 days: download MP3 + cover to our storage on `complete`.
5. Callbacks need a public URL; locally, fall back to polling `recordInfo` every 3s.
