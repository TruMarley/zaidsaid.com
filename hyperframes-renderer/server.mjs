/**
 * zaidsaid hyperframes-renderer
 *
 * Tiny HTTP wrapper around `hyperframes render` so the browser-side clipping
 * pipeline can post a finished clip + word-level transcript and get back a
 * styled 9:16 MP4 (animated captions, title, lower-third).
 *
 * POST /render
 *   {
 *     "clip_url":   "https://.../clip.mp4",       // or a presigned URL
 *     "duration":   12.4,                         // seconds
 *     "title":      "Headline copy",
 *     "handle":     "@zaidsaid",
 *     "word_timings": [
 *       { "text": "Captions", "start": 0.20, "end": 0.55 },
 *       { "text": "snap",     "start": 0.55, "end": 0.78 },
 *       ...
 *     ],
 *     "style":      "vertical-captions-v1"        // template name
 *   }
 *
 * Response: 200 video/mp4 (binary)
 */

import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8788;
const TEMPLATES = path.join(__dirname, "templates");
// x125: project scaffold whose compositions/ + components/ get seeded into
// the per-render workDir so HF blocks installed there (via bin/install-plugin.mjs
// or future `hyperframes add`) become available via data-composition-src.
const PROJECT_TEMPLATE = path.join(__dirname, "projects", "_template");

const app = express();

// Permissive CORS for direct browser testing. In production the request hits
// the cloudflare worker first and never touches this CORS middleware — the
// worker's CORS rules apply. Override with HF_CORS_ORIGIN if you want to
// pin this to a specific origin for direct local development.
const CORS_ORIGIN = process.env.HF_CORS_ORIGIN || "*";
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.use(express.json({ limit: "60mb" })); // base64-encoded clip blobs

app.get("/ping", (_req, res) => res.json({ ok: true, service: "hyperframes-renderer" }));

