# hyperframes-renderer

Server-side render layer for zaidsaid clips.

## What it does

Takes a finished raw clip MP4 + word-level transcript, renders a styled 9:16
output (animated captions, title, lower-third) via [HyperFrames](https://hyperframes.heygen.com).
Runs Node 22 + headless Chrome + native FFmpeg. Stateless.

## Run

```bash
cd hyperframes-renderer
npm install
node server.mjs        # listens on :8788
```

`POST /render` with:

```json
{
  "clip_url": "https://.../clip.mp4",
  "duration": 12.4,
  "title": "Hook copy",
  "handle": "@zaidsaid",
  "word_timings": [
    { "text": "Captions", "start": 0.20, "end": 0.55 },
    { "text": "snap",     "start": 0.55, "end": 0.78 }
  ],
  "style": "clip-9x16"
}
```

Response: `video/mp4` (binary).

## How it plugs into zaidsaid

1. The browser detects a clip and produces an MP4 blob (existing
   `recordClipViaCaptureStream` → `reencodeWebmToPresetMP4` path in `app.js`).
2. The blob is uploaded to a presigned URL (or posted directly as base64).
3. The browser hits `POST /render` on this service with the URL + transcript.
4. Service writes a per-request HyperFrames project from `templates/clip-9x16.html`,
   injects word timings as captions + GSAP tweens, runs `hyperframes render`,
   streams the MP4 back.

The service is intentionally stateless — every request is its own temp project
in `os.tmpdir()`. Add caching/queueing later if needed.

## Front-end wiring (not yet landed)

To wire the front-end to this endpoint, two changes are needed in `app.js`:

- **Persist `project.transcriptWords`** at the ElevenLabs Scribe response site
  (~`app.js:2657`). Word-level timings are currently bucketed into 6-second
  segments and the raw `data.words[]` is discarded.
- **Insert the `/render` call inside `shareClip`** at the splice point
  (~`app.js:7562`, right after `outBlob` is produced and before the download
  block). The same splice can be added to `exportClipsAsVideo`.

These wiring changes are deferred to a follow-up branch so that this PR keeps
the backend dormant until the front-end is ready to call it.

## Templates

- `templates/clip-9x16.html` — vertical clip with title in, captions every ~3
  words, lower-third on the final 2 seconds.

Add new styles by dropping a new `<style>.html` into `templates/` and posting
with the matching `style` field.
