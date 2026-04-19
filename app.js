/* Zaidsaid - live React SPA (v1.0) - every tab hard-coded and functional
 * Rebranded from PRISMA. Hosted statically on GitHub Pages at zaidsaid.com.
 */
const { useState, useEffect, useMemo, useRef } = React;

/* ============================== SEED DATA ============================== */

const BRAND = {
  name: "Zaidsaid",
  tagline: "The operating system for AI video.",
  version: "v1.0",
  cloudCount: 5
};

const SEED_JOBS = [
  {
    id: "1ac278127fe7",
    topic: "Why mushrooms talk to trees underground",
    status: "done",
    progress: 100,
    mode: "generate",
    platforms: ["shorts", "reels", "tiktok", "youtube"],
    created: "2d ago",
    duration: 25,
    thumb: "linear-gradient(135deg,#0b4d3a 0%,#22d3ee 45%,#6366f1 100%)",
    caption: "Mycorrhizal networks let forests trade carbon and warnings in real time."
  },
  {
    id: "9a251bdd7ac2",
    topic: "How GPS uses Einstein relativity",
    status: "done",
    progress: 100,
    mode: "generate",
    platforms: ["shorts", "reels", "youtube"],
    created: "3d ago",
    duration: 28,
    thumb: "linear-gradient(135deg,#111827 0%,#6366f1 50%,#ec4899 100%)",
    caption: "Orbit clocks tick 38 microseconds faster per day. Without Einstein, GPS drifts kilometers."
  },
  {
    id: "17d6d387ee35",
    topic: "Repurpose: Huberman x Attia long-form -> 5 shorts",
    status: "done",
    progress: 100,
    mode: "repurpose",
    platforms: ["shorts", "tiktok", "reels"],
    created: "5d ago",
    duration: 60,
    thumb: "linear-gradient(135deg,#1e1b4b 0%,#f59e0b 50%,#ec4899 100%)",
    caption: "Ranked 5 highest-energy moments, exported platform-native."
  },
  {
    id: "4c99aa012de3",
    topic: "Octopi taste with their arms",
    status: "done",
    progress: 100,
    mode: "generate",
    platforms: ["shorts", "reels", "tiktok"],
    created: "6d ago",
    duration: 22,
    thumb: "linear-gradient(135deg,#7c2d12 0%,#ec4899 50%,#6366f1 100%)",
    caption: "Each of 2,000 suckers is a chemical receptor."
  },
  {
    id: "e94e382b00e3",
    topic: "Untitled - CRISPR explainer draft",
    status: "running",
    progress: 68,
    mode: "generate",
    platforms: [],
    created: "12m ago",
    duration: 30,
    thumb: "linear-gradient(135deg,#064e3b 0%,#10b981 60%,#22d3ee 100%)",
    caption: null
  },
  {
    id: "30d611d70683",
    topic: "Honeybees see UV patterns on flowers",
    status: "queued",
    progress: 0,
    mode: "generate",
    platforms: [],
    created: "just now",
    duration: 25,
    thumb: "linear-gradient(135deg,#1e1b4b 0%,#6366f1 50%,#22d3ee 100%)",
    caption: null
  }
];

const SEED_BRAND_KITS = [
  {
    id: "prisma-default",
    name: "Zaidsaid - default",
    tagline: "Any input. Every format.",
    primary: "#6366F1",
    accent: "#22D3EE",
    aspect: "9:16",
    motion: "cinematic",
    voice: "warm",
    palette: ["#0B0B14", "#6366F1", "#22D3EE"]
  },
  {
    id: "acme-weekly",
    name: "ACME SaaS - weekly",
    tagline: "Ship more. Explain less.",
    primary: "#F97316",
    accent: "#FBBF24",
    aspect: "16:9",
    motion: "snappy",
    voice: "authoritative",
    palette: ["#1A0F00", "#F97316", "#FBBF24"]
  },
  {
    id: "lab-notebook",
    name: "Lab Notebook",
    tagline: "Show the work.",
    primary: "#10B981",
    accent: "#22D3EE",
    aspect: "1:1",
    motion: "documentary",
    voice: "calm",
    palette: ["#042F2E", "#10B981", "#A7F3D0"]
  }
];

const PIPELINE_STAGES = [
  { id: "ingest",    label: "Ingest",     blurb: "normalize text / URL / file" },
  { id: "research",  label: "Research",   blurb: "gather supporting evidence" },
  { id: "script",    label: "Script",     blurb: "hook > beats > close" },
  { id: "storyboard",label: "Storyboard", blurb: "scenes / motion / timing" },
  { id: "continuity",label: "Continuity", blurb: "lock character + style" },
  { id: "visuals",   label: "Visuals",    blurb: "per-scene stills" },
  { id: "motion",    label: "Motion",     blurb: "stills to video" },
  { id: "voice",     label: "Voice",      blurb: "narration TTS" },
  { id: "music",     label: "Music",      blurb: "score + SFX" },
  { id: "composite", label: "Composite",  blurb: "final edit" },
  { id: "dub",       label: "Dub",        blurb: "multi-language" },
  { id: "export",    label: "Export",     blurb: "platform variants" },
  { id: "rights",    label: "Rights",     blurb: "attribution + blockers" }
];

const PROVIDERS = [
  { stage: "research",   tier: "active - tavily",    options: ["Tavily", "Serper", "Wikipedia (free)"] },
  { stage: "script",     tier: "active - local",     options: ["Claude Sonnet 4.6", "GPT-4o", "Local templating"] },
  { stage: "storyboard", tier: "active - local",     options: ["GPT-4o (JSON mode)", "Claude", "Local heuristic"] },
  { stage: "continuity", tier: "",                   options: ["GPT-4o", "Claude", "Local single-narrator"] },
  { stage: "images",     tier: "active - replicate", options: ["FLUX - Replicate", "DALL-E 3", "Pillow studio"] },
  { stage: "motion",     tier: "active - runway",    options: ["Runway Gen-3", "Luma", "SVD", "Ken-Burns ffmpeg"] },
  { stage: "voice",      tier: "active - silent",    options: ["ElevenLabs Turbo v2.5", "OpenAI TTS HD", "gTTS", "Silent ambient"] },
  { stage: "dub",        tier: "",                   options: ["ElevenLabs Multilingual", "OpenAI TTS", "Skip"] },
  { stage: "avatar",     tier: "active - heygen",    options: ["HeyGen Interactive", "D-ID", "SadTalker"] },
  { stage: "music",      tier: "active - suno",      options: ["Suno v3", "Library", "Ambient synth"] }
];

const PLATFORM_SPEC = {
  shorts:    { label: "YT Shorts",  aspect: "9:16",  maxDur: 60,   caption: "burned bold", res: "1080x1920" },
  reels:     { label: "Reels",      aspect: "9:16",  maxDur: 90,   caption: "burned bold", res: "1080x1920" },
  tiktok:    { label: "TikTok",     aspect: "9:16",  maxDur: 180,  caption: "burned bold", res: "1080x1920" },
  x:         { label: "X / Twitter",aspect: "16:9",  maxDur: 140,  caption: "burned bold", res: "1280x720"  },
  linkedin:  { label: "LinkedIn",   aspect: "1:1",   maxDur: 600,  caption: "subtle",      res: "1080x1080" },
  youtube:   { label: "YouTube",    aspect: "16:9",  maxDur: 1200, caption: "subtle",      res: "1920x1080" }
};

const LANGUAGES = [
  { code: "en", label: "English", flag: "EN" },
  { code: "es", label: "Spanish", flag: "ES" },
  { code: "pt", label: "Portuguese", flag: "PT" },
  { code: "fr", label: "French", flag: "FR" },
  { code: "de", label: "German", flag: "DE" },
  { code: "ar", label: "Arabic", flag: "AR" },
  { code: "zh", label: "Mandarin", flag: "ZH" },
  { code: "hi", label: "Hindi", flag: "HI" },
  { code: "ja", label: "Japanese", flag: "JA" },
  { code: "ko", label: "Korean", flag: "KO" }
];

const AVATARS = [
  { id: "nova",  name: "Nova",  tone: "friendly host",     gradient: "linear-gradient(135deg,#312e81,#6366f1 60%,#22d3ee)" },
  { id: "atlas", name: "Atlas", tone: "corporate narrator", gradient: "linear-gradient(135deg,#78350f,#d97706 70%,#fbbf24)" },
  { id: "vera",  name: "Vera",  tone: "science explainer", gradient: "linear-gradient(135deg,#4c1d95,#ec4899 70%,#fbbf24)" },
  { id: "orion", name: "Orion", tone: "documentary",       gradient: "linear-gradient(135deg,#064e3b,#10b981 60%,#22d3ee)" },
  { id: "you",   name: "You",   tone: "custom clone",      gradient: "linear-gradient(135deg,#1f2937,#6b7280)" }
];

