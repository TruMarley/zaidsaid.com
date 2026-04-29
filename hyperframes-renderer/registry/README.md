# registry/

HyperFrames-registry-format plugins for the zaidsaid renderer. Each folder
holds one plugin: a `registry-item.json` describing it plus the `.html`
file(s) to install.

```text
registry/
  registry.json                  # manifest — lists every plugin
  liquid-glass-card/             # block — frosted side-card with eyebrow + title + karaoke
    registry-item.json
    liquid-glass-card.html
  outro-split/                   # block — 1080×1920 outro: face-cam crop + headline
    registry-item.json
    outro-split.html
  karaoke-caption/               # component — word-by-word highlight effect
    registry-item.json
    karaoke-caption.html
  chrome-text/                   # component — silver-gradient title/eyebrow text
    registry-item.json
    chrome-text.html
```

## Install

```bash
./bin/install-plugin.mjs --list
./bin/install-plugin.mjs liquid-glass-card
./bin/install-plugin.mjs --all --project edit-demo
```

Installing a **block** copies its `.html` into `projects/<slug>/compositions/<name>.html`. Wire it into a host composition with `data-composition-src="compositions/<name>.html"`.

Installing a **component** copies its `.html` into `projects/<slug>/compositions/components/<name>.html`. Open the file and paste the `<style>` / markup / `<script>` snippets into your host composition where the inline comment block instructs.

## Adding new plugins

1. Make a folder under `registry/<my-plugin>/`.
2. Drop a `registry-item.json` describing it (see existing items for the shape — `name`, `type` (`block` or `component`), `title`, `description`, `tags`, plus `dimensions` + `duration` for blocks, plus `files`).
3. Drop the actual `<name>.html` next to it.
4. Add an entry to `registry.json`'s `items[]` array.
5. Run `./bin/install-plugin.mjs <my-plugin>` to verify it installs.

Once the upstream HF CLI ships `hyperframes add`, this registry can be
hosted at a public URL and the install script becomes optional —
`hyperframes add <name>` will pull from the same files.

## Why a local registry?

`hyperframes add` is not in the pinned CLI version (0.1.15), so the
in-repo registry plus a small install script keeps the workflow working
today without depending on a CLI feature that isn't shipped yet. The
registry-item.json shape matches the upstream format so nothing has to
change when we upgrade.