app.post("/render", async (req, res) => {
  const {
    clip_url, clip_b64, duration, title = "", handle = "", word_timings = [],
    style = "clip-9x16",
    // x114: extension-template fields, ignored by clip-9x16.
    lottie_url = "", lottie_start = null, lottie_duration = null,
    // x124: beat-driven liquid-glass scenes for clip-9x16-liquidglass.
    // When present, BEAT_BLOCKS are emitted in addition to (or instead of)
    // the standard 3-word caption track. See templates/clip-9x16-liquidglass.html.
    beats = [],
    // x126: silence/segment cuts to remove from the input clip BEFORE render.
    // Each entry is [start, end] in the ORIGINAL clip timeline (seconds).
    // Server uses ffmpeg to concat the kept ranges, remaps `beats[]` and
    // `word_timings[]` to the trimmed timeline, and updates `duration`.
    cuts = [],
  } = req.body || {};
  if (!duration) {
    return res.status(400).json({ error: "duration is required" });
  }

  const id = crypto.randomBytes(6).toString("hex");
  const workDir = path.join(os.tmpdir(), `hf-${id}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    let resolvedClipUrl = clip_url || "";
    if (clip_b64) {
      const buf = Buffer.from(clip_b64, "base64");
      await fs.writeFile(path.join(workDir, "clip.mp4"), buf);
      resolvedClipUrl = "clip.mp4";
    }

    // x126: pre-trim the clip with ffmpeg if `cuts[]` was supplied. Returns
    // the new clip path (relative), the trimmed duration, and the cut
    // total so we can remap downstream timings.
    const validCuts = normalizeCuts(cuts, duration);
    let activeDuration = duration;
    let beatsRemapped = beats;
    let wordsRemapped = word_timings;
    if (validCuts.length && clip_b64) {
      const trimmedRel = await trimClip(workDir, resolvedClipUrl, duration, validCuts);
      resolvedClipUrl = trimmedRel;
      activeDuration = duration - sumCutLength(validCuts);
      beatsRemapped = remapBeatsToTrimmed(beats, validCuts);
      wordsRemapped = remapWordsToTrimmed(word_timings, validCuts);
    } else if (validCuts.length) {
      // We can only ffmpeg-trim when we have the bytes locally. If a clip_url
      // was supplied, the server would need to download first — out of scope.
      console.warn("[render] cuts provided with clip_url (not clip_b64) — cuts ignored. Pass clip_b64 to enable trim.");
    }

    const templatePath = path.join(TEMPLATES, `${style}.html`);
    const template = await fs.readFile(templatePath, "utf8");
    const lottieStart = lottie_start != null ? Number(lottie_start) : Math.max(0, duration - 4);
    const lottieDuration = lottie_duration != null ? Number(lottie_duration) : 2.5;
    // x124: when beats[] is present, suppress the default caption track —
    // beats own the on-screen text and karaoke runs. word_timings are still
    // accepted so the front-end can pass them through unchanged.
    const beatsActive = Array.isArray(beatsRemapped) && beatsRemapped.length > 0;
    const html = renderTemplate(stripVideoIfMissing(template, resolvedClipUrl), {
      CLIP_URL: resolvedClipUrl,
      DURATION: activeDuration.toFixed(2),
      TITLE: escapeHtml(title),
      HANDLE: escapeHtml(handle),
      LOWER_THIRD_START: Math.max(0, activeDuration - 3).toFixed(2),
      CAPTION_BLOCKS: beatsActive ? "" : buildCaptionBlocks(wordsRemapped),
      BEAT_BLOCKS: beatsActive ? buildBeatBlocks(beatsRemapped) : "",
      LOTTIE_URL: lottie_url,
      LOTTIE_START: lottieStart.toFixed(2),
      LOTTIE_DURATION: lottieDuration.toFixed(2),
    });

    const indexPath = path.join(workDir, "index.html");
    const tweenedHtml = beatsActive
      ? appendBeatTweens(html, beatsRemapped)
      : appendCaptionTweens(html, wordsRemapped);
    await fs.writeFile(indexPath, tweenedHtml);
    await fs.writeFile(path.join(workDir, "meta.json"), JSON.stringify({ id, name: `clip-${id}` }));
    await fs.writeFile(path.join(workDir, "hyperframes.json"), JSON.stringify({
      $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
      paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }
    }));

    // x125: seed the workDir's compositions/ from the project template so any
    // installed HF block (e.g. liquid-glass-card.html) referenced via
    // data-composition-src in the host index.html resolves at render time.
    if (beatsActive) {
      await seedCompositions(PROJECT_TEMPLATE, workDir);
    }

    const outPath = path.join(workDir, `out-${id}.mp4`);
    await runRender(workDir, outPath);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="clip-${id}.mp4"`);
    const buf = await fs.readFile(outPath);
    res.send(buf);
  } catch (err) {
    console.error("[render] failed", err);
    res.status(500).json({ error: "render_failed", detail: String(err) });
  } finally {
    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

// x126: cuts — segments of the input clip to remove before render. Sorts,
// merges overlapping ranges, and clips to [0, duration].
function normalizeCuts(cuts, duration) {
  if (!Array.isArray(cuts)) return [];
  const cleaned = cuts
    .map(c => ({
      start: Math.max(0, Number(c.start ?? c[0] ?? 0)),
      end:   Math.min(duration, Number(c.end ?? c[1] ?? 0)),
    }))
    .filter(c => c.end > c.start)
    .sort((a, b) => a.start - b.start);
  // Merge overlapping/adjacent.
  const merged = [];
  for (const c of cleaned) {
    if (merged.length && c.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, c.end);
    } else {
      merged.push({ ...c });
    }
  }
  return merged;
}

function sumCutLength(cuts) {
  return cuts.reduce((s, c) => s + (c.end - c.start), 0);
}

// Map an original-timeline timestamp `t` to the trimmed timeline by
// subtracting the total cut length BEFORE `t`. Anchors that fall inside
// a cut are pulled to the cut's start.
function remapTime(t, cuts) {
  let removed = 0;
  for (const c of cuts) {
    if (t >= c.end) removed += c.end - c.start;
    else if (t > c.start) { removed += t - c.start; t = c.start + removed; break; }
    else break;
  }
  return t - removed;
}

function remapBeatsToTrimmed(beats, cuts) {
  if (!Array.isArray(beats) || cuts.length === 0) return beats;
  return beats.map(b => {
    const start = Number(b.start || 0);
    const dur = Number(b.duration || 0);
    return {
      ...b,
      start: remapTime(start, cuts),
      duration: Math.max(0.5, remapTime(start + dur, cuts) - remapTime(start, cuts)),
      karaoke_words: Array.isArray(b.karaoke_words)
        ? b.karaoke_words.map(w => ({
            ...w,
            start: remapTime(Number(w.start || 0), cuts),
            end:   remapTime(Number(w.end   || 0), cuts),
          })).filter(w => w.end > w.start)
        : b.karaoke_words,
    };
  }).filter(b => b.duration > 0);
}

function remapWordsToTrimmed(words, cuts) {
  if (!Array.isArray(words) || cuts.length === 0) return words;
  return words.map(w => ({
    ...w,
    start: remapTime(Number(w.start || 0), cuts),
    end:   remapTime(Number(w.end   || 0), cuts),
  })).filter(w => w.end > w.start);
}

// Trim a clip on disk by writing a per-segment list and concat'ing with
// ffmpeg. Each kept range becomes one ffmpeg trim; concat demuxer joins
// them losslessly when the source is constant-FPS H.264 (re-encode if not).
async function trimClip(workDir, clipRel, duration, cuts) {
  const inputPath = path.join(workDir, clipRel);
  // Build the kept-ranges list (the inverse of cuts).
  const kept = [];
  let cursor = 0;
  for (const c of cuts) {
    if (c.start > cursor) kept.push({ start: cursor, end: c.start });
    cursor = Math.max(cursor, c.end);
  }
  if (cursor < duration) kept.push({ start: cursor, end: duration });
  if (kept.length === 0) throw new Error("trimClip: cuts removed entire clip");

  // Build a filter_complex to extract + concat the kept ranges in one pass.
  // This re-encodes the video, which is unavoidable when input is AV1 (HF
  // wants H.264 anyway for headless Chrome's <video>).
  const filters = [];
  const labels = [];
  kept.forEach((k, i) => {
    const s = k.start.toFixed(3), e = k.end.toFixed(3);
    filters.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`);
    filters.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);
    labels.push(`[v${i}][a${i}]`);
  });
  filters.push(`${labels.join("")}concat=n=${kept.length}:v=1:a=1[outv][outa]`);
  const outRel = "clip.trimmed.mp4";
  const outPath = path.join(workDir, outRel);
  await runFfmpeg([
    "-y", "-i", inputPath,
    "-filter_complex", filters.join(";"),
    "-map", "[outv]", "-map", "[outa]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    outPath
  ]);
  return outRel;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "inherit"] });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
  });
}

// x125: copy compositions/*.html (blocks) and compositions/components/*.html
// (components) from a project template into a per-render workDir. Empty
// .gitkeep, .json, and README files are skipped so the workDir only ends up
// with HF-relevant artifacts.
async function seedCompositions(srcProjectDir, destWorkDir) {
  const srcCompDir = path.join(srcProjectDir, "compositions");
  const destCompDir = path.join(destWorkDir, "compositions");
  try { await fs.access(srcCompDir); } catch { return; }
  await fs.mkdir(path.join(destCompDir, "components"), { recursive: true });
  const blocks = await fs.readdir(srcCompDir, { withFileTypes: true });
  for (const ent of blocks) {
    if (ent.isFile() && ent.name.endsWith(".html")) {
      await fs.copyFile(path.join(srcCompDir, ent.name), path.join(destCompDir, ent.name));
    }
  }
  const componentsDir = path.join(srcCompDir, "components");
  try { await fs.access(componentsDir); } catch { return; }
  const comps = await fs.readdir(componentsDir, { withFileTypes: true });
  for (const ent of comps) {
    if (ent.isFile() && ent.name.endsWith(".html")) {
      await fs.copyFile(path.join(componentsDir, ent.name), path.join(destCompDir, "components", ent.name));
    }
  }
}

function stripVideoIfMissing(tpl, clipUrl) {
  if (clipUrl) return tpl;
  return tpl.replace(/<video id="bg-video"[\s\S]*?<\/video>/, "");
}

function renderTemplate(tpl, vars) {
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`{{${k}}}`).join(String(v)), tpl);
}

function buildCaptionBlocks(words) {
  const groups = groupWordsIntoLines(words, 3);
  return groups.map((g, i) => {
    const start = g[0].start.toFixed(2);
    const end = g[g.length - 1].end.toFixed(2);
    const dur = (Number(end) - Number(start)).toFixed(2);
    const text = escapeHtml(g.map(w => w.text).join(" "));
    return `<div id="cap${i}" class="clip caption" data-start="${start}" data-duration="${dur}" data-track-index="2">${text}</div>`;
  }).join("\n      ");
}

function groupWordsIntoLines(words, perLine) {
  const out = [];
  for (let i = 0; i < words.length; i += perLine) out.push(words.slice(i, i + perLine));
  return out;
}

// x124: beats — per-scene liquid-glass cards anchored to spoken-word
// timestamps. Each beat is independently positioned (left | right | full |
// bottom | split) and may carry an eyebrow line, a title, and a karaoke run.
//
// See templates/clip-9x16-liquidglass.html and styles/motion-philosophy.md
// for the aesthetic this matches.
function buildBeatBlocks(beats) {
  return beats.map((b, i) => {
    const id = `beat${i}`;
    const start = Number(b.start || 0).toFixed(2);
    const dur = Number(b.duration || 3).toFixed(2);
    const side = b.side || "left";
    const trackIndex = 2 + (i % 6); // keep beats out of the bg/vignette tracks
    if (side === "split") {
      // Outro split: dimmed bg + face-cam crop on right + headline on left.
      const text = escapeHtml(b.title || "Thanks for watching").replace(/\n/g, "<br>");
      return `
      <div id="${id}-bg" class="clip split-bg" data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex}"></div>
      <div id="${id}-text" class="clip split-text" data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex + 1}">${text}</div>`;
    }
    const eyebrow = b.eyebrow ? `<div class="eyebrow">${escapeHtml(b.eyebrow)}</div>` : "";
    // Newlines in `title` are intentional line breaks (e.g. "The edit\nlive"
    // → "The edit" / "live") — escape, then map \n to <br>.
    const title = b.title ? `<div class="title">${escapeHtml(b.title).replace(/\n/g, "<br>")}</div>` : "";
    const karaoke = Array.isArray(b.karaoke_words) && b.karaoke_words.length
      ? `<div class="karaoke">${b.karaoke_words.map((w, wi) => {
          const ws = Number(w.start || 0).toFixed(2);
          const we = Number(w.end || (w.start || 0) + 0.2).toFixed(2);
          return `<span class="word" data-word-index="${wi}" data-word-start="${ws}" data-word-end="${we}">${escapeHtml(w.text || "")}</span>`;
        }).join(" ")}</div>`
      : "";
    return `<div id="${id}" class="clip beat" data-side="${escapeHtml(side)}" data-start="${start}" data-duration="${dur}" data-track-index="${trackIndex}">
        ${eyebrow}
        ${title}
        ${karaoke}
      </div>`;
  }).join("\n      ");
}