const MUSHROOM_STORYBOARD = [
  { id: 1, label: "HOOK",    motion: "slow push-in",  duration: 4.8, narration: "Why do mushrooms talk to trees underground? Let's get into it." },
  { id: 2, label: "CONTEXT", motion: "parallax",      duration: 4.2, narration: "Below every forest is a living network of fungal threads called mycelium." },
  { id: 3, label: "INSIGHT", motion: "orbit",         duration: 4.6, narration: "Trees trade sugars for minerals through this network - and they trade warnings too." },
  { id: 4, label: "EVIDENCE",motion: "cut stack",     duration: 4.0, narration: "In one study, injured trees sent chemical distress signals that reached neighbors in minutes." },
  { id: 5, label: "IMPLIC",  motion: "pull back",     duration: 4.1, narration: "The forest isn't a collection of trees. It's one distributed organism thinking slowly." },
  { id: 6, label: "CLOSE",   motion: "static breathe",duration: 3.3, narration: "So - the ground beneath your feet is basically Wi-Fi with chlorophyll." }
];

const REPURPOSE_CLIPS = [
  { id: "c1", score: 94, start: "08:12", end: "08:58", title: "The 'dopamine ceiling' rant", hook: "Why every notification is costing you focus", thumb: "linear-gradient(135deg,#1e1b4b,#6366f1 60%,#22d3ee)" },
  { id: "c2", score: 91, start: "22:04", end: "22:51", title: "Zone 2 is underrated",        hook: "One chart that ends the cardio debate",       thumb: "linear-gradient(135deg,#064e3b,#10b981 70%,#fbbf24)" },
  { id: "c3", score: 88, start: "41:30", end: "42:17", title: "Sleep debt compounds",        hook: "The real reason 6 hours feels 'fine'",         thumb: "linear-gradient(135deg,#4c1d95,#ec4899 70%,#f59e0b)" },
  { id: "c4", score: 84, start: "55:22", end: "56:08", title: "Cold plunge disclaimer",      hook: "What the TikTok clips won't tell you",         thumb: "linear-gradient(135deg,#0c4a6e,#22d3ee 70%,#a5f3fc)" },
  { id: "c5", score: 81, start: "01:03:14", end: "01:04:02", title: "Coffee + cortisol",     hook: "The 90-minute rule almost nobody follows",     thumb: "linear-gradient(135deg,#7c2d12,#f97316 60%,#fbbf24)" }
];

/* ============================== PRIMITIVES ============================== */

const cls = (...a) => a.filter(Boolean).join(" ");

const Panel = ({children, className=""}) =>
  React.createElement("div", {className: cls("bg-panel/70 border border-line rounded-2xl backdrop-blur-sm", className)}, children);

const Label = ({children}) =>
  React.createElement("div", {className:"text-[10px] tracking-[0.2em] font-mono uppercase text-dim"}, children);

const Chip = ({children, tone="line", onClick}) => {
  const tones = {
    line:    "border-line text-slate-300",
    indigo:  "border-indigo/40 text-indigo-300 bg-indigo/10",
    cyan:    "border-cyan/40 text-cyan-300 bg-cyan/10",
    emerald: "border-emerald/40 text-emerald-300 bg-emerald/10",
    amber:   "border-amber/40 text-amber-300 bg-amber/10",
    pink:    "border-pink/40 text-pink-300 bg-pink/10"
  };
  return React.createElement("span", {
    onClick,
    className: cls("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-mono", tones[tone] || tones.line, onClick && "cursor-pointer hover:brightness-125")
  }, children);
};

const Ico = ({d, className=""}) =>
  React.createElement("svg", {viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:1.75, className: cls("w-4 h-4", className)},
    React.createElement("path", {d, strokeLinecap:"round", strokeLinejoin:"round"})
  );

const ICONS = {
  folder:   "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
  sparkle:  "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  grid:     "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  shield:   "M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z",
  scissors: "M6 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm0 10a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm2-6 12-6M8 13l12 6",
  user:     "M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4ZM4 20a8 8 0 0 1 16 0",
  layers:   "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  circuit:  "M4 7h7l3 3v7M20 17h-4M7 4v3M13 20v-3M4 11v3M4 17h3",
  plus:     "M12 5v14M5 12h14",
  play:     "M7 5v14l12-7Z",
  download: "M12 4v12m-5-5 5 5 5-5M5 20h14",
  share:    "M15 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 13l6 3M9 10l6-3",
  refresh:  "M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0 1 14-3M20 14a8 8 0 0 1-14 3",
  trash:    "M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2",
  pencil:   "M4 20h4L20 8l-4-4L4 16v4ZM14 6l4 4",
  globe:    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c3 3 3 15 0 18M12 3c-3 3-3 15 0 18M3 12h18",
  mic:      "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3ZM5 11a7 7 0 0 0 14 0M12 18v3",
  flame:    "M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 3 3 0-3-2-5 0-8Z",
  check:    "M5 12l4 4 10-10",
  close:    "M6 6l12 12M18 6 6 18",
  arrow:    "M5 12h14M13 5l7 7-7 7"
};

const Stat = ({label, value, tone="indigo"}) =>
  React.createElement("div", {className:"px-4 py-3 rounded-xl border border-line bg-panel/60"},
    React.createElement(Label, null, label),
    React.createElement("div", {className: cls("text-xl font-display mt-1 tick", tone==="indigo"?"text-indigo-300":tone==="cyan"?"text-cyan-300":tone==="emerald"?"text-emerald-300":"text-slate-200")}, value)
  );

const StatusDot = ({status}) => {
  const tones = { done:"bg-emerald", running:"bg-cyan animate-pulse", queued:"bg-amber", failed:"bg-pink", idle:"bg-dim" };
  return React.createElement("span", {className: cls("inline-block w-1.5 h-1.5 rounded-full", tones[status] || tones.idle)});
};

const Bar = ({value=0, tone="indigo"}) => {
  const fills = { indigo:"from-indigo to-cyan", emerald:"from-emerald to-cyan", amber:"from-amber to-pink" };
  return React.createElement("div", {className:"w-full h-1 rounded-full bg-line overflow-hidden"},
    React.createElement("div", {className: cls("h-full bg-gradient-to-r", fills[tone] || fills.indigo), style:{width: (value||0)+"%"}})
  );
};

/* ============================== APP SHELL ============================== */

const TABS = [
  { id: "projects",    label: "Projects",     icon: ICONS.folder   },
  { id: "generate",    label: "Generate",     icon: ICONS.sparkle  },
  { id: "platforms",   label: "Platforms",    icon: ICONS.grid     },
  { id: "brand",       label: "Brand kits",   icon: ICONS.shield   },
  { id: "repurpose",   label: "Repurpose",    icon: ICONS.scissors },
  { id: "embody",      label: "Embody",       icon: ICONS.user     },
  { id: "compose",     label: "Compose",      icon: ICONS.layers   },
  { id: "architecture",label: "Architecture", icon: ICONS.circuit  }
];

function useLocalState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal];
}

function App() {
  const [tab, setTab] = useLocalState("zs.tab.v1", "projects");
  const [jobs, setJobs] = useLocalState("zs.jobs.v1", SEED_JOBS);
  const [brandKits, setBrandKits] = useLocalState("zs.brands.v1", SEED_BRAND_KITS);
  const [currentJobId, setCurrentJobId] = useLocalState("zs.job.v1", SEED_JOBS[0].id);

  const currentJob = jobs.find(j => j.id === currentJobId) || jobs[0];

  const goto = (t, id) => {
    if (id) setCurrentJobId(id);
    setTab(t);
  };

  return React.createElement(React.Fragment, null,
    React.createElement(TopBar, { tab, setTab, currentJob }),
    React.createElement("main", {className:"max-w-7xl mx-auto px-6 pb-24 pt-10"},
      tab === "projects"     && React.createElement(ProjectsTab,    { jobs, setJobs, goto }),
      tab === "generate"     && React.createElement(GenerateTab,    { brandKits, jobs, setJobs, goto }),
      tab === "platforms"    && React.createElement(PlatformsTab,   { currentJob, jobs, goto }),
      tab === "brand"        && React.createElement(BrandsTab,      { brandKits, setBrandKits }),
      tab === "repurpose"    && React.createElement(RepurposeTab,   { goto, jobs, setJobs }),
      tab === "embody"       && React.createElement(EmbodyTab,      { }),
      tab === "compose"      && React.createElement(ComposeTab,     { currentJob, jobs, setJobs, goto }),
      tab === "architecture" && React.createElement(ArchitectureTab,{ })
    ),
    React.createElement(Footer, null)
  );
}

