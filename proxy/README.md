# Zaidsaid proxy templates

This folder contains ready-to-deploy proxy shims that let the public zaidsaid.com site call vendor APIs **without ever seeing a raw API key in the browser**.

## Why

`zaidsaid.com` is a static site hosted on GitHub Pages. Anything in `app.js` is public. If you pasted an ElevenLabs or HeyGen key into client code it would be visible to every visitor. So instead:

1. Deploy a tiny proxy (Cloudflare Worker, Vercel Edge, or any HTTP server) that **holds the keys in environment variables**.
2. In **Settings → Providers** or **Avatars → Voice & avatar providers**, set each vendor's `Proxy URL` to your deployed proxy.
3. The site posts to `{proxy}/ping` to verify, then `{proxy}/{vendor}/...` for real work. Your proxy adds the auth header and forwards.

## Files

- `cloudflare-worker.js` — multi-vendor Cloudflare Worker template (ElevenLabs, HeyGen, OpenAI, Runway)
- `vercel-edge.js` — same, as a Vercel Edge Function
- `node-express.js` — Node + Express version for self-hosting

## Deploy in 2 minutes (Cloudflare)

```bash
npm i -g wrangler
wrangler init my-zaidsaid-proxy
# replace src/index.js with cloudflare-worker.js
wrangler secret put ELEVEN_KEY
wrangler secret put HEYGEN_KEY
wrangler secret put OPENAI_KEY
wrangler secret put RUNWAY_KEY
wrangler secret put ANTHROPIC_KEY
wrangler deploy
```

Copy the deployed URL (e.g. `https://my-zaidsaid-proxy.workers.dev`) into Zaidsaid's provider fields.

## Security notes

- CORS: the templates set `Access-Control-Allow-Origin: https://zaidsaid.com`. Tighten this before going to production.
- Rate limit your proxy. A public static site = anyone can try to use it.
- Only proxy the endpoints you actually use. Don't blind-forward the whole vendor API.
- Rotate keys if a proxy URL leaks publicly.

## Free / local mode

Every capability has a "Local / Free" option that doesn't need a proxy at all — Web Speech TTS, MediaRecorder for voice capture, browser-native rendering. You can use the full app with zero cloud spend.

## Claude (Anthropic) tip

When you deploy one of these templates with `ANTHROPIC_KEY` set, paste the full vendor-scoped URL into **Settings → Providers → Claude (Anthropic)** in Zaidsaid, e.g. `https://my-zaidsaid-proxy.workers.dev/anthropic`. Studio's "Generate brief & outline" button will then call Claude via `/v1/messages` with a `tool_use` schema and populate your scenes.
