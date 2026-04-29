# HyperFrames templates

Drop a new `<style>.html` in here, post `/render` with `style="<style>"`, and
the renderer will use it. Three patterns shipped:

| Template                      | Adds                                       | Ship date |
| ----------------------------- | ------------------------------------------ | --------- |
| `clip-9x16.html`              | Title, animated captions, lower-third      | x110      |
| `clip-9x16-lottie.html`       | + Lottie animation overlay slot            | x114      |
| `clip-9x16-three.html`        | + Three.js wireframe intro card            | x114      |
| `clip-9x16-liquidglass.html`  | Beat-driven iOS-26 liquid-glass scenes     | x124      |

## Authoring rules (from `hyperframes/CLAUDE.md`)

1. Every timed element needs `data-start`, `data-duration`, `data-track-index`.
2. Elements with timing **MUST** have `class="clip"`.
3. Timelines must be `paused: true` and registered on `window.__timelines`.
4. No `Date.now()`, `Math.random()`, network fetches — render must be deterministic.
5. Run `npx hyperframes lint` after edits.

## Variable substitution

`server.mjs` substitutes `{{KEY}}` placeholders at top-level (not inside HTML
comments — the comment stripper kills those). Currently injected:

- `{{CLIP_URL}}` — relative path to the bg video (or empty when none)
- `{{DURATION}}` — total clip seconds
- `{{TITLE}}` — clip title
- `{{HANDLE}}` — `@handle` for lower-third
- `{{LOWER_THIRD_START}}` — when the lower-third pill animates in
- `{{CAPTION_BLOCKS}}` — generated `<div class="clip caption">` runs grouped from `word_timings`

For new templates, add the new placeholders to `server.mjs:renderTemplate`
and pass them through.

## Liquid glass (beats)

`clip-9x16-liquidglass.html` introduces a **beat-driven** composition model
that mirrors the editing pipeline shown in [Nate Herkelman's end-to-end
HyperFrames video](https://www.youtube.com/watch?v=Aw3BkmhYu4I). Instead of
one global caption track, you describe the clip as an ordered list of
**beats** — each beat is a card on a side of the screen, anchored to a
specific spoken-word timestamp.

```json
POST /render
{
  "clip_url":  "https://.../clip.mp4",
  "duration":  27.5,
  "handle":    "@zaidsaid",
  "style":     "clip-9x16-liquidglass",
  "beats": [
    { "id": "A", "side": "left",  "start":  0.6, "duration": 4.0,
      "eyebrow": "Edit demo · Ch 1", "title": "The edit\nlive",
      "karaoke_words": [{ "text": "This", "start": 0.62, "end": 0.78 }, ...] },
    { "id": "B", "side": "right", "start":  5.5, "duration": 6.0,
      "eyebrow": "video-use", "title": "Trim to\npunch",  "karaoke_words": [...] },
    { "id": "C", "side": "full",  "start": 12.0, "duration": 5.5,
      "title": "HyperFrames takes\nthe motion graphics" },
    { "id": "outro", "side": "split", "start": 22.5, "duration": 5.0,
      "title": "Thanks for\nwatching" }
  ]
}
```

Sides:

| `side`   | Behaviour                                                          |
| -------- | ------------------------------------------------------------------ |
| `left`   | Card on left half, vertically centered — face cam stays on right.  |
| `right`  | Card on right half — face cam stays on left.                       |
| `full`   | Full-width banner card — fades in/out, doesn't push the face cam.  |
| `bottom` | Lower-third callout (uses bottom margin; competes with `#lower-third` — pick one). |
| `split`  | Outro: dimmed bg + 540 px face-cam crop on right + headline left.  |

When `beats[]` is present the default 3-word caption track is suppressed —
beats own all on-screen text. `word_timings[]` may still be passed through
unchanged so the front-end doesn't have to branch.

The aesthetic and pacing rules live in
[`projects/_template/motion-philosophy.md`](../projects/_template/motion-philosophy.md).
Re-read it whenever you spec a new beat — it's the source of truth for
slide distance, easing, color, and which beat shapes are allowed where.

## Lottie

Use `<lottie-player>` from LottieFiles. The player is `<script>`-loaded so
HF inlines it during compile. Animations stay deterministic because the
player auto-plays at constant speed and HF seeks frames at exact timestamps.

LottieFiles has thousands of free CC0 animations at https://lottiefiles.com/free-animations.

## Three.js

Use the importmap pattern (already in `clip-9x16-three.html`). Drive the
scene off a `window.__threeTick` variable that GSAP advances — that's how
HF gets deterministic 3D rendering across worker frame-captures.

Heads-up: Three.js scenes can blow render time. Profile before shipping.

## satori thumbnail endpoint

Separate from compositions: `POST /thumbnail` returns a 1080×1920 PNG from
a JSON description. Use it for YouTube/Shorts thumbnail generation paired
with the x100/x102 metadata flow:

```bash
curl -X POST http://127.0.0.1:8788/thumbnail \
  -H "Content-Type: application/json" \
  -d '{"headline":"DON\'T MISS THIS","subhead":"@zaidsaid","palette":"#0a0a0a","accent":"#ff3366"}' \
  --output thumb.png
```
