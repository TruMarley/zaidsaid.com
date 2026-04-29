# Motion philosophy

This doc teaches Claude Code how zaidsaid's motion graphics should feel. It is
re-read on every render request that uses `style="clip-9x16-liquidglass"` so
the output stays consistent across clips and across re-prompts.

## North star

> iOS 26 liquid-glass UI floating over a lightly dimmed talking head, with
> motion that always carries the meaning — never decoration for decoration's
> sake.

## Hard rules

1. **Beats are anchored to spoken words.** Every scene's `start` must line up
   with a real word in `transcripts/words.json`. Don't fabricate timing.
2. **One idea per beat.** If a beat is doing two jobs (showing a card *and*
   running karaoke about something else), split it.
3. **The face cam is the subject.** Side-cards (`side: "left"` / `"right"`)
   never cover the speaker. If the face is centered, use `"bottom"` or
   `"full"` instead.
4. **No grid overlays, no faux-window chrome, no fake cursors.** Liquid glass
   already implies depth. Adding grids reads as cheap.
5. **Karaoke runs are short.** 4–8 words max. If the line is longer, split it
   into two beats or drop the karaoke run and use a static `title` instead.

## Tone of motion

- **Slide-in distance:** 120 px from the side; 160 px from the bottom. Larger
  feels theatrical; smaller feels nervous.
- **Easing:** `power3.out` for entrances; `power2.in` for exits. Never linear.
- **Duration:** 0.45–0.6 s for cards; 80 ms color flips for karaoke words.
- **No bounce, no overshoot, no `back.out(>2)`.** It dates the look fast.

## Color & material

- **Card surface:** translucent white `rgba(255,255,255,0.16)` over the bg
  with `backdrop-filter: blur(28px) saturate(140%)`. Never opaque.
- **Title text:** chrome gradient `#fff → #c5cdd6` clipped to text. Eyebrow
  uses a triple-stop chrome sweep.
- **Accent color:** save accents for the lower-third pill and the outro.
  Cards stay achromatic. The face cam is the color.
- **Background dim:** the `#vignette` clip handles this; do not stack
  additional dim layers on top.

## Beat composition (the four shapes)

| Side       | Use it for                                                       |
| ---------- | ---------------------------------------------------------------- |
| `left`     | Title cards on a face-cam-right composition                      |
| `right`    | Supporting context, B-roll-style assertions                      |
| `full`     | Headlines that should land before the face cam re-emerges        |
| `bottom`   | Lower-third callouts (use sparingly — competes with `#lower-third`) |
| `split`    | Outro: face-cam crops to right-half, headline on left            |

## Anti-patterns (do not do)

- Repeating the same beat shape three times in a row — alternate sides.
- Using karaoke for the *first* beat of a clip — viewers haven't synced yet.
- Cards smaller than 540 px wide — the chrome gradient doesn't read.
- Stacking two beats at the same `data-track-index` — they fight on render.

## When in doubt

Take a screenshot at the beat's `start + 0.4s`, compare to the previous clip
in `renders/`, and only ship if the new frame would feel at home next to it.
