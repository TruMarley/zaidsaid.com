# projects/

Per-clip Claude-Code workspace. Mirrors the layout used in the [Nate Herkelman
end-to-end editing video](https://www.youtube.com/watch?v=Aw3BkmhYu4I) so that
Claude Code (or the in-browser zaidsaid pipeline) can drop a raw clip into
`assets/clips/`, get a transcribed + edited cut, hand it to HyperFrames as a
beat-driven liquid-glass composition, and verify the render — all in a folder
that's easy to grep, diff, and `git log`.

```text
projects/
  _template/
    assets/
      clips/                # raw + edited MP4s
      transcripts/          # JSON word-level timestamps
    compositions/           # HF blocks — per-beat HTML, one file per scene
      components/           # HF components — paste-snippet effects (HF convention)
    renders/                # final MP4 outputs (created on first render — gitignored)
    screenshots/            # frame captures Claude uses to self-verify
    motion-philosophy.md    # the style doc Claude re-reads on every render
```

When you start a new clip, copy `_template/` to `projects/<slug>/` and drop
the raw file into `assets/clips/raw.mp4`. The renderer's `/render` endpoint
treats the project folder as the source of truth for that clip's style — it
reads `motion-philosophy.md` first, then the `beats[]` from the request body.

## Why this layout

- **`assets/transcripts/`** keeps word-level timing colocated with the clip
  it came from. Beats anchor to entries here, not to free-floating numbers.
- **`compositions/`** is one HTML file per beat — HF blocks. Each can be
  re-rendered, swapped, or hand-tweaked without touching the rest.
- **`compositions/components/`** holds HF components — CSS/JS snippets pasted
  into a host composition (karaoke caption, chrome-gradient text, etc.).
  Path matches the HF registry convention (`paths.components` default).
- **`screenshots/`** is the verification surface: Claude is told to render a
  frame at `beat.start + 0.4s`, save a PNG here, and only ship if the frame
  matches the description it claimed it would produce.

## Shipping a new project

1. `cp -r _template/ <slug>/`
2. Drop `raw.mp4` into `<slug>/assets/clips/`.
3. Run the editor (video-use / `n8n` / the in-browser Repurpose tab) to write
   `edited.mp4` + `transcripts/words.json`.
4. POST `{ style: "clip-9x16-liquidglass", beats: [...], duration, ... }` to
   `/render` with the project slug; the renderer reads `motion-philosophy.md`
   for that slug to keep the style consistent.
5. Final MP4 lands in `<slug>/renders/`.

## Installing plugins

Reusable blocks and components live in [`../registry/`](../registry/). They
are HyperFrames-registry-format files (one folder per plugin with a
`registry-item.json` + `<name>.html`). Install them into a project with:

```bash
./bin/install-plugin.mjs --list                       # show what's available
./bin/install-plugin.mjs liquid-glass-card            # install one (default project: _template)
./bin/install-plugin.mjs --all --project edit-demo    # install all into a specific project
```

The script is a local stand-in for `hyperframes add` — the pinned HF CLI
(0.1.15) does not yet ship that command. When the CLI version bumps, the
registry can be hosted at a public URL and `hyperframes add <name>` will
work directly against it; the file layout is identical.

`_template` ships with all four registry plugins pre-installed so a fresh
project copy already has the liquid-glass card, the outro split block, and
the karaoke / chrome-text components ready to use.
