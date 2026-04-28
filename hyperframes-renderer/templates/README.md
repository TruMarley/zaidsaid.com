# HyperFrames templates

Drop a new `<style>.html` in here, post `/render` with `style="<style>"`, and
the renderer will use it. Three patterns shipped:

| Template                      | Adds                                       | Ship date |
| ----------------------------- | ------------------------------------------ | --------- |
| `clip-9x16.html`              | Title, animated captions, lower-third      | x110      |
| `clip-9x16-lottie.html`       | + Lottie animation overlay slot            | x114      |
| `clip-9x16-three.html`        | + Three.js wireframe intro card            | x114      |

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