function TopBar({tab, setTab, currentJob}) {
  return React.createElement("header", {className:"sticky top-0 z-30 backdrop-blur-lg bg-ink/70 border-b border-line"},
    React.createElement("div", {className:"max-w-7xl mx-auto px-6 h-16 flex items-center gap-6"},
      React.createElement("div", {className:"flex items-center gap-3"},
        React.createElement("svg", {viewBox:"0 0 32 32", className:"w-7 h-7"},
          React.createElement("defs", null,
            React.createElement("linearGradient", {id:"logoG", x1:"0", y1:"0", x2:"1", y2:"1"},
              React.createElement("stop", {offset:"0%", stopColor:"#6366F1"}),
              React.createElement("stop", {offset:"100%", stopColor:"#22D3EE"})
            )
          ),
          React.createElement("polygon", {points:"16 3 29 27 3 27", fill:"url(#logoG)"})
        ),
        React.createElement("div", {className:"font-display text-lg tracking-tight"}, "ZAIDSAID"),
        React.createElement(Chip, {tone:"indigo"}, BRAND.version + " - live")
      ),
      React.createElement("nav", {className:"flex items-center gap-1 overflow-x-auto no-scrollbar"},
        TABS.map(t =>
          React.createElement("button", {
            key: t.id,
            onClick: () => setTab(t.id),
            className: cls("flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all",
              tab === t.id ? "bg-panel border border-line text-slate-100" : "text-dim hover:text-slate-200")
          },
            React.createElement(Ico, {d: t.icon}),
            t.label
          )
        )
      ),
      React.createElement("div", {className:"ml-auto flex items-center gap-3"},
        currentJob && React.createElement("div", {className:"hidden md:flex items-center gap-2 text-xs font-mono text-dim"},
          React.createElement(StatusDot, {status: currentJob.status}),
          currentJob.id,
          React.createElement(Chip, {tone: currentJob.status==="done"?"emerald":currentJob.status==="running"?"cyan":"amber"}, currentJob.status.toUpperCase())
        ),
        React.createElement("div", {className:"hidden lg:flex items-center gap-2 text-xs"},
          React.createElement("span", {className:"w-1.5 h-1.5 rounded-full bg-emerald animate-pulse"}),
          React.createElement("span", {className:"text-dim font-mono"}, BRAND.cloudCount + " cloud providers live")
        )
      )
    )
  );
}

function Footer() {
  return React.createElement("footer", {className:"border-t border-line mt-24"},
    React.createElement("div", {className:"max-w-7xl mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-dim"},
      React.createElement("div", {className:"flex items-center gap-3"},
        React.createElement("svg", {viewBox:"0 0 32 32", className:"w-4 h-4"},
          React.createElement("polygon", {points:"16 3 29 27 3 27", fill:"url(#logoG)"})
        ),
        React.createElement("span", null, "ZAIDSAID - " + BRAND.version + " - video operating system - 13-stage neural pipeline")
      ),
      React.createElement("div", null, "zaidsaid.com - Any input. Every platform.")
    )
  );
}

/* ============================== PROJECTS TAB ============================== */

function ProjectsTab({jobs, setJobs, goto}) {
  const [filter, setFilter] = useState("all");
  const filtered = jobs.filter(j => filter === "all" || j.status === filter);

  const remove = (id) => { setJobs(jobs.filter(j => j.id !== id)); };
  const duplicate = (id) => {
    const j = jobs.find(x => x.id === id);
    if (!j) return;
    const copy = { ...j, id: Math.random().toString(16).slice(2, 14), topic: j.topic + " (copy)", status: "queued", progress: 0, platforms: [], created: "just now" };
    setJobs([copy, ...jobs]);
  };

  return React.createElement("section", {className:"space-y-8"},
    React.createElement("header", {className:"flex flex-wrap items-end justify-between gap-6"},
      React.createElement("div", null,
        React.createElement(Label, null, "your work"),
        React.createElement("h1", {className:"mt-2 text-4xl font-display bg-gradient-to-br from-cyan-200 via-indigo-300 to-pink-300 bg-clip-text text-transparent"}, "Projects."),
        React.createElement("p", {className:"mt-3 text-slate-400 max-w-xl"}, "Every video Zaidsaid has rendered for you. Click a card to jump into its platform exports, review it, or publish.")
      ),
      React.createElement("div", {className:"flex items-center gap-3"},
        React.createElement("div", {className:"flex items-center gap-1 text-xs font-mono bg-panel border border-line rounded-lg p-1"},
          ["all","done","running","queued","failed"].map(f =>
            React.createElement("button", {
              key: f,
              onClick: () => setFilter(f),
              className: cls("px-2.5 py-1 rounded-md capitalize",
                filter === f ? "bg-indigo/20 text-indigo-200 border border-indigo/40" : "text-dim hover:text-slate-200")
            }, f)
          )
        ),
        React.createElement("button", {
          onClick: () => goto("generate"),
          className: "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-indigo to-cyan text-ink shadow-lg glow hover:brightness-110 transition"
        },
          React.createElement(Ico, {d: ICONS.plus, className:"w-4 h-4"}),
          "New project"
        )
      )
    ),
    React.createElement("div", {className:"grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"},
      filtered.map(j =>
        React.createElement(Panel, {key: j.id, className:"p-0 overflow-hidden group hover:border-indigo/40 transition"},
          React.createElement("div", {className:"relative aspect-[16/10] flex items-end", style:{background: j.thumb}},
            React.createElement("div", {className:"absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"}),
            React.createElement("div", {className:"absolute top-3 left-3 flex items-center gap-2"},
              React.createElement(Chip, {tone:"line"}, "DRAFT"),
              React.createElement(Chip, {tone:"indigo"}, "v1")
            ),
            React.createElement("div", {className:"absolute top-3 right-3"},
              React.createElement(Chip, {tone: j.status==="done"?"emerald":j.status==="running"?"cyan":j.status==="failed"?"pink":"amber"},
                React.createElement(StatusDot, {status: j.status}),
                j.status
              )
            ),
            React.createElement("div", {className:"relative p-4 w-full"},
              React.createElement("div", {className:"text-lg font-display leading-snug line-clamp-2"}, j.topic),
              j.caption && React.createElement("div", {className:"mt-1 text-xs text-slate-300/80 line-clamp-2"}, j.caption)
            )
          ),
          React.createElement("div", {className:"px-4 py-3 border-t border-line"},
            React.createElement("div", {className:"flex items-center gap-3 text-[11px] font-mono text-dim"},
              React.createElement("span", null, j.id),
              React.createElement("span", null, "-"),
              React.createElement("span", null, j.duration + "s"),
              React.createElement("span", null, "-"),
              React.createElement("span", null, j.platforms.length + " platforms"),
              React.createElement("span", {className:"ml-auto"}, j.created)
            ),
            j.status === "running" && React.createElement("div", {className:"mt-2"}, React.createElement(Bar, {value: j.progress})),
            React.createElement("div", {className:"mt-3 flex items-center gap-2"},
              React.createElement("button", {
                onClick: () => goto("platforms", j.id),
                className:"flex-1 rounded-lg bg-panel border border-line hover:border-indigo/50 hover:bg-indigo/5 py-2 text-sm transition"
              }, "Open"),
              React.createElement("button", {
                onClick: () => duplicate(j.id),
                title: "Duplicate",
                className:"rounded-lg border border-line hover:border-cyan/50 p-2 text-dim hover:text-cyan-300"
              }, React.createElement(Ico, {d: ICONS.refresh})),
              React.createElement("button", {
                onClick: () => remove(j.id),
                title: "Delete",
                className:"rounded-lg border border-line hover:border-pink/50 p-2 text-dim hover:text-pink"
              }, React.createElement(Ico, {d: ICONS.trash}))
            )
          )
        )
      ),
      filtered.length === 0 && React.createElement("div", {className:"col-span-full text-center py-16 text-dim"},
        "No projects match this filter. Try ",
        React.createElement("button", {onClick: () => setFilter("all"), className:"text-indigo-300 underline"}, "all"),
        "."
      )
    )
  );
}

/* ============================== GENERATE TAB ============================== */

