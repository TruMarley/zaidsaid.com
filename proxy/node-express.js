/**
 * Zaidsaid multi-vendor proxy — Node + Express self-host template
 *
 * Install:
 *   npm init -y
 *   npm i express undici dotenv
 *   cp .env.example .env   # fill in ELEVEN_KEY, HEYGEN_KEY, OPENAI_KEY, RUNWAY_KEY, ANTHROPIC_KEY, XAI_KEY
 *
 * Run:
 *   node node-express.js
 *
 * Then in Zaidsaid (Settings → Providers) set each vendor's Proxy URL to:
 *   https://YOUR-DOMAIN.example.com/<vendor>    (put this behind TLS, e.g. Caddy or nginx)
 */

import "dotenv/config";
import express from "express";
import { fetch } from "undici";

const app = express();
const PORT = process.env.PORT || 8787;

const ALLOWED_ORIGINS = [
  "https://zaidsaid.com",
  "http://localhost:5173"
];

const VENDORS = {
  elevenlabs: {
    base: "https://api.elevenlabs.io",
    authHeader: () => ({ "xi-api-key": process.env.ELEVEN_KEY })
  },
  heygen: {
    base: "https://api.heygen.com",
    authHeader: () => ({ "Authorization": "Bearer " + process.env.HEYGEN_KEY })
  },
  openai: {
    base: "https://api.openai.com",
    authHeader: () => ({ "Authorization": "Bearer " + process.env.OPENAI_KEY })
  },
  runway: {
    base: "https://api.runwayml.com",
    authHeader: () => ({ "Authorization": "Bearer " + process.env.RUNWAY_KEY })
  },
  anthropic: {
    base: "https://api.anthropic.com",
    authHeader: () => ({ "x-api-key": process.env.ANTHROPIC_KEY, "anthropic-version": "2023-06-01" })
  },
  grok: { base: "https://api.x.ai", authHeader: () => ({ "Authorization": "Bearer " + process.env.XAI_KEY }) },
  synthesia: { base: "https://api.synthesia.io", authHeader: () => ({ "Authorization": process.env.SYNTHESIA_KEY }) },
  kling: { base: "https://api.klingai.com", authHeader: () => ({ "Authorization": "Bearer " + process.env.KLING_KEY }) },
  stability: { base: "https://api.stability.ai", authHeader: () => ({ "Authorization": "Bearer " + process.env.STABILITY_KEY }) },
  perplexity: { base: "https://api.perplexity.ai", authHeader: () => ({ "Authorization": "Bearer " + process.env.PERPLEXITY_KEY }) }
};

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// Health check — used by Zaidsaid's "Test" button
app.get(/\/ping$/, (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Read raw body as a buffer for POST/PUT so we can forward it unchanged.
app.use(express.raw({ type: "*/*", limit: "50mb" }));

// HyperFrames render service — forwards to a local Node sidecar that runs
// `hyperframes render` and streams back an MP4. Set HYPERFRAMES_URL in .env
// (e.g. http://127.0.0.1:8788). See ../hyperframes-renderer/README.md.
app.all("/hyperframes/*", async (req, res) => {
  const base = process.env.HYPERFRAMES_URL;
  if (!base) return res.status(503).json({ error: "hyperframes_disabled", detail: "HYPERFRAMES_URL not set" });
  const rest = req.params[0] || "";
  const qs = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
  const target = base.replace(/\/$/, "") + "/" + rest + qs;
  const forwardHeaders = {};
  const incomingCT = req.headers["content-type"];
  if (incomingCT) forwardHeaders["Content-Type"] = incomingCT;
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: forwardHeaders,
      body: (req.method === "GET" || req.method === "HEAD") ? undefined : req.body,
      redirect: "follow"
    });
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.status(upstream.status);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: "hyperframes_unreachable", detail: String(err) });
  }
});

// Main proxy route: /<vendor>/<rest...>
app.all("/:vendor/*", async (req, res) => {
  const vendor = req.params.vendor;
  const v = VENDORS[vendor];
  if (!v) {
    return res.status(404).json({ error: "unknown vendor", vendor });
  }
  const rest = req.params[0] || "";
  const qs = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
  const target = v.base + "/" + rest + qs;
  const auth = v.authHeader();
  const forwardHeaders = { ...auth };
  const incomingCT = req.headers["content-type"];
  if (incomingCT) forwardHeaders["Content-Type"] = incomingCT;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: forwardHeaders,
      body: (req.method === "GET" || req.method === "HEAD") ? undefined : req.body,
      redirect: "follow"
    });
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.status(upstream.status);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: "upstream_failed", detail: String(err) });
  }
});

app.listen(PORT, () => {
  console.log("zaidsaid proxy listening on :" + PORT);
});
