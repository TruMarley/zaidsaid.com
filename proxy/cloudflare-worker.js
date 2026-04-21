/**
 * Zaidsaid multi-vendor proxy â Cloudflare Worker template
 *
 * Deploy: `wrangler deploy`
 * Secrets:
 *   wrangler secret put ELEVEN_KEY
 *   wrangler secret put HEYGEN_KEY
 *   wrangler secret put OPENAI_KEY
 *   wrangler secret put RUNWAY_KEY
 *   wrangler secret put ANTHROPIC_KEY
 * wrangler secret put XAI_KEY
 *
 * Then in Zaidsaid (Settings â Providers), set each vendor's Proxy URL to
 * your deployed worker, e.g. https://my-zaidsaid-proxy.workers.dev/elevenlabs
 */

const ALLOWED_ORIGINS = [
  "https://zaidsaid.com",
  "http://localhost:5173"
];

const VENDORS = {
  elevenlabs: {
    base: "https://api.elevenlabs.io",
    authHeader: (env) => ({ "xi-api-key": env.ELEVEN_KEY })
  },
  heygen: {
    base: "https://api.heygen.com",
    authHeader: (env) => ({ "Authorization": "Bearer " + env.HEYGEN_KEY })
  },
  openai: {
    base: "https://api.openai.com",
    authHeader: (env) => ({ "Authorization": "Bearer " + env.OPENAI_KEY })
  },
  runway: {
    base: "https://api.runwayml.com",
    authHeader: (env) => ({ "Authorization": "Bearer " + env.RUNWAY_KEY })
  },
  anthropic: {
    base: "https://api.anthropic.com",
    authHeader: (env) => ({ "x-api-key": env.ANTHROPIC_KEY, "anthropic-version": "2023-06-01" })
  },
  grok: { base: "https://api.x.ai", authHeader: (env) => ({ "Authorization": "Bearer " + env.XAI_KEY }) },
  pollinations: { base: "https://image.pollinations.ai", authHeader: () => ({}) }
};

function corsHeaders(req) {
  const origin = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, anthropic-version",
    "Access-Control-Max-Age": "86400"
  };
}

function extractVideoId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function extractJsonObject(text, marker) {
  const startIdx = text.indexOf(marker);
  if (startIdx < 0) return null;
  const openIdx = text.indexOf("{", startIdx);
  if (openIdx < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return text.slice(openIdx, i + 1); }
  }
  return null;
}

async function fetchYouTubeTranscript(videoId) {
  const pageRes = await fetch("https://www.youtube.com/watch?v=" + videoId + "&hl=en", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });
  if (!pageRes.ok) throw new Error("YouTube page HTTP " + pageRes.status);
  const html = await pageRes.text();
  const jsonStr = extractJsonObject(html, "ytInitialPlayerResponse");
  if (!jsonStr) throw new Error("Could not find ytInitialPlayerResponse");
  let data;
  try { data = JSON.parse(jsonStr); } catch (e) { throw new Error("Could not parse player response: " + e.message); }
  const tracks = (((data.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks) || [];
  if (!tracks.length) throw new Error("Video has no caption tracks");
  const preferred = tracks.find(t => (t.languageCode || "").toLowerCase().startsWith("en")) || tracks[0];
  const trackUrl = preferred.baseUrl + "&fmt=json3";
  const capRes = await fetch(trackUrl);
  if (!capRes.ok) throw new Error("Captions HTTP " + capRes.status);
  const capJson = await capRes.json();
  const events = capJson.events || [];
  const parts = [];
  for (const ev of events) {
    if (!ev.segs) continue;
    for (const seg of ev.segs) { if (seg.utf8) parts.push(seg.utf8); }
  }
  const title = ((data.videoDetails || {}).title) || "";
  const author = ((data.videoDetails || {}).author) || "";
  const lengthSeconds = Number((data.videoDetails || {}).lengthSeconds) || 0;
  const transcript = parts.join("").replace(/\s+/g, " ").trim();
  return { videoId, title, author, lengthSeconds: transcript.length !== undefined ? lengthSeconds : lengthSeconds, language: preferred.languageCode || "en", transcript };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req);

    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Health check â used by Zaidsaid's "Test" button
    if (url.pathname === "/ping") {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // YouTube transcript extraction (custom, not a simple vendor proxy)
    if (url.pathname === "/youtube-transcript") {
      const raw = url.searchParams.get("v") || url.searchParams.get("url") || "";
      const videoId = extractVideoId(raw);
      if (!videoId) {
        return new Response(JSON.stringify({ error: "missing or invalid videoId" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      try {
        const result = await fetchYouTubeTranscript(videoId);
        return new Response(JSON.stringify(result), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String((err && err.message) || err), videoId }), {
          status: 502, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    // Parse: /<vendor>/<rest-of-path>
    const parts = url.pathname.replace(/^\//, "").split("/");
    const vendor = parts.shift();
    const v = VENDORS[vendor];
    if (!v) {
      return new Response(JSON.stringify({ error: "unknown vendor", vendor }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // Basic abuse guard â very permissive, tighten before prod
    if (req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      if (!ct.includes("application/json") && !ct.includes("multipart/form-data") && !ct.includes("audio/")) {
        return new Response(JSON.stringify({ error: "unsupported content-type" }), {
          status: 415, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    const target = v.base + "/" + parts.join("/") + url.search;
    const envAuth = v.authHeader(env);
    // Fall back to client-provided key if the env secret is missing
    const clientXApiKey = req.headers.get("x-api-key");
    const clientAuth = req.headers.get("authorization");
    const auth = {};
    for (const [k, val] of Object.entries(envAuth)) {
      if (val && val !== "undefined") {
        auth[k] = val;
      } else if (k === "x-api-key" && clientXApiKey) {
        auth[k] = clientXApiKey;
        auth["anthropic-version"] = req.headers.get("anthropic-version") || "2023-06-01";
      } else if ((k === "Authorization" || k === "authorization") && clientAuth) {
        auth[k] = clientAuth;
      }
    }
    const forwardHeaders = { ...auth };
    const incomingCT = req.headers.get("content-type");
    if (incomingCT) forwardHeaders["Content-Type"] = incomingCT;

    const upstream = await fetch(target, {
      method: req.method,
      headers: forwardHeaders,
      body: (req.method === "GET" || req.method === "HEAD") ? undefined : req.body,
      redirect: "follow"
    });

    // Stream response body, strip any vendor-specific Set-Cookie
    const responseHeaders = new Headers(cors);
    const ct = upstream.headers.get("content-type");
    if (ct) responseHeaders.set("Content-Type", ct);
    const cl = upstream.headers.get("content-length");
    if (cl) responseHeaders.set("Content-Length", cl);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders
    });
  }
};