function GenerateTab({brandKits, jobs, setJobs, goto}) {
  const [idea, setIdea] = useState("Why honeybees see colors we can't");
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState(25);
  const [brandId, setBrandId] = useState(brandKits[0]?.id || "");
  const [platforms, setPlatforms] = useState(["shorts","reels","tiktok","youtube"]);
  const [running, setRunning] = useState(null);
  const [stageIdx, setStageIdx] = useState(-1);

  const togglePlatform = (p) => setPlatforms(platforms.includes(p) ? platforms.filter(x => x !== p) : [...platforms, p]);

  useEffect(() => {
    if (!running) return;
    if (stageIdx >= PIPELINE_STAGES.length) {
      const id = Math.random().toString(16).slice(2, 14);
      const newJob = {
        id, topic: idea, status: "done", progress: 100, mode: "generate",
        platforms, created: "just now", duration,
        thumb: "linear-gradient(135deg,#0b3d2e 0%,#22d3ee 50%,#6366f1 100%)",
        caption: "Freshly generated by Zaidsaid."
      };
      setJobs([newJob, ...jobs]);
      setRunning(null);
      setStageIdx(-1);
      goto("platforms", id);
      return;
    }
    const t = setTimeout(() => setStageIdx(i => i + 1), 420);
    return () => clearTimeout(t);
  }, [running, stageIdx]);

  const start = () => { setRunning(true); setStageIdx(0); };
  const cancel = () => { setRunning(null); setStageIdx(-1); };

  const brand = brandKits.find(b => b.id === brandId) || brandKits[0];

  return React.createElement("section", {className:"space-y-8"},
    React.createElement("header", null,
      React.createElement(Label, null, "new project - video operating system"),
      React.createElement("h1", {className:"mt-2 text-4xl md:text-5xl font-display leading-tight"},
        React.createElement("span", {className:"bg-gradient-to-r from-indigo-200 via-cyan-200 to-pink-200 bg-clip-text text-transparent"}, "Any input."),
        " ",
        React.createElement("span", {className:"bg-gradient-to-r from-cyan-200 via-indigo-200 to-pink-300 bg-clip-text text-transparent"}, "Every platform.")
      ),
      React.createElement("p", {className:"mt-3 text-slate-400 max-w-2xl"}, "Start from a prompt, a URL, or a file. Zaidsaid ships through 13 neural stages to deliver platform-native video in minutes.")
    ),
    React.createElement("div", {className:"grid grid-cols-1 lg:grid-cols-5 gap-6"},
      React.createElement(Panel, {className:"lg:col-span-3 p-6 space-y-6"},
        React.createElement("div", null,
          React.createElement(Label, null, "source"),
          React.createElement("div", {className:"mt-3"},
            React.createElement("div", {className:"text-xs font-mono text-dim mb-2"}, "YOUR IDEA, ARTICLE, OR PROMPT"),
            React.createElement("textarea", {
              rows: 4, value: idea, onChange: e => setIdea(e.target.value),
              placeholder: "e.g. Explain CRISPR gene editing for a curious high-schooler",
              className:"w-full bg-panel border border-line rounded-lg px-4 py-3 text-sm placeholder:text-dim focus:outline-none focus:border-indigo/70 resize-none"
            })
          ),
          React.createElement("div", {className:"mt-4"},
            React.createElement("div", {className:"text-xs font-mono text-dim mb-2"}, "OR A URL (ARTICLE, PODCAST, WIKIPEDIA, YOUTUBE)"),
            React.createElement("div", {className:"relative"},
              React.createElement("span", {className:"absolute left-3 top-1/2 -translate-y-1/2 text-dim"}, React.createElement(Ico, {d: ICONS.globe})),
              React.createElement("input", {
                value: url, onChange: e => setUrl(e.target.value),
                placeholder:"https://...",
                className:"w-full bg-panel border border-line rounded-lg pl-9 pr-3 py-2.5 text-sm placeholder:text-dim focus:outline-none focus:border-indigo/70"
              })
            )
          ),
          React.createElement("div", {className:"mt-4 flex items-center gap-4"},
            React.createElement("div", {className:"text-xs font-mono text-dim"}, "TARGET DURATION"),
            React.createElement("div", {className:"flex items-center gap-3 flex-1"},
              React.createElement("div", {className:"font-mono text-sm w-10 tick"}, duration + "s"),
              React.createElement("input", {
                type:"range", min:"15", max:"180", value: duration,
                onChange: e => setDuration(+e.target.value),
                className:"flex-1 accent-indigo"
              })
            )
          )
        ),
        React.createElement("div", null,
          React.createElement(Label, null, "brand kit"),
          React.createElement("div", {className:"mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3"},
            brandKits.map(b =>
              React.createElement("button", {
                key: b.id,
                onClick: () => setBrandId(b.id),
                className: cls("rounded-xl border px-3 py-3 text-left transition",
                  brandId === b.id ? "border-indigo/60 bg-indigo/10" : "border-line hover:border-cyan/40")
              },
                React.createElement("div", {className:"flex gap-1 mb-2"},
                  b.palette.map((c,i) => React.createElement("div", {key:i, className:"h-6 flex-1 rounded", style:{background:c}}))
                ),
                React.createElement("div", {className:"text-sm font-medium"}, b.name),
                React.createElement("div", {className:"text-[11px] text-dim font-mono mt-0.5"}, b.aspect + " - " + b.motion + " - " + b.voice)
              )
            )
          )
        ),
        React.createElement("div", null,
          React.createElement(Label, null, "platforms to publish"),
          React.createElement("div", {className:"mt-3 flex flex-wrap gap-2"},
            Object.keys(PLATFORM_SPEC).map(p =>
              React.createElement("button", {
                key: p,
                onClick: () => togglePlatform(p),
                className: cls("rounded-lg border px-3 py-1.5 text-xs font-mono transition",
                  platforms.includes(p) ? "border-cyan/50 bg-cyan/10 text-cyan-200" : "border-line text-dim hover:text-slate-200")
              }, PLATFORM_SPEC[p].label + " - " + PLATFORM_SPEC[p].aspect)
            )
          )
        ),
        React.createElement("div", {className:"flex items-center gap-3 pt-2"},
          React.createElement("button", {
            onClick: running ? cancel : start,
            className: cls("rounded-xl px-5 py-2.5 text-sm font-medium transition",
              running ? "bg-pink/20 border border-pink/40 text-pink-300" : "bg-gradient-to-r from-indigo to-cyan text-ink shadow-lg glow hover:brightness-110")
          }, running ? "Cancel run" : "Generate video"),
          React.createElement("div", {className:"text-xs font-mono text-dim"},
            "brand: ", React.createElement("span", {className:"text-slate-300"}, brand?.name || "none"),
            " - ", duration, "s - ", platforms.length, " platforms"
          )
        )
      ),
      React.createElement(Panel, {className:"lg:col-span-2 p-6"},
        React.createElement("div", {className:"flex items-center justify-between"},
          React.createElement(Label, null, "pipeline - " + (running ? "running" : "idle")),
          React.createElement("div", {className:"text-xs font-mono tick text-slate-300"},
            running ? Math.min(100, Math.round(((stageIdx+1) / PIPELINE_STAGES.length) * 100)) + "%" : "0%"
          )
        ),
        React.createElement("div", {className:"mt-3"}, React.createElement(Bar, {value: running ? Math.min(100, Math.round(((stageIdx+1) / PIPELINE_STAGES.length) * 100)) : 0})),
        React.createElement("ol", {className:"mt-5 space-y-2.5"},
          PIPELINE_STAGES.map((s, i) => {
            const state = !running ? "idle" : i < stageIdx ? "done" : i === stageIdx ? "running" : "queued";
            return React.createElement("li", {key: s.id, className:"flex items-center gap-3"},
              React.createElement("span", {className: cls("w-2 h-2 rounded-full",
                state==="done" ? "bg-emerald" : state==="running" ? "bg-cyan animate-pulse" : "bg-line")}),
              React.createElement("div", {className:"flex-1"},
                React.createElement("div", {className:"text-sm"}, s.label),
                React.createElement("div", {className:"text-[11px] font-mono text-dim"}, s.blurb)
              ),
              state === "done" && React.createElement(Ico, {d: ICONS.check, className:"text-emerald w-4 h-4"})
            );
          })
        )
      )
    )
  );
}

/* ============================== PLATFORMS TAB ============================== */

