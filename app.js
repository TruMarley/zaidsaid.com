/* Zaidsaid — app.js v2.0 — Stage 3: Repurpose online
 * Security: localStorage namespaced as zaidsaid.v2.*, error boundary, no innerHTML, no eval, no fetch.
 * Archived v1 seed data preserved under ARCHIVE_* for later reuse.
 */
const { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } = React;

/* ---------------- Safe storage ---------------- */
const NS = "zaidsaid.v2.";
const SCHEMA_VERSION = 2;
const safeGet = (k, fb) => { try { const v = localStorage.getItem(NS+k); return v==null?fb:JSON.parse(v); } catch(e){ return fb; } };
const safeSet = (k, v) => { try { localStorage.setItem(NS+k, JSON.stringify(v)); } catch(e){} };
const getAnthropicPath = () => {
  try {
    const a = safeGet("providers.cfg", {}) || {};
    const b = safeGet("providers", {}) || {};
    const anth = (a && a.anthropic) || (b && b.anthropic) || {};
    if (anth.enabled === false) return "";
    return String(anth.path || anth.proxyUrl || anth.url || "").trim();
  } catch(_) { return ""; }
};
function useLocalState(key, initial){
  const [v, setV] = useState(() => safeGet(key, initial));
  useEffect(() => { safeSet(key, v); }, [key, v]);
  return [v, setV];
}
try { if (safeGet("__schema", 0) !== SCHEMA_VERSION) safeSet("__schema", SCHEMA_VERSION); } catch(e){}

/* ---------------- God mode (admin / power-user surface toggle) ----------------
 * Public MVP hides advanced controls (per-scene regen, full provider config,
 * test endpoints, dev tabs). God mode re-reveals everything.
 * Enable:  zaidsaid.com/?god=1   (persists in localStorage)
 * Disable: zaidsaid.com/?god=0   (clears it)
 * Toggle in UI: Settings > About > "God mode" switch.
 */
try {
  const __zsParams = new URLSearchParams(location.search);
  if (__zsParams.get("god") === "1") localStorage.setItem("zs_god", "1");
  if (__zsParams.get("god") === "0") localStorage.removeItem("zs_god");
} catch(e){}
const isGodMode = (typeof window !== "undefined") && (function(){ try { return localStorage.getItem("zs_god") === "1"; } catch(e){ return false; } })();
try { if (isGodMode) document.documentElement.classList.add("zs-god"); } catch(e){}

/* ---------------- Default proxy seed (first-run MVP experience) ----------------
 * Public users have no providers configured on first visit, so every Claude/
 * ElevenLabs/Stability call falls back to local. Seed sensible defaults that
 * route through the deployed Cloudflare Worker on first load. Users (and god
 * mode) can still override in Settings > Providers.
 */
try {
  const _ZS_WORKER = "https://zaidsaid-proxy.zaidsaid.workers.dev";
  const _zsRaw = localStorage.getItem("zaidsaid.v2.providers");
  const _zsPrev = _zsRaw ? JSON.parse(_zsRaw) : {};
  const _zsDefaults = {
    anthropic:    { proxyUrl: _ZS_WORKER + "/anthropic",    enabled: true },
    elevenlabs:   { proxyUrl: _ZS_WORKER + "/elevenlabs",   enabled: true },
    stability:    { proxyUrl: _ZS_WORKER + "/stability",    enabled: true },
    pollinations: { proxyUrl: _ZS_WORKER + "/pollinations", enabled: true },
    grok:         { proxyUrl: _ZS_WORKER + "/grok",         enabled: true },
  };
  let _zsChanged = false;
  for (const [_k, _v] of Object.entries(_zsDefaults)) {
    if (!_zsPrev[_k] || !_zsPrev[_k].proxyUrl) { _zsPrev[_k] = _v; _zsChanged = true; }
  }
  if (_zsChanged) localStorage.setItem("zaidsaid.v2.providers", JSON.stringify(_zsPrev));
} catch(e){}

/* ---------------- Brand / tokens ---------------- */
const BRAND = { name: "Zaidsaid", tagline: "The AI video platform for teams", version: "v2.0", domain: "zaidsaid.com" };

/* ---------------- Icons (inline, no deps) ---------------- */
const I = {
  spark: (p)=> <svg viewBox="0 0 24 24" width={p?.size||18} height={p?.size||18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M18.5 5.5l-2.8 2.8M8.3 15.7l-2.8 2.8"/></svg>,
  home: (p)=> <svg viewBox="0 0 24 24" width={p?.size||18} height={p?.size||18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>,
  studio: (p)=> <svg viewBox="0 0 24 24" width={p?.size||18} height={p?.size||18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 5h16v10H4zM8 20h8M12 15v5"/></svg>,
  scissors: (p)=> <svg viewBox="0 0 24 24" width={p?.size||18} height={p?.size||18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m20 4-8.5 10M20 20 8 8"/></svg>,
  avatar: (p)=> <svg viewBox="0 0 24 24" width={p?.size||18} height={p?.size||18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>,
  brand: (p)=> <svg viewBox="0 0 24 24" width={p?.size||18} height={p?.size||18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3 4 7v6c0 5 3.5 7.5 8 8 4.5-.5 8-3 8-8V7z"/></svg>,
  template: (p)=> <svg viewBox="0 0 24 24" width={p?.size||18} height={p?.size||18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  folder: (p)=> <svg viewBox="0 0 24 24" width={p?.size||18} height={p?.size||18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
  blocks: (p)=> <svg viewBox="0 0 24 24" width={p?.size||18} height={p?.size||18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>,
  book: (p)=> <svg viewBox="0 0 24 24" width={p?.size||18} height={p?.size||18} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 7h8M8 11h8M8 15h6"/></svg>,
  play: (p)=> <svg viewBox="0 0 24 24" width={p?.size||18} height={p?.size||18} fill="currentColor" aria-hidden><path d="M8 5v14l11-7z"/></svg>,
  check: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5L20 7"/></svg>,
  arrow: (p)=> <svg viewBox="0 0 24 24" width={p?.size||16} height={p?.size||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  refresh: (p)=> <svg viewBox="0 0 24 24" width={p?.size||16} height={p?.size||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/></svg>,
  grip: (p)=> <svg viewBox="0 0 24 24" width={p?.size||16} height={p?.size||16} fill="currentColor" aria-hidden><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>,
  up: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 15 6-6 6 6"/></svg>,
  down: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6"/></svg>,
  plus: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M5 12h14"/></svg>,
  x: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 6l12 12M18 6 6 18"/></svg>,
  wave: (p)=> <svg viewBox="0 0 24 24" width={p?.size||16} height={p?.size||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2M21 12h0"/></svg>,
  flame: (p)=> <svg viewBox="0 0 24 24" width={p?.size||16} height={p?.size||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s1 2 3 2c0-4 1-8 1-8z"/></svg>,
  link: (p)=> <svg viewBox="0 0 24 24" width={p?.size||16} height={p?.size||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5"/></svg>,
  copy: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>,
  search: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  edit: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 20h4l10-10-4-4L4 16zM14 6l4 4"/></svg>,
  trash: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>,
  mic: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>,
  star: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="currentColor" aria-hidden><path d="M12 2.5 14.9 9l6.6.6-5 4.4 1.5 6.5L12 17l-6 3.5L7.5 14l-5-4.4L9.1 9z"/></svg>,
  starOutline: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2.5 14.9 9l6.6.6-5 4.4 1.5 6.5L12 17l-6 3.5L7.5 14l-5-4.4L9.1 9z"/></svg>,
  globe: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>,
  comment: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a8 8 0 1 1-3.2-6.4L21 5v7z"/></svg>,
  clock: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,  palette: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.5-1.5-.5-2 .5-1.5 2-1.5H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/></svg>,
  menu: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
  layers: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="M2 13l10 5 10-5"/><path d="M2 18l10 5 10-5"/></svg>,
  eye: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>,

};

/* ---------------- Archived v1 seed data (preserved for later reuse) ---------------- */
const ARCHIVE_JOBS = [
  { id:"1ac278127fe7", title:"Why mushrooms talk to trees underground", caption:"Mycorrhizal networks let forests trade carbon and warnings in real time.", status:"done", duration:25, platforms:4, age:"2d ago", grad:"from-sky-500 via-indigo-500 to-violet-600" },
  { id:"9a251bdd7ac2", title:"How GPS uses Einstein relativity", caption:"Orbit clocks tick 38 microseconds faster per day. Without Einstein, GPS drifts kilometers.", status:"done", duration:28, platforms:3, age:"3d ago", grad:"from-violet-500 via-purple-500 to-indigo-700" },
  { id:"17d6d387ee35", title:"Repurpose: Huberman x Attia long-form -> 5 shorts", caption:"Ranked 5 highest-energy moments, exported platform-native.", status:"done", duration:60, platforms:3, age:"5d ago", grad:"from-amber-400 via-orange-500 to-rose-500" },
  { id:"4f5bc0aabb11", title:"The octopus that solves puzzles", caption:"Cognition in eight arms. Proof of distributed intelligence.", status:"done", duration:22, platforms:3, age:"6d ago", grad:"from-rose-400 via-pink-500 to-fuchsia-600" },
  { id:"6d8a11a7cc22", title:"Why the ocean glows at night", caption:"Bioluminescence, explained for a 30-second short.", status:"running", duration:30, platforms:3, age:"now", grad:"from-emerald-400 via-teal-500 to-cyan-600" },
  { id:"7e9b22b8dd33", title:"Apollo 13: the CO2 filter fix", caption:"Engineers saved three lives with duct tape and a sock.", status:"queued", duration:45, platforms:4, age:"queued", grad:"from-fuchsia-400 via-purple-500 to-indigo-700" },
];
const ARCHIVE_BRAND_KITS = [
  { id:"bk-zs", name:"Zaidsaid Studio", primary:"#6366f1", secondary:"#22d3ee", accent:"#ec4899", font:"Inter", motion:"cinematic", voice:"warm" },
  { id:"bk-edu", name:"Lab Notes (EDU)", primary:"#0ea5e9", secondary:"#22c55e", accent:"#f59e0b", font:"IBM Plex Sans", motion:"clean", voice:"friendly" },
  { id:"bk-news", name:"Field Report", primary:"#111827", secondary:"#f97316", accent:"#ef4444", font:"Source Serif Pro", motion:"kinetic", voice:"authoritative" },
];
const ARCHIVE_PIPELINE = [
  "Research","Outline","Script","Storyboard","Shotlist","Voice","Avatar","B-roll","Motion","Captions","Edit","Mix","Export","Publish"
];
const ARCHIVE_PROVIDERS = [
  { stage:"Research", primary:"Grok (Free)", fallback:"Perplexity", latency:"2.1s" },
  { stage:"Script", primary:"Claude 3.5", fallback:"GPT-4.1", latency:"1.4s" },
  { stage:"Storyboard", primary:"Flux 1.1 Pro", fallback:"SDXL", latency:"6.2s" },
  { stage:"Voice", primary:"ElevenLabs", fallback:"PlayHT", latency:"1.1s" },
  { stage:"Avatar", primary:"HeyGen", fallback:"Synthesia", latency:"9.8s" },
  { stage:"Motion", primary:"Runway Gen-3", fallback:"Kling", latency:"11.5s" },
  { stage:"Music", primary:"Suno", fallback:"Udio", latency:"2.9s" },
  { stage:"Captions", primary:"Whisper V3", fallback:"Deepgram", latency:"0.8s" },
  { stage:"Edit", primary:"Zaidsaid Timeline", fallback:"—", latency:"0.2s" },
  { stage:"Publish", primary:"Direct to platform", fallback:"Buffer", latency:"1.6s" },
];
const ARCHIVE_PLATFORMS = [
  { id:"shorts", name:"YouTube Shorts", ratio:"9/16", max:"60s" },
  { id:"reels", name:"Instagram Reels", ratio:"9/16", max:"90s" },
  { id:"tiktok", name:"TikTok", ratio:"9/16", max:"3m" },
  { id:"x", name:"X / Twitter", ratio:"1/1", max:"2m 20s" },
  { id:"linkedin", name:"LinkedIn", ratio:"1/1", max:"10m" },
  { id:"youtube", name:"YouTube", ratio:"16/9", max:"12h" },
];
const ARCHIVE_LANGS = ["English","Spanish","Portuguese","French","German","Arabic","Hindi","Mandarin","Japanese","Korean"];
const ARCHIVE_AVATARS = [
  { id:"nova", name:"Nova", persona:"Anchor — calm and authoritative", tags:["news","explainer"] },
  { id:"atlas", name:"Atlas", persona:"Coach — energetic and warm", tags:["training","marketing"] },
  { id:"vera", name:"Vera", persona:"Host — curious and bright", tags:["social","educational"] },
  { id:"orion", name:"Orion", persona:"Expert — deep and deliberate", tags:["longform","podcast"] },
  { id:"you", name:"You", persona:"Your custom avatar, trained on your reference set", tags:["personal"] },
];

/* ---------------- Providers (proxy-URL registry, no raw keys in client) ---------------- */
const PROVIDERS = [
  { id:"local", name:"Local / Free", vendor:"Browser-native", caps:["tts","stt","capture","render"], docs:"https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis", defaultPath:"" },
  { id:"elevenlabs", name:"ElevenLabs", vendor:"ElevenLabs", caps:["tts","voiceClone"], docs:"https://elevenlabs.io/docs", defaultPath:"/api/elevenlabs" },
  { id:"heygen", name:"HeyGen", vendor:"HeyGen", caps:["avatarVideo"], docs:"https://docs.heygen.com", defaultPath:"/api/heygen" },
  { id:"synthesia", name:"Synthesia", vendor:"Synthesia", caps:["avatarVideo"], docs:"https://docs.synthesia.io", defaultPath:"/api/synthesia" },
  { id:"openai", name:"OpenAI", vendor:"OpenAI", caps:["script","tts","stt","image"], docs:"https://platform.openai.com/docs", defaultPath:"/api/openai" },
  { id:"anthropic", name:"Claude", vendor:"Anthropic", caps:["script","research"], docs:"https://docs.anthropic.com", defaultPath:"/api/anthropic" },
  { id:"runway", name:"Runway", vendor:"Runway", caps:["motion"], docs:"https://docs.dev.runwayml.com", defaultPath:"/api/runway" },
  { id:"kling", name:"Kling", vendor:"Kuaishou", caps:["motion"], docs:"https://klingai.com", defaultPath:"/api/kling" },
  { id:"flux", name:"Flux", vendor:"Black Forest Labs", caps:["image"], docs:"https://docs.bfl.ml", defaultPath:"/api/flux" },
  { id:"stability", name:"Stable Diffusion XL", vendor:"Stability", caps:["image"], docs:"https://platform.stability.ai/docs", defaultPath:"/api/stability" },
  { id:"whisper", name:"Whisper V3", vendor:"OpenAI / self-hosted", caps:["stt"], docs:"https://github.com/openai/whisper", defaultPath:"/api/whisper" },
  { id:"deepgram", name:"Deepgram", vendor:"Deepgram", caps:["stt"], docs:"https://developers.deepgram.com", defaultPath:"/api/deepgram" },
  { id:"suno", name:"Suno", vendor:"Suno", caps:["music"], docs:"https://suno.com", defaultPath:"/api/suno" },
  { id:"udio", name:"Udio", vendor:"Udio", caps:["music"], docs:"https://udio.com", defaultPath:"/api/udio" },
  { id:"perplexity", name:"Perplexity", vendor:"Perplexity", caps:["research"], docs:"https://docs.perplexity.ai", defaultPath:"/api/perplexity" },
  { id:"grok", name:"Grok (Free)", vendor:"xAI", caps:["research"], docs:"https://docs.x.ai/docs", defaultPath:"/api/grok" }
];
const PROVIDER_CAP_LABEL = { tts:"Text-to-speech", stt:"Speech-to-text", voiceClone:"Voice cloning", avatarVideo:"Avatar video", script:"Scripting", research:"Research", image:"Image gen", motion:"Motion / video gen", music:"Music", capture:"Media capture", render:"Render" };
const PROVIDER_CAPS_ORDER = ["tts","voiceClone","avatarVideo","script","research","image","motion","stt","music"];
function providersForCap(cap){ return PROVIDERS.filter(p => (p.caps||[]).includes(cap)); }
function providerById(id){ return PROVIDERS.find(p => p.id === id) || PROVIDERS[0]; }

function useProviderSettings(){
  const [store, setStore] = useLocalState("providers", {});
  const getPath = (id) => (store[id] && store[id].proxyUrl) || "";
  const getEnabled = (id) => !!(store[id] && store[id].enabled);
  const setPath = (id, proxyUrl) => setStore({ ...store, [id]: { ...(store[id]||{}), proxyUrl } });
  const setEnabled = (id, enabled) => setStore({ ...store, [id]: { ...(store[id]||{}), enabled } });
  const clear = (id) => { const n = { ...store }; delete n[id]; setStore(n); };
  return { store, getPath, getEnabled, setPath, setEnabled, clear };
}
async function pingProvider(proxyUrl){
  try {
    const url = (proxyUrl || "").replace(/\/$/, "") + "/ping";
    const r = await fetch(url, { method: "GET" });
    const txt = await r.text().catch(()=> "");
    return { ok: r.ok, status: r.status, body: txt.slice(0, 200) };
  } catch(e){ return { ok: false, status: 0, body: (e && e.message) || "Network error" }; }
}

async function pingAnthropicToolUse(proxyUrl){
  const start = Date.now();
  try {
    const url = (proxyUrl || "").replace(/\/$/, "") + "/v1/messages";
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        tools: [{ name: "noop", description: "Reply with ok:true", input_schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] } }],
        tool_choice: { type: "tool", name: "noop" },
        messages: [{ role: "user", content: "Call the noop tool with ok:true." }]
      })
    });
    const txt = await r.text().catch(()=> "");
    const ms = Date.now() - start;
    let toolOk = false;
    try { const j = JSON.parse(txt); toolOk = !!(j && Array.isArray(j.content) && j.content.some(b => b && b.type === "tool_use")); } catch(e){}
    return { ok: r.ok && toolOk, status: r.status, body: (toolOk ? "tool_use received · " : "") + ms + "ms · " + txt.slice(0, 140) };
  } catch(e){ return { ok: false, status: 0, body: (e && e.message) || "Network error" }; }
}
async function pingOpenAIToolUse(proxyUrl){
  const start = Date.now();
  try {
    const url = (proxyUrl || "").replace(/\/$/, "") + "/v1/chat/completions";
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 64,
        tools: [{ type: "function", function: { name: "noop", description: "Reply with ok:true", parameters: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] } } }],
        tool_choice: { type: "function", function: { name: "noop" } },
        messages: [{ role: "user", content: "Call the noop function with ok:true." }]
      })
    });
    const txt = await r.text().catch(()=> "");
    const ms = Date.now() - start;
    let toolOk = false;
    try { const j = JSON.parse(txt); toolOk = !!(j && j.choices && j.choices[0] && j.choices[0].message && Array.isArray(j.choices[0].message.tool_calls) && j.choices[0].message.tool_calls.length); } catch(e){}
    return { ok: r.ok && toolOk, status: r.status, body: (toolOk ? "tool_calls received · " : "") + ms + "ms · " + txt.slice(0, 140) };
  } catch(e){ return { ok: false, status: 0, body: (e && e.message) || "Network error" }; }
}


async function pingGrokToolUse(proxyUrl){
  const start = Date.now();
  try {
    const url = (proxyUrl || "").replace(/\/$/, "") + "/v1/chat/completions";
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-2-latest",
        max_tokens: 64,
        tools: [{ type: "function", function: { name: "noop", description: "Reply with ok:true", parameters: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] } } }],
        tool_choice: { type: "function", function: { name: "noop" } },
        messages: [{ role: "user", content: "Call the noop function with ok:true." }]
      })
    });
    const txt = await r.text().catch(()=> "");
    const ms = Date.now() - start;
    let toolOk = false;
    try { const j = JSON.parse(txt); toolOk = !!(j && j.choices && j.choices[0] && j.choices[0].message && Array.isArray(j.choices[0].message.tool_calls) && j.choices[0].message.tool_calls.length); } catch(e){}
    return { ok: r.ok && toolOk, status: r.status, body: (toolOk ? "tool_calls received · " : "") + ms + "ms · " + txt.slice(0, 140) };
  } catch(e){ return { ok: false, status: 0, body: (e && e.message) || "Network error" }; }
}


function ProviderRow({ provider, path, enabled, onChangePath, onChangeEnabled }){
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [tuTesting, setTuTesting] = useState(false);
  const [tuResult, setTuResult] = useState(null);
  const isAnthropic = provider.id === "anthropic";
  const [ooTesting, setOoTesting] = useState(false);
  const [ooResult, setOoResult] = useState(null);
  const isOpenAI = provider.id === "openai";
  const [ggTesting, setGgTesting] = useState(false);
  const [ggResult, setGgResult] = useState(null);
  const isGrok = provider.id === "grok";
  const isLocal = provider.id === "local";
  const onTest = async () => {
    if(isLocal){ setResult({ ok: true, status: 200, body: "Local / browser-native capabilities are always available." }); return; }
    if(!path){ setResult({ ok:false, status:0, body:"Set a proxy URL first." }); return; }
    setTesting(true); setResult(null);
    const r = await pingProvider(path);
    setResult(r); setTesting(false);
  };
  const onToolUseTest = async () => {
    setTuTesting(true); setTuResult(null);
    const r = await pingAnthropicToolUse(path);
    setTuResult(r); setTuTesting(false);
  };
  const onOpenAIToolUseTest = async () => {
    setOoTesting(true); setOoResult(null);
    const r = await pingOpenAIToolUse(path);
    setOoResult(r); setOoTesting(false);
  };
  const onGrokToolUseTest = async () => {
    setGgTesting(true); setGgResult(null);
    const r = await pingGrokToolUse(path);
    setGgResult(r); setGgTesting(false);
  };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="font-semibold text-[14px] flex items-center gap-2">{provider.name}<span className="text-[11px] text-[color:var(--muted)]">{provider.vendor}</span></div>
          <div className="mt-1 flex flex-wrap gap-1">{(provider.caps||[]).map(c => <Tag key={c}>{PROVIDER_CAP_LABEL[c]||c}</Tag>)}</div>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-[color:var(--muted)]">
          <input type="checkbox" checked={!!enabled} onChange={(e)=>onChangeEnabled(e.target.checked)} className="accent-white" />
          <span>Enabled</span>
        </label>
      </div>
      {!isLocal && (
        <div className="mt-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Proxy URL <span className="text-rose-300">(not your raw API key)</span></span>
            <div className="mt-1 flex items-center gap-2 bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 focus-within:border-white/20">
              <span className="text-[color:var(--muted)]" aria-hidden>{I.link({size:14})}</span>
              <input value={path||""} onChange={(e)=>onChangePath(e.target.value)} placeholder={"https://your-proxy.example.com" + (provider.defaultPath||"")} className="flex-1 bg-transparent text-sm focus:outline-none" />
              <a href={provider.docs} target="_blank" rel="noopener" className="chip">{I.book({size:12})} Docs</a>
            </div>
          </label>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <button className="btn" onClick={onTest} disabled={testing}>{testing ? "Testing…" : "Test"}</button>
            {result && (
              <span className={"chip " + (result.ok ? "text-emerald-200 !border-emerald-400/30 bg-emerald-500/10" : "text-rose-200 !border-rose-400/30 bg-rose-500/10")}>
                {result.ok ? "OK" : "Fail"} {result.status||""}
              </span>
            )}
            {result && result.body && <span className="text-[11px] text-[color:var(--muted)] truncate max-w-[280px]">{result.body}</span>}
            {isAnthropic && (
              <button className="btn" onClick={onToolUseTest} disabled={tuTesting || !path}>{tuTesting ? "Tool-use…" : "Test tool-use"}</button>
            )}
            {isAnthropic && tuResult && (
              <span className={"chip " + (tuResult.ok ? "text-emerald-200 !border-emerald-400/30 bg-emerald-500/10" : "text-rose-200 !border-rose-400/30 bg-rose-500/10")}>
                {tuResult.ok ? "tool_use OK" : "Fail"} {tuResult.status||""} <span className="text-[color:var(--muted)] truncate max-w-[280px]">{tuResult.body}</span>
              </span>
            )}
            {isOpenAI && (
              <button className="btn" onClick={onOpenAIToolUseTest} disabled={ooTesting || !path}>{ooTesting ? "Tool-use…" : "Test tool-use"}</button>
            )}
            {isOpenAI && ooResult && (
              <span className={"chip " + (ooResult.ok ? "text-emerald-200 !border-emerald-400/30 bg-emerald-500/10" : "text-rose-200 !border-rose-400/30 bg-rose-500/10")}>
                {ooResult.ok ? "tool_calls OK" : "Fail"} {ooResult.status||""} <span className="text-[color:var(--muted)] truncate max-w-[280px]">{ooResult.body}</span>
              </span>
            )}            {isGrok && (
              <button className="btn" onClick={onGrokToolUseTest} disabled={ggTesting || !path}>{ggTesting ? "Tool-use…" : "Test tool-use"}</button>
            )}
            {isGrok && ggResult && (
              <span className={"chip " + (ggResult.ok ? "text-emerald-200 !border-emerald-400/30 bg-emerald-500/10" : "text-rose-200 !border-rose-400/30 bg-rose-500/10")}>
                {ggResult.ok ? "tool_calls OK" : "Fail"} {ggResult.status||""} <span className="text-[color:var(--muted)] truncate max-w-[280px]">{ggResult.body}</span>
              </span>
            )}

          </div>
          <div className="mt-2 text-[11px] text-[color:var(--muted)]">
            Paste the public URL of your server-side proxy for {provider.name}. Keys stay on your server; this app only calls your proxy.
          </div>
        </div>
      )}
      {isLocal && (
        <div className="mt-3 text-[12px] text-[color:var(--muted)]">Uses browser-native APIs (Web Speech, MediaRecorder). Free, offline-capable, no proxy needed.</div>
      )}
    </div>
  );
}

