/* Zaidsaid — app.js v2.0 — Stage 1: IA shell + Home
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
  { stage:"Script",   primary:"Claude 3.5", fallback:"GPT-4.1", latency:"1.4s" },
  { stage:"Storyboard", primary:"Flux 1.1 Pro", fallback:"SDXL", latency:"6.2s" },
  { stage:"Voice",    primary:"ElevenLabs", fallback:"PlayHT", latency:"1.1s" },
  { stage:"Avatar",   primary:"HeyGen", fallback:"Synthesia", latency:"9.8s" },
  { stage:"Motion",   primary:"Runway Gen-3", fallback:"Kling", latency:"11.5s" },
  { stage:"Music",    primary:"Suno", fallback:"Udio", latency:"2.9s" },
  { stage:"Captions", primary:"Whisper V3", fallback:"Deepgram", latency:"0.8s" },
  { stage:"Edit",     primary:"Zaidsaid Timeline", fallback:"—", latency:"0.2s" },
  { stage:"Publish",  primary:"Direct to platform", fallback:"Buffer", latency:"1.6s" },
];
const ARCHIVE_PLATFORMS = [
  { id:"shorts", name:"YouTube Shorts", ratio:"9/16", max:"60s" },
  { id:"reels",  name:"Instagram Reels", ratio:"9/16", max:"90s" },
  { id:"tiktok", name:"TikTok", ratio:"9/16", max:"3m" },
  { id:"x",      name:"X / Twitter", ratio:"1/1", max:"2m 20s" },
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
  { id:"home",       label:"Home",             icon:"home"     },
  { id:"studio",     label:"Studio",           icon:"studio"   },
  { id:"repurpose",  label:"Repurpose",        icon:"scissors" },
  { id:"avatars",    label:"Avatars & Voices", icon:"avatar"   },
  { id:"brands",     label:"Brand Kits",       icon:"brand"    },
  { id:"templates",  label:"Templates",        icon:"template" },
  { id:"projects",   label:"Projects",         icon:"folder"   },
  { id:"architecture", label:"Architecture",   icon:"blocks"   },
  { id:"docs",       label:"Docs",             icon:"book"     },
];

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
function TopBar({ tab, setTab }){
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
          <button className="btn btn-primary" onClick={()=>setTab("studio")}>
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
  { k:"pdf",  label:"PDF / doc" },
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

function HomeTab({ setTab }){
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
            <button className="btn btn-primary" onClick={()=>setTab("studio")}>{I.spark({size:16})} <span>Start a project</span></button>
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
            <button className="btn btn-primary" onClick={()=>setTab("studio")}>{I.play({size:14})} Start a project</button>
            <button className="btn" onClick={()=>setTab("docs")}>{I.book({size:14})} Read the docs</button>
          </div>
        </div>
      </section>
    </div>
  );
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
function StudioTab({ setTab }){
  return (
    <Placeholder title="Studio" subtitle="Research → Script → Storyboard → Assets → Motion → Voice → Timeline → Export. Coming online in Stage 2.">
      <div className="grid md:grid-cols-4 gap-3">
        {ARCHIVE_PIPELINE.map((s,i) => (
          <div key={s} className="card p-4">
            <div className="text-[10px] text-[color:var(--muted)] uppercase tracking-widest">Stage {i+1}</div>
            <div className="text-white font-semibold mt-1">{s}</div>
          </div>
        ))}
      </div>
    </Placeholder>
  );
}
function RepurposeTab(){
  return (
    <Placeholder title="Repurpose" subtitle="Long-form → shorts. Highlight detection and virality scoring. Coming online in Stage 3.">
      <div className="grid md:grid-cols-3 gap-3">
        {ARCHIVE_PLATFORMS.map(p => (
          <div key={p.id} className="card p-4">
            <div className="text-sm font-semibold">{p.name}</div>
            <div className="text-xs text-[color:var(--muted)] mt-1">{p.ratio} • up to {p.max}</div>
          </div>
        ))}
      </div>
    </Placeholder>
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
  useEffect(()=>{
    const hash = (location.hash||"").replace("#","");
    if(hash && TABS.find(t=>t.id===hash)) setTab(hash);
  }, []);
  useEffect(()=>{ if(tab) history.replaceState(null, "", "#"+tab); }, [tab]);

  const View = useMemo(()=> {
    switch(tab){
      case "home": return <HomeTab setTab={setTab}/>;
      case "studio": return <StudioTab setTab={setTab}/>;
      case "repurpose": return <RepurposeTab/>;
      case "avatars": return <AvatarsTab/>;
      case "brands": return <BrandsTab/>;
      case "templates": return <TemplatesTab/>;
      case "projects": return <ProjectsTab/>;
      case "architecture": return <ArchitectureTab/>;
      case "docs": return <DocsTab/>;
      default: return <HomeTab setTab={setTab}/>;
    }
  }, [tab]);

  return (
    <Boundary>
      <TopBar tab={tab} setTab={setTab} />
      <main id="main" role="main">{View}</main>
      <Footer />
    </Boundary>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