function PlatformsTab({currentJob, jobs, goto}) {
  const doneJobs = jobs.filter(j => j.status === "done");
  const job = currentJob && currentJob.status === "done" ? currentJob : doneJobs[0];

  if (!job) {
    return React.createElement("section", {className:"space-y-6"},
      React.createElement(Label, null, "platform-native exports"),
      React.createElement("h1", {className:"text-4xl font-display mt-2"}, "Nothing to publish yet."),
      React.createElement("p", {className:"text-slate-400 mt-3 max-w-xl"}, "Finish a project first. Head to Generate or pick one from Projects."),
      React.createElement("div", {className:"flex gap-3 mt-5"},
        React.createElement("button", {onClick: () => goto("generate"), className:"rounded-lg bg-gradient-to-r from-indigo to-cyan text-ink px-4 py-2 text-sm"}, "Generate"),
        React.createElement("button", {onClick: () => goto("projects"), className:"rounded-lg border border-line px-4 py-2 text-sm"}, "Projects")
      )
    );
  }

  const allPlatforms = Object.keys(PLATFORM_SPEC);
  const enabled = job.platforms && job.platforms.length ? job.platforms : allPlatforms;

  return React.createElement("section", {className:"space-y-8"},
    React.createElement("header", null,
      React.createElement(Label, null, "platform-native exports"),
      React.createElement("h1", {className:"mt-2 text-4xl md:text-5xl font-display"},
        React.createElement("span", {className:"bg-gradient-to-r from-cyan-200 via-indigo-200 to-pink-300 bg-clip-text text-transparent"}, "One render. Every platform.")
      ),
      React.createElement("p", {className:"mt-3 text-slate-400 max-w-2xl"}, "Download each variant and post. YouTube and LinkedIn get subtle captions; Shorts, Reels, TikTok, and X get burned-bold captions.")
    ),
    React.createElement(Panel, {className:"p-5 flex flex-wrap items-center justify-between gap-4"},
      React.createElement("div", {className:"flex flex-wrap items-center gap-3"},
        React.createElement(Label, null, "project"),
        React.createElement("span", {className:"font-mono text-sm text-slate-200"}, job.id),
        React.createElement(Chip, {tone:"line"}, "DRAFT"),
        React.createElement(Chip, {tone:"indigo"}, "v1"),
        React.createElement("span", {className:"text-sm text-slate-200"}, job.topic)
      ),
      React.createElement("div", {className:"flex items-center gap-3"},
        React.createElement("button", {className:"rounded-lg border border-line px-3 py-1.5 text-xs hover:border-cyan/40"}, "Regenerate captions"),
        React.createElement("button", {className:"rounded-lg bg-gradient-to-r from-indigo to-cyan text-ink px-4 py-2 text-sm"}, "Submit for review")
      )
    ),
    React.createElement("div", {className:"grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"},
      allPlatforms.map(p => {
        const spec = PLATFORM_SPEC[p];
        const active = enabled.includes(p);
        const isPortrait = spec.aspect === "9:16";
        const isSquare = spec.aspect === "1:1";
        return React.createElement(Panel, {key: p, className: cls("p-4 space-y-3", !active && "opacity-50")},
          React.createElement("div", {className:"flex items-center justify-between"},
            React.createElement(Label, null, spec.label),
            React.createElement("div", {className:"text-[11px] font-mono text-cyan-300"}, spec.res)
          ),
          React.createElement("div", {
            className: cls("rounded-xl border border-line overflow-hidden relative flex items-end",
              isPortrait ? "aspect-[9/16]" : isSquare ? "aspect-square" : "aspect-video"),
            style:{background: job.thumb}
          },
            React.createElement("div", {className:"absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"}),
            React.createElement("div", {className:"absolute top-3 left-3 flex items-center gap-1.5 text-[10px] font-mono"},
              React.createElement("span", {className:"px-1.5 py-0.5 rounded bg-black/60 border border-white/10"}, spec.aspect),
              React.createElement("span", {className:"px-1.5 py-0.5 rounded bg-black/60 border border-white/10"}, spec.caption)
            ),
            React.createElement("div", {className:"absolute top-3 right-3"},
              React.createElement("div", {className:"w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center"},
                React.createElement(Ico, {d: ICONS.play, className:"w-4 h-4 text-white"})
              )
            ),
            React.createElement("div", {className:"relative p-3 w-full"},
              React.createElement("div", {className: cls("font-display leading-tight drop-shadow-lg",
                spec.caption === "burned bold" ? "text-white text-lg font-bold" : "text-white/90 text-sm")},
                job.topic.length > 38 ? job.topic.slice(0, 38) + "..." : job.topic)
            )
          ),
          React.createElement("dl", {className:"grid grid-cols-3 gap-2 text-[11px] font-mono"},
            React.createElement("div", null,
              React.createElement("dt", {className:"text-dim"}, "aspect"),
              React.createElement("dd", null, spec.aspect)
            ),
            React.createElement("div", null,
              React.createElement("dt", {className:"text-dim"}, "max dur"),
              React.createElement("dd", null, spec.maxDur + "s")
            ),
            React.createElement("div", null,
              React.createElement("dt", {className:"text-dim"}, "captions"),
              React.createElement("dd", null, spec.caption)
            )
          ),
          React.createElement("div", {className:"flex items-center gap-2 pt-1"},
            React.createElement("button", {className:"flex-1 rounded-lg bg-indigo/15 border border-indigo/40 text-indigo-200 hover:bg-indigo/25 py-2 text-xs inline-flex items-center justify-center gap-1.5"},
              React.createElement(Ico, {d: ICONS.download}), "Download mp4"),
            React.createElement("button", {className:"rounded-lg border border-line text-dim hover:text-slate-200 py-2 px-3 text-xs inline-flex items-center gap-1.5"},
              React.createElement(Ico, {d: ICONS.share}), "Copy URL")
          )
        );
      })
    ),
    React.createElement(Panel, {className:"p-6 space-y-3"},
      React.createElement("div", {className:"flex items-center justify-between"},
        React.createElement(Label, null, "rights manifest"),
        React.createElement(Chip, {tone:"amber"}, "REVIEW BLOCKERS")
      ),
      React.createElement("ul", {className:"space-y-2 text-sm text-amber-200/90"},
        React.createElement("li", null, "- quote: unknown license - attribution required"),
        React.createElement("li", null, "- stock music: licensed (Suno v3, commercial tier)"),
        React.createElement("li", null, "- avatar: synthesized, no real-person likeness")
      )
    )
  );
}

/* ============================== BRAND KITS TAB ============================== */

function BrandsTab({brandKits, setBrandKits}) {
  const [editing, setEditing] = useState(null);

  const save = (kit) => {
    if (brandKits.find(b => b.id === kit.id)) {
      setBrandKits(brandKits.map(b => b.id === kit.id ? kit : b));
    } else {
      setBrandKits([...brandKits, kit]);
    }
    setEditing(null);
  };
  const del = (id) => setBrandKits(brandKits.filter(b => b.id !== id));
  const newKit = () => setEditing({
    id: "kit-" + Math.random().toString(16).slice(2, 8),
    name: "New kit", tagline: "", primary:"#6366F1", accent:"#22D3EE",
    aspect:"9:16", motion:"cinematic", voice:"warm",
    palette: ["#0B0B14", "#6366F1", "#22D3EE"]
  });

  if (editing) {
    return React.createElement(BrandEditor, {kit: editing, onCancel: () => setEditing(null), onSave: save});
  }

  return React.createElement("section", {className:"space-y-8"},
    React.createElement("header", {className:"flex flex-wrap items-end justify-between gap-6"},
      React.createElement("div", null,
        React.createElement(Label, null, "brand kits - reusable governance"),
        React.createElement("h1", {className:"mt-2 text-4xl md:text-5xl font-display"},
          React.createElement("span", {className:"bg-gradient-to-r from-cyan-200 via-indigo-200 to-pink-300 bg-clip-text text-transparent"}, "Brand as a primitive.")
        ),
        React.createElement("p", {className:"mt-3 text-slate-400 max-w-2xl"}, "Brand kits persist in your browser and power every Generate job. Palette - motion - voice tone - native aspect.")
      ),
      React.createElement("button", {
        onClick: newKit,
        className:"inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-indigo to-cyan text-ink shadow-lg glow hover:brightness-110"
      }, React.createElement(Ico, {d: ICONS.plus}), "New brand kit")
    ),
    React.createElement("div", {className:"grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"},
      brandKits.map(b =>
        React.createElement(Panel, {key: b.id, className:"p-5 space-y-4"},
          React.createElement("div", {className:"flex items-center gap-2"},
            React.createElement("button", {
              onClick: () => setEditing(b),
              className:"rounded-md border border-line p-1.5 text-dim hover:text-slate-200"
            }, React.createElement(Ico, {d: ICONS.pencil})),
            React.createElement("button", {
              onClick: () => del(b.id),
              className:"rounded-md border border-pink/30 p-1.5 text-pink hover:bg-pink/10"
            }, React.createElement(Ico, {d: ICONS.trash}))
          ),
          React.createElement("div", {className:"flex h-16 rounded-lg overflow-hidden"},
            b.palette.map((c,i) => React.createElement("div", {key:i, style:{background:c}, className:"flex-1"}))
          ),
          React.createElement("div", null,
            React.createElement("div", {className:"text-base font-display"}, b.name),
            React.createElement("div", {className:"text-xs italic text-dim mt-1"}, '"' + (b.tagline || "no tagline") + '"')
          ),
          React.createElement("dl", {className:"text-[11px] font-mono divide-y divide-line border-t border-line"},
            [
              ["primary", b.primary],
              ["accent",  b.accent],
              ["native",  b.aspect],
              ["motion",  b.motion],
              ["voice",   b.voice]
            ].map(([k,v]) =>
              React.createElement("div", {key: k, className:"flex items-center justify-between py-1.5"},
                React.createElement("dt", {className:"text-dim uppercase tracking-widest"}, k),
                React.createElement("dd", null, v)
              )
            )
          )
        )
      )
    )
  );
}

