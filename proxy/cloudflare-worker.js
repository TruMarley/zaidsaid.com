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
 *   wrangler secret put GEMINI_KEY
 *   wrangler secret put REPLICATE_TOKEN
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
  stability: { base: "https://api.stability.ai", authHeader: (env) => ({ "Authorization": "Bearer " + env.STABILITY_KEY }) },
  gemini: {
    base: "https://generativelanguage.googleapis.com",
    authHeader: (env) => env.GEMINI_KEY ? { "x-goog-api-key": env.GEMINI_KEY } : {}
  },
  replicate: {
    base: "https://api.replicate.com",
    authHeader: (env) => env.REPLICATE_TOKEN ? { "Authorization": "Token " + env.REPLICATE_TOKEN } : {}
  }
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

    if (url.pathname === "/gemini-video-highlights") {
      if (!env.GEMINI_KEY) {
        return new Response(JSON.stringify({ disabled: true, reason: "GEMINI_KEY not configured" }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "POST required" }), {
          status: 405, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      try {
        const form = await req.formData();
        const file = form.get("file");
        const prompt = String(form.get("prompt") || "");
        const targetCount = parseInt(form.get("targetCount") || "10", 10);
        if (!file || typeof file.arrayBuffer !== "function") {
          return new Response(JSON.stringify({ error: "file field required" }), {
            status: 400, headers: { ...cors, "Content-Type": "application/json" }
          });
        }
        const fileBytes = await file.arrayBuffer();
        const mimeType = file.type || "audio/mpeg";
        const fileSize = fileBytes.byteLength;

        // Step 1: initiate resumable upload
        const initRes = await fetch(
          "https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=resumable",
          {
            method: "POST",
            headers: {
              "x-goog-api-key": env.GEMINI_KEY,
              "X-Goog-Upload-Protocol": "resumable",
              "X-Goog-Upload-Command": "start",
              "X-Goog-Upload-Header-Content-Length": String(fileSize),
              "X-Goog-Upload-Header-Content-Type": mimeType,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ file: { display_name: file.name || "upload" } })
          }
        );
        if (!initRes.ok) {
          const t = await initRes.text().catch(() => "");
          throw new Error("Gemini upload init HTTP " + initRes.status + " " + t.slice(0, 200));
        }
        const uploadUrl = initRes.headers.get("x-goog-upload-url");
        if (!uploadUrl) throw new Error("No x-goog-upload-url in Gemini response");

        // Step 2: upload the bytes
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Length": String(fileSize),
            "X-Goog-Upload-Offset": "0",
            "X-Goog-Upload-Command": "upload, finalize"
          },
          body: fileBytes
        });
        if (!uploadRes.ok) {
          const t = await uploadRes.text().catch(() => "");
          throw new Error("Gemini upload HTTP " + uploadRes.status + " " + t.slice(0, 200));
        }
        const uploadData = await uploadRes.json();
        const fileUri = (uploadData.file && uploadData.file.uri) ? uploadData.file.uri : null;
        if (!fileUri) throw new Error("No file.uri in Gemini upload response");

        // Step 3: generateContent
        const systemPrompt = prompt ||
          'Return JSON {"highlights":[{"t":seconds,"d":duration_seconds,"reason":"one-line why","mood":"funny|shocking|emotional|educational|dramatic"}]}. Identify the ' + targetCount + ' most visually dynamic or emotionally charged moments. Output JSON only.';
        const genRes = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + env.GEMINI_KEY,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { file_data: { mime_type: mimeType, file_uri: fileUri } },
                  { text: systemPrompt }
                ]
              }]
            })
          }
        );
        if (!genRes.ok) {
          const t = await genRes.text().catch(() => "");
          throw new Error("Gemini generateContent HTTP " + genRes.status + " " + t.slice(0, 200));
        }
        const genData = await genRes.json();
        const rawText = ((((genData.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || "").join("");
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON in Gemini response: " + rawText.slice(0, 300));
        const parsed = JSON.parse(jsonMatch[0]);
        const highlights = Array.isArray(parsed.highlights) ? parsed.highlights : [];
        return new Response(JSON.stringify({ highlights }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String((err && err.message) || err), disabled: false }), {
          status: 502, headers: { ...cors, "Content-Type": "application/json" }
    // Phase D — trending context routes
    if (url.pathname === "/trends/google") {
      const q = url.searchParams.get("q") || "";
      const keywords = q.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
      if (!keywords.length) {
        return new Response(JSON.stringify({ results: [], error: "q required" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      try {
        const trendUrl = "https://trends.google.com/trends/api/dailytrends?hl=en-US&geo=US&ns=15";
        const res = await fetch(trendUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; zaidsaid-trends/1.0)" }
        });
        if (!res.ok) throw new Error("Google Trends HTTP " + res.status);
        const raw = await res.text();
        // Strip the )]}', prefix Google adds
        const jsonStart = raw.indexOf("{");
        if (jsonStart < 0) throw new Error("Unexpected Google Trends response");
        const data = JSON.parse(raw.slice(jsonStart));
        const trendingStories = ((data.default || {}).trendingSearchesDays || [])
          .flatMap(day => day.trendingSearches || []);
        const results = [];
        for (const story of trendingStories) {
          const title = String((story.title || {}).query || "").toLowerCase();
          const matched = keywords.find(kw => title.includes(kw));
          if (matched) {
            results.push({
              keyword: matched,
              source: "google",
              volume: Number((story.formattedTraffic || "").replace(/[^0-9]/g, "")) || 0,
              title: String((story.title || {}).query || ""),
              url: String((story.title || {}).exploreLink || "")
            });
          }
          // Also check related queries
          for (const rel of (story.relatedQueries || [])) {
            const relQuery = String((rel.query || {}).query || "").toLowerCase();
            const relMatched = keywords.find(kw => relQuery.includes(kw));
            if (relMatched && !results.find(r => r.keyword === relMatched && r.source === "google")) {
              results.push({
                keyword: relMatched,
                source: "google",
                volume: 0,
                title: String((rel.query || {}).query || ""),
                url: String((rel.query || {}).exploreLink || "")
              });
            }
          }
        }
        return new Response(JSON.stringify({ results }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ results: [], error: String((err && err.message) || err) }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    if (url.pathname === "/sensevoice") {
      if (!env.REPLICATE_TOKEN) {
        return new Response(JSON.stringify({ disabled: true, reason: "REPLICATE_TOKEN not configured" }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "POST required" }), {
          status: 405, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      try {
        const body = await req.json();
        const audioUrl = body.audio_url || body.audioUrl || body.url || "";
        if (!audioUrl) {
          return new Response(JSON.stringify({ error: "audio_url required" }), {
            status: 400, headers: { ...cors, "Content-Type": "application/json" }
          });
        }
        // lucataco/sensevoice — multilingual STT + audio event detection (laughter, applause, emphasis)
        const predRes = await fetch("https://api.replicate.com/v1/models/lucataco/sensevoice/predictions", {
          method: "POST",
          headers: {
            "Authorization": "Token " + env.REPLICATE_TOKEN,
            "Content-Type": "application/json",
            "Prefer": "wait"
          },
          body: JSON.stringify({
            input: { audio: audioUrl }
          })
        });
        if (!predRes.ok) {
          const t = await predRes.text().catch(() => "");
          throw new Error("Replicate HTTP " + predRes.status + " " + t.slice(0, 200));
        }
        const predData = await predRes.json();
        // If still processing, poll once
        let output = predData.output;
        if (!output && predData.urls && predData.urls.get) {
          const pollRes = await fetch(predData.urls.get, {
            headers: { "Authorization": "Token " + env.REPLICATE_TOKEN }
          });
          if (pollRes.ok) {
            const polled = await pollRes.json();
            output = polled.output;
          }
        }
        // Parse SenseVoice output into [{t, d, label}] events
        const events = [];
        if (Array.isArray(output)) {
          for (const item of output) {
            const text = String(item.text || item.content || "");
            const t = Number(item.start || item.timestamp && item.timestamp[0] || 0);
            const d = Number(item.end || item.timestamp && item.timestamp[1] || 0) - t;
            const labelMatch = text.match(/<\|([^|]+)\|>/);
            const label = labelMatch ? labelMatch[1].toLowerCase() : "speech";
            if (label && label !== "speech" && label !== "background") {
              events.push({ t: +t.toFixed(2), d: +Math.max(0, d).toFixed(2), label });
            }
          }
        } else if (output && typeof output === "object") {
          const segments = output.segments || output.chunks || [];
          for (const seg of segments) {
            const text = String(seg.text || "");
            const t = Number(seg.start || (Array.isArray(seg.timestamp) ? seg.timestamp[0] : 0) || 0);
            const end = Number(seg.end || (Array.isArray(seg.timestamp) ? seg.timestamp[1] : 0) || t);
            const labelMatch = text.match(/<\|([^|]+)\|>/);
            const label = labelMatch ? labelMatch[1].toLowerCase() : "speech";
            if (label && label !== "speech" && label !== "background") {
              events.push({ t: +t.toFixed(2), d: +Math.max(0, end - t).toFixed(2), label });
            }
          }
        }
        return new Response(JSON.stringify({ events }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String((err && err.message) || err), events: [] }), {
          status: 502, headers: { ...cors, "Content-Type": "application/json" }
    if (url.pathname === "/trends/reddit") {
      const q = url.searchParams.get("q") || "";
      if (!q) {
        return new Response(JSON.stringify({ results: [], error: "q required" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      try {
        const searchUrl = "https://www.reddit.com/search.json?q=" + encodeURIComponent(q) + "&sort=hot&limit=10&t=week";
        const res = await fetch(searchUrl, {
          headers: { "User-Agent": "zaidsaid-trends/1.0" }
        });
        if (!res.ok) throw new Error("Reddit HTTP " + res.status);
        const data = await res.json();
        const posts = ((data.data || {}).children || []).map((child, idx) => {
          const p = child.data || {};
          return {
            keyword: q,
            source: "reddit",
            rank: idx + 1,
            title: String(p.title || ""),
            url: "https://reddit.com" + String(p.permalink || "")
          };
        });
        return new Response(JSON.stringify({ results: posts }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ results: [], error: String((err && err.message) || err) }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    if (url.pathname === "/trends/hn") {
      const q = url.searchParams.get("q") || "";
      if (!q) {
        return new Response(JSON.stringify({ results: [], error: "q required" }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      try {
        const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
        const hnUrl = "https://hn.algolia.com/api/v1/search?query=" + encodeURIComponent(q) + "&tags=story&numericFilters=created_at_i%3E" + weekAgo;
        const res = await fetch(hnUrl, {
          headers: { "User-Agent": "zaidsaid-trends/1.0" }
        });
        if (!res.ok) throw new Error("HN Algolia HTTP " + res.status);
        const data = await res.json();
        const results = (data.hits || []).slice(0, 10).map((hit, idx) => ({
          keyword: q,
          source: "hn",
          rank: idx + 1,
          title: String(hit.title || ""),
          url: hit.url || ("https://news.ycombinator.com/item?id=" + hit.objectID)
        }));
        return new Response(JSON.stringify({ results }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ results: [], error: String((err && err.message) || err) }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    if (url.pathname === "/trends/x") {
      if (!env.APIFY_TOKEN) {
        return new Response(JSON.stringify({ disabled: true, reason: "APIFY_TOKEN not configured", results: [] }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      const q = url.searchParams.get("q") || "";
      try {
        const apifyUrl = "https://api.apify.com/v2/acts/karamelo~twitter-trends-scraper/run-sync-get-dataset-items?token=" + env.APIFY_TOKEN;
        const res = await fetch(apifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country: "US", maxTrends: 30 })
        });
        if (!res.ok) throw new Error("Apify HTTP " + res.status);
        const items = await res.json();
        const keyword = (q || "").toLowerCase();
        const results = [];
        for (const item of (Array.isArray(items) ? items : [])) {
          const trend = String(item.trend || item.name || item.hashtag || "");
          const trendLower = trend.toLowerCase();
          if (!keyword || trendLower.includes(keyword) || keyword.includes(trendLower.replace(/^#/, ""))) {
            results.push({
              keyword: q || trend,
              source: "x",
              rank: Number(item.rank) || results.length + 1,
              title: trend,
              url: "https://x.com/search?q=" + encodeURIComponent(trend)
            });
          }
        }
        return new Response(JSON.stringify({ results }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ results: [], error: String((err && err.message) || err) }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    // Sidecar forward routes — each points at an env secret and returns 503
    // when unset so the front-end can detect "feature not deployed".
    //   x110: hyperframes — Node sidecar running `hyperframes render`
    //   x111: audio       — Python sidecar (WhisperX, silero-vad, demucs, pyannote, auto-editor, captacity)
    const SIDECARS = [
      { prefix: "/hyperframes/", envKey: "HYPERFRAMES_URL", name: "hyperframes" },
      { prefix: "/audio/",        envKey: "AUDIO_AI_URL",    name: "audio" },
      { prefix: "/vision/",       envKey: "VISION_AI_URL",   name: "vision" },
      { prefix: "/tts/",          envKey: "TTS_URL",         name: "tts" },
    ];
    for (const { prefix, envKey, name } of SIDECARS) {
      if (!url.pathname.startsWith(prefix)) continue;
      if (!env[envKey]) {
        return new Response(JSON.stringify({ error: name + "_disabled", detail: envKey + " not set" }), {
          status: 503, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
      const rest = url.pathname.slice(prefix.length);
      const target = env[envKey].replace(/\/$/, "") + "/" + rest + url.search;
      const incomingCT = req.headers.get("content-type");
      const forwardHeaders = {};
      if (incomingCT) forwardHeaders["Content-Type"] = incomingCT;
      try {
        const upstream = await fetch(target, {
          method: req.method,
          headers: forwardHeaders,
          body: (req.method === "GET" || req.method === "HEAD") ? undefined : req.body,
          redirect: "follow"
        });
        const responseHeaders = new Headers(cors);
        const ct = upstream.headers.get("content-type");
        if (ct) responseHeaders.set("Content-Type", ct);
        return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: name + "_unreachable", detail: String(err) }), {
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
