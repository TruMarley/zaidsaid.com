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

    const templatePath = path.join(TEMPLATES, `${style}.html`);
    const template = await fs.readFile(templatePath, "utf8");
    const lottieStart = lottie_start != null ? Number(lottie_start) : Math.max(0, duration - 4);
    const lottieDuration = lottie_duration != null ? Number(lottie_duration) : 2.5;
    const html = renderTemplate(stripVideoIfMissing(template, resolvedClipUrl), {
      CLIP_URL: resolvedClipUrl,
      DURATION: duration.toFixed(2),
      TITLE: escapeHtml(title),
      HANDLE: escapeHtml(handle),
      LOWER_THIRD_START: Math.max(0, duration - 3).toFixed(2),
      CAPTION_BLOCKS: buildCaptionBlocks(word_timings),
      LOTTIE_URL: lottie_url,
      LOTTIE_START: lottieStart.toFixed(2),
      LOTTIE_DURATION: lottieDuration.toFixed(2),
    });

    const indexPath = path.join(workDir, "index.html");
    await fs.writeFile(indexPath, appendCaptionTweens(html, word_timings));
    await fs.writeFile(path.join(workDir, "meta.json"), JSON.stringify({ id, name: `clip-${id}` }));
    await fs.writeFile(path.join(workDir, "hyperframes.json"), JSON.stringify({
      $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
      paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }
    }));

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

function appendCaptionTweens(html, words) {
  const groups = groupWordsIntoLines(words, 3);
  const tweens = groups.map((g, i) => {
    const start = g[0].start.toFixed(2);
    return `tl.from("#cap${i}", { opacity: 0, scale: 0.85, duration: 0.22, ease: "back.out(2)" }, ${start});`;
  }).join("\n      ");
  return html.replace("// Per-caption tweens are appended by server.mjs from word_timings.", tweens);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function runRender(cwd, outPath) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["hyperframes", "render", "--output", outPath, "--quiet"], {
      cwd, stdio: ["ignore", "inherit", "inherit"]
    });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`hyperframes render exited ${code}`)));
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