function BrandEditor({kit, onCancel, onSave}) {
  const [k, setK] = useState(kit);
  const set = (field, v) => setK(prev => ({...prev, [field]: v}));
  const setPalette = (i, v) => setK(prev => ({...prev, palette: prev.palette.map((c, j) => j === i ? v : c)}));

  return React.createElement("section", {className:"space-y-6"},
    React.createElement("header", {className:"flex items-center justify-between"},
      React.createElement("div", null,
        React.createElement(Label, null, "brand editor"),
        React.createElement("h1", {className:"mt-1 text-3xl font-display"}, k.name || "New brand kit")
      ),
      React.createElement("div", {className:"flex gap-2"},
        React.createElement("button", {onClick: onCancel, className:"rounded-lg border border-line px-4 py-2 text-sm"}, "Cancel"),
        React.createElement("button", {onClick: () => onSave(k), className:"rounded-lg bg-gradient-to-r from-indigo to-cyan text-ink px-4 py-2 text-sm"}, "Save kit")
      )
    ),
    React.createElement(Panel, {className:"p-6 grid grid-cols-1 md:grid-cols-2 gap-6"},
      React.createElement("div", {className:"space-y-4"},
        React.createElement(Field, {label:"name"}, React.createElement("input", {value: k.name, onChange: e => set("name", e.target.value), className:"w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm"})),
        React.createElement(Field, {label:"tagline"}, React.createElement("input", {value: k.tagline, onChange: e => set("tagline", e.target.value), placeholder:"Tagline", className:"w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm"})),
        React.createElement(Field, {label:"primary color"},
          React.createElement("div", {className:"flex items-center gap-3"},
            React.createElement("input", {type:"color", value: k.primary, onChange: e => set("primary", e.target.value), className:"w-10 h-10 bg-transparent border border-line rounded"}),
            React.createElement("input", {value: k.primary, onChange: e => set("primary", e.target.value), className:"flex-1 bg-panel border border-line rounded-lg px-3 py-2 text-sm font-mono"})
          )
        ),
        React.createElement(Field, {label:"accent color"},
          React.createElement("div", {className:"flex items-center gap-3"},
            React.createElement("input", {type:"color", value: k.accent, onChange: e => set("accent", e.target.value), className:"w-10 h-10 bg-transparent border border-line rounded"}),
            React.createElement("input", {value: k.accent, onChange: e => set("accent", e.target.value), className:"flex-1 bg-panel border border-line rounded-lg px-3 py-2 text-sm font-mono"})
          )
        )
      ),
      React.createElement("div", {className:"space-y-4"},
        React.createElement(Field, {label:"aspect"},
          React.createElement("div", {className:"flex gap-2"},
            ["9:16","16:9","1:1","4:5"].map(a =>
              React.createElement("button", {key: a, onClick: () => set("aspect", a),
                className: cls("rounded-md border px-3 py-1.5 text-sm", k.aspect === a ? "border-indigo/60 bg-indigo/10" : "border-line")}, a)
            )
          )
        ),
        React.createElement(Field, {label:"motion"},
          React.createElement("div", {className:"flex flex-wrap gap-2"},
            ["cinematic","snappy","documentary","static"].map(m =>
              React.createElement("button", {key: m, onClick: () => set("motion", m),
                className: cls("rounded-md border px-3 py-1.5 text-sm capitalize", k.motion === m ? "border-cyan/60 bg-cyan/10" : "border-line")}, m)
            )
          )
        ),
        React.createElement(Field, {label:"voice"},
          React.createElement("div", {className:"flex flex-wrap gap-2"},
            ["warm","authoritative","calm","energetic","casual"].map(v =>
              React.createElement("button", {key: v, onClick: () => set("voice", v),
                className: cls("rounded-md border px-3 py-1.5 text-sm capitalize", k.voice === v ? "border-pink/50 bg-pink/10" : "border-line")}, v)
            )
          )
        ),
        React.createElement(Field, {label:"palette"},
          React.createElement("div", {className:"flex gap-2"},
            k.palette.map((c,i) =>
              React.createElement("input", {key: i, type:"color", value: c, onChange: e => setPalette(i, e.target.value), className:"w-14 h-14 bg-transparent border border-line rounded"})
            )
          )
        )
      )
    )
  );
}

function Field({label, children}) {
  return React.createElement("div", null,
    React.createElement(Label, null, label),
    React.createElement("div", {className:"mt-2"}, children)
  );
}

/* ============================== REPURPOSE TAB ============================== */

function RepurposeTab({goto, jobs, setJobs}) {
  const [url, setUrl] = useState("https://www.youtube.com/watch?v=UF8uR6Z6KLc");
  const [clips, setClips] = useState(REPURPOSE_CLIPS);
  const [selected, setSelected] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const analyze = () => {
    setAnalyzing(true);
    setTimeout(() => { setAnalyzing(false); setClips(REPURPOSE_CLIPS); }, 900);
  };

  const exportClip = (clip) => {
    const id = Math.random().toString(16).slice(2, 14);
    const newJob = {
      id, topic: "Repurpose: " + clip.title, status: "done", progress: 100, mode: "repurpose",
      platforms: ["shorts","reels","tiktok"], created: "just now", duration: 58,
      thumb: clip.thumb, caption: clip.hook
    };
    setJobs([newJob, ...jobs]);
    goto("platforms", id);
  };

  return React.createElement("section", {className:"space-y-8"},
    React.createElement("header", null,
      React.createElement(Label, null, "repurpose engine"),
      React.createElement("h1", {className:"mt-2 text-4xl md:text-5xl font-display"},
        React.createElement("span", {className:"bg-gradient-to-r from-cyan-200 via-indigo-200 to-pink-300 bg-clip-text text-transparent"}, "Long-form -> shorts.")
      ),
      React.createElement("p", {className:"mt-3 text-slate-400 max-w-2xl"}, "Paste a YouTube video or podcast URL. Zaidsaid ranks the top moments by prosody + semantic density + visual cut energy + audience affect, then exports them as platform-native shorts.")
    ),
    React.createElement(Panel, {className:"p-5"},
      React.createElement("div", {className:"flex flex-col md:flex-row gap-3"},
        React.createElement("div", {className:"flex-1 relative"},
          React.createElement("span", {className:"absolute left-3 top-1/2 -translate-y-1/2 text-dim"}, React.createElement(Ico, {d: ICONS.globe})),
          React.createElement("input", {
            value: url, onChange: e => setUrl(e.target.value),
            className:"w-full bg-panel border border-line rounded-lg pl-9 pr-3 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo/70"
          })
        ),
        React.createElement("button", {
          onClick: analyze,
          className:"rounded-lg px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-indigo to-cyan text-ink shadow-lg glow hover:brightness-110"
        }, analyzing ? "Analyzing..." : "Detect highlights")
      )
    ),
    React.createElement(Panel, {className:"p-5"},
      React.createElement("div", {className:"flex items-center justify-between mb-4"},
        React.createElement(Label, null, "ranked shorts - " + clips.length),
        React.createElement("div", {className:"text-xs font-mono text-dim"}, "scored by Zaidsaid Clip Model v2")
      ),
      React.createElement("div", {className:"grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"},
        clips.map(c =>
          React.createElement("div", {
            key: c.id,
            onClick: () => setSelected(c),
            className: cls("group cursor-pointer rounded-xl border overflow-hidden transition",
              selected?.id === c.id ? "border-indigo/60 ring-2 ring-indigo/40" : "border-line hover:border-cyan/40")
          },
            React.createElement("div", {className:"aspect-[9/16] relative flex items-end", style:{background: c.thumb}},
              React.createElement("div", {className:"absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"}),
              React.createElement("div", {className:"absolute top-2 left-2 text-[10px] font-mono bg-black/60 border border-white/10 px-1.5 py-0.5 rounded"}, "SCORE " + c.score),
              React.createElement("div", {className:"absolute top-2 right-2 text-[10px] font-mono bg-black/60 border border-white/10 px-1.5 py-0.5 rounded"}, c.start),
              React.createElement("div", {className:"absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"},
                React.createElement("div", {className:"w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center"},
                  React.createElement(Ico, {d: ICONS.play, className:"w-5 h-5 text-white"})
                )
              ),
              React.createElement("div", {className:"relative p-3 w-full"},
                React.createElement("div", {className:"text-white text-sm font-display leading-tight drop-shadow-lg"}, c.title)
              )
            ),
            React.createElement("div", {className:"p-3 border-t border-line"},
              React.createElement("div", {className:"text-xs text-slate-300"}, c.hook),
              React.createElement("div", {className:"mt-2"}, React.createElement(Bar, {value: c.score, tone:"indigo"}))
            )
          )
        )
      ),
      selected && React.createElement("div", {className:"mt-6 p-4 bg-indigo/5 border border-indigo/30 rounded-xl"},
        React.createElement("div", {className:"flex items-center justify-between flex-wrap gap-3"},
          React.createElement("div", null,
            React.createElement("div", {className:"font-display text-lg"}, selected.title),
            React.createElement("div", {className:"text-xs font-mono text-dim mt-0.5"}, selected.start + " -> " + selected.end + " - score " + selected.score)
          ),
          React.createElement("div", {className:"flex gap-2"},
            React.createElement("button", {onClick: () => setSelected(null), className:"rounded-lg border border-line px-3 py-1.5 text-xs"}, "Close"),
            React.createElement("button", {onClick: () => exportClip(selected), className:"rounded-lg bg-gradient-to-r from-indigo to-cyan text-ink px-4 py-1.5 text-xs font-medium"}, "Export as project")
          )
        )
      )
    )
  );
}

/* ============================== EMBODY TAB ============================== */