function appendBeatTweens(html, beats) {
  const lines = [];
  beats.forEach((b, i) => {
    const id = `beat${i}`;
    const start = Number(b.start || 0).toFixed(2);
    const side = b.side || "left";
    if (side === "split") {
      lines.push(`tl.from("#${id}-bg", { opacity: 0, duration: 0.6, ease: "power3.out" }, ${start});`);
      lines.push(`tl.from("#${id}-text", { opacity: 0, x: -60, duration: 0.7, ease: "power3.out" }, ${start});`);
      return;
    }
    // Card slides in from its own side — left from -120, right from +120, bottom from +160, full fades.
    const fromVars = side === "right" ? "{ opacity: 0, x: 120, duration: 0.55, ease: \"power3.out\" }"
      : side === "bottom" ? "{ opacity: 0, y: 160, duration: 0.55, ease: \"power3.out\" }"
      : side === "full" ? "{ opacity: 0, duration: 0.45, ease: \"power2.out\" }"
      : "{ opacity: 0, x: -120, duration: 0.55, ease: \"power3.out\" }";
    lines.push(`tl.from("#${id}", ${fromVars}, ${start});`);
    if (Array.isArray(b.karaoke_words)) {
      b.karaoke_words.forEach((w, wi) => {
        const ws = Number(w.start || 0).toFixed(2);
        lines.push(`tl.add(()=>document.querySelector("#${id} [data-word-index=\\"${wi}\\"]")?.classList.add("lit"), ${ws});`);
      });
    }
  });
  return html.replace("// __TWEENS__", lines.join("\n      "));
}

