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
app.use(express.json({ limit: "60mb" })); // base64-encoded clip blobs

app.get("/ping", (_req, res) => res.json({ ok: true, service: "hyperframes-renderer" }));

app.post("/render", async (req, res) => {
  const { clip_url, clip_b64, duration, title = "", handle = "", word_timings = [], style = "clip-9x16" } = req.body || {};
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
    const html = renderTemplate(stripVideoIfMissing(template, resolvedClipUrl), {
      CLIP_URL: resolvedClipUrl,
      DURATION: duration.toFixed(2),
      TITLE: escapeHtml(title),
      HANDLE: escapeHtml(handle),
      LOWER_THIRD_START: Math.max(0, duration - 3).toFixed(2),
      CAPTION_BLOCKS: buildCaptionBlocks(word_timings),
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

app.listen(PORT, () => {
  console.log(`hyperframes-renderer listening on :${PORT}`);
});