function EmbodyTab() {
  const [avatarId, setAvatarId] = useState("nova");
  const [voice, setVoice] = useState("warm");
  const [lang, setLang] = useState("en");
  const [script, setScript] = useState("Welcome to Zaidsaid. Every video I deliver is a tiny bet against wasted attention.");
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);

  const avatar = AVATARS.find(a => a.id === avatarId);
  const language = LANGUAGES.find(l => l.code === lang);

  const render = () => {
    setRendering(true); setRendered(false);
    setTimeout(() => { setRendering(false); setRendered(true); }, 1400);
  };

  return React.createElement("section", {className:"space-y-8"},
    React.createElement("header", null,
      React.createElement(Label, null, "embody - avatar + voice clone"),
      React.createElement("h1", {className:"mt-2 text-4xl md:text-5xl font-display"},
        React.createElement("span", {className:"bg-gradient-to-r from-cyan-200 via-indigo-200 to-pink-300 bg-clip-text text-transparent"}, "Your face. Your voice. Any script.")
      ),
      React.createElement("p", {className:"mt-3 text-slate-400 max-w-3xl"}, "Photo-real talking heads with audio-driven lip sync and translation into 30+ languages. Clone your voice in 60s of audio, or pick a studio tier. Production wires HeyGen + ElevenLabs.")
    ),
    React.createElement("div", {className:"grid grid-cols-1 lg:grid-cols-5 gap-6"},
      React.createElement("div", {className:"lg:col-span-3 space-y-6"},
        React.createElement(Panel, {className:"p-5"},
          React.createElement(Label, null, "pick an avatar"),
          React.createElement("div", {className:"mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3"},
            AVATARS.map(a =>
              React.createElement("button", {
                key: a.id,
                onClick: () => setAvatarId(a.id),
                className: cls("rounded-xl border aspect-square p-3 flex flex-col justify-end relative overflow-hidden transition",
                  avatarId === a.id ? "border-indigo/60 ring-2 ring-indigo/40" : "border-line hover:border-cyan/40"),
                style: {background: a.gradient}
              },
                React.createElement("div", {className:"absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"}),
                React.createElement("div", {className:"relative text-white text-sm font-display"}, a.name),
                React.createElement("div", {className:"relative text-[10px] text-white/70 font-mono"}, a.tone)
              )
            )
          )
        ),
        React.createElement(Panel, {className:"p-5"},
          React.createElement(Label, null, "voice"),
          React.createElement("div", {className:"mt-3 flex flex-wrap gap-2"},
            ["warm","authoritative","energetic","calm","casual"].map(v =>
              React.createElement("button", {
                key: v,
                onClick: () => setVoice(v),
                className: cls("rounded-lg border px-3 py-1.5 text-sm capitalize transition",
                  voice === v ? "border-pink/50 bg-pink/10 text-pink-200" : "border-line text-dim hover:text-slate-200")
              }, v)
            )
          )
        ),
        React.createElement(Panel, {className:"p-5"},
          React.createElement(Label, null, "language - auto-dub"),
          React.createElement("div", {className:"mt-3 grid grid-cols-5 gap-2"},
            LANGUAGES.map(l =>
              React.createElement("button", {
                key: l.code,
                onClick: () => setLang(l.code),
                className: cls("rounded-lg border p-2 text-center transition",
                  lang === l.code ? "border-cyan/60 bg-cyan/10" : "border-line hover:border-cyan/40")
              },
                React.createElement("div", {className:"text-[10px] font-mono text-dim"}, l.flag),
                React.createElement("div", {className:"text-xs mt-0.5"}, l.label)
              )
            )
          )
        ),
        React.createElement(Panel, {className:"p-5"},
          React.createElement(Label, null, "script"),
          React.createElement("textarea", {
            rows: 4, value: script, onChange: e => setScript(e.target.value),
            className:"mt-3 w-full bg-panel border border-line rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo/70 resize-none"
          }),
          React.createElement("div", {className:"mt-3 flex items-center justify-between"},
            React.createElement("div", {className:"text-xs font-mono text-dim"}, script.split(/\s+/).filter(Boolean).length + " words - ~" + Math.ceil(script.split(/\s+/).filter(Boolean).length / 2.5) + "s narration"),
            React.createElement("button", {
              onClick: render,
              className:"rounded-lg px-4 py-2 text-sm bg-gradient-to-r from-indigo to-cyan text-ink font-medium hover:brightness-110"
            }, rendering ? "Rendering..." : "Render preview")
          )
        )
      ),
      React.createElement(Panel, {className:"lg:col-span-2 p-5"},
        React.createElement(Label, null, "preview"),
        React.createElement("div", {className:"mt-3 rounded-xl border border-line aspect-[9/16] relative overflow-hidden flex items-end", style:{background: avatar.gradient}},
          React.createElement("div", {className:"absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"}),
          React.createElement("div", {className:"absolute top-3 left-3 text-[10px] font-mono bg-black/60 border border-white/10 px-2 py-0.5 rounded"}, "EMBODY - " + avatar.name.toUpperCase()),
          React.createElement("div", {className:"absolute top-3 right-3 flex gap-1"},
            React.createElement(Chip, {tone:"cyan"}, language.flag),
            React.createElement(Chip, {tone:"pink"}, voice)
          ),
          rendered && React.createElement("div", {className:"absolute inset-0 flex items-center justify-center"},
            React.createElement("div", {className:"w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center"},
              React.createElement(Ico, {d: ICONS.play, className:"w-7 h-7 text-white"})
            )
          ),
          rendering && React.createElement("div", {className:"absolute inset-0 flex items-center justify-center"},
            React.createElement("div", {className:"text-xs font-mono text-white/80 animate-pulse"}, "HeyGen -> ElevenLabs...")
          ),
          React.createElement("div", {className:"relative p-4 w-full"},
            React.createElement("div", {className:"text-white font-display text-sm leading-snug line-clamp-4 drop-shadow-lg"}, script)
          )
        ),
        React.createElement("div", {className:"mt-4 grid grid-cols-2 gap-3 text-[11px] font-mono"},
          React.createElement("div", {className:"border border-line rounded-lg p-2"},
            React.createElement("div", {className:"text-dim"}, "avatar"),
            React.createElement("div", {className:"mt-0.5 text-slate-200"}, avatar.name + " - " + avatar.tone)
          ),
          React.createElement("div", {className:"border border-line rounded-lg p-2"},
            React.createElement("div", {className:"text-dim"}, "engine"),
            React.createElement("div", {className:"mt-0.5 text-slate-200"}, "HeyGen Interactive v2")
          ),
          React.createElement("div", {className:"border border-line rounded-lg p-2"},
            React.createElement("div", {className:"text-dim"}, "voice"),
            React.createElement("div", {className:"mt-0.5 text-slate-200 capitalize"}, voice)
          ),
          React.createElement("div", {className:"border border-line rounded-lg p-2"},
            React.createElement("div", {className:"text-dim"}, "language"),
            React.createElement("div", {className:"mt-0.5 text-slate-200"}, language.label)
          )
        )
      )
    )
  );
}

/* ============================== COMPOSE TAB ============================== */