function appendCaptionTweens(html, words) {
  const groups = groupWordsIntoLines(words, 3);
  const tweens = groups.map((g, i) => {
    const start = g[0].start.toFixed(2);
    return `tl.from("#cap${i}", { opacity: 0, scale: 0.85, duration: 0.22, ease: "back.out(2)" }, ${start});`;
  }).join("\n      ");
  // clip-9x16 uses the literal sentinel; clip-9x16-liquidglass uses // __TWEENS__.
  // Replace whichever the active template carries.
  return html
    .replace("// Per-caption tweens are appended by server.mjs from word_timings.", tweens)
    .replace("// __TWEENS__", tweens);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// x127b: spawn the hyperframes binary by absolute path. The previous form
// was `spawn("npx", ["hyperframes", ...], { cwd: workDir })`, which made
// npx walk up from /tmp/hf-XXX looking for node_modules — never finding the
// app's install at /app/node_modules — so every render shelled out to a
// fresh npm download (slow at best, OOM/SIGKILL at worst on a small Fly
// machine). Using the local binary skips npx entirely.
const HF_BIN = path.join(__dirname, "node_modules", ".bin", "hyperframes");
// x128c: HF defaults to half-cores workers. On the 2-core / 4 GB Fly
// machine that means 1 worker, but we set it explicitly so the design is
// not at the mercy of the host CPU count (and so a future env tweak
// can't accidentally bump it back into OOM territory).
const HF_WORKERS = process.env.HF_WORKERS || "1";
function runRender(cwd, outPath) {
  return new Promise((resolve, reject) => {
    // x128e: capture stderr so when HF exits non-zero the surfaced 500
    // response carries the real reason instead of a bare exit code.
    const child = spawn(HF_BIN, [
      "render", "--output", outPath, "--workers", HF_WORKERS
    ], {
      cwd, stdio: ["ignore", "pipe", "pipe"]
    });
    let stdoutBuf = "", stderrBuf = "";
    child.stdout.on("data", d => { stdoutBuf += d; process.stdout.write(d); });
    child.stderr.on("data", d => { stderrBuf += d; process.stderr.write(d); });
    child.on("error", reject);
    child.on("exit", code => {
      if (code === 0) return resolve();
      // Last 1 KB of stderr is usually plenty for the "thrown error" line.
      const tail = (stderrBuf || stdoutBuf).slice(-1024).trim();
      reject(new Error(`hyperframes render exited ${code}: ${tail || "(no stderr)"}`));
    });
  });
}

// x114: satori thumbnail endpoint — programmatic 1080x1920 PNG thumbnails
// from a JSON description. Pairs with x100/x102 YouTube metadata generation
// (Claude returns headline/subject/background/palette → /thumbnail returns
// a render-ready PNG).
let _thumbnailFontPromise = null;
async function _loadThumbnailFont() {
  // Google Fonts CSS API serves a TTF when the UA isn't a modern browser.
  // Fetch the CSS, extract the .ttf URL, then fetch the bytes. Cached for
  // the process lifetime — discovers Google's hash-rotated path each cold
  // start without bundling font binary in the repo.
  const cssUrl = "https://fonts.googleapis.com/css2?family=Inter:wght@800";
  const cssResp = await fetch(cssUrl, { headers: { "User-Agent": "Mozilla/4.0" } });
  if (!cssResp.ok) throw new Error(`font css fetch ${cssResp.status}`);
  const css = await cssResp.text();
  const m = css.match(/url\((https:\/\/[^)]+\.ttf)\)/);
  if (!m) throw new Error("no .ttf url in font css");
  const ttfResp = await fetch(m[1]);
  if (!ttfResp.ok) throw new Error(`ttf fetch ${ttfResp.status}`);
  return Buffer.from(await ttfResp.arrayBuffer());
}

