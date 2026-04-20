/**
 * Zaidsaid multi-vendor proxy — Cloudflare Worker template
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
 * Then in Zaidsaid (Settings → Providers), set each vendor's Proxy URL to
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
  synthesia: { base: "https://api.synthesia.io", authHeader: (env) => ({ "Authorization": env.SYNTHESIA_KEY }) },
  kling: { base: "https://api.klingai.com", authHeader: (env) => ({ "Authorization": "Bearer " + env.KLING_KEY }) },
  stability: { base: "https://api.stability.ai", authHeader: (env) => ({ "Authorization": "Bearer " + env.STABILITY_KEY }) },
  suno: { base: "https://studio-api.suno.ai", authHeader: (env) => ({ "Authorization": "Bearer " + env.SUNO_KEY }) },
  udio: { base: "https://api.udio.com", authHeader: (env) => ({ "Authorization": "Bearer " + env.UDIO_KEY }) },
  perplexity: { base: "https://api.perplexity.ai", authHeader: (env) => ({ "Authorization": "Bearer " + env.PERPLEXITY_KEY }) }
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

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req);

    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Health check — used by Zaidsaid's "Test" button
    if (url.pathname === "/ping" || url.pathname.endsWith("/ping")) {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
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

    // Basic abuse guard — very permissive, tighten before prod
    if (req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      if (!ct.includes("application/json") && !ct.includes("multipart/form-data") && !ct.includes("audio/")) {
        return new Response(JSON.stringify({ error: "unsupported content-type" }), {
          status: 415, headers: { ...cors, "Content-Type": "application/json" }
        });
      }
    }

    const target = v.base + "/" + parts.join("/") + url.search;
    const auth = v.authHeader(env);
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
