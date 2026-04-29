#!/usr/bin/env node
/**
 * install-plugin.mjs — local stand-in for `hyperframes add <name>`
 *
 * HyperFrames 0.1.15 (the version pinned in package.json) does not yet
 * ship the `hyperframes add` registry command, so this script does the
 * same job against our in-repo `registry/` folder:
 *
 *   - blocks      → projects/<project>/compositions/<name>.html
 *   - components  → projects/<project>/compositions/components/<name>.html
 *
 * Usage:
 *
 *   ./bin/install-plugin.mjs <name> [--project _template]
 *   ./bin/install-plugin.mjs --all
 *   ./bin/install-plugin.mjs --list
 *
 * No flags → prints help.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REGISTRY = path.join(ROOT, "registry");

async function loadManifest() {
  const buf = await fs.readFile(path.join(REGISTRY, "registry.json"), "utf8");
  return JSON.parse(buf);
}

async function listItems() {
  const m = await loadManifest();
  console.log(`Available plugins in ${m.name} (${m.items.length}):\n`);
  for (const it of m.items) {
    console.log(`  ${it.type.padEnd(10)} ${it.name.padEnd(22)} ${it.title}`);
  }
}

async function installItem(item, projectDir) {
  const srcDir = path.join(REGISTRY, item.name);
  const destBase =
    item.type === "block"
      ? path.join(projectDir, "compositions")
      : path.join(projectDir, "compositions", "components");
  await fs.mkdir(destBase, { recursive: true });
  // Only copy the .html files — registry-item.json stays in the registry,
  // not in the host project (matches hyperframes add behaviour).
  const htmlFiles = (item.files || []).filter(f => f.endsWith(".html"));
  if (htmlFiles.length === 0) {
    console.warn(`  warn: ${item.name} has no html files in manifest`);
    return [];
  }
  const written = [];
  for (const f of htmlFiles) {
    const src = path.join(srcDir, f);
    const dest = path.join(destBase, f);
    await fs.copyFile(src, dest);
    written.push(dest);
  }
  return written;
}

async function installByName(name, projectDir) {
  const m = await loadManifest();
  const item = m.items.find(i => i.name === name);
  if (!item) {
    console.error(`error: no plugin named "${name}" in registry. Run --list to see options.`);
    process.exit(2);
  }
  const written = await installItem(item, projectDir);
  console.log(`installed ${item.type} ${item.name}:`);
  for (const f of written) console.log("  " + path.relative(ROOT, f));
  if (item.type === "block") {
    console.log(`\nWire into a host composition with:\n`);
    console.log(`  <div`);
    console.log(`    data-composition-id="${item.name}"`);
    console.log(`    data-composition-src="compositions/${item.name}.html"`);
    console.log(`    data-start="0" data-duration="${item.duration || 4}"`);
    console.log(`    data-track-index="2"`);
    console.log(`    data-width="${item.dimensions?.width || 1080}" data-height="${item.dimensions?.height || 1920}"`);
    console.log(`  ></div>\n`);
  } else {
    console.log(`\nPaste the contents of the file into your host composition's <style>/<script>.\n`);
  }
}

async function installAll(projectDir) {
  const m = await loadManifest();
  for (const item of m.items) {
    const written = await installItem(item, projectDir);
    console.log(`installed ${item.type} ${item.name} → ${written.length} file(s)`);
  }
}

function help() {
  console.log(`install-plugin.mjs — install plugins from registry/ into a project

USAGE
  ./bin/install-plugin.mjs <name> [--project <slug>]
  ./bin/install-plugin.mjs --all  [--project <slug>]
  ./bin/install-plugin.mjs --list

OPTIONS
  --project <slug>   Target project under projects/<slug> (default: _template)
  --list             List available plugins
  --all              Install every plugin in the registry
`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    help(); return;
  }
  if (argv[0] === "--list") { await listItems(); return; }

  const projectIdx = argv.indexOf("--project");
  const projectSlug = projectIdx >= 0 ? argv[projectIdx + 1] : "_template";
  const projectDir = path.join(ROOT, "projects", projectSlug);
  // Verify the project dir exists so we don't silently create scattered output.
  try { await fs.access(projectDir); }
  catch { console.error(`error: project dir not found: ${path.relative(ROOT, projectDir)}`); process.exit(2); }

  if (argv[0] === "--all") { await installAll(projectDir); return; }
  await installByName(argv[0], projectDir);
}

main().catch(err => { console.error(err); process.exit(1); });