app.post("/thumbnail", async (req, res) => {
  try {
    const { default: satori } = await import("satori");
    const { Resvg } = await import("@resvg/resvg-js");
    if (!_thumbnailFontPromise) _thumbnailFontPromise = _loadThumbnailFont();
    const fontData = await _thumbnailFontPromise;
    const { headline = "Zaidsaid", subhead = "", palette = "#0a0a0a", accent = "#ff3366", width = 1080, height = 1920 } = req.body || {};
    const node = {
      type: "div",
      props: {
        style: {
          width, height, display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 80, background: palette, color: "#fff", fontFamily: "Inter"
        },
        children: [
          { type: "div", props: { style: { fontSize: 48, opacity: 0.7, fontWeight: 800 }, children: subhead } },
          {
            type: "div",
            props: {
              style: { display: "flex", flexDirection: "column", gap: 24 },
              children: [
                { type: "div", props: { style: { fontSize: 96, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }, children: headline } },
                { type: "div", props: { style: { width: 240, height: 12, background: accent, borderRadius: 6 } } }
              ]
            }
          }
        ]
      }
    };
    const svg = await satori(node, {
      width, height,
      fonts: [{ name: "Inter", data: fontData, weight: 800, style: "normal" }]
    });
    const png = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
    res.setHeader("Content-Type", "image/png");
    res.send(Buffer.from(png));
  } catch (err) {
    console.error("[thumbnail] failed", err);
    res.status(500).json({ error: "thumbnail_failed", detail: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`hyperframes-renderer listening on :${PORT}`);
});
