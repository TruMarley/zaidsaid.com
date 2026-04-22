/**
 * Zaidsaid multi-vendor proxy - Cloudflare Worker template
 *
 * Deploy: `wrangler deploy`
 * Secrets:
 *   wrangler secret put ELEVEN_KEY
 *   wrangler secret put HEYGEN_KEY
 *   wrangler secret put OPENAI_KEY
 *   wrangler secret put RUNWAY_KEY
 *   wrangler secret put ANTHROPIC_KEY
 *   wrangler secret put XAI_KEY
 *   wrangler secret put STABILITY_KEY
 *   wrangler secret put YOUTUBE_API_KEY
 *
 * Then in Zaidsaid (Settings -> Providers), set each vendor's Proxy URL to
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
  pollinations: { base: "https://image.pollinations.ai", authHeader: () => ({}) },
  stability: { base: "https://api.stability.ai", authHeader: (env) => ({ "Authorization": "Bearer " + env.STABILITY_KEY }) }
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

function parseIsoDuration(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

async function fetchYouTubeMetaViaApi(videoId, env) {
  if (!env.YOUTUBE_API_KEY) return null;
  try {
    const u = "https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=" + videoId + "&key=" + env.YOUTUBE_API_KEY;
    const res = await fetch(u);
    if (!res.ok) return null;
    const data = await res.json();
    const item = (data.items || [])[0];
    if (!item) return null;
    const snip = item.snippet || {};
    const dur = (item.contentDetails || {}).duration || "";
    return {
      title: snip.title || "",
      author: snip.channelTitle || "",
      description: snip.description || "",
      lengthSeconds: parseIsoDuration(dur)
    };
  } catch (_) { return null; }
}

function decodeHtmlEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function parseYouTubeChapters(description) {
  const chapters = [];
  const lines = String(description || "").split(/\r?\n/);
  const re = /^[\[\(]?(\d{1,2}:\d{2}(?::\d{2})?)[\]\)]?[\s\-–—|]+(.+)$/;
  for (const line of lines) {
    const m = re.exec(line.trim());
    if (!m) continue;
    const parts = m[1].split(":").map(Number);
    let t = 0;
    if (parts.length === 3) t = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else t = parts[0] * 60 + (parts[1] || 0);
    const title = m[2].trim();
    if (title) chapters.push({ t, title });
  }
  return chapters;
}

function parseCaptionPayload(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return { text: "", segments: [] };
  const segments = [];
  if (trimmed.startsWith("{")) {
    try {
      const capJson = JSON.parse(trimmed);
      const events = capJson.events || [];
      for (const ev of events) {
        if (!ev.segs) continue;
        const parts = [];
        for (const seg of ev.segs) { if (seg.utf8) parts.push(seg.utf8); }
        const evText = parts.join("").replace(/\s+/g, " ").trim();
        if (!evText) continue;
        const t = Number(ev.tStartMs || 0) / 1000;
        const d = Number(ev.dDurationMs || 0) / 1000;
        segments.push({ t: +t.toFixed(2), d: +d.toFixed(2), text: evText });
      }
      const joined = segments.map(s => s.text).join(" ").replace(/\s+/g, " ").trim();
      return { text: joined, segments };
    } catch (_) { /* fall through to XML */ }
  }
  const reP = /<p[^>]*\bt="(\d+)"[^>]*(?:\bd="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = reP.exec(trimmed)) !== null) {
    const t = Number(m[1] || 0) / 1000;
    const d = Number(m[2] || 0) / 1000;
    const inner = decodeHtmlEntities(m[3].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (inner) segments.push({ t: +t.toFixed(2), d: +d.toFixed(2), text: inner });
  }
  if (segments.length === 0) {
    const reText = /<text[^>]*\bstart="([\d.]+)"[^>]*(?:\bdur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
    while ((m = reText.exec(trimmed)) !== null) {
      const t = Number(m[1] || 0);
      const d = Number(m[2] || 0);
      const inner = decodeHtmlEntities(m[3].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
      if (inner) segments.push({ t: +t.toFixed(2), d: +d.toFixed(2), text: inner });
    }
  }
  const joined = segments.map(s => s.text).join(" ").replace(/\s+/g, " ").trim();
  return { text: joined, segments };
}

const YT_USER_AGENTS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

const INNERTUBE_CLIENTS = [
  {
    name: "ANDROID",
    clientName: "ANDROID",
    clientVersion: "19.09.37",
    userAgent: "com.google.android.youtube/19.09.37 (Linux; U; Android 14) gzip",
    clientNum: "3",
    extra: { androidSdkVersion: 34, hl: "en", gl: "US" }
  },
  {
    name: "IOS",
    clientName: "IOS",
    clientVersion: "19.09.3",
    userAgent: "com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)",
    clientNum: "5",
    extra: { deviceMake: "Apple", deviceModel: "iPhone14,3", hl: "en", gl: "US" }
  },
  {
    name: "WEB",
    clientName: "WEB",
    clientVersion: "2.20240111.09.00",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    clientNum: "1",
    extra: { hl: "en", gl: "US" }
  }
];

async function fetchPlayerViaClient(videoId, c) {
  const body = {
    context: { client: { clientName: c.clientName, clientVersion: c.clientVersion, ...c.extra } },
    videoId
  };
  const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": c.userAgent,
      "X-YouTube-Client-Name": c.clientNum,
      "X-YouTube-Client-Version": c.clientVersion,
      "Accept-Language": "en-US,en;q=0.9",
      "Origin": "https://www.youtube.com"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(c.name + " HTTP " + res.status);
  return await res.json();
}

async function fetchYouTubeTranscriptViaInnerTube(videoId) {
  const attempts = [];
  for (const c of INNERTUBE_CLIENTS) {
    try {
      const data = await fetchPlayerViaClient(videoId, c);
      const playability = (data.playabilityStatus || {});
      if (playability.status && playability.status !== "OK") {
        attempts.push(c.name + ": playability=" + playability.status);
        continue;
      }
      const tracks = (((data.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks) || [];
      if (!tracks.length) { attempts.push(c.name + ": no caption tracks"); continue; }
      const preferred =
        tracks.find(t => (t.languageCode || "").toLowerCase().startsWith("en") && t.kind !== "asr") ||
        tracks.find(t => (t.languageCode || "").toLowerCase().startsWith("en")) ||
        tracks[0];
      const capRes = await fetch(preferred.baseUrl, { headers: { "User-Agent": c.userAgent } });
      if (!capRes.ok) { attempts.push(c.name + ": captions HTTP " + capRes.status); continue; }
      const capText = await capRes.text();
      const parsed = parseCaptionPayload(capText);
      if (!parsed.text) { attempts.push(c.name + ": empty payload"); continue; }
      const vd = data.videoDetails || {};
      return {
        transcript: parsed.text,
        segments: parsed.segments,
        language: preferred.languageCode || "en",
        client: c.name,
        scrapeMeta: {
          title: vd.title || "",
          author: vd.author || "",
          lengthSeconds: Number(vd.lengthSeconds) || 0
        }
      };
    } catch (err) {
      attempts.push(c.name + ": " + String((err && err.message) || err));
    }
  }
  const err = new Error("InnerTube all clients failed: " + attempts.join(" | "));
  err.attempts = attempts;
  throw err;
}

async function fetchYouTubeTranscriptViaScrape(videoId) {
  let lastErr = null;
  for (const ua of YT_USER_AGENTS) {
    try {
      const pageRes = await fetch("https://www.youtube.com/watch?v=" + videoId + "&hl=en", {
        headers: {
          "User-Agent": ua,
          "Accept-Language": "en-US,en;q=0.9",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Referer": "https://www.google.com/"
        }
      });
      if (!pageRes.ok) { lastErr = new Error("YouTube page HTTP " + pageRes.status + " (ua=" + ua.slice(0, 20) + ")"); continue; }
      const html = await pageRes.text();
      const jsonStr = extractJsonObject(html, "ytInitialPlayerResponse");
      if (!jsonStr) { lastErr = new Error("Could not find ytInitialPlayerResponse"); continue; }
      let data;
      try { data = JSON.parse(jsonStr); } catch (e) { lastErr = new Error("Parse error: " + e.message); continue; }
      const tracks = (((data.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks) || [];
      if (!tracks.length) { lastErr = new Error("Video has no caption tracks"); continue; }
      const preferred = tracks.find(t => (t.languageCode || "").toLowerCase().startsWith("en")) || tracks[0];
      const capRes = await fetch(preferred.baseUrl, { headers: { "User-Agent": ua } });
      if (!capRes.ok) { lastErr = new Error("Captions HTTP " + capRes.status); continue; }
      const capText = await capRes.text();
      const parsed = parseCaptionPayload(capText);
      if (!parsed.text) { lastErr = new Error("Empty transcript payload"); continue; }
      return {
        transcript: parsed.text,
        segments: parsed.segments,
        language: preferred.languageCode || "en",
        scrapeMeta: {
          title: ((data.videoDetails || {}).title) || "",
          author: ((data.videoDetails || {}).author) || "",
          lengthSeconds: Number((data.videoDetails || {}).lengthSeconds) || 0
        }
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("YouTube scrape failed for all UAs");
}

async function fetchYouTubePlayerInfo(videoId) {
  const attempts = [];
  for (const c of INNERTUBE_CLIENTS) {
    try {
      const data = await fetchPlayerViaClient(videoId, c);
      const playability = (data.playabilityStatus || {});
      if (playability.status && playability.status !== "OK") {
        attempts.push(c.name + ": playability=" + playability.status);
        continue;
      }
      const streamingData = data.streamingData || {};
      // Only progressive (combined audio+video) formats with a plain url — adaptive
      // streams would need client-side muxing, and WEB cipher-protected urls need a
      // signature decipher we don't ship. Android/iOS players return plain urls.
      const formats = (streamingData.formats || []).filter(f => f && f.url);
      if (!formats.length) {
        attempts.push(c.name + ": no progressive formats with direct url");
        continue;
      }
      const vd = data.videoDetails || {};
      return {
        client: c.name,
        videoId,
        title: vd.title || "",
        author: vd.author || "",
        lengthSeconds: Number(vd.lengthSeconds) || 0,
        formats: formats.map(f => ({
          itag: f.itag,
          mimeType: f.mimeType || "",
          qualityLabel: f.qualityLabel || f.quality || "",
          width: f.width || 0,
          height: f.height || 0,
          fps: f.fps || 0,
          bitrate: f.bitrate || 0,
          contentLength: Number(f.contentLength) || 0,
          url: f.url,
          approxDurationMs: Number(f.approxDurationMs) || 0
        }))
      };
    } catch (err) {
      attempts.push(c.name + ": " + String((err && err.message) || err));
    }
  }
  const err = new Error("InnerTube all clients failed: " + attempts.join(" | "));
  err.attempts = attempts;
  throw err;
}

async function fetchYouTubeTranscript(videoId, env) {
  const apiMeta = await fetchYouTubeMetaViaApi(videoId, env);
  const chapters = parseYouTubeChapters(apiMeta && apiMeta.description ? apiMeta.description : "");
  const errors = [];

  try {
    const it = await fetchYouTubeTranscriptViaInnerTube(videoId);
    return {
      videoId,
      title: apiMeta?.title || it.scrapeMeta.title,
      author: apiMeta?.author || it.scrapeMeta.author,
      lengthSeconds: apiMeta?.lengthSeconds || it.scrapeMeta.lengthSeconds,
      language: it.language,
      transcript: it.transcript,
      segments: it.segments || [],
      chapters,
      source: "innertube"
    };
  } catch (itErr) {
    errors.push("innertube: " + String((itErr && itErr.message) || itErr));
  }

  try {
    const scrape = await fetchYouTubeTranscriptViaScrape(videoId);
    return {
      videoId,
      title: apiMeta?.title || scrape.scrapeMeta.title,
      author: apiMeta?.author || scrape.scrapeMeta.author,
      lengthSeconds: apiMeta?.lengthSeconds || scrape.scrapeMeta.lengthSeconds,
      language: scrape.language,
      transcript: scrape.transcript,
      segments: scrape.segments || [],
      chapters,
      source: "scrape"
    };
  } catch (scrapeErr) {
    errors.push("scrape: " + String((scrapeErr && scrapeErr.message) || scrapeErr));
  }

  if (apiMeta && apiMeta.description) {
    return {
      videoId,
      title: apiMeta.title,
      author: apiMeta.author,
      lengthSeconds: apiMeta.lengthSeconds,
      language: "en",
      transcript: apiMeta.description,
      segments: [],
      chapters,
      source: "description",
      fallback: "description-only",
      errors
    };
  }

  const err = new Error("All transcript methods failed: " + errors.join(" | "));
  err.errors = errors;
  throw err;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/ping") {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    if (url.pathname === "/youtube-formats") {
      const raw = url.searchParams.get("v") || url.searchParams.get("url") || "";
      const videoId = extractVideoId(raw);
      if (!videoId) {
        return new Response(JSON.stringify({ error: "missing or invalid videoId" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      try {
        const info = await fetchYouTubePlayerInfo(videoId);
        // Strip the raw googlevideo urls — client must go through /youtube-media so
        // we can forward the right User-Agent and pass through Range requests.
        return new Response(JSON.stringify({
          videoId: info.videoId,
          title: info.title,
          author: info.author,
          lengthSeconds: info.lengthSeconds,
          client: info.client,
          formats: info.formats.map(f => ({
            itag: f.itag,
            mimeType: f.mimeType,
            qualityLabel: f.qualityLabel,
            width: f.width,
            height: f.height,
            fps: f.fps,
            contentLength: f.contentLength
          }))
        }), { headers: { ...cors, "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: String((err && err.message) || err), videoId }), {
          status: 502, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    if (url.pathname === "/youtube-media") {
      const raw = url.searchParams.get("v") || url.searchParams.get("url") || "";
      const itag = parseInt(url.searchParams.get("itag") || "", 10);
      const videoId = extractVideoId(raw);
      if (!videoId || !itag) {
        return new Response(JSON.stringify({ error: "missing v or itag" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      try {
        const info = await fetchYouTubePlayerInfo(videoId);
        const fmt = info.formats.find(f => f.itag === itag);
        if (!fmt || !fmt.url) {
          return new Response(JSON.stringify({ error: "format not found", itag }), {
            status: 404, headers: { ...cors, "Content-Type": "application/json" }
          });
        }
        const clientUA = (INNERTUBE_CLIENTS.find(c => c.name === info.client) || INNERTUBE_CLIENTS[0]).userAgent;
        const upstreamHeaders = { "User-Agent": clientUA };
        const rangeHeader = req.headers.get("range");
        if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;
        const upstream = await fetch(fmt.url, { headers: upstreamHeaders, redirect: "follow" });
        const responseHeaders = new Headers(cors);
        for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
          const v = upstream.headers.get(h);
          if (v) responseHeaders.set(h, v);
        }
        const safeTitle = (info.title || videoId).replace(/[^A-Za-z0-9._ -]+/g, "_").slice(0, 80) || videoId;
        const ext = (fmt.mimeType || "").includes("webm") ? "webm" : (fmt.mimeType || "").includes("mp4") ? "mp4" : "bin";
        responseHeaders.set("Content-Disposition", 'attachment; filename="' + safeTitle + "." + ext + '"');
        return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String((err && err.message) || err), videoId, itag }), {
          status: 502, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    if (url.pathname === "/youtube-transcript") {
      const raw = url.searchParams.get("v") || url.searchParams.get("url") || "";
      const videoId = extractVideoId(raw);
      if (!videoId) {
        return new Response(JSON.stringify({ error: "missing or invalid videoId" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      try {
        const result = await fetchYouTubeTranscript(videoId, env);
        return new Response(JSON.stringify(result), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String((err && err.message) || err), videoId }), {
          status: 502, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    const parts = url.pathname.replace(/^\//, "").split("/");
    const vendor = parts.shift();
    const v = VENDORS[vendor];
    if (!v) {
      return new Response(JSON.stringify({ error: "unknown vendor", vendor }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

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