function ProvidersPanel({ filterCap }){
  const { store, getPath, getEnabled, setPath, setEnabled } = useProviderSettings();
  const list = filterCap ? providersForCap(filterCap) : PROVIDERS;
  const counts = { configured: PROVIDERS.filter(p => p.id !== "local" && getPath(p.id)).length, enabled: PROVIDERS.filter(p => getEnabled(p.id)).length };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Providers</div>
          <div className="text-lg font-semibold">{filterCap ? (PROVIDER_CAP_LABEL[filterCap]+" providers") : "All providers"}</div>
          <div className="text-[12px] text-[color:var(--muted)] mt-0.5">{counts.configured} configured · {counts.enabled} enabled · keys stay on your server</div>
        </div>
      </div>
      <div className="mt-4 grid md:grid-cols-2 gap-3">
        {list.map(p => (
          <ProviderRow key={p.id} provider={p} path={getPath(p.id)} enabled={getEnabled(p.id)} onChangePath={(v)=>setPath(p.id, v)} onChangeEnabled={(v)=>setEnabled(p.id, v)} />
        ))}
      </div>
      <HealthPanel filterCap={filterCap} />
    </div>
  );
}
function HealthPanel({ filterCap }){
  const [busy, setBusy] = React.useState(false);
  const [results, setResults] = React.useState([]);
  const [lastRun, setLastRun] = React.useState(0);
  const collectProviders = () => {
    let cfg = {}; try { cfg = safeGet('providers', {}) || {}; } catch(e){}
    const list = [];
    Object.keys(cfg).forEach(k => { const p = cfg[k]; if(p && typeof p === 'object'){ list.push({ name: k, proxyUrl: p.proxyUrl || '' }); } });
    return list;
  };
  const run = async () => {
    if(busy) return;
    const provs = collectProviders();
    if(!provs.length){ setResults([{name:'(none)', ok:false, ms:0, err:'No providers configured. Add one above.'}]); setLastRun(Date.now()); return; }
    setBusy(true);
    try {
      const r = await pingProviders(provs);
      setResults(r); setLastRun(Date.now());
    } catch(e){
      setResults([{name:'(error)', ok:false, ms:0, err:String(e && e.message || e)}]);
      setLastRun(Date.now());
    } finally { setBusy(false); }
  };
  const fmtAge = (t) => { if(!t) return ''; const s = Math.round((Date.now()-t)/1000); return s<60 ? (s + 's ago') : (Math.round(s/60) + 'm ago'); };
  return (
    <div className="card p-5 mt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-wide text-[color:var(--muted)]">Live health</div>
          <div className="text-lg font-semibold">Provider connectivity</div>
          <div className="text-[12px] text-[color:var(--muted)] mt-1">Pings each configured proxy at <code>/ping</code>. Results stay in your browser.</div>
        </div>
        <div className="flex items-center gap-2">
          {lastRun ? <div className="text-[11px] text-[color:var(--muted)]">checked {fmtAge(lastRun)}</div> : null}
          <button className="btn" onClick={run} disabled={busy}>{busy ? 'Pinging…' : 'Ping all'}</button>
        </div>
      </div>
      {results.length > 0 && (
        <div className="mt-3 grid md:grid-cols-2 gap-2">
          {results.map((r, i) => (
            <div key={r.name + ':' + i} className="flex items-center justify-between rounded-xl border border-[color:var(--line)] p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={'h-2 w-2 rounded-full flex-shrink-0 ' + (r.ok ? 'bg-emerald-400' : 'bg-red-400')} />
                <div className="truncate">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-[11px] text-[color:var(--muted)] truncate">{r.ok ? ('OK · ' + r.ms + 'ms') : ('Down · ' + (r.err || 'unknown'))}</div>
                </div>
              </div>
              <div className="text-[11px] text-[color:var(--muted)] flex-shrink-0">{r.status || ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



/* ---------------- New IA ---------------- */
const TABS = [
  { id:"home", label:"Home", icon:"home" },
  { id:"studio", label:"Studio", icon:"studio" },
  { id:"repurpose", label:"Repurpose", icon:"scissors", godOnly:true },
  { id:"avatars", label:"Avatars & Voices", icon:"avatar", godOnly:true },
  { id:"brands", label:"Brand Kits", icon:"brand", godOnly:true },
  { id:"templates", label:"Templates", icon:"template", godOnly:true },
  { id:"projects", label:"Projects", icon:"folder" },
  { id:"architecture", label:"Architecture", icon:"blocks", godOnly:true },
  { id:"settings", label:"Settings", icon:"grip" },
  { id:"docs", label:"Docs", icon:"book", godOnly:true },
];
const VISIBLE_TABS = TABS.filter(t => isGodMode || !t.godOnly);

/* ---------------- Hash routing helpers ---------------- */
function parseHash(){
  const raw = (location.hash||"").replace(/^#/, "");
  const [path, query] = raw.split("?");
  const params = {};
  if(query){
    query.split("&").forEach(kv => {
      const [k,v] = kv.split("=");
      if(k) params[decodeURIComponent(k)] = v==null?"":decodeURIComponent(v);
    });
  }
  return { path: path || "", params };
}
function setHash(path, params){
  let h = "#" + (path||"");
  if(params){
    const keys = Object.keys(params).filter(k => params[k]!=null && params[k]!=="");
    if(keys.length) h += "?" + keys.map(k => encodeURIComponent(k)+"="+encodeURIComponent(params[k])).join("&");
  }
  history.replaceState(null, "", h);
}

/* ---------------- Error Boundary ---------------- */
class Boundary extends React.Component {
  constructor(p){ super(p); this.state = { error: null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(){}
  render(){
    if(this.state.error){
      return (
        <div className="p-8 max-w-2xl mx-auto">
          <div className="card p-6">
            <div className="text-xl font-semibold">Something went sideways.</div>
            <div className="text-sm text-[color:var(--muted)] mt-2">The app hit an error and recovered gracefully. Try reloading the page. If it persists, clear site data and refresh.</div>
            <button className="btn mt-4" onClick={()=>{ try{ Object.keys(localStorage).filter(k=>k.startsWith(NS)).forEach(k=>localStorage.removeItem(k)); }catch(e){} location.reload(); }}>Reset local state &amp; reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------------- Shell ---------------- */
function TopBar({ tab, setTab, onNewProject }){
  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-[color:var(--bg)]/70 border-b border-[color:var(--line)]">
      <div className="max-w-[1400px] mx-auto px-5 py-3 flex items-center gap-4">
        <a href="#" onClick={(e)=>{e.preventDefault(); setTab("home");}} className="flex items-center gap-2 group" aria-label="Zaidsaid home">
          <div className="w-8 h-8 rounded-xl" style={{background:"linear-gradient(135deg,#6366f1,#22d3ee)"}} />
          <div className="font-extrabold tracking-tight text-[17px]">ZAIDSAID</div>
          <span className="chip ml-1">{BRAND.version} — live</span>
        </a>
        <nav className="ml-2 flex items-center gap-1 overflow-x-auto scrollbar" aria-label="Primary">
          {VISIBLE_TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} aria-current={tab===t.id?"page":undefined}
              className={"flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-[color:var(--muted)] hover:text-white whitespace-nowrap " + (tab===t.id?"tab-active":"")}>
              {I[t.icon] ? I[t.icon]({size:16}) : null}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {isGodMode && <span className="chip text-amber-200 !border-amber-400/30 bg-amber-500/10" title="Advanced / admin surface enabled">GOD</span>}
          <span className="chip"><span className="dot"/> all systems nominal</span>
          <button className="btn btn-primary" onClick={()=>{ onNewProject && onNewProject(); }}>
            {I.spark({size:16})} <span>New project</span>
          </button>
        </div>
      </div>
    </header>
  );
}
function Footer(){
  return (
    <footer className="border-t border-[color:var(--line)] mt-20">
      <div className="max-w-[1400px] mx-auto px-5 py-8 flex flex-col md:flex-row items-start md:items-center gap-4 text-sm text-[color:var(--muted)]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg" style={{background:"linear-gradient(135deg,#6366f1,#22d3ee)"}} />
          <div><b className="text-white">Zaidsaid</b> — AI video, end-to-end.</div>
        </div>
        <div className="md:ml-auto flex flex-wrap items-center gap-4">
          <span>© {new Date().getFullYear()} Zaidsaid</span>
          <a href="#" className="hover:text-white">Privacy</a>
          <a href="#" className="hover:text-white">Terms</a>
          <a href="#" className="hover:text-white">Security</a>
          <a href="#" className="hover:text-white">Status</a>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- Home ---------------- */
const INPUTS = [
  { k:"idea", label:"Idea or topic" },
  { k:"text", label:"Text / script" },
  { k:"link", label:"URL / article" },
  { k:"audio", label:"Audio or podcast" },
  { k:"pdf", label:"PDF / doc" },
  { k:"image", label:"Image / set" },
];
const PILLARS = [
  { title:"Generate", body:"From idea to polished video in one workflow — research, script, storyboard, assets, motion, voice, edit, and publish.", icon:"studio" },
  { title:"Repurpose", body:"Turn long-form podcasts, webinars, and videos into social-ready shorts. Automatic highlight detection and virality scoring.", icon:"scissors" },
  { title:"Embody", body:"Custom avatars and voice cloning. Text-to-talking-head with lip sync and translation — on brand, every time.", icon:"avatar" },
];
const FEATURES = [
  { t:"End-to-end workflow", d:"Research → Script → Storyboard → Assets → Motion → Voice/Avatar → Timeline → Export. No tool-switching." },
  { t:"Guided or automated", d:"Let Zaidsaid run the pipeline, or jump in scene-by-scene with an intelligent timeline assistant." },
  { t:"Brand kits", d:"Lock palette, typography, motion presets, caption styles, intros, and outros. Every output stays on-brand." },
  { t:"Persistent characters", d:"Keep the same avatar and styling across scenes and episodes — story-aware, not slideshow." },
  { t:"Repurposing", d:"Highlight detection with a virality score (0–100). Aspect-correct exports for every platform." },
  { t:"Avatars & voice cloning", d:"Create a personal avatar and clone your voice. Lip sync, emotion, and 10+ languages." },
  { t:"Localization", d:"Generate localized variants of the same video in multiple languages without re-shoots." },
  { t:"Templates", d:"Ads, explainers, faceless, training, YouTube, social. One click to scaffold, any style you want after." },
  { t:"Versions & approvals", d:"Draft → In review → Approved → Published. Commentable versions, reversible edits." },
  { t:"Asset provenance", d:"Every clip, track, and frame tagged with source and usage rights. Publish with confidence." },
  { t:"Multi-platform export", d:"9:16 / 1:1 / 16:9 presets for TikTok, Reels, Shorts, X, LinkedIn, YouTube." },
  { t:"API & webhooks", d:"Programmatic pipelines for agencies. Rate-limited, auditable, signed webhooks on every stage." },
];
const INTEGRATIONS = ["TikTok","Instagram","YouTube","LinkedIn","X","Slack","Notion","Google Drive","Dropbox","Zapier"];
function HomeTab({ setTab, startProject }){
  return (
    <div className="max-w-[1400px] mx-auto px-5">
      <section className="py-14 md:py-20 relative">
        <div className="flex flex-col items-start gap-5 max-w-3xl">
          <span className="chip"><span className="dot"/>{isGodMode ? " Built for teams that publish every day" : " Free to try · runs in your browser · no account needed"}</span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05]">
            <span className="grad-text">{isGodMode ? "AI video, end-to-end." : "Paste a topic."}</span><br/>
            {isGodMode ? "From idea to on-brand upload — in one workflow." : "Get a narrated video in minutes."}
          </h1>
          <p className="text-[17px] text-[color:var(--muted)] max-w-2xl">
            {isGodMode
              ? "Zaidsaid turns text, links, audio, articles, podcasts, PDFs, and images into polished, branded, social-ready videos. Research, scripting, storyboarding, assets, motion graphics, voiceover, avatar narration, editing, and repurposing — all automated, all in one place."
              : "Drop in a topic, script, or YouTube link. Zaidsaid writes the script, generates a storyboard, narrates each scene, and gives you a finished video to download — all in your browser."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" onClick={()=>{ startProject && startProject(); }}>{I.spark({size:16})} <span>Start a project</span></button>
            {isGodMode && <button className="btn" onClick={()=>setTab("repurpose")}>{I.scissors({size:16})} <span>Repurpose long-form</span></button>}
            {isGodMode && <button className="btn btn-ghost" onClick={()=>setTab("templates")}>{I.template({size:16})} <span>Browse templates</span></button>}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {INPUTS.map(i => <span key={i.k} className="chip">{i.label}</span>)}
          </div>
        </div>
        {isGodMode ? (
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
            {ARCHIVE_PIPELINE.slice(0,8).map((s,i) => (
              <div key={s} className="card p-3 text-center text-xs text-[color:var(--muted)]">
                <div className="text-[10px] text-[color:var(--muted)]/70">Stage {i+1}</div>
                <div className="text-white font-semibold mt-1">{s}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { n: "1", t: "Paste", d: "A topic, a script, or a YouTube link." },
              { n: "2", t: "Generate", d: "Claude writes the script; Stability draws the scenes; ElevenLabs narrates." },
              { n: "3", t: "Download", d: "A narrated WebM video, ready to post." },
            ].map(s => (
              <div key={s.n} className="card p-4">
                <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Step {s.n}</div>
                <div className="text-white font-semibold mt-1 text-lg">{s.t}</div>
                <div className="text-sm text-[color:var(--muted)] mt-1">{s.d}</div>
              </div>
            ))}
          </div>
        )}
      </section>
      {isGodMode && (
        <section className="py-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[color:var(--muted)] text-sm">
            <span className="uppercase tracking-widest text-[11px]">Publishes to</span>
            {INTEGRATIONS.map(x => <span key={x} className="text-white/80">{x}</span>)}
          </div>
        </section>
      )}
      {isGodMode && (
        <section className="py-10">
          <div className="grid md:grid-cols-3 gap-4">
            {PILLARS.map(p => (
              <div key={p.title} className="card p-6">
                <div className="flex items-center gap-2 text-[color:var(--muted)]">{I[p.icon]({size:18})}<span className="text-xs uppercase tracking-wider">{p.title}</span></div>
                <div className="mt-2 text-xl font-semibold">{p.title}</div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">{p.body}</p>
                <button className="btn mt-4" onClick={()=>setTab(p.title==="Generate"?"studio":p.title==="Repurpose"?"repurpose":"avatars")}>Open {p.title} {I.arrow({size:14})}</button>
              </div>
            ))}
          </div>
        </section>
      )}
      {isGodMode && (
        <section className="py-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="uppercase tracking-widest text-[11px] text-[color:var(--muted)]">What's inside</div>
              <h2 className="text-2xl md:text-3xl font-bold mt-1">Everything a video team needs, one platform.</h2>
            </div>
            <button className="btn" onClick={()=>setTab("architecture")}>See architecture {I.arrow({size:14})}</button>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {FEATURES.map(f => (
              <div key={f.t} className="card p-5">
                <div className="font-semibold">{f.t}</div>
                <div className="text-sm text-[color:var(--muted)] mt-1">{f.d}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="py-14">
        <div className="card p-8 ring-brand flex flex-col md:flex-row items-start md:items-center gap-6">
          <div>
            <h3 className="text-2xl font-bold">Ready to ship videos every day?</h3>
            <p className="text-[color:var(--muted)] mt-1">Start in the Studio, or drop a long-form file and we'll cut shorts automatically.</p>
          </div>
          <div className="md:ml-auto flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={()=>{ startProject && startProject(); }}>{I.play({size:14})} Start a project</button>
            {isGodMode && <button className="btn" onClick={()=>setTab("docs")}>{I.book({size:14})} Read the docs</button>}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Studio wizard (Stage 2) ---------------- */
const STUDIO_STEPS = [
  { id:"research",   label:"Research",     blurb:"Gather sources, angles, and claims." },
  { id:"script",     label:"Script",       blurb:"Tight, spoken copy with beats." },
  { id:"storyboard", label:"Storyboard",   blurb:"Frame-by-frame visual plan." },
  { id:"assets",     label:"Assets",       blurb:"B-roll, stills, music, SFX." },
  { id:"motion",     label:"Motion",       blurb:"Camera moves, transitions, kinetic type." },
  { id:"voice",      label:"Voice/Avatar", blurb:"Narration, clone, or avatar performance." },
  { id:"timeline",   label:"Timeline",     blurb:"Arrange scenes. Drag to reorder." },
  { id:"export",     label:"Export",       blurb:"Aspect and platform presets." },
];
const STUDIO_INPUT_KINDS = [
  { k:"text",    label:"Text",    hint:"Paste a prompt, outline, or full draft." },
  { k:"link",    label:"Link",    hint:"Article, blog, landing page." },
  { k:"audio",   label:"Audio",   hint:"MP3 / WAV voice memo." },
  { k:"article", label:"Article", hint:"Long-form RSS or newsletter." },
  { k:"podcast", label:"Podcast", hint:"Episode URL or audio file." },
  { k:"pdf",     label:"PDF",     hint:"Whitepaper, brief, deck." },
  { k:"image",   label:"Image",   hint:"Single image or a set." },
];
const STUDIO_PIPELINE_STAGES = [
  { k:"ingest",    label:"Ingest source",      ms: 600 },
  { k:"research",  label:"Research the angle", ms: 900 },
  { k:"outline",   label:"Outline beats",      ms: 700 },
  { k:"script",    label:"Write the script",   ms: 1100 },
  { k:"board",     label:"Storyboard frames",  ms: 1300 },
  { k:"assets",    label:"Match assets",       ms: 1100 },
  { k:"motion",    label:"Plan motion",        ms: 900 },
  { k:"voice",     label:"Synthesize voice",   ms: 1000 },
  { k:"assemble",  label:"Assemble timeline",  ms: 800 },
];
const STUDIO_EXPORT_PRESETS = [
  { id:"vertical",   ratio:"9:16", label:"Vertical",   platforms:["TikTok","Reels","Shorts"] },
  { id:"square",     ratio:"1:1",  label:"Square",     platforms:["X","LinkedIn"] },
  { id:"landscape",  ratio:"16:9", label:"Landscape",  platforms:["YouTube","LinkedIn"] },
];
const STUDIO_CHARACTERS = [
  { id:"nova",  name:"Nova",  role:"Anchor" },
  { id:"atlas", name:"Atlas", role:"Coach" },
  { id:"vera",  name:"Vera",  role:"Host" },
];
const STUDIO_SEED = {
  name: "Why mushrooms talk to trees underground",
  kind: "idea",
  source: "Mycorrhizal networks: how fungi wire forests for carbon and warning signals.",
  brandKitId: "bk-zs",
  characterId: "nova",
  language: "English",
  platforms: ["TikTok","Reels","Shorts"],
  preset: "vertical",
  research: [
    { id:"r1", claim:"Up to 90% of land plants form mycorrhizal partnerships with fungi.",    source:"Nature Reviews Microbiology, 2020", confidence: 0.94 },
    { id:"r2", claim:"Trees trade carbon through hyphal networks, sometimes across species.",  source:"Simard et al., University of British Columbia", confidence: 0.88 },
    { id:"r3", claim:"Chemical warnings travel along fungal networks in minutes.",             source:"Current Biology, 2013",            confidence: 0.82 },
    { id:"r4", claim:"A single gram of forest soil can contain kilometers of fungal hyphae.", source:"USDA Forest Service",              confidence: 0.90 },
  ],
  scenes: [
    { id:"s1", title:"Hook",     voLine:"Under your feet, trees are talking.",                           shot:"Macro push-in on forest floor, morning light.",       duration: 3, motion:"slow push-in",     asset:"b-roll: dew on moss",   captions:"Under your feet, trees are talking." },
    { id:"s2", title:"Setup",    voLine:"They use a living underground network made of fungi.",         shot:"Diagram overlay: hyphal web between roots.",          duration: 5, motion:"parallax drift",   asset:"graphic: mycorrhizal map", captions:"A living network, made of fungi." },
    { id:"s3", title:"Evidence", voLine:"Ninety percent of land plants plug into it. Carbon flows.",   shot:"Kinetic text: 90% + cross-fade to canopy.",           duration: 5, motion:"kinetic type",     asset:"stock: forest canopy",   captions:"90% of land plants plug in." },
    { id:"s4", title:"Twist",    voLine:"And when a tree is attacked, neighbors get warned.",          shot:"Time-lapse: beetle on bark, particles across roots.", duration: 5, motion:"time-lapse",       asset:"stock: bark + particles", captions:"Attacked trees warn neighbors." },
    { id:"s5", title:"Payoff",   voLine:"The forest isn't a crowd. It's a conversation.",              shot:"Wide hero shot, slow dolly-out, title card.",          duration: 4, motion:"dolly-out hero",   asset:"hero: old-growth wide",  captions:"The forest is a conversation." },
  ],
};
function sceneRegenerateBlurbs(field){
  const bank = {
    voLine:  ["Rewritten for rhythm.","Punchier cadence, same meaning.","Tightened to 12 words.","Added a crisp verb."],
    shot:    ["New angle: low, looking up.","Swapped to a macro detail shot.","Added a subtle parallax layer.","Switched to golden-hour wide."],
    motion:  ["Softened the ease.","Added a frame-on-frame cut.","Kinetic type, 24fr hold.","Slow dolly, not push."],
    asset:   ["Swapped to a provenance-clean stock.","Matched palette to brand kit.","New clip has better negative space.","Paired with ambient bed."],
    captions:["Tightened caption to 7 words.","Rewrote with a hook verb.","Matched platform caption style.","Dropped jargon."],
  };
  const list = bank[field] || ["Regenerated."];
  return list[Math.floor(Math.random()*list.length)];
}


function StudioStageProvider({ step, setTab }){
  // Map Studio steps to Architecture pipeline stages
  const MAP = {
    research: "research",
    script: "script",
    storyboard: "storyboard",
    assets: "broll",
    motion: "broll",
    voice: "voice",
    edit: "edit",
    mix: "edit",
    captions: "captions",
    publish: "publish"
  };
  const picks = (() => {
    try { return JSON.parse(localStorage.getItem("zaidsaid.v2.arch.picks") || "{}"); } catch(e){ return {}; }
  })();
  const archId = MAP[step] || "research";
  const stageDef = (typeof PIPELINE_STAGES !== "undefined") ? PIPELINE_STAGES.find(x => x.id === archId) : null;
  const providerId = picks[archId] || (stageDef ? stageDef.defaultProvider : null);
  const meta = (providerId && typeof PROVIDER_META !== "undefined") ? PROVIDER_META[providerId] : null;
  if (!stageDef) return null;
  const isLocal = meta && meta.kind === "local";
  return (
    <div className="card p-3 flex items-center gap-3 flex-wrap">
      <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">{(I[stageDef.icon] || I.spark)({size:14})}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">Provider for this stage</div>
        <div className="text-sm font-semibold truncate">{meta ? meta.label : (providerId || "(none selected)")}</div>
      </div>
      {meta && (
        <span className={"text-[10px] px-2 py-0.5 rounded-full border " + (isLocal ? "border-emerald-500/30 text-emerald-300" : "border-sky-500/30 text-sky-300")}>{isLocal ? "LOCAL / FREE" : "CLOUD"}</span>
      )}
      <div className="text-[11px] text-[color:var(--muted)]">Latency ~{(isLocal ? stageDef.latency * 0.7 : stageDef.latency).toFixed(1)}s · Cost {isLocal ? "$0.00" : ("$"+stageDef.cost.toFixed(2))}</div>
      <div className="flex-1"></div>
      <button onClick={()=>setTab && setTab("architecture")} className="btn btn-ghost text-xs">{I.blocks({size:12})} Change in Architecture</button>
      <button onClick={()=>setTab && setTab("settings")} className="btn btn-ghost text-xs">{I.grip({size:12})} Proxy URL</button>
    </div>
  );
}

const PUBLIC_STUDIO_STEP_IDS = ["script", "storyboard", "voice", "export"];
function visibleStudioSteps(){
  return isGodMode ? STUDIO_STEPS : STUDIO_STEPS.filter(s => PUBLIC_STUDIO_STEP_IDS.includes(s.id));
}
function StudioStepNav({ step, setStep }){
  const steps = visibleStudioSteps();
  return (
    <div className="card p-2 flex items-center gap-1 overflow-x-auto scrollbar">
      {steps.map((s, i) => {
        const active = s.id === step;
        return (
          <button key={s.id}
            onClick={()=>setStep(s.id)}
            aria-current={active?"step":undefined}
            className={"flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] whitespace-nowrap " + (active ? "bg-white/10 text-white border border-white/10" : "text-[color:var(--muted)] hover:text-white")}>
            <span className="text-[10px] text-[color:var(--muted)]">{String(i+1).padStart(2,"0")}</span>
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function StudioCharacterRow({ project, setProject }){
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-3 flex items-center gap-2 flex-wrap">
      <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)] mr-1">Characters</div>
      {STUDIO_CHARACTERS.map(c => {
        const active = project.characterId === c.id;
        return (
          <button key={c.id}
            onClick={()=>setProject({ ...project, characterId: c.id })}
            aria-pressed={active}
            className={"flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-[12px] " + (active ? "border-white/20 bg-white/10 text-white" : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-white")}>
            <span className="w-6 h-6 rounded-full" style={{background:"linear-gradient(135deg,#6366f1,#22d3ee)"}} aria-hidden />
            <span>{c.name}</span>
            <span className="text-[10px] text-[color:var(--muted)]">{c.role}</span>
          </button>
        );
      })}
      <button className="chip" onClick={()=>setOpen(o=>!o)} aria-expanded={open}>
        {I.plus({size:12})} Add character
      </button>
      {open && (
        <div className="basis-full text-[12px] text-[color:var(--muted)] mt-2">
          Character creation lands in Stage 4 (Avatars & Voices). This chip row keeps the selected persona consistent across scenes.
        </div>
      )}
    </div>
  );
}

function StudioBrandKitSelect({ project, setProject }){
  return (
    <div className="card p-3 flex items-center gap-3 flex-wrap">
      <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Brand kit</div>
      {ARCHIVE_BRAND_KITS.map(b => {
        const active = project.brandKitId === b.id;
        return (
          <button key={b.id}
            onClick={()=>setProject({ ...project, brandKitId: b.id })}
            aria-pressed={active}
            className={"flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[12px] " + (active ? "border-white/20 bg-white/10 text-white" : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-white")}>
            <span className="flex items-center gap-0.5">
              <span className="w-3 h-3 rounded-sm" style={{background:b.primary}}/>
              <span className="w-3 h-3 rounded-sm" style={{background:b.secondary}}/>
              <span className="w-3 h-3 rounded-sm" style={{background:b.accent}}/>
            </span>
            <span>{b.name}</span>
          </button>
        );
      })}
      <span className="text-[11px] text-[color:var(--muted)]">Full brand-kit editor arrives in Stage 5.</span>
    </div>
  );
}

function StudioInputAccepter({ project, setProject, onAdvance, toast }){ const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState(""); const [diag, setDiag] = React.useState(""); const getProviderForResearch = () => { let archId = "research"; let picks = {}; try { picks = JSON.parse(localStorage.getItem("zaidsaid.v2.arch.picks") || "{}"); } catch(e){} const providerId = picks[archId] || (typeof PIPELINE_STAGES !== "undefined" ? (PIPELINE_STAGES.find(x => x.id === archId) || {}).defaultProvider : "anthropic") || "anthropic"; let providers = {}; try { providers = JSON.parse(localStorage.getItem("zaidsaid.v2.providers") || "{}"); } catch(e){} const rec = providers[providerId] || {}; return { providerId, proxyUrl: (rec.proxyUrl || "").trim(), enabled: !!rec.enabled }; }; const localFallback = (text) => { const paragraphs = String(text || "").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean); const sentences = String(text || "").split(/(?<=[\.!?])\s+/).map(s => s.trim()).filter(s => s.length > 6); const source = paragraphs.length >= 3 ? paragraphs : (sentences.length >= 3 ? sentences : [String(text||"").trim()]); const beatLabels = ["Hook", "Setup", "Proof", "Twist", "Callback", "Payoff", "CTA"]; const words = String(text||"").split(/\s+/).filter(Boolean); const requested = Math.max(3, Math.min(6, Math.max(source.length, words.length >= 18 ? 5 : 3))); const n = Math.min(requested, Math.max(3, words.length || 1)); const beats = []; if (source.length >= n) { const chunk = Math.max(1, Math.floor(source.length / n)); for (let i = 0; i < n; i++) { const slice = source.slice(i*chunk, (i===n-1) ? source.length : (i+1)*chunk).join(" ").trim(); beats.push({ title: beatLabels[i] || ("Beat " + (i+1)), script: slice.slice(0, 320) }); } } else { const per = Math.max(4, Math.ceil(words.length / n)); for (let i = 0; i < n; i++) { const slice = words.slice(i*per, (i===n-1) ? words.length : (i+1)*per).join(" ").trim() || (beatLabels[i] || ("Beat " + (i+1))) + " — add detail here."; beats.push({ title: beatLabels[i] || ("Beat " + (i+1)), script: slice.slice(0, 320) }); } } const firstWords = String(text||"").trim().split(/\s+/).slice(0, 18).join(" "); return { logline: firstWords + (firstWords.length ? "…" : ""), audience: "General viewers curious about the topic", angle: "Explain it in plain language with one memorable takeaway.", hook: beats[0] ? beats[0].script.slice(0, 120) : "Open with a concrete, surprising claim.", cta: "Follow for the next one.", beats }; }; const callAnthropic = async (proxyUrl, sourceText) => { const url = proxyUrl.replace(/\/$/, "") + "/v1/messages"; const platform = (project.platforms && project.platforms[0]) || "TikTok"; const duration = project.durationHint || 60; const language = project.language || "English"; const brandHint = project.brandKitId ? ("Brand kit id: " + project.brandKitId) : ""; const system = "You are a senior short-form video producer and visual director. Turn the user's source text into a tight creative brief, a beat-by-beat outline, AND a cinematic visual shot description for each beat. The shot field will be used directly as an image-generation prompt — make it concrete, visual, and specific (subject + action + setting + lighting + mood). Avoid abstract language. Use the provided tool and return strict JSON only via tool_use."; const userMsg = "PLATFORM: " + platform + "\nTARGET DURATION: " + duration + "s\nLANGUAGE: " + language + "\n" + brandHint + "\n\nSOURCE:\n" + sourceText; const tool = { name: "video_brief", description: "Return a creative brief, beat-by-beat outline, and per-beat cinematic shot descriptions.", input_schema: { type: "object", properties: { logline: { type: "string", description: "One-sentence summary of the video, max 140 chars." }, audience: { type: "string", description: "Who this is for." }, angle: { type: "string", description: "The specific angle or take." }, hook: { type: "string", description: "Opening 3-5 seconds, specific and concrete." }, cta: { type: "string", description: "Closing call-to-action." }, beats: { type: "array", description: "Ordered list of scenes/beats.", items: { type: "object", properties: { title: { type: "string", description: "Short label for this beat, 2-6 words." }, script: { type: "string", description: "1-3 sentences of on-screen narration." }, shot: { type: "string", description: "Concrete visual description for this beat as an image-gen prompt: subject + action + setting + lighting + mood. Avoid quotes and abstract words. 15-40 words." } }, required: ["title","script","shot"] } } }, required: ["logline","hook","beats"] } }; const body = { model: "claude-haiku-4-5-20251001", max_tokens: 1200, system, tools: [tool], tool_choice: { type: "tool", name: "video_brief" }, messages: [ { role: "user", content: userMsg } ] }; const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) }); const ct = res.headers.get("content-type") || ""; const raw = ct.includes("json") ? await res.json().catch(()=>null) : await res.text().catch(()=>""); if (!res.ok) { const msg = (raw && raw.error && raw.error.message) || (typeof raw === "string" ? raw.slice(0,200) : ("HTTP " + res.status)); throw new Error(msg); } const blocks = Array.isArray(raw && raw.content) ? raw.content : []; const toolBlock = blocks.find(b => b && b.type === "tool_use" && b.name === "video_brief"); if (!toolBlock || !toolBlock.input) throw new Error("Model did not return tool_use output"); return toolBlock.input; }; const callGrok = async (proxyUrl, sourceText) => {
  const url = proxyUrl.replace(/\/$/, "") + "/grok/v1/chat/completions";
  const platform = (project.platforms && project.platforms[0]) || "TikTok";
  const duration = project.durationHint || 60;
  const language = project.language || "English";
  const sysMsg = "You are a senior short-form video producer and visual director. Return JSON with keys: logline, audience, angle, hook, cta, beats (array of {title, script, shot}). The `shot` field must be a concrete cinematic visual description (subject + action + setting + lighting + mood, 15-40 words) that can be fed directly to an image generator. Strict JSON only.";
  const userMsg = "PLATFORM: " + platform + "\nDURATION: " + duration + "s\nLANGUAGE: " + language + "\n\nSOURCE:\n" + sourceText;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "grok-3-mini", max_tokens: 1200, response_format: { type: "json_object" }, messages: [{ role: "system", content: sysMsg }, { role: "user", content: userMsg }] }) });
  if (!res.ok) { const er = await res.json().catch(()=>({})); throw new Error((er.error && er.error.message) || ("HTTP " + res.status)); }
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error("Grok returned no content");
  const brief = JSON.parse(content);
  if (!Array.isArray(brief.beats)) throw new Error("Grok response missing beats");
  return brief;
};
const applyBrief = (brief) => { const beats = Array.isArray(brief && brief.beats) ? brief.beats : []; const total = Math.max(15, project.durationHint || 60); const per = Math.max(3, Math.round(total / Math.max(1, beats.length))); const scenes = beats.map((b, i) => ({ id: "s" + (i+1), title: (b.title || ("Beat " + (i+1))).slice(0, 80), script: (b.script || "").slice(0, 800), voLine: (b.script || "").slice(0, 800), duration: per, aroll: (project.scenes && project.scenes[i] && project.scenes[i].aroll) || "avatar", broll: (project.scenes && project.scenes[i] && project.scenes[i].broll) || [], shot: b.shot || ((b.title||"") + ": " + (b.script||"").split(/[.!?]/)[0].trim()), motion: b.motion || "slow push-in", asset: b.asset || "b-roll", captions: (b.script||"").slice(0,80) })); setProject({ ...project, logline: brief.logline || project.logline || "", hook: brief.hook || project.hook || "", cta: brief.cta || project.cta || "", audience: brief.audience || project.audience || "", angle: brief.angle || project.angle || "", scenes: scenes.length ? scenes : (project.scenes || []) }); }; const runBrief = async () => { const text = (project.source || "").trim(); if (!text) { setErr("Paste a prompt, story, or source text first."); return; } setErr(""); setDiag(""); setBusy(true); const { providerId, proxyUrl, enabled } = getProviderForResearch(); try { if (providerId === "anthropic" && proxyUrl && enabled) { setDiag("Calling " + providerId + " via proxy…"); const brief = await callAnthropic(proxyUrl, text); applyBrief(brief); toast && toast("Brief generated via Claude · " + (brief.beats||[]).length + " beats", "success"); } else if (providerId === "grok" && proxyUrl && enabled) { setDiag("Calling Grok via proxy…"); try { const brief = await callGrok(proxyUrl, text); applyBrief(brief); toast && toast("Brief generated via Grok · " + (brief.beats||[]).length + " beats", "success"); } catch(err) { setDiag("Grok error: " + err.message); } } else { setDiag(providerId === "anthropic" ? "No proxy URL configured — using local outline." : "Provider '" + providerId + "' not wired yet in Studio — using local outline."); const brief = localFallback(text); applyBrief(brief); toast && toast("Brief generated locally · " + brief.beats.length + " beats", "info"); } setBusy(false); onAdvance && setTimeout(() => onAdvance(), 350); } catch (e) { setBusy(false); const msg = (e && e.message) || String(e); setErr(msg); try { const brief = localFallback(text); applyBrief(brief); toast && toast("Cloud call failed — used local outline (" + brief.beats.length + " beats)", "warn"); onAdvance && setTimeout(() => onAdvance(), 450); } catch(_){} } }; const sourceLen = (project.source || "").trim().length; const { providerId, proxyUrl, enabled } = getProviderForResearch(); const willUseCloud = (providerId === "anthropic" || providerId === "grok") && proxyUrl && enabled; return ( <div className="card p-5"> <div className="flex items-center justify-between gap-3 flex-wrap"> <div> <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Source</div> <div className="text-lg font-semibold">What are we turning into a video?</div> </div> <div className="flex flex-wrap items-center gap-1"> {STUDIO_INPUT_KINDS.map(k => { const active = project.kind === k.k; return ( <button key={k.k} onClick={()=>setProject({ ...project, kind: k.k })} aria-pressed={active} className={"px-2.5 py-1.5 rounded-xl text-[12px] border " + (active ? "border-white/20 bg-white/10 text-white" : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-white")}> {k.label} </button> ); })} </div> </div> <div className="mt-4 grid md:grid-cols-3 gap-3"> <label className="md:col-span-2 block"> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Prompt or paste</span> <textarea value={project.source || ""} onChange={(e)=>setProject({ ...project, source: e.target.value })} placeholder="Paste text, a URL, or describe the video you want." rows={6} className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-xl p-3 text-sm focus:outline-none focus:border-white/20" />
{/(?:youtube\.com\/watch|youtu\.be\/)/.test(project.source||"") && (<button type="button" className="chip mt-1" onClick={async()=>{setBusy(true);try{const _r=await fetch("https://noembed.com/embed?url="+encodeURIComponent((project.source||"").trim()));const _d=await _r.json();if(_d.title){setProject({...project,source:"Video: "+_d.title+"\nBy: "+(_d.author_name||"")+"\n\nMake a short-form social video about this topic.\nSource: "+(project.source||"").trim(),name:project.name||_d.title});}}catch(_e){}setBusy(false);}}>Fetch YouTube title ↗</button>)} </label> <div> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Upload (UI only)</span> <div className="mt-1 border border-dashed border-[color:var(--line)] rounded-xl p-6 text-center text-[12px] text-[color:var(--muted)]"> <div className="text-white/80 font-semibold">Drop a file</div> <div className="mt-1">Audio · PDF · Image · Podcast</div> <div className="mt-3 opacity-70">Uploads wire up in a later stage.</div> <button type="button" className="btn mt-3" aria-disabled="true" onClick={(e)=>e.preventDefault()}> Choose file </button> </div> <div className="text-[11px] text-[color:var(--muted)] mt-2"> Currently selected: <span className="text-white">{(STUDIO_INPUT_KINDS.find(x=>x.k===project.kind)||{}).label || "Text"}</span> </div> </div> </div> <div className="mt-3 flex items-center gap-2 flex-wrap"> <input value={project.name || ""} onChange={(e)=>setProject({ ...project, name: e.target.value })} placeholder="Project name" className="bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20 flex-1 min-w-[240px]" /> <select value={project.language || "English"} onChange={(e)=>setProject({ ...project, language: e.target.value })} className="bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20"> {ARCHIVE_LANGS.map(l => <option key={l} value={l} style={{background:"#0b0b10"}}>{l}</option>)} </select> </div> <div className="mt-4 rounded-xl border border-[color:var(--line)] bg-white/[0.02] p-3 md:p-4 flex items-start md:items-center justify-between gap-3 flex-wrap"> <div className="flex items-start gap-3 min-w-0"> <span className="w-8 h-8 shrink-0 rounded-lg bg-white/10 flex items-center justify-center">{I.spark({size:14})}</span> <div className="min-w-0"> <div className="text-sm font-semibold">Generate brief & outline</div> <div className="text-[12px] text-[color:var(--muted)]"> {willUseCloud ? ("Uses Claude via your configured proxy (" + providerId + "). Returns a structured brief and populates your scenes.") : ("Runs a local outline from your prompt. Configure an Anthropic proxy in Settings to use Claude.")} </div> <div className="text-[11px] mt-1 text-[color:var(--muted)]"> Source length: <span className={sourceLen ? "text-white" : "text-rose-300"}>{sourceLen}</span> chars · Provider: <span className="text-white">{providerId}{willUseCloud ? "" : " (local fallback)"}</span> </div> </div> </div> <div className="flex items-center gap-2"> <button type="button" onClick={runBrief} disabled={busy || !sourceLen} className={"btn " + (busy || !sourceLen ? "opacity-60 cursor-not-allowed" : "btn-primary")}> {I.spark({size:14})} {busy ? "Working…" : "Generate brief & outline"} </button> <button type="button" onClick={()=>setProject({ ...project, source: "Most people think an espresso has more caffeine than a brewed coffee. It does not. A single espresso shot is about 63mg. A typical 12oz brewed coffee is 120-180mg. The surprise is volume — espresso concentrates caffeine into a smaller sip, but you drink less of it. This matters if you care about sleep, anxiety, or how long you stay alert." })} className="btn btn-ghost text-xs"> Try with sample brief </button><button type="button" onClick={()=> onAdvance && onAdvance()} className="btn btn-ghost text-xs"> Skip — edit manually </button> </div> </div> {(diag || err) && ( <div className="mt-3 text-[12px] flex flex-col gap-1"> {diag && !err && <div className="text-[color:var(--muted)]">{diag}</div>} {err && <div className="text-rose-300">Error: {err}</div>} </div> )} </div> );}
const fetchWithRetry = async (url, init, opts) => {
  const max = (opts && opts.max) || 3;
  const baseMs = (opts && opts.baseMs) || 600;
  let lastErr = null;
  for(let i=0; i<max; i++){
    try {
      const res = await fetch(url, init);
      if((res.status === 429 || res.status >= 500) && i < max - 1){
        const delay = baseMs * Math.pow(2, i) + Math.floor(Math.random()*250);
        console.warn('[zs] fetchWithRetry HTTP ' + res.status + ' attempt ' + (i+1) + '/' + max + ' sleeping ' + delay + 'ms');
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch(err){
      lastErr = err;
      if(i === max - 1) throw err;
      const delay = baseMs * Math.pow(2, i) + Math.floor(Math.random()*250);
      console.warn('[zs] fetchWithRetry network err attempt ' + (i+1) + '/' + max + ' sleeping ' + delay + 'ms:', err && err.message || err);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
};
const researchViaClaude = async (proxyUrl, sourceText) => {
  const url = (proxyUrl || "").replace(/\/$/, "") + "/v1/messages";
  const system = "You are a research assistant for short-form video. Read the user's source text and extract 4-6 verifiable claims, each with a plausible source handle (URL, author, publication, or study name). Score confidence 0.5-0.95 based on how specific and verifiable the claim is. Return strict JSON via the emit_research tool only.";
  const tool = { name: "emit_research", description: "Emit structured research notes for a short-form video.", input_schema: { type: "object", properties: { claims: { type: "array", description: "4-6 research claims.", items: { type: "object", properties: { claim: { type: "string", description: "Concrete claim, 1-2 sentences, max 240 chars." }, source: { type: "string", description: "Source attribution: URL, author, publication, or study name." }, confidence: { type: "number", description: "0.5-0.95 confidence score." } }, required: ["claim","source","confidence"] } } }, required: ["claims"] } };
  const body = { model: "claude-haiku-4-5-20251001", max_tokens: 1500, system, tools: [tool], tool_choice: { type: "tool", name: "emit_research" }, messages: [ { role: "user", content: "SOURCE:\n" + String(sourceText || "").slice(0, 6000) } ] };
  const res = await fetchWithRetry(url, { method: "POST", headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) });
  const ct = res.headers.get("content-type") || "";
  const raw = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) { const msg = "Claude research error: " + (typeof raw === "string" ? raw.slice(0, 200) : JSON.stringify(raw).slice(0, 200)); throw new Error(msg); }
  const blocks = raw.content || [];
  const toolBlock = blocks.find(b => b.type === "tool_use" && b.name === "emit_research");
  if (!toolBlock || !toolBlock.input) throw new Error("Claude did not return research via tool_use");
  return toolBlock.input;
};
const researchLocal = (sourceText) => {
  const txt = String(sourceText || "").trim();
  if (!txt) return { claims: [] };
  const sentences = txt.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 30 && s.length < 240);
  const picked = sentences.slice(0, 5);
  if (picked.length === 0) { const trimmed = txt.slice(0, 200); return { claims: [{ claim: trimmed, source: "User-provided source text", confidence: 0.7 }] }; }
  return { claims: picked.map((s, i) => ({ claim: s, source: i === 0 ? "Primary source excerpt" : ("Supporting passage " + (i+1)), confidence: Math.max(0.55, 0.85 - i * 0.05) })) };
};
const isYouTubeUrl = (s) => /(?:youtube\.com\/(?:watch|shorts|embed)|youtu\.be\/)/i.test(String(s||''));
const getProxyBase = () => {
  try {
    const providers = JSON.parse(localStorage.getItem('zaidsaid.v2.providers')||'{}');
    for(const v of Object.values(providers||{})){
      if(v && v.proxyUrl){
        const u = String(v.proxyUrl);
        const m = u.match(/^(https?:\/\/[^\/]+)/i);
        if(m) return m[1];
      }
    }
  } catch(_){}
  return '';
};
const fetchYouTubeTranscript = async (urlOrId) => {
  const base = getProxyBase();
  if(!base) throw new Error('No proxy base configured');
  const endpoint = base + '/youtube-transcript?v=' + encodeURIComponent(String(urlOrId||''));
  const res = await fetch(endpoint);
  const ct = res.headers.get('content-type') || '';
  const raw = ct.includes('application/json') ? await res.json() : await res.text();
  if(!res.ok){
    const detail = typeof raw === 'string' ? raw : (raw && raw.error) || JSON.stringify(raw);
    throw new Error('Transcript HTTP ' + res.status + ' ' + String(detail).slice(0,200));
  }
  return raw;
};
// ===== MVP Helpers (B-G): module-scope so all components can use them =====

// Generic Anthropic call helper that mirrors callAnthropic but lives at module scope.
const mvpCallClaude = async (proxyUrl, messages, opts) => {
  const url = (proxyUrl || '').replace(/\/$/, '') + '/v1/messages';
  const body = { model: (opts && opts.model) || 'claude-haiku-4-5-20251001', max_tokens: (opts && opts.max_tokens) || 1024, messages };
  if (opts && opts.system) body.system = opts.system;
  if (opts && opts.tools) body.tools = opts.tools;
  if (opts && opts.tool_choice) body.tool_choice = opts.tool_choice;
  const res = await fetchWithRetry(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  if(!res.ok){ const t = await res.text().catch(()=>'') ; throw new Error('Claude HTTP '+res.status+' '+t.slice(0,200)); }
  return res.json();
};

// MVP-F: Real Repurpose Analyze via Claude
const analyzeViaClaude = async (proxyUrl, sourceText, targetCount) => {
  const tools = [{ name:'emit_clips', description:'Return short-form clips extracted from the source transcript or description.', input_schema:{ type:'object', properties:{ clips:{ type:'array', items:{ type:'object', properties:{ title:{type:'string'}, hook:{type:'string'}, caption:{type:'string'}, start:{type:'number'}, end:{type:'number'}, virality:{type:'number'}, preset:{type:'string', enum:['vertical','square','wide']} }, required:['title','hook','caption','start','end','virality','preset'] } } }, required:['clips'] } }];
  const sys = 'You are a video repurposing analyst. Given long-form source content, identify the highest-virality short-form clips. Return ONLY via the emit_clips tool. Pick around the requested target count. Score virality 0-100. Use seconds for start/end. Pick preset based on platform fit.';
  const userMsg = 'Target clip count: ' + (targetCount||5) + '\n\nSource:\n' + (sourceText||'').slice(0, 6000);
  const j = await mvpCallClaude(proxyUrl, [{role:'user', content:userMsg}], { system:sys, tools, tool_choice:{type:'tool', name:'emit_clips'}, max_tokens:2048 });
  const tu = (j.content||[]).find(b => b.type==='tool_use' && b.name==='emit_clips');
  if(!tu || !tu.input || !Array.isArray(tu.input.clips)) throw new Error('No emit_clips tool_use in response');
  return tu.input.clips.map((c,i) => ({ id:'c'+(i+1), title:String(c.title||'Untitled clip').slice(0,140), hook:String(c.hook||'').slice(0,200), caption:String(c.caption||'').slice(0,300), start:Number(c.start)||0, end:Number(c.end)||(Number(c.start)||0)+30, virality:Math.max(0,Math.min(100,Math.round(Number(c.virality)||60))), preset:['vertical','square','wide'].includes(c.preset)?c.preset:'vertical', status:'draft' }));
};

// MVP-F: Local fallback — extract sentences, rank by length+keywords, mock timecodes.
const analyzeLocal = (sourceText, targetCount) => {
  const text = String(sourceText||'').trim();
  if(!text) return [];
  const sents = text.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>30);
  const HOOKS = /\b(why|how|secret|truth|nobody|everyone|the one|never|always|biggest|worst|best|stop|start|hidden|surprising)\b/i;
  const scored = sents.map((s,i) => ({ s, i, score: Math.min(100, Math.round(50 + Math.min(20, s.length/8) + (HOOKS.test(s)?20:0) + (i<5?5:0))) }));
  scored.sort((a,b)=>b.score-a.score);
  const top = scored.slice(0, Math.max(1, Math.min(8, targetCount||5)));
  return top.map((row,i) => { const t = row.s; const start = 60 + i*180; return { id:'c'+(i+1), title: t.slice(0,90), hook: t.split(/[,;:]/)[0].slice(0,140), caption: t.slice(0,200), start, end: start+30+(i%3)*5, virality: row.score, preset: i%3===0?'vertical':(i%3===1?'square':'wide'), status:'draft' }; });
};

// MVP-B: Polish a Studio script scene via Claude
const polishSceneViaClaude = async (proxyUrl, scene, brief) => {
  const tools = [{ name:'emit_scene', description:'Return a polished version of the scene.', input_schema:{ type:'object', properties:{ title:{type:'string'}, voLine:{type:'string'}, beat:{type:'string'} }, required:['title','voLine'] } }];
  const sys = 'You polish individual video scenes. Tighten the VO line for spoken delivery (12-22 words), keep the title punchy (<=8 words). Return ONLY via emit_scene.';
  const userMsg = 'Brief: ' + (brief||'').slice(0,400) + '\n\nScene title: ' + (scene.title||'') + '\nCurrent VO: ' + (scene.voLine||scene.line||'') + '\nBeat: ' + (scene.beat||'');
  const j = await mvpCallClaude(proxyUrl, [{role:'user',content:userMsg}], { system:sys, tools, tool_choice:{type:'tool', name:'emit_scene'} });
  const tu = (j.content||[]).find(b=>b.type==='tool_use' && b.name==='emit_scene');
  if(!tu || !tu.input) throw new Error('No emit_scene tool_use');
  return { title: String(tu.input.title||scene.title||'').slice(0,80), voLine: String(tu.input.voLine||'').slice(0,400), beat: String(tu.input.beat||scene.beat||'').slice(0,80) };
};

const polishSceneLocal = (scene) => {
  const vo = String(scene.voLine || scene.line || scene.title || '').trim();
  const words = vo.split(/\s+/);
  const tightened = words.length > 22 ? words.slice(0,22).join(' ') + '.' : vo;
  const title = String(scene.title||'').split(/\s+/).slice(0,8).join(' ');
  return { title: title || 'Scene', voLine: tightened, beat: scene.beat||'' };
};

// MVP-C: Generate image via Stability
const generateImageViaStability = async (proxyUrl, prompt, opts) => {
  const url = (proxyUrl||'').replace(/\/$/,'') + '/v2beta/stable-image/generate/core';
  const fd = new FormData();
  fd.append('prompt', String(prompt||'cinematic establishing shot').slice(0,1500));
  fd.append('output_format', 'png');
  fd.append('aspect_ratio', (opts && opts.aspect_ratio) || '16:9');
  const res = await fetchWithRetry(url, { method:'POST', headers:{'accept':'image/*'}, body: fd });
  if(!res.ok){ const t = await res.text().catch(()=>'') ; throw new Error('Stability HTTP '+res.status+' '+t.slice(0,200)); }
  const blob = await res.blob();
  return await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(blob); });
};
const generateImageViaPollinations = async (proxyUrl, prompt, opts) => {
  const w = (opts && opts.w) || 1280; const h = (opts && opts.h) || 720;
  const _cineTokens = ', cinematic lighting, shallow depth of field, 35mm film, high detail, photorealistic, 8k';
  const _rawPrompt = String(prompt||'cinematic establishing shot');
  const _finalPrompt = (_rawPrompt.includes('cinematic') ? _rawPrompt : _rawPrompt + _cineTokens).slice(0, 400);
  const base = (proxyUrl||'').replace(/\/$/,'') + '/prompt/' + encodeURIComponent(_finalPrompt) + '?width=' + w + '&height=' + h + '&nologo=true&model=';
  const tryOnce = async (model, ms) => {
    const c = new AbortController(); const t = setTimeout(()=>c.abort(), ms);
    try {
      const res = await fetch(base + model, { method:'GET', headers:{'accept':'image/*'}, signal: c.signal });
      if(!res.ok) throw new Error('Pollinations ' + model + ' HTTP ' + res.status);
      const blob = await res.blob();
      return await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(blob); });
    } finally { clearTimeout(t); }
  };
  try { return await tryOnce('flux', 25000); }
  catch(e){ return await tryOnce('turbo', 20000); }
}

// MVP-C: Local SVG fallback (deterministic from prompt)
const generateImageLocal = (prompt, opts) => {
  const w = (opts && opts.w) || 1280; const h = (opts && opts.h) || 720;
  const seed = String(prompt||'').split('').reduce((a,c)=>((a<<5)-a + c.charCodeAt(0))|0, 0);
  const hue1 = Math.abs(seed) % 360; const hue2 = (hue1 + 60) % 360;
  const label = String(prompt||'Scene').slice(0,40).replace(/[<>&'\"]/g,'');
  const svg = '<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'' + w + '\' height=\'' + h + '\' viewBox=\'0 0 ' + w + ' ' + h + '\'>' +
    '<defs><linearGradient id=\'g\' x1=\'0\' y1=\'0\' x2=\'1\' y2=\'1\'><stop offset=\'0\' stop-color=\'hsl(' + hue1 + ',60%,28%)\'/><stop offset=\'1\' stop-color=\'hsl(' + hue2 + ',70%,18%)\'/></linearGradient></defs>' +
    '<rect width=\'100%\' height=\'100%\' fill=\'url(#g)\'/>' +
    '<text x=\'50%\' y=\'50%\' fill=\'rgba(255,255,255,0.85)\' font-family=\'system-ui,sans-serif\' font-size=\'42\' text-anchor=\'middle\' dominant-baseline=\'middle\'>' + label + '</text>' +
    '</svg>';
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
};

// MVP-D: TTS via ElevenLabs
const ttsViaElevenLabs = async (proxyUrl, text, voiceId) => {
  const vid = voiceId || 'EXAVITQu4vr4xnSDxMaL';
  const url = (proxyUrl||'').replace(/\/$/,'') + '/v1/text-to-speech/' + encodeURIComponent(vid);
  const res = await fetchWithRetry(url, { method:'POST', headers:{'content-type':'application/json','accept':'audio/mpeg'}, body: JSON.stringify({ text: String(text||'').slice(0,2000), model_id:'eleven_turbo_v2_5', voice_settings:{ stability:0.5, similarity_boost:0.75 } }) });
  if(!res.ok){ const t = await res.text().catch(()=>'') ; throw new Error('ElevenLabs HTTP '+res.status+' '+t.slice(0,200)); }
  const blob = await res.blob();
  return await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(blob); });
};

// MVP-D: Local TTS fallback via SpeechSynthesis (returns null — caller plays live)
const ttsLocal = (text) => {
  return new Promise((resolve, reject) => {
    try {
      if(!('speechSynthesis' in window)){ reject(new Error('SpeechSynthesis not available')); return; }
      const u = new SpeechSynthesisUtterance(String(text||'').slice(0,2000));
      u.rate = 1.0; u.pitch = 1.0;
      u.onend = () => resolve('local-played');
      u.onerror = (e) => reject(new Error('TTS error: ' + (e.error||'unknown')));
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch(e){ reject(e); }
  });
};

// MVP-G: Multi-provider health ping (returns array of {name, ok, ms, err})
const pingProviders = async (providers) => {
  const results = [];
  for (const p of providers) {
    if(!p.proxyUrl){ results.push({ name: p.name, ok:false, ms:0, err:'no proxy URL configured' }); continue; }
    const t0 = performance.now();
    try {
      const u = (p.proxyUrl||'').replace(/\/$/, '') + '/ping';
      const res = await fetch(u, { method:'GET' });
      const ms = Math.round(performance.now() - t0);
      results.push({ name: p.name, ok: res.ok, ms, status: res.status, err: res.ok ? '' : ('HTTP ' + res.status) });
    } catch(e){ const ms = Math.round(performance.now() - t0); results.push({ name: p.name, ok:false, ms, err: String(e && e.message || e).slice(0,140) }); }
  }
  return results;
};

// ===== End MVP Helpers =====




function StudioPipelineSimulator({ project, setProject }){
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(-1);
  const timersRef = useRef([]);
  useEffect(()=>()=>{ timersRef.current.forEach(clearTimeout); timersRef.current = []; }, []);
  const start = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRunning(true);
    setProgress(0);
    setStageIdx(0);
    let elapsed = 0;
    const total = STUDIO_PIPELINE_STAGES.reduce((a,s)=>a+s.ms, 0);
    STUDIO_PIPELINE_STAGES.forEach((s, i) => {
      elapsed += s.ms;
      const t = setTimeout(() => {
        setStageIdx(i+1);
        setProgress(Math.min(100, Math.round((elapsed/total)*100)));
        if(i === STUDIO_PIPELINE_STAGES.length - 1){
          setRunning(false);
        }
      }, elapsed);
      timersRef.current.push(t);
    });
  };
  const reset = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRunning(false);
    setProgress(0);
    setStageIdx(-1);
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Pipeline simulator</div>
          <div className="text-lg font-semibold">Watch Zaidsaid work the steps</div>
          <div className="text-[12px] text-[color:var(--muted)] mt-1">Demo simulator. Real generation lives in Studio (Script polish, Visuals, Voiceover, Render) and Repurpose (real Analyze).</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={start} disabled={running}>{running ? "Running…" : "Run simulation"}</button>
          <button className="btn btn-ghost" onClick={reset} disabled={running && stageIdx < STUDIO_PIPELINE_STAGES.length}>Reset</button>
        </div>
      </div>
      <div className="mt-4">
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full transition-all duration-500" style={{width: progress + "%", background:"linear-gradient(90deg,#6366f1,#22d3ee)"}} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[color:var(--muted)]">
          <span>{progress}%</span>
          <span>{stageIdx >= STUDIO_PIPELINE_STAGES.length ? "Complete" : (running ? "Working…" : (stageIdx < 0 ? "Idle" : "Paused"))}</span>
        </div>
      </div>
      <div className="mt-4 grid md:grid-cols-3 gap-2">
        {STUDIO_PIPELINE_STAGES.map((s, i) => {
          const state = i < stageIdx ? "done" : (i === stageIdx && running ? "active" : "pending");
          return (
            <div key={s.k}
              className={"rounded-xl border p-3 text-[12px] transition-colors " +
                (state==="done" ? "border-white/15 bg-white/[0.04] text-white" :
                 state==="active" ? "border-white/20 bg-white/[0.08] text-white" :
                 "border-[color:var(--line)] text-[color:var(--muted)]")}>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                  style={{background: state==="done" ? "linear-gradient(135deg,#6366f1,#22d3ee)" : (state==="active" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)")}}>
                  {state==="done" ? I.check({size:12}) : (i+1)}
                </span>
                <span className="font-semibold">{s.label}</span>
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--muted)]">{s.ms} ms</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SceneCard({ scene, onField, onRegen, onMove, onRemove, index, total }){
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="chip">Scene {index+1}</span>
        <input
          value={scene.title}
          onChange={(e)=>onField("title", e.target.value)}
          className="bg-transparent border border-[color:var(--line)] rounded-lg px-2 py-1 text-[13px] focus:outline-none focus:border-white/20 min-w-[120px]"
          aria-label="Scene title"
        />
        <span className="chip">{scene.duration}s</span>
        <div className="ml-auto flex items-center gap-1">
          <button className="chip" onClick={()=>onMove(-1)} disabled={index===0} aria-label="Move up">{I.up({size:12})}</button>
          <button className="chip" onClick={()=>onMove(1)} disabled={index===total-1} aria-label="Move down">{I.down({size:12})}</button>
          <button className="chip" onClick={onRemove} aria-label="Remove scene">{I.x({size:12})}</button>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">VO line</span>
          <textarea
            value={scene.voLine}
            onChange={(e)=>onField("voLine", e.target.value)}
            rows={2}
            className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-lg p-2 text-sm focus:outline-none focus:border-white/20"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-[color:var(--muted)]">Read time {(scene.voLine||"").split(/\s+/).filter(Boolean).length} words</span>
            <button className="chip" onClick={()=>onRegen("voLine")}>{I.refresh({size:12})} Regenerate</button>
          </div>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Shot</span>
          {scene.shot&&<img src={`https://zaidsaid-proxy.zaidsaid.workers.dev/pollinations/prompt/${encodeURIComponent(scene.shot)}?width=640&height=360&nologo=true&model=turbo`} alt="storyboard" className="w-full rounded-lg mt-1 mb-1" style={{aspectRatio:'16/9',objectFit:'cover'}}/>}
          <textarea
            value={scene.shot}
            onChange={(e)=>onField("shot", e.target.value)}
            rows={2}
            className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-lg p-2 text-sm focus:outline-none focus:border-white/20"
          />
          <div className="flex items-center justify-end mt-1">
            <button className="chip" onClick={()=>onRegen("shot")}>{I.refresh({size:12})} Regenerate</button>
          </div>
        </label>
      </div>
      <div className="grid md:grid-cols-3 gap-3 mt-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Motion</span>
          <input value={scene.motion} onChange={(e)=>onField("motion", e.target.value)}
            className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-lg p-2 text-sm focus:outline-none focus:border-white/20"/>
          <div className="flex justify-end mt-1"><button className="chip" onClick={()=>onRegen("motion")}>{I.refresh({size:12})} Regenerate</button></div>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Asset</span>
          <input value={scene.asset} onChange={(e)=>onField("asset", e.target.value)}
            className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-lg p-2 text-sm focus:outline-none focus:border-white/20"/>
          <div className="flex justify-end mt-1"><button className="chip" onClick={()=>onRegen("asset")}>{I.refresh({size:12})} Regenerate</button></div>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Captions</span>
          <input value={scene.captions} onChange={(e)=>onField("captions", e.target.value)}
            className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-lg p-2 text-sm focus:outline-none focus:border-white/20"/>
          <div className="flex justify-end mt-1"><button className="chip" onClick={()=>onRegen("captions")}>{I.refresh({size:12})} Regenerate</button></div>
        </label>
      </div>
    </div>
  );
}

function StepResearch({ project, setProject, setStudioStep }){ const toast = useToast(); const regenClaim = (id) => { const variations = [ "Tighter framing of the same evidence.", "Cross-referenced a second source.", "Narrowed the scope to keep it on-topic.", "Restated as a hook-friendly claim.", ]; setProject({ ...project, research: project.research.map(r => r.id===id ? { ...r, claim: (r.claim + " — " + variations[Math.floor(Math.random()*variations.length)]).slice(0,180), confidence: Math.min(0.99, (r.confidence||0.8) + 0.01) } : r), }); }; const [researchBusy, setResearchBusy] = useState(false);
  const [researchSource, setResearchSource] = useState("");
  const [researchError, setResearchError] = useState("");
  const runResearch = async () => {
    console.log("[zs] runResearch invoked");
    if (researchBusy) { console.log("[zs] researchBusy=true, early return"); return; }
    let text = String((project && project.source) || "").trim();
    if(isYouTubeUrl(text)){
      try {
        console.log("[zs] detected YouTube URL, fetching transcript");
        const yt = await fetchYouTubeTranscript(text);
        const tText = String((yt && yt.transcript) || "").trim();
        if(tText.length > 50){
          text = (yt.title ? ("Title: " + yt.title + "\n") : "") + (yt.author ? ("Channel: " + yt.author + "\n") : "") + "Transcript:\n" + tText;
          console.log("[zs] transcript loaded, length", tText.length);
        }
      } catch(err){
        console.warn("[zs] transcript fetch failed — proceeding with URL as source:", err && err.message || err);
      }
    }
    console.log("[zs] source text length:", text.length);
    if (!text) { setResearchError("Paste or fetch source text first"); return; }
    setResearchBusy(true); setResearchSource(""); setResearchError("");
    const path = getAnthropicPath();
    console.log("[zs] anthropic path configured:", !!path);
    try {
      let notes = null;
      if (path) {
        console.log("[zs] calling researchViaClaude");
        notes = await researchViaClaude(path, text);
        setResearchSource("claude");
      } else {
        console.log("[zs] calling researchLocal");
        notes = researchLocal(text);
        setResearchSource("local");
      }
      const rawClaims = (notes && notes.claims) || [];
      console.log("[zs] notes returned, claim count:", rawClaims.length);
      const claims = rawClaims.map((c, i) => ({
        id: "r" + (i+1) + "_" + Math.random().toString(36).slice(2,6),
        claim: String((c && c.claim) || "").slice(0, 240),
        source: String((c && c.source) || "Source pending").slice(0, 140),
        confidence: Math.max(0.5, Math.min(0.99, Number(c && c.confidence) || 0.75))
      }));
      console.log("[zs] setting project.research with", claims.length, "claims");
      setProject({ ...project, research: claims });
    } catch (err) {
      console.error("[zs] runResearch error:", err);
      setResearchError(String(err && err.message || err));
    } finally {
      setResearchBusy(false);
    }
  };
  const addClaim = () => { const nid = "r" + (project.research.length + 1) + "_" + Math.random().toString(36).slice(2,6); setProject({ ...project, research: [...project.research, { id: nid, claim:"New claim — edit me.", source:"Pending source", confidence: 0.7 }], }); }; const advanceToScript = () => { if (setStudioStep) setStudioStep("script"); }; const updateBrief = (field, value) => { setProject({ ...project, [field]: value }); }; const copyBrief = () => { const parts = [ project.logline && ("Logline: " + project.logline), project.hook && ("Hook: " + project.hook), project.audience && ("Audience: " + project.audience), project.angle && ("Angle: " + project.angle), project.cta && ("CTA: " + project.cta), ].filter(Boolean).join("\n"); if (!parts){ toast.push("Nothing to copy yet","warn"); return; } try { navigator.clipboard.writeText(parts); toast.push("Brief copied to clipboard","success"); } catch(_){ toast.push("Copy failed — select manually","error"); } }; return ( <div className="flex flex-col gap-4"> <StudioInputAccepter project={project} setProject={setProject} onAdvance={advanceToScript} toast={toast} /> <StudioPipelineSimulator project={project} setProject={setProject} /> <div className="card p-5"> <div className="flex items-center justify-between gap-2 flex-wrap"> <div> <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Creative brief</div> <div className="text-lg font-semibold">Logline, hook & angle</div> </div> <div className="flex items-center gap-2"> <button className="btn" onClick={copyBrief}>{I.copy({size:14})} Copy</button> </div> </div> <div className="mt-3 grid md:grid-cols-2 gap-3"> <label className="flex flex-col gap-1"> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Logline</span> <textarea className="w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm" rows={2} value={project.logline||""} onChange={(e)=>updateBrief("logline", e.target.value)} placeholder="A one-sentence promise of the video." /> </label> <label className="flex flex-col gap-1"> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Hook</span> <textarea className="w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm" rows={2} value={project.hook||""} onChange={(e)=>updateBrief("hook", e.target.value)} placeholder="First three seconds pattern interrupt." /> </label> <label className="flex flex-col gap-1"> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Audience</span> <textarea className="w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm" rows={2} value={project.audience||""} onChange={(e)=>updateBrief("audience", e.target.value)} placeholder="Who this is for." /> </label> <label className="flex flex-col gap-1"> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Angle</span> <textarea className="w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm" rows={2} value={project.angle||""} onChange={(e)=>updateBrief("angle", e.target.value)} placeholder="Why this POV, right now." /> </label> <label className="flex flex-col gap-1 md:col-span-2"> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Call to action</span> <input className="w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm" value={project.cta||""} onChange={(e)=>updateBrief("cta", e.target.value)} placeholder="What the viewer should do next." /> </label> </div> </div> <div className="card p-5"> <div className="flex items-center justify-between gap-2 flex-wrap"> <div> <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Research</div> <div className="text-lg font-semibold">Claims & sources</div> </div> <button className="btn" onClick={runResearch} disabled={researchBusy || !(project.source||"").trim()}>{researchBusy ? "Researching…" : "Research with Claude"}</button> {researchSource && (<span className={"chip " + (researchSource === "claude" ? "text-emerald-200 !border-emerald-400/30 bg-emerald-500/10" : "text-sky-200 !border-sky-400/30 bg-sky-500/10")}>{researchSource === "claude" ? "Claude" : "Local"}</span>)} <button className="btn" onClick={addClaim}>{I.plus({size:14})} Add claim</button> </div> <div className="mt-3 grid md:grid-cols-2 gap-3"> {project.research.map(r => ( <div key={r.id} className="rounded-xl border border-[color:var(--line)] p-3"> <div className="text-sm text-white">{r.claim}</div> <div className="text-[11px] text-[color:var(--muted)] mt-1">{r.source}</div> <div className="flex items-center justify-between mt-2"> <span className="chip">Confidence {Math.round((r.confidence||0)*100)}%</span> <button className="chip" onClick={()=>regenClaim(r.id)}>{I.refresh({size:12})} Regenerate</button> </div> </div> ))} </div> </div> </div> );}

function StepScript({ project, setProject }){
  const _scriptToast = useToast();
  const scriptToast = (_scriptToast && typeof _scriptToast.push === "function") ? _scriptToast.push : null;
  const scriptText = project.scenes.map((s,i) => "Scene " + (i+1) + " — " + s.title + "\n" + (s.voLine || s.script || "")).join("\n\n");
  const onChange = (e) => {
    const blocks = e.target.value.split(/\n\n+/);
    const next = project.scenes.map((s, i) => {
      const blk = blocks[i] || "";
      const lines = blk.split(/\n/);
      const header = (lines[0]||"").replace(/^Scene\s*\d+\s*—\s*/i, "");
      const body = lines.slice(1).join(" ").trim();
      return { ...s, title: header || s.title, voLine: body || s.voLine, script: body || s.script };
    });
    setProject({ ...project, scenes: next });
  };
  const regenerateAll = () => {
    const next = project.scenes.map(s => ({ ...s, voLine: s.voLine + " " + sceneRegenerateBlurbs("voLine") }));
    setProject({ ...project, scenes: next });
  };  const _rawToast = useToast(); const toast = (_rawToast && typeof _rawToast.push === "function") ? _rawToast : { push: () => {} };
  const [rewriting, setRewriting] = useState(false);
  const getProxyForScript = () => {
    let picks = {}; try { picks = JSON.parse(localStorage.getItem("zaidsaid.v2.arch.picks") || "{}"); } catch(_){}
    const providerId = picks["script"] || (typeof PIPELINE_STAGES !== "undefined" ? (PIPELINE_STAGES.find(x => x.id === "script") || {}).provider : null);
    const p = (typeof PROVIDERS !== "undefined") ? (PROVIDERS.find(x => x.id === providerId) || null) : null;
    return (p && p.proxyUrl) ? p.proxyUrl : "";
  };
  const localRewrite = (text, tone) => {
    const t = (text || "").trim();
    if (!t) return t;
    const map = {
      urgent: (s) => s.replace(/\.(\s|$)/g, "!$1").replace(/^/, "Right now — "),
      calm: (s) => s.replace(/!+/g, ".").replace(/^/, "Here is what matters: "),
      funny: (s) => s.replace(/\.(\s|$)/g, " — and yes, really.$1"),
      tighter: (s) => { const w = s.split(/\s+/); return w.slice(0, Math.max(6, Math.floor(w.length * 0.6))).join(" ") + (w.length > 6 ? "." : ""); },
      simpler: (s) => s.replace(/\b([A-Z][a-z]{7,})\b/g, (m) => m.slice(0,6).toLowerCase()),
      punchy: (s) => { const w = s.split(/\s+/); return w.map((x,i)=> i === 0 ? x.toUpperCase() : x).join(" "); }
    };
    const fn = map[tone] || ((x)=>x);
    return fn(t).slice(0, 280);
  };
  const callAnthropicRewrite = async (proxyUrl, voLine, tone, sceneTitle) => {
    const url = proxyUrl.replace(/\/$/, "") + "/v1/messages";
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 512, tool_choice: { type: "tool", name: "rewrite_vo" }, tools: [{ name: "rewrite_vo", description: "Rewrite a voiceover line in the requested tone.", input_schema: { type: "object", properties: { voLine: { type: "string", description: "Rewritten voiceover line, 1-2 sentences, same meaning." } }, required: ["voLine"] } }], messages: [{ role: "user", content: "Scene title: " + (sceneTitle || "") + "\nCurrent VO: " + voLine + "\nRewrite this VO in a '" + tone + "' tone. Same meaning, keep it under 30 words." }] }) });
    if (!res.ok) throw new Error("proxy " + res.status);
    const data = await res.json();
    const tool = (data.content || []).find(c => c.type === "tool_use");
    if (!tool || !tool.input || !tool.input.voLine) throw new Error("no tool_use");
    return String(tool.input.voLine).slice(0, 280);
  };
    const [polishing, setPolishing] = React.useState(false);
  const polishEachScene = async () => {
    if(polishing) return;
    const scenes = (project && project.scenes) || [];
    if(!scenes.length){ toast.push('No scenes to polish.', 'error'); return; }
    setPolishing(true);
    const path = getAnthropicPath();
    const brief = (project && (project.brief || project.idea || project.title)) || '';
    const next = [];
    let usedClaude = 0, usedLocal = 0;
    for(const s of scenes){
      try {
        if(path){
          const out = await polishSceneViaClaude(path, s, brief);
          next.push({ ...s, title: out.title || s.title, voLine: out.voLine, script: out.voLine, beat: out.beat || s.beat });
          usedClaude++;
        } else {
          const out = polishSceneLocal(s);
          next.push({ ...s, title: out.title || s.title, voLine: out.voLine, script: out.voLine, beat: out.beat || s.beat });
          usedLocal++;
        }
      } catch(e){
        const out = polishSceneLocal(s);
        next.push({ ...s, title: out.title || s.title, voLine: out.voLine, script: out.voLine, beat: out.beat || s.beat });
        usedLocal++;
      }
    }
    setProject({ ...project, scenes: next });
    toast.push('Polished ' + next.length + ' scenes (' + usedClaude + ' via Claude, ' + usedLocal + ' local).', 'success');
    setPolishing(false);
  };

  const rewriteAllScenesWithTone = async (tone) => {
    if (rewriting) return;
    setRewriting(true);
    const proxy = getProxyForScript();
    try {
      const next = [];
      for (const s of project.scenes) {
        const src = s.voLine || s.script || "";
        let out = src;
        try { out = proxy ? await callAnthropicRewrite(proxy, src, tone, s.title) : localRewrite(src, tone); }
        catch (e) { out = localRewrite(src, tone); }
        next.push({ ...s, voLine: out, script: out });
      }
      setProject({ ...project, scenes: next });
      toast.push("Rewrote " + next.length + " scenes (" + tone + ")" + (proxy ? "" : " — local fallback"), "success");
    } catch (e) { toast.push("Rewrite failed: " + (e && e.message || e), "error"); }
    finally { setRewriting(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      {!isGodMode && (
        <StudioInputAccepter project={project} setProject={setProject} onAdvance={() => { try { window.dispatchEvent(new CustomEvent('zs:advance-step', { detail: { from: 'script' } })); } catch(_){} }} toast={scriptToast} />
      )}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Script</div>
            <div className="text-lg font-semibold">Tight, spoken draft</div>
          </div>
          <button className="btn" onClick={regenerateAll}>{I.refresh({size:14})} Regenerate all</button>
        </div>        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Rewrite with tone</span>
          {["urgent","calm","funny","tighter","simpler","punchy"].map(t => (
            <button key={t} className="chip" disabled={rewriting} onClick={()=>rewriteAllScenesWithTone(t)} aria-busy={rewriting}>{t}</button>
          ))}
          <button className="chip" disabled={polishing} onClick={polishEachScene} aria-busy={polishing}>{polishing ? 'polishing…' : 'polish each scene'}</button>
          {rewriting && <span className="text-[11px] text-[color:var(--muted)]">rewriting…</span>}
        </div>

        <textarea
          value={scriptText}
          onChange={onChange}
          rows={14}
          className="mt-3 w-full bg-transparent border border-[color:var(--line)] rounded-xl p-3 text-sm focus:outline-none focus:border-white/20 font-mono"
        />
        <div className="text-[11px] text-[color:var(--muted)] mt-2">
          Split scenes with a blank line. First line is the scene title; the rest is the VO.
        </div>
      </div>
    </div>
  );
}

function sceneFieldSetter(project, setProject){
  return (sceneId, field, value) => {
    setProject({ ...project, scenes: project.scenes.map(s => s.id===sceneId ? { ...s, [field]: value } : s) });
  };
}
function sceneMover(project, setProject){
  return (sceneId, delta) => {
    const idx = project.scenes.findIndex(s => s.id === sceneId);
    if(idx < 0) return;
    const next = idx + delta;
    if(next < 0 || next >= project.scenes.length) return;
    const scenes = project.scenes.slice();
    const [item] = scenes.splice(idx, 1);
    scenes.splice(next, 0, item);
    setProject({ ...project, scenes });
  };
}
function sceneRemover(project, setProject){
  return (sceneId) => {
    if(project.scenes.length <= 1) return;
    setProject({ ...project, scenes: project.scenes.filter(s => s.id !== sceneId) });
  };
}
function sceneRegenSetter(project, setProject){
  return (sceneId, field) => {
    if (field === "shot") {
      const sc = project.scenes.find(s => s.id === sceneId);
      const prompt = sc ? (sc.title + ": " + (sc.voLine || sc.script || "").split(/[.!?]/)[0].trim()) : "cinematic shot";
      setProject({ ...project, scenes: project.scenes.map(s => s.id===sceneId ? { ...s, shot: prompt } : s) });
      return;
    }
    setProject({
      ...project,
      scenes: project.scenes.map(s => s.id===sceneId ? { ...s, [field]: (s[field] || "") + " " + sceneRegenerateBlurbs(field) } : s),
    });
  };
}

function StepStoryboard({ project, setProject }){
  const setField = sceneFieldSetter(project, setProject);
  const move = sceneMover(project, setProject);
  const remove = sceneRemover(project, setProject);
  const regen = sceneRegenSetter(project, setProject);
  const [imgBusy, setImgBusy] = React.useState(false);
  const [imgErr, setImgErr] = React.useState('');
  const [imgInfo, setImgInfo] = React.useState('');
  const projectRef = React.useRef(project);
  projectRef.current = project;
  React.useEffect(() => {
    if (isGodMode) return;
    if (!imgInfo && !imgBusy) return;
    try { window.dispatchEvent(new CustomEvent('zs:progress', { detail: { message: imgInfo || (imgBusy ? 'Generating images…' : ''), busy: imgBusy } })); } catch(_){}
  }, [imgInfo, imgBusy]);
  const generateAllImages = async () => {
    if(imgBusy) return;
    const initialLen = ((projectRef.current && projectRef.current.scenes) || []).length;
    if(!initialLen){ setImgErr('No scenes to render.'); return; }
    setImgBusy(true); setImgErr(''); setImgInfo('');
    let providers = {}; try { providers = safeGet('providers', {}) || {}; } catch(e){}
    const stabPath = providers && providers.stability && providers.stability.proxyUrl;
    const polPath = providers && providers.pollinations && providers.pollinations.proxyUrl;
    let okStab=0, okPol=0, okLocal=0, guard=0;
    const seen = new Set();
    while (guard++ < 40) {
      const scenesNow = (projectRef.current && projectRef.current.scenes) || [];
      const pending = scenesNow.find(s => !seen.has(s.id) && !s.image);
      if (!pending) break;
      const sceneId = pending.id;
      seen.add(sceneId);
      const prompt = (pending.shot || pending.title || pending.voLine || 'cinematic establishing shot').slice(0,400);
      let dataUrl, source;
      let lastErr = null;
      if(stabPath){
        try { dataUrl = await generateImageViaStability(stabPath, prompt); source='stability'; okStab++; }
        catch(e){ lastErr = e; }
      }
      if(!dataUrl && polPath){
        try { dataUrl = await generateImageViaPollinations(polPath, prompt); source='pollinations'; okPol++; }
        catch(e){ lastErr = e; }
      }
      if(!dataUrl){
        dataUrl = generateImageLocal(prompt);
        source = lastErr ? 'local-svg-fallback' : 'local-svg';
        okLocal++;
      }
      setProject(prev => ({ ...prev, scenes: prev.scenes.map(x => x.id === sceneId ? { ...x, image: dataUrl, imageSource: source } : x) }));
      const total = ((projectRef.current && projectRef.current.scenes) || []).length || initialLen;
      const done = okStab + okPol + okLocal;
      setImgInfo('Generated ' + done + '/' + total + ' images…');
    }
    const finalTotal = ((projectRef.current && projectRef.current.scenes) || []).length;
    setImgInfo('Generated ' + finalTotal + ' images (' + okStab + ' via Stability, ' + okPol + ' via Pollinations, ' + okLocal + ' local SVG).');
    setImgBusy(false);
    if (!isGodMode) { try { window.dispatchEvent(new CustomEvent('zs:advance-step', { detail: { from: 'storyboard' } })); } catch(_){} }
  };
  const regenerateImageOne = async (sceneId) => {
    if(imgBusy) return;
    const scene = (project.scenes||[]).find(s => s.id === sceneId);
    if(!scene) return;
    const prompt = (scene.shot || scene.title || scene.voLine || 'cinematic establishing shot').slice(0,400);
    let providers = {}; try { providers = safeGet('providers', {}) || {}; } catch(e){}
    const stabPath = providers && providers.stability && providers.stability.proxyUrl;
    const polPath = providers && providers.pollinations && providers.pollinations.proxyUrl;
    setImgBusy(true); setImgErr(''); setImgInfo('');
    let dataUrl, source, lastErr = null;
    if(stabPath){
      try { dataUrl = await generateImageViaStability(stabPath, prompt); source = 'stability'; }
      catch(e){ lastErr = e; }
    }
    if(!dataUrl && polPath){
      try { dataUrl = await generateImageViaPollinations(polPath, prompt); source = 'pollinations'; }
      catch(e){ lastErr = e; }
    }
    if(!dataUrl){
      dataUrl = generateImageLocal(prompt);
      source = lastErr ? 'local-svg-fallback' : 'local-svg';
    }
    setProject({ ...project, scenes: project.scenes.map(s => s.id === sceneId ? { ...s, image: dataUrl, imageSource: source } : s) });
    if(lastErr && source !== 'stability' && source !== 'pollinations'){
      setImgErr('Regenerate fell back to local: ' + String(lastErr && lastErr.message || lastErr).slice(0,100));
    } else {
      setImgInfo('Regenerated image for: ' + (scene.title || 'scene') + ' (' + source + ')');
    }
    setImgBusy(false);
  };
  React.useEffect(() => {
    if (isGodMode) return;
    const scenes = project.scenes || [];
    if (!scenes.length) return;
    const hasAnyImage = scenes.some(s => s.image);
    if (hasAnyImage || imgBusy) return;
    generateAllImages();
  }, [project.scenes && project.scenes.length]);
    return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Storyboard</div>
        <div className="text-lg font-semibold">Frame the story</div>
        <div className="text-[12px] text-[color:var(--muted)] mt-1">Seeded example. Edit any field, or regenerate per scene.</div>
      </div>
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] uppercase tracking-wide text-[color:var(--muted)]">Visuals</div>
            <div className="text-lg font-semibold">Generate scene images</div>
            <div className="text-[12px] text-[color:var(--muted)] mt-1">Stability AI when configured, deterministic SVG locally otherwise. Uses each scene&apos;s shot prompt.</div>
          </div>
          <button className="btn btn-primary" onClick={generateAllImages} disabled={imgBusy}>{imgBusy ? 'Rendering…' : 'Generate all images'}</button>
        </div>
        {imgErr && <div className="mt-2 text-[12px] text-red-400">{imgErr}</div>}
        {imgInfo && <div className="mt-2 text-[12px] text-emerald-400">{imgInfo}</div>}
        {((project.scenes||[]).some(s => s.image) || imgBusy) && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {(project.scenes||[]).map((s, i) => (
              <div key={s.id||i} className="rounded-xl overflow-hidden border border-[color:var(--line)]">
                {s.image ? <img src={s.image} alt={'Scene '+(i+1)} className="w-full h-24 object-cover" /> : <div className="w-full h-24 bg-[color:var(--line)] flex items-center justify-center text-[11px] text-[color:var(--muted)] animate-pulse">{imgBusy ? 'rendering…' : 'no image'}</div>}
                {s.image && isGodMode && <button className="chip text-[10px] px-2 py-0.5 m-1" onClick={()=>regenerateImageOne(s.id)} disabled={imgBusy} title="Regenerate image">{String.fromCharCode(8635)} regen</button>}
                <div className="px-2 py-1 text-[11px] text-[color:var(--muted)] truncate">{s.title || ('Scene '+(i+1))}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-3">
        {project.scenes.map((s, i) => (
          <SceneCard key={s.id} scene={s} index={i} total={project.scenes.length}
            onField={(f,v)=>setField(s.id, f, v)}
            onRegen={(f)=>regen(s.id, f)}
            onMove={(d)=>move(s.id, d)}
            onRemove={()=>remove(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StepAssets({ project, setProject }){
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Assets</div>
        <div className="text-lg font-semibold">B-roll, stills, music</div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {project.scenes.map((s, i) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-center gap-2">
              <span className="chip">Scene {i+1}</span>
              <span className="font-semibold">{s.title}</span>
            </div>
            <div className="mt-3 h-28 rounded-xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-cyan-500 opacity-90" aria-hidden />
            <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Asset</div>
                <div className="text-sm">{s.asset}</div>
              </div>
              <div className="flex items-center gap-1">
                <span className="chip">Provenance OK</span>
                <button className="chip" onClick={()=>sceneRegenSetter(project,setProject)(s.id, "asset")}>{I.refresh({size:12})} Swap</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepMotion({ project, setProject }){
  const presets = ["slow push-in","parallax drift","kinetic type","time-lapse","dolly-out hero","whip pan","frame-on-frame","handheld"];
  const canvasRef = React.useRef(null);
  const rafRef = React.useRef(null);
  const [playing, setPlaying] = React.useState(false);
  const imgs = React.useMemo(() => (project.scenes||[]).filter(s=>s.shot).map(s=>"https://zaidsaid-proxy.zaidsaid.workers.dev/pollinations/prompt/"+encodeURIComponent(s.shot.replace(/[:%+]/g," ").replace(/\s+/g," ").trim())+"?width=640&height=360&nologo=true&model=turbo"), [project.storyboard]);
  const stopKenBurns = React.useCallback(() => { if (rafRef.current) cancelAnimationFrame(rafRef.current); setPlaying(false); }, []);
  const playKenBurns = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || imgs.length === 0) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    let imgIdx = 0, frame = 0;
    const FPIMG = 90;
    const images = imgs.map(src => { const im = new Image(); im.crossOrigin="anonymous"; im.src=src; return im; });
    setPlaying(true);
    const tick = () => {
      const img = images[imgIdx % images.length];
      if (!img.complete) { rafRef.current = requestAnimationFrame(tick); return; } if (img.naturalWidth === 0) { imgIdx++; frame = 0; if (imgIdx >= images.length) { stopKenBurns(); return; } rafRef.current = requestAnimationFrame(tick); return; }
      const p = frame / FPIMG;
      const scale = 1 + p * 0.07;
      const ox = (W * (scale-1)) * (imgIdx % 2 === 0 ? -0.5 : 0.5);
      const oy = (H * (scale-1)) * -0.5;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W/2 + ox, H/2 + oy);
      ctx.scale(scale, scale);
      const ar = (img.naturalWidth / img.naturalHeight) || (16/9);
      const cAr = W / H;
      let dw, dh;
      if (ar > cAr) { dh = H; dw = dh * ar; } else { dw = W; dh = dw / ar; }
      ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
      ctx.restore();
      frame++;
      if (frame >= FPIMG) { frame = 0; imgIdx++; if (imgIdx >= images.length) { stopKenBurns(); return; } }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, [imgs, stopKenBurns]);
  return (
    <div className="flex flex-col gap-4">
      {imgs.length > 0 && (
        <div className="relative rounded overflow-hidden bg-black" style={{aspectRatio:"16/9"}}>
          <canvas ref={canvasRef} width={640} height={360} className="w-full h-full" />
          <div className="absolute bottom-2 left-2 flex gap-2">
            {playing
              ? <button className="btn btn-sm" onClick={stopKenBurns}>■ Stop</button>
              : <button className="btn btn-sm btn-primary" onClick={playKenBurns}>▶ Preview</button>}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {presets.map(p => (
          <button key={p} className={"btn btn-sm " + ((project.motionPreset||"")===p ? "btn-primary" : "")}
            onClick={()=>setProject(pr=>({...pr, motionPreset:p}))}>{p}</button>
        ))}
      </div>
    </div>
  );
}
function StepVoice({ project, setProject }){
  const mode = project.voiceMode || "avatar";
  const setMode = (m) => setProject({ ...project, voiceMode: m });
  const [voiceBusy, setVoiceBusy] = React.useState(false);
  const [voiceErr, setVoiceErr] = React.useState('');
  const [voiceInfo, setVoiceInfo] = React.useState('');
  const projectRef = React.useRef(project);
  projectRef.current = project;
  React.useEffect(() => {
    if (isGodMode) return;
    if (!voiceInfo && !voiceBusy) return;
    try { window.dispatchEvent(new CustomEvent('zs:progress', { detail: { message: voiceInfo || (voiceBusy ? 'Generating voices…' : ''), busy: voiceBusy } })); } catch(_){}
  }, [voiceInfo, voiceBusy]);
  const generateAllVoices = async () => {
    if(voiceBusy) return;
    const initialLen = ((projectRef.current && projectRef.current.scenes) || []).length;
    if(!initialLen){ setVoiceErr('No scenes to voice.'); return; }
    setVoiceBusy(true); setVoiceErr(''); setVoiceInfo('');
    let providers = {}; try { providers = safeGet('providers', {}) || {}; } catch(e){}
    const path = providers && providers.elevenlabs && providers.elevenlabs.proxyUrl;
    let okEl=0, okLocal=0, errs=0, guard=0;
    const seen = new Set();
    while (guard++ < 40) {
      const scenesNow = (projectRef.current && projectRef.current.scenes) || [];
      const pending = scenesNow.find(s => !seen.has(s.id) && !s.audioSource);
      if (!pending) break;
      const sceneId = pending.id;
      seen.add(sceneId);
      const text = (pending.voLine || pending.script || pending.title || '').toString();
      let patch = null;
      if(!text.trim()){
        patch = { audio: null, audioSource: 'skipped' };
      } else {
        try {
          if(path){
            const dataUrl = await ttsViaElevenLabs(path, text);
            patch = { audio: dataUrl, audioSource: 'elevenlabs' };
            okEl++;
          } else {
            patch = { audio: null, audioSource: 'local-speech' };
            okLocal++;
          }
        } catch(e){
          patch = { audio: null, audioSource: 'error', audioError: String(e && e.message || e).slice(0,140) };
          errs++;
        }
      }
      setProject(prev => ({ ...prev, scenes: prev.scenes.map(x => x.id === sceneId ? { ...x, ...patch } : x) }));
      const total = ((projectRef.current && projectRef.current.scenes) || []).length || initialLen;
      const done = okEl + okLocal + errs;
      setVoiceInfo('Voiced ' + done + '/' + total + ' scenes…');
    }
    setVoiceInfo('Voices: ' + okEl + ' via ElevenLabs · ' + okLocal + ' marked for local playback · ' + errs + ' errors.');
    setVoiceBusy(false);
    if (!isGodMode) { try { window.dispatchEvent(new CustomEvent('zs:advance-step', { detail: { from: 'voice' } })); } catch(_){} }
  };
  const previewLocalForScene = (s) => { try { ttsLocal(s.voLine || s.script || s.title || ''); } catch(e){} };
  const regenerateOne = async (sceneId) => {
    if(voiceBusy) return;
    const scene = (project.scenes||[]).find(s => s.id === sceneId);
    if(!scene) return;
    const text = (scene.voLine || scene.script || scene.title || '').toString();
    if(!text.trim()){ setVoiceErr('Scene has no text to voice.'); return; }
    let providers = {}; try { providers = safeGet('providers', {}) || {}; } catch(e){}
    const path = providers && providers.elevenlabs && providers.elevenlabs.proxyUrl;
    if(!path){ setVoiceErr('ElevenLabs proxy not configured.'); return; }
    setVoiceBusy(true); setVoiceErr(''); setVoiceInfo('');
    try {
      const dataUrl = await ttsViaElevenLabs(path, text);
      setProject({ ...project, scenes: project.scenes.map(s => s.id === sceneId ? { ...s, audio: dataUrl, audioSource: 'elevenlabs' } : s) });
      setVoiceInfo('Regenerated voice for: ' + (scene.title || 'scene'));
    } catch(e){
      setVoiceErr('Regenerate failed: ' + String(e && e.message || e).slice(0,140));
    } finally { setVoiceBusy(false); }
  };
  React.useEffect(() => {
    if (isGodMode) return;
    const scenes = project.scenes || [];
    if (!scenes.length) return;
    const hasAnyAudio = scenes.some(s => s.audioSource);
    if (hasAnyAudio || voiceBusy) return;
    generateAllVoices();
  }, [project.scenes && project.scenes.length]);
    return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Voice & Avatar</div>
        <div className="text-lg font-semibold">Who performs this?</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[
            { k:"avatar", label:"Avatar performance" },
            { k:"voice",  label:"Voiceover only" },
            { k:"clone",  label:"My cloned voice" },
          ].map(m => {
            const active = mode === m.k;
            return (
              <button key={m.k}
                onClick={()=>setMode(m.k)}
                aria-pressed={active}
                className={"px-3 py-1.5 rounded-xl border text-[12px] " + (active ? "border-white/20 bg-white/10 text-white" : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-white")}>
                {m.label}
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          {ARCHIVE_AVATARS.slice(0,4).map(a => {
            const active = project.characterId === a.id;
            return (
              <div key={a.id} className={"rounded-xl border p-4 " + (active ? "border-white/20 bg-white/[0.05]" : "border-[color:var(--line)]")}>
                <div className="w-12 h-12 rounded-full mb-2" style={{background:"linear-gradient(135deg,#6366f1,#22d3ee)"}} />
                <div className="font-semibold">{a.name}</div>
                <div className="text-[12px] text-[color:var(--muted)]">{a.persona}</div>
                <button className="chip mt-3" onClick={()=>setProject({ ...project, characterId: a.id })}>
                  {active ? "Selected" : "Choose"}
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-[12px] text-[color:var(--muted)]">
          Cloning lands in Stage 4. Selection here persists into the timeline and export.
        </div>
      </div>
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] uppercase tracking-wide text-[color:var(--muted)]">Voiceover</div>
            <div className="text-lg font-semibold">Generate scene audio</div>
            <div className="text-[12px] text-[color:var(--muted)] mt-1">ElevenLabs when configured (returns audio data), browser SpeechSynthesis as live-playback fallback.</div>
          </div>
          <button className="btn btn-primary" onClick={generateAllVoices} disabled={voiceBusy}>{voiceBusy ? 'Synthesizing…' : 'Generate all voices'}</button>
        </div>
        {voiceErr && <div className="mt-2 text-[12px] text-red-400">{voiceErr}</div>}
        {voiceInfo && <div className="mt-2 text-[12px] text-emerald-400">{voiceInfo}</div>}
        {(project.scenes||[]).some(s => s.audio || s.audioSource) && (
          <div className="mt-3 grid gap-2">
            {(project.scenes||[]).map((s, i) => (
              <div key={s.id||i} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--line)] p-2">
                <div className="min-w-0">
                  <div className="text-sm truncate">{(i+1)+'. '+(s.title||'Scene')}</div>
                  <div className="text-[11px] text-[color:var(--muted)] truncate">{s.audioSource === 'elevenlabs' ? 'ElevenLabs audio' : (s.audioSource === 'local-speech' ? 'Local SpeechSynthesis' : (s.audioSource === 'error' ? ('Error: '+(s.audioError||'')) : 'No audio yet'))}</div>
                </div>
                {s.audio ? <audio controls src={s.audio} className="max-w-[260px]" /> : <button className="chip" onClick={()=>previewLocalForScene(s)}>{'preview locally'}</button>}
                {isGodMode && <button className="chip shrink-0" onClick={()=>regenerateOne(s.id)} disabled={voiceBusy} title="Regenerate ElevenLabs voice for this scene">{String.fromCharCode(8635)}</button>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">VO Preview</div>
        <div className="text-lg font-semibold">Hear each scene aloud</div>
        <div className="mt-3 flex flex-col gap-2">
          {(project.scenes||[]).map((s, i) => (
            <div key={s.id} className="rounded-xl border border-[color:var(--line)] p-3 flex items-start gap-3">
              <span className="chip shrink-0">{String(i+1).padStart(2,"0")}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-[color:var(--muted)]">{s.title}</div>
                <div className="text-sm mt-0.5">{s.voLine || <span className="opacity-40">No VO line yet</span>}</div>
              </div>
              <button className="chip shrink-0" onClick={()=>speakText(s.voLine,{lang:"en-US"})} disabled={!s.voLine}>
                ▶ Preview
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button className="chip" onClick={()=>stopSpeech()}>■ Stop</button>
          <span className="text-[11px] text-[color:var(--muted)]">Browser Web Speech API — free, no key needed</span>
        </div>
      </div>
    </div>
  );
}

function StepTimeline({ project, setProject }){
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const move = sceneMover(project, setProject);
  const remove = sceneRemover(project, setProject);
  const setField = sceneFieldSetter(project, setProject);
  const regen = sceneRegenSetter(project, setProject);
  const onDragStart = (id) => (e) => {
    setDragId(id);
    try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); } catch(err){}
  };
  const onDragOver = (id) => (e) => {
    e.preventDefault();
    if(overId !== id) setOverId(id);
  };
  const onDrop = (targetId) => (e) => {
    e.preventDefault();
    const srcId = dragId;
    setDragId(null); setOverId(null);
    if(!srcId || srcId === targetId) return;
    const scenes = project.scenes.slice();
    const srcIdx = scenes.findIndex(s => s.id === srcId);
    const tgtIdx = scenes.findIndex(s => s.id === targetId);
    if(srcIdx < 0 || tgtIdx < 0) return;
    const [item] = scenes.splice(srcIdx, 1);
    scenes.splice(tgtIdx, 0, item);
    setProject({ ...project, scenes });
  };
  const onDragEnd = () => { setDragId(null); setOverId(null); };
  const totalDuration = project.scenes.reduce((a,s)=>a+(s.duration||0), 0);
  const addScene = () => {
    const nid = "s" + (project.scenes.length+1) + "_" + Math.random().toString(36).slice(2,6);
    setProject({
      ...project,
      scenes: [...project.scenes, { id: nid, title:"New scene", voLine:"Write a line.", shot:"Describe the shot.", duration:4, motion:"slow push-in", asset:"b-roll: placeholder", captions:"Caption goes here." }],
    });
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Timeline</div>
            <div className="text-lg font-semibold">Drag to reorder scenes</div>
            <div className="text-[12px] text-[color:var(--muted)] mt-1">Total: {totalDuration}s · {project.scenes.length} scenes</div>
          </div>
          <button className="btn" onClick={addScene}>{I.plus({size:14})} Add scene</button>
        </div>
        <div className="mt-4 grid gap-2">
          {project.scenes.map((s, i) => {
            const isDragging = dragId === s.id;
            const isOver = overId === s.id;
            return (
              <div key={s.id}
                draggable
                onDragStart={onDragStart(s.id)}
                onDragOver={onDragOver(s.id)}
                onDrop={onDrop(s.id)}
                onDragEnd={onDragEnd}
                className={"rounded-xl border p-3 flex items-center gap-3 transition-colors " +
                  (isDragging ? "opacity-50 border-white/20 " : "") +
                  (isOver && !isDragging ? "border-white/30 bg-white/[0.06] " : "border-[color:var(--line)] ")}>
                <span className="text-[color:var(--muted)] cursor-grab select-none" aria-hidden>{I.grip({size:14})}</span>
                <span className="chip">{String(i+1).padStart(2,"0")}</span>
                <div className="flex-1 min-w-0">
                  <input
                    value={s.title}
                    onChange={(e)=>setField(s.id, "title", e.target.value)}
                    className="bg-transparent border border-transparent hover:border-[color:var(--line)] focus:border-white/20 rounded-md px-1 py-0.5 text-sm w-full focus:outline-none"
                    aria-label="Scene title"
                  />
                  <div className="text-[11px] text-[color:var(--muted)] truncate">{s.voLine}</div>
                </div>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={s.duration}
                  onChange={(e)=>{
                    const v = Math.max(1, Math.min(30, parseInt(e.target.value||"0", 10)||0));
                    setField(s.id, "duration", v);
                  }}
                  className="w-16 bg-transparent border border-[color:var(--line)] rounded-md px-2 py-1 text-[12px] focus:outline-none focus:border-white/20"
                  aria-label="Duration seconds"
                />
                <span className="text-[11px] text-[color:var(--muted)]">s</span>
                <div className="flex items-center gap-1">
                  <button className="chip" onClick={()=>move(s.id, -1)} disabled={i===0} aria-label="Move up">{I.up({size:12})}</button>
                  <button className="chip" onClick={()=>move(s.id, 1)} disabled={i===project.scenes.length-1} aria-label="Move down">{I.down({size:12})}</button>
                  <button className="chip" onClick={()=>regen(s.id, "voLine")} aria-label="Regenerate line">{I.refresh({size:12})}</button>
                  <button className="chip" onClick={()=>remove(s.id)} aria-label="Remove scene">{I.x({size:12})}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepExport({ project, setProject }){
  const projectRef = React.useRef(project);
  projectRef.current = project;
  const setPreset = (id) => setProject({ ...project, preset: id, platforms: (STUDIO_EXPORT_PRESETS.find(p=>p.id===id)||{}).platforms || project.platforms });
  const togglePlatform = (p) => {
    const curr = project.platforms || [];
    const next = curr.includes(p) ? curr.filter(x=>x!==p) : [...curr, p];
    setProject({ ...project, platforms: next });
  };
  const totalDuration = project.scenes.reduce((a,s)=>a+(s.duration||0), 0);
  const [renderBusy, setRenderBusy] = React.useState(false);
  const [renderErr, setRenderErr] = React.useState('');
  const [renderUrl, setRenderUrl] = React.useState('');
  React.useEffect(() => {
    if(!renderUrl && typeof window !== 'undefined' && window.__zs_lastBlob){
      try { setRenderUrl(URL.createObjectURL(window.__zs_lastBlob)); } catch(_){}
    }
  }, []);
  const [renderProgress, setRenderProgress] = React.useState(0);
  React.useEffect(() => {
    if (isGodMode) return;
    if (!renderBusy && !renderUrl) return;
    const message = renderUrl && !renderBusy
      ? 'Video ready — scroll down to preview & download.'
      : ('Rendering video… ' + Math.max(1, renderProgress) + '%');
    try { window.dispatchEvent(new CustomEvent('zs:progress', { detail: { message, busy: renderBusy } })); } catch(_){}
  }, [renderBusy, renderProgress, renderUrl]);
  const renderRealVideo = async () => {
    if(renderBusy) return;
    const scenes = ((projectRef.current && projectRef.current.scenes) || []).slice();
    if(!scenes.length){ setRenderErr('No scenes to render.'); return; }
    if(typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream){ setRenderErr('Your browser does not support MediaRecorder + canvas.captureStream.'); return; }
    if(document.visibilityState !== 'visible'){ console.warn('[zs] starting render with tab hidden — output may be lower quality'); }
    setRenderBusy(true); setRenderErr(''); setRenderUrl(''); setRenderProgress(0);
    let audioCtx = null; let onVis = null;
    try {
      const W = 1280, H = 720;
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0,0,W,H);
      const AC = window.AudioContext || window.webkitAudioContext;
      let audioDest = null; let audioBuffers = [];
      if(AC){
        audioCtx = new AC();
        try { await audioCtx.resume(); } catch(_){}
        audioDest = audioCtx.createMediaStreamDestination();
        audioBuffers = await Promise.all(scenes.map(async (s) => {
          if(!s.audio) return null;
          try {
            const res = await fetch(s.audio);
            const buf = await res.arrayBuffer();
            return await new Promise((resolve, reject) => { audioCtx.decodeAudioData(buf, resolve, reject); });
          } catch(err){ console.warn('[zs] audio decode failed', err); return null; }
        }));
      }
      const durations = scenes.map((s,i) => {
        const configured = Math.max(1, Number(s.duration)||3);
        const audioLen = audioBuffers[i] ? audioBuffers[i].duration : 0;
        return Math.max(configured, Math.ceil(audioLen * 10)/10);
      });
      const INTRO_S = 1.0;
      const total = INTRO_S + durations.reduce((a,b)=>a+b, 0);
      const stream = canvas.captureStream(30);
      if(audioDest){ audioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t)); }
      const mimeCandidates = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm;codecs=vp9','video/webm'];
      const mime = mimeCandidates.find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if(e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((resolve) => { rec.onstop = () => resolve(); });
      const imgs = await Promise.all(scenes.map(s => new Promise((res) => {
        if(!s.image){ res(null); return; }
        const im = new Image(); im.crossOrigin = 'anonymous';
        im.onload = () => res(im); im.onerror = () => res(null);
        im.src = s.image;
      })));
      let tabWasHidden = false;
      onVis = () => { if(document.visibilityState !== 'visible'){ tabWasHidden = true; console.warn('[zs] tab hidden mid-render â playback may stutter'); } };
      document.addEventListener('visibilitychange', onVis);
      rec.start();
      const recStart = audioCtx ? audioCtx.currentTime + 0.05 : 0;
      if(audioCtx && audioDest){
        let cum = INTRO_S;
        for(let i=0; i<scenes.length; i++){
          const ab = audioBuffers[i];
          if(ab){
            const src = audioCtx.createBufferSource();
            src.buffer = ab; src.connect(audioDest);
            try { src.start(recStart + cum); } catch(_){}
          }
          cum += durations[i];
        }
      }
      const drawSceneToCtx = (context, idx, progress) => {
        const p = Math.max(0, Math.min(1, progress || 0));
        context.globalAlpha = 1;
        context.fillStyle = '#0a0a0a'; context.fillRect(0,0,W,H);
        const sc = scenes[idx];
        if(imgs[idx]){
          const img = imgs[idx];
          const variant = idx % 5;
          const zoomStart = (variant === 0) ? 1.10 : 1.00;
          const zoomEnd   = (variant === 0) ? 1.00 : 1.10;
          const zoom = zoomStart + (zoomEnd - zoomStart) * p;
          const r = Math.max(W/img.width, H/img.height);
          const dw = img.width * r * zoom, dh = img.height * r * zoom;
          const slack = 0.04;
          let panX = 0, panY = 0;
          if(variant === 1){ panX = -slack * W * p; }
          else if(variant === 2){ panX = slack * W * p; }
          else if(variant === 3){ panY = -slack * 0.7 * H * p; }
          else if(variant === 4){ panY = slack * 0.7 * H * p; }
          context.drawImage(img, (W-dw)/2 + panX, (H-dh)/2 + panY, dw, dh);
          context.fillStyle = 'rgba(0,0,0,0.45)'; context.fillRect(0, H-160, W, 160);
        } else {
          context.fillStyle = '#1a1a1a'; context.fillRect(40,40,W-80,H-80);
        }
        context.fillStyle = '#fff'; context.font = 'bold 42px system-ui'; context.textAlign='left';
        const title = (sc.title||('Scene '+(idx+1))).slice(0,60);
        context.fillText(title, 60, H-100);
        context.font = '24px system-ui'; context.fillStyle = 'rgba(255,255,255,0.85)';
        const vo = (sc.voLine||'').slice(0,90);
        context.fillText(vo, 60, H-50);
      };
      const offscreen = document.createElement('canvas'); offscreen.width = W; offscreen.height = H;
      const offCtx = offscreen.getContext('2d');
      const FADE_S = 0.4;
      const projectTitle = ((project.name && String(project.name).trim()) || (project.logline && String(project.logline).trim()) || 'Your AI-generated video').slice(0, 70);
      const drawIntro = (alpha, scaleProgress) => {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);
        const grad = ctx.createRadialGradient(W/2, H/2, 50, W/2, H/2, Math.max(W, H)*0.7);
        grad.addColorStop(0, 'rgba(99,102,241,0.18)');
        grad.addColorStop(1, 'rgba(10,10,10,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        const scale = 0.96 + 0.04 * scaleProgress;
        ctx.save();
        ctx.translate(W/2, H/2);
        ctx.scale(scale, scale);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 52px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.fillText(projectTitle, 0, -6);
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '20px system-ui';
        ctx.fillText('zaidsaid.com', 0, 44);
        ctx.restore();
        ctx.globalAlpha = 1;
      };
      const introStart = audioCtx ? audioCtx.currentTime : performance.now()/1000;
      while(true){
        const now = audioCtx ? audioCtx.currentTime : performance.now()/1000;
        const p = Math.min(1, (now - introStart) / INTRO_S);
        const fadeIn = 0.3, fadeOut = 0.25;
        let a = 1;
        if (p < fadeIn) a = p / fadeIn;
        else if (p > 1 - fadeOut) a = Math.max(0, (1 - p) / fadeOut);
        drawIntro(a, Math.min(1, p / 0.4));
        if (p >= 1) break;
        await new Promise(r => requestAnimationFrame(r));
      }
      let elapsed = INTRO_S;
      setRenderProgress(Math.min(99, Math.round((elapsed/total)*100)));
      for(let i=0; i<scenes.length; i++){
        const dur = durations[i];
        const isLast = (i === scenes.length - 1);
        const fadeS = isLast ? 0 : Math.min(FADE_S, dur * 0.3);
        const sceneStart = audioCtx ? audioCtx.currentTime : performance.now()/1000;
        const holdEnd = sceneStart + Math.max(0, dur - fadeS);
        while(true){
          const now = audioCtx ? audioCtx.currentTime : performance.now()/1000;
          const p = Math.min(1, (now - sceneStart) / dur);
          drawSceneToCtx(ctx, i, p);
          if(now >= holdEnd) break;
          await new Promise(r => requestAnimationFrame(r));
        }
        if(!isLast && fadeS > 0){
          const holdProgress = Math.min(1, (dur - fadeS) / dur);
          drawSceneToCtx(offCtx, i, holdProgress);
          const fadeStart = audioCtx ? audioCtx.currentTime : performance.now()/1000;
          while(true){
            const now = audioCtx ? audioCtx.currentTime : performance.now()/1000;
            const t = Math.min(1, (now - fadeStart) / fadeS);
            drawSceneToCtx(ctx, i+1, 0);
            ctx.globalAlpha = 1 - t;
            ctx.drawImage(offscreen, 0, 0);
            ctx.globalAlpha = 1;
            if(t >= 1) break;
            await new Promise(r => requestAnimationFrame(r));
          }
        }
        elapsed += dur;
        setRenderProgress(Math.min(99, Math.round((elapsed/total)*100)));
      }
      rec.stop();
      await stopped;
      const blob = new Blob(chunks, { type: mime });
      try { window.__zs_lastBlob = blob; } catch(_){}
      const url = URL.createObjectURL(blob);
      setRenderUrl(url);
      setRenderProgress(100);
      if(tabWasHidden){ console.warn('[zs] tab was hidden at least once during render'); }
    } catch(e){
      console.warn('[zs] render error', e);
      setRenderErr('Render failed: ' + (e && e.message || e));
    } finally {
      setRenderBusy(false);
      if(onVis){ try { document.removeEventListener('visibilitychange', onVis); } catch(_){} }
      if(audioCtx){ try { audioCtx.close(); } catch(_){} }
    }
  };
  const sceneSig = (project.scenes || []).map(s => (s.id || '') + '|' + (s.image ? '1' : '0') + '|' + (s.audioSource ? '1' : '0')).join(',');
  React.useEffect(() => {
    if (isGodMode) return;
    if (renderBusy || renderUrl) return;
    const scenes = ((projectRef.current && projectRef.current.scenes) || []);
    if (!scenes.length || !scenes.every(s => s.image)) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      const onVisible = () => {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', onVisible);
          const s2 = ((projectRef.current && projectRef.current.scenes) || []);
          if (s2.length && s2.every(x => x.image) && !renderBusy && !renderUrl) renderRealVideo();
        }
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => document.removeEventListener('visibilitychange', onVisible);
    }
    renderRealVideo();
  }, [sceneSig]);
    return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Export</div>
        <div className="text-lg font-semibold">Aspect & platform presets</div>
      </div>
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] uppercase tracking-wide text-[color:var(--muted)]">Render</div>
            <div className="text-lg font-semibold">Real video export (canvas + MediaRecorder)</div>
            <div className="text-[12px] text-[color:var(--muted)] mt-1">Burns each scene image with title and VO into a 720p WebM. Uses captureStream — Chromium and Firefox supported.</div>
          </div>
          <button className="btn btn-primary" onClick={renderRealVideo} disabled={renderBusy}>{renderBusy ? ('Rendering ' + renderProgress + '%') : 'Render WebM'}</button>
        </div>
        {renderErr && <div className="mt-2 text-[12px] text-red-400">{renderErr}</div>}
        {renderBusy && (
          <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-2 bg-emerald-400 transition-all" style={{ width: renderProgress + '%' }} />
          </div>
        )}
        {renderUrl && !renderBusy && (
          <div className="mt-3 grid gap-2">
            <video src={renderUrl} controls className="w-full max-h-[360px] rounded-xl border border-[color:var(--line)]" />
            <a href={renderUrl} download={(project.name||'zaidsaid')+'.webm'} className="chip self-start">Download .webm</a>
          </div>
        )}
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {STUDIO_EXPORT_PRESETS.map(p => {
          const active = project.preset === p.id;
          return (
            <button key={p.id}
              onClick={()=>setPreset(p.id)}
              aria-pressed={active}
              className={"card p-5 text-left transition-colors " + (active ? "ring-brand" : "")}>
              <div className="flex items-center justify-between">
                <span className="chip">{p.ratio}</span>
                <span className="text-[11px] text-[color:var(--muted)]">{p.platforms.join(" · ")}</span>
              </div>
              <div className="mt-3 flex items-center justify-center">
                <div className="bg-white/5 border border-[color:var(--line)] rounded-xl"
                  style={{
                    width: p.id==="vertical" ? 72 : (p.id==="square" ? 108 : 160),
                    height: p.id==="vertical" ? 128 : (p.id==="square" ? 108 : 90),
                  }}
                  aria-hidden />
              </div>
              <div className="mt-3 font-semibold">{p.label}</div>
            </button>
          );
        })}
      </div>
      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Platforms</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {["TikTok","Reels","Shorts","X","LinkedIn","YouTube"].map(p => {
            const active = (project.platforms||[]).includes(p);
            return (
              <button key={p}
                onClick={()=>togglePlatform(p)}
                aria-pressed={active}
                className={"px-3 py-1.5 rounded-xl border text-[12px] " + (active ? "border-white/20 bg-white/10 text-white" : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-white")}>
                {p}
              </button>
            );
          })}
        </div>
      </div>
      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Render summary</div>
        <div className="grid md:grid-cols-4 gap-3 mt-2 text-sm">
          <div><div className="text-[color:var(--muted)] text-[11px]">Project</div><div className="truncate">{project.name}</div></div>
          <div><div className="text-[color:var(--muted)] text-[11px]">Scenes</div><div>{project.scenes.length}</div></div>
          <div><div className="text-[color:var(--muted)] text-[11px]">Duration</div><div>{totalDuration}s</div></div>
          <div><div className="text-[color:var(--muted)] text-[11px]">Aspect</div><div>{(STUDIO_EXPORT_PRESETS.find(p=>p.id===project.preset)||{}).ratio || "9:16"}</div></div>
        </div>
        
        <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
          {project.logline && (<div className="rounded-xl border border-[color:var(--line)] p-3"><div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Logline</div><div className="mt-1">{project.logline}</div></div>)}
          {project.hook && (<div className="rounded-xl border border-[color:var(--line)] p-3"><div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Hook</div><div className="mt-1">{project.hook}</div></div>)}
          {project.audience && (<div className="rounded-xl border border-[color:var(--line)] p-3"><div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Audience</div><div className="mt-1">{project.audience}</div></div>)}
          {project.angle && (<div className="rounded-xl border border-[color:var(--line)] p-3"><div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Angle</div><div className="mt-1">{project.angle}</div></div>)}
          {project.cta && (<div className="rounded-xl border border-[color:var(--line)] p-3 md:col-span-2"><div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Call to action</div><div className="mt-1">{project.cta}</div></div>)}
        </div><div className="mt-4 flex items-center gap-2">
          <button className="btn btn-primary" onClick={async()=>{
  const shots = (project.scenes||[]).filter(s=>s.shot).map(s=>({imageUrl:"https://zaidsaid-proxy.zaidsaid.workers.dev/pollinations/prompt/"+encodeURIComponent(s.shot)+"?width=640&height=360&nologo=true&model=turbo"}));
  if (!shots.length) { toast && toast("No storyboard images — run Storyboard stage first","error"); return; }
  const offscreen = document.createElement("canvas");
  offscreen.width = 1280; offscreen.height = 720;
  const ctx = offscreen.getContext("2d");
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const stream = offscreen.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (project.title || "zaidsaid-export") + ".webm";
    a.click();
    toast && toast("Export downloaded!", "success");
  };
  rec.start(100);
  const FPIMG = 90, FPS = 30;
  for (let idx = 0; idx < shots.length; idx++) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise(res => { img.onload = res; img.onerror = res; img.src = shots[idx].imageUrl; });
    for (let f = 0; f < FPIMG; f++) {
      const p = f / FPIMG, scale = 1 + p * 0.07;
      const ox = (1280 * (scale-1)) * (idx % 2 === 0 ? -0.5 : 0.5);
      const oy = (720 * (scale-1)) * -0.5;
      ctx.fillStyle = "#000"; ctx.fillRect(0,0,1280,720);
      ctx.save();
      ctx.translate(640 + ox, 360 + oy);
      ctx.scale(scale, scale);
      const ar = (img.naturalWidth / img.naturalHeight) || (16/9);
      const cAr = 1280 / 720;
      let dw, dh;
      if (ar > cAr) { dh = 720; dw = dh * ar; } else { dw = 1280; dh = dw / ar; }
      ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
      ctx.restore();
      await new Promise(res => setTimeout(res, 1000/FPS));
    }
  }
  rec.stop();
}}>{I.play({size:14})} Render</button>
          <button className="btn" onClick={()=>{ const parts=[project.logline&&("Logline: "+project.logline),project.hook&&("Hook: "+project.hook),project.audience&&("Audience: "+project.audience),project.angle&&("Angle: "+project.angle),project.cta&&("CTA: "+project.cta)].filter(Boolean).join("\n"); if(!parts){return;} try{ navigator.clipboard.writeText(parts); }catch(_){} }}>{I.copy({size:14})} Copy brief</button>
          <button className="btn" onClick={()=>{ const payload={ name: project.name, logline: project.logline||"", hook: project.hook||"", audience: project.audience||"", angle: project.angle||"", cta: project.cta||"", scenes: project.scenes, research: project.research, preset: project.preset, platforms: project.platforms }; const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=(project.name||"brief").replace(/[^a-z0-9_-]+/gi,"_")+".brief.json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000); }}>{I.arrow({size:14})} Download brief.json</button>
          <span className="text-[11px] text-[color:var(--muted)]">Real rendering arrives in a later stage.</span>
        </div>
      </div>
    </div>
  );
}

function StudioTab({ setTab, studioStep, setStudioStep }){
  const [project, setProject] = useLocalState("studio.project", STUDIO_SEED);
  useEffect(() => {
    if(project && typeof project === "object" && Array.isArray(project.scenes) && project.scenes.length > 0) return;
    setProject(STUDIO_SEED);
  }, []);
  const [seeded, setSeeded] = React.useState(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("zaidsaid.v2.studio.seed");
      if (!raw) return;
      const seed = JSON.parse(raw);
      if (!seed || !seed.templateId) return;
      setSeeded(seed);
      setProject(prev => ({
        ...prev,
        name: seed.name || prev.name,
        source: (seed.steps && seed.steps.length) ? ("Template: " + seed.name + "\n\nBeats:\n" + seed.steps.map((s, i) => (i+1)+". "+s).join("\n")) : prev.source,
        brandKitId: seed.kit || prev.brandKitId,
        platforms: seed.platform ? [seed.platform] : prev.platforms,
        preset: (seed.aspect === "16:9") ? "horizontal" : (seed.aspect === "1:1" ? "square" : "vertical"),
        durationHint: seed.duration || prev.durationHint,
        scenes: (seed.steps || []).map((label, i) => ({
          id: "s" + (i+1),
          title: label,
          script: "",
          duration: Math.max(3, Math.round((seed.duration || 60) / (seed.steps ? seed.steps.length : 1))),
          aroll: "avatar",
          broll: []
        }))
      }));
      try { localStorage.removeItem("zaidsaid.v2.studio.seed"); } catch(e){}
    } catch(e) {}
  }, []);
  const clearSeeded = () => setSeeded(null);

  const visibleIds = visibleStudioSteps().map(s => s.id);
  const rawStep = studioStep || (isGodMode ? "research" : "script");
  const step = visibleIds.includes(rawStep) ? rawStep : visibleIds[0];
  useEffect(() => { if (step !== rawStep) setStudioStep(step); }, [step, rawStep]);
  const goto = (id) => setStudioStep(id);
  const [progress, setProgress] = React.useState({ message: '', busy: false });
  React.useEffect(() => {
    if (isGodMode) return;
    const h = (e) => {
      const from = e && e.detail && e.detail.from;
      const map = { script: 'storyboard', storyboard: 'voice', voice: 'export' };
      if (map[from]) setStudioStep(map[from]);
    };
    const p = (e) => {
      const d = (e && e.detail) || {};
      setProgress({ message: d.message || '', busy: !!d.busy });
    };
    window.addEventListener('zs:advance-step', h);
    window.addEventListener('zs:progress', p);
    return () => {
      window.removeEventListener('zs:advance-step', h);
      window.removeEventListener('zs:progress', p);
    };
  }, []);
  const renderStep = () => {
    switch(step){
      case "research": return <StepResearch project={project} setProject={setProject} setStudioStep={setStudioStep} />;
      case "script":     return <StepScript      project={project} setProject={setProject} />;
      case "storyboard": return <StepStoryboard  project={project} setProject={setProject} />;
      case "assets":     return <StepAssets      project={project} setProject={setProject} />;
      case "motion":     return <StepMotion      project={project} setProject={setProject} />;
      case "voice":      return <StepVoice       project={project} setProject={setProject} />;
      case "timeline":   return <StepTimeline    project={project} setProject={setProject} />;
      case "export":     return <StepExport      project={project} setProject={setProject} />;
      default:           return <StepResearch    project={project} setProject={setProject} />;
    }
  };
  const _navSteps = visibleStudioSteps();
  const idxFull = Math.max(0, STUDIO_STEPS.findIndex(s => s.id === step));
  const idxVis = Math.max(0, _navSteps.findIndex(s => s.id === step));
  const idx = idxFull;
  const prev = _navSteps[idxVis-1];
  const next = _navSteps[idxVis+1];
  const resetProject = () => setProject(STUDIO_SEED);
  return (
    <div className="max-w-[1400px] mx-auto px-5 py-8">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-3xl font-bold">Studio</h1>
          <p className="text-[color:var(--muted)] mt-1">{STUDIO_STEPS[idx].blurb}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost" onClick={resetProject}>{I.refresh({size:14})} Reset to example</button>
        </div>
      </div>
      {seeded && (
        <div className="mb-4 p-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-indigo-500/30 flex items-center justify-center">{I.spark({size:14})}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Seeded from template: <span className="text-indigo-200">{seeded.name}</span></div>
            <div className="text-[11px] text-[color:var(--muted)] truncate">{seeded.templateId} · {seeded.platform || "any platform"} · {seeded.duration || "?"}s · {(seeded.steps || []).length} beats</div>
          </div>
          <button onClick={clearSeeded} className="btn btn-ghost text-xs">{I.x({size:12})} Dismiss</button>
        </div>
      )}
      <div className="grid gap-3 mb-4">
        <StudioStepNav step={step} setStep={goto} />
        {isGodMode && <StudioStageProvider step={step} setTab={setTab} />}
        {isGodMode && <StudioCharacterRow project={project} setProject={setProject} />}
        {isGodMode && <StudioBrandKitSelect project={project} setProject={setProject} />}
      </div>
      {!isGodMode && progress.message && (
        <div className="mb-4 p-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 flex items-center gap-3">
          <span className={"w-2.5 h-2.5 rounded-full " + (progress.busy ? "bg-indigo-300 animate-pulse" : "bg-emerald-400")} />
          <div className="flex-1 min-w-0 text-sm text-indigo-100">{progress.message}</div>
        </div>
      )}
      <div>{renderStep()}</div>
      <div className="mt-6 flex items-center justify-between gap-2 flex-wrap">
        <button className="btn" onClick={()=>prev && goto(prev.id)} disabled={!prev}>← {prev ? prev.label : "Start"}</button>
        <div className="text-[11px] text-[color:var(--muted)]">Step {idxVis+1} of {_navSteps.length}</div>
        <button className="btn btn-primary" onClick={()=>next && goto(next.id)} disabled={!next}>{next ? next.label : "Done"} →</button>
      </div>
    </div>
  );
}

/* ---------------- Repurpose (Stage 3) ---------------- */
const REPURPOSE_INTAKE_KINDS = [
  { k:"url",     label:"URL",         hint:"YouTube, Vimeo, podcast feed, webinar link." },
  { k:"upload",  label:"File",        hint:"MP4 / MOV / MP3 / WAV." },
  { k:"rss",     label:"RSS",         hint:"Podcast or video feed." },
  { k:"transcript", label:"Transcript", hint:"Paste a time-coded transcript." },
];
const REPURPOSE_STAGES = [
  { k:"fetch",      label:"Fetch source",          ms: 700 },
  { k:"transcribe", label:"Transcribe audio",      ms: 1400 },
  { k:"segment",    label:"Segment into beats",    ms: 900 },
  { k:"score",      label:"Score virality",        ms: 1100 },
  { k:"trim",       label:"Trim to platform max",  ms: 700 },
  { k:"reframe",    label:"Reframe 9:16 / 1:1",    ms: 1000 },
  { k:"caption",    label:"Generate captions",     ms: 900 },
  { k:"brand",      label:"Apply brand kit",       ms: 600 },
];
const REPURPOSE_PRESETS = [
  { id:"vertical",  ratio:"9:16", label:"Vertical",  platforms:["TikTok","Reels","Shorts"] },
  { id:"square",    ratio:"1:1",  label:"Square",    platforms:["X","LinkedIn"] },
  { id:"landscape", ratio:"16:9", label:"Landscape", platforms:["YouTube","LinkedIn"] },
];
const REPURPOSE_SORTS = [
  { k:"virality", label:"Virality" },
  { k:"duration", label:"Duration" },
  { k:"start",    label:"Timecode" },
];
function hmsFromSec(sec){
  const s = Math.max(0, Math.floor(sec||0));
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const ss = s%60;
  const pad = (n)=> String(n).padStart(2,"0");
  return h>0 ? (h+":"+pad(m)+":"+pad(ss)) : (pad(m)+":"+pad(ss));
}
function viralityBand(v){
  if(v >= 85) return { label:"Fire",    tone:"text-rose-300",    bg:"bg-rose-500/15",    border:"border-rose-400/30" };
  if(v >= 70) return { label:"Strong",  tone:"text-amber-200",   bg:"bg-amber-500/15",   border:"border-amber-400/30" };
  if(v >= 55) return { label:"Solid",   tone:"text-emerald-200", bg:"bg-emerald-500/15", border:"border-emerald-400/30" };
  return            { label:"Okay",    tone:"text-sky-200",     bg:"bg-sky-500/15",     border:"border-sky-400/30" };
}
function platformFor(presetId){
  const p = REPURPOSE_PRESETS.find(x=>x.id===presetId);
  return p ? p.platforms[0] : "TikTok";
}
const REPURPOSE_SEED = {
  name: "Huberman × Attia long-form → 5 shorts",
  kind: "url",
  source: "https://example.com/podcast/huberman-attia-longevity-ep42",
  durationSec: 5520,
  brandKitId: "bk-zs",
  targetCount: 5,
  clips: [
    { id:"c1", title:"Zone 2 cardio is the single highest-ROI habit",                     start:  612, end:  654, virality: 92, hook:"The one zone that actually moves the needle.",        caption:"If you only do one thing for longevity, this is it.",             preset:"vertical",  status:"draft" },
    { id:"c2", title:"Why VO2 max is the strongest predictor of all-cause mortality",     start: 1488, end: 1524, virality: 88, hook:"VO2 max beats every other biomarker for mortality.",   caption:"One number predicts how long you live.",                           preset:"vertical",  status:"draft" },
    { id:"c3", title:"Protein per meal is the lever, not total daily grams",              start: 2340, end: 2385, virality: 74, hook:"Hit the per-meal threshold or the rest is wasted.",     caption:"Why your protein target is missing the point.",                    preset:"square",    status:"draft" },
    { id:"c4", title:"The cold plunge debate: cortisol spike vs recovery",                start: 3180, end: 3222, virality: 66, hook:"When cold plunges help — and when they block gains.",   caption:"Cold plunge: the truth nobody says out loud.",                     preset:"vertical",  status:"draft" },
    { id:"c5", title:"Sleep pressure is a muscle — train it",                             start: 4450, end: 4495, virality: 58, hook:"Build sleep pressure like you build strength.",         caption:"Sleep is a skill. Here's how to train it.",                        preset:"landscape", status:"draft" },
  ],
};
function clipDuration(c){ return Math.max(0, (c.end||0) - (c.start||0)); }

function RepurposeIntake({ project, setProject }){
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Source</div>
          <div className="text-lg font-semibold">Point Zaidsaid at your long-form</div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {REPURPOSE_INTAKE_KINDS.map(k => {
            const active = project.kind === k.k;
            return (
              <button key={k.k}
                onClick={()=>setProject({ ...project, kind: k.k })}
                aria-pressed={active}
                className={"px-2.5 py-1.5 rounded-xl text-[12px] border " + (active ? "border-white/20 bg-white/10 text-white" : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-white")}>
                {k.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4 grid md:grid-cols-3 gap-3">
        <label className="md:col-span-2 block">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">URL, transcript, or paste</span>
          <div className="mt-1 flex items-center gap-2 bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 focus-within:border-white/20">
            <span className="text-[color:var(--muted)]" aria-hidden>{I.link({size:14})}</span>
            <input
              value={project.source || ""}
              onChange={(e)=>setProject({ ...project, source: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <label className="block flex-1 min-w-[200px]">
              <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Project name</span>
              <input
                value={project.name || ""}
                onChange={(e)=>setProject({ ...project, name: e.target.value })}
                className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Target clips</span>
              <input
                type="number" min={1} max={20}
                value={project.targetCount || 5}
                onChange={(e)=>setProject({ ...project, targetCount: Math.max(1, Math.min(20, parseInt(e.target.value||"0", 10)||0)) })}
                className="mt-1 w-24 bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Source length</span>
              <div className="mt-1 chip">{hmsFromSec(project.durationSec||0)}</div>
            </label>
          </div>
        </label>
        <div>
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Upload (UI only)</span>
          <div className="mt-1 border border-dashed border-[color:var(--line)] rounded-xl p-6 text-center text-[12px] text-[color:var(--muted)]">
            <div className="text-white/80 font-semibold">Drop a video or podcast</div>
            <div className="mt-1">MP4 · MOV · MP3 · WAV</div>
            <div className="mt-3 opacity-70">Uploads wire up in a later stage.</div>
            <button type="button" className="btn mt-3" aria-disabled="true" onClick={(e)=>e.preventDefault()}>
              Choose file
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RepurposeAnalyzer({ project, setProject, onComplete }){
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(-1);
  const timersRef = useRef([]);
  useEffect(()=>()=>{ timersRef.current.forEach(clearTimeout); timersRef.current = []; }, []);
  const start = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRunning(true); setProgress(0); setStageIdx(0);
    let elapsed = 0;
    const total = REPURPOSE_STAGES.reduce((a,s)=>a+s.ms, 0);
    REPURPOSE_STAGES.forEach((s, i) => {
      elapsed += s.ms;
      const t = setTimeout(() => {
        setStageIdx(i+1);
        setProgress(Math.min(100, Math.round((elapsed/total)*100)));
        if(i === REPURPOSE_STAGES.length - 1){
          setRunning(false);
          if(onComplete) onComplete();
        }
      }, elapsed);
      timersRef.current.push(t);
    });
  };
  const reset = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setRunning(false); setProgress(0); setStageIdx(-1);
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Analyzer</div>
          <div className="text-lg font-semibold">Find the moments worth clipping</div>
          <div className="text-[12px] text-[color:var(--muted)] mt-1">Demo simulator. Real generation lives in Studio (Script polish, Visuals, Voiceover, Render) and Repurpose (real Analyze).</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={start} disabled={running}>{running ? "Analyzing…" : "Analyze"}</button>
          <button className="btn btn-ghost" onClick={reset} disabled={running && stageIdx < REPURPOSE_STAGES.length}>Reset</button>
        </div>
      </div>
      <div className="mt-4">
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full transition-all duration-500" style={{width: progress + "%", background:"linear-gradient(90deg,#f97316,#ec4899,#6366f1)"}} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[color:var(--muted)]">
          <span>{progress}%</span>
          <span>{stageIdx >= REPURPOSE_STAGES.length ? "Complete" : (running ? "Working…" : (stageIdx < 0 ? "Idle" : "Paused"))}</span>
        </div>
      </div>
      <div className="mt-4 grid md:grid-cols-4 gap-2">
        {REPURPOSE_STAGES.map((s, i) => {
          const state = i < stageIdx ? "done" : (i === stageIdx && running ? "active" : "pending");
          return (
            <div key={s.k}
              className={"rounded-xl border p-3 text-[12px] transition-colors " +
                (state==="done" ? "border-white/15 bg-white/[0.04] text-white" :
                 state==="active" ? "border-white/20 bg-white/[0.08] text-white" :
                 "border-[color:var(--line)] text-[color:var(--muted)]")}>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                  style={{background: state==="done" ? "linear-gradient(135deg,#f97316,#ec4899)" : (state==="active" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)")}}>
                  {state==="done" ? I.check({size:12}) : (i+1)}
                </span>
                <span className="font-semibold">{s.label}</span>
              </div>
              <div className="mt-1 text-[11px] text-[color:var(--muted)]">{s.ms} ms</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function RepurposeRealAnalyze({ project, setProject }){
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [info, setInfo] = React.useState('');
  const [src, setSrc] = React.useState('');
  const run = async () => {
    if(busy) return;
    const text = (src || project.transcriptText || project.source || '').trim();
    if(!text){ setErr('Paste a transcript, description, or URL summary first.'); return; }
    setBusy(true); setErr(''); setInfo('');
    const path = getAnthropicPath();
    const target = Number(project.targetCount)||5;
    try {
      let clips;
      if(path){
        console.log('[zs] real-analyze: calling Claude');
        clips = await analyzeViaClaude(path, text, target);
        setInfo('Analyzed via Claude — ' + clips.length + ' clips.');
      } else {
        console.log('[zs] real-analyze: using local fallback');
        clips = analyzeLocal(text, target);
        setInfo('Analyzed locally (no Anthropic proxy configured) — ' + clips.length + ' clips.');
      }
      if(!clips || !clips.length){ setErr('No clips returned. Try richer source text.'); return; }
      setProject({ ...project, clips, durationSec: project.durationSec || (clips[clips.length-1].end + 60) });
    } catch(e){
      console.warn('[zs] real-analyze error', e);
      try { const fb = analyzeLocal(text, target); setProject({ ...project, clips: fb }); setErr('Claude call failed (' + (e && e.message || e) + '). Fell back to local analyze.'); }
      catch(e2){ setErr('Analyze failed: ' + (e2 && e2.message || e2)); }
    } finally { setBusy(false); }
  };
  return (
    <div className="card p-5 mt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-wide text-[color:var(--muted)]">Real analyze</div>
          <div className="text-lg font-semibold">Generate clips from your source</div>
          <div className="text-[12px] text-[color:var(--muted)] mt-1">Sends transcript or description to Claude (or local heuristic) and writes real clips into the project.</div>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? 'Analyzing…' : 'Run real analyze'}</button>
      </div>
      <div className="mt-3">
        <textarea className="input w-full" rows={4} placeholder="Paste source transcript or description (or use the project transcript above)" value={src} onChange={e=>setSrc(e.target.value)} />
      </div>
      {err && <div className="mt-2 text-[12px] text-red-400">{err}</div>}
      {info && <div className="mt-2 text-[12px] text-emerald-400">{info}</div>}
    </div>
  );
}



function RepurposeTranscriptStrip({ project }){
  const dur = Math.max(1, project.durationSec || 1);
  // Seed a deterministic waveform from the project id so it feels real but doesn't jitter
  const bars = useMemo(() => {
    const arr = [];
    const seedStr = (project.name||"zaidsaid") + "|" + dur;
    let h = 2166136261;
    for(let i = 0; i < seedStr.length; i++){ h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
    const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h>>>0) % 1000) / 1000; };
    for(let i = 0; i < 120; i++){ arr.push(0.15 + rand() * 0.85); }
    return arr;
  }, [project.name, dur]);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Source timeline</div>
          <div className="text-lg font-semibold">Highlights across {hmsFromSec(dur)}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip">{project.clips.length} clips</span>
          <span className="chip">{Math.round(project.clips.reduce((a,c)=>a+c.virality,0)/Math.max(1,project.clips.length))} avg virality</span>
        </div>
      </div>
      <div className="mt-4 relative rounded-xl border border-[color:var(--line)] p-3" style={{background:"rgba(255,255,255,0.02)"}}>
        <div className="flex items-end gap-[2px] h-20">
          {bars.map((v, i) => (
            <div key={i} className="flex-1 rounded-[2px]" style={{ height: (v*100)+"%", background:"linear-gradient(180deg, rgba(99,102,241,0.7), rgba(34,211,238,0.4))" }} aria-hidden />
          ))}
        </div>
        <div className="relative h-8 mt-1">
          {project.clips.map(c => {
            const leftPct = (c.start / dur) * 100;
            const widthPct = Math.max(0.5, (clipDuration(c) / dur) * 100);
            const band = viralityBand(c.virality);
            return (
              <div key={c.id}
                title={c.title + " · " + hmsFromSec(c.start) + "–" + hmsFromSec(c.end) + " · " + c.virality + "/100"}
                className={"absolute top-0 h-6 rounded-md border " + band.border + " " + band.bg}
                style={{ left: leftPct + "%", width: widthPct + "%", minWidth: "6px" }}>
                <div className="text-[10px] text-white/80 px-1 truncate leading-6">{c.virality}</div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] text-[color:var(--muted)] mt-1">
          <span>{hmsFromSec(0)}</span>
          <span>{hmsFromSec(dur/2)}</span>
          <span>{hmsFromSec(dur)}</span>
        </div>
      </div>
    </div>
  );
}

function RepurposeClipCard({ clip, onField, onRegen, onRemove }){
  const band = viralityBand(clip.virality);
  const preset = REPURPOSE_PRESETS.find(p => p.id === clip.preset) || REPURPOSE_PRESETS[0];
  const previewW = preset.id === "vertical" ? 72 : (preset.id === "square" ? 90 : 128);
  const previewH = preset.id === "vertical" ? 128 : (preset.id === "square" ? 90 : 72);
  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-cyan-500 opacity-90 flex items-center justify-center text-white/80 text-[10px]"
          style={{ width: previewW, height: previewH }} aria-hidden>
          <span>{preset.ratio}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={"px-2 py-0.5 rounded-md text-[11px] border " + band.border + " " + band.bg + " " + band.tone}>{I.flame({size:12})} {band.label} {clip.virality}</span>
            <span className="chip">{hmsFromSec(clip.start)} – {hmsFromSec(clip.end)}</span>
            <span className="chip">{clipDuration(clip)}s</span>
            <span className="chip">{preset.ratio} · {platformFor(clip.preset)}</span>
          </div>
          <input
            value={clip.title}
            onChange={(e)=>onField("title", e.target.value)}
            className="mt-2 w-full bg-transparent border border-transparent hover:border-[color:var(--line)] focus:border-white/20 rounded-md px-1 py-0.5 font-semibold text-[14px] focus:outline-none"
            aria-label="Clip title"
          />
          <div className="text-[12px] text-[color:var(--muted)] mt-1">{clip.hook}</div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Caption preview</span>
          <textarea
            value={clip.caption}
            onChange={(e)=>onField("caption", e.target.value)}
            rows={2}
            className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-lg p-2 text-sm focus:outline-none focus:border-white/20"
          />
          <div className="flex items-center justify-end mt-1">
            <button className="chip" onClick={()=>onRegen("caption")}>{I.refresh({size:12})} Regenerate</button>
          </div>
        </label>
        {clip.platformCaptions && typeof clip.platformCaptions === "object" && (
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            {["twitter","linkedin","instagram","tiktok"].map(pf => {
              const cap = clip.platformCaptions[pf];
              if(!cap) return null;
              const label = pf === "twitter" ? "X / Twitter" : pf === "linkedin" ? "LinkedIn" : pf === "instagram" ? "Instagram" : "TikTok";
              return (
                <div key={pf} className="rounded-lg border border-[color:var(--line)] p-2 text-[12px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-[color:var(--muted)]">{label}</span>
                    <button className="chip" onClick={()=>{ try{ navigator.clipboard.writeText(cap); } catch(e){} }}>Copy</button>
                  </div>
                  <div className="whitespace-pre-wrap break-words text-[color:var(--ink)]">{cap}</div>
                </div>
              );
            })}
          </div>
        )}
{clip.platformCaptions && typeof clip.platformCaptions === "object" && (
          <div className="mt-2">
            <button className="btn btn-outline text-xs" onClick={()=>{ try{ navigator.clipboard.writeText(JSON.stringify(clip.platformCaptions, null, 2)); } catch(e){} }}>Copy clip captions as JSON</button>
          </div>
        )}
                <div>
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Preset</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {REPURPOSE_PRESETS.map(p => {
              const active = clip.preset === p.id;
              return (
                <button key={p.id}
                  onClick={()=>onField("preset", p.id)}
                  aria-pressed={active}
                  className={"px-2.5 py-1.5 rounded-xl text-[12px] border " + (active ? "border-white/20 bg-white/10 text-white" : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-white")}>
                  {p.ratio}
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-[11px] text-[color:var(--muted)]">Platforms: {preset.platforms.join(" · ")}</div>
          <div className="mt-2 flex items-center gap-2">
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Start</span>
              <input type="number" min={0} value={clip.start}
                onChange={(e)=>onField("start", Math.max(0, parseInt(e.target.value||"0", 10)||0))}
                className="mt-1 w-24 bg-transparent border border-[color:var(--line)] rounded-md px-2 py-1 text-[12px] focus:outline-none focus:border-white/20"/>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">End</span>
              <input type="number" min={0} value={clip.end}
                onChange={(e)=>onField("end", Math.max(0, parseInt(e.target.value||"0", 10)||0))}
                className="mt-1 w-24 bg-transparent border border-[color:var(--line)] rounded-md px-2 py-1 text-[12px] focus:outline-none focus:border-white/20"/>
            </label>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button className="chip" onClick={()=>onRegen("title")}>{I.refresh({size:12})} Re-title</button>
          <button className="chip" onClick={()=>onRegen("hook")}>{I.refresh({size:12})} Re-hook</button>
          <button className="chip" onClick={()=>onRegen("virality")}>{I.flame({size:12})} Re-score</button>
        </div>
        <div className="flex items-center gap-1">
          <span className="chip">Status: {clip.status || "draft"}</span>
          <button className="chip" onClick={onRemove} aria-label="Remove clip">{I.x({size:12})}</button>
        </div>
      </div>
    </div>
  );
}

function clipRegenerate(field, clip){
  if(field === "title"){
    const pool = [
      "This one habit outperforms every supplement",
      "The truth almost nobody says out loud",
      "Why the top 1% do this every morning",
      "The single biggest mistake people make here",
      "What changed everything — in 60 seconds",
    ];
    return pool[Math.floor(Math.random()*pool.length)];
  }
  if(field === "hook"){
    const pool = [
      "If you remember one thing, remember this.",
      "This is the part everybody skips. Don't.",
      "Watch until the end — the payoff matters.",
      "Here's the research-backed version.",
    ];
    return pool[Math.floor(Math.random()*pool.length)];
  }
  if(field === "caption"){
    const pool = [
      "The single highest-ROI move, explained in 30 seconds.",
      "Save this for the next time it comes up.",
      "Why experts disagree with your feed.",
      "Counter-intuitive, but evidence-backed.",
    ];
    return pool[Math.floor(Math.random()*pool.length)];
  }
  if(field === "virality"){
    const v = Math.max(35, Math.min(99, (clip.virality||60) + Math.round((Math.random()*14)-7)));
    return v;
  }
  return null;
}

async function generateCaptionsViaClaude(proxyUrl, clip, project){
  const url = (proxyUrl||"").replace(/\/$/, "") + "/v1/messages";
  const brand = (project && project.brand) || "";
  const tool = { name: "emit_captions", description: "Return platform-native captions for X/Twitter, LinkedIn, Instagram, and TikTok for a single short-form clip.", input_schema: { type: "object", properties: { twitter: { type: "string", description: "X/Twitter caption, max 280 chars, 1-2 hashtags." }, linkedin: { type: "string", description: "LinkedIn caption, 2-4 short paragraphs, professional." }, instagram: { type: "string", description: "Instagram caption, hook + 3-8 hashtags at the end." }, tiktok: { type: "string", description: "TikTok caption, punchy, 1-3 emojis, 2-5 hashtags." } }, required: ["twitter","linkedin","instagram","tiktok"] } };
  const systemMsg = "You are a short-form video captioner. Produce platform-native captions for one clip. Use the provided tool and return tool_use only.";
  const userMsg = "BRAND: " + brand + "\n\nCLIP TITLE: " + (clip.title||"") + "\n\nCLIP CAPTION DRAFT:\n" + (clip.caption||"");
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1024, system: systemMsg, tools: [tool], tool_choice: { type: "tool", name: "emit_captions" }, messages: [{ role: "user", content: userMsg }] }) });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const block = Array.isArray(j.content) ? j.content.find(c => c && c.type === "tool_use" && c.name === "emit_captions") : null;
  if(!block || !block.input) throw new Error("no tool_use");
  return block.input;
}
function generateCaptionsLocal(clip, project){
  const title = (clip.title||"").trim();
  const base = (clip.caption||title||"Watch this clip.").trim();
  const brand = (project && project.brand) || "";
  const tagPool = ["shortform","creator","ai","video","viral","explainer"];
  const tagsLong = tagPool.map(x=>"#"+x).join(" ");
  const tagsShort = tagPool.slice(0,2).map(x=>"#"+x).join(" ");
  const twitter = (base.length > 260 ? base.slice(0,257) + "…" : base) + " " + tagsShort;
  const linkedin = (title ? title + "\n\n" : "") + base + (brand ? "\n\n— " + brand : "") + "\n\n" + tagsLong;
  const instagram = base + "\n\n.\n.\n.\n" + tagsLong;
  const tiktok = "🎬 " + base + " " + tagsShort;
  return { twitter: twitter.slice(0,280), linkedin: linkedin.slice(0,3000), instagram: instagram.slice(0,2200), tiktok: tiktok.slice(0,2200) };
}

function RepurposeTab(){
  const [project, setProject] = useLocalState("repurpose.project", REPURPOSE_SEED);
  useEffect(() => {
    if(project && typeof project === "object" && Array.isArray(project.clips) && project.clips.length > 0) return;
    setProject(REPURPOSE_SEED);
  }, []);
  const [sort, setSort] = useLocalState("repurpose.sort", "virality");
  const [selected, setSelected] = useLocalState("repurpose.selected", []);
  const [batchPreset, setBatchPreset] = useLocalState("repurpose.batchPreset", "vertical");

  const clipField = (clipId, field, value) => {
    setProject({ ...project, clips: project.clips.map(c => c.id===clipId ? { ...c, [field]: value } : c) });
  };
  const clipRegen = (clipId, field) => {
    const clip = project.clips.find(c => c.id === clipId);
    if(!clip) return;
    const v = clipRegenerate(field, clip);
    if(v === null) return;
    clipField(clipId, field, v);
  };
    const [captionsBusy, setCaptionsBusy] = useState(false);
  const [captionsSource, setCaptionsSource] = useState("");
  const generateAllCaptions = async () => {
    if(captionsBusy) return;
    setCaptionsBusy(true); setCaptionsSource("");
    const path = getAnthropicPath();
    let mode = "local";
    const updated = [];
    for(const clip of project.clips){
      let caps = null;
      if(path){
        try { caps = await generateCaptionsViaClaude(path, clip, project); mode = "claude"; } catch(e){ caps = null; }
      }
      if(!caps) caps = generateCaptionsLocal(clip, project);
      updated.push({ ...clip, platformCaptions: caps });
    }
    setProject({ ...project, clips: updated });
    setCaptionsSource(mode);
    setCaptionsBusy(false);
  };
  const downloadCaptionsJson = () => {
    if(!project.clips || project.clips.length === 0){ return; }
    const payload = {
      projectId: project.id || null,
      projectTitle: project.title || "",
      generatedAt: new Date().toISOString(),
      source: captionsSource || null,
      clips: project.clips.map(c => ({
        id: c.id,
        title: c.title || "",
        platformCaptions: c.platformCaptions || null
      }))
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const slug = (project.title || "zaidsaid-captions").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "zaidsaid-captions";
      a.download = slug + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try{ URL.revokeObjectURL(a.href); a.remove(); } catch(e){} }, 250);
    } catch(e) { console.warn("caption export failed:", e); }
  };
const removeClip = (clipId) => {
    setProject({ ...project, clips: project.clips.filter(c => c.id !== clipId) });
    setSelected(selected.filter(id => id !== clipId));
  };
  const addClip = () => {
    const nid = "c" + (project.clips.length + 1) + "_" + Math.random().toString(36).slice(2,6);
    const lastEnd = project.clips.length ? project.clips[project.clips.length-1].end : 0;
    setProject({
      ...project,
      clips: [...project.clips, {
        id: nid, title:"New highlight — edit me",
        start: lastEnd + 30, end: lastEnd + 65, virality: 60,
        hook:"Hook copy here.", caption:"Caption copy here.",
        preset:"vertical", status:"draft",
      }],
    });
  };
  const toggleSelected = (id) => {
    setSelected(selected.includes(id) ? selected.filter(x=>x!==id) : [...selected, id]);
  };
  const selectAll = () => setSelected(project.clips.map(c=>c.id));
  const clearSelected = () => setSelected([]);
  const applyBatchPreset = () => {
    if(!selected.length) return;
    setProject({ ...project, clips: project.clips.map(c => selected.includes(c.id) ? { ...c, preset: batchPreset } : c) });
  };
  const markApproved = () => {
    if(!selected.length) return;
    setProject({ ...project, clips: project.clips.map(c => selected.includes(c.id) ? { ...c, status: "approved" } : c) });
  };
  const resetSeed = () => setProject(REPURPOSE_SEED);

  const sorted = useMemo(() => {
    const arr = project.clips.slice();
    if(sort === "virality") arr.sort((a,b) => b.virality - a.virality);
    else if(sort === "duration") arr.sort((a,b) => clipDuration(b) - clipDuration(a));
    else if(sort === "start") arr.sort((a,b) => a.start - b.start);
    return arr;
  }, [project.clips, sort]);

  const approvedCount = project.clips.filter(c => c.status === "approved").length;
  const totalExportSec = project.clips
    .filter(c => selected.includes(c.id) || (!selected.length && c.status === "approved"))
    .reduce((a,c) => a + clipDuration(c), 0);

  return (
    <div className="max-w-[1400px] mx-auto px-5 py-8">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-3xl font-bold">Repurpose</h1>
          <p className="text-[color:var(--muted)] mt-1">Long-form in. Ranked, branded, platform-native shorts out.</p>
        </div>
        <div className="flex items-center gap-2">
                    <button className="btn" onClick={generateAllCaptions} disabled={captionsBusy || !project.clips || project.clips.length===0}>{captionsBusy ? "Generating…" : "Generate captions"}</button>
          <button className="btn btn-outline" onClick={downloadCaptionsJson} disabled={!project.clips || project.clips.length===0 || !project.clips.some(c=>c.platformCaptions)}>Download captions.json</button>
                    {captionsSource && (
            <span className={"chip " + (captionsSource === "claude" ? "text-emerald-200 !border-emerald-400/30 bg-emerald-500/10" : "text-sky-200 !border-sky-400/30 bg-sky-500/10")}>{captionsSource === "claude" ? "Claude" : "Local"}</span>
          )}
<button className="btn btn-ghost" onClick={resetSeed}>{I.refresh({size:14})} Reset to example</button>
        </div>
      </div>

      <div className="grid gap-4">
        <RepurposeIntake project={project} setProject={setProject} />
        <RepurposeAnalyzer project={project} setProject={setProject} />
        <RepurposeRealAnalyze project={project} setProject={setProject} />
        <RepurposeTranscriptStrip project={project} />

        <div className="card p-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Ranked highlights</div>
              <div className="text-lg font-semibold">{project.clips.length} clips · top pick {Math.max(...project.clips.map(c=>c.virality))} virality</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Sort by</span>
              {REPURPOSE_SORTS.map(s => (
                <button key={s.k}
                  onClick={()=>setSort(s.k)}
                  aria-pressed={sort===s.k}
                  className={"px-2.5 py-1.5 rounded-xl text-[12px] border " + (sort===s.k ? "border-white/20 bg-white/10 text-white" : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-white")}>
                  {s.label}
                </button>
              ))}
              <button className="chip" onClick={addClip}>{I.plus({size:12})} Add clip</button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button className="chip" onClick={selectAll}>Select all</button>
            <button className="chip" onClick={clearSelected}>Clear</button>
            <span className="chip">{selected.length} selected</span>
          </div>

          <div className="mt-4 grid gap-3">
            {sorted.map(c => {
              const checked = selected.includes(c.id);
              return (
                <div key={c.id} className={"relative " + (checked ? "ring-brand rounded-2xl" : "")}>
                  <label className="absolute -top-2 -left-2 z-10 flex items-center gap-1 bg-[color:var(--bg)] rounded-full px-2 py-0.5 border border-[color:var(--line)] text-[11px] text-[color:var(--muted)] cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={()=>toggleSelected(c.id)} className="accent-white" />
                    <span>Select</span>
                  </label>
                  <RepurposeClipCard
                    clip={c}
                    onField={(f,v)=>clipField(c.id, f, v)}
                    onRegen={(f)=>clipRegen(c.id, f)}
                    onRemove={()=>removeClip(c.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Batch export</div>
              <div className="text-lg font-semibold">Ship the selected clips</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Preset</span>
              {REPURPOSE_PRESETS.map(p => {
                const active = batchPreset === p.id;
                return (
                  <button key={p.id}
                    onClick={()=>setBatchPreset(p.id)}
                    aria-pressed={active}
                    className={"px-2.5 py-1.5 rounded-xl text-[12px] border " + (active ? "border-white/20 bg-white/10 text-white" : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-white")}>
                    {p.ratio}
                  </button>
                );
              })}
              <button className="btn" onClick={applyBatchPreset} disabled={!selected.length}>Apply to selected</button>
              <button className="btn" onClick={markApproved} disabled={!selected.length}>{I.check({size:14})} Mark approved</button>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-3 mt-3 text-sm">
            <div><div className="text-[color:var(--muted)] text-[11px]">Project</div><div className="truncate">{project.name}</div></div>
            <div><div className="text-[color:var(--muted)] text-[11px]">Selected</div><div>{selected.length} of {project.clips.length}</div></div>
            <div><div className="text-[color:var(--muted)] text-[11px]">Approved</div><div>{approvedCount}</div></div>
            <div><div className="text-[color:var(--muted)] text-[11px]">Output duration</div><div>{totalExportSec}s</div></div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button className="btn btn-primary" onClick={(e)=>e.preventDefault()} aria-disabled="true">{I.play({size:14})} Export batch (stub)</button>
            <span className="text-[11px] text-[color:var(--muted)]">Real export pipeline arrives in a later stage.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Toast system ---------------- */
const ToastCtx = React.createContext(null);
function ToastProvider({ children }){
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, kind) => {
    const id = Math.random().toString(36).slice(2,8);
    setToasts(t => [...t, { id, msg, kind: kind || "info" }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={Object.assign(push,{push})}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={"pointer-events-auto rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur " + (
            t.kind === "success" ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100" :
            t.kind === "error" ? "border-rose-400/30 bg-rose-500/15 text-rose-100" :
            "border-white/15 bg-white/10 text-white"
          )}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
const useToast = () => useContext(ToastCtx) || Object.assign(()=>{},{push:()=>{}});

// Stage 4/5 helper: a standalone Toast component used by tab-local setToast() callers.
// Auto-dismisses in 1.8s. Accepts { kind, msg, onClose }.
function Toast({ kind, msg, onClose }){
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => { onClose && onClose(); }, 1800);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  const color = kind === "warn" ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
             : kind === "error" ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
             : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={"px-3 py-2 rounded-xl border shadow-lg backdrop-blur flex items-center gap-2 text-sm " + color}>
        <span>{msg}</span>
        <button onClick={()=>onClose && onClose()} className="opacity-60 hover:opacity-100 text-xs">✕</button>
      </div>
    </div>
  );
}


/* ---------------- Modal ---------------- */
function Modal({ open, onClose, title, subtitle, children, maxWidth }){
  useEffect(() => {
    if(!open) return;
    const onKey = (e) => { if(e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if(!open) return null;
  const mw = maxWidth || "max-w-xl";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className={"relative w-full " + mw + " card p-6 max-h-[90vh] overflow-auto"}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            {title && <div className="text-lg font-semibold">{title}</div>}
            {subtitle && <div className="text-[12px] text-[color:var(--muted)] mt-0.5">{subtitle}</div>}
          </div>
          <button className="chip" onClick={onClose} aria-label="Close">{I.x({size:12})}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Drawer ---------------- */
function Drawer({ open, onClose, title, subtitle, children, width }){
  useEffect(() => {
    if(!open) return;
    const onKey = (e) => { if(e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if(!open) return null;
  const w = Math.min(width || 460, typeof window !== "undefined" ? window.innerWidth - 20 : 460);
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="absolute top-0 right-0 h-full bg-[color:var(--bg)] border-l border-[color:var(--line)] overflow-auto" style={{ width: w }}>
        <div className="p-5 border-b border-[color:var(--line)] flex items-start justify-between gap-3 sticky top-0 bg-[color:var(--bg)]/95 backdrop-blur z-10">
          <div>
            {title && <div className="text-lg font-semibold">{title}</div>}
            {subtitle && <div className="text-[12px] text-[color:var(--muted)] mt-0.5">{subtitle}</div>}
          </div>
          <button className="chip" onClick={onClose} aria-label="Close">{I.x({size:12})}</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- EmptyState / Tag / CopyButton ---------------- */
function EmptyState({ title, subtitle, action }){
  return (
    <div className="card p-10 text-center">
      <div className="text-lg font-semibold">{title}</div>
      {subtitle && <div className="text-[13px] text-[color:var(--muted)] mt-1">{subtitle}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
function Tag({ children, tone }){
  const map = {
    default: "border-[color:var(--line)] bg-white/5 text-white/80",
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    warn: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    danger: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    info: "border-sky-400/30 bg-sky-500/10 text-sky-200",
    brand: "border-indigo-400/30 bg-indigo-500/10 text-indigo-200"
  };
  const cls = map[tone || "default"] || map.default;
  return <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border " + cls}>{children}</span>;
}
function CopyButton({ text, label }){
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); toast("Copied","success"); setTimeout(()=>setCopied(false),1400); }
    catch(e){ toast("Couldn't copy","error"); }
  };
  return <button className="chip" onClick={onCopy} aria-label={label || "Copy"}>{copied ? "Copied" : (label || "Copy")}</button>;
}

/* ---------------- Placeholder tabs ---------------- */
function Placeholder({ title, subtitle, children }){
  return (
    <div className="max-w-[1400px] mx-auto px-5 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="text-[color:var(--muted)] mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
const AVATAR_SEED = [
  { id:"nova", name:"Nova", persona:"Anchor — calm and authoritative", tags:["news","explainer"], grad:"from-sky-500 via-indigo-500 to-violet-600", language:"English", voiceKind:"builtin", voiceName:"Google US English", rate:1.0, pitch:1.0, isDefault:true, clipDataUrl:null, builtIn:true, created: Date.now()-86400000*14 },
  { id:"atlas", name:"Atlas", persona:"Coach — energetic and warm", tags:["training","marketing"], grad:"from-amber-400 via-orange-500 to-rose-500", language:"English", voiceKind:"builtin", voiceName:"", rate:1.05, pitch:1.1, isDefault:false, clipDataUrl:null, builtIn:true, created: Date.now()-86400000*9 },
  { id:"vera", name:"Vera", persona:"Host — curious and bright", tags:["social","educational"], grad:"from-rose-400 via-pink-500 to-fuchsia-600", language:"English", voiceKind:"builtin", voiceName:"", rate:1.0, pitch:1.15, isDefault:false, clipDataUrl:null, builtIn:true, created: Date.now()-86400000*6 },
  { id:"orion", name:"Orion", persona:"Expert — deep and deliberate", tags:["longform","podcast"], grad:"from-emerald-400 via-teal-500 to-cyan-600", language:"English", voiceKind:"builtin", voiceName:"", rate:0.95, pitch:0.9, isDefault:false, clipDataUrl:null, builtIn:true, created: Date.now()-86400000*3 }
];

function getSpeechVoices(){
  try { return (typeof window !== "undefined" && window.speechSynthesis) ? window.speechSynthesis.getVoices() : []; }
  catch(e){ return []; }
}
function speakText(text, opts){
  try {
    if(!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text||"").slice(0,500));
    if(opts){
      if(opts.rate) u.rate = Math.max(0.5, Math.min(2, opts.rate));
      if(opts.pitch) u.pitch = Math.max(0, Math.min(2, opts.pitch));
      if(opts.voiceName){
        const v = getSpeechVoices().find(x => x.name === opts.voiceName);
        if(v) u.voice = v;
      }
      if(opts.lang) u.lang = opts.lang;
    }
    window.speechSynthesis.speak(u);
    return true;
  } catch(e){ return false; }
}
function stopSpeech(){ try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch(e){} }

const LANG_CODE = { English:"en-US", Spanish:"es-ES", Portuguese:"pt-BR", French:"fr-FR", German:"de-DE", Arabic:"ar-SA", Hindi:"hi-IN", Mandarin:"zh-CN", Japanese:"ja-JP", Korean:"ko-KR" };

function AvatarCard({ avatar, onEdit, onDuplicate, onDelete, onSetDefault, onPreview }){
  const isDef = !!avatar.isDefault;
  const gradient = avatar.grad || "from-indigo-500 via-fuchsia-500 to-cyan-500";
  return (
    <div className="card p-5 flex flex-col">
      <div className={"relative h-36 rounded-xl mb-3 bg-gradient-to-br " + gradient} aria-hidden>
        <div className="absolute inset-0 flex items-center justify-center text-white/90 text-4xl font-black">{(avatar.name||"?").slice(0,1).toUpperCase()}</div>
        {isDef && <div className="absolute top-2 left-2"><Tag tone="brand">Default</Tag></div>}
        {avatar.clipDataUrl && <div className="absolute top-2 right-2"><Tag tone="success">{I.mic({size:10})} Clone</Tag></div>}
      </div>
      <div className="flex items-center gap-2">
        <div className="font-semibold text-[15px]">{avatar.name}</div>
        <span className="text-[11px] text-[color:var(--muted)]">{avatar.language}</span>
      </div>
      <div className="text-[12px] text-[color:var(--muted)] mt-1 line-clamp-2">{avatar.persona}</div>
      <div className="mt-2 flex flex-wrap gap-1">{(avatar.tags||[]).map(t => <span key={t} className="chip">{t}</span>)}</div>
      <div className="mt-4 flex items-center gap-1 flex-wrap">
        <button className="chip" onClick={()=>onPreview(avatar)} aria-label="Preview voice">{I.play({size:12})} Preview</button>
        <button className="chip" onClick={()=>onEdit(avatar)}>{I.edit({size:12})} Edit</button>
        <button className="chip" onClick={()=>onDuplicate(avatar)}>{I.copy({size:12})} Duplicate</button>
        {!isDef && <button className="chip" onClick={()=>onSetDefault(avatar)}>{I.starOutline({size:12})} Default</button>}
        {!avatar.builtIn && <button className="chip" onClick={()=>onDelete(avatar)} aria-label="Delete avatar">{I.trash({size:12})}</button>}
      </div>
    </div>
  );
}

function AvatarEditor({ open, avatar, onClose, onSave }){
  const [form, setForm] = useState(avatar || null);
  const [voices, setVoices] = useState(getSpeechVoices());
  const [recording, setRecording] = useState(false);
  const [previewText, setPreviewText] = useState("Hello, I'm your new avatar. Let's make something great.");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const toast = useToast();
  useEffect(() => { setForm(avatar); }, [avatar && avatar.id]);
  useEffect(() => {
    if(!open) return;
    const refresh = () => setVoices(getSpeechVoices());
    refresh();
    if(window.speechSynthesis){
      window.speechSynthesis.onvoiceschanged = refresh;
      return () => { try { window.speechSynthesis.onvoiceschanged = null; } catch(e){} };
    }
  }, [open]);
  useEffect(() => () => {
    try { stopSpeech(); } catch(e){}
    if(streamRef.current){ try { streamRef.current.getTracks().forEach(t => t.stop()); } catch(e){} }
  }, []);
  if(!open || !form) return null;
  const set = (patch) => setForm(f => ({ ...f, ...patch }));
  const langCode = LANG_CODE[form.language] || "en-US";
  const voicesForLang = voices.filter(v => (v.lang||"").toLowerCase().startsWith((langCode||"").toLowerCase().slice(0,2)));
  const onPreview = () => {
    const ok = speakText(previewText, { rate: form.rate, pitch: form.pitch, voiceName: form.voiceName, lang: langCode });
    if(!ok) toast("Speech synthesis is not available in this browser.", "error");
  };
  const startRec = async () => {
    try {
      if(!navigator.mediaDevices || !window.MediaRecorder){ toast("Recording is not supported here.", "error"); return; }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if(e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const reader = new FileReader();
          reader.onload = () => { set({ clipDataUrl: reader.result }); toast("Voice sample saved to this avatar.", "success"); };
          reader.readAsDataURL(blob);
        } catch(e){ toast("Could not save recording.", "error"); }
        try { streamRef.current && streamRef.current.getTracks().forEach(t => t.stop()); } catch(e){}
        streamRef.current = null;
      };
      mr.start();
      setRecording(true);
    } catch(e){ toast("Microphone permission denied.", "error"); }
  };
  const stopRec = () => { try { mediaRef.current && mediaRef.current.stop(); } catch(e){} setRecording(false); };
  return (
    <Drawer open={open} onClose={onClose} title={form.id ? "Edit avatar" : "New avatar"} subtitle="Persona, voice, and a short sample." width={520}>
      <div className="flex flex-col gap-4">
        <div className={"relative h-32 rounded-xl bg-gradient-to-br " + (form.grad || "from-indigo-500 via-fuchsia-500 to-cyan-500")} aria-hidden>
          <div className="absolute inset-0 flex items-center justify-center text-white/90 text-4xl font-black">{(form.name||"?").slice(0,1).toUpperCase()}</div>
        </div>
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Name</span>
          <input value={form.name||""} onChange={(e)=>set({ name: e.target.value })} className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20" />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Persona</span>
          <textarea value={form.persona||""} onChange={(e)=>set({ persona: e.target.value })} rows={2} className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Language</span>
            <select value={form.language||"English"} onChange={(e)=>set({ language: e.target.value, voiceName: "" })} className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20">
              {["English","Spanish","Portuguese","French","German","Arabic","Hindi","Mandarin","Japanese","Korean"].map(l => <option key={l} value={l} style={{background:"#0b0b10"}}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Built-in voice</span>
            <select value={form.voiceName||""} onChange={(e)=>set({ voiceName: e.target.value })} className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20">
              <option value="" style={{background:"#0b0b10"}}>System default</option>
              {voicesForLang.map(v => <option key={v.name} value={v.name} style={{background:"#0b0b10"}}>{v.name} — {v.lang}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Rate {Number(form.rate||1).toFixed(2)}</span>
            <input type="range" min="0.5" max="2" step="0.05" value={form.rate||1} onChange={(e)=>set({ rate: parseFloat(e.target.value) })} className="w-full mt-1" />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Pitch {Number(form.pitch||1).toFixed(2)}</span>
            <input type="range" min="0" max="2" step="0.05" value={form.pitch||1} onChange={(e)=>set({ pitch: parseFloat(e.target.value) })} className="w-full mt-1" />
          </label>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Voice clone sample</div>
              <div className="text-[12px] text-[color:var(--muted)] mt-0.5">Record 10–30s of clean speech. Sample stays on this device.</div>
            </div>
            {!recording ? (
              <button className="chip" onClick={startRec}>{I.mic({size:12})} Record</button>
            ) : (
              <button className="chip" onClick={stopRec}>{I.x({size:12})} Stop</button>
            )}
          </div>
          {form.clipDataUrl && (
            <div className="mt-3">
              <audio controls src={form.clipDataUrl} className="w-full" />
              <div className="flex justify-end mt-1"><button className="chip" onClick={()=>set({ clipDataUrl: null })}>{I.trash({size:12})} Remove sample</button></div>
            </div>
          )}
        </div>
        <div className="card p-3">
          <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Preview text</div>
          <textarea value={previewText} onChange={(e)=>setPreviewText(e.target.value)} rows={2} className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20" />
          <div className="mt-2 flex items-center gap-2">
            <button className="btn" onClick={onPreview}>{I.play({size:12})} Speak</button>
            <button className="chip" onClick={stopSpeech}>{I.x({size:12})} Stop</button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>{ onSave(form); onClose(); }}>{I.check({size:14})} Save</button>
        </div>
      </div>
    </Drawer>
  );
}

function AvatarsTab(){
  const [avatars, setAvatars] = useLocalState("avatars", AVATAR_SEED);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if(!q) return avatars;
    return avatars.filter(a => [a.name, a.persona, a.language, (a.tags||[]).join(" ")].join(" ").toLowerCase().includes(q));
  }, [avatars, query]);
  const onNew = () => {
    const id = "av_" + Math.random().toString(36).slice(2,8);
    const grads = ["from-sky-500 via-indigo-500 to-violet-600","from-amber-400 via-orange-500 to-rose-500","from-rose-400 via-pink-500 to-fuchsia-600","from-emerald-400 via-teal-500 to-cyan-600","from-fuchsia-400 via-purple-500 to-indigo-700"];
    setEditing({ id, name:"New avatar", persona:"Describe this persona.", tags:["custom"], grad: grads[Math.floor(Math.random()*grads.length)], language:"English", voiceKind:"builtin", voiceName:"", rate:1.0, pitch:1.0, isDefault:false, clipDataUrl:null, builtIn:false, created: Date.now() });
  };
  const onSave = (a) => {
    setAvatars(list => {
      const exists = list.some(x => x.id === a.id);
      return exists ? list.map(x => x.id === a.id ? a : x) : [a, ...list];
    });
    toast("Avatar saved.", "success");
  };
  const onDuplicate = (a) => {
    const copy = { ...a, id: "av_" + Math.random().toString(36).slice(2,8), name: a.name + " copy", isDefault: false, builtIn: false, created: Date.now() };
    setAvatars(list => [copy, ...list]);
    toast("Duplicated.", "success");
  };
  const onDelete = (a) => {
    if(a.builtIn) { toast("Built-in avatars can't be deleted.", "error"); return; }
    if(!confirm("Delete " + a.name + "?")) return;
    setAvatars(list => list.filter(x => x.id !== a.id));
    toast("Deleted.", "info");
  };
  const onSetDefault = (a) => {
    setAvatars(list => list.map(x => ({ ...x, isDefault: x.id === a.id })));
    toast(a.name + " is now the default.", "success");
  };
  const onPreview = (a) => {
    const ok = speakText("Hi, I'm " + (a.name||"this avatar") + ". " + (a.persona||""), { rate: a.rate, pitch: a.pitch, voiceName: a.voiceName, lang: LANG_CODE[a.language] || "en-US" });
    if(!ok) toast("Speech synthesis unavailable.", "error");
  };
  const resetDemo = () => { if(!confirm("Reset avatars to the built-in demo set?")) return; setAvatars(AVATAR_SEED); toast("Reset.", "info"); };
  return (
    <div className="max-w-[1400px] mx-auto px-5 py-8">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-3xl font-bold">Avatars &amp; Voices</h1>
          <p className="text-[color:var(--muted)] mt-1 max-w-2xl">Personas, language, and a sample voice. Use the built-in browser voice for free, or record a short clip for future voice cloning when a provider is connected.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 focus-within:border-white/20">
            <span className="text-[color:var(--muted)]" aria-hidden>{I.search({size:14})}</span>
            <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search avatars" className="bg-transparent text-sm focus:outline-none w-44" />
          </div>
          <button className="btn btn-ghost" onClick={resetDemo}>{I.refresh({size:14})} Reset demo</button>
          <button className="btn btn-primary" onClick={onNew}>{I.plus({size:14})} New avatar</button>
        </div>
      </div>
      <div className="mb-4">
        <Tag tone="info">Local/free mode. When you connect a voice-cloning provider in Settings, recorded samples will be used to synthesize natural speech.</Tag>
      </div>

      {isGodMode && (
        <div className="mb-4">
          <details className="card p-4">
            <summary className="cursor-pointer flex items-center justify-between gap-2 flex-wrap list-none">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Voice & avatar providers</span>
                <Tag tone="brand">Proxy URLs only</Tag>
              </div>
              <span className="chip">{I.down({size:12})} Expand</span>
            </summary>
            <div className="mt-3 text-[12px] text-[color:var(--muted)]">Point each vendor at your server-side proxy. Raw API keys must stay on your server. Leave blank to keep using the built-in browser voice.</div>
            <div className="mt-3 grid gap-3">
              <ProvidersPanel filterCap="tts" />
              <ProvidersPanel filterCap="voiceClone" />
              <ProvidersPanel filterCap="avatarVideo" />
            </div>
          </details>
        </div>
      )}
            {filtered.length === 0 ? (
        <EmptyState title="No avatars match" subtitle="Try a different search or create a new avatar." action={<button className="btn btn-primary" onClick={onNew}>{I.plus({size:14})} New avatar</button>} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => <AvatarCard key={a.id} avatar={a} onEdit={setEditing} onDuplicate={onDuplicate} onDelete={onDelete} onSetDefault={onSetDefault} onPreview={onPreview} />)}
        </div>
      )}
      <AvatarEditor open={!!editing} avatar={editing} onClose={()=>setEditing(null)} onSave={onSave} />
    </div>
  );
}
function BrandsTab(){
  const [kits, setKits] = React.useState(() => {
    try { const raw = localStorage.getItem("zaidsaid.v2.brandkits"); if(raw) return JSON.parse(raw); } catch(e){}
    return ARCHIVE_BRAND_KITS.map(k => ({ ...k, isDefault: k.id==="bk-zs", tagline: k.id==="bk-zs" ? "Cinematic AI studio for creators" : (k.id==="bk-edu" ? "Clean educational explainers" : "Authoritative field journalism"), captionStyle: k.motion==="cinematic" ? "serif-lower" : (k.motion==="clean" ? "sans-upper" : "mono-bold") }));
  });
  const [editing, setEditing] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const [toast, setToast] = React.useState(null);
  const [preview, setPreview] = React.useState(null);

  React.useEffect(() => {
    try { localStorage.setItem("zaidsaid.v2.brandkits", JSON.stringify(kits)); } catch(e){}
  }, [kits]);

  const filtered = kits.filter(k => !search || (k.name+" "+(k.tagline||"")+" "+k.font+" "+k.motion+" "+k.voice).toLowerCase().includes(search.toLowerCase()));

  const onSave = (updated) => {
    setKits(prev => prev.map(k => k.id===updated.id ? updated : k));
    setEditing(null);
    setToast({ kind:"ok", msg:"Brand kit saved" });
  };
  const onNew = () => {
    const id = "bk-" + Math.random().toString(36).slice(2,8);
    const nk = { id, name:"New brand kit", tagline:"", primary:"#6366f1", secondary:"#22d3ee", accent:"#ec4899", font:"Inter", motion:"cinematic", voice:"warm", captionStyle:"sans-upper", isDefault:false };
    setKits(prev => [nk, ...prev]);
    setEditing(nk);
  };
  const onDuplicate = (k) => {
    const copy = { ...k, id:"bk-"+Math.random().toString(36).slice(2,8), name:k.name+" (copy)", isDefault:false };
    setKits(prev => [copy, ...prev]);
    setToast({ kind:"ok", msg:"Duplicated" });
  };
  const onDelete = (k) => {
    if (!confirm("Delete brand kit \""+k.name+"\"?")) return;
    setKits(prev => prev.filter(x => x.id!==k.id));
    setToast({ kind:"warn", msg:"Deleted" });
  };
  const onSetDefault = (k) => {
    setKits(prev => prev.map(x => ({ ...x, isDefault: x.id===k.id })));
    setToast({ kind:"ok", msg:"Default kit: "+k.name });
  };
  const onReset = () => {
    if (!confirm("Reset brand kits to the original demo set?")) return;
    try { localStorage.removeItem("zaidsaid.v2.brandkits"); } catch(e){}
    setKits(ARCHIVE_BRAND_KITS.map(k => ({ ...k, isDefault: k.id==="bk-zs", tagline: k.id==="bk-zs" ? "Cinematic AI studio for creators" : (k.id==="bk-edu" ? "Clean educational explainers" : "Authoritative field journalism"), captionStyle: k.motion==="cinematic" ? "serif-lower" : (k.motion==="clean" ? "sans-upper" : "mono-bold") })));
    setToast({ kind:"ok", msg:"Reset to demo" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold">Brand Kits</div>
          <div className="text-xs text-[color:var(--muted)]">Palettes, typography, motion & caption presets. Saved locally under zaidsaid.v2.brandkits.</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search kits" className="px-3 py-2 pr-8 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-white/30" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60">{I.search({size:14})}</span>
          </div>
          <button onClick={onReset} className="btn btn-ghost text-sm">{I.refresh({size:14})} Reset demo</button>
          <button onClick={onNew} className="btn btn-primary text-sm">{I.plus({size:14})} New kit</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={I.palette({size:28})} title="No brand kits match" hint="Clear the search or create a new kit." action={<button onClick={onNew} className="btn btn-primary text-sm">{I.plus({size:14})} New kit</button>} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(k => (
            <BrandKitCard key={k.id} kit={k} onEdit={setEditing} onPreview={setPreview} onDuplicate={onDuplicate} onDelete={onDelete} onSetDefault={onSetDefault} />
          ))}
        </div>
      )}

      <BrandKitEditor open={!!editing} kit={editing} onClose={()=>setEditing(null)} onSave={onSave} />
      <BrandKitPreview open={!!preview} kit={preview} onClose={()=>setPreview(null)} />
      {toast && <Toast kind={toast.kind} msg={toast.msg} onClose={()=>setToast(null)} />}
    </div>
  );
}

function BrandKitCard({ kit, onEdit, onPreview, onDuplicate, onDelete, onSetDefault }){
  const style = {
    background: "linear-gradient(135deg, "+kit.primary+"33, "+kit.secondary+"22, "+kit.accent+"22)",
    borderColor: kit.primary+"55"
  };
  return (
    <div className="card overflow-hidden border" style={{ borderColor:"rgba(255,255,255,0.08)" }}>
      <div className="h-28 relative" style={style}>
        <div className="absolute inset-0 flex items-end p-3">
          <div>
            <div className="text-xs uppercase tracking-wider opacity-70">{kit.motion} · {kit.voice}</div>
            <div className="text-lg font-semibold" style={{ fontFamily: kit.font }}>{kit.name}</div>
          </div>
        </div>
        {kit.isDefault && (
          <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/50 border border-white/15">DEFAULT</span>
        )}
      </div>
      <div className="p-3 space-y-3">
        <div className="text-xs text-[color:var(--muted)] line-clamp-2 min-h-[32px]">{kit.tagline || "No tagline yet."}</div>
        <div className="flex gap-2">
          <span title="Primary" className="w-7 h-7 rounded-lg border border-white/10" style={{ background: kit.primary }}></span>
          <span title="Secondary" className="w-7 h-7 rounded-lg border border-white/10" style={{ background: kit.secondary }}></span>
          <span title="Accent" className="w-7 h-7 rounded-lg border border-white/10" style={{ background: kit.accent }}></span>
          <div className="flex-1"></div>
          <Tag>{kit.font}</Tag>
          <Tag>{kit.captionStyle || "caption"}</Tag>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex gap-1">
            <button onClick={()=>onEdit(kit)} className="btn btn-ghost text-xs">{I.edit({size:12})} Edit</button>
            <button onClick={()=>onPreview(kit)} className="btn btn-ghost text-xs">{I.eye({size:12})} Preview</button>
          </div>
          <div className="flex gap-1">
            <button onClick={()=>onDuplicate(kit)} title="Duplicate" className="btn btn-ghost text-xs">{I.copy({size:12})}</button>
            {!kit.isDefault && <button onClick={()=>onSetDefault(kit)} title="Set default" className="btn btn-ghost text-xs">{I.star({size:12})}</button>}
            <button onClick={()=>onDelete(kit)} title="Delete" className="btn btn-ghost text-xs text-rose-300">{I.trash({size:12})}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const BRAND_FONTS = ["Inter","IBM Plex Sans","Source Serif Pro","Space Grotesk","JetBrains Mono","Playfair Display","Roboto","DM Sans","Merriweather","Poppins"];
const BRAND_MOTIONS = [
  { id:"cinematic", label:"Cinematic", hint:"Slow parallax, deep focus, lens flare" },
  { id:"clean", label:"Clean", hint:"Flat cards, soft fades, steady pacing" },
  { id:"kinetic", label:"Kinetic", hint:"Big type, whip pans, hard cuts" },
  { id:"whiteboard", label:"Whiteboard", hint:"Hand-drawn reveal, marker strokes" },
  { id:"docu", label:"Docu", hint:"Handheld, grain, interview kens" }
];
const BRAND_VOICES = [
  { id:"warm", label:"Warm & conversational" },
  { id:"friendly", label:"Friendly & upbeat" },
  { id:"authoritative", label:"Authoritative & serious" },
  { id:"playful", label:"Playful & quirky" },
  { id:"analytical", label:"Analytical & calm" }
];
const BRAND_CAPTIONS = [
  { id:"sans-upper", label:"Sans, uppercase, bold", preview:"WE SHIP ON FRIDAYS" },
  { id:"serif-lower", label:"Serif, lowercase, soft", preview:"we ship on fridays" },
  { id:"mono-bold", label:"Mono, bold, tight", preview:"WE_SHIP_ON_FRIDAYS" },
  { id:"karaoke", label:"Karaoke word-by-word", preview:"we · ship · on · fridays" }
];

function BrandKitEditor({ open, kit, onClose, onSave }){
  const [draft, setDraft] = React.useState(kit || null);
  React.useEffect(() => { setDraft(kit); }, [kit && kit.id]);
  if (!open || !draft) return null;
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  const swatchRow = (label, key) => (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-[color:var(--muted)] w-20">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <input type="color" value={draft[key]} onChange={e=>set({[key]:e.target.value})} className="w-10 h-8 rounded-md bg-transparent border border-white/10" />
        <input type="text" value={draft[key]} onChange={e=>set({[key]:e.target.value})} className="flex-1 px-2 py-1 text-xs rounded-md bg-white/5 border border-white/10 font-mono" />
      </div>
    </label>
  );
  return (
    <Drawer open={open} title={"Edit · "+draft.name} onClose={onClose} footer={
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
        <button onClick={()=>onSave(draft)} className="btn btn-primary text-sm">{I.check({size:14})} Save kit</button>
      </div>
    }>
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Identity</div>
          <label className="block">
            <span className="text-xs text-[color:var(--muted)]">Name</span>
            <input value={draft.name} onChange={e=>set({name:e.target.value})} className="mt-1 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-[color:var(--muted)]">Tagline</span>
            <input value={draft.tagline||""} onChange={e=>set({tagline:e.target.value})} placeholder="One-line description used in previews" className="mt-1 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
          </label>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Palette</div>
          {swatchRow("Primary","primary")}
          {swatchRow("Secondary","secondary")}
          {swatchRow("Accent","accent")}
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Typography</div>
          <select value={draft.font} onChange={e=>set({font:e.target.value})} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
            {BRAND_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="p-3 rounded-lg border border-white/10 bg-black/20">
            <div className="text-2xl" style={{ fontFamily: draft.font, color: draft.primary }}>The quick brown fox</div>
            <div className="text-sm opacity-80" style={{ fontFamily: draft.font }}>jumps over the lazy dog — 0123456789</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Motion preset</div>
          <div className="grid grid-cols-2 gap-2">
            {BRAND_MOTIONS.map(m => (
              <button key={m.id} onClick={()=>set({motion:m.id})} className={"text-left p-2 rounded-lg border text-xs " + (draft.motion===m.id ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 hover:border-white/20")}>
                <div className="font-semibold">{m.label}</div>
                <div className="text-[color:var(--muted)] mt-0.5">{m.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Voice tone</div>
          <div className="grid grid-cols-1 gap-1">
            {BRAND_VOICES.map(v => (
              <label key={v.id} className={"flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer " + (draft.voice===v.id ? "border-indigo-400 bg-indigo-500/10" : "border-white/10")}>
                <input type="radio" name="bvoice" checked={draft.voice===v.id} onChange={()=>set({voice:v.id})} />
                <span>{v.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Caption style</div>
          <div className="grid grid-cols-1 gap-2">
            {BRAND_CAPTIONS.map(c => (
              <button key={c.id} onClick={()=>set({captionStyle:c.id})} className={"text-left p-2 rounded-lg border text-xs " + (draft.captionStyle===c.id ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 hover:border-white/20")}>
                <div className="font-semibold">{c.label}</div>
                <div className="mt-1 font-mono text-[11px] opacity-80">{c.preview}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function BrandKitPreview({ open, kit, onClose }){
  if (!open || !kit) return null;
  const captionSample = (BRAND_CAPTIONS.find(c => c.id === kit.captionStyle) || BRAND_CAPTIONS[0]).preview;
  return (
    <Modal open={open} title={"Preview · "+kit.name} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-xl overflow-hidden border border-white/10" style={{ aspectRatio:"16/9", background:"linear-gradient(135deg, "+kit.primary+", "+kit.secondary+" 60%, "+kit.accent+")" }}>
          <div className="w-full h-full flex flex-col justify-between p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.2em] opacity-80" style={{ fontFamily: kit.font }}>{kit.motion} · {kit.voice}</div>
              <div className="text-[11px] opacity-70" style={{ fontFamily: kit.font }}>zaidsaid.com</div>
            </div>
            <div>
              <div className="text-3xl font-semibold leading-tight drop-shadow" style={{ fontFamily: kit.font }}>{kit.name}</div>
              <div className="text-sm opacity-90 mt-1" style={{ fontFamily: kit.font }}>{kit.tagline || "Your brand preview"}</div>
            </div>
            <div className="self-start inline-block px-3 py-1 rounded-md text-[11px] font-bold" style={{ background:"rgba(0,0,0,0.55)", color: "#fff", fontFamily: kit.captionStyle === "mono-bold" ? "JetBrains Mono, monospace" : kit.font, letterSpacing: kit.captionStyle === "sans-upper" ? "0.1em" : "0" }}>{captionSample}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="p-2 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Primary</div><div className="font-mono">{kit.primary}</div></div>
          <div className="p-2 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Secondary</div><div className="font-mono">{kit.secondary}</div></div>
          <div className="p-2 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Accent</div><div className="font-mono">{kit.accent}</div></div>
        </div>
      </div>
    </Modal>
  );
}
const TEMPLATES_SEED = [
  { id:"tpl-explainer-60", name:"60s Explainer", cat:"Education", platform:"TikTok", duration:60, aspect:"9:16", difficulty:"easy", kit:"bk-edu", blurb:"Hook → 3 beats → CTA. Works for any 'how it works' topic.", steps:["Hook (5s)","Beat 1","Beat 2","Beat 3","CTA"], tags:["explainer","edu","short"], hero:{ from:"#0ea5e9", to:"#22c55e" } },
  { id:"tpl-product-reveal", name:"Product Reveal", cat:"Marketing", platform:"Reels", duration:45, aspect:"9:16", difficulty:"medium", kit:"bk-zs", blurb:"Teaser → feature sweep → price → CTA. Cinematic brand-heavy cut.", steps:["Teaser","Feature 1","Feature 2","Feature 3","Price","CTA"], tags:["product","launch","reel"], hero:{ from:"#6366f1", to:"#ec4899" } },
  { id:"tpl-news-hit", name:"News Hit", cat:"News", platform:"YouTube Shorts", duration:75, aspect:"9:16", difficulty:"medium", kit:"bk-news", blurb:"Breaking headline → context → receipts → takeaway.", steps:["Headline","Context","Receipts","Takeaway"], tags:["news","timely"], hero:{ from:"#111827", to:"#f97316" } },
  { id:"tpl-interview-long", name:"Interview Teaser → Long", cat:"Podcast", platform:"YouTube", duration:240, aspect:"16:9", difficulty:"hard", kit:"bk-zs", blurb:"Cold-open clip → guest intro → 3 segments → outro.", steps:["Cold open","Intro","Segment 1","Segment 2","Segment 3","Outro"], tags:["interview","podcast","longform"], hero:{ from:"#7c3aed", to:"#22d3ee" } },
  { id:"tpl-devtalk", name:"Dev Talk — whiteboard", cat:"Education", platform:"YouTube", duration:180, aspect:"16:9", difficulty:"medium", kit:"bk-edu", blurb:"Problem → bad approach → good approach → code demo.", steps:["Problem","Naive approach","Better approach","Demo","Recap"], tags:["coding","tech","whiteboard"], hero:{ from:"#0ea5e9", to:"#6366f1" } },
  { id:"tpl-list-top5", name:"Top 5 Listicle", cat:"Entertainment", platform:"TikTok", duration:50, aspect:"9:16", difficulty:"easy", kit:"bk-zs", blurb:"Countdown with big captions, kinetic cuts, punchy SFX.", steps:["Tease #1","#5","#4","#3","#2","#1","CTA"], tags:["list","fast","fun"], hero:{ from:"#ec4899", to:"#f97316" } },
  { id:"tpl-testimonial", name:"Testimonial Cutdown", cat:"Marketing", platform:"LinkedIn", duration:45, aspect:"1:1", difficulty:"easy", kit:"bk-zs", blurb:"Pull quote → B-roll → metric card → CTA.", steps:["Pull quote","B-roll","Metric","CTA"], tags:["social-proof","b2b"], hero:{ from:"#22c55e", to:"#0ea5e9" } },
  { id:"tpl-tutorial", name:"Tutorial — step by step", cat:"Education", platform:"YouTube", duration:360, aspect:"16:9", difficulty:"medium", kit:"bk-edu", blurb:"Intro → prerequisites → 5 steps → recap.", steps:["Intro","Prereqs","Step 1","Step 2","Step 3","Step 4","Step 5","Recap"], tags:["tutorial","howto"], hero:{ from:"#22c55e", to:"#eab308" } },
  { id:"tpl-case-study", name:"Case Study", cat:"B2B", platform:"LinkedIn", duration:120, aspect:"16:9", difficulty:"hard", kit:"bk-news", blurb:"Challenge → solution → result → lesson.", steps:["Challenge","Solution","Result","Lesson"], tags:["b2b","enterprise"], hero:{ from:"#111827", to:"#6366f1" } },
  { id:"tpl-ama", name:"AMA Quick Answer", cat:"Community", platform:"Reels", duration:30, aspect:"9:16", difficulty:"easy", kit:"bk-zs", blurb:"Question on screen → avatar answer → CTA to follow.", steps:["Question","Answer","CTA"], tags:["community","q&a"], hero:{ from:"#f59e0b", to:"#ef4444" } },
  { id:"tpl-recap", name:"Weekly Recap", cat:"News", platform:"YouTube Shorts", duration:90, aspect:"9:16", difficulty:"medium", kit:"bk-news", blurb:"5 headlines → sponsor card → 1 takeaway.", steps:["Intro","Story 1","Story 2","Story 3","Story 4","Story 5","Takeaway"], tags:["recap","weekly"], hero:{ from:"#ef4444", to:"#f59e0b" } },
  { id:"tpl-pov", name:"POV Skit", cat:"Entertainment", platform:"TikTok", duration:20, aspect:"9:16", difficulty:"easy", kit:"bk-zs", blurb:"Setup → twist → reaction.", steps:["Setup","Twist","Reaction"], tags:["skit","fun"], hero:{ from:"#ec4899", to:"#22d3ee" } }
];

function TemplatesTab(){
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("All");
  const [platform, setPlatform] = React.useState("All");
  const [diff, setDiff] = React.useState("All");
  const [preview, setPreview] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [favs, setFavs] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("zaidsaid.v2.template.favs") || "[]"); } catch(e){ return []; }
  });
  React.useEffect(() => {
    try { localStorage.setItem("zaidsaid.v2.template.favs", JSON.stringify(favs)); } catch(e){}
  }, [favs]);

  const cats = ["All", ...new Set(TEMPLATES_SEED.map(t => t.cat))];
  const plats = ["All", ...new Set(TEMPLATES_SEED.map(t => t.platform))];
  const diffs = ["All","easy","medium","hard"];

  const list = TEMPLATES_SEED.filter(t => {
    if (cat !== "All" && t.cat !== cat) return false;
    if (platform !== "All" && t.platform !== platform) return false;
    if (diff !== "All" && t.difficulty !== diff) return false;
    if (q) {
      const hay = (t.name+" "+t.blurb+" "+t.tags.join(" ")+" "+t.cat+" "+t.platform).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const toggleFav = (id) => setFavs(f => f.includes(id) ? f.filter(x => x!==id) : [...f, id]);

  const useTemplate = (t) => {
    try {
      localStorage.setItem("zaidsaid.v2.studio.seed", JSON.stringify({
        templateId: t.id, name: t.name, steps: t.steps, kit: t.kit,
        platform: t.platform, duration: t.duration, aspect: t.aspect,
        seededAt: Date.now()
      }));
    } catch(e){}
    setToast({ kind:"ok", msg:"Seeded Studio with "+t.name });
    setTimeout(() => { window.location.hash = "#studio?step=research"; }, 600);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold">Templates</div>
          <div className="text-xs text-[color:var(--muted)]">Start from a proven shape. Click a card to preview, then 'Use template' to seed Studio.</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search templates" className="px-3 py-2 pr-8 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-white/30 w-52" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60">{I.search({size:14})}</span>
          </div>
          <select value={cat} onChange={e=>setCat(e.target.value)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm">
            {cats.map(c => <option key={c} value={c}>{c === "All" ? "All categories" : c}</option>)}
          </select>
          <select value={platform} onChange={e=>setPlatform(e.target.value)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm">
            {plats.map(p => <option key={p} value={p}>{p === "All" ? "All platforms" : p}</option>)}
          </select>
          <select value={diff} onChange={e=>setDiff(e.target.value)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm">
            {diffs.map(d => <option key={d} value={d}>{d === "All" ? "Any difficulty" : d}</option>)}
          </select>
        </div>
      </div>

      <div className="text-xs text-[color:var(--muted)]">{list.length} of {TEMPLATES_SEED.length} templates</div>

      {list.length === 0 ? (
        <EmptyState icon={I.layers({size:28})} title="No templates match your filters" hint="Try clearing the search or changing platform." />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(t => (
            <TemplateCard key={t.id} tpl={t} fav={favs.includes(t.id)} onFav={toggleFav} onPreview={setPreview} onUse={useTemplate} />
          ))}
        </div>
      )}

      <TemplatePreview open={!!preview} tpl={preview} onClose={()=>setPreview(null)} onUse={useTemplate} />
      {toast && <Toast kind={toast.kind} msg={toast.msg} onClose={()=>setToast(null)} />}
    </div>
  );
}

function TemplateCard({ tpl, fav, onFav, onPreview, onUse }){
  const diffColor = tpl.difficulty === "easy" ? "text-emerald-300" : (tpl.difficulty === "medium" ? "text-amber-300" : "text-rose-300");
  return (
    <div className="card overflow-hidden border border-white/10">
      <button onClick={()=>onPreview(tpl)} className="block w-full h-28 relative text-left" style={{ background: "linear-gradient(135deg, "+tpl.hero.from+", "+tpl.hero.to+")" }}>
        <div className="absolute inset-0 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded-full border border-white/10">{tpl.platform}</span>
            <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full border border-white/10">{tpl.aspect}</span>
          </div>
          <div>
            <div className="text-base font-semibold leading-tight">{tpl.name}</div>
            <div className="text-[11px] opacity-80">{tpl.duration}s · {tpl.cat}</div>
          </div>
        </div>
      </button>
      <div className="p-3 space-y-3">
        <div className="text-xs text-[color:var(--muted)] line-clamp-2 min-h-[32px]">{tpl.blurb}</div>
        <div className="flex items-center gap-1 flex-wrap">
          <span className={"text-[10px] "+diffColor}>● {tpl.difficulty}</span>
          <span className="text-[color:var(--muted)] text-[10px]">·</span>
          <span className="text-[10px] text-[color:var(--muted)]">{tpl.steps.length} steps</span>
          <div className="flex-1"></div>
          {tpl.tags.slice(0,2).map(tag => <Tag key={tag}>{tag}</Tag>)}
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex gap-1">
            <button onClick={()=>onPreview(tpl)} className="btn btn-ghost text-xs">{I.eye({size:12})} Preview</button>
            <button onClick={()=>onUse(tpl)} className="btn btn-primary text-xs">{I.play({size:12})} Use template</button>
          </div>
          <button onClick={()=>onFav(tpl.id)} title={fav?"Unfavorite":"Favorite"} className="btn btn-ghost text-xs">
            {fav ? <span className="text-amber-300">{I.star({size:14})}</span> : I.starOutline({size:14})}
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplatePreview({ open, tpl, onClose, onUse }){
  if (!open || !tpl) return null;
  return (
    <Modal open={open} title={tpl.name} onClose={onClose} footer={
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn btn-ghost text-sm">Close</button>
        <button onClick={()=>{ onUse(tpl); onClose(); }} className="btn btn-primary text-sm">{I.play({size:14})} Use template</button>
      </div>
    }>
      <div className="space-y-3">
        <div className="rounded-xl overflow-hidden border border-white/10" style={{ aspectRatio:"16/9", background:"linear-gradient(135deg, "+tpl.hero.from+", "+tpl.hero.to+")" }}>
          <div className="w-full h-full flex flex-col justify-between p-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded-full border border-white/10">{tpl.platform}</span>
              <span className="text-[11px] bg-black/40 px-2 py-0.5 rounded-full border border-white/10">{tpl.aspect}</span>
              <span className="text-[11px] bg-black/40 px-2 py-0.5 rounded-full border border-white/10">{tpl.duration}s</span>
            </div>
            <div className="text-2xl font-semibold">{tpl.name}</div>
          </div>
        </div>
        <p className="text-sm text-[color:var(--muted)]">{tpl.blurb}</p>
        <div>
          <div className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">Structure ({tpl.steps.length} beats)</div>
          <ol className="space-y-1 text-sm">
            {tpl.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2 p-2 rounded-lg border border-white/10 bg-white/5">
                <span className="text-[10px] w-5 h-5 rounded-full border border-white/20 flex items-center justify-center">{i+1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-wrap gap-1">
          {tpl.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
        </div>
        <div className="text-xs text-[color:var(--muted)]">Brand kit: <span className="font-mono">{tpl.kit}</span> · difficulty: <span className="capitalize">{tpl.difficulty}</span> · category: {tpl.cat}</div>
      </div>
    </Modal>
  );
}
function ProjectsTab(){
  const [jobs, setJobs] = React.useState(() => {
    try { const raw = localStorage.getItem("zaidsaid.v2.projects"); if (raw) return JSON.parse(raw); } catch(e){}
    return ARCHIVE_JOBS.map((j, i) => ({
      ...j,
      updated: Date.now() - (i+1) * 86400000,
      owner: ["You","Ada","Kai","Maya"][i % 4],
      kit: ["bk-zs","bk-edu","bk-news"][i % 3],
      tags: (j.title||"").toLowerCase().includes("repurpose") ? ["repurpose","shorts"] : ((j.title||"").toLowerCase().includes("gps") ? ["physics","explainer"] : ["explainer"]),
      versions: [
        { v:"v1", at: Date.now() - (i+2)*86400000, note:"First pass render" },
        { v:"v2", at: Date.now() - (i+1)*86400000, note:"Tightened pacing, fixed caption timing" }
      ],
      comments: i === 0 ? [
        { author:"Ada", at: Date.now() - 3600000, body:"Love the opening beat. Can we shorten beat 2?" }
      ] : []
    }));
  });
  const [view, setView] = React.useState("grid"); // grid | list
  const [status, setStatus] = React.useState("All");
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState("recent");
  const [drawer, setDrawer] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  React.useEffect(() => {
    try { localStorage.setItem("zaidsaid.v2.projects", JSON.stringify(jobs)); } catch(e){}
  }, [jobs]);

  const statuses = ["All","done","running","queued","failed"];
  const list = jobs
    .filter(j => status === "All" || (j.status||"").toLowerCase() === status)
    .filter(j => !q || (j.title+" "+(j.caption||"")+" "+(j.tags||[]).join(" ")).toLowerCase().includes(q.toLowerCase()))
    .sort((a,b) => {
      if (sort === "recent") return (b.updated||0) - (a.updated||0);
      if (sort === "title") return (a.title||"").localeCompare(b.title||"");
      if (sort === "duration") return (b.duration||0) - (a.duration||0);
      return 0;
    });

  const onOpen = (j) => setDrawer(j);
  const onDuplicate = (j) => {
    const copy = { ...j, id: Math.random().toString(36).slice(2,14), title: j.title + " (copy)", status:"queued", updated: Date.now(), versions:[{ v:"v1", at:Date.now(), note:"Duplicated" }], comments:[] };
    setJobs(prev => [copy, ...prev]);
    setToast({ kind:"ok", msg:"Duplicated to queue" });
  };
  const onDelete = (j) => {
    if (!confirm("Delete project \""+j.title+"\"? This cannot be undone.")) return;
    setJobs(prev => prev.filter(x => x.id !== j.id));
    setDrawer(null);
    setToast({ kind:"warn", msg:"Deleted" });
  };
  const onStatus = (j, next) => {
    setJobs(prev => prev.map(x => x.id === j.id ? { ...x, status: next, updated: Date.now() } : x));
    setToast({ kind:"ok", msg:"Status: "+next });
  };
  const onAddComment = (j, body) => {
    if (!body.trim()) return;
    setJobs(prev => prev.map(x => x.id === j.id ? { ...x, comments: [...(x.comments||[]), { author:"You", at: Date.now(), body }] } : x));
  };
  const onNewVersion = (j) => {
    const next = "v"+(((j.versions||[]).length)+1);
    setJobs(prev => prev.map(x => x.id === j.id ? { ...x, versions: [...(x.versions||[]), { v: next, at: Date.now(), note:"Manual save" }], updated: Date.now() } : x));
    setToast({ kind:"ok", msg:"Saved "+next });
  };
  const onReset = () => {
    if (!confirm("Reset projects to demo data?")) return;
    try { localStorage.removeItem("zaidsaid.v2.projects"); } catch(e){}
    window.location.reload();
  };

  const live = drawer ? (jobs.find(j => j.id === drawer.id) || drawer) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold">Projects</div>
          <div className="text-xs text-[color:var(--muted)]">All renders, drafts, and repurposes. Saved locally under zaidsaid.v2.projects.</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search projects" className="px-3 py-2 pr-8 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-white/30 w-48" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60">{I.search({size:14})}</span>
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm">
            <option value="recent">Most recent</option>
            <option value="title">Title A→Z</option>
            <option value="duration">Longest first</option>
          </select>
          <div className="flex rounded-xl border border-white/10 overflow-hidden">
            <button onClick={()=>setView("grid")} title="Grid view" className={"px-3 py-2 text-xs " + (view==="grid" ? "bg-white/10" : "")}>{I.layers({size:14})}</button>
            <button onClick={()=>setView("list")} title="List view" className={"px-3 py-2 text-xs " + (view==="list" ? "bg-white/10" : "")}>{I.menu({size:14})}</button>
          </div>
          <button onClick={onReset} className="btn btn-ghost text-sm">{I.refresh({size:14})} Reset</button>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {statuses.map(f => (
          <button key={f} onClick={()=>setStatus(f)} className={"chip " + (status === f ? "chip-active" : "")}>{f === "All" ? "All" : f.charAt(0).toUpperCase()+f.slice(1)} <span className="opacity-60 ml-1 text-[10px]">{f === "All" ? jobs.length : jobs.filter(j => (j.status||"").toLowerCase() === f).length}</span></button>
        ))}
        <div className="flex-1"></div>
        <div className="text-xs text-[color:var(--muted)]">{list.length} of {jobs.length}</div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={I.layers({size:28})} title="No projects match" hint="Clear filters or create a new one from Studio." />
      ) : view === "grid" ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(j => <ProjectCard key={j.id} j={j} onOpen={onOpen} onDuplicate={onDuplicate} onDelete={onDelete} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-[color:var(--muted)]">
              <tr>
                <th className="text-left px-3 py-2">Title</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Duration</th>
                <th className="text-left px-3 py-2">Owner</th>
                <th className="text-left px-3 py-2">Updated</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(j => (
                <tr key={j.id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={()=>onOpen(j)}>
                  <td className="px-3 py-2">
                    <div className="font-medium line-clamp-1">{j.title}</div>
                    <div className="text-[11px] text-[color:var(--muted)] line-clamp-1">{j.caption}</div>
                  </td>
                  <td className="px-3 py-2"><StatusChip status={j.status} /></td>
                  <td className="px-3 py-2">{j.duration}s</td>
                  <td className="px-3 py-2">{j.owner}</td>
                  <td className="px-3 py-2 text-[11px] text-[color:var(--muted)]">{formatAge(j.updated)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={e=>{e.stopPropagation(); onDuplicate(j);}} className="btn btn-ghost text-xs">{I.copy({size:12})}</button>
                    <button onClick={e=>{e.stopPropagation(); onDelete(j);}} className="btn btn-ghost text-xs text-rose-300">{I.trash({size:12})}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProjectDrawer open={!!live} j={live} onClose={()=>setDrawer(null)} onDuplicate={onDuplicate} onDelete={onDelete} onStatus={onStatus} onAddComment={onAddComment} onNewVersion={onNewVersion} />
      {toast && <Toast kind={toast.kind} msg={toast.msg} onClose={()=>setToast(null)} />}
    </div>
  );
}

function formatAge(ts){
  if (!ts) return "—";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s/60); if (m < 60) return m+"m ago";
  const h = Math.floor(m/60); if (h < 24) return h+"h ago";
  const d = Math.floor(h/24); if (d < 30) return d+"d ago";
  return new Date(ts).toLocaleDateString();
}

function StatusChip({ status }){
  const s = (status || "queued").toLowerCase();
  const map = {
    done: { c:"bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label:"Done" },
    running: { c:"bg-sky-500/15 text-sky-300 border-sky-500/30", label:"Running" },
    queued: { c:"bg-amber-500/15 text-amber-300 border-amber-500/30", label:"Queued" },
    failed: { c:"bg-rose-500/15 text-rose-300 border-rose-500/30", label:"Failed" }
  };
  const m = map[s] || map.queued;
  return <span className={"text-[11px] px-2 py-0.5 rounded-full border "+m.c}>{m.label}</span>;
}

function ProjectCard({ j, onOpen, onDuplicate, onDelete }){
  return (
    <div className="card overflow-hidden border border-white/10">
      <button onClick={()=>onOpen(j)} className={"block w-full h-28 relative text-left bg-gradient-to-br "+(j.grad||"from-indigo-500 to-violet-700")}>
        <div className="absolute inset-0 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <StatusChip status={j.status} />
            <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full border border-white/10">{j.duration}s</span>
          </div>
          <div>
            <div className="text-base font-semibold leading-tight line-clamp-2">{j.title}</div>
            <div className="text-[11px] opacity-80">{j.owner} · {formatAge(j.updated)}</div>
          </div>
        </div>
      </button>
      <div className="p-3 space-y-3">
        <div className="text-xs text-[color:var(--muted)] line-clamp-2 min-h-[32px]">{j.caption}</div>
        <div className="flex items-center gap-1 flex-wrap">
          {(j.tags||[]).slice(0,3).map(t => <Tag key={t}>{t}</Tag>)}
          <div className="flex-1"></div>
          <span className="text-[10px] text-[color:var(--muted)]">v{(j.versions||[]).length || 1} · {(j.comments||[]).length} {(j.comments||[]).length === 1 ? "comment" : "comments"}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button onClick={()=>onOpen(j)} className="btn btn-ghost text-xs">{I.eye({size:12})} Open</button>
          <div className="flex gap-1">
            <button onClick={()=>onDuplicate(j)} title="Duplicate" className="btn btn-ghost text-xs">{I.copy({size:12})}</button>
            <button onClick={()=>onDelete(j)} title="Delete" className="btn btn-ghost text-xs text-rose-300">{I.trash({size:12})}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectDrawer({ open, j, onClose, onDuplicate, onDelete, onStatus, onAddComment, onNewVersion }){
  const [tab, setTab] = React.useState("overview");
  const [comment, setComment] = React.useState("");
  React.useEffect(() => { setTab("overview"); setComment(""); }, [j && j.id]);
  if (!open || !j) return null;
  return (
    <Drawer open={open} title={j.title} onClose={onClose} footer={
      <div className="flex justify-between gap-2 items-center">
        <div className="flex gap-1">
          <button onClick={()=>onDuplicate(j)} className="btn btn-ghost text-xs">{I.copy({size:12})} Duplicate</button>
          <button onClick={()=>onDelete(j)} className="btn btn-ghost text-xs text-rose-300">{I.trash({size:12})} Delete</button>
        </div>
        <button onClick={onClose} className="btn btn-primary text-sm">{I.check({size:14})} Done</button>
      </div>
    }>
      <div className="space-y-4">
        <div className={"rounded-xl overflow-hidden bg-gradient-to-br "+(j.grad||"from-indigo-500 to-violet-700")} style={{ aspectRatio:"16/9" }}>
          <div className="w-full h-full flex items-end p-3">
            <div>
              <StatusChip status={j.status} />
              <div className="text-lg font-semibold mt-1 drop-shadow line-clamp-2">{j.title}</div>
              <div className="text-[11px] opacity-80">{j.owner} · {formatAge(j.updated)} · {j.duration}s</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[color:var(--muted)]">Set status:</span>
          {["done","running","queued","failed"].map(s => (
            <button key={s} onClick={()=>onStatus(j, s)} className={"chip "+(j.status===s?"chip-active":"")}>{s}</button>
          ))}
        </div>

        <div className="flex gap-1 border-b border-white/10">
          {[["overview","Overview"],["versions","Versions"],["comments","Comments"],["details","Details"]].map(([id,label]) => (
            <button key={id} onClick={()=>setTab(id)} className={"px-3 py-2 text-xs " + (tab === id ? "border-b-2 border-indigo-400 text-white" : "text-[color:var(--muted)]")}>{label}</button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-3">
            <p className="text-sm">{j.caption}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Duration</div><div>{j.duration}s</div></div>
              <div className="p-2 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Platforms</div><div>{j.platforms} targets</div></div>
              <div className="p-2 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Brand kit</div><div className="font-mono">{j.kit}</div></div>
              <div className="p-2 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Versions</div><div>{(j.versions||[]).length || 1}</div></div>
            </div>
            <div className="flex flex-wrap gap-1">{(j.tags||[]).map(t => <Tag key={t}>{t}</Tag>)}</div>
          </div>
        )}

        {tab === "versions" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-[color:var(--muted)]">History</div>
              <button onClick={()=>onNewVersion(j)} className="btn btn-ghost text-xs">{I.plus({size:12})} New version</button>
            </div>
            {(j.versions||[]).length === 0 ? (
              <div className="text-xs text-[color:var(--muted)]">No versions yet.</div>
            ) : (
              <ul className="space-y-1">
                {[...(j.versions||[])].reverse().map((v, i) => (
                  <li key={i} className="p-2 rounded-lg border border-white/10 bg-white/5">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-xs">{v.v}</div>
                      <div className="text-[10px] text-[color:var(--muted)]">{formatAge(v.at)}</div>
                    </div>
                    <div className="text-xs mt-1">{v.note}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "comments" && (
          <div className="space-y-2">
            <div className="space-y-1 max-h-52 overflow-auto">
              {(j.comments||[]).length === 0 ? (
                <div className="text-xs text-[color:var(--muted)]">No comments yet.</div>
              ) : (j.comments||[]).map((c, i) => (
                <div key={i} className="p-2 rounded-lg border border-white/10 bg-white/5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold">{c.author}</div>
                    <div className="text-[10px] text-[color:var(--muted)]">{formatAge(c.at)}</div>
                  </div>
                  <div className="text-xs mt-1">{c.body}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={comment} onChange={e=>setComment(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter' && comment.trim()) { onAddComment(j, comment); setComment(""); } }} placeholder="Write a comment…" className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm" />
              <button onClick={()=>{ if(comment.trim()) { onAddComment(j, comment); setComment(""); } }} className="btn btn-primary text-xs">{I.comment({size:12})} Post</button>
            </div>
          </div>
        )}

        {tab === "details" && (
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded-lg border border-white/10 font-mono break-all">id: {j.id}</div>
            <div className="p-2 rounded-lg border border-white/10">owner: {j.owner}</div>
            <div className="p-2 rounded-lg border border-white/10">brand kit: <span className="font-mono">{j.kit}</span></div>
            <div className="p-2 rounded-lg border border-white/10">updated: {new Date(j.updated).toLocaleString()}</div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
const PIPELINE_STAGES = [
  { id:"research", label:"Research", icon:"search", providers:["local-llm","openai","claude","perplexity"], defaultProvider:"openai", latency:2.1, cost:0.02, desc:"Gather sources, extract facts, cluster by topic." },
  { id:"outline", label:"Outline", icon:"layers", providers:["local-llm","openai","claude"], defaultProvider:"claude", latency:1.4, cost:0.01, desc:"Beat-by-beat structure with hook, beats, CTA." },
  { id:"script", label:"Script", icon:"edit", providers:["local-llm","openai","claude"], defaultProvider:"claude", latency:3.2, cost:0.04, desc:"Voice-matched copy with pacing marks and SSML hints." },
  { id:"storyboard", label:"Storyboard", icon:"layers", providers:["local-draw","flux","stability"], defaultProvider:"flux", latency:8.0, cost:0.08, desc:"Shot descriptions + rough frames per beat." },
  { id:"voice", label:"Voice", icon:"mic", providers:["local-tts","elevenlabs","openai"], defaultProvider:"elevenlabs", latency:4.5, cost:0.06, desc:"TTS render or voice clone per character." },
  { id:"avatar", label:"Avatar", icon:"avatar", providers:["local-avatar","heygen","synthesia"], defaultProvider:"heygen", latency:22.0, cost:0.35, desc:"Lip-synced avatar video from voice + portrait." },
  { id:"broll", label:"B-roll", icon:"play", providers:["archive","runway","kling"], defaultProvider:"runway", latency:30.0, cost:0.50, desc:"Generate or pull supporting clips per beat." },
  { id:"captions", label:"Captions", icon:"comment", providers:["local-whisper","whisper","deepgram"], defaultProvider:"local-whisper", latency:1.1, cost:0.00, desc:"Word-timed transcription with styled renders." },
  { id:"edit", label:"Edit", icon:"spark", providers:["local-ffmpeg"], defaultProvider:"local-ffmpeg", latency:12.0, cost:0.00, desc:"Cut, sync, transitions, pacing corrections." },
  { id:"publish", label:"Publish", icon:"globe", providers:["manual","buffer","youtube-api"], defaultProvider:"manual", latency:2.0, cost:0.00, desc:"Schedule or post to selected platforms." }
];

const PROVIDER_META = {
  "local-llm":   { label:"Local LLM (free)",   kind:"local", pricingNote:"runs on your machine" },
  "openai":      { label:"OpenAI",             kind:"cloud", pricingNote:"per 1K tokens" },
  "claude":      { label:"Claude",             kind:"cloud", pricingNote:"per 1K tokens" },
  "perplexity":  { label:"Perplexity",         kind:"cloud", pricingNote:"per query" },
  "local-draw":  { label:"Local draw (free)",  kind:"local", pricingNote:"placeholder frames" },
  "flux":        { label:"Flux",               kind:"cloud", pricingNote:"per image" },
  "stability":   { label:"Stability",          kind:"cloud", pricingNote:"per image" },
  "local-tts":   { label:"Web Speech TTS (free)", kind:"local", pricingNote:"browser-native" },
  "elevenlabs":  { label:"ElevenLabs",         kind:"cloud", pricingNote:"per 1K chars" },
  "local-avatar":{ label:"Portrait loop (free)", kind:"local", pricingNote:"no lip-sync" },
  "heygen":      { label:"HeyGen",             kind:"cloud", pricingNote:"per minute" },
  "synthesia":   { label:"Synthesia",          kind:"cloud", pricingNote:"per minute" },
  "archive":     { label:"Your archive (free)",kind:"local", pricingNote:"uses prior renders" },
  "runway":      { label:"Runway Gen-3",       kind:"cloud", pricingNote:"per second" },
  "kling":       { label:"Kling",              kind:"cloud", pricingNote:"per second" },
  "local-whisper":{ label:"Whisper.cpp (free)",kind:"local", pricingNote:"runs locally" },
  "whisper":     { label:"OpenAI Whisper",     kind:"cloud", pricingNote:"per minute" },
  "deepgram":    { label:"Deepgram",           kind:"cloud", pricingNote:"per minute" },
  "local-ffmpeg":{ label:"ffmpeg (free)",      kind:"local", pricingNote:"runs locally" },
  "manual":      { label:"Manual (free)",      kind:"local", pricingNote:"you upload" },
  "buffer":      { label:"Buffer",             kind:"cloud", pricingNote:"per seat" },
  "youtube-api": { label:"YouTube Data API",   kind:"cloud", pricingNote:"quota-based" }
};

function ArchitectureTab(){
  const [picks, setPicks] = React.useState(() => {
    try { const raw = localStorage.getItem("zaidsaid.v2.arch.picks"); if (raw) return JSON.parse(raw); } catch(e){}
    const init = {};
    PIPELINE_STAGES.forEach(s => { init[s.id] = s.defaultProvider; });
    return init;
  });
  const [active, setActive] = React.useState(PIPELINE_STAGES[0].id);
  const [mode, setMode] = React.useState("balanced"); // free | balanced | premium

  React.useEffect(() => {
    try { localStorage.setItem("zaidsaid.v2.arch.picks", JSON.stringify(picks)); } catch(e){}
  }, [picks]);

  const applyMode = (m) => {
    setMode(m);
    const next = {};
    PIPELINE_STAGES.forEach(s => {
      if (m === "free") {
        const local = s.providers.find(p => (PROVIDER_META[p]||{}).kind === "local");
        next[s.id] = local || s.providers[0];
      } else if (m === "premium") {
        const cloud = s.providers.filter(p => (PROVIDER_META[p]||{}).kind === "cloud");
        next[s.id] = cloud[cloud.length-1] || s.defaultProvider;
      } else {
        next[s.id] = s.defaultProvider;
      }
    });
    setPicks(next);
  };

  const totalLatency = PIPELINE_STAGES.reduce((sum, s) => {
    const isLocal = (PROVIDER_META[picks[s.id]]||{}).kind === "local";
    return sum + (isLocal ? s.latency * 0.7 : s.latency);
  }, 0);
  const totalCost = PIPELINE_STAGES.reduce((sum, s) => {
    const isLocal = (PROVIDER_META[picks[s.id]]||{}).kind === "local";
    return sum + (isLocal ? 0 : s.cost);
  }, 0);

  const activeStage = PIPELINE_STAGES.find(s => s.id === active);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold">Architecture</div>
          <div className="text-xs text-[color:var(--muted)]">Every pipeline stage, every provider. Click a stage to swap providers. Saved under zaidsaid.v2.arch.picks.</div>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/10 p-1">
          {[["free","Free-only"],["balanced","Balanced"],["premium","Premium"]].map(([id,label]) => (
            <button key={id} onClick={()=>applyMode(id)} className={"px-3 py-1.5 rounded-lg text-xs " + (mode === id ? "bg-white/10" : "")}>{label}</button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="card p-4"><div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">Est. end-to-end latency</div><div className="text-2xl font-semibold mt-1">{totalLatency.toFixed(1)}s</div><div className="text-[11px] text-[color:var(--muted)] mt-1">{PIPELINE_STAGES.length} stages · sequential estimate</div></div>
        <div className="card p-4"><div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">Est. cost per run</div><div className="text-2xl font-semibold mt-1">${totalCost.toFixed(2)}</div><div className="text-[11px] text-[color:var(--muted)] mt-1">local stages cost $0</div></div>
        <div className="card p-4"><div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">Local vs cloud</div><div className="text-2xl font-semibold mt-1">{PIPELINE_STAGES.filter(s => (PROVIDER_META[picks[s.id]]||{}).kind === "local").length} / {PIPELINE_STAGES.length}</div><div className="text-[11px] text-[color:var(--muted)] mt-1">local stages selected</div></div>
      </div>

      <div className="card p-4">
        <div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)] mb-3">Pipeline</div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((s, i) => {
            const p = picks[s.id];
            const meta = PROVIDER_META[p] || { label: p, kind:"cloud" };
            const isActive = s.id === active;
            const isLocal = meta.kind === "local";
            return (
              <React.Fragment key={s.id}>
                <button onClick={()=>setActive(s.id)} className={"shrink-0 w-40 text-left p-3 rounded-xl border transition " + (isActive ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 hover:border-white/30")}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">{(I[s.icon] || I.spark)({size:12})}</span>
                    <span className="text-xs font-semibold">{s.label}</span>
                  </div>
                  <div className="text-[10px] text-[color:var(--muted)] mt-2 truncate">{meta.label}</div>
                  <div className="mt-2 flex items-center gap-1">
                    <span className={"text-[9px] px-1.5 py-0.5 rounded-full border " + (isLocal ? "border-emerald-500/30 text-emerald-300" : "border-sky-500/30 text-sky-300")}>{isLocal ? "LOCAL" : "CLOUD"}</span>
                    <span className="text-[10px] text-[color:var(--muted)]">{(isLocal ? s.latency * 0.7 : s.latency).toFixed(1)}s</span>
                  </div>
                </button>
                {i < PIPELINE_STAGES.length - 1 && <span className="self-center opacity-40 shrink-0">{"→"}</span>}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {activeStage && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">{(I[activeStage.icon] || I.spark)({size:16})}</span>
            <div>
              <div className="font-semibold">{activeStage.label}</div>
              <div className="text-[11px] text-[color:var(--muted)]">{activeStage.desc}</div>
            </div>
          </div>
          <div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)] mt-3 mb-2">Swap provider</div>
          <div className="grid md:grid-cols-2 gap-2">
            {activeStage.providers.map(p => {
              const meta = PROVIDER_META[p] || { label:p, kind:"cloud", pricingNote:"" };
              const isPicked = picks[activeStage.id] === p;
              return (
                <button key={p} onClick={()=>setPicks(x => ({ ...x, [activeStage.id]: p }))} className={"text-left p-3 rounded-lg border " + (isPicked ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 hover:border-white/20")}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{meta.label}</div>
                    <span className={"text-[10px] px-2 py-0.5 rounded-full border " + (meta.kind === "local" ? "border-emerald-500/30 text-emerald-300" : "border-sky-500/30 text-sky-300")}>{meta.kind.toUpperCase()}</span>
                  </div>
                  <div className="text-[11px] text-[color:var(--muted)] mt-1">{meta.pricingNote}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-[11px] text-[color:var(--muted)]">Latency estimate: <span className="text-white">{activeStage.latency}s</span> · Unit cost: <span className="text-white">${activeStage.cost.toFixed(2)}</span></div>
        </div>
      )}
    </div>
  );
}
const DOC_SECTIONS = [
  { id:"quickstart", label:"Quickstart", icon:"play" },
  { id:"concepts", label:"Core concepts", icon:"layers" },
  { id:"api", label:"REST API", icon:"globe" },
  { id:"webhooks", label:"Webhooks", icon:"flame" },
  { id:"sdks", label:"SDKs", icon:"link" },
  { id:"ratelimits", label:"Rate limits", icon:"clock" },
  { id:"proxy", label:"Proxy guide", icon:"wave" },
  { id:"changelog", label:"Changelog", icon:"refresh" }
];

function DocsTab(){
  const [active, setActive] = React.useState(() => {
    const m = (window.location.hash || "").match(/docs\?s=([\w-]+)/);
    return (m && DOC_SECTIONS.find(s => s.id === m[1])) ? m[1] : "quickstart";
  });
  const [q, setQ] = React.useState("");
  const [copied, setCopied] = React.useState("");

  const copy = (text, key) => {
    try { navigator.clipboard.writeText(text); setCopied(key); setTimeout(()=>setCopied(""), 1200); } catch(e){}
  };

  const Code = ({ lang, code, ckey }) => (
    <div className="rounded-lg border border-white/10 bg-black/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
        <span>{lang}</span>
        <button onClick={()=>copy(code, ckey)} className="btn btn-ghost text-[10px]">{copied === ckey ? I.check({size:10}) : I.copy({size:10})} {copied === ckey ? "copied" : "copy"}</button>
      </div>
      <pre className="p-3 text-xs overflow-auto leading-relaxed"><code>{code}</code></pre>
    </div>
  );

  const H = ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>;
  const P = ({ children }) => <p className="text-sm text-[color:var(--muted)] leading-relaxed mb-2">{children}</p>;

  const sections = {
    quickstart: (
      <div className="space-y-3">
        <H>Quickstart</H>
        <P>Zaidsaid turns a topic into a finished, multi-platform video. The fastest path is to pick a template, tweak the script, and render.</P>
        <ol className="space-y-2 text-sm list-decimal list-inside">
          <li>Open the <a href="#templates" className="underline">Templates</a> tab and click <b>Use template</b>.</li>
          <li>Studio opens pre-seeded. Edit the outline and script beats.</li>
          <li>Pick a brand kit in <a href="#brands" className="underline">Brand Kits</a> — fonts, colors, captions.</li>
          <li>Attach an avatar + voice from <a href="#avatars" className="underline">Avatars & Voices</a>.</li>
          <li>Review provider choices in <a href="#architecture" className="underline">Architecture</a>, then render.</li>
        </ol>
        <Code lang="bash" ckey="qs-curl" code={'curl -X POST https://YOUR-PROXY.example.com/v1/renders \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "template": "tpl-explainer-60",\n    "topic": "How GPS uses relativity",\n    "kit": "bk-edu",\n    "voice": "nova"\n  }\''} />
        <P>All calls go to <b>your own proxy</b>, never direct to a vendor from the browser. See the Proxy guide.</P>
      </div>
    ),
    concepts: (
      <div className="space-y-3">
        <H>Core concepts</H>
        <div className="grid md:grid-cols-2 gap-2">
          {[
            { k:"Project", v:"A single render job with script, assets, versions, comments." },
            { k:"Template", v:"A reusable beat structure (hook, beats, CTA)." },
            { k:"Brand kit", v:"Palette, typography, motion, caption style, voice tone." },
            { k:"Avatar", v:"A named voice + portrait + locale, with optional clone." },
            { k:"Provider", v:"Any upstream service (local or cloud) that does work." },
            { k:"Stage", v:"A step in the pipeline: research, script, voice, avatar, …" }
          ].map(x => (
            <div key={x.k} className="p-3 rounded-lg border border-white/10 bg-white/5">
              <div className="text-sm font-semibold">{x.k}</div>
              <div className="text-xs text-[color:var(--muted)] mt-1">{x.v}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    api: (
      <div className="space-y-3">
        <H>REST API</H>
        <P>Base URL: <code>https://YOUR-PROXY.example.com/v1</code> (you deploy this; see Proxy guide).</P>
        <div className="rounded-lg border border-white/10 overflow-hidden text-sm">
          <table className="w-full">
            <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-[color:var(--muted)]"><tr><th className="text-left px-3 py-2">Method</th><th className="text-left px-3 py-2">Path</th><th className="text-left px-3 py-2">Purpose</th></tr></thead>
            <tbody>
              {[
                ["POST","/v1/renders","Start a new render"],
                ["GET","/v1/renders/:id","Get render status + URLs"],
                ["GET","/v1/projects","List projects"],
                ["POST","/v1/projects/:id/versions","Save a new version"],
                ["POST","/v1/voices","Upload a voice sample for cloning"],
                ["GET","/v1/templates","List templates"],
                ["POST","/v1/publish","Schedule or publish to a platform"]
              ].map(([m,p,d], i) => (
                <tr key={i} className="border-t border-white/5"><td className="px-3 py-2 font-mono text-xs"><span className={"px-2 py-0.5 rounded border "+(m==="POST"?"border-indigo-500/40 text-indigo-300":"border-emerald-500/40 text-emerald-300")}>{m}</span></td><td className="px-3 py-2 font-mono text-xs">{p}</td><td className="px-3 py-2 text-xs">{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <Code lang="http" ckey="api-post" code={'POST /v1/renders HTTP/1.1\nHost: YOUR-PROXY.example.com\nContent-Type: application/json\n\n{\n  "template": "tpl-product-reveal",\n  "topic": "Launch: Vector DB",\n  "kit": "bk-zs",\n  "voice": "atlas"\n}'} />
      </div>
    ),
    webhooks: (
      <div className="space-y-3">
        <H>Webhooks</H>
        <P>Register a URL on your proxy to receive render status updates. Events are signed with HMAC-SHA256.</P>
        <Code lang="json" ckey="wh-json" code={'{\n  "event": "render.completed",\n  "project_id": "1ac278127fe7",\n  "version": "v3",\n  "outputs": {\n    "16x9": "https://cdn.../1ac2-v3-16x9.mp4",\n    "9x16": "https://cdn.../1ac2-v3-9x16.mp4"\n  },\n  "duration": 28.4,\n  "signed_at": 1755720000\n}'} />
        <P>Events: <code>render.queued</code>, <code>render.started</code>, <code>render.completed</code>, <code>render.failed</code>, <code>publish.scheduled</code>.</P>
      </div>
    ),
    sdks: (
      <div className="space-y-3">
        <H>SDKs</H>
        <P>Thin clients that call your proxy. Browser-safe — they never see vendor keys.</P>
        <Code lang="javascript" ckey="sdk-js" code={'import { Zaidsaid } from "@zaidsaid/sdk";\n\nconst zs = new Zaidsaid({ baseUrl: "https://YOUR-PROXY.example.com/v1" });\n\nconst render = await zs.renders.create({\n  template: "tpl-explainer-60",\n  topic: "Mycorrhizal networks",\n  kit: "bk-edu"\n});\n\nconsole.log(render.id, render.status);'} />
        <Code lang="python" ckey="sdk-py" code={'from zaidsaid import Zaidsaid\n\nzs = Zaidsaid(base_url="https://YOUR-PROXY.example.com/v1")\nrender = zs.renders.create(\n  template="tpl-explainer-60",\n  topic="Mycorrhizal networks",\n  kit="bk-edu"\n)\nprint(render.id, render.status)'} />
      </div>
    ),
    ratelimits: (
      <div className="space-y-3">
        <H>Rate limits</H>
        <P>Default per-tenant limits. Bursts are allowed via token bucket.</P>
        <div className="grid md:grid-cols-3 gap-2 text-sm">
          {[["Renders","30 / min","burst 60"],["Status polls","600 / min","no burst"],["Webhooks","unlimited","signed"]].map(([k,v,b], i) => (
            <div key={i} className="p-3 rounded-lg border border-white/10"><div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">{k}</div><div className="font-semibold mt-1">{v}</div><div className="text-[11px] text-[color:var(--muted)]">{b}</div></div>
          ))}
        </div>
        <P>When exceeded, calls return <code>429 Too Many Requests</code> with a <code>Retry-After</code> header.</P>
      </div>
    ),
    proxy: (
      <div className="space-y-3">
        <H>Proxy guide</H>
        <P className="!text-rose-300"><b>Never put vendor API keys in the browser.</b> This site is public. All provider calls route through a proxy that you control.</P>
        <P>The simplest shape: a Cloudflare Worker or Vercel Edge Function that holds your keys in environment variables and forwards requests.</P>
        <Code lang="javascript" ckey="wk" code={'// cloudflare-worker.js\nexport default {\n  async fetch(req, env) {\n    const url = new URL(req.url);\n    if (url.pathname === "/ping") return new Response("ok");\n    if (url.pathname.startsWith("/elevenlabs/")) {\n      const path = url.pathname.replace("/elevenlabs", "");\n      const r = await fetch("https://api.elevenlabs.io" + path + url.search, {\n        method: req.method,\n        headers: { "xi-api-key": env.ELEVEN_KEY, "Content-Type": "application/json" },\n        body: req.method === "GET" ? undefined : await req.text()\n      });\n      return new Response(r.body, { status: r.status, headers: { "Content-Type": r.headers.get("content-type") || "application/octet-stream", "Access-Control-Allow-Origin": "*" } });\n    }\n    return new Response("not found", { status: 404 });\n  }\n};'} />
        <P>Put the deployed URL into <b>Avatars & Voices → Voice & avatar providers</b> as the <i>Proxy URL</i> for ElevenLabs. The site will call <code>&lt;proxy&gt;/ping</code> to verify and <code>&lt;proxy&gt;/elevenlabs/...</code> for real work.</P>
      </div>
    ),
    changelog: (
      <div className="space-y-3">
        <H>Changelog</H>
        <ul className="space-y-2 text-sm">
          {[
            { v:"2.0.7", at:"2026-04-19", notes:["DocsTab live — 8 sections, copy-to-clipboard code blocks"] },
            { v:"2.0.6", at:"2026-04-19", notes:["ArchitectureTab — interactive 10-stage pipeline, Free/Balanced/Premium presets"] },
            { v:"2.0.5", at:"2026-04-19", notes:["ProjectsTab — grid/list, drawer with versions + comments"] },
            { v:"2.0.4", at:"2026-04-19", notes:["TemplatesTab — 12 templates, seeds Studio"] },
            { v:"2.0.3", at:"2026-04-19", notes:["BrandsTab — palette editor, motion & caption presets, live preview"] },
            { v:"2.0.2", at:"2026-04-19", notes:["AvatarsTab — gallery, Web Speech TTS, MediaRecorder clone, providers"] },
            { v:"2.0.1", at:"2026-04-19", notes:["Shared UI helpers: Toast, Modal, Drawer, EmptyState, Tag"] },
            { v:"2.0.0", at:"2026-04-18", notes:["Rebuild: hash routing, error boundary, v2 localStorage namespace"] }
          ].map(c => (
            <li key={c.v} className="p-3 rounded-lg border border-white/10 bg-white/5">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs">v{c.v}</div>
                <div className="text-[10px] text-[color:var(--muted)]">{c.at}</div>
              </div>
              <ul className="mt-2 text-xs list-disc list-inside space-y-0.5">
                {c.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    )
  };

  const match = (s) => !q || (s.label + " " + s.id).toLowerCase().includes(q.toLowerCase());

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-4">
      <aside className="card p-3 h-fit sticky top-4">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search docs" className="w-full px-2 py-1.5 mb-2 text-xs rounded-lg bg-white/5 border border-white/10" />
        <nav className="space-y-1">
          {DOC_SECTIONS.filter(match).map(s => (
            <button key={s.id} onClick={()=>{ setActive(s.id); window.location.hash = "#docs?s="+s.id; }} className={"w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left " + (active === s.id ? "bg-indigo-500/15 text-white" : "text-[color:var(--muted)] hover:bg-white/5")}>
              <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center">{(I[s.icon] || I.book)({size:10})}</span>
              {s.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="card p-5 min-h-[320px]">
        {sections[active] || sections.quickstart}
      </main>
    </div>
  );
}


function SettingsTab(){
  const [section, setSection] = React.useState("providers");
  const [toast, setToast] = React.useState(null);

  const exportData = () => {
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("zaidsaid.v2.")) {
        try { dump[k] = JSON.parse(localStorage.getItem(k)); } catch(e) { dump[k] = localStorage.getItem(k); }
      }
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "zaidsaid-settings-" + new Date().toISOString().slice(0,10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
    setToast({ kind:"ok", msg:"Exported settings" });
  };

  const wipeAll = () => {
    if (!confirm("Wipe ALL Zaidsaid local data? This removes brand kits, projects, provider URLs, avatars, and preferences.")) return;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("zaidsaid.v2.")) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    setToast({ kind:"warn", msg:"Wiped "+keys.length+" entries. Reloading…" });
    setTimeout(() => window.location.reload(), 900);
  };

  const keys = (() => {
    const arr = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("zaidsaid.v2.")) {
        const v = localStorage.getItem(k) || "";
        arr.push({ k, size: v.length });
      }
    }
    return arr.sort((a,b) => b.size - a.size);
  })();
  const totalBytes = keys.reduce((s,x) => s + x.size, 0);

  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-4">
      <aside className="card p-3 h-fit sticky top-4">
        <div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)] px-2 py-1">Settings</div>
        <nav className="space-y-1">
          {[["providers","Providers","globe"],["storage","Local data","blocks"],["about","About","spark"]].map(([id,label,icon]) => (
            <button key={id} onClick={()=>setSection(id)} className={"w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left " + (section === id ? "bg-indigo-500/15 text-white" : "text-[color:var(--muted)] hover:bg-white/5")}>
              <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center">{(I[icon] || I.blocks)({size:10})}</span>
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="card p-5 min-h-[320px] space-y-4">
        {section === "providers" && (
          isGodMode ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold">All providers</h3>
                <p className="text-sm text-[color:var(--muted)]">Configure proxy URLs once here. Used by every tab. Keys never leave your proxy.</p>
                <div className="text-xs mt-1"><a href="https://github.com/TruMarley/zaidsaid.com/blob/main/proxy/README.md" target="_blank" rel="noopener" className="chip">Proxy deployment guide</a></div>
              </div>
              {typeof ProvidersPanel === "function" ? (
                <>
                  <ProvidersPanel capability="tts" title="Text-to-speech" />
                  <ProvidersPanel capability="voiceClone" title="Voice cloning" />
                  <ProvidersPanel capability="avatarVideo" title="Avatar video" />
                  <ProvidersPanel capability="script" title="Script / LLM" />
                  <ProvidersPanel capability="image" title="Image generation" />
                  <ProvidersPanel capability="motion" title="Video / motion (B-roll)" />
                  <ProvidersPanel capability="stt" title="Transcription (STT)" />
                  <ProvidersPanel capability="music" title="Music" />
                  <ProvidersPanel capability="research" title="Research" />
                </>
              ) : (
                <div className="text-xs text-[color:var(--muted)]">Providers module not loaded.</div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold">Providers</h3>
                <p className="text-sm text-[color:var(--muted)]">Zaidsaid uses managed AI providers by default. You can keep creating videos without configuring anything here.</p>
              </div>
              <div className="rounded-xl border border-[color:var(--line)] p-4 text-sm text-[color:var(--muted)]">
                Bring-your-own-key and multi-vendor configuration are coming to team plans. For now you're using the built-in providers.
              </div>
            </div>
          )
        )}
        {section === "storage" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Local data</h3>
                <p className="text-sm text-[color:var(--muted)]">Everything you do is stored in this browser under the <code>zaidsaid.v2.*</code> namespace.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportData} className="btn btn-ghost text-sm">{I.down({size:14})} Export JSON</button>
                <button onClick={wipeAll} className="btn btn-ghost text-sm text-rose-300">{I.trash({size:14})} Wipe all</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-3 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Keys</div><div className="text-xl font-semibold">{keys.length}</div></div>
              <div className="p-3 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Size (approx)</div><div className="text-xl font-semibold">{(totalBytes/1024).toFixed(1)} KB</div></div>
              <div className="p-3 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Scope</div><div className="text-xl font-semibold">this browser</div></div>
            </div>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-[color:var(--muted)]"><tr><th className="text-left px-3 py-2">Key</th><th className="text-right px-3 py-2">Size</th></tr></thead>
                <tbody>
                  {keys.length === 0 ? (
                    <tr><td colSpan="2" className="px-3 py-3 text-center text-[color:var(--muted)]">No data yet.</td></tr>
                  ) : keys.map(x => (
                    <tr key={x.k} className="border-t border-white/5"><td className="px-3 py-2 font-mono">{x.k}</td><td className="px-3 py-2 text-right">{x.size} B</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {section === "about" && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">About Zaidsaid v2</h3>
            <p className="text-sm text-[color:var(--muted)]">A client-only, vendor-swappable video platform. No build step, no backend required. Provider calls go through your own proxy so this public site never sees a raw API key.</p>
            <div className="grid md:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Stack</div><div>React 18 UMD · Tailwind CDN · Babel standalone</div></div>
              <div className="p-3 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Host</div><div>GitHub Pages (zaidsaid.com)</div></div>
              <div className="p-3 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">Source</div><div><a href="https://github.com/TruMarley/zaidsaid.com" className="underline">TruMarley/zaidsaid.com</a></div></div>
              <div className="p-3 rounded-lg border border-white/10"><div className="text-[color:var(--muted)]">License</div><div>MIT</div></div>
            </div>
            <div className="pt-3 mt-3 border-t border-[color:var(--line)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">God mode</div>
                  <div className="text-xs text-[color:var(--muted)]">Reveal all provider config, per-scene regen controls, and developer surface. {isGodMode ? "Currently ON." : "Off (public MVP view)."}</div>
                </div>
                <button className="btn" onClick={()=>{
                  try {
                    if (isGodMode) { localStorage.removeItem("zs_god"); }
                    else { localStorage.setItem("zs_god", "1"); }
                    location.reload();
                  } catch(e){}
                }}>{isGodMode ? "Disable god mode" : "Enable god mode"}</button>
              </div>
            </div>
          </div>
        )}
        {toast && <Toast kind={toast.kind} msg={toast.msg} onClose={()=>setToast(null)} />}
      </main>
    </div>
  );
}

/* ---------------- App root ---------------- */
function App(){
  const [tab, setTab] = useLocalState("tab", "home");
  const [studioStep, setStudioStepRaw] = useLocalState("studio.step", "research");

  const syncFromHash = () => {
    const { path, params } = parseHash();
    if(path && TABS.find(t=>t.id===path)) setTab(path);
    if(params.step && STUDIO_STEPS.find(s=>s.id===params.step)) setStudioStepRaw(params.step);
  };
  useEffect(()=>{ syncFromHash(); }, []);
  useEffect(()=>{
    const onHash = () => syncFromHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(()=>{
    if(!tab) return;
    if(tab === "studio"){
      setHash("studio", { step: studioStep });
    } else {
      setHash(tab, null);
    }
  }, [tab, studioStep]);

  const setStudioStep = (id) => {
    setStudioStepRaw(id);
    if(tab !== "studio") setTab("studio");
  };
  const startProject = () => {
    setStudioStepRaw(isGodMode ? "research" : "script");
    setTab("studio");
  };

  const View = useMemo(()=> {
    switch(tab){
      case "home":         return <HomeTab setTab={setTab} startProject={startProject} />;
      case "studio":       return <StudioTab setTab={setTab} studioStep={studioStep} setStudioStep={setStudioStep} />;
      case "repurpose":    return <RepurposeTab/>;
      case "avatars":      return <AvatarsTab/>;
      case "brands":       return <BrandsTab/>;
      case "templates":    return <TemplatesTab/>;
      case "projects":     return <ProjectsTab/>;
      case "architecture": return <ArchitectureTab/>;
      case "settings":     return <SettingsTab/>;
      case "docs":         return <DocsTab/>;
      default:             return <HomeTab setTab={setTab} startProject={startProject} />;
    }
  }, [tab, studioStep]);

  return (
    <Boundary>
      <TopBar tab={tab} setTab={setTab} onNewProject={startProject} />
      <main id="main" role="main">{View}</main>
      <Footer />
    </Boundary>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
