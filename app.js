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
function useLocalState(key, initial){
  const [v, setV] = useState(() => safeGet(key, initial));
  useEffect(() => { safeSet(key, v); }, [key, v]);
  return [v, setV];
}
try { if (safeGet("__schema", 0) !== SCHEMA_VERSION) safeSet("__schema", SCHEMA_VERSION); } catch(e){}

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
  { stage:"Research", primary:"Perplexity", fallback:"You.com", latency:"2.1s" },
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

/* ---------------- New IA ---------------- */
const TABS = [
  { id:"home", label:"Home", icon:"home" },
  { id:"studio", label:"Studio", icon:"studio" },
  { id:"repurpose", label:"Repurpose", icon:"scissors" },
  { id:"avatars", label:"Avatars & Voices", icon:"avatar" },
  { id:"brands", label:"Brand Kits", icon:"brand" },
  { id:"templates", label:"Templates", icon:"template" },
  { id:"projects", label:"Projects", icon:"folder" },
  { id:"architecture", label:"Architecture", icon:"blocks" },
  { id:"docs", label:"Docs", icon:"book" },
];

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
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} aria-current={tab===t.id?"page":undefined}
              className={"flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-[color:var(--muted)] hover:text-white whitespace-nowrap " + (tab===t.id?"tab-active":"")}>
              {I[t.icon] ? I[t.icon]({size:16}) : null}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
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
          <span className="chip"><span className="dot"/> Built for teams that publish every day</span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05]">
            <span className="grad-text">AI video, end-to-end.</span><br/>
            From idea to on-brand upload — in one workflow.
          </h1>
          <p className="text-[17px] text-[color:var(--muted)] max-w-2xl">
            Zaidsaid turns text, links, audio, articles, podcasts, PDFs, and images into polished, branded, social-ready videos. Research, scripting, storyboarding, assets, motion graphics, voiceover, avatar narration, editing, and repurposing — all automated, all in one place.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" onClick={()=>{ startProject && startProject(); }}>{I.spark({size:16})} <span>Start a project</span></button>
            <button className="btn" onClick={()=>setTab("repurpose")}>{I.scissors({size:16})} <span>Repurpose long-form</span></button>
            <button className="btn btn-ghost" onClick={()=>setTab("templates")}>{I.template({size:16})} <span>Browse templates</span></button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {INPUTS.map(i => <span key={i.k} className="chip">{i.label}</span>)}
          </div>
        </div>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {ARCHIVE_PIPELINE.slice(0,8).map((s,i) => (
            <div key={s} className="card p-3 text-center text-xs text-[color:var(--muted)]">
              <div className="text-[10px] text-[color:var(--muted)]/70">Stage {i+1}</div>
              <div className="text-white font-semibold mt-1">{s}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="py-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[color:var(--muted)] text-sm">
          <span className="uppercase tracking-widest text-[11px]">Publishes to</span>
          {INTEGRATIONS.map(x => <span key={x} className="text-white/80">{x}</span>)}
        </div>
      </section>
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
      <section className="py-14">
        <div className="card p-8 ring-brand flex flex-col md:flex-row items-start md:items-center gap-6">
          <div>
            <h3 className="text-2xl font-bold">Ready to ship videos every day?</h3>
            <p className="text-[color:var(--muted)] mt-1">Start in the Studio, or drop a long-form file and we'll cut shorts automatically.</p>
          </div>
          <div className="md:ml-auto flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={()=>{ startProject && startProject(); }}>{I.play({size:14})} Start a project</button>
            <button className="btn" onClick={()=>setTab("docs")}>{I.book({size:14})} Read the docs</button>
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

function StudioStepNav({ step, setStep }){
  return (
    <div className="card p-2 flex items-center gap-1 overflow-x-auto scrollbar">
      {STUDIO_STEPS.map((s, i) => {
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

function StudioInputAccepter({ project, setProject }){
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Source</div>
          <div className="text-lg font-semibold">What are we turning into a video?</div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {STUDIO_INPUT_KINDS.map(k => {
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
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Prompt or paste</span>
          <textarea
            value={project.source || ""}
            onChange={(e)=>setProject({ ...project, source: e.target.value })}
            placeholder="Paste text, a URL, or describe the video you want."
            rows={6}
            className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-xl p-3 text-sm focus:outline-none focus:border-white/20"
          />
        </label>
        <div>
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Upload (UI only)</span>
          <div className="mt-1 border border-dashed border-[color:var(--line)] rounded-xl p-6 text-center text-[12px] text-[color:var(--muted)]">
            <div className="text-white/80 font-semibold">Drop a file</div>
            <div className="mt-1">Audio · PDF · Image · Podcast</div>
            <div className="mt-3 opacity-70">Uploads wire up in a later stage.</div>
            <button type="button" className="btn mt-3" aria-disabled="true" onClick={(e)=>e.preventDefault()}>
              Choose file
            </button>
          </div>
          <div className="text-[11px] text-[color:var(--muted)] mt-2">
            Currently selected: <span className="text-white">{(STUDIO_INPUT_KINDS.find(x=>x.k===project.kind)||{}).label || "Text"}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <input
          value={project.name || ""}
          onChange={(e)=>setProject({ ...project, name: e.target.value })}
          placeholder="Project name"
          className="bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20 flex-1 min-w-[240px]"
        />
        <select
          value={project.language || "English"}
          onChange={(e)=>setProject({ ...project, language: e.target.value })}
          className="bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20">
          {ARCHIVE_LANGS.map(l => <option key={l} value={l} style={{background:"#0b0b10"}}>{l}</option>)}
        </select>
      </div>
    </div>
  );
}

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
          <div className="text-[12px] text-[color:var(--muted)] mt-1">This is a visualization. No external calls are made.</div>
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

function StepResearch({ project, setProject }){
  const regenClaim = (id) => {
    const variations = [
      "Tighter framing of the same evidence.",
      "Cross-referenced a second source.",
      "Narrowed the scope to keep it on-topic.",
      "Restated as a hook-friendly claim.",
    ];
    setProject({
      ...project,
      research: project.research.map(r => r.id===id ? { ...r, claim: (r.claim + " — " + variations[Math.floor(Math.random()*variations.length)]).slice(0,180), confidence: Math.min(0.99, (r.confidence||0.8) + 0.01) } : r),
    });
  };
  const addClaim = () => {
    const nid = "r" + (project.research.length + 1) + "_" + Math.random().toString(36).slice(2,6);
    setProject({
      ...project,
      research: [...project.research, { id: nid, claim:"New claim — edit me.", source:"Pending source", confidence: 0.7 }],
    });
  };
  return (
    <div className="flex flex-col gap-4">
      <StudioInputAccepter project={project} setProject={setProject} />
      <StudioPipelineSimulator project={project} setProject={setProject} />
      <div className="card p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Research</div>
            <div className="text-lg font-semibold">Claims & sources</div>
          </div>
          <button className="btn" onClick={addClaim}>{I.plus({size:14})} Add claim</button>
        </div>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          {project.research.map(r => (
            <div key={r.id} className="rounded-xl border border-[color:var(--line)] p-3">
              <div className="text-sm text-white">{r.claim}</div>
              <div className="text-[11px] text-[color:var(--muted)] mt-1">{r.source}</div>
              <div className="flex items-center justify-between mt-2">
                <span className="chip">Confidence {Math.round((r.confidence||0)*100)}%</span>
                <button className="chip" onClick={()=>regenClaim(r.id)}>{I.refresh({size:12})} Regenerate</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepScript({ project, setProject }){
  const scriptText = project.scenes.map((s,i) => "Scene " + (i+1) + " — " + s.title + "\n" + s.voLine).join("\n\n");
  const onChange = (e) => {
    const blocks = e.target.value.split(/\n\n+/);
    const next = project.scenes.map((s, i) => {
      const blk = blocks[i] || "";
      const lines = blk.split(/\n/);
      const header = (lines[0]||"").replace(/^Scene\s*\d+\s*—\s*/i, "");
      const body = lines.slice(1).join(" ").trim();
      return { ...s, title: header || s.title, voLine: body || s.voLine };
    });
    setProject({ ...project, scenes: next });
  };
  const regenerateAll = () => {
    const next = project.scenes.map(s => ({ ...s, voLine: s.voLine + " " + sceneRegenerateBlurbs("voLine") }));
    setProject({ ...project, scenes: next });
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Script</div>
            <div className="text-lg font-semibold">Tight, spoken draft</div>
          </div>
          <button className="btn" onClick={regenerateAll}>{I.refresh({size:14})} Regenerate all</button>
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
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Storyboard</div>
        <div className="text-lg font-semibold">Frame the story</div>
        <div className="text-[12px] text-[color:var(--muted)] mt-1">Seeded example. Edit any field, or regenerate per scene.</div>
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
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Motion</div>
        <div className="text-lg font-semibold">Cinematography & kinetic type</div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {project.scenes.map((s, i) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-center gap-2">
              <span className="chip">Scene {i+1}</span>
              <span className="font-semibold">{s.title}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {presets.map(p => {
                const active = s.motion === p;
                return (
                  <button key={p}
                    onClick={()=>sceneFieldSetter(project,setProject)(s.id, "motion", p)}
                    className={"px-2.5 py-1.5 rounded-full text-[12px] border " + (active ? "border-white/20 bg-white/10 text-white" : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-white")}>
                    {p}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-[12px] text-[color:var(--muted)]">Current: <span className="text-white">{s.motion}</span></div>
            <div className="flex justify-end mt-2">
              <button className="chip" onClick={()=>sceneRegenSetter(project,setProject)(s.id, "motion")}>{I.refresh({size:12})} Regenerate</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepVoice({ project, setProject }){
  const mode = project.voiceMode || "avatar";
  const setMode = (m) => setProject({ ...project, voiceMode: m });
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
  const setPreset = (id) => setProject({ ...project, preset: id, platforms: (STUDIO_EXPORT_PRESETS.find(p=>p.id===id)||{}).platforms || project.platforms });
  const togglePlatform = (p) => {
    const curr = project.platforms || [];
    const next = curr.includes(p) ? curr.filter(x=>x!==p) : [...curr, p];
    setProject({ ...project, platforms: next });
  };
  const totalDuration = project.scenes.reduce((a,s)=>a+(s.duration||0), 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Export</div>
        <div className="text-lg font-semibold">Aspect & platform presets</div>
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
        <div className="mt-4 flex items-center gap-2">
          <button className="btn btn-primary" onClick={(e)=>e.preventDefault()} aria-disabled="true">{I.play({size:14})} Render (stub)</button>
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
  const step = studioStep || "research";
  const goto = (id) => setStudioStep(id);
  const renderStep = () => {
    switch(step){
      case "research":   return <StepResearch    project={project} setProject={setProject} />;
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
  const idx = Math.max(0, STUDIO_STEPS.findIndex(s => s.id === step));
  const prev = STUDIO_STEPS[idx-1];
  const next = STUDIO_STEPS[idx+1];
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
      <div className="grid gap-3 mb-4">
        <StudioStepNav step={step} setStep={goto} />
        <StudioCharacterRow project={project} setProject={setProject} />
        <StudioBrandKitSelect project={project} setProject={setProject} />
      </div>
      <div>{renderStep()}</div>
      <div className="mt-6 flex items-center justify-between gap-2 flex-wrap">
        <button className="btn" onClick={()=>prev && goto(prev.id)} disabled={!prev}>← {prev ? prev.label : "Start"}</button>
        <div className="text-[11px] text-[color:var(--muted)]">Step {idx+1} of {STUDIO_STEPS.length}</div>
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
          <div className="text-[12px] text-[color:var(--muted)] mt-1">This is a visualization. No external calls are made.</div>
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
          <button className="btn btn-ghost" onClick={resetSeed}>{I.refresh({size:14})} Reset to example</button>
        </div>
      </div>

      <div className="grid gap-4">
        <RepurposeIntake project={project} setProject={setProject} />
        <RepurposeAnalyzer project={project} setProject={setProject} />
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
    <ToastCtx.Provider value={push}>
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
const useToast = () => useContext(ToastCtx) || (()=>{});

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
function AvatarsTab(){
  return (
    <Placeholder title="Avatars & Voices" subtitle="Custom avatars, voice cloning, lip sync, and translation. Coming online in Stage 4.">
      <div className="grid md:grid-cols-3 gap-3">
        {ARCHIVE_AVATARS.map(a => (
          <div key={a.id} className="card p-4">
            <div className="w-14 h-14 rounded-full mb-3" style={{background:"linear-gradient(135deg,#6366f1,#22d3ee)"}}/>
            <div className="font-semibold">{a.name}</div>
            <div className="text-xs text-[color:var(--muted)]">{a.persona}</div>
          </div>
        ))}
      </div>
    </Placeholder>
  );
}
function BrandsTab(){
  return (
    <Placeholder title="Brand Kits" subtitle="Palettes, typography, motion presets, caption styles, intros, outros. Full editor lands in Stage 5.">
      <div className="grid md:grid-cols-3 gap-3">
        {ARCHIVE_BRAND_KITS.map(b => (
          <div key={b.id} className="card p-4">
            <div className="font-semibold">{b.name}</div>
            <div className="text-xs text-[color:var(--muted)] mt-1">{b.font} • {b.motion} • {b.voice}</div>
            <div className="flex gap-2 mt-3">
              <span className="w-8 h-8 rounded-lg" style={{background:b.primary}}/>
              <span className="w-8 h-8 rounded-lg" style={{background:b.secondary}}/>
              <span className="w-8 h-8 rounded-lg" style={{background:b.accent}}/>
            </div>
          </div>
        ))}
      </div>
    </Placeholder>
  );
}
const TEMPLATE_PREVIEW = [
  { id:"ads", name:"Ads", blurb:"DR hooks, benefit stacks, CTA cards, captions." },
  { id:"explainer", name:"Explainer", blurb:"Topic intro, 3-beat body, takeaway, outro." },
  { id:"faceless", name:"Faceless", blurb:"B-roll + captions + VO. No camera needed." },
  { id:"training", name:"Training", blurb:"Module intro, lesson chapters, recap, quiz." },
  { id:"youtube", name:"YouTube", blurb:"Cold open, section markers, B-roll beats." },
  { id:"social", name:"Social short", blurb:"Hook → payoff → ask. Under 45s." },
];
function TemplatesTab(){
  return (
    <Placeholder title="Templates" subtitle="Start from a shape. Full library and previews land in Stage 5.">
      <div className="grid md:grid-cols-3 gap-3">
        {TEMPLATE_PREVIEW.map(t => (
          <div key={t.id} className="card p-5">
            <div className="font-semibold">{t.name}</div>
            <div className="text-sm text-[color:var(--muted)] mt-1">{t.blurb}</div>
          </div>
        ))}
      </div>
    </Placeholder>
  );
}
function ProjectsTab(){
  const [jobs] = useLocalState("jobs", ARCHIVE_JOBS);
  const [filter, setFilter] = useState("All");
  const filtered = useMemo(()=> filter==="All" ? jobs : jobs.filter(j => j.status.toLowerCase()===filter.toLowerCase()), [jobs, filter]);
  return (
    <Placeholder title="Projects" subtitle="Every video Zaidsaid has rendered for you. Versions and approvals land in Stage 5.">
      <div className="flex items-center gap-2 mb-4">
        {["All","Done","Running","Queued","Failed"].map(f => (
          <button key={f} onClick={()=>setFilter(f)} className={"chip " + (filter===f?"text-white !border-white/20 bg-white/10":"")} aria-pressed={filter===f}>{f}</button>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {filtered.map(j => (
          <div key={j.id} className="card p-5">
            <div className={"h-32 rounded-xl mb-3 bg-gradient-to-br " + j.grad} aria-hidden />
            <div className="flex items-center gap-2">
              <span className="chip">{j.status}</span>
              <span className="chip">{j.duration}s</span>
              <span className="chip">{j.platforms} platforms</span>
            </div>
            <div className="font-semibold mt-2">{j.title}</div>
            <div className="text-sm text-[color:var(--muted)] mt-1 line-clamp-2">{j.caption}</div>
            <div className="text-[11px] text-[color:var(--muted)]/70 mt-2">{j.id.slice(0,8)} — {j.age}</div>
          </div>
        ))}
      </div>
    </Placeholder>
  );
}
function ArchitectureTab(){
  return (
    <Placeholder title="Architecture" subtitle="The pipeline, the providers, the latencies. Expanded in Stage 6.">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="uppercase tracking-widest text-[11px] text-[color:var(--muted)] mb-2">Pipeline</div>
          <div className="flex flex-wrap gap-2">{ARCHIVE_PIPELINE.map(s => <span key={s} className="chip">{s}</span>)}</div>
        </div>
        <div className="card p-5">
          <div className="uppercase tracking-widest text-[11px] text-[color:var(--muted)] mb-2">Providers</div>
          <div className="text-sm">
            {ARCHIVE_PROVIDERS.map(p => (
              <div key={p.stage} className="flex items-center justify-between border-b border-[color:var(--line)] py-1.5 last:border-b-0">
                <span>{p.stage}</span>
                <span className="text-[color:var(--muted)]">{p.primary} <span className="opacity-60">({p.latency})</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Placeholder>
  );
}
function DocsTab(){
  return (
    <Placeholder title="Docs" subtitle="REST API, webhooks, rate limits, SDKs. Full docs land in Stage 6.">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="font-semibold">Quickstart</div>
          <div className="text-sm text-[color:var(--muted)] mt-2">Start a project from text, a URL, or a file. Zaidsaid handles the rest.</div>
        </div>
        <div className="card p-5">
          <div className="font-semibold">REST API</div>
          <div className="text-sm text-[color:var(--muted)] mt-2">Programmatic pipelines for agencies. Signed webhooks on every stage.</div>
        </div>
      </div>
    </Placeholder>
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
    setStudioStepRaw("research");
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
