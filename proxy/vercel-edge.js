/**
 * Zaidsaid multi-vendor proxy — Vercel Edge Function template
 *
 * Place this file at: /api/proxy/[...path].js  in your Vercel project.
 * Then set the Edge runtime and add env secrets in the Vercel dashboard:
 *   ELEVEN_KEY, HEYGEN_KEY, OPENAI_KEY, RUNWAY_KEY, ANTHROPIC_KEY, XAI_KEY
 *
 * In Zaidsaid (Settings → Providers) set each vendor's Proxy URL to:
 *   https://YOUR-VERCEL-APP.vercel.app/api/proxy/<vendor>
 *
 * NOTE: Vercel Edge does NOT allow `export default { fetch }` — it uses the
 * Web-standard `export default async function handler(req) { ... }` shape.
 */

export const config = { runtime: "edge" };

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
  grok: { base: "https://api.x.ai", authHeader: () => ({ "Authorization": "Bearer " + process.env.XAI_KEY }) }
};

function corsHeaders(req) {
  const origin = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  // Path looks like /api/proxy/<vendor>/<rest...>
  const segments = url.pathname.replace(/^\//, "").split("/");
  // strip leading "api" and "proxy"
  while (segments.length && (segments[0] === "api" || segments[0] === "proxy")) segments.shift();

  // Health check
  if (segments[0] === "ping" || url.pathname.endsWith("/ping")) {
    return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }

  const vendor = segments.shift();
  const v = VENDORS[vendor];
  if (!v) {
    return new Response(JSON.stringify({ error: "unknown vendor", vendor }), {
      status: 404, headers: { ...cors, "Content-Type": "application/json" }
    });
  }

  const target = v.base + "/" + segments.join("/") + url.search;
  const auth = v.authHeader();
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