function ComposeTab({currentJob, jobs, setJobs, goto}) {
  const doneJobs = jobs.filter(j => j.status === "done");
  const job = currentJob && currentJob.status === "done" ? currentJob : doneJobs[0];

  const [scenes, setScenes] = useState(MUSHROOM_STORYBOARD);
  const [selectedId, setSelectedId] = useState(scenes[0].id);
  const [instructions, setInstructions] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  const selected = scenes.find(s => s.id === selectedId) || scenes[0];

  const regen = () => {
    setRegenerating(true);
    setTimeout(() => {
      setScenes(prev => prev.map(s => s.id === selectedId ? ({
        ...s,
        narration: (instructions.trim() || "Regenerated beat - " + s.label + " polished for tighter tempo."),
        motion: s.motion === "slow push-in" ? "parallax" : "slow push-in"
      }) : s));
      setRegenerating(false);
      setInstructions("");
    }, 900);
  };

  return React.createElement("section", {className:"space-y-8"},
    React.createElement("header", {className:"flex flex-wrap items-end justify-between gap-6"},
      React.createElement("div", null,
        React.createElement(Label, null, "compose - manual editor"),
        React.createElement("h1", {className:"mt-2 text-4xl md:text-5xl font-display"},
          React.createElement("span", {className:"bg-gradient-to-r from-cyan-200 via-indigo-200 to-pink-300 bg-clip-text text-transparent"}, "Scene-level control.")
        ),
        React.createElement("p", {className:"mt-3 text-slate-400 max-w-2xl"}, "Compose lets you regenerate single scenes without rebuilding the whole video. Locked characters, locked palette, per-beat motion and narration.")
      ),
      React.createElement("div", {className:"flex items-center gap-2"},
        React.createElement("select", {
          value: job?.id || "",
          onChange: e => goto("compose", e.target.value),
          className:"bg-panel border border-line rounded-lg px-3 py-2 text-sm"
        },
          doneJobs.map(j => React.createElement("option", {key: j.id, value: j.id}, j.topic.slice(0, 40)))
        )
      )
    ),
    React.createElement("div", {className:"grid grid-cols-1 lg:grid-cols-12 gap-6"},
      React.createElement(Panel, {className:"lg:col-span-3 p-4"},
        React.createElement(Label, null, "storyboard - " + scenes.length + " scenes"),
        React.createElement("ul", {className:"mt-3 space-y-2"},
          scenes.map((s, i) =>
            React.createElement("li", {key: s.id},
              React.createElement("button", {
                onClick: () => setSelectedId(s.id),
                className: cls("w-full text-left rounded-lg border px-3 py-2.5 transition",
                  selectedId === s.id ? "border-indigo/60 bg-indigo/10" : "border-line hover:border-cyan/40")
              },
                React.createElement("div", {className:"flex items-center justify-between"},
                  React.createElement("span", {className:"text-[11px] font-mono text-dim"}, "SC " + String(i+1).padStart(2,"0")),
                  React.createElement(Chip, {tone: selectedId === s.id ? "indigo" : "line"}, s.label)
                ),
                React.createElement("div", {className:"mt-1 text-xs text-slate-300 line-clamp-2"}, s.narration),
                React.createElement("div", {className:"mt-1.5 text-[10px] font-mono text-dim"}, s.duration + "s - " + s.motion)
              )
            )
          )
        )
      ),
      React.createElement(Panel, {className:"lg:col-span-5 p-5"},
        React.createElement(Label, null, "preview"),
        React.createElement("div", {className:"mt-3 rounded-xl border border-line aspect-[9/16] relative overflow-hidden flex items-end",
          style:{background: job?.thumb || "linear-gradient(135deg,#0b4d3a,#22d3ee 50%,#6366f1)"}},
          React.createElement("div", {className:"absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"}),
          React.createElement("div", {className:"absolute top-3 left-3 flex gap-2"},
            React.createElement(Chip, {tone:"indigo"}, selected.label),
            React.createElement(Chip, {tone:"line"}, selected.motion)
          ),
          React.createElement("div", {className:"absolute top-3 right-3 text-[10px] font-mono bg-black/60 border border-white/10 px-2 py-0.5 rounded"}, selected.duration + "s"),
          regenerating && React.createElement("div", {className:"absolute inset-0 flex items-center justify-center"},
            React.createElement("div", {className:"text-xs font-mono text-white/80 animate-pulse"}, "Runway Gen-3 -> FLUX...")
          ),
          React.createElement("div", {className:"relative p-4 w-full"},
            React.createElement("div", {className:"text-white text-sm font-display leading-snug drop-shadow-lg"}, selected.narration)
          )
        )
      ),
      React.createElement(Panel, {className:"lg:col-span-4 p-5 space-y-4"},
        React.createElement("div", null,
          React.createElement(Label, null, "narration"),
          React.createElement("textarea", {
            rows: 3, value: selected.narration,
            onChange: e => setScenes(prev => prev.map(s => s.id === selectedId ? {...s, narration: e.target.value} : s)),
            className:"mt-2 w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm resize-none"
          })
        ),
        React.createElement("div", {className:"grid grid-cols-2 gap-3"},
          React.createElement("div", null,
            React.createElement(Label, null, "motion"),
            React.createElement("select", {
              value: selected.motion,
              onChange: e => setScenes(prev => prev.map(s => s.id === selectedId ? {...s, motion: e.target.value} : s)),
              className:"mt-2 w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm"
            },
              ["slow push-in","parallax","orbit","cut stack","pull back","static breathe","whip pan","zoom out"].map(m =>
                React.createElement("option", {key: m, value: m}, m)
              )
            )
          ),
          React.createElement("div", null,
            React.createElement(Label, null, "duration"),
            React.createElement("div", {className:"mt-2 flex items-center gap-2"},
              React.createElement("input", {
                type:"number", min:"1", max:"30", step:"0.1", value: selected.duration,
                onChange: e => setScenes(prev => prev.map(s => s.id === selectedId ? {...s, duration: +e.target.value || 0} : s)),
                className:"w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm font-mono"
              }),
              React.createElement("span", {className:"text-xs font-mono text-dim"}, "s")
            )
          )
        ),
        React.createElement("div", null,
          React.createElement(Label, null, "regenerate instructions"),
          React.createElement("textarea", {
            rows: 3, value: instructions, onChange: e => setInstructions(e.target.value),
            placeholder:"e.g. make this beat feel more urgent, add a close-up of hyphae",
            className:"mt-2 w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm resize-none"
          })
        ),
        React.createElement("div", {className:"flex items-center gap-2"},
          React.createElement("button", {
            onClick: regen,
            className:"rounded-lg bg-gradient-to-r from-indigo to-cyan text-ink px-4 py-2 text-sm font-medium hover:brightness-110"
          }, regenerating ? "Regenerating..." : "Regenerate scene"),
          React.createElement("button", {
            onClick: () => goto("platforms", job?.id),
            className:"rounded-lg border border-line px-3 py-2 text-sm"
          }, "Back to platforms")
        )
      )
    )
  );
}

/* ============================== ARCHITECTURE TAB ============================== */

function ArchitectureTab() {
  return React.createElement("section", {className:"space-y-8"},
    React.createElement("header", null,
      React.createElement(Label, null, "system architecture - " + BRAND.version),
      React.createElement("h1", {className:"mt-2 text-4xl md:text-5xl font-display"},
        React.createElement("span", {className:"bg-gradient-to-r from-cyan-200 via-indigo-200 to-pink-300 bg-clip-text text-transparent"}, "Thirteen stages. One graph.")
      ),
      React.createElement("p", {className:"mt-3 text-slate-400 max-w-2xl"}, "Every stage is a pluggable adapter. API keys flip tiers. Studio tier always works - no cloud dependency required.")
    ),
    React.createElement(Panel, {className:"p-6"},
      React.createElement(Label, null, "pipeline graph"),
      React.createElement("div", {className:"mt-4 flex flex-wrap items-center gap-2"},
        PIPELINE_STAGES.map((s, i) =>
          React.createElement(React.Fragment, {key: s.id},
            React.createElement("div", {className:"rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-1.5"},
              React.createElement("div", {className:"text-sm font-display"}, s.label),
              React.createElement("div", {className:"text-[10px] font-mono text-dim"}, s.blurb)
            ),
            i < PIPELINE_STAGES.length - 1 && React.createElement(Ico, {d: ICONS.arrow, className:"text-cyan-400 w-4 h-4 shrink-0"})
          )
        )
      )
    ),
    React.createElement(Panel, {className:"p-6 space-y-5"},
      React.createElement("div", {className:"flex items-center justify-between"},
        React.createElement(Label, null, "provider matrix"),
        React.createElement("div", {className:"text-xs font-mono text-dim"}, PROVIDERS.filter(p => p.tier.startsWith("active")).length + " active - " + PROVIDERS.length + " total")
      ),
      React.createElement("div", {className:"grid grid-cols-1 md:grid-cols-2 gap-4"},
        PROVIDERS.map(p =>
          React.createElement("div", {key: p.stage, className:"rounded-xl border border-line p-4 bg-panel/40"},
            React.createElement("div", {className:"flex items-center justify-between"},
              React.createElement("div", {className:"text-base font-display capitalize"}, p.stage),
              p.tier && React.createElement("div", {className: cls("text-[11px] font-mono px-2 py-0.5 rounded",
                p.tier.startsWith("active") ? "bg-emerald/10 border border-emerald/30 text-emerald-300" : "border border-line text-dim")}, p.tier)
            ),
            React.createElement("div", {className:"mt-3 flex flex-wrap gap-1.5"},
              p.options.map((o, i) =>
                React.createElement("span", {key: o, className: cls("text-[11px] font-mono px-2 py-0.5 rounded border",
                  i === 0 && p.tier.startsWith("active") ? "border-cyan/40 bg-cyan/10 text-cyan-200" : "border-line text-dim")}, o)
              )
            )
          )
        )
      )
    ),
    React.createElement("div", {className:"grid grid-cols-1 md:grid-cols-3 gap-4"},
      React.createElement(Stat, {label:"latency p50 - generate", value:"42s", tone:"cyan"}),
      React.createElement(Stat, {label:"latency p50 - export",   value:"11s", tone:"indigo"}),
      React.createElement(Stat, {label:"studio tier cost",       value:"$0.00"})
    ),
    React.createElement(Panel, {className:"p-6"},
      React.createElement(Label, null, "docs"),
      React.createElement("ul", {className:"mt-3 space-y-2 text-sm"},
        React.createElement("li", {className:"flex items-center gap-2"},
          React.createElement(Ico, {d: ICONS.arrow, className:"text-cyan-400"}),
          React.createElement("span", {className:"text-slate-300"}, "zaidsaid.com - this live app")
        ),
        React.createElement("li", {className:"flex items-center gap-2"},
          React.createElement(Ico, {d: ICONS.arrow, className:"text-cyan-400"}),
          React.createElement("span", {className:"text-slate-300"}, "README.md - ARCHITECTURE.md - BUSINESS.md - PRODUCT_DESIGN.md - ROADMAP.md")
        ),
        React.createElement("li", {className:"flex items-center gap-2"},
          React.createElement(Ico, {d: ICONS.arrow, className:"text-cyan-400"}),
          React.createElement("span", {className:"text-slate-300"}, "Obsidian vault at ../vault/")
        )
      )
    )
  );
}

/* ============================== BOOT ============================== */

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
