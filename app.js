/* Zaidsaid — app.js v2.0 — x109: Major clip quality fixes surfaced by the "Claude Mythos" e2e test. The user reported "clips are half-baked, they don't capture the arc, they cut out halfway through sentences." Audit of 10 clips confirmed 8 started mid-sentence, 3 pairs overlapped, one clip (c9) was 7 seconds, one (c4) was a sponsor ad for Higgs Field Marketing Studio. Root causes: (a) segment-level snap was checking only the LAST character of each ~6s ElevenLabs Scribe chunk — chunks routinely contain multiple sentences or split one across boundaries, so internal punctuation was invisible; (b) no overlap dedup; (c) no fragment/ad filter. Fixes: (1) new buildSentenceEnds(segments) walks every character of every segment, finds .!?…, linearly interpolates timestamp within the segment; produces a flat sorted list of true sentence-end timestamps. (2) snapClipBoundaries now snaps start back to the sentence-end BEFORE clip.start (within 15s) + 0.05s, so the clip starts with a fresh sentence; snaps end forward to the first sentence-end at/after clip.end (within 30s) + 0.25s tail. (3) new dedupeAndCleanClips() post-pass: sorts by virality desc, drops clips <12s, drops clips whose first 400 chars of spoken text match AD_PATTERNS_RE ("link in description", "use code", "sponsored by", "brought to you by", etc.), drops any clip overlapping >40% with a higher-scoring kept clip. Wired into processSource right after analyzeViaClaudeTwoStage returns. | x108d: Two fixes surfaced by the first real-video e2e test (13 min cinematic AI-tech video with motion graphics, no faces). (1) The x107 precision pass was nested inside the `hasAnySignal` gate in the upload path — when sensevoice 404'd, gemini returned empty, and scene-cut detection ran on an MP3 blob (wrong input, always empty), the gate short-circuited and precision pass never fired. Fixed by adding an unconditional precision pass right after clips land, independent of signal collection. The signal-gated precision passes below stay as belt-and-suspenders for re-scored clips. (2) The smart-crop overlay canvas was inside the `uploadedVideoUrl` branch of RepurposeClipPreview, but uploaded-file projects actually render via the `clipBlobUrl` branch (x93 pre-cut mp4s from IDB) which returned early, so the overlay never appeared. Moved the canvas + a `videoRef` into the clipBlobUrl branch as well, with an isPreCut flag so the `t` offset is correct for both playback modes. | x108: Smart crop — face-aware clip render (MediaPipe + canvas). Self-hosted MediaPipe tasks-vision 0.10.14 (vision_bundle.mjs + WASM + blaze_face_short_range.tflite) under vendor/mediapipe/vision/. loadFaceDetector() lazy-inits a cached FaceDetector. detectFacesInClip() seeks the uploaded video at 2 fps (1 fps for >60 s clips), calls faceDetector.detectForVideo per frame, returns Array<{t, faces:[{x,y,w,h,score} normalized], faceCount}>. computeCropPath() segments by face-count changes and scene cuts, unions face bboxes per segment, expands 35% padding, fits to target aspect ratio (clamps rather than letterboxes), falls back to center crop when no faces. lerpCrop() + cropAtTime() handle 300 ms ease between segments. renderClipSmartCrop() drives a canvas via requestVideoFrameCallback, looks up crop per frame, records via canvas.captureStream + MediaRecorder (VP9). RepurposeTab gains: smartCropEnabled state (localStorage zaidsaid.v2.repurpose.smartCrop, default ON), a detection cache keyed clip.id:preset, a debounced 500 ms useEffect that runs detection on all clips whenever upload/clips/signals change. Smart crop toolbar chip toggles enabled and clears cache. RepurposeClipPreview receives cropPath prop and renders an absolutely-positioned canvas overlay drawing the current crop rect (indigo border) in real time. Both shareClip and exportClipsAsVideo branch on smartCropEnabled + cached data: smart-crop path when available, fall back to recordClipViaCaptureStream + reencodeWebmToPresetMP4 silently when not. Cache bump mvp_god_x107 → x108. | x107: Clipping precision pass — one-call Claude agent cites signals. runClippingPrecisionPass (module scope) takes the output of analyzeViaClaudeTwoStage plus pre-computed signals (scene_cuts, audio_events, visual_highlights, audio_peaks, trending) and makes exactly ONE Claude Sonnet 4.6 call using tool_choice: emit_refined_clips. Returns a parallel array of { id, precisionScore 0-100, verdict: strong|medium|weak, evidence:[{type,t,note}] } keyed by clip.id. processSource merges refinements back after snapClipBoundaries and toasts the verdict breakdown. New toolbar chips: "Precision pass ON|OFF" (default ON, localStorage-persisted) and "Show weak" (default OFF — hides weak clips until toggled). Per-clip card gains a collapsible "Why this clip?" evidence panel below the caption. Cache bump mvp_god_x106 → x107. | x106: Research sub-agent wired. runResearchSubAgent (module scope) runs a multi-step Claude Sonnet 4.6 tool-use loop: extract_keywords → fetch_trending → emit_research. Returns grounded claims + creative brief fields. StepResearch.runResearch calls it and emits per-step progress chips. project.research[] gains a `keyword` field. project._researchTrending[] stores the raw trending data for downstream use. StudioInputAccepter.callAnthropic injects research + trending context into the video_brief user message when project.research.length > 0 (Script stage), with a system prompt addendum instructing Claude to ground beats in the RESEARCH block. Local fallback path unchanged — used when Anthropic proxy is unconfigured or the sub-agent throws. | x105: Architecture tab reshaped to match the real 8 Studio stages (research / script / storyboard / assets / motion / voice / timeline / export) and to declare providers honestly by kind: `included` (user's Anthropic subscription, no per-call meter), `free` (Pollinations Flux, browser SpeechSynthesis, local Canvas Ken Burns, ffmpeg.wasm), or `byok` (ElevenLabs / Stability / Pexels — requires a user-supplied key). Removes the fantasy stages (Outline / Avatar / B-roll / Captions / Edit / Publish) that had no downstream code, and the Free-only/Balanced/Premium toggle that wasn't actually rewiring anything. Default mix: Claude (included) on the two text stages, free on everything else — per-run cost is $0.00 out of the box with the user's Anthropic subscription. PROVIDER_META collapsed to the 12 IDs that real code paths consume; old "openai" / "heygen" / "local-llm" etc. entries deleted. StudioStageProvider sanitizes stale arch.picks so legacy stored state doesn't render orphan providers. | x104: Studio Export — 1080p H.264 MP4, aspect-aware. renderRealVideo now reads project.preset (vertical/square/landscape) and sizes the canvas to 1080×1920 / 1080×1080 / 1920×1080 respectively. After the canvas+MediaRecorder pass produces a webm blob (0-60% progress), reencodeWebmToPresetMP4 runs ffmpeg.wasm to scale+pad and encode libx264 H.264 at CRF 20 (60-100% progress). Output is set as window.__zs_lastBlob and offered as a .mp4 download named <project-slug>-<preset>.mp4. Visibility warning toasted at render start if the tab is hidden (rAF throttles in background tabs). On ffmpeg failure the error is surfaced and the raw webm is kept as a fallback download link. | x103c: Replace fetch(dataUrl).then(r=>r.blob()) with a direct base64 decoder. Our CSP `connect-src` doesn't list `data:`, so `fetch("data:...")` throws `TypeError: Failed to fetch` in Chrome. storeSceneImage / storeSceneAudio caught it and silently returned the original dataUrl — localStorage got polluted with base64 anyway despite x103's IDB offload and x103b's self-heal. New helper dataUrlToBlob parses `data:<mime>[;base64],<payload>` in pure JS (atob + Uint8Array) and returns a Blob. callers fall back to fetch only for non-data URLs. | x103b: Make openIDB self-heal when the zaidsaid DB exists at some version but is missing the `uploads` store. x103 assumed the store always existed because Repurpose creates it on first upload, but a Studio-first user (or anyone with a stale DB from an aborted upgrade) silently fails every idbPut with "object store not found", which drops scene.image back to the data-URL path and defeats the whole localStorage-offload purpose. Fix: openIDB now probes at the DB's current version, verifies the store is present, and if not bumps the version to create it. Also surfaces the silent storeSceneImage / storeSceneAudio fallback with console.warn so the next regression won't hide. | x103: Studio — IDB-offload scene images + audio. scene.image / scene.audio are now lightweight reference strings ("idb:studio:scene:{id}" / "idb:studio:scene:{id}:audio") pointing to Blob entries in the zaidsaid/uploads IndexedDB store. localStorage no longer holds base64 data URLs for Studio projects, keeping the stored JSON well under 20 KB regardless of asset count. New helpers idbSetStudioImage / idbGetStudioImage / idbDelStudioImage and idbSetStudioAudio / idbGetStudioAudio / idbDelStudioAudio parallel the existing repurpose:clip: convention. StepStoryboard converts any returned data URL / response blob to a Blob, persists it to IDB, and keeps a per-scene Map<sceneId, objectUrl> (sceneBlobUrls) for live preview. StepVoice does the same for audio (audioBlobUrls). StepExport's renderRealVideo reads IDB blobs when image/audio starts with "idb:", falling back to the legacy data URL path for pre-x103 projects so no existing state is broken. StudioTab hydrates both blob URL Maps on mount (clearing missing IDB refs with a toast) and revokes all URLs on unmount. resetProject and scene deletion also clean IDB entries. | x102: Share → YouTube now ships full viral-title + thumbnail tooling. generateYouTubeMetadataViaClaude schema extended to require titleVariants[5] (each using a different proven 2026 Shorts hook pattern — Contrarian Take, Shocking Statistic, Direct Promise, Question Hook, Before/After, Mistake Callout, Bold Claim, Expert Secret, Pattern Interrupt, Time-Bound Challenge) and a structured thumbnail object (headline/subject/background/palette/imagePrompt/reasoning) following MrBeast-era Shorts rules: one emotional face OR one iconic close-up, 2-3 word overlay, deep-dark background with a single neon accent. New renderThumbnailFromBrief() generates the base via Pollinations (explicitly 'no text, no watermarks') and composites clean headline + accent underline via OffscreenCanvas — diffusion models garble text, canvas overlays are razor-sharp. ShareMetadataModal now surfaces the 5 title variants as a ranked copy list, the full thumbnail brief, and a "Generate thumbnail" action that produces a 1080×1920 JPG download-ready image. | x101: clip boundaries now capture COMPLETE thoughts. Three-layer fix: (1) analyzeViaClaude tool schema now requires an `arc` field with setup / reveal / payoff descriptions + payoff_end timestamp — Claude must identify where the payoff sentence ends, not just hand-wave about "complete thoughts"; (2) system prompt hardened with an explicit example of the Move 37 failure pattern (ending on "...had a machine beaten one of the best human players two games in a row, it" mid-clause) paired with the corrected version ending on the "2,000 years of strategy" payoff; (3) new snapClipBoundaries() runs after Claude returns, walking the segment list forward from clip.end to the next true sentence terminator (no dangling conj./pronoun) within 30s, and backing clip.start to the current sentence's start if it lands mid-sentence. Result: clip.end is guaranteed to sit on a period/!/? and the payoff beat is guaranteed present. Also adds a "Fix cuts" toolbar chip that re-snaps already-generated clips against the current transcript — no regeneration needed for existing projects. | x100: Share → YouTube now auto-generates an optimized metadata bundle (title / description / hashtags / SEO tags / thumbnail idea) via Claude Sonnet 4.6 using (a) the clip hook + caption + preset + virality score, (b) the surrounding transcript window, and (c) live trending context pulled from /trends/{google,reddit,hn,x}. A ShareMetadataModal renders the bundle with per-field Copy buttons so the user can paste each field into YouTube Studio's Details panel. Video download now goes through the hidden-tab-safe recordClipViaCaptureStream → reencodeWebmToPresetMP4 pipeline from x99f instead of the broken renderClipVideoFromUpload — shares produce real 1080p H.264 MP4 files. | x99f: batch export rebuilt as two-pass (captureStream → ffmpeg), works in hidden tabs + outputs 1080p H.264 MP4. Root cause of the 0-byte downloads: x99d/e's renderClipVideoFromUpload drives canvas.drawImage via requestAnimationFrame, and rAF throttles to ~1 Hz as soon as the tab loses focus. canvas.captureStream() then emits ≤1 frame/sec, MediaRecorder packs a 1-frame blob, and the user gets a .webm that won't play. Fix (a) recordClipViaCaptureStream plays the uploaded source muted and pipes `<video>.captureStream()` straight into MediaRecorder — video playback + MediaStream tracks are NOT bound by rAF, so this keeps running in hidden/backgrounded tabs; (b) reencodeWebmToPresetMP4 uses ffmpeg.wasm to scale+pad the VP9 recording to the target preset and encode libx264 at CRF 20 for real 1080p H.264 MP4 output — ffmpeg.wasm decodes VP9 fine (only AV1 from the raw YouTube MP4 was the blind spot). Also bumped downloadBlob's revokeObjectURL delay from 500 ms → 60 s so Chrome's download manager isn't cut off mid-write on big blobs. Overlay burn-in dropped from batch export — per-clip "Render video" chip still has it for single previews. | x99e: fix autoplay block in renderClipVideoFromUpload. The canvas/MediaRecorder render created a fresh <video src={blob}>, seeked, then called `src.play()` — but with `muted=false`, Chrome's autoplay policy threw `NotAllowedError: play() failed because the user didn't interact with the document first` once the original user gesture was consumed by the async awaits. Setting `muted=true` lets play() succeed without a gesture; the audio is still captured via `<video>.captureStream()` since muted only gates speaker output, not decoded audio tracks. | x99d: fix 0-byte batch export on AV1 sources. YouTube's progressive MP4s are AV1; cutClipFromSource's `-c copy` preserved that codec, then reencodeClipForPreset (libx264 transcode) silently failed because ffmpeg.wasm 5.1.4 has no AV1 decoder (config lacks libdav1d). ffmpeg.exec returned exit=1 but the old code ignored it, readFile returned 0 bytes, and we shipped empty MP4s. Fix (a) exportClipsAsVideo now prefers renderClipVideoFromUpload (canvas + MediaRecorder, uses browser-native AV1 decoding via <video>) on the uploaded source, falling back to the ffmpeg per-clip re-encode only when that fails; (b) reencodeClipForPreset now throws on non-zero exit or 0-byte output instead of returning an empty blob. Trade-off: outputs are .webm VP9/VP8 at 720p (renderClipVideoFromUpload dims) rather than .mp4 H.264 1080p; acceptable for the MVP, bigger resolution is an easy follow-up. | x99c: switch ffmpeg core from UMD to ESM. @ffmpeg/ffmpeg@0.12.10's worker.js is always instantiated as `{type:"module"}`, and module Workers can't call `importScripts`, so worker.js falls through to `await import(coreURL)`. The UMD build registers `self.createFFmpegCore` as a side effect but has no ESM `default` export, so the worker throws `ERROR_IMPORT_FAILURE`. Using `/esm/ffmpeg-core.js` (which has a proper default export) lets the module import complete. | x99b: self-host @ffmpeg/ffmpeg + @ffmpeg/util. Chrome refuses to construct a Worker from a cross-origin URL, CSP or CORS headers notwithstanding; @ffmpeg/ffmpeg@0.12.10 does `new Worker(new URL("./worker.js", import.meta.url), {type:"module"})` relative to its own module URL, so loading it from unpkg makes the Worker cross-origin and it throws `Failed to construct 'Worker': Script … cannot be accessed from origin 'https://zaidsaid.com'`. The ESM bundle now lives in ./vendor/{ffmpeg,util}/esm/. @ffmpeg/core WASM still loads from unpkg via toBlobURL (blob: URLs are same-origin from the Worker's perspective). | x99: tried adding `https://unpkg.com` to CSP `worker-src` — necessary but not sufficient, Chrome still blocked the cross-origin worker. | x98: Phase D — trending-context scoring. Worker routes /trends/{google,reddit,hn,x} (HN + Reddit + Google free; X via Apify needs APIFY_TOKEN). Client extracts 3-8 topic keywords via Claude tool_use, fetches trend matches, folds into analyzeViaClaudeTwoStage with convergent-attention boost. | x97: Phase C — multi-modal virality signals. WebCodecs scene-cut detection in-browser; /gemini-video-highlights worker route (Gemini 2.5 Flash, graceful no-key); /sensevoice worker route (Replicate SenseVoice for laughter/applause, graceful no-key). Claude scoring extended to boost clips matching ≥2 signal types. | x96: Phase E — preset-aware per-clip re-encoding via ffmpeg.wasm (scale+pad for 9:16/1:1/16:9) + JSZip batch download when multiple clips selected. Replaces the old MediaRecorder .webm pipeline for clips that have a per-clip mp4 blob. | x95: Phase B UI cleanup: collapsed intake to URL/File, folded YT downloader into URL expandable, per-clip actions 9→3, removed fake waveform, toolbar pruned. | x94: clear stale clips at Generate start + narrow reseed effect so demo doesn't overwrite a user's upload on refresh. | x93: Repurpose — real per-clip mp4 cuts + thumbnail frames. cutClipFromSource (ffmpeg.wasm, -ss after -i, -c copy with libx264 fallback <5 min) + grabFrameThumb (off-DOM canvas) + generateClipAssets (sequential, IDB-backed). processSource fires generateClipAssets after setProject for upload flows. RepurposeTab hydrates clipBlobUrls Map from IDB on mount; RepurposeClipPreview shows pre-cut <video controls> when blob ready. removeClip deletes IDB entries + revokes URLs. | x92: Repurpose — big videos extract audio client-side before transcribing. Lazy-loads ffmpeg.wasm (@ffmpeg/ffmpeg@0.12.10 + @ffmpeg/core@0.12.6 from unpkg, ~30 MB one-time); any uploaded video >50 MB is reduced to mono 16 kHz 32 kbps MP3 (~14 MB/hr) before POSTing to /elevenlabs/v1/speech-to-text. Fixes 700+ MB uploads hanging on the Cloudflare Worker 500 MiB body limit. CSP widened for wasm-unsafe-eval, blob: workers, and unpkg connect. | x91: Repurpose — uploaded files now survive page refreshes. New IndexedDB blob store (zaidsaid/uploads, key repurpose:current) persists the File on upload; RepurposeTab useEffect on mount HEAD-checks the existing blob URL and rehydrates from IDB when it's dead, or clears the dangling reference + toasts "please re-upload" when IDB is empty too. processSource now reads the blob from IDB first, falling back to the blob URL. Remove button deletes the IDB entry. | x90: Repurpose — uploads now actually clip. processSource gate no longer bails on empty source when an uploaded video is present; on new file upload we clear stale transcript/chapters/clips/name; uploaded videos without a transcript auto-transcribe via ElevenLabs Scribe (/elevenlabs/v1/speech-to-text with model_id=scribe_v1, word-level timestamps grouped into ~6s segments) and feed the existing two-stage viral analyzer. New fuchsia "ElevenLabs Scribe (auto-transcribed)" source chip. | x89: Repurpose — YouTube downloader tool (paste URL → fetch progressive formats via worker InnerTube → quality dropdown → File System Access folder picker with streamed writable, falls back to <a download> when unsupported). Worker: /youtube-formats, /youtube-media. | x88: batch export respects selection + preset-aware video render — "Export selected as video" renders .webm per selected clip at its preset aspect ratio (9:16/1:1/16:9); fallback selection→approved→all; metadata (.txt) export kept as secondary. Fix stray /span> text below batch-export button. | x87: clip length range widened — 5s floor (viral reactions, one-liners) to 1800s / 30min ceiling (full topic arcs); removed rigid length-mix prompt in favor of idea-first sizing | x86: clip preview no-autoplay — remove YouTube loop=1&playlist (fixes whole-video loop), remove autoPlay on uploaded video, preview now shows clip-only paused state until user clicks play | x85: Phase B.1 — persist chapters on description-fallback, surface worker errors, transcript-source chip, length-variance prompt, analyzeLocal intro-skip, **remove dead RepurposeAnalyzer + RepurposeRealAnalyze god-mode components** | x84: Phase B — YT chapter-boundary detection (parseYouTubeChapters in worker; analyzeLocal uses chapter spans as candidate windows when ≥3 chapters; Claude receives chapter list for boundary alignment) + Web Audio energy analyzer (analyzeUploadedVideoAudio: 8x scrub AudioContext RMS scan on uploaded files; peaks boost analyzeLocal virality by +5*peakDensity) | x83: Smart Clipping v2 — two-stage viral detection + topic-boundary awareness + variable 30-180s clip length + unified Generate flow + target default 10 (range 3-20) | x82: preview fix — CSP frame-src, youtube-nocookie embed, thumbnail fallback | x80: Smart Clipping — viral moment detection. Worker /youtube-transcript returns segments[{t,d,text}]. analyzeViaClaude uses timestamped transcript with 4-dimension scoring (hook_power/emotional_impact/quotability/surprise_drama). analyzeLocal scores ~45-75s windows, picks top N with spatial diversity across full duration. YT iframe autoplay+loop within clip range; uploaded video autoplay muted with loop-on-end.
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
// x110b: HyperFrames render service path. Returns "" when the provider is
// missing or disabled, in which case the styled-export pass-through is skipped.
const getHyperframesPath = () => {
  try {
    const a = safeGet("providers.cfg", {}) || {};
    const b = safeGet("providers", {}) || {};
    const hf = (a && a.hyperframes) || (b && b.hyperframes) || {};
    if (hf.enabled === false) return "";
    return String(hf.path || hf.proxyUrl || hf.url || "").trim();
  } catch(_) { return ""; }
};
// x111: audio-ai sidecar path (WhisperX / silero-vad / demucs / pyannote / auto-editor / captacity).
// Returns "" when the provider is missing or disabled.
const getAudioAiPath = () => {
  try {
    const a = safeGet("providers.cfg", {}) || {};
    const b = safeGet("providers", {}) || {};
    const ai = (a && a.audioAi) || (b && b.audioAi) || {};
    if (ai.enabled === false) return "";
    return String(ai.path || ai.proxyUrl || ai.url || "").trim();
  } catch(_) { return ""; }
};
// x112: vision-ai sidecar path (SAM2 / YOLOv8 / OpenCLIP).
const getVisionAiPath = () => {
  try {
    const a = safeGet("providers.cfg", {}) || {};
    const b = safeGet("providers", {}) || {};
    const v = (a && a.visionAi) || (b && b.visionAi) || {};
    if (v.enabled === false) return "";
    return String(v.path || v.proxyUrl || v.url || "").trim();
  } catch(_) { return ""; }
};
// x113: tts sidecar path (piper + Coqui XTTS-v2 voice cloning).
const getTtsPath = () => {
  try {
    const a = safeGet("providers.cfg", {}) || {};
    const b = safeGet("providers", {}) || {};
    const t = (a && a.ttsOss) || (b && b.ttsOss) || {};
    if (t.enabled === false) return "";
    return String(t.path || t.proxyUrl || t.url || "").trim();
  } catch(_) { return ""; }
};
function useLocalState(key, initial){
  const [v, setV] = useState(() => safeGet(key, initial));
  useEffect(() => { safeSet(key, v); }, [key, v]);
  return [v, setV];
}
try { if (safeGet("__schema", 0) !== SCHEMA_VERSION) safeSet("__schema", SCHEMA_VERSION); } catch(e){}

/* ---------------- IndexedDB blob store ----------------
 * Keeps uploaded video/audio files across refreshes. Blob URLs die when the
 * page context is destroyed; the File itself can be persisted to IDB and a
 * fresh blob URL minted on next mount.
 */
const IDB_NAME = "zaidsaid";
const IDB_STORE = "uploads";
const IDB_VERSION = 1;
const IDB_UPLOAD_KEY = "repurpose:current";
// x103b: robust open. If the DB exists at some version but the store is missing
// (stale DB from an aborted upgrade, or an older schema), bump the version and
// create the store. Without this, Studio's first IDB write after a fresh-but-
// empty DB silently throws and every scene.image falls back to a data URL.
const openIDB = async () => {
  const probe = await new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_NAME);
      req.onupgradeneeded = () => {
        if(!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch(e){ reject(e); }
  });
  if(probe.objectStoreNames.contains(IDB_STORE)) return probe;
  const nextVersion = probe.version + 1;
  probe.close();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, nextVersion);
    req.onupgradeneeded = () => {
      if(!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IDB upgrade blocked — close other zaidsaid.com tabs and reload"));
  });
};
const idbPut = async (key, value) => {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};
const idbGet = async (key) => {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};
const idbDelete = async (key) => {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

// x93: per-clip blob key convention — video: IDB_CLIP_PREFIX+id, thumb: IDB_CLIP_PREFIX+id+":thumb"
const IDB_CLIP_PREFIX = "repurpose:clip:";
const idbPutClip = (id, blob) => idbPut(IDB_CLIP_PREFIX + id, blob);
const idbGetClip = (id) => idbGet(IDB_CLIP_PREFIX + id);
const idbDeleteClip = (id) => idbDelete(IDB_CLIP_PREFIX + id);

// x103c: Convert a data: URL to a Blob without using fetch(). Our CSP blocks
// connect-src data:, so `fetch("data:…")` throws TypeError, and every call
// site that tried to round-trip a data URL through fetch → blob silently
// fell through to the original data URL. Direct base64 decode is faster
// anyway and avoids the CSP entirely.
const dataUrlToBlob = (dataUrl) => {
  const str = String(dataUrl || "");
  if(!str.startsWith("data:")) return null;
  const commaIdx = str.indexOf(",");
  if(commaIdx < 0) return null;
  const header = str.slice(5, commaIdx);
  const payload = str.slice(commaIdx + 1);
  const isBase64 = header.endsWith(";base64");
  const mime = (isBase64 ? header.slice(0, -7) : header) || "application/octet-stream";
  if(isBase64){
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
};

// x103: per-scene blob key convention — image: studio:scene:{id}, audio: studio:scene:{id}:audio
const IDB_STUDIO_SCENE_PREFIX = "studio:scene:";
const idbSetStudioImage = (sceneId, blob) => idbPut(IDB_STUDIO_SCENE_PREFIX + sceneId, blob);
const idbGetStudioImage = (sceneId) => idbGet(IDB_STUDIO_SCENE_PREFIX + sceneId);
const idbDelStudioImage = (sceneId) => idbDelete(IDB_STUDIO_SCENE_PREFIX + sceneId);
const idbSetStudioAudio = (sceneId, blob) => idbPut(IDB_STUDIO_SCENE_PREFIX + sceneId + ":audio", blob);
const idbGetStudioAudio = (sceneId) => idbGet(IDB_STUDIO_SCENE_PREFIX + sceneId + ":audio");
const idbDelStudioAudio = (sceneId) => idbDelete(IDB_STUDIO_SCENE_PREFIX + sceneId + ":audio");

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
    // x110b: HyperFrames render service. Off by default — enable in Settings →
    // Providers once a HYPERFRAMES_URL secret is set on the worker (or override
    // proxyUrl with a self-hosted renderer). When enabled, Share/Export pipes
    // the finished clip through the styling sidecar (title + captions + lower-third).
    hyperframes:  { proxyUrl: _ZS_WORKER + "/hyperframes",  enabled: false },
    // x111: open-source audio AI sidecar. Off by default — enable once
    // AUDIO_AI_URL is set on the worker. Wraps WhisperX, silero-vad, demucs,
    // pyannote, auto-editor, captacity. Replaces ElevenLabs Scribe and adds
    // diarization, speech-presence VAD, music separation, and silence trim.
    audioAi:      { proxyUrl: _ZS_WORKER + "/audio",        enabled: false },
    // x112: open-source vision AI sidecar (SAM2 + YOLOv8 + OpenCLIP). Off by
    // default. Enables subject segmentation (SAM2 upgrade to MediaPipe
    // smart-crop), multi-person tracking (YOLOv8), and semantic B-roll match
    // (OpenCLIP) once VISION_AI_URL is set on the worker.
    visionAi:     { proxyUrl: _ZS_WORKER + "/vision",       enabled: false },
    // x113: open-source TTS sidecar — piper (fast multilingual, replaces EL
    // cost line) + Coqui XTTS-v2 (voice cloning from a single reference
    // clip). Studio's voice stage gets a third "tts-oss" pick alongside
    // browser SpeechSynthesis and ElevenLabs once TTS_URL is set.
    ttsOss:       { proxyUrl: _ZS_WORKER + "/tts",          enabled: false },
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
  clock: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  shield: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3 4 7v6c0 5.25 3.5 8 8 8.5 4.5-.5 8-3.25 8-8.5V7z"/><path d="m9 12 2 2 4-4"/></svg>,  palette: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.5-1.5-.5-2 .5-1.5 2-1.5H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/></svg>,
  menu: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
  layers: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="M2 13l10 5 10-5"/><path d="M2 18l10 5 10-5"/></svg>,
  eye: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>,
  pause: (p)=> <svg viewBox="0 0 24 24" width={p?.size||14} height={p?.size||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>,

};

function extractYouTubeVideoId(url){
  if(!url || typeof url !== "string") return null;
  try {
    const m1 = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if(m1) return m1[1];
    const m2 = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if(m2) return m2[1];
    const m3 = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if(m3) return m3[1];
    const m4 = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if(m4) return m4[1];
  } catch(e){}
  return null;
}

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
  { id:"repurpose", label:"Repurpose", icon:"scissors" },
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
            {!isGodMode && <button className="btn" onClick={()=>{ startProject && startProject(); setTimeout(()=>{ try { window.dispatchEvent(new CustomEvent('zs:try-sample')); } catch(_){} }, 350); }}>{I.spark({size:16})} <span>Try a sample →</span></button>}
            <button className="btn" onClick={()=>setTab("repurpose")}>{I.scissors({size:16})} <span>Repurpose long-form</span></button>
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
  name: "",
  kind: "idea",
  source: "",
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
  // x105: MAP Studio step ids → Architecture stage ids (now 1:1 match with
  // the real 8 stages). Legacy aliases (edit/mix/captions/publish) fall
  // through to sensible closest-fit stages so nothing crashes on old state.
  const MAP = {
    research: "research",
    script: "script",
    storyboard: "storyboard",
    assets: "assets",
    motion: "motion",
    voice: "voice",
    timeline: "timeline",
    export: "export",
    edit: "timeline",
    mix: "voice",
    captions: "script",
    publish: "export"
  };
  const picks = (() => {
    try { return JSON.parse(localStorage.getItem("zaidsaid.v2.arch.picks") || "{}"); } catch(e){ return {}; }
  })();
  const archId = MAP[step] || "research";
  const stageDef = (typeof PIPELINE_STAGES !== "undefined") ? PIPELINE_STAGES.find(x => x.id === archId) : null;
  const providerId = picks[archId] || (stageDef ? stageDef.defaultProvider : null);
  const meta = (providerId && typeof PROVIDER_META !== "undefined") ? PROVIDER_META[providerId] : null;
  if (!stageDef) return null;
  const kindStyle = meta ? (typeof PROVIDER_KIND_STYLE !== "undefined" ? PROVIDER_KIND_STYLE[meta.kind] : null) : null;
  return (
    <div className="card p-3 flex items-center gap-3 flex-wrap">
      <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">{(I[stageDef.icon] || I.spark)({size:14})}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">Provider for this stage</div>
        <div className="text-sm font-semibold truncate">{meta ? meta.label : (providerId || "(none selected)")}</div>
      </div>
      {kindStyle && (
        <span className={"text-[10px] px-2 py-0.5 rounded-full border " + kindStyle.cls}>{kindStyle.badge}</span>
      )}
      <div className="text-[11px] text-[color:var(--muted)]">Latency ~{stageDef.latency.toFixed(1)}s</div>
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
function StudioStepNav({ step, setStep, project }){
  const steps = visibleStudioSteps();
  const _scenes = (project && project.scenes) || [];
  const _hasAllImages = _scenes.length > 0 && _scenes.every(s => s && s.image);
  const _hasAllAudio = _scenes.length > 0 && _scenes.every(s => s && s.audioSource);
  const _hasSource = !!(project && project.source && String(project.source).trim().length);
  const _isDone = (id) => {
    if (id === 'script') return _hasSource;
    if (id === 'storyboard') return _hasAllImages;
    if (id === 'voice') return _hasAllAudio;
    return false;
  };
  return (
    <div className="card p-2 flex items-center gap-1 overflow-x-auto scrollbar">
      {steps.map((s, i) => {
        const active = s.id === step;
        const done = _isDone(s.id) && !active;
        return (
          <button key={s.id}
            onClick={()=>setStep(s.id)}
            aria-current={active?"step":undefined}
            className={"flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] whitespace-nowrap " + (active ? "bg-white/10 text-white border border-white/10" : done ? "text-emerald-200/90 hover:text-white" : "text-[color:var(--muted)] hover:text-white")}>
            {done
              ? <span className="inline-flex w-4 h-4 rounded-full bg-emerald-400/20 items-center justify-center text-emerald-300">{I.check({size:10})}</span>
              : <span className="text-[10px] text-[color:var(--muted)]">{String(i+1).padStart(2,"0")}</span>
            }
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

function StudioInputAccepter({ project, setProject, onAdvance, toast }){ const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState(""); const [diag, setDiag] = React.useState(""); const sourceRef = React.useRef(null); const [stageIdx, setStageIdx] = React.useState(0); const BRIEF_STAGES = ["Reading your text…", "Planning beats…", "Writing shots…", "Finalizing…"]; React.useEffect(() => { const t = setTimeout(() => { try { sourceRef.current && sourceRef.current.focus({ preventScroll: true }); } catch(_){} }, 120); return () => clearTimeout(t); }, []); React.useEffect(() => { if(!busy){ setStageIdx(0); return; } const id = setInterval(() => { setStageIdx(i => Math.min(i + 1, BRIEF_STAGES.length - 1)); }, 1200); return () => clearInterval(id); }, [busy]); React.useEffect(() => { const h = () => { if(busy) return; const _pool = ["Most people think an espresso has more caffeine than a brewed coffee. It does not. A single espresso shot is about 63mg. A typical 12oz brewed coffee is 120-180mg. The surprise is volume — espresso concentrates caffeine into a smaller sip, but you drink less of it. This matters if you care about sleep, anxiety, or how long you stay alert.", "The cheapest habit that compounds fastest is walking. Ten thousand steps burns ~400 calories. Do that daily for a year and you burn through 40 pounds of body fat without touching your diet. It also drops resting heart rate, improves mood, and costs nothing. Most people skip it because it feels too small to matter.", "Your phone is not the problem — the lock screen is. Every time you unlock to check one thing, you open twelve. The fix is brutal: move every app off your home screen except calls, messages, camera. No browser, no email, no social. Unlocking now shows nothing. Your focus returns in 48 hours.", "A cold shower does not toughen you up. It trains your nervous system to sit with discomfort. Ninety seconds, three times a week, is enough. After a month, hard conversations feel lighter. Red-lined deadlines feel manageable. The shower is a rehearsal — your real life is the performance."]; const _s = _pool[Math.floor(Math.random() * _pool.length)]; setProject({ ...project, source: _s }); setTimeout(() => { runBrief(_s); }, 80); }; window.addEventListener('zs:try-sample', h); return () => window.removeEventListener('zs:try-sample', h); }, [busy, project]); const getProviderForResearch = () => { let archId = "research"; let picks = {}; try { picks = JSON.parse(localStorage.getItem("zaidsaid.v2.arch.picks") || "{}"); } catch(e){} const providerId = picks[archId] || (typeof PIPELINE_STAGES !== "undefined" ? (PIPELINE_STAGES.find(x => x.id === archId) || {}).defaultProvider : "anthropic") || "anthropic"; let providers = {}; try { providers = JSON.parse(localStorage.getItem("zaidsaid.v2.providers") || "{}"); } catch(e){} const rec = providers[providerId] || {}; return { providerId, proxyUrl: (rec.proxyUrl || "").trim(), enabled: !!rec.enabled }; }; const localFallback = (text) => { const paragraphs = String(text || "").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean); const sentences = String(text || "").split(/(?<=[\.!?])\s+/).map(s => s.trim()).filter(s => s.length > 6); const source = paragraphs.length >= 3 ? paragraphs : (sentences.length >= 3 ? sentences : [String(text||"").trim()]); const beatLabels = ["Hook", "Setup", "Proof", "Twist", "Callback", "Payoff", "CTA"]; const words = String(text||"").split(/\s+/).filter(Boolean); const requested = Math.max(3, Math.min(6, Math.max(source.length, words.length >= 18 ? 5 : 3))); const n = Math.min(requested, Math.max(3, words.length || 1)); const beats = []; if (source.length >= n) { const chunk = Math.max(1, Math.floor(source.length / n)); for (let i = 0; i < n; i++) { const slice = source.slice(i*chunk, (i===n-1) ? source.length : (i+1)*chunk).join(" ").trim(); beats.push({ title: beatLabels[i] || ("Beat " + (i+1)), script: slice.slice(0, 320) }); } } else { const per = Math.max(4, Math.ceil(words.length / n)); for (let i = 0; i < n; i++) { const slice = words.slice(i*per, (i===n-1) ? words.length : (i+1)*per).join(" ").trim() || (beatLabels[i] || ("Beat " + (i+1))) + " — add detail here."; beats.push({ title: beatLabels[i] || ("Beat " + (i+1)), script: slice.slice(0, 320) }); } } const firstWords = String(text||"").trim().split(/\s+/).slice(0, 18).join(" "); return { logline: firstWords + (firstWords.length ? "…" : ""), audience: "General viewers curious about the topic", angle: "Explain it in plain language with one memorable takeaway.", hook: beats[0] ? beats[0].script.slice(0, 120) : "Open with a concrete, surprising claim.", cta: "Follow for the next one.", beats }; }; const callAnthropic = async (proxyUrl, sourceText) => { const url = proxyUrl.replace(/\/$/, "") + "/v1/messages"; const platform = (project.platforms && project.platforms[0]) || "TikTok"; const duration = project.durationHint || 60; const language = project.language || "English"; const brandHint = project.brandKitId ? ("Brand kit id: " + project.brandKitId) : ""; const researchClaims = Array.isArray(project.research) ? project.research : []; const trendingRaw = Array.isArray(project._researchTrending) ? project._researchTrending : []; const hasResearch = researchClaims.length > 0; const systemBase = "You are a senior short-form video producer and visual director. Turn the user's source text into a tight creative brief, a beat-by-beat outline, AND a cinematic visual shot description for each beat. The shot field will be used directly as an image-generation prompt — make it concrete, visual, and specific (subject + action + setting + lighting + mood). Avoid abstract language. Use the provided tool and return strict JSON only via tool_use."; const systemAddendum = hasResearch ? " Ground the script in the RESEARCH block — prefer hooks and beats that quote a specific claim. Do not invent new facts that contradict the research." : ""; const system = systemBase + systemAddendum; const researchBlock = hasResearch ? ("\n\nRESEARCH (from stage 01 — use these claims as grounding):\n" + researchClaims.map(r => "- " + r.claim + " — source: " + (r.source || "unknown")).join("\n")) : ""; const trendingBlock = trendingRaw.length > 0 ? ("\n\nTRENDING CONTEXT (right now):\n" + trendingRaw.flatMap(t => (t.matches || []).slice(0, 2).map(m => "- " + m.source + ": " + (m.title || "").slice(0, 80))).slice(0, 8).join("\n")) : ""; const userMsg = "PLATFORM: " + platform + "\nTARGET DURATION: " + duration + "s\nLANGUAGE: " + language + "\n" + brandHint + researchBlock + trendingBlock + "\n\nSOURCE:\n" + sourceText; const tool = { name: "video_brief", description: "Return a creative brief, beat-by-beat outline, and per-beat cinematic shot descriptions.", input_schema: { type: "object", properties: { logline: { type: "string", description: "One-sentence summary of the video, max 140 chars." }, audience: { type: "string", description: "Who this is for." }, angle: { type: "string", description: "The specific angle or take." }, hook: { type: "string", description: "Opening 3-5 seconds, specific and concrete." }, cta: { type: "string", description: "Closing call-to-action." }, beats: { type: "array", description: "Ordered list of scenes/beats.", items: { type: "object", properties: { title: { type: "string", description: "Short label for this beat, 2-6 words." }, script: { type: "string", description: "1-3 sentences of on-screen narration." }, shot: { type: "string", description: "Concrete visual description for this beat as an image-gen prompt: subject + action + setting + lighting + mood. Avoid quotes and abstract words. 15-40 words." } }, required: ["title","script","shot"] } } }, required: ["logline","hook","beats"] } }; const body = { model: "claude-haiku-4-5-20251001", max_tokens: 1200, system, tools: [tool], tool_choice: { type: "tool", name: "video_brief" }, messages: [ { role: "user", content: userMsg } ] }; const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) }); const ct = res.headers.get("content-type") || ""; const raw = ct.includes("json") ? await res.json().catch(()=>null) : await res.text().catch(()=>""); if (!res.ok) { const msg = (raw && raw.error && raw.error.message) || (typeof raw === "string" ? raw.slice(0,200) : ("HTTP " + res.status)); throw new Error(msg); } const blocks = Array.isArray(raw && raw.content) ? raw.content : []; const toolBlock = blocks.find(b => b && b.type === "tool_use" && b.name === "video_brief"); if (!toolBlock || !toolBlock.input) throw new Error("Model did not return tool_use output"); return toolBlock.input; }; const callGrok = async (proxyUrl, sourceText) => {
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
const applyBrief = (brief) => { const beats = Array.isArray(brief && brief.beats) ? brief.beats : []; const total = Math.max(15, project.durationHint || 60); const per = Math.max(3, Math.round(total / Math.max(1, beats.length))); const scenes = beats.map((b, i) => ({ id: "s" + (i+1), title: (b.title || ("Beat " + (i+1))).slice(0, 80), script: (b.script || "").slice(0, 800), voLine: (b.script || "").slice(0, 800), duration: per, aroll: (project.scenes && project.scenes[i] && project.scenes[i].aroll) || "avatar", broll: (project.scenes && project.scenes[i] && project.scenes[i].broll) || [], shot: b.shot || ((b.title||"") + ": " + (b.script||"").split(/[.!?]/)[0].trim()), motion: b.motion || "slow push-in", asset: b.asset || "b-roll", captions: (b.script||"").slice(0,80) })); const _autoName = (project.name && String(project.name).trim()) || (brief.logline ? String(brief.logline).split(/[\s.,:;!?]+/).filter(Boolean).slice(0, 7).join(' ') : ""); setProject({ ...project, name: _autoName || project.name || "", logline: brief.logline || project.logline || "", hook: brief.hook || project.hook || "", cta: brief.cta || project.cta || "", audience: brief.audience || project.audience || "", angle: brief.angle || project.angle || "", scenes: scenes.length ? scenes : (project.scenes || []) }); }; const runBrief = async (overrideText) => { const text = (typeof overrideText === 'string' && overrideText ? overrideText : (project.source || "")).trim(); if (!text) { setErr("Paste a prompt, story, or source text first."); return; } setErr(""); setDiag(""); setBusy(true); const { providerId, proxyUrl, enabled } = getProviderForResearch(); try { if (providerId === "anthropic" && proxyUrl && enabled) { setDiag("Calling " + providerId + " via proxy…"); const brief = await callAnthropic(proxyUrl, text); applyBrief(brief); toast && toast("Brief generated via Claude · " + (brief.beats||[]).length + " beats", "success"); } else if (providerId === "grok" && proxyUrl && enabled) { setDiag("Calling Grok via proxy…"); try { const brief = await callGrok(proxyUrl, text); applyBrief(brief); toast && toast("Brief generated via Grok · " + (brief.beats||[]).length + " beats", "success"); } catch(err) { setDiag("Grok error: " + err.message); } } else { setDiag(providerId === "anthropic" ? "No proxy URL configured — using local outline." : "Provider '" + providerId + "' not wired yet in Studio — using local outline."); const brief = localFallback(text); applyBrief(brief); toast && toast("Brief generated locally · " + brief.beats.length + " beats", "info"); } setBusy(false); onAdvance && setTimeout(() => onAdvance(), 350); } catch (e) { setBusy(false); const msg = (e && e.message) || String(e); setErr(msg); try { const brief = localFallback(text); applyBrief(brief); toast && toast("Cloud call failed — used local outline (" + brief.beats.length + " beats)", "warn"); onAdvance && setTimeout(() => onAdvance(), 450); } catch(_){} } }; const sourceLen = (project.source || "").trim().length; const { providerId, proxyUrl, enabled } = getProviderForResearch(); const willUseCloud = (providerId === "anthropic" || providerId === "grok") && proxyUrl && enabled; return ( <div className="card p-5"> <div className="flex items-center justify-between gap-3 flex-wrap"> <div> <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Source</div> <div className="text-lg font-semibold">What are we turning into a video?</div> </div> <div className="flex flex-wrap items-center gap-1"> {STUDIO_INPUT_KINDS.map(k => { const active = project.kind === k.k; return ( <button key={k.k} onClick={()=>setProject({ ...project, kind: k.k })} aria-pressed={active} className={"px-2.5 py-1.5 rounded-xl text-[12px] border " + (active ? "border-white/20 bg-white/10 text-white" : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-white")}> {k.label} </button> ); })} </div> </div> <div className="mt-4 grid md:grid-cols-3 gap-3"> <label className="md:col-span-2 block"> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Prompt or paste</span> <textarea ref={sourceRef} value={project.source || ""} onChange={(e)=>setProject({ ...project, source: e.target.value })} onKeyDown={(e)=>{ if((e.metaKey || e.ctrlKey) && e.key === 'Enter'){ e.preventDefault(); const _len = (project.source || "").trim().length; if(_len && !busy){ runBrief(); } } }} placeholder="Paste text, a URL, or describe the video you want." rows={6} className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-xl p-3 text-sm focus:outline-none focus:border-white/20" /><div className="mt-1 text-[10px] text-[color:var(--muted)] flex items-center gap-1">Tip: press <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/80">⌘/Ctrl</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/80">Enter</kbd> to generate</div>
{/(?:youtube\.com\/watch|youtu\.be\/)/.test(project.source||"") && (<button type="button" className="chip mt-1" onClick={async()=>{setBusy(true);try{const _r=await fetch("https://noembed.com/embed?url="+encodeURIComponent((project.source||"").trim()));const _d=await _r.json();if(_d.title){setProject({...project,source:"Video: "+_d.title+"\nBy: "+(_d.author_name||"")+"\n\nMake a short-form social video about this topic.\nSource: "+(project.source||"").trim(),name:project.name||_d.title});}}catch(_e){}setBusy(false);}}>Fetch YouTube title ↗</button>)} </label> <div> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Upload (UI only)</span> <div className="mt-1 border border-dashed border-[color:var(--line)] rounded-xl p-6 text-center text-[12px] text-[color:var(--muted)]"> <div className="text-white/80 font-semibold">Drop a file</div> <div className="mt-1">Audio · PDF · Image · Podcast</div> <div className="mt-3 opacity-70">Uploads wire up in a later stage.</div> <button type="button" className="btn mt-3" aria-disabled="true" onClick={(e)=>e.preventDefault()}> Choose file </button> </div> <div className="text-[11px] text-[color:var(--muted)] mt-2"> Currently selected: <span className="text-white">{(STUDIO_INPUT_KINDS.find(x=>x.k===project.kind)||{}).label || "Text"}</span> </div> </div> </div> <div className="mt-3 flex items-center gap-2 flex-wrap"> <input value={project.name || ""} onChange={(e)=>setProject({ ...project, name: e.target.value })} placeholder="Project name" className="bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20 flex-1 min-w-[240px]" /> <select value={project.language || "English"} onChange={(e)=>setProject({ ...project, language: e.target.value })} className="bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20"> {ARCHIVE_LANGS.map(l => <option key={l} value={l} style={{background:"#0b0b10"}}>{l}</option>)} </select> </div> <div className="mt-4 rounded-xl border border-[color:var(--line)] bg-white/[0.02] p-3 md:p-4 flex items-start md:items-center justify-between gap-3 flex-wrap"> <div className="flex items-start gap-3 min-w-0"> <span className="w-8 h-8 shrink-0 rounded-lg bg-white/10 flex items-center justify-center">{I.spark({size:14})}</span> <div className="min-w-0"> <div className="text-sm font-semibold">Generate brief & outline</div> <div className="text-[12px] text-[color:var(--muted)]"> {willUseCloud ? ("Uses Claude via your configured proxy (" + providerId + "). Returns a structured brief and populates your scenes.") : ("Runs a local outline from your prompt. Configure an Anthropic proxy in Settings to use Claude.")} </div> <div className="text-[11px] mt-1 text-[color:var(--muted)]"> Source length: <span className={sourceLen ? "text-white" : "text-rose-300"}>{sourceLen}</span> chars {(() => { let cls = "text-rose-300"; let msg = "· paste or type to begin"; if(sourceLen >= 200){ cls = "text-emerald-300"; msg = "· perfect — this will produce a rich brief"; } else if(sourceLen >= 50){ cls = "text-amber-300"; msg = "· good — more detail yields a sharper brief"; } else if(sourceLen > 0){ cls = "text-rose-300"; msg = "· add more for a sharper brief"; } return <span className={cls + " ml-1"}>{msg}</span>; })()} · Provider: <span className="text-white">{providerId}{willUseCloud ? "" : " (local fallback)"}</span></div> </div> </div> <div className="flex items-center gap-2"> <button type="button" onClick={runBrief} disabled={busy || !sourceLen} className={"btn " + (busy || !sourceLen ? "opacity-60 cursor-not-allowed" : "btn-primary")}> {I.spark({size:14})} {busy ? BRIEF_STAGES[stageIdx] : "Generate brief & outline"}</button> <button type="button" onClick={()=>{ const _pool = ["Most people think an espresso has more caffeine than a brewed coffee. It does not. A single espresso shot is about 63mg. A typical 12oz brewed coffee is 120-180mg. The surprise is volume — espresso concentrates caffeine into a smaller sip, but you drink less of it. This matters if you care about sleep, anxiety, or how long you stay alert.", "The cheapest habit that compounds fastest is walking. Ten thousand steps burns ~400 calories. Do that daily for a year and you burn through 40 pounds of body fat without touching your diet. It also drops resting heart rate, improves mood, and costs nothing. Most people skip it because it feels too small to matter.", "Your phone is not the problem — the lock screen is. Every time you unlock to check one thing, you open twelve. The fix is brutal: move every app off your home screen except calls, messages, camera. No browser, no email, no social. Unlocking now shows nothing. Your focus returns in 48 hours.", "A cold shower does not toughen you up. It trains your nervous system to sit with discomfort. Ninety seconds, three times a week, is enough. After a month, hard conversations feel lighter. Red-lined deadlines feel manageable. The shower is a rehearsal — your real life is the performance."]; const _s = _pool[Math.floor(Math.random() * _pool.length)]; setProject({ ...project, source: _s }); setTimeout(()=>{ runBrief(_s); }, 80); }} className={"btn " + (!sourceLen ? "btn-primary" : "btn-ghost text-xs")}> {!sourceLen ? <>{I.spark({size:14})} Try a sample brief →</> : "Try with sample brief"} </button><button type="button" onClick={()=> onAdvance && onAdvance()} className="btn btn-ghost text-xs"> Skip — edit manually </button> </div> </div> {(diag || err) && ( <div className="mt-3 text-[12px] flex flex-col gap-1"> {diag && !err && <div className="text-[color:var(--muted)]">{diag}</div>} {err && <div className="text-rose-300">Error: {err}</div>} </div> )} </div> );}
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
const runResearchSubAgent = async (proxyUrl, project, onStatus) => {
  const url = (proxyUrl || "").replace(/\/$/, "") + "/v1/messages";
  const sourceText = String((project && project.source) || "").trim();
  const duration = (project && project.durationHint) || 60;
  const language = (project && project.language) || "English";
  const workerBase = proxyUrl.replace(/\/anthropic\/?$/, "").replace(/\/v1\/?$/, "");

  const system = "You are the Research sub-agent of the Zaidsaid Studio pipeline. Your job: turn the user's source brief into grounded research that feeds the Script stage. Extract keywords, fetch live trending context, and return 4-7 specific, sourced claims plus a tight creative brief (angle, hook, audience, cta). Every claim must be specific — no generic platitudes. Prefer claims that include a number, a name, a date, or a quote. Cite the trending source when you use one.";

  const tools = [
    {
      name: "extract_keywords",
      description: "Extract 3-8 specific, searchable topic keywords from the source text.",
      input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }
    },
    {
      name: "fetch_trending",
      description: "Fetch live trending context for a list of keywords across Google, Reddit, HN, and X.",
      input_schema: { type: "object", properties: { keywords: { type: "array", items: { type: "string" } } }, required: ["keywords"] }
    },
    {
      name: "emit_research",
      description: "Emit the final structured research for the Script stage. Call this last.",
      input_schema: {
        type: "object",
        properties: {
          claims: { type: "array", description: "4-7 specific, sourced claims.", items: { type: "object", properties: { claim: { type: "string" }, source: { type: "string" }, confidence: { type: "number" }, keyword: { type: "string" } }, required: ["claim","source","confidence","keyword"] } },
          angle: { type: "string" },
          hook: { type: "string" },
          audience: { type: "string" },
          cta: { type: "string" },
          topicCluster: { type: "string", description: "1-2 word topic label, e.g. 'AI ethics'" },
          logline: { type: "string", description: "One-sentence summary, max 140 chars." }
        },
        required: ["claims","angle","hook","audience","cta","topicCluster","logline"]
      }
    }
  ];

  const messages = [
    { role: "user", content: "SOURCE:\n" + sourceText.slice(0, 6000) + "\nTARGET DURATION: " + duration + "s\nLANGUAGE: " + language }
  ];

  let trendingData = [];
  let lastKeywords = [];
  const MAX_ITERS = 6;

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const body = { model: "claude-sonnet-4-6", max_tokens: 2000, system, tools, messages };
    const res = await fetchWithRetry(url, { method: "POST", headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) });
    const ct = res.headers.get("content-type") || "";
    const raw = ct.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) { throw new Error("Claude research error: " + (typeof raw === "string" ? raw.slice(0, 200) : JSON.stringify(raw).slice(0, 200))); }

    const assistantContent = Array.isArray(raw.content) ? raw.content : [];
    messages.push({ role: "assistant", content: assistantContent });

    const toolUseBlocks = assistantContent.filter(b => b && b.type === "tool_use");
    if (!toolUseBlocks.length) break;

    const toolResults = [];
    for (const block of toolUseBlocks) {
      let resultContent = "";

      if (block.name === "extract_keywords") {
        const textArg = String((block.input && block.input.text) || sourceText);
        if (onStatus) onStatus("Extracting keywords…");
        lastKeywords = await extractTopicKeywords(proxyUrl, textArg, null);
        resultContent = JSON.stringify({ keywords: lastKeywords });
        if (onStatus) onStatus("🔎 keyword → " + lastKeywords.slice(0, 5).join(", "));
      } else if (block.name === "fetch_trending") {
        const kws = Array.isArray(block.input && block.input.keywords) ? block.input.keywords : lastKeywords;
        if (onStatus) onStatus("Fetching trending context…");
        trendingData = await fetchTrendingContext(workerBase, kws.slice(0, 8));
        const summary = (trendingData || []).flatMap(r => (r.matches || []).slice(0, 2).map(m => m.source + ": " + (m.title || "").slice(0, 80))).slice(0, 8).join(" | ") || "no matches";
        resultContent = JSON.stringify({ results: trendingData });
        if (onStatus) onStatus("📈 trending → " + summary.slice(0, 120));
      } else if (block.name === "emit_research") {
        const input = block.input || {};
        const claims = Array.isArray(input.claims) ? input.claims : [];
        const trendingUsed = claims.filter(c => String(c.source || "").toLowerCase().includes("trending") || String(c.source || "").toLowerCase().includes("hn") || String(c.source || "").toLowerCase().includes("reddit")).length;
        if (onStatus) onStatus("✍️ drafted " + claims.length + " claims");
        return {
          logline: String(input.logline || "").slice(0, 140),
          hook: String(input.hook || ""),
          audience: String(input.audience || ""),
          angle: String(input.angle || ""),
          cta: String(input.cta || ""),
          topicCluster: String(input.topicCluster || ""),
          claims: claims.map((c, i) => ({
            id: "r" + (i + 1) + "_" + Math.random().toString(36).slice(2, 6),
            claim: String(c.claim || "").slice(0, 240),
            source: String(c.source || "").slice(0, 140),
            confidence: Math.max(0.5, Math.min(0.99, Number(c.confidence) || 0.75)),
            keyword: String(c.keyword || "")
          })),
          trendingUsed,
          _trendingRaw: trendingData
        };
      }

      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultContent });
    }

    messages.push({ role: "user", content: toolResults });
  }

  throw new Error("Research sub-agent did not emit results within iteration limit");
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

// x80: Format timestamp as H:MM:SS or M:SS
const fmtTs = (sec) => {
  const s = Math.max(0, Math.floor(Number(sec)||0));
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
  return h > 0 ? (h + ':' + String(m).padStart(2,'0') + ':' + String(ss).padStart(2,'0')) : (m + ':' + String(ss).padStart(2,'0'));
};

// x80: Build compact [t] text transcript from segments, chunking into ~6-12s windows for prompt size.
const buildTimedTranscript = (segments, maxChars) => {
  if(!Array.isArray(segments) || !segments.length) return { lines: [], totalDur: 0 };
  const chunks = [];
  let cur = null;
  for(const seg of segments){
    const t = Number(seg.t)||0;
    const d = Number(seg.d)||0;
    const text = String(seg.text||'').trim();
    if(!text) continue;
    if(!cur){ cur = { start: t, end: t+d, text }; continue; }
    const span = (t+d) - cur.start;
    if(span > 8 && cur.text.length > 40){ chunks.push(cur); cur = { start: t, end: t+d, text }; }
    else { cur.end = t+d; cur.text = (cur.text + ' ' + text).trim(); }
  }
  if(cur) chunks.push(cur);
  const totalDur = chunks.length ? chunks[chunks.length-1].end : 0;
  let out = [];
  let used = 0;
  const cap = maxChars || 12000;
  for(const c of chunks){
    const line = '[' + fmtTs(c.start) + '] ' + c.text;
    if(used + line.length + 1 > cap) break;
    out.push(line);
    used += line.length + 1;
  }
  return { lines: out, totalDur };
};

// x80: Parse pasted transcripts that include timestamps like "[0:12]", "0:12", "(0:12)", "00:12:34".
// Returns segments [{t, d, text}] if timestamps detected, else empty array.
const parsePastedTranscript = (text) => {
  const src = String(text||'');
  if(!src.trim()) return [];
  // Capture any line that starts with an optional bracket/paren + H:MM:SS or M:SS + text
  const re = /(?:^|\n)\s*[\[(]?\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[\])]?\s*[-:.\s]+\s*([^\n]+)/g;
  const hits = [];
  let m;
  while((m = re.exec(src)) !== null){
    const tsStr = m[1];
    const parts = tsStr.split(':').map(n => Number(n));
    let secs;
    if(parts.length === 3) secs = parts[0]*3600 + parts[1]*60 + parts[2];
    else if(parts.length === 2) secs = parts[0]*60 + parts[1];
    else continue;
    const t = (m[2]||'').trim();
    if(!t) continue;
    hits.push({ t: secs, text: t });
  }
  if(hits.length < 3) return [];
  // Compute durations from successive starts; last gets a 5s default
  const segs = [];
  for(let i = 0; i < hits.length; i++){
    const cur = hits[i];
    const next = hits[i+1];
    const d = next ? Math.max(0.5, next.t - cur.t) : 5;
    segs.push({ t: +cur.t.toFixed(2), d: +d.toFixed(2), text: cur.text });
  }
  return segs;
};

// x80: MVP-F — Viral clip detection via Claude with timestamped segments + 4-dimension scoring
// x84: accepts optional chapters [{t,title}] and audioMap for Phase B signals.
// x98: accepts optional signals {audioEvents, scenes, visualHighlights, trendingMatches} for Phase C/D.
// x101: Snap clip boundaries to completed thoughts. The LLM frequently sets clip.end
// at a tick that splits the payoff sentence in half ("revealed an entirely new strategy
// that no human had even…" — cuts off mid-clause). We walk the segment list around
// the LLM's chosen end forward until we hit a true sentence terminator, capped at
// maxExtendEnd seconds. Similarly back up from clip.start if it lands mid-sentence.
const SENTENCE_END_RE = /[.!?…][\s"'")\]]*$/;
const INCOMPLETE_CONJ_RE = /\b(but|and|because|so|that|which|when|if|while|although|though|as|with|to|of|for|in|on|at|it|its|this|these|those|was|were|had|has|have|will|would|could|should|may|might)\s*$/i;

// x109: Build a flat timeline of sentence-END timestamps by walking each segment's
// text character-by-character and linearly interpolating the t of every .!? mark
// within the segment (assumes uniform speaking rate inside the segment — close
// enough for snapping). This is WAY more accurate than segment-end snapping
// because ElevenLabs Scribe groups words into ~6 s chunks that routinely contain
// multiple sentences, or split a sentence across chunks.
const buildSentenceEnds = (segments) => {
  const ends = [];
  if(!Array.isArray(segments)) return ends;
  for(const s of segments){
    const txt = String(s.text || '');
    if(!txt) continue;
    const dur = Math.max(0.001, Number(s.d) || 0.001);
    const t0 = Number(s.t) || 0;
    const total = txt.length;
    for(let i = 0; i < total; i++){
      const ch = txt.charAt(i);
      if(ch === '.' || ch === '!' || ch === '?' || ch === '…'){
        // Skip decimal numbers ("1.3B") and common abbreviations where a period
        // doesn't end a sentence.
        const prev = txt.charAt(i - 1);
        const next = txt.charAt(i + 1);
        if(ch === '.' && /[0-9]/.test(prev) && /[0-9]/.test(next)) continue;
        // Trailing period inside an abbrev like "Dr." — if followed by a space
        // and a lowercase letter, it's usually not a sentence end, but this is
        // rare in transcribed speech so we accept the false positive.
        const fracThroughSeg = (i + 1) / total;
        const t = t0 + dur * fracThroughSeg;
        ends.push(t);
      }
    }
  }
  ends.sort((a, b) => a - b);
  return ends;
};

const snapClipBoundaries = (clip, segments, opts) => {
  if(!Array.isArray(segments) || segments.length === 0) return clip;
  const maxExtendEnd = (opts && opts.maxExtendEnd != null) ? opts.maxExtendEnd : 30;
  const maxBackStart = (opts && opts.maxBackStart != null) ? opts.maxBackStart : 15;
  const start = Number(clip.start) || 0;
  const end = Number(clip.end) || (start + 60);

  const sentenceEnds = (opts && Array.isArray(opts.sentenceEnds)) ? opts.sentenceEnds : buildSentenceEnds(segments);

  // END SNAP — snap forward to the first sentence-end at or after clip.end,
  // capped at maxExtendEnd seconds. If none found, keep original end.
  let newEnd = end;
  let foundEnd = null;
  for(const t of sentenceEnds){
    if(t < end) continue;
    if(t - end > maxExtendEnd) break;
    foundEnd = t;
    break;
  }
  if(foundEnd !== null){
    newEnd = foundEnd + 0.25; // small tail buffer so the last consonant lands
  }

  // START SNAP — snap back to the sentence-end BEFORE clip.start (the last period
  // within maxBackStart seconds before it). New clip.start sits right after that
  // period, which is the start of the sentence the user is about to hear.
  let newStart = start;
  let bestPrevEnd = null;
  for(const t of sentenceEnds){
    if(t >= start) break;
    if(start - t > maxBackStart) continue;
    bestPrevEnd = t;
  }
  if(bestPrevEnd !== null){
    newStart = bestPrevEnd + 0.05; // start right after the period
  }

  // x111c: VAD refinement — if the audio-ai sidecar gave us speech-presence
  // intervals, trim leading and trailing dead air. Catches cases where
  // sentence-end snap landed in a >0.3s silence (long breath, mic dropout,
  // post-roll music). Only TRIMS — never extends past the sentence-end snap,
  // which would risk truncating the payoff.
  const vadIntervals = (opts && Array.isArray(opts.vadIntervals)) ? opts.vadIntervals : null;
  if(vadIntervals && vadIntervals.length){
    // Pull start FORWARD to the first interval beginning at/after newStart,
    // but only if there's a >0.3s gap (silence) currently being included.
    const nextSpeech = vadIntervals.find(iv => iv.end >= newStart);
    if(nextSpeech && nextSpeech.start > newStart + 0.3 && nextSpeech.start < newEnd){
      newStart = nextSpeech.start;
    }
    // Pull end BACKWARD to the last interval ending at/before newEnd,
    // but only if there's a >0.3s gap at the tail.
    const prevSpeech = [...vadIntervals].reverse().find(iv => iv.start <= newEnd);
    if(prevSpeech && prevSpeech.end < newEnd - 0.3 && prevSpeech.end > newStart){
      newEnd = prevSpeech.end + 0.15; // tiny tail so the final consonant lands
    }
  }

  // Hard safety: never let start drop below 0 or cross end.
  newStart = Math.max(0, newStart);
  if(newEnd <= newStart) newEnd = newStart + 5;
  return { ...clip, start: +newStart.toFixed(2), end: +newEnd.toFixed(2) };
};

// x109: After snap, dedupe overlapping clips + drop fragment-length ones + drop
// clips whose content is obviously a sponsor ad. Returns a filtered list in
// virality-descending order, annotated with a `droppedReason` when applicable.
const AD_PATTERNS_RE = /\b(link in (the )?(description|bio|comments)|use (the )?code|use promo|sponsored by|thanks to (our sponsor|today's sponsor)|brought to you by|get \d+% off|check (out|it out) (at|on)|sign up (at|for) \w+\.com|go to \w+\.com\/)/i;

const dedupeAndCleanClips = (clips, segments, opts) => {
  const minDuration = (opts && opts.minDuration != null) ? opts.minDuration : 12;
  const maxOverlapRatio = (opts && opts.maxOverlapRatio != null) ? opts.maxOverlapRatio : 0.4;

  const sorted = [...clips].sort((a, b) => (b.virality || 0) - (a.virality || 0));
  const kept = [];

  for(const c of sorted){
    const dur = (c.end || 0) - (c.start || 0);
    if(dur < minDuration){ continue; }

    // Build the text of this clip from segments
    const clipText = (segments || []).filter(s => s.t >= c.start && s.t <= c.end).map(s => s.text).join(' ');
    if(AD_PATTERNS_RE.test(clipText.slice(0, 400))){
      // Ad content in first 15-20 s of the clip — drop it.
      continue;
    }

    // Check overlap against already-kept clips
    let overlapsTooMuch = false;
    for(const k of kept){
      const overlapStart = Math.max(c.start, k.start);
      const overlapEnd = Math.min(c.end, k.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      const shorter = Math.min(dur, (k.end || 0) - (k.start || 0));
      if(shorter > 0 && overlap / shorter > maxOverlapRatio){
        overlapsTooMuch = true;
        break;
      }
    }
    if(overlapsTooMuch) continue;

    kept.push(c);
  }

  return kept;
};

const analyzeViaClaude = async (proxyUrl, sourceText, targetCount, segments, meta, chapters, audioMap, signals) => {
  const tools = [{
    name:'emit_clips',
    description:'Return the N best viral short-form clip candidates with 4-dimension scoring and full thought arcs.',
    input_schema:{
      type:'object',
      properties:{
        clips:{
          type:'array',
          items:{
            type:'object',
            properties:{
              title:{type:'string', description:'Punchy 3-8 word title'},
              hook:{type:'string', description:'Exact opening line from the transcript that pulls viewers in'},
              caption:{type:'string', description:'1-sentence social caption summarizing the clip'},
              start:{type:'number', description:'Clip start time in seconds — aligned to the first word of the hook sentence, NEVER mid-sentence'},
              end:{type:'number', description:'Clip end time in seconds — aligned to the last word of the payoff sentence (the one at arc.payoff_end). NEVER end mid-sentence or before the payoff completes. Verify: the transcript token immediately before clip.end ends with a period, exclamation, or question mark.'},
              arc:{
                type:'object',
                description:'The clip is a complete narrative arc. Identify the three beats so boundaries capture the whole idea.',
                properties:{
                  setup:{type:'string', description:"One-line description of the setup beat (context/stakes)"},
                  reveal:{type:'string', description:"One-line description of the reveal/turn beat (the thing that happens or the core claim)"},
                  payoff:{type:'string', description:"One-line description of the payoff beat (why it matters, the punchline, the lesson, the resolution)"},
                  payoff_end:{type:'number', description:"Timestamp in seconds where the payoff sentence ENDS (hits a period/!/?). clip.end must be >= this."}
                },
                required:['setup','reveal','payoff','payoff_end']
              },
              hook_power:{type:'number', description:'0-10: does the opening demand attention?'},
              emotional_impact:{type:'number', description:'0-10: shock, excitement, controversy, vulnerability'},
              quotability:{type:'number', description:'0-10: standalone memorable phrase'},
              surprise_drama:{type:'number', description:'0-10: unexpected reveal, conflict, or twist'},
              preset:{type:'string', enum:['vertical','square','landscape']}
            },
            required:['title','hook','caption','start','end','arc','hook_power','emotional_impact','quotability','surprise_drama','preset']
          }
        }
      },
      required:['clips']
    }
  }];
  const hasSegments = Array.isArray(segments) && segments.length > 0;
  const n = Math.max(1, Math.min(20, Number(targetCount)||10));
  const chaps = Array.isArray(chapters) && chapters.length >= 3 ? chapters : [];
  const chapSysAddendum = chaps.length >= 3
    ? '\n\n(f) CHAPTER BOUNDARIES — If chapter boundaries are provided, strongly prefer clip.start/clip.end to align with chapter boundaries unless the viral moment clearly spans a chapter edge.'
    : '';
  const hasSignals = signals && typeof signals === 'object' && (
    (Array.isArray(signals.scenes) && signals.scenes.length > 0) ||
    (Array.isArray(signals.audioEvents) && signals.audioEvents.length > 0) ||
    (Array.isArray(signals.visualHighlights) && signals.visualHighlights.length > 0)
  );
  const signalsSysAddendum = hasSignals
    ? '\n\nAdditional signals (if present):\n' +
      '- scenes: [{t, reason}] — hard visual cuts\n' +
      '- audioEvents: [{t, d, label}] — laughter, applause, emphasis\n' +
      '- visualHighlights: [{t, d, reason, mood}] — model-identified dynamic moments\n\n' +
      'When a candidate clip window aligns with ≥2 distinct signal types (e.g., scene cut + laughter), boost its virality by 8. When it matches a mood of {funny, shocking, emotional, dramatic}, additionally boost by 5.'
    : '';
  const sys = 'You are a viral short-form video strategist extracting TikTok/Reels/Shorts clips from long-form content. The clips you return are what ship to the user — poor boundaries are unusable. Your single most important job is capturing COMPLETE thoughts, not snippets.\n\n' +
    '(a) COMPLETE THOUGHT — Every clip is a three-beat arc: SETUP (context/stakes) → REVEAL (the claim, event, or turn) → PAYOFF (why it matters, the punchline, the resolution, the stat that lands). For each clip you MUST fill arc.setup / arc.reveal / arc.payoff with one-line descriptions, and arc.payoff_end with the exact second the PAYOFF SENTENCE ends (where the speaker hits a period / ! / ?). clip.end MUST be >= arc.payoff_end. Never end the clip mid-sentence, mid-clause, or on a conjunction/pronoun. If you are unsure a clip has a real payoff, do not return it. Common failure mode: hearing a strong hook, extending 20-30s, and cutting before the speaker delivers the line that makes the hook worth it. Do not do that. The payoff is the reason the clip exists.\n\n' +
    '(b) BOUNDARY DISCIPLINE — clip.start must align to the first word of the setup sentence (or the hook sentence if the clip starts directly on the hook). clip.end must align to the last word of the payoff sentence — the transcript token right before clip.end should end with a period, exclamation, or question mark. Never cut on "...and", "...but", "...it", "...that", "...which", etc.\n\n' +
    '(c) LENGTH — pick to match the idea, no target length. Valid range: 5 seconds (a single viral reaction or beat drop) to 1800 seconds / 30 minutes (a full topic arc). Viral hooks are often 45-120s, full thoughts 2-5min, deep segments 10-30min. A 90s clip that completes the idea beats a 25s clip that cuts off the payoff every time. Add 5-15s of tail rather than cut short.\n\n' +
    '(d) SELF-CONTAINED — the viewer sees this cold. It must make sense without any prior context.\n\n' +
    '(e) DISTRIBUTE — clips must span DIFFERENT moments across the full video. Do not cluster near the start.\n\n' +
    '(f) SKIP INTROS — Never set clip.start before the first substantive content. Skip boilerplate intros, sponsor reads, \'welcome back\', table of contents, and podcast cold-opens. If chapter[0] title contains intro/welcome/sponsor/start, begin picks from chapter[1].\n\n' +
    'Score each clip 0-10 on: hook_power, emotional_impact, quotability, surprise_drama. Return ONLY via emit_clips tool.\n\n' +
    'EXAMPLE of the failure to avoid:\n' +
    '  BAD: start=215, end=240, hook="That single move, later known as Move 37, would reshape the game of Go", ends on "...Not only had a machine beaten one of the best human players two games in a row, it" — cuts off mid-clause, no payoff.\n' +
    '  GOOD: start=215, end=246.5, arc.payoff_end=246.2, ends on "...had also revealed an entirely new strategy that no human had even considered in more than 2,000 years." — complete sentence, the stat is the payoff that lands.' +
    chapSysAddendum + signalsSysAddendum;
  const signalsUserBlock = hasSignals
    ? '\n\nMulti-modal signals:\n' +
      (Array.isArray(signals.scenes) && signals.scenes.length ? 'Scene cuts: ' + JSON.stringify(signals.scenes.slice(0, 50)) + '\n' : '') +
      (Array.isArray(signals.audioEvents) && signals.audioEvents.length ? 'Audio events: ' + JSON.stringify(signals.audioEvents.slice(0, 50)) + '\n' : '') +
      (Array.isArray(signals.visualHighlights) && signals.visualHighlights.length ? 'Visual highlights: ' + JSON.stringify(signals.visualHighlights.slice(0, 30)) + '\n' : '')
    : '';
  let userMsg;
  if(hasSegments){
    const { lines, totalDur } = buildTimedTranscript(segments, 14000);
    const metaLine = meta && meta.title ? ('Video: "' + meta.title + '"' + (meta.author ? (' by ' + meta.author) : '') + '\n') : '';
    const chapLine = chaps.length >= 3
      ? 'Available chapters:\n' + chaps.map(c => { const m = Math.floor(c.t/60); const s = Math.round(c.t%60); return '[' + m + ':' + String(s).padStart(2,'0') + '] ' + c.title; }).join('\n') + '\n\n'
      : '';
    userMsg = metaLine +
      'Duration: ' + fmtTs(totalDur) + ' (' + Math.round(totalDur) + 's)\n' +
      'Target clip count: ' + n + '\n\n' +
      chapLine +
      'Timestamped transcript (format: [M:SS] or [H:MM:SS] text):\n' + lines.join('\n') + '\n\n' +
      'Extract exactly ' + n + ' viral clips. Each clip.start / clip.end MUST be in seconds (not formatted). ' +
      'Distribute picks across the full ' + Math.round(totalDur) + 's duration — do not cluster near the start.' +
      signalsUserBlock;
  } else {
    const chapLine = chaps.length >= 3
      ? 'Available chapters:\n' + chaps.map(c => { const m = Math.floor(c.t/60); const s = Math.round(c.t%60); return '[' + m + ':' + String(s).padStart(2,'0') + '] ' + c.title; }).join('\n') + '\n\n'
      : '';
    userMsg = 'Target clip count: ' + n + '\n\n' +
      chapLine +
      'Source (no timestamps — infer approximate seconds across assumed duration):\n' +
      String(sourceText||'').slice(0, 8000) + '\n\n' +
      'Extract exactly ' + n + ' viral clips. Score each on the 4 dimensions.' +
      signalsUserBlock;
  }
  const audioPeaks = (audioMap && Array.isArray(audioMap.peaks)) ? audioMap.peaks : [];
  const trendingMatches = (signals && Array.isArray(signals.trendingMatches)) ? signals.trendingMatches : [];
  const finalSys = trendingMatches.length
    ? sys + '\n\nTrending context (social + search signals from the last week):\n' +
      trendingMatches.map(m => '- "' + m.keyword + '": ' + m.matches.slice(0,3).map(x => x.source + ':' + x.title).join('; ')).join('\n') +
      '\n\nWhen a clip\'s transcript segment mentions a trending keyword, boost virality by 7. When it mentions a term appearing in ≥2 sources (Reddit + HN, etc.), boost by 12 (convergent-attention signal).'
    : sys;
  const j = await mvpCallClaude(proxyUrl, [{role:'user', content:userMsg}], { system:finalSys, tools, tool_choice:{type:'tool', name:'emit_clips'}, max_tokens:3072 });
  const tu = (j.content||[]).find(b => b.type==='tool_use' && b.name==='emit_clips');
  if(!tu || !tu.input || !Array.isArray(tu.input.clips)) throw new Error('No emit_clips tool_use in response');
  return tu.input.clips.map((c,i) => {
    const hp = Math.max(0,Math.min(10,Number(c.hook_power)||0));
    const ei = Math.max(0,Math.min(10,Number(c.emotional_impact)||0));
    const qu = Math.max(0,Math.min(10,Number(c.quotability)||0));
    const sd = Math.max(0,Math.min(10,Number(c.surprise_drama)||0));
    const baseVirality = Math.round((hp*0.35 + ei*0.30 + qu*0.20 + sd*0.15) * 10);
    const rawStart = Math.max(0, Number(c.start)||0);
    let rawEnd = Number(c.end)||rawStart+60;
    if(rawEnd <= rawStart) rawEnd = rawStart + 60;
    // x101: honor arc.payoff_end if the LLM provided it and the declared end falls short.
    const arc = c.arc && typeof c.arc === 'object' ? c.arc : null;
    if(arc && Number(arc.payoff_end) > rawEnd){
      rawEnd = Math.min(rawStart + 1800, Number(arc.payoff_end) + 0.5);
    }
    // Snap to sentence boundaries so we never cut off the payoff or start mid-clause.
    // x111c: also pass through VAD intervals so we trim leading/trailing dead air.
    const snapped = snapClipBoundaries({ start: rawStart, end: rawEnd }, segments, {
      maxExtendEnd: 30,
      maxBackStart: 15,
      vadIntervals: signals && Array.isArray(signals.vadIntervals) ? signals.vadIntervals : null
    });
    let start = snapped.start;
    let end = snapped.end;
    if(end - start > 1800) end = start + 1800;
    if(end - start < 5) end = start + 5;
    let virality = baseVirality;
    if(audioPeaks.length){
      const winDur = Math.max(1, end - start);
      const peaksInWindow = audioPeaks.filter(pt => pt >= start && pt < end).length;
      if(peaksInWindow){
        const peakDensity = peaksInWindow / (winDur / 10);
        virality = Math.min(100, baseVirality + Math.round(5 * Math.min(1, peakDensity)));
      }
    }
    if(hasSignals){
      let signalHits = 0;
      let moodBoost = 0;
      if(Array.isArray(signals.scenes) && signals.scenes.some(s => s.t >= start && s.t <= end)) signalHits++;
      if(Array.isArray(signals.audioEvents) && signals.audioEvents.some(e => e.t + (e.d||0) >= start && e.t <= end)) signalHits++;
      if(Array.isArray(signals.visualHighlights)){
        const matchedVH = signals.visualHighlights.find(h => h.t + (h.d||0) >= start && h.t <= end);
        if(matchedVH){
          signalHits++;
          if(['funny','shocking','emotional','dramatic'].includes(String(matchedVH.mood||'').toLowerCase())) moodBoost = 5;
        }
      }
      if(signalHits >= 2) virality = Math.min(100, virality + 8);
      virality = Math.min(100, virality + moodBoost);
    }
    return {
      id:'c'+(i+1),
      title:String(c.title||'Untitled clip').slice(0,140),
      hook:String(c.hook||'').slice(0,240),
      caption:String(c.caption||'').slice(0,300),
      start: +start.toFixed(2),
      end: +end.toFixed(2),
      virality,
      scores: { hook_power: hp, emotional_impact: ei, quotability: qu, surprise_drama: sd },
      arc: arc ? {
        setup: String(arc.setup||'').slice(0,200),
        reveal: String(arc.reveal||'').slice(0,200),
        payoff: String(arc.payoff||'').slice(0,200),
        payoff_end: Number(arc.payoff_end) || null
      } : null,
      preset:['vertical','square','landscape'].includes(c.preset)?c.preset:'vertical',
      status:'draft'
    };
  });
};

// x80: Score a segment for viral signals (0-10 each dimension, composite 0-100)
const scoreSegmentViral = (text, segDurSec) => {
  const t = String(text||'');
  const lower = t.toLowerCase();
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  const chars = t.length;
  const density = segDurSec > 0 ? (chars / segDurSec) : 0;
  const HOOK_KW = /\b(why|how|secret|truth|nobody|everyone|the one|never|always|biggest|worst|best|stop|start|hidden|surprising|actually|listen|here's|think about)\b/i;
  const EMO_KW = /\b(shocking|incredible|crazy|insane|terrifying|amazing|unbelievable|devastating|miracle|changed my life|love|hate|fear|angry|furious|disgusting|beautiful)\b/i;
  const DRAMA_KW = /\b(but then|suddenly|turns out|twist|actually|reveal|nobody knows|what nobody|behind the scenes|the truth is|real reason)\b/i;
  const NUM_KW = /\b(\d+[%$k]|\$\d|\d+ (years|months|days|times|x)|first|only|#1|number one)\b/i;
  const hookPower = Math.min(10,
    (/^\s*(why|how|what|imagine|picture this|listen|have you|did you)\b/i.test(t) ? 4 : 0) +
    (/\?/.test(t.slice(0, 120)) ? 2 : 0) +
    (HOOK_KW.test(t) ? 3 : 0) +
    (density > 15 ? 1 : 0)
  );
  const emotionalImpact = Math.min(10,
    (EMO_KW.test(t) ? 5 : 0) +
    ((t.match(/!/g)||[]).length >= 1 ? 2 : 0) +
    (/\b(i (felt|was|thought|couldn't)|my (heart|mind|life))\b/i.test(t) ? 3 : 0)
  );
  const quotability = Math.min(10,
    (wordCount >= 6 && wordCount <= 30 ? 4 : wordCount > 30 && wordCount <= 60 ? 2 : 0) +
    (/[""].+[""]/.test(t) ? 2 : 0) +
    (/\b(the (real|only|biggest|truth|secret)|what matters|the point)\b/i.test(t) ? 3 : 0) +
    (/^[A-Z]/.test(t) && /[.!?]$/.test(t) ? 1 : 0)
  );
  const surpriseDrama = Math.min(10,
    (DRAMA_KW.test(t) ? 5 : 0) +
    (NUM_KW.test(t) ? 3 : 0) +
    (/\b(no one|never before|first time|last time|the one thing)\b/i.test(t) ? 2 : 0)
  );
  const virality = Math.round((hookPower*0.35 + emotionalImpact*0.30 + quotability*0.20 + surpriseDrama*0.15) * 10);
  return { hookPower, emotionalImpact, quotability, surpriseDrama, virality };
};

// x80: Local fallback — score timestamped segments, pick top N spread across duration.
// x84: accepts optional chapters [{t,title}] and audioMap {peaks:[]} for Phase B signals.
const analyzeLocal = (sourceText, targetCount, segments, chapters, audioMap) => {
  const n = Math.max(1, Math.min(20, Number(targetCount)||10));
  const hasSegments = Array.isArray(segments) && segments.length > 0;
  const chaps = Array.isArray(chapters) && chapters.length >= 3 ? chapters : [];
  const peaks = (audioMap && Array.isArray(audioMap.peaks)) ? audioMap.peaks : [];
  const HOOK_TITLE_KW = /\b(why|how|secret|truth|nobody|everyone|never|always|biggest|worst|best|stop|start|hidden|surprising|actually|listen|think about|shocking|crazy|insane|amazing|unbelievable|real reason|turns out|twist|reveal)\b/i;

  const applyAudioBoost = (virality, start, end) => {
    if(!peaks.length) return virality;
    const winDur = Math.max(1, end - start);
    const peaksInWindow = peaks.filter(pt => pt >= start && pt < end).length;
    if(!peaksInWindow) return virality;
    const peakDensity = peaksInWindow / (winDur / 10);
    return virality + Math.min(5, Math.round(5 * peakDensity));
  };

  if(hasSegments){
    const { lines, totalDur } = buildTimedTranscript(segments, 60000);
    void lines;
    const windowMin = 5, windowMax = 1800;
    const candidates = [];

    const INTRO_CHAP_KW = /\b(intro|introduction|welcome|sponsor|cold[- ]open)\b/i;
    if(chaps.length >= 3){
      // x84: use chapter spans as candidate windows; x85: skip intro chapters
      let i = 0;
      while(i < chaps.length){
        if(INTRO_CHAP_KW.test(chaps[i].title || '')){ i++; continue; }
        const chapStart = chaps[i].t;
        const chapEnd = i + 1 < chaps.length ? chaps[i+1].t : totalDur;
        const span = chapEnd - chapStart;
        if(span < windowMin && i + 1 < chaps.length){
          // merge with next chapter
          i++;
          continue;
        }
        const clampedEnd = Math.min(totalDur, chapStart + windowMax);
        const actualEnd = span > windowMax ? clampedEnd : Math.min(totalDur, chapEnd);
        const winSegs = segments.filter(s => { const t = Number(s.t)||0; return t >= chapStart && t < actualEnd; });
        if(winSegs.length){
          const winText = winSegs.map(s => s.text).join(' ').replace(/\s+/g,' ').trim();
          if(winText.length >= 60){
            const winDur = Math.max(windowMin, Math.min(windowMax, actualEnd - chapStart));
            const score = scoreSegmentViral(winText, winDur);
            const titleBoost = HOOK_TITLE_KW.test(chaps[i].title) ? 10 : 0;
            const boostedVirality = Math.min(100, score.virality + titleBoost);
            const boostFinal = applyAudioBoost(boostedVirality, chapStart, actualEnd);
            candidates.push({ start: chapStart, end: actualEnd, text: winText, ...score, virality: boostFinal });
          }
        }
        i++;
      }
    }

    if(!candidates.length){
      // sliding-window path (original x83 logic)
      const step = 25;
      const TOPIC_SHIFT = /\b(let me tell you|let's talk|moving on|next|by the way|here's the thing|so|but|now|imagine|think about)\b/i;
      for(let startT = 0; startT < totalDur; startT += step){
        let endT = Math.min(totalDur, startT + windowMax);
        let winSegs = segments.filter(s => {
          const t = Number(s.t)||0;
          return t >= startT && t < endT;
        });
        if(!winSegs.length) continue;
        const earlySegs = winSegs.filter(s => (Number(s.t)||0) - startT <= 8);
        for(const es of earlySegs){
          if(TOPIC_SHIFT.test(es.text || '')){
            const snapT = Number(es.t)||startT;
            winSegs = segments.filter(s => { const t = Number(s.t)||0; return t >= snapT && t < endT; });
            break;
          }
        }
        const lastSeg = winSegs[winSegs.length - 1];
        if(lastSeg && !/[.!?]$/.test((lastSeg.text || '').trim())){
          const extendTo = Math.min(totalDur, endT + 30);
          const extSegs = segments.filter(s => { const t = Number(s.t)||0; return t >= endT && t < extendTo; });
          for(const es of extSegs){
            winSegs.push(es);
            if(/[.!?]$/.test((es.text || '').trim())){ break; }
          }
          endT = winSegs.length ? Math.min(totalDur, (Number(winSegs[winSegs.length-1].t)||0) + (Number(winSegs[winSegs.length-1].d)||5)) : endT;
        }
        const actualStart = Number(winSegs[0].t)||startT;
        const winText = winSegs.map(s => s.text).join(' ').replace(/\s+/g,' ').trim();
        const winDur = Math.max(windowMin, Math.min(windowMax, endT - actualStart));
        if(winText.length < 60) continue;
        const score = scoreSegmentViral(winText, winDur);
        const actualEnd = Math.min(totalDur, actualStart + Math.max(windowMin, Math.min(windowMax, winDur)));
        const rawVirality = applyAudioBoost(score.virality, actualStart, actualEnd);
        // x85: down-weight early windows (likely intro/sponsor) when no chapters available
        const boostedVirality = (!chaps.length && actualStart < 45) ? Math.round(rawVirality * 0.7) : rawVirality;
        candidates.push({ start: actualStart, end: actualEnd, text: winText, ...score, virality: boostedVirality });
      }
    }

    if(candidates.length === 0) return analyzeLocalFromText(sourceText, n);
    // Pick top N with spatial diversity — greedily select highest virality, skip windows that overlap prior picks by >50%
    candidates.sort((a,b) => b.virality - a.virality);
    const picked = [];
    for(const cand of candidates){
      if(picked.length >= n) break;
      const overlap = picked.some(p => {
        const ovStart = Math.max(p.start, cand.start);
        const ovEnd = Math.min(p.end, cand.end);
        const ov = Math.max(0, ovEnd - ovStart);
        const shorter = Math.min(p.end-p.start, cand.end-cand.start);
        return shorter > 0 && (ov / shorter) > 0.5;
      });
      if(!overlap) picked.push(cand);
    }
    if(picked.length < n){
      for(const cand of candidates){
        if(picked.length >= n) break;
        if(!picked.includes(cand)) picked.push(cand);
      }
    }
    picked.sort((a,b) => a.start - b.start);
    return picked.slice(0, n).map((p, i) => {
      const firstSent = (p.text.split(/(?<=[.!?])\s+/)[0] || p.text).slice(0, 140);
      return {
        id: 'c'+(i+1),
        title: firstSent.slice(0, 90),
        hook: firstSent,
        caption: p.text.slice(0, 240),
        start: +p.start.toFixed(2),
        end: +p.end.toFixed(2),
        virality: p.virality,
        scores: { hook_power: p.hookPower, emotional_impact: p.emotionalImpact, quotability: p.quotability, surprise_drama: p.surpriseDrama },
        preset: i%3===0 ? 'vertical' : (i%3===1 ? 'square' : 'landscape'),
        status: 'draft'
      };
    });
  }
  return analyzeLocalFromText(sourceText, n);
};

// x80: Pure-text fallback (no timestamps). Spreads synthetic timecodes across assumed duration.
const analyzeLocalFromText = (sourceText, n) => {
  const text = String(sourceText||'').trim();
  if(!text) return [];
  const sents = text.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>30);
  if(!sents.length) return [];
  const scored = sents.map((s,i) => {
    const sc = scoreSegmentViral(s, Math.max(3, s.length/15));
    return { s, i, ...sc };
  });
  scored.sort((a,b) => b.virality - a.virality);
  const top = scored.slice(0, Math.max(1, Math.min(8, n)));
  top.sort((a,b) => a.i - b.i);
  const totalAssumed = Math.max(180, sents.length * 6);
  return top.map((row,i) => {
    const start = Math.round((row.i / Math.max(1, sents.length-1)) * (totalAssumed - 60));
    return {
      id:'c'+(i+1),
      title: row.s.slice(0,90),
      hook: row.s.split(/[,;:]/)[0].slice(0,140),
      caption: row.s.slice(0,240),
      start,
      end: start + 45,
      virality: row.virality,
      scores: { hook_power: row.hookPower, emotional_impact: row.emotionalImpact, quotability: row.quotability, surprise_drama: row.surpriseDrama },
      preset: i%3===0?'vertical':(i%3===1?'square':'landscape'),
      status:'draft'
    };
  });
};

// x84: Web Audio energy analyzer for uploaded video/audio files.
// Scrubs at 8x (4x Safari fallback) via AudioContext, samples RMS, records peaks.
// Only runs once per file (keyed on name+size). Stores result on project.audioMap.
const analyzeUploadedVideoAudio = (videoUrl, onDone) => {
  return new Promise((resolve) => {
    let audio;
    let ctx;
    let source;
    let analyser;
    const samples = [];
    let rafId = null;

    const cleanup = () => {
      if(rafId !== null){ cancelAnimationFrame(rafId); rafId = null; }
      try { if(source) source.disconnect(); } catch(_){}
      try { if(ctx && ctx.state !== 'closed') ctx.close(); } catch(_){}
      try { if(audio){ audio.pause(); audio.src = ''; } } catch(_){}
    };

    const finish = () => {
      cleanup();
      if(!samples.length){ resolve(null); return; }
      const duration = samples[samples.length-1].t;
      const rmsValues = samples.map(s => s.rms);
      const mean = rmsValues.reduce((a,b) => a+b, 0) / rmsValues.length;
      const variance = rmsValues.reduce((a,b) => a + (b-mean)*(b-mean), 0) / rmsValues.length;
      const stddev = Math.sqrt(variance);
      const threshold = mean + 1.5 * stddev;
      const peaks = samples.filter(s => s.rms > threshold && s.rms > 0.15).map(s => +s.t.toFixed(2));
      const result = { duration: +duration.toFixed(2), samples, peaks };
      resolve(result);
      if(onDone) onDone(result);
    };

    const tick = () => {
      if(!analyser || !audio || audio.ended || audio.paused){ finish(); return; }
      const buf = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(buf);
      let sumSq = 0;
      for(let i = 0; i < buf.length; i++){
        const v = (buf[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / buf.length);
      samples.push({ t: audio.currentTime, rms: +rms.toFixed(4) });
      rafId = requestAnimationFrame(tick);
    };

    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.4;

      audio = document.createElement('audio');
      audio.src = videoUrl;
      audio.muted = true;
      audio.preservesPitch = false;
      audio.crossOrigin = 'anonymous';

      audio.addEventListener('canplay', () => {
        try {
          source = ctx.createMediaElementSource(audio);
          source.connect(analyser);
          audio.playbackRate = 8;
          audio.play().catch(() => {
            try { audio.playbackRate = 4; audio.play().catch(() => { cleanup(); resolve(null); }); } catch(_){ cleanup(); resolve(null); }
          });
          rafId = requestAnimationFrame(tick);
        } catch(_){ cleanup(); resolve(null); }
      }, { once: true });

      audio.addEventListener('ended', () => { finish(); }, { once: true });
      audio.addEventListener('error', () => { cleanup(); resolve(null); }, { once: true });

      audio.load();
    } catch(_){ cleanup(); resolve(null); }
  });
};

// x92: Extract a compressed audio-only blob from an uploaded video/audio file
// via ffmpeg.wasm, so long videos don't hit Cloudflare Workers' request body
// limit (500 MiB on paid). Output: ~32kbps mono 16kHz MP3 → ~14 MB per hour.
// Lazy-loads ffmpeg.wasm from unpkg on first use; subsequent calls reuse the
// same instance for the session.
let __ffmpegInstance = null;
// ffmpeg-loader.js exposes window.zsLoadFfmpeg (a native ESM module). Wait for
// it to be defined — script type=module is deferred and may land after this
// Babel-transformed script begins executing.
const awaitFfmpegLoader = () => new Promise((resolve, reject) => {
  if(window.zsLoadFfmpeg) return resolve(window.zsLoadFfmpeg);
  const start = Date.now();
  const t = setInterval(() => {
    if(window.zsLoadFfmpeg){ clearInterval(t); resolve(window.zsLoadFfmpeg); }
    else if(Date.now() - start > 10000){ clearInterval(t); reject(new Error("ffmpeg-loader.js failed to load")); }
  }, 50);
});
const loadFfmpeg = async (onStatus) => {
  if(__ffmpegInstance) return __ffmpegInstance;
  if(onStatus) onStatus("Downloading audio-extraction engine (~30 MB, one-time)…");
  const CORE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  const loader = await awaitFfmpegLoader();
  const mods = await loader();
  const ffmpeg = new mods.FFmpeg();
  await ffmpeg.load({
    coreURL: await mods.toBlobURL(CORE + "/ffmpeg-core.js", "text/javascript"),
    wasmURL: await mods.toBlobURL(CORE + "/ffmpeg-core.wasm", "application/wasm")
  });
  __ffmpegInstance = { ffmpeg, util: { fetchFile: mods.fetchFile, toBlobURL: mods.toBlobURL } };
  return __ffmpegInstance;
};
const extractAudioAsMp3 = async (videoBlob, filename, onStatus, onProgress) => {
  const { ffmpeg, util } = await loadFfmpeg(onStatus);
  const ext = (filename || 'input.mp4').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const inputName = "input." + ext;
  const outputName = "output.mp3";
  const progressHandler = ({ progress }) => { if(onProgress && typeof progress === 'number') onProgress(Math.min(0.99, progress)); };
  ffmpeg.on && ffmpeg.on("progress", progressHandler);
  try {
    if(onStatus) onStatus("Loading file into extractor…");
    await ffmpeg.writeFile(inputName, await util.fetchFile(videoBlob));
    if(onStatus) onStatus("Extracting audio (mp4 → mono 16 kHz MP3)…");
    // -vn drop video, libmp3lame mono 16kHz 32kbps is fine for speech-to-text.
    await ffmpeg.exec([
      "-i", inputName,
      "-vn",
      "-c:a", "libmp3lame",
      "-b:a", "32k",
      "-ac", "1",
      "-ar", "16000",
      outputName
    ]);
    const data = await ffmpeg.readFile(outputName);
    // Clean up virtual FS (ignore errors).
    try { await ffmpeg.deleteFile(inputName); } catch(_){}
    try { await ffmpeg.deleteFile(outputName); } catch(_){}
    return new Blob([data.buffer || data], { type: "audio/mpeg" });
  } finally {
    try { ffmpeg.off && ffmpeg.off("progress", progressHandler); } catch(_){}
  }
};

// x97: Scene-cut detector using WebCodecs + MP4Box.js color-histogram diff.
// Returns [{t: seconds, reason: "hard-cut"}], capped at 200 events.
// Gracefully resolves [] when WebCodecs or MP4Box is unavailable.
const detectSceneCuts = async (videoBlob, onProgress) => {
  if(typeof VideoDecoder === 'undefined') return [];

  // Lazy-load MP4Box.js
  if(typeof window.MP4Box === 'undefined'){
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/mp4box@0.5.2/dist/mp4box.all.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('mp4box load failed'));
      document.head.appendChild(s);
    });
  }
  if(typeof window.MP4Box === 'undefined') return [];

  try {
    const arrayBuffer = await videoBlob.arrayBuffer();
    const mp4 = window.MP4Box.createFile();

    // Collect video track samples
    const frames = await new Promise((resolve, reject) => {
      const samples = [];
      let videoTrackId = null;

      mp4.onReady = (info) => {
        const vt = (info.videoTracks || [])[0];
        if(!vt){ reject(new Error('no video track')); return; }
        videoTrackId = vt.id;
        mp4.setExtractionOptions(videoTrackId, null, { nbSamples: 9999 });
        mp4.start();
      };
      mp4.onSamples = (trackId, _ref, sampleList) => {
        if(trackId !== videoTrackId) return;
        for(const s of sampleList){
          samples.push({ dts: s.dts, duration: s.duration, timescale: s.timescale, isSync: s.is_sync, data: s.data });
        }
      };
      mp4.onError = reject;
      mp4.onFlush = () => resolve(samples);

      const buf = arrayBuffer.slice(0);
      buf.fileStart = 0;
      mp4.appendBuffer(buf);
      mp4.flush();
    });

    if(!frames || frames.length === 0) return [];

    const totalDur = frames[frames.length - 1].dts / frames[frames.length - 1].timescale + 1;

    // Sample at ~5 fps
    const TARGET_FPS = 5;
    const INTERVAL = 1 / TARGET_FPS;
    const BINS = 8; // 8x8x8 histogram per channel
    const THRESHOLD = 0.35;
    const MAX_CUTS = 200;

    // Build a map of time -> frame data for keyframes near sample points
    const keyframes = frames.filter(f => f.isSync);
    if(keyframes.length === 0) return [];

    const cuts = [];
    let prevHist = null;
    let prevT = -999;

    // Use an OffscreenCanvas or a regular canvas to decode frames visually
    // We decode each keyframe near a sample point via VideoDecoder
    const canvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(160, 90)
      : (() => { const c = document.createElement('canvas'); c.width=160; c.height=90; return c; })();
    const ctx = canvas.getContext('2d');

    const computeHistogram = (imgData) => {
      const d = imgData.data;
      const hist = new Float32Array(BINS * BINS * BINS);
      const step = BINS / 256;
      for(let i = 0; i < d.length; i += 4){
        const r = Math.floor(d[i] * step);
        const g = Math.floor(d[i+1] * step);
        const b = Math.floor(d[i+2] * step);
        hist[r * BINS * BINS + g * BINS + b]++;
      }
      const total = d.length / 4;
      if(total > 0) for(let j = 0; j < hist.length; j++) hist[j] /= total;
      return hist;
    };

    const l1Distance = (a, b) => {
      let d = 0;
      for(let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
      return d;
    };

    // Decode via VideoDecoder at sample timestamps
    const videoEl = document.createElement('video');
    videoEl.muted = true;
    videoEl.preload = 'metadata';
    const blobUrl = URL.createObjectURL(videoBlob);

    try {
      await new Promise((res, rej) => {
        videoEl.onloadedmetadata = res;
        videoEl.onerror = rej;
        videoEl.src = blobUrl;
      });

      const vidDur = videoEl.duration;
      const sampleCount = Math.ceil(vidDur / INTERVAL);

      for(let i = 0; i < sampleCount && cuts.length < MAX_CUTS; i++){
        const t = i * INTERVAL;
        if(t > vidDur) break;
        if(t - prevT < INTERVAL * 0.8) continue;
        prevT = t;

        await new Promise((res) => {
          videoEl.currentTime = t;
          videoEl.onseeked = res;
        });

        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hist = computeHistogram(imgData);

        if(prevHist !== null){
          const dist = l1Distance(hist, prevHist);
          if(dist > THRESHOLD){
            cuts.push({ t: +t.toFixed(2), reason: 'hard-cut' });
          }
        }
        prevHist = hist;

        if(onProgress) onProgress(t / vidDur);
      }
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    return cuts.slice(0, MAX_CUTS);
  } catch(e){
    console.warn('[zs] detectSceneCuts failed', e);
    return [];
  }
};

// x93: Cut a single clip out of a source blob using ffmpeg.wasm.
// Uses output-side seek (-ss after -i) for frame-accurate start/end.
// Tries -c copy first (fast mux); falls back to libx264+aac encode for
// containers that can't be stream-copied, but only when clip < 5 min.
const cutClipFromSource = async (srcBlob, clip, onProgress) => {
  const { ffmpeg, util } = await loadFfmpeg(null);
  const srcName = srcBlob.name || "source.mp4";
  const ext = srcName.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const inputName = "clip_in." + ext;
  const outputName = "clip_out.mp4";
  const progressHandler = ({ progress }) => { if(onProgress && typeof progress === 'number') onProgress(Math.min(0.99, progress)); };
  ffmpeg.on && ffmpeg.on("progress", progressHandler);
  try {
    await ffmpeg.writeFile(inputName, await util.fetchFile(srcBlob));
    const ss = String(clip.start || 0);
    const to = String(clip.end || 0);
    let succeeded = false;
    // Attempt 1: copy streams (no re-encode, very fast).
    try {
      await ffmpeg.exec(["-i", inputName, "-ss", ss, "-to", to, "-c", "copy", "-avoid_negative_ts", "1", outputName]);
      succeeded = true;
    } catch(_) {}
    // Attempt 2: full encode fallback (capped at 5 min to avoid long waits).
    if(!succeeded){
      const clipDur = (clip.end || 0) - (clip.start || 0);
      if(clipDur > 300) throw new Error("clip too long for encode fallback (" + Math.round(clipDur) + "s > 300s)");
      await ffmpeg.exec(["-i", inputName, "-ss", ss, "-to", to, "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", outputName]);
    }
    const data = await ffmpeg.readFile(outputName);
    return new Blob([data.buffer || data], { type: "video/mp4" });
  } finally {
    try { ffmpeg.off && ffmpeg.off("progress", progressHandler); } catch(_){}
    try { await ffmpeg.deleteFile(inputName); } catch(_){}
    try { await ffmpeg.deleteFile(outputName); } catch(_){}
  }
};

// x96: Re-encode a per-clip mp4 blob to a target preset using ffmpeg.wasm scale+pad.
// Preset dims: vertical=1080x1920, square=1080x1080, landscape=1920x1080.
// Centers with black bars — never crops unpredictably.
const reencodeClipForPreset = async (srcMp4Blob, presetId, onProgress) => {
  const PRESET_DIMS = { vertical: [1080, 1920], square: [1080, 1080], landscape: [1920, 1080] };
  const [W, H] = PRESET_DIMS[presetId] || PRESET_DIMS.vertical;
  const { ffmpeg, util } = await loadFfmpeg(null);
  const inputName = "reencode_in.mp4";
  const outputName = "reencode_out.mp4";
  const progressHandler = ({ progress }) => { if(onProgress && typeof progress === 'number') onProgress(Math.min(0.99, progress)); };
  ffmpeg.on && ffmpeg.on("progress", progressHandler);
  try {
    await ffmpeg.writeFile(inputName, await util.fetchFile(srcMp4Blob));
    const exit = await ffmpeg.exec([
      "-i", inputName,
      "-vf", "scale=" + W + ":" + H + ":force_original_aspect_ratio=decrease,pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2:black,setsar=1",
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      outputName
    ]);
    if(exit !== 0) throw new Error("ffmpeg reencode failed (exit " + exit + ") — likely an unsupported input codec (e.g. AV1)");
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer || data], { type: "video/mp4" });
    if(!blob.size) throw new Error("ffmpeg produced a 0-byte output");
    return blob;
  } finally {
    try { ffmpeg.off && ffmpeg.off("progress", progressHandler); } catch(_){}
    try { await ffmpeg.deleteFile(inputName); } catch(_){}
    try { await ffmpeg.deleteFile(outputName); } catch(_){}
  }
};

// x99f: Two-pass batch export — record <video>.captureStream() → ffmpeg.wasm reencode.
// Pass 1 (captureStream) works in hidden tabs because video element playback, MediaStream
// tracks, and MediaRecorder are NOT bound by rAF throttling. The canvas+rAF pipeline in
// renderClipVideoFromUpload produced 1-frame outputs whenever the tab lost focus. Pass 2
// handles preset scale+pad + H.264 encode for real 1080p MP4 output. ffmpeg.wasm can
// decode the VP9 that MediaRecorder emits (the AV1 blind spot only matters for the raw
// YouTube MP4, not our re-encode).
const recordClipViaCaptureStream = async (videoUrl, clip, onProgress) => {
  if(!videoUrl) throw new Error("no video");
  const start = Math.max(0, Number(clip.start) || 0);
  const end = Math.max(start + 0.1, Number(clip.end) || (start + 1));
  const duration = end - start;
  const src = document.createElement("video");
  src.src = videoUrl;
  src.muted = true;
  src.playsInline = true;
  src.preload = "auto";
  await new Promise((res, rej) => { src.onloadedmetadata = () => res(); src.onerror = () => rej(new Error("video load failed")); });
  await new Promise((res, rej) => { src.onseeked = () => res(); src.onerror = () => rej(new Error("seek failed")); try { src.currentTime = start; } catch(e){ rej(e); } });
  const capFn = src.captureStream || src.mozCaptureStream;
  if(!capFn) throw new Error("video.captureStream not supported");
  const stream = capFn.call(src);
  const mimes = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  let mime = "";
  for(const m of mimes){ if(window.MediaRecorder && MediaRecorder.isTypeSupported(m)){ mime = m; break; } }
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if(e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => { rec.onstop = () => res(); });
  rec.start(500);
  await src.play();
  let progTimer = null;
  if(typeof onProgress === "function"){
    progTimer = setInterval(() => {
      const t = Math.max(0, src.currentTime - start);
      onProgress(Math.min(0.45, (t / duration) * 0.45));
    }, 1000);
  }
  await new Promise((res) => {
    const check = () => {
      if(src.currentTime >= end || src.ended){ res(); return; }
      setTimeout(check, 500);
    };
    check();
  });
  if(progTimer) clearInterval(progTimer);
  try { rec.stop(); } catch(e){}
  try { src.pause(); } catch(e){}
  await done;
  try { src.src = ""; } catch(e){}
  const blob = new Blob(chunks, { type: mime || "video/webm" });
  if(!blob.size) throw new Error("captureStream produced no data");
  return blob;
};

const reencodeWebmToPresetMP4 = async (srcWebmBlob, presetId, onProgress) => {
  const PRESET_DIMS = { vertical: [1080, 1920], square: [1080, 1080], landscape: [1920, 1080] };
  const [W, H] = PRESET_DIMS[presetId] || PRESET_DIMS.vertical;
  const { ffmpeg, util } = await loadFfmpeg(null);
  const inputName = "rec_in.webm";
  const outputName = "rec_out.mp4";
  const progressHandler = ({ progress }) => { if(onProgress && typeof progress === "number") onProgress(0.5 + Math.min(0.49, progress * 0.49)); };
  ffmpeg.on && ffmpeg.on("progress", progressHandler);
  try {
    await ffmpeg.writeFile(inputName, await util.fetchFile(srcWebmBlob));
    const exit = await ffmpeg.exec([
      "-i", inputName,
      "-vf", "scale=" + W + ":" + H + ":force_original_aspect_ratio=decrease,pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2:black,setsar=1",
      "-c:v", "libx264", "-preset", "fast", "-crf", "20",
      "-c:a", "aac", "-b:a", "160k",
      "-movflags", "+faststart",
      outputName
    ]);
    if(exit !== 0) throw new Error("ffmpeg reencode failed (exit " + exit + ")");
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer || data], { type: "video/mp4" });
    if(!blob.size) throw new Error("ffmpeg produced 0-byte output");
    return blob;
  } finally {
    try { ffmpeg.off && ffmpeg.off("progress", progressHandler); } catch(_){}
    try { await ffmpeg.deleteFile(inputName); } catch(_){}
    try { await ffmpeg.deleteFile(outputName); } catch(_){}
  }
};

// ─── x108: Smart crop — face-aware clip render ───────────────────────────────

const SC_PRESET_DIMS = { vertical: [1080, 1920], square: [1080, 1080], landscape: [1920, 1080] };

// x108: MediaPipe's vision bundle is ESM-only. Babel standalone rewrites
// dynamic import() into require(), which throws in the browser. So we defer
// the import() to a native <script type="module"> (./mediapipe-loader.js)
// and expose window.zsLoadMediaPipe(), which this helper awaits.
const awaitMediaPipeLoader = () => new Promise((resolve, reject) => {
  if(window.zsLoadMediaPipe) return resolve(window.zsLoadMediaPipe);
  const start = Date.now();
  const t = setInterval(() => {
    if(window.zsLoadMediaPipe){ clearInterval(t); resolve(window.zsLoadMediaPipe); }
    else if(Date.now() - start > 10000){ clearInterval(t); reject(new Error("mediapipe-loader.js failed to load")); }
  }, 50);
});

let _faceDetectorPromise = null;
const loadFaceDetector = () => {
  if(_faceDetectorPromise) return _faceDetectorPromise;
  _faceDetectorPromise = (async () => {
    const loader = await awaitMediaPipeLoader();
    const { FilesetResolver, FaceDetector, base } = await loader();
    const vision = await FilesetResolver.forVisionTasks(base);
    const fd = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: base + "blaze_face_short_range.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
      minSuppressionThreshold: 0.3,
    });
    return fd;
  })();
  _faceDetectorPromise.catch(() => { _faceDetectorPromise = null; });
  return _faceDetectorPromise;
};

const detectFacesInClip = async (videoUrl, clip, opts) => {
  if(!videoUrl) return [];
  const start = Math.max(0, Number(clip.start) || 0);
  const end = Math.max(start + 0.1, Number(clip.end) || (start + 1));
  const clipDur = end - start;
  const MAX_SAMPLES = 120;
  const interval = clipDur > 60 ? 1.0 : 0.5;
  const fd = await loadFaceDetector();
  const vid = document.createElement("video");
  vid.src = videoUrl;
  vid.muted = true;
  vid.playsInline = true;
  vid.preload = "auto";
  await new Promise((res, rej) => { vid.onloadedmetadata = res; vid.onerror = rej; });
  const vw = vid.videoWidth || 1;
  const vh = vid.videoHeight || 1;
  const results = [];
  let sampleCount = 0;
  for(let t = start; t < end && sampleCount < MAX_SAMPLES; t += interval, sampleCount++){
    if(document.visibilityState === "hidden") throw new Error("tab hidden during face detection");
    await new Promise((res) => { vid.onseeked = res; try { vid.currentTime = t; } catch(e){ res(); } });
    const timestampMs = Math.round((t - start) * 1000);
    let detections = [];
    try {
      const r = fd.detectForVideo(vid, timestampMs);
      detections = r.detections || [];
    } catch(_){}
    const faces = detections.map(d => {
      const bb = d.boundingBox || {};
      return {
        x: (bb.originX || 0) / vw,
        y: (bb.originY || 0) / vh,
        w: (bb.width || 0) / vw,
        h: (bb.height || 0) / vh,
        score: d.categories && d.categories[0] ? (d.categories[0].score || 0) : 0,
      };
    });
    results.push({ t: t - start, faces, faceCount: faces.length });
  }
  try { vid.src = ""; } catch(_){}
  return results;
};

const computeCropPath = (facesOverTime, sceneCuts, sourceWH, targetPreset) => {
  const [tW, tH] = SC_PRESET_DIMS[targetPreset] || SC_PRESET_DIMS.vertical;
  const [srcW, srcH] = sourceWH;
  const targetAR = tW / tH;
  if(!facesOverTime || facesOverTime.length === 0) return [];

  const scCutTimes = new Set((sceneCuts || []).map(c => c.t));

  const segments = [];
  let segStart = 0;
  for(let i = 1; i < facesOverTime.length; i++){
    const prev = facesOverTime[i-1];
    const curr = facesOverTime[i];
    const hasCut = [...scCutTimes].some(ct => ct > prev.t && ct <= curr.t);
    const countChanged = prev.faceCount !== curr.faceCount;
    if(hasCut || countChanged){
      segments.push({ from: segStart, to: i - 1 });
      segStart = i;
    }
  }
  segments.push({ from: segStart, to: facesOverTime.length - 1 });

  const cropForSegment = (seg) => {
    const samples = facesOverTime.slice(seg.from, seg.to + 1);
    const hasFaces = samples.some(s => s.faceCount > 0);
    if(!hasFaces){
      const cw = Math.min(srcW, Math.round(srcH * targetAR));
      const ch = Math.min(srcH, Math.round(srcW / targetAR));
      const cx = Math.round((srcW - cw) / 2);
      const cy = Math.round((srcH - ch) / 2);
      return { x: cx, y: cy, w: cw, h: ch };
    }
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for(const s of samples){
      for(const f of s.faces){
        minX = Math.min(minX, f.x);
        minY = Math.min(minY, f.y);
        maxX = Math.max(maxX, f.x + f.w);
        maxY = Math.max(maxY, f.y + f.h);
      }
    }
    const PAD = 0.35;
    const fw = maxX - minX, fh = maxY - minY;
    minX = Math.max(0, minX - fw * PAD);
    minY = Math.max(0, minY - fh * PAD);
    maxX = Math.min(1, maxX + fw * PAD);
    maxY = Math.min(1, maxY + fh * PAD);
    let bx = minX * srcW, by = minY * srcH;
    let bw = (maxX - minX) * srcW, bh = (maxY - minY) * srcH;
    const bAR = bw / bh;
    if(bAR < targetAR){ bw = bh * targetAR; }
    else { bh = bw / targetAR; }
    bx = Math.max(0, Math.min(srcW - bw, bx + ((maxX - minX) * srcW - bw) / 2));
    by = Math.max(0, Math.min(srcH - bh, by + ((maxY - minY) * srcH - bh) / 2));
    bw = Math.min(srcW - bx, bw);
    bh = Math.min(srcH - by, bh);
    return { x: Math.round(bx), y: Math.round(by), w: Math.round(bw), h: Math.round(bh) };
  };

  return segments.map((seg, i) => {
    const tStart = facesOverTime[seg.from].t;
    const tEnd = facesOverTime[seg.to].t;
    const crop = cropForSegment(seg);
    const prevCrop = i > 0 ? cropForSegment(segments[i-1]) : null;
    return { tStart, tEnd, crop, easeFrom: prevCrop, easeDuration: 0.3 };
  });
};

const lerpCrop = (a, b, alpha) => ({
  x: Math.round(a.x + (b.x - a.x) * alpha),
  y: Math.round(a.y + (b.y - a.y) * alpha),
  w: Math.round(a.w + (b.w - a.w) * alpha),
  h: Math.round(a.h + (b.h - a.h) * alpha),
});

const cropAtTime = (cropPath, t) => {
  if(!cropPath || cropPath.length === 0) return null;
  const seg = cropPath.find(s => t >= s.tStart && t <= s.tEnd) || cropPath[cropPath.length - 1];
  if(!seg) return null;
  if(seg.easeFrom && t < seg.tStart + seg.easeDuration){
    const alpha = Math.min(1, (t - seg.tStart) / seg.easeDuration);
    return lerpCrop(seg.easeFrom, seg.crop, alpha);
  }
  return seg.crop;
};

const renderClipSmartCrop = async (videoUrl, clip, presetId, cropPath, onProgress) => {
  const [targetW, targetH] = SC_PRESET_DIMS[presetId] || SC_PRESET_DIMS.vertical;
  const start = Math.max(0, Number(clip.start) || 0);
  const end = Math.max(start + 0.1, Number(clip.end) || (start + 1));
  const duration = end - start;

  const vid = document.createElement("video");
  vid.src = videoUrl;
  vid.muted = true;
  vid.playsInline = true;
  vid.preload = "auto";
  await new Promise((res, rej) => { vid.onloadedmetadata = res; vid.onerror = rej; });
  await new Promise((res, rej) => { vid.onseeked = res; vid.onerror = rej; try { vid.currentTime = start; } catch(e){ rej(e); } });

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");

  const srcW = vid.videoWidth || 1920;
  const srcH = vid.videoHeight || 1080;

  const videoStream = canvas.captureStream(30);
  let audioTrack = null;
  try {
    const capFn = vid.captureStream || vid.mozCaptureStream;
    if(capFn){
      const vs = capFn.call(vid);
      const at = vs.getAudioTracks()[0];
      if(at) audioTrack = at;
    }
  } catch(_){}
  const stream = audioTrack
    ? new MediaStream([...videoStream.getVideoTracks(), audioTrack])
    : videoStream;

  const mimes = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  let mime = "";
  for(const m of mimes){ if(MediaRecorder.isTypeSupported(m)){ mime = m; break; } }
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if(e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => { rec.onstop = res; });
  rec.start(200);

  const drawFrame = () => {
    const t = vid.currentTime - start;
    const crop = cropAtTime(cropPath, t) || { x: 0, y: 0, w: srcW, h: srcH };
    ctx.drawImage(vid, crop.x, crop.y, crop.w, crop.h, 0, 0, targetW, targetH);
    if(onProgress) onProgress(Math.min(0.95, t / duration));
  };

  await vid.play();

  await new Promise((res) => {
    const rvfc = vid.requestVideoFrameCallback
      ? (cb) => vid.requestVideoFrameCallback(cb)
      : (cb) => requestAnimationFrame(cb);
    const tick = () => {
      if(vid.currentTime >= end || vid.ended){ res(); return; }
      drawFrame();
      rvfc(tick);
    };
    rvfc(tick);
  });

  try { rec.stop(); } catch(_){}
  try { vid.pause(); } catch(_){}
  await done;
  try { vid.src = ""; } catch(_){}

  if(onProgress) onProgress(1);
  return new Blob(chunks, { type: mime || "video/webm" });
};

// ─── end x108 helpers ────────────────────────────────────────────────────────

// x96: Trigger a browser download from a Blob.
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // 60 s — Chrome streams the blob to disk via the download manager; revoking too
  // early (≤500 ms) truncates large downloads mid-write.
  setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch(_){} }, 60000);
};

// x96: Wait for zip-loader.js to expose window.zsLoadJSZip (ESM module, deferred).
const awaitZipLoader = () => new Promise((resolve, reject) => {
  if(window.zsLoadJSZip) return resolve(window.zsLoadJSZip);
  const start = Date.now();
  const t = setInterval(() => {
    if(window.zsLoadJSZip){ clearInterval(t); resolve(window.zsLoadJSZip); }
    else if(Date.now() - start > 10000){ clearInterval(t); reject(new Error("zip-loader.js failed to load")); }
  }, 50);
});

// x93: Grab a JPEG thumbnail from srcBlob at atSec using an off-DOM video element.
const grabFrameThumb = (srcBlob, atSec) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(srcBlob);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "metadata";
  const cleanup = () => { try { URL.revokeObjectURL(url); } catch(_){} };
  video.onerror = () => { cleanup(); reject(new Error("video load error for thumb")); };
  video.onloadeddata = () => {
    video.currentTime = Math.max(0, atSec);
  };
  video.onseeked = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 480; canvas.height = 270;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, 480, 270);
      canvas.toBlob((blob) => {
        cleanup();
        if(blob) resolve(blob);
        else reject(new Error("canvas toBlob returned null"));
      }, "image/jpeg", 0.8);
    } catch(e){ cleanup(); reject(e); }
  };
  video.src = url;
});

// x93: Generate cut video + thumbnail for every clip, write both to IDB, mark ready.
// Sequential — ffmpeg.wasm is single-threaded.
const generateClipAssets = async (srcBlob, clips, onStatus, setClipBlobUrls) => {
  if(setClipBlobUrls){
    setClipBlobUrls(prev => {
      Object.values(prev).forEach(e => { try { URL.revokeObjectURL(e.video); } catch(_){} try { URL.revokeObjectURL(e.thumb); } catch(_){} });
      return {};
    });
  }
  const total = clips.length;
  const results = [];
  for(let i = 0; i < clips.length; i++){
    const clip = clips[i];
    if(onStatus) onStatus("Cutting clip " + (i + 1) + " of " + total + "…");
    let cutBlob = null, thumbBlob = null;
    try {
      cutBlob = await cutClipFromSource(srcBlob, clip, null);
      await idbPutClip(clip.id, cutBlob);
    } catch(e){
      console.warn("[zs] cutClipFromSource failed for clip", clip.id, e);
      results.push({ id: clip.id, ready: false });
      continue;
    }
    const video = URL.createObjectURL(cutBlob);
    let thumb = null;
    try {
      const midSec = (clip.start || 0) + ((clip.end || 0) - (clip.start || 0)) * 0.25;
      thumbBlob = await grabFrameThumb(srcBlob, midSec);
      await idbPutClip(clip.id + ":thumb", thumbBlob);
      thumb = URL.createObjectURL(thumbBlob);
    } catch(e){
      console.warn("[zs] grabFrameThumb failed for clip", clip.id, e);
      // non-fatal — clip still usable without thumbnail
    }
    if(setClipBlobUrls) setClipBlobUrls(prev => ({ ...prev, [clip.id]: { video, thumb } }));
    results.push({ id: clip.id, ready: true });
  }
  return results;
};

// x90: Transcribe an uploaded video/audio file via ElevenLabs Scribe.
// Returns { text, segments:[{t,d,text}] } by grouping word-level timestamps
// into ~6-second phrases (breaks earlier on sentence-ending punctuation).
const transcribeUploadedFile = async (elevenBase, blob, filename) => {
  // x111b: route to the audio-ai sidecar (faster-whisper / WhisperX) when the
  // hyperframes-style provider toggle is on. Output shape is identical
  // ({ text, segments, words }) so no caller changes are needed. Falls
  // through to ElevenLabs Scribe when the sidecar is disabled or unreachable.
  const audioAiBase = getAudioAiPath();
  if (audioAiBase) {
    try {
      const aiForm = new FormData();
      aiForm.append('file', blob, filename || 'upload.mp4');
      aiForm.append('engine', 'faster-whisper');
      aiForm.append('model', 'base');
      const aiRes = await fetch(audioAiBase.replace(/\/$/, '') + '/transcribe', { method: 'POST', body: aiForm });
      if (aiRes.ok) {
        const data = await aiRes.json();
        const segments = Array.isArray(data.segments) ? data.segments : [];
        const words = Array.isArray(data.words) ? data.words : [];
        return { text: String(data.text || ''), segments, words };
      }
      console.warn('[zs] audio-ai transcribe HTTP', aiRes.status, '— falling back to ElevenLabs');
    } catch(e) {
      console.warn('[zs] audio-ai transcribe threw, falling back to ElevenLabs:', e);
    }
  }
  const form = new FormData();
  form.append('file', blob, filename || 'upload.mp4');
  form.append('model_id', 'scribe_v1');
  form.append('timestamps_granularity', 'word');
  const res = await fetch(elevenBase.replace(/\/$/, '') + '/elevenlabs/v1/speech-to-text', {
    method: 'POST',
    body: form
  });
  if(!res.ok){
    let msg = 'HTTP ' + res.status;
    try {
      const j = await res.json();
      if(j && j.detail){
        msg = Array.isArray(j.detail) ? (j.detail[0] && (j.detail[0].msg || JSON.stringify(j.detail[0]))) : String(j.detail);
      } else if(j && j.error){ msg = j.error; }
    } catch(_){}
    throw new Error(msg);
  }
  const data = await res.json();
  const fullText = (data.text || '').trim();
  const words = Array.isArray(data.words) ? data.words : [];
  const segments = [];
  // x110b: also keep cleaned word-level timings (punctuation merged into the
  // preceding word, spacing dropped) so HyperFrames can render word-by-word
  // captions. The segment-bucketed shape below loses this granularity.
  const cleanWords = [];
  const MIN_DUR = 3;
  const MAX_DUR = 8;
  const PUNCT_END = /[.!?]$/;
  let cur = [];
  for(const w of words){
    if(w && typeof w.start === 'number' && typeof w.end === 'number' && (w.type === 'word' || w.type === undefined)){
      cur.push(w);
      cleanWords.push({ text: String(w.text || '').trim(), start: +w.start.toFixed(3), end: +w.end.toFixed(3) });
    } else if(w && w.type === 'spacing'){
      continue;
    } else if(w && w.type === 'punctuation' && cur.length){
      cur[cur.length-1] = { ...cur[cur.length-1], text: (cur[cur.length-1].text || '') + (w.text || '') };
      if(cleanWords.length){
        cleanWords[cleanWords.length-1].text = (cleanWords[cleanWords.length-1].text || '') + (w.text || '');
      }
      continue;
    }
    if(!cur.length) continue;
    const span = cur[cur.length-1].end - cur[0].start;
    const last = cur[cur.length-1];
    const endsSentence = PUNCT_END.test(String(last.text || '').trim());
    if(span >= MAX_DUR || (endsSentence && span >= MIN_DUR)){
      segments.push({
        t: +cur[0].start.toFixed(2),
        d: +(cur[cur.length-1].end - cur[0].start).toFixed(2),
        text: cur.map(x => String(x.text || '').trim()).filter(Boolean).join(' ').replace(/\s+([.,!?;:])/g, '$1').trim()
      });
      cur = [];
    }
  }
  if(cur.length){
    segments.push({
      t: +cur[0].start.toFixed(2),
      d: +(cur[cur.length-1].end - cur[0].start).toFixed(2),
      text: cur.map(x => String(x.text || '').trim()).filter(Boolean).join(' ').replace(/\s+([.,!?;:])/g, '$1').trim()
    });
  }
  return { text: fullText || segments.map(s => s.text).join(' '), segments, words: cleanWords };
};

// x114b: Server-side thumbnail render via hyperframes-renderer's satori
// /thumbnail endpoint. Faster + cleaner than the Pollinations-image-gen
// path (which garbles text). Returns a Blob on success, null on failure
// (caller falls back to Pollinations).
const renderThumbnailViaHyperFrames = async (thumb) => {
  const hfBase = getHyperframesPath();
  if (!hfBase || !thumb || !thumb.headline) return null;
  try {
    const palette = String(thumb.palette || thumb.background || '#0a0a0a').slice(0, 32);
    // Pick an accent color — prefer thumb.accent, fall back to a neon pink that pops on dark.
    const accent = String(thumb.accent || '#ff3366').slice(0, 32);
    const subhead = String(thumb.subject || thumb.handle || '').slice(0, 60);
    const res = await fetch(hfBase.replace(/\/$/, '') + '/thumbnail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headline: String(thumb.headline).slice(0, 60),
        subhead, palette, accent
      })
    });
    if (!res.ok) {
      console.warn('[zs] hyperframes thumbnail HTTP', res.status);
      return null;
    }
    const blob = await res.blob();
    return blob && blob.size > 0 ? blob : null;
  } catch (e) {
    console.warn('[zs] hyperframes thumbnail failed:', e);
    return null;
  }
};

// x111c: Run silero-vad on the upload audio (via audio-ai sidecar) to get
// speech-presence intervals. snapClipBoundaries uses these to trim leading/
// trailing dead air after the sentence-end snap. Returns [] on failure.
const fetchVadIntervals = async (audioAiBase, blob) => {
  if (!audioAiBase || !blob) return [];
  try {
    const form = new FormData();
    form.append('file', blob, 'upload.mp4');
    form.append('threshold', '0.5');
    form.append('min_silence_ms', '300');
    const res = await fetch(audioAiBase.replace(/\/$/, '') + '/vad', { method: 'POST', body: form });
    if (!res.ok) {
      console.warn('[zs] audio-ai vad HTTP', res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data.intervals) ? data.intervals : [];
  } catch (e) {
    console.warn('[zs] audio-ai vad failed:', e);
    return [];
  }
};

// x110b: Pass a finished clip MP4 through the HyperFrames render service and
// get back a styled 9:16 (title, animated captions, lower-third). Returns the
// styled blob on success, or null if the service is unavailable / fails. The
// caller should fall back to the original blob on null.
const renderViaHyperFrames = async (hfBase, clipBlob, clip, project) => {
  if (!hfBase || !clipBlob) return null;
  try {
    const buf = await clipBlob.arrayBuffer();
    // FileReader → base64 avoids stack-overflow from String.fromCharCode.apply on large blobs.
    const b64 = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const result = String(fr.result || '');
        const idx = result.indexOf(',');
        resolve(idx >= 0 ? result.slice(idx + 1) : result);
      };
      fr.onerror = () => reject(fr.error || new Error('FileReader failed'));
      fr.readAsDataURL(new Blob([buf], { type: clipBlob.type || 'video/mp4' }));
    });
    const clipStart = Number(clip.start || 0);
    const clipEnd = Number(clip.end || (clipStart + (clip.duration || 0)));
    const duration = Math.max(0.5, clipEnd - clipStart);
    const allWords = Array.isArray(project.transcriptWords) ? project.transcriptWords : [];
    const word_timings = allWords
      .filter(w => Number(w.end) > clipStart && Number(w.start) < clipEnd)
      .map(w => ({
        text: String(w.text || '').trim(),
        start: Math.max(0, Number(w.start) - clipStart),
        end: Math.min(duration, Number(w.end) - clipStart)
      }))
      .filter(w => w.text && w.end > w.start);
    const handle = '@' + (project.handle || 'zaidsaid').replace(/^@/, '');
    const payload = {
      clip_b64: b64,
      duration,
      title: String(clip.title || project.name || '').slice(0, 80),
      handle,
      word_timings,
      style: clip.hfStyle || 'clip-9x16'
    };
    const url = hfBase.replace(/\/$/, '') + '/render';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn('[zs] hyperframes render HTTP', res.status, detail.slice(0, 200));
      return null;
    }
    const styled = await res.blob();
    return styled && styled.size > 0 ? styled : null;
  } catch(e) {
    console.warn('[zs] hyperframes render failed, using raw clip:', e);
    return null;
  }
};

// x97: Fetch visual highlights from Gemini 2.5 Flash via worker /gemini-video-highlights.
// audioBlob: the MP3 we already extracted (avoids re-extracting video).
// Returns [{t, d, reason, mood}] or [] on failure/key-absent.
const fetchGeminiHighlights = async (workerBase, audioBlob, targetCount) => {
  try {
    const form = new FormData();
    form.append('file', audioBlob, 'audio.mp3');
    form.append('targetCount', String(targetCount || 10));
    const res = await fetch(workerBase.replace(/\/$/, '') + '/gemini-video-highlights', { method: 'POST', body: form });
    if(!res.ok) return [];
    const data = await res.json();
    if(data.disabled) return [];
    return Array.isArray(data.highlights) ? data.highlights : [];
  } catch(e){
    console.warn('[zs] fetchGeminiHighlights failed', e);
    return [];
  }
};

// x97: Fetch audio events (laughter, applause) via /sensevoice worker route.
// Uploads the MP3 as a data URL to avoid CORS issues with Replicate polling.
// Returns [{t, d, label}] or [] on failure/key-absent.
const fetchSenseVoiceEvents = async (workerBase, audioBlob) => {
  try {
    // Convert blob to data URL so Replicate can fetch it
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(audioBlob);
    });
    const res = await fetch(workerBase.replace(/\/$/, '') + '/sensevoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: dataUrl })
    });
    if(!res.ok) return [];
    const data = await res.json();
    if(data.disabled) return [];
    return Array.isArray(data.events) ? data.events : [];
  } catch(e){
    console.warn('[zs] fetchSenseVoiceEvents failed', e);
    return [];
  }
};

// x81: Two-stage viral detection. Stage 1: local pre-filter top 3N+5 candidates with ±2 neighbor context.
// Stage 2: send candidate windows to Claude for final pick + exact timestamps.
// x84: accepts optional chapters [{t,title}] and audioMap for Phase B signals.
// x98: accepts optional signals {audioEvents, scenes, visualHighlights, trendingMatches} for Phase C/D.
// Falls through to text-only path if no segments.
const analyzeViaClaudeTwoStage = async (proxyUrl, sourceText, targetCount, segments, meta, chapters, audioMap, signals) => {
  const hasSegments = Array.isArray(segments) && segments.length > 0;
  if(!hasSegments) return analyzeViaClaude(proxyUrl, sourceText, targetCount, [], meta, chapters, audioMap, signals);
  const n = Math.max(1, Math.min(20, Number(targetCount)||10));
  const candidateCount = 3 * n + 5;

  // Stage 1: score every segment individually, take top candidateCount + ±2 neighbor context
  const scored = segments.map((seg, idx) => {
    const sc = scoreSegmentViral(seg.text || '', seg.d || 5);
    return { idx, seg, ...sc };
  });
  scored.sort((a, b) => b.virality - a.virality);
  const topIdxSet = new Set(scored.slice(0, candidateCount).map(r => r.idx));
  // Expand to include ±2 neighbors for topic-boundary context
  const expandedSet = new Set();
  for(const idx of topIdxSet){
    for(let d = -2; d <= 2; d++){
      const ni = idx + d;
      if(ni >= 0 && ni < segments.length) expandedSet.add(ni);
    }
  }
  // Build ordered candidate list
  const candidateIdxs = Array.from(expandedSet).sort((a, b) => a - b);
  const candidateSegs = candidateIdxs.map(i => segments[i]);

  return analyzeViaClaude(proxyUrl, sourceText, targetCount, candidateSegs, meta, chapters, audioMap, signals);
};

// x107: Clipping precision pass — single Claude call, no tool-use loop.
// clips: output of analyzeViaClaudeTwoStage (already snapped).
// ctx: { signals, audioMap, trendingMatches, segments, chapters, videoTitle, videoAuthor, durationSec }
// Returns: Array<{ id, precisionScore, verdict, evidence }> — parallel to clips, keyed by id.
// Caller merges into clip objects. Does NOT mutate input clips.
const runClippingPrecisionPass = async (proxyUrl, clips, ctx) => {
  if (!proxyUrl || !Array.isArray(clips) || clips.length === 0) return [];
  try {
    const signals = (ctx && ctx.signals) || {};
    const audioMap = (ctx && ctx.audioMap) || {};
    const trendingMatches = (ctx && Array.isArray(ctx.trendingMatches)) ? ctx.trendingMatches : [];
    const durationSec = Number((ctx && ctx.durationSec) || 0);
    const videoTitle = String((ctx && ctx.videoTitle) || "").trim();
    const videoAuthor = String((ctx && ctx.videoAuthor) || "").trim();

    // Cap to top-15 by virality
    const topClips = clips.slice().sort((a, b) => (b.virality || 0) - (a.virality || 0)).slice(0, 15);

    // Build compact user message — no transcript text, only hooks + signals
    const clipsBlock = topClips.map((c, i) => {
      const idx = i + 1;
      return "[c" + idx + "] " + (+c.start.toFixed(1)) + "-" + (+c.end.toFixed(1)) +
        " | hook=\"" + String(c.hook || "").slice(0, 80).replace(/"/g, "'") + "\"" +
        " | prePass=" + (c.virality || 0) +
        " | preset=" + (c.preset || "vertical") +
        " | id=" + (c.id || ("c" + idx));
    }).join("\n");

    // scene_cuts — cap 60
    const scenes = Array.isArray(signals.scenes) ? signals.scenes.slice(0, 60) : [];
    const sceneLine = scenes.length ? "scene_cuts: [" + scenes.map(s => (+s.t.toFixed(1))).join(", ") + "]" : "";

    // audio_events — cap 40
    const audioEvents = Array.isArray(signals.audioEvents) ? signals.audioEvents.slice(0, 40) : [];
    const audioLine = audioEvents.length
      ? "audio_events: [" + audioEvents.map(e => String(e.label || "event") + "@" + (+e.t.toFixed(1)) + ":" + (+(e.d || 1).toFixed(1))).join(", ") + "]"
      : "";

    // visual_highlights — cap 30
    const vh = Array.isArray(signals.visualHighlights) ? signals.visualHighlights.slice(0, 30) : [];
    const vhLine = vh.length
      ? "visual_highlights: [" + vh.map(h => String(h.mood || h.reason || "highlight") + "@" + (+h.t.toFixed(1)) + ":" + (+(h.d || 1).toFixed(1))).join(", ") + "]"
      : "";

    // audio_peaks — cap 30
    const peaks = Array.isArray(audioMap.peaks) ? audioMap.peaks.slice(0, 30) : [];
    const peaksLine = peaks.length ? "audio_peaks: [" + peaks.map(p => (+p.toFixed(1))).join(", ") + "]" : "";

    // trending — cap 20 entries
    const trendEntries = trendingMatches.slice(0, 20).map(m => {
      const sources = (m.matches || []).slice(0, 3).map(x => x.source);
      const srcCounts = {};
      for (const s of sources) srcCounts[s] = (srcCounts[s] || 0) + 1;
      const srcStr = Object.entries(srcCounts).map(([s, n]) => s + (n > 1 ? "×" + n : "")).join("×");
      return m.keyword + "×" + srcStr;
    });
    const trendLine = trendEntries.length ? "TRENDING (now): [" + trendEntries.join(", ") + "]" : "";

    const signalsBlock = [sceneLine, audioLine, vhLine, peaksLine].filter(Boolean).join("\n");

    const titleLine = videoTitle
      ? "VIDEO: \"" + videoTitle + "\"" + (videoAuthor ? " by " + videoAuthor : "") + (durationSec ? " · " + durationSec + "s" : "")
      : (durationSec ? "VIDEO: " + durationSec + "s" : "");

    const userMsg = [
      titleLine,
      "",
      "CLIPS (top " + topClips.length + " by pre-pass virality):",
      clipsBlock,
      "",
      "SIGNALS:",
      signalsBlock || "(no signals available)",
      "",
      trendLine
    ].filter(s => s !== undefined).join("\n").trim();

    const system = `You are the Clipping Precision sub-agent. Score each candidate clip against the provided multi-modal signals.

Scoring rubric (0-100):
- 70-100 (STRONG): ≥2 signal types align within the clip window AND the hook is on a scene/audio event OR the payoff hits an audio peak. Evidence must cite at least 2 signal types.
- 40-69 (MEDIUM): 1 signal type aligns, OR pre-pass virality ≥70 with weak signal alignment.
- 0-39 (WEAK): no signal alignment, ungrounded hook, or heavy overlap with a higher-scoring sibling.

Evidence format — one line per cited signal:
{type: "scene_cut"|"audio_event"|"visual_highlight"|"audio_peak"|"trending", t: number, note?: string}
No quotes. No prose. t rounded to 0.1s.

Hard rules:
- Batch. ONE call to emit_refined_clips with ALL clips. Do not loop.
- No narration. No text before the tool call.
- Evidence array: 2-5 items per clip. Most relevant first. Each item must reference a real signal from the SIGNALS block.
- If two clips overlap >60% in time, keep the higher-scoring one; mark the other WEAK with verdict explaining the overlap.`;

    const tool = {
      name: "emit_refined_clips",
      description: "Emit precision-scored refinements for all candidate clips at once.",
      input_schema: {
        type: "object",
        properties: {
          clips: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                precisionScore: { type: "number", minimum: 0, maximum: 100 },
                verdict: { type: "string", enum: ["strong", "medium", "weak"] },
                evidence: {
                  type: "array",
                  minItems: 0,
                  maxItems: 5,
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["scene_cut", "audio_event", "visual_highlight", "audio_peak", "trending", "hook"] },
                      t: { type: "number" },
                      note: { type: "string", description: "≤60 chars. Optional." }
                    },
                    required: ["type", "t"]
                  }
                }
              },
              required: ["id", "precisionScore", "verdict", "evidence"]
            }
          }
        },
        required: ["clips"]
      }
    };

    const url = (proxyUrl || "").replace(/\/$/, "") + "/v1/messages";
    const body = {
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: "emit_refined_clips" },
      messages: [{ role: "user", content: userMsg }]
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.warn("[zs] runClippingPrecisionPass HTTP " + res.status);
      return [];
    }
    const j = await res.json();
    const tu = Array.isArray(j.content) ? j.content.find(b => b.type === "tool_use" && b.name === "emit_refined_clips") : null;
    if (!tu || !tu.input || !Array.isArray(tu.input.clips)) return [];
    return tu.input.clips.map(r => ({
      id: String(r.id || ""),
      precisionScore: Math.max(0, Math.min(100, Number(r.precisionScore) || 0)),
      verdict: ["strong", "medium", "weak"].includes(r.verdict) ? r.verdict : "medium",
      evidence: Array.isArray(r.evidence) ? r.evidence.slice(0, 5).map(e => ({
        type: String(e.type || "hook"),
        t: +(Number(e.t) || 0).toFixed(1),
        note: e.note ? String(e.note).slice(0, 60) : undefined
      })) : []
    }));
  } catch (e) {
    console.warn("[zs] runClippingPrecisionPass failed", e);
    return [];
  }
};

// Phase D: Extract 3-8 searchable topic keywords from transcript via Claude tool_use
const extractTopicKeywords = async (proxyUrl, text, onStatus) => {
  if (!proxyUrl) return [];
  try {
    if (onStatus) onStatus("Extracting topic keywords…");
    const tools = [{
      name: "emit_topics",
      description: "Emit 3-8 specific, searchable topic keywords from the transcript.",
      input_schema: {
        type: "object",
        properties: {
          keywords: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 }
        },
        required: ["keywords"]
      }
    }];
    // Prefer the middle 6000 chars — usually the densest content
    let chunk = String(text || "");
    if (chunk.length > 6000) {
      const mid = Math.floor(chunk.length / 2);
      chunk = chunk.slice(Math.max(0, mid - 3000), mid + 3000);
    }
    const sys = "Extract 3-8 specific, searchable topic keywords from this transcript (not generic terms like 'productivity' — prefer specific names, products, events, companies, people). Output via emit_topics.";
    const j = await mvpCallClaude(proxyUrl, [{ role: "user", content: chunk }], {
      system: sys, tools, tool_choice: { type: "tool", name: "emit_topics" }, max_tokens: 256
    });
    const tu = (j.content || []).find(b => b.type === "tool_use" && b.name === "emit_topics");
    if (!tu || !tu.input || !Array.isArray(tu.input.keywords)) return [];
    return tu.input.keywords.slice(0, 8).map(k => String(k).trim()).filter(Boolean);
  } catch (e) {
    console.warn("[zs] extractTopicKeywords failed", e);
    return [];
  }
};

// Phase D: Fetch trending context for a list of keywords across all four sources
const fetchTrendingContext = async (base, keywords) => {
  if (!Array.isArray(keywords) || !keywords.length) return [];
  const workerBase = (base || "").replace(/\/anthropic\/?$/, "");
  const results = [];
  // Fan out: for each keyword query all four sources in parallel
  await Promise.all(keywords.map(async (kw) => {
    const encoded = encodeURIComponent(kw);
    const [gRes, rRes, hnRes, xRes] = await Promise.allSettled([
      fetch(workerBase + "/trends/google?q=" + encoded).then(r => r.json()).catch(() => ({ results: [] })),
      fetch(workerBase + "/trends/reddit?q=" + encoded).then(r => r.json()).catch(() => ({ results: [] })),
      fetch(workerBase + "/trends/hn?q=" + encoded).then(r => r.json()).catch(() => ({ results: [] })),
      fetch(workerBase + "/trends/x?q=" + encoded).then(r => r.json()).catch(() => ({ results: [] }))
    ]);
    const allMatches = [];
    for (const settled of [gRes, rRes, hnRes, xRes]) {
      const data = settled.status === "fulfilled" ? settled.value : { results: [] };
      if (data.disabled) continue;
      const hits = Array.isArray(data.results) ? data.results : [];
      for (const hit of hits) {
        allMatches.push({
          source: hit.source || "unknown",
          title: String(hit.title || ""),
          rank: Number(hit.rank || hit.volume || 0),
          url: String(hit.url || "")
        });
      }
    }
    if (allMatches.length) {
      results.push({ keyword: kw, matches: allMatches.slice(0, 5) });
    }
  }));
  // Cap total matches at 40
  let total = 0;
  return results.filter(r => {
    const count = r.matches.length;
    if (total + count > 40) {
      r.matches = r.matches.slice(0, Math.max(0, 40 - total));
    }
    total += r.matches.length;
    return r.matches.length > 0;
  });
};

// x100: YouTube metadata generator — pulls clip hook/caption + transcript excerpt + live
// trending context and asks Claude to write a ready-to-publish title / description /
// hashtags / SEO tags bundle tuned for the target format (shorts vs long).
const generateYouTubeMetadataViaClaude = async (proxyUrl, clip, project, format) => {
  if(!proxyUrl) throw new Error("no anthropic proxy configured");
  const fmt = (format === "long" || format === "youtube") ? "long" : "shorts";
  const workerBase = proxyUrl.replace(/\/anthropic\/?$/, "");
  // Step 1: keywords + trending context (best effort; OK if trending fetches 404).
  let trending = [];
  try {
    const kws = await extractTopicKeywords(proxyUrl, project.transcriptText || "", null);
    if(kws && kws.length) trending = await fetchTrendingContext(workerBase, kws);
  } catch(e) { console.warn("[zs] trend fetch failed for YT metadata", e); }
  const trendingSummary = (trending || []).slice(0, 6).flatMap(r => (r.matches || []).slice(0,2).map(m => m.source + ": " + (m.title||'').slice(0,80))).slice(0, 10).join(" | ") || "none available";
  // Step 2: build a tight transcript excerpt centered on the clip.
  const segs = Array.isArray(project.transcriptSegments) ? project.transcriptSegments : [];
  let excerpt = "";
  if(segs.length){
    const window = segs.filter(s => s.t >= (clip.start || 0) - 8 && s.t <= (clip.end || 0) + 8);
    excerpt = window.map(s => s.text).join(" ").slice(0, 1200);
  } else if(project.transcriptText){
    excerpt = project.transcriptText.slice(0, 1200);
  }
  const durSec = Math.max(1, Math.round((clip.end || 0) - (clip.start || 0)));
  const tool = {
    name: "emit_youtube_metadata",
    description: "Generate YouTube metadata bundle tuned for " + fmt + " distribution.",
    input_schema: {
      type: "object",
      properties: {
        titleVariants: {
          type: "array",
          description: "Exactly 5 title options in priority order, each using a DIFFERENT hook pattern (pick from: Contrarian Take, Shocking Statistic, Direct Promise, Question Hook, Before/After, Mistake Callout, Bold Claim, Expert Secret, Pattern Interrupt, Time-Bound Challenge). Under 70 chars each for Shorts, under 100 for long. At most ONE emoji per title (placed at the end), and never in more than 2 of the 5 options. Never use ALL CAPS. Never generic intros like 'In this video'.",
          items: { type: "string" },
          minItems: 5,
          maxItems: 5
        },
        title: { type: "string", description: "Your single top pick from titleVariants — the one you'd ship first." },
        description: { type: "string", description: "First line = one-sentence hook that earns the click. Then 2-3 short paragraphs: what the clip shows, why it still matters right now, and a credit line for the original source. DO NOT include hashtags here — they go in the hashtags array." },
        hashtags: { type: "array", items: { type: "string" }, description: "12-15 hashtags in priority order (specific → broad). No leading #. Include at least one very-broad tag (AI, tech) and at least one very-specific tag tied to the clip subject. Include 'Shorts' if format is shorts." },
        tags: { type: "array", items: { type: "string" }, description: "8-12 longer SEO tags for YouTube's backend tag field (comma-separated when pasted). These are search phrases viewers type, distinct from hashtags." },
        thumbnail: {
          type: "object",
          description: "Full thumbnail composition brief, designed for a 2026 high-CTR Shorts thumbnail (one emotional face + 2-3 word overlay + high contrast + brand color accent).",
          properties: {
            headline: { type: "string", description: "2-3 WORDS MAX — the overlay headline users will see. Bold, specific, tied to the clip's core number/claim/shock. Examples: '1 IN 10,000', 'MOVE 37', 'GAME OVER', '2,500 YEARS'." },
            subject: { type: "string", description: "Describe the single foreground subject: who/what, expression, pose, lighting. Prefer a human face with strong single emotion (shocked, wide-eyed, determined). If no face fits, describe an iconic object at extreme close-up." },
            background: { type: "string", description: "Describe the background scene/setting: what's shown, how darkened, what accents glow. Leave a visual space for the headline overlay." },
            palette: { type: "string", description: "3 hex colors max, comma separated. Include a saturated neon accent (#ef4444, #22d3ee, #facc15, etc.) + a deep dark (#000 or #050814) + the headline text color (usually #fff)." },
            imagePrompt: { type: "string", description: "A ~350-500 character image-generation prompt for Pollinations/Midjourney. MUST say 'no text, no watermarks, no logos' because clean text is composited on top via canvas after. Include lighting, lens feel, mood, aspect-ratio hint (portrait for Shorts). Do NOT include the headline text in this prompt." },
            reasoning: { type: "string", description: "One sentence explaining why this composition grabs attention in a feed (what it triggers — curiosity, shock, question)." }
          },
          required: ["headline", "subject", "background", "palette", "imagePrompt", "reasoning"]
        }
      },
      required: ["titleVariants", "title", "description", "hashtags", "tags", "thumbnail"]
    }
  };
  const system = "You write YouTube metadata that wins discovery and CTR without lying. You optimize for the specific clip provided — you never produce generic template copy. Base every claim on the clip hook/caption/transcript; if trending context overlaps the topic, weave it in naturally.\n\n" +
    "HOOK PATTERNS you draw from (each titleVariants[] entry must use a DIFFERENT pattern):\n" +
    "- Contrarian Take: 'Everything you know about X is wrong'\n" +
    "- Shocking Statistic: '97% of X make this mistake' / 'This X had a 1-in-10,000 chance'\n" +
    "- Direct Promise: '3 ways to X in Y'\n" +
    "- Question Hook: 'Want to know how I X?' / 'Why did X really happen?'\n" +
    "- Before/After Tease: 'From X to Y — here's what changed'\n" +
    "- Mistake Callout: 'Stop doing THIS'\n" +
    "- Bold Claim: 'I can X in Y' / 'X ended 2,500 years of Y'\n" +
    "- Expert Secret: 'What X doesn't tell you'\n" +
    "- Pattern Interrupt: unusual construction that breaks feed rhythm\n" +
    "- Time-Bound Challenge: 'Can I X in 60 seconds?'\n\n" +
    "THUMBNAIL RULES (2026 Shorts best practice):\n" +
    "- One human face with a single strong emotion OR one iconic object at extreme close-up. Never both a face and a busy scene — the feed is too small.\n" +
    "- 2-3 word overlay, bold sans-serif, composed by the app later. You only provide the WORDS (thumbnail.headline), not the text rendering.\n" +
    "- High contrast: deep dark background + one neon accent color (MrBeast red #FF0000, electric blue #228fda, or lemon yellow #FFFF00 are proven).\n" +
    "- imagePrompt MUST say 'no text, no watermarks, no logos' — we add clean text via canvas overlay afterward, because diffusion models render text garbled.\n\n" +
    "Return via emit_youtube_metadata only.";
  const userMsg = [
    "Target format: YouTube " + (fmt === "shorts" ? "Shorts (vertical, <60s)" : "long-form (horizontal)"),
    "Clip duration: " + durSec + "s",
    "Source video: " + (project.name || "unknown") + (project.author ? " — by " + project.author : ""),
    "Clip title (working): " + (clip.title || "—"),
    "Hook (first 3s spoken): " + (clip.hook || "—"),
    "Caption: " + (clip.caption || "—"),
    "Virality score (0-100): " + (clip.virality || 0),
    "Live trending overlap (now): " + trendingSummary,
    "",
    "Transcript around the clip:",
    excerpt || "(no transcript available)"
  ].join("\n");
  const res = await fetch(proxyUrl.replace(/\/$/, "") + "/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: "emit_youtube_metadata" },
      messages: [{ role: "user", content: userMsg }]
    })
  });
  if(!res.ok) throw new Error("claude " + res.status);
  const data = await res.json();
  const block = (data.content || []).find(c => c.type === "tool_use" && c.name === "emit_youtube_metadata");
  if(!block || !block.input) throw new Error("no emit_youtube_metadata tool_use");
  const m = block.input;
  const variants = Array.isArray(m.titleVariants) ? m.titleVariants.map(v => String(v).slice(0, 100)).filter(Boolean) : [];
  const thumb = m.thumbnail && typeof m.thumbnail === "object" ? {
    headline: String(m.thumbnail.headline || "").slice(0, 40),
    subject: String(m.thumbnail.subject || "").slice(0, 500),
    background: String(m.thumbnail.background || "").slice(0, 500),
    palette: String(m.thumbnail.palette || "").slice(0, 120),
    imagePrompt: String(m.thumbnail.imagePrompt || "").slice(0, 800),
    reasoning: String(m.thumbnail.reasoning || "").slice(0, 300)
  } : null;
  return {
    title: String(m.title || variants[0] || "").slice(0, 100),
    titleVariants: variants.slice(0, 5),
    description: String(m.description || "").slice(0, 4800),
    hashtags: Array.isArray(m.hashtags) ? m.hashtags.map(h => String(h).replace(/^#/, "").trim()).filter(Boolean).slice(0, 15) : [],
    tags: Array.isArray(m.tags) ? m.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 12) : [],
    thumbnail: thumb,
    // Legacy field kept so older UI paths don't break.
    thumbnailIdea: thumb ? (thumb.subject + " — " + thumb.background).slice(0, 240) : "",
    trendingUsed: trending.length
  };
};

// x102: Render a Shorts thumbnail at 1080x1920. Pollinations generates the base scene
// (face + background) — it's notoriously bad at text, so we overlay the clean headline
// via OffscreenCanvas after. Returns a JPEG blob.
const renderThumbnailFromBrief = async (brief) => {
  if(!brief || !brief.imagePrompt) throw new Error("no imagePrompt in brief");
  const cleanPrompt = brief.imagePrompt + " — no text, no watermarks, no logos, portrait 9:16";
  const url = "https://image.pollinations.ai/prompt/" + encodeURIComponent(cleanPrompt) + "?width=1080&height=1920&nologo=true&enhance=true&seed=" + (Math.floor(Math.random() * 9999));
  const res = await fetch(url);
  if(!res.ok) throw new Error("pollinations " + res.status);
  const blob = await res.blob();
  const bmp = await createImageBitmap(blob);
  const canvas = (typeof OffscreenCanvas !== "undefined") ? new OffscreenCanvas(1080, 1920) : (() => { const c = document.createElement("canvas"); c.width = 1080; c.height = 1920; return c; })();
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0, 1080, 1920);
  // Darken a horizontal band in the center-ish for text contrast.
  const grad = ctx.createLinearGradient(0, 860, 0, 1340);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.5, "rgba(0,0,0,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 860, 1080, 480);
  // Parse palette — first hex is the accent; fallback red.
  const hexes = String(brief.palette || "").match(/#[0-9a-fA-F]{3,6}/g) || [];
  const accent = hexes.find(h => !/^#(fff|ffffff|000|000000)$/i.test(h)) || "#ef4444";
  const headline = String(brief.headline || "").toUpperCase().slice(0, 24) || "HOOK";
  // Headline: bold impact font, black outline, white fill, underline accent.
  const fontSize = headline.length <= 8 ? 210 : headline.length <= 14 ? 170 : 130;
  ctx.font = "bold " + fontSize + "px Impact, Haettenschweiler, 'Arial Black', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.round(fontSize / 10);
  ctx.strokeText(headline, 540, 1080);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(headline, 540, 1080);
  // Accent bar under headline.
  const barW = Math.min(700, fontSize * 3);
  ctx.fillStyle = accent;
  ctx.fillRect((1080 - barW) / 2, 1080 + fontSize * 0.55, barW, Math.max(8, fontSize / 20));
  // Return blob.
  if(canvas.convertToBlob){
    return await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
  }
  return await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.92));
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

function StepResearch({ project, setProject, setStudioStep }){
  const toast = useToast();
  const regenClaim = (id) => { const variations = [ "Tighter framing of the same evidence.", "Cross-referenced a second source.", "Narrowed the scope to keep it on-topic.", "Restated as a hook-friendly claim.", ]; setProject({ ...project, research: project.research.map(r => r.id===id ? { ...r, claim: (r.claim + " — " + variations[Math.floor(Math.random()*variations.length)]).slice(0,180), confidence: Math.min(0.99, (r.confidence||0.8) + 0.01) } : r), }); };
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchSource, setResearchSource] = useState("");
  const [researchError, setResearchError] = useState("");
  const [researchLog, setResearchLog] = useState([]);
  const appendLog = (msg) => setResearchLog(prev => [...prev, msg]);

  const runResearch = async () => {
    if (researchBusy) return;
    let text = String((project && project.source) || "").trim();
    if (isYouTubeUrl(text)) {
      try {
        const yt = await fetchYouTubeTranscript(text);
        const tText = String((yt && yt.transcript) || "").trim();
        if (tText.length > 50) {
          text = (yt.title ? ("Title: " + yt.title + "\n") : "") + (yt.author ? ("Channel: " + yt.author + "\n") : "") + "Transcript:\n" + tText;
        }
      } catch(err) {
        console.warn("[zs] transcript fetch failed — proceeding with URL as source:", err && err.message || err);
      }
    }
    if (!text) { setResearchError("Paste or fetch source text first"); return; }
    setResearchBusy(true); setResearchSource(""); setResearchError(""); setResearchLog([]);
    const path = getAnthropicPath();
    try {
      if (path) {
        const onStatus = (msg) => appendLog(msg);
        const result = await runResearchSubAgent(path, { ...project, source: text }, onStatus);
        const claims = result.claims || [];
        const trendingRaw = result._trendingRaw || [];
        setProject({
          ...project,
          source: text,
          research: claims,
          _researchTrending: trendingRaw,
          logline: result.logline || project.logline || "",
          hook: result.hook || project.hook || "",
          audience: result.audience || project.audience || "",
          angle: result.angle || project.angle || "",
          cta: result.cta || project.cta || ""
        });
        setResearchSource("claude");
        const trendingUsed = result.trendingUsed || 0;
        appendLog("Done — " + claims.length + " claims, " + trendingUsed + " trending signals folded in.");
        toast.push("Research complete — " + claims.length + " claims via Claude Sonnet", "success");
      } else {
        const notes = researchLocal(text);
        const rawClaims = (notes && notes.claims) || [];
        const claims = rawClaims.map((c, i) => ({
          id: "r" + (i+1) + "_" + Math.random().toString(36).slice(2,6),
          claim: String((c && c.claim) || "").slice(0, 240),
          source: String((c && c.source) || "Source pending").slice(0, 140),
          confidence: Math.max(0.5, Math.min(0.99, Number(c && c.confidence) || 0.75)),
          keyword: ""
        }));
        setProject({ ...project, research: claims });
        setResearchSource("local");
        appendLog("Local fallback — " + claims.length + " claims extracted from source text.");
        toast.push("Research complete (local — configure Anthropic proxy for Claude)", "info");
      }
    } catch (err) {
      console.error("[zs] runResearch error:", err);
      setResearchError(String(err && err.message || err));
      try {
        const notes = researchLocal(text);
        const rawClaims = (notes && notes.claims) || [];
        const claims = rawClaims.map((c, i) => ({
          id: "r" + (i+1) + "_" + Math.random().toString(36).slice(2,6),
          claim: String((c && c.claim) || "").slice(0, 240),
          source: String((c && c.source) || "Source pending").slice(0, 140),
          confidence: Math.max(0.5, Math.min(0.99, Number(c && c.confidence) || 0.75)),
          keyword: ""
        }));
        setProject({ ...project, research: claims });
        setResearchSource("local");
        appendLog("Fell back to local extraction — " + claims.length + " claims.");
        toast.push("Cloud error — used local fallback", "warn");
      } catch(_) {}
    } finally {
      setResearchBusy(false);
    }
  };

  const addClaim = () => { const nid = "r" + (project.research.length + 1) + "_" + Math.random().toString(36).slice(2,6); setProject({ ...project, research: [...project.research, { id: nid, claim:"New claim — edit me.", source:"Pending source", confidence: 0.7, keyword: "" }], }); };
  const advanceToScript = () => { if (setStudioStep) setStudioStep("script"); };
  const updateBrief = (field, value) => { setProject({ ...project, [field]: value }); };
  const copyBrief = () => { const parts = [ project.logline && ("Logline: " + project.logline), project.hook && ("Hook: " + project.hook), project.audience && ("Audience: " + project.audience), project.angle && ("Angle: " + project.angle), project.cta && ("CTA: " + project.cta), ].filter(Boolean).join("\n"); if (!parts){ toast.push("Nothing to copy yet","warn"); return; } try { navigator.clipboard.writeText(parts); toast.push("Brief copied to clipboard","success"); } catch(_){ toast.push("Copy failed — select manually","error"); } };

  return ( <div className="flex flex-col gap-4">
    <StudioInputAccepter project={project} setProject={setProject} onAdvance={advanceToScript} toast={toast} />
    <StudioPipelineSimulator project={project} setProject={setProject} />
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Creative brief</div>
          <div className="text-lg font-semibold">Logline, hook & angle</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={copyBrief}>{I.copy({size:14})} Copy</button>
        </div>
      </div>
      <div className="mt-3 grid md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1"> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Logline</span> <textarea className="w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm" rows={2} value={project.logline||""} onChange={(e)=>updateBrief("logline", e.target.value)} placeholder="A one-sentence promise of the video." /> </label>
        <label className="flex flex-col gap-1"> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Hook</span> <textarea className="w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm" rows={2} value={project.hook||""} onChange={(e)=>updateBrief("hook", e.target.value)} placeholder="First three seconds pattern interrupt." /> </label>
        <label className="flex flex-col gap-1"> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Audience</span> <textarea className="w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm" rows={2} value={project.audience||""} onChange={(e)=>updateBrief("audience", e.target.value)} placeholder="Who this is for." /> </label>
        <label className="flex flex-col gap-1"> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Angle</span> <textarea className="w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm" rows={2} value={project.angle||""} onChange={(e)=>updateBrief("angle", e.target.value)} placeholder="Why this POV, right now." /> </label>
        <label className="flex flex-col gap-1 md:col-span-2"> <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Call to action</span> <input className="w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm" value={project.cta||""} onChange={(e)=>updateBrief("cta", e.target.value)} placeholder="What the viewer should do next." /> </label>
      </div>
    </div>
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Research</div>
          <div className="text-lg font-semibold">Claims & sources</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn" onClick={runResearch} disabled={researchBusy || !(project.source||"").trim()}>{researchBusy ? "Researching…" : "Research with Claude"}</button>
          {researchSource && (<span className={"chip " + (researchSource === "claude" ? "text-emerald-200 !border-emerald-400/30 bg-emerald-500/10" : "text-sky-200 !border-sky-400/30 bg-sky-500/10")}>{researchSource === "claude" ? "Claude Sonnet" : "Local"}</span>)}
          <button className="btn" onClick={addClaim}>{I.plus({size:14})} Add claim</button>
        </div>
      </div>
      {researchLog.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {researchLog.map((msg, i) => (
            <div key={i} className="text-[11px] text-[color:var(--muted)]">{msg}</div>
          ))}
        </div>
      )}
      {researchError && <div className="mt-2 text-[12px] text-rose-300">Error: {researchError}</div>}
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
  </div> );
}

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
    idbDelStudioImage(sceneId).catch(()=>{});
    idbDelStudioAudio(sceneId).catch(()=>{});
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
  const toast = useToast();
  const [imgBusy, setImgBusy] = React.useState(false);
  const [imgErr, setImgErr] = React.useState('');
  const [imgInfo, setImgInfo] = React.useState('');
  const [sceneBlobUrls, setSceneBlobUrls] = React.useState(() => new Map());
  const projectRef = React.useRef(project);
  projectRef.current = project;

  // Hydrate blob URL Map from IDB on mount; clear stale refs
  React.useEffect(() => {
    let cancelled = false;
    const scenes = (project.scenes || []);
    scenes.forEach(async (s) => {
      if (!s.image || !String(s.image).startsWith('idb:')) return;
      try {
        const blob = await idbGetStudioImage(s.id);
        if (cancelled) return;
        if (!blob) {
          setProject(prev => ({ ...prev, scenes: prev.scenes.map(x => x.id === s.id ? { ...x, image: '' } : x) }));
          try { toast('Scene image missing — regenerate', 'error'); } catch(_){}
          return;
        }
        const url = URL.createObjectURL(blob);
        setSceneBlobUrls(prev => { const m = new Map(prev); m.set(s.id, url); return m; });
      } catch(_){}
    });
    return () => { cancelled = true; };
  }, []);

  // Revoke all object URLs on unmount
  React.useEffect(() => {
    return () => {
      setSceneBlobUrls(prev => {
        prev.forEach(url => { try { URL.revokeObjectURL(url); } catch(_){} });
        return new Map();
      });
    };
  }, []);

  React.useEffect(() => {
    if (isGodMode) return;
    if (!imgInfo && !imgBusy) return;
    try { window.dispatchEvent(new CustomEvent('zs:progress', { detail: { message: imgInfo || (imgBusy ? 'Generating images…' : ''), busy: imgBusy } })); } catch(_){}
  }, [imgInfo, imgBusy]);

  const storeSceneImage = async (sceneId, dataUrl) => {
    try {
      const blob = dataUrlToBlob(dataUrl) || await fetch(dataUrl).then(r => r.blob());
      await idbSetStudioImage(sceneId, blob);
      const objUrl = URL.createObjectURL(blob);
      setSceneBlobUrls(prev => {
        const old = prev.get(sceneId);
        if (old) { try { URL.revokeObjectURL(old); } catch(_){} }
        const m = new Map(prev); m.set(sceneId, objUrl); return m;
      });
      return 'idb:' + IDB_STUDIO_SCENE_PREFIX + sceneId;
    } catch(e) {
      console.warn('[zs] storeSceneImage fell back to inline data URL:', e);
      return dataUrl;
    }
  };

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
      const imageRef = await storeSceneImage(sceneId, dataUrl);
      setProject(prev => ({ ...prev, scenes: prev.scenes.map(x => x.id === sceneId ? { ...x, image: imageRef, imageSource: source } : x) }));
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
    const imageRef = await storeSceneImage(sceneId, dataUrl);
    setProject({ ...project, scenes: project.scenes.map(s => s.id === sceneId ? { ...s, image: imageRef, imageSource: source } : s) });
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
            <div className="text-lg font-semibold flex items-center gap-2">Generate scene images{(() => { const total = (project.scenes||[]).length; const done = (project.scenes||[]).filter(s => s.image).length; if(!total) return null; const pct = Math.round((done/total)*100); const allDone = done === total; return (<span className={"text-[11px] font-medium px-2 py-0.5 rounded-full border " + (allDone ? "text-emerald-200 border-emerald-400/30 bg-emerald-500/10" : "text-indigo-200 border-indigo-400/30 bg-indigo-500/10")}>{done} / {total}{allDone ? " · ready" : (imgBusy ? " · " + pct + "%" : "")}</span>); })()}</div>
            <div className="text-[12px] text-[color:var(--muted)] mt-1">Stability AI when configured, deterministic SVG locally otherwise. Uses each scene&apos;s shot prompt.</div>
          </div>
          <button className="btn btn-primary" onClick={generateAllImages} disabled={imgBusy}>{imgBusy ? 'Rendering…' : 'Generate all images'}</button>
        </div>
        {imgErr && <div className="mt-2 text-[12px] text-red-400">{imgErr}</div>}
        {imgInfo && <div className="mt-2 text-[12px] text-emerald-400">{imgInfo}</div>}
        {((project.scenes||[]).some(s => s.image) || imgBusy) && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {(project.scenes||[]).map((s, i) => {
              const previewSrc = sceneBlobUrls.get(s.id) || (s.image && !String(s.image).startsWith('idb:') ? s.image : null);
              return (
              <div key={s.id||i} className="relative rounded-xl overflow-hidden border border-[color:var(--line)]">
                {previewSrc ? <img src={previewSrc} alt={'Scene '+(i+1)} className="w-full h-24 object-cover zs-fade-in" /> : <div className="w-full h-24 shimmer bg-[color:var(--line)] flex items-center justify-center text-[11px] text-[color:var(--muted)]">{imgBusy ? 'rendering…' : 'no image'}</div>}
                {s.image && !imgBusy && (
                  <button
                    type="button"
                    onClick={()=>regenerateImageOne(s.id)}
                    title="Regenerate image"
                    aria-label="Regenerate image"
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 hover:bg-black/85 text-white text-sm leading-none flex items-center justify-center border border-white/10 backdrop-blur-sm transition-colors"
                  >{String.fromCharCode(8635)}</button>
                )}
                <div className="px-2 py-1 text-[11px] text-[color:var(--muted)] truncate">{s.title || ('Scene '+(i+1))}</div>
              </div>
              );
            })}
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
  const toast = useToast();
  const [voiceBusy, setVoiceBusy] = React.useState(false);
  const [voiceErr, setVoiceErr] = React.useState('');
  const [voiceInfo, setVoiceInfo] = React.useState('');
  const [audioBlobUrls, setAudioBlobUrls] = React.useState(() => new Map());
  const projectRef = React.useRef(project);
  projectRef.current = project;

  // Hydrate audio blob URL Map from IDB on mount; clear stale refs
  React.useEffect(() => {
    let cancelled = false;
    const scenes = (project.scenes || []);
    scenes.forEach(async (s) => {
      if (!s.audio || !String(s.audio).startsWith('idb:')) return;
      try {
        const blob = await idbGetStudioAudio(s.id);
        if (cancelled) return;
        if (!blob) {
          setProject(prev => ({ ...prev, scenes: prev.scenes.map(x => x.id === s.id ? { ...x, audio: null, audioSource: '' } : x) }));
          try { toast('Scene audio missing — regenerate', 'error'); } catch(_){}
          return;
        }
        const url = URL.createObjectURL(blob);
        setAudioBlobUrls(prev => { const m = new Map(prev); m.set(s.id, url); return m; });
      } catch(_){}
    });
    return () => { cancelled = true; };
  }, []);

  // Revoke all audio object URLs on unmount
  React.useEffect(() => {
    return () => {
      setAudioBlobUrls(prev => {
        prev.forEach(url => { try { URL.revokeObjectURL(url); } catch(_){} });
        return new Map();
      });
    };
  }, []);

  React.useEffect(() => {
    if (isGodMode) return;
    if (!voiceInfo && !voiceBusy) return;
    try { window.dispatchEvent(new CustomEvent('zs:progress', { detail: { message: voiceInfo || (voiceBusy ? 'Generating voices…' : ''), busy: voiceBusy } })); } catch(_){}
  }, [voiceInfo, voiceBusy]);

  const storeSceneAudio = async (sceneId, dataUrl) => {
    try {
      const blob = dataUrlToBlob(dataUrl) || await fetch(dataUrl).then(r => r.blob());
      await idbSetStudioAudio(sceneId, blob);
      const objUrl = URL.createObjectURL(blob);
      setAudioBlobUrls(prev => {
        const old = prev.get(sceneId);
        if (old) { try { URL.revokeObjectURL(old); } catch(_){} }
        const m = new Map(prev); m.set(sceneId, objUrl); return m;
      });
      return 'idb:' + IDB_STUDIO_SCENE_PREFIX + sceneId + ':audio';
    } catch(e) {
      console.warn('[zs] storeSceneAudio fell back to inline data URL:', e);
      return dataUrl;
    }
  };

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
            const audioRef = await storeSceneAudio(sceneId, dataUrl);
            patch = { audio: audioRef, audioSource: 'elevenlabs' };
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
      const audioRef = await storeSceneAudio(sceneId, dataUrl);
      setProject({ ...project, scenes: project.scenes.map(s => s.id === sceneId ? { ...s, audio: audioRef, audioSource: 'elevenlabs' } : s) });
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
            <div className="text-lg font-semibold flex items-center gap-2">Generate scene audio{(() => { const total = (project.scenes||[]).length; const done = (project.scenes||[]).filter(s => s.audioSource).length; if(!total) return null; const pct = Math.round((done/total)*100); const allDone = done === total; return (<span className={"text-[11px] font-medium px-2 py-0.5 rounded-full border " + (allDone ? "text-emerald-200 border-emerald-400/30 bg-emerald-500/10" : "text-indigo-200 border-indigo-400/30 bg-indigo-500/10")}>{done} / {total}{allDone ? " · ready" : (voiceBusy ? " · " + pct + "%" : "")}</span>); })()}</div>
            <div className="text-[12px] text-[color:var(--muted)] mt-1">ElevenLabs when configured (returns audio data), browser SpeechSynthesis as live-playback fallback.</div>
          </div>
          <button className="btn btn-primary" onClick={generateAllVoices} disabled={voiceBusy}>{voiceBusy ? 'Synthesizing…' : 'Generate all voices'}</button>
        </div>
        {voiceErr && <div className="mt-2 text-[12px] text-red-400">{voiceErr}</div>}
        {voiceInfo && <div className="mt-2 text-[12px] text-emerald-400">{voiceInfo}</div>}
        {(voiceBusy || (project.scenes||[]).some(s => s.audio || s.audioSource)) && (
          <div className="mt-3 grid gap-2">
            {(project.scenes||[]).map((s, i) => {
              const audioSrc = audioBlobUrls.get(s.id) || (s.audio && !String(s.audio).startsWith('idb:') ? s.audio : null);
              return (
              <div key={s.id||i} className={"flex items-center justify-between gap-3 rounded-xl border border-[color:var(--line)] p-2 " + (voiceBusy && !s.audioSource ? 'shimmer' : '')}>
                <div className="min-w-0">
                  <div className="text-sm truncate">{(i+1)+'. '+(s.title||'Scene')}</div>
                  <div className="text-[11px] text-[color:var(--muted)] truncate">{s.audioSource === 'elevenlabs' ? 'ElevenLabs audio' : (s.audioSource === 'local-speech' ? 'Local SpeechSynthesis' : (s.audioSource === 'error' ? ('Error: '+(s.audioError||'')) : (voiceBusy ? 'Generating voice…' : 'No audio yet')))}</div>
                </div>
                {audioSrc ? <audio controls src={audioSrc} className="max-w-[260px] zs-fade-in" /> : <button className="chip" onClick={()=>previewLocalForScene(s)}>{'preview locally'}</button>}
                {s.audioSource && s.audioSource !== 'skipped' && <button type="button" className="shrink-0 w-8 h-8 rounded-full border border-white/15 bg-white/5 hover:bg-white/15 text-white/80 hover:text-white flex items-center justify-center text-base leading-none disabled:opacity-50 disabled:cursor-not-allowed" onClick={()=>regenerateOne(s.id)} disabled={voiceBusy} title="Regenerate voice for this scene" aria-label="Regenerate voice">{String.fromCharCode(8635)}</button>}
              </div>
              );
            })}
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
  const [renderMeta, setRenderMeta] = React.useState({ bytes: 0, durationSec: 0 });
  React.useEffect(() => {
    if(!renderUrl && typeof window !== 'undefined' && window.__zs_lastBlob){
      try {
        setRenderUrl(URL.createObjectURL(window.__zs_lastBlob));
        setRenderMeta({ bytes: window.__zs_lastBlob.size||0, durationSec: Number(window.__zs_lastDurS)||0 });
      } catch(_){}
    }
  }, []);
  const [renderProgress, setRenderProgress] = React.useState(0);
  const readyRef = React.useRef(null);
  const [loglineCopied, setLoglineCopied] = React.useState(false);
  const [renderElapsed, setRenderElapsed] = React.useState(0);
  const [webmFallbackUrl, setWebmFallbackUrl] = React.useState('');
  React.useEffect(() => {
    if (!renderBusy) { setRenderElapsed(0); return; }
    const t0 = Date.now();
    setRenderElapsed(0);
    const iv = setInterval(() => setRenderElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(iv);
  }, [renderBusy]);
  React.useEffect(() => {
    if (isGodMode) return;
    if (!renderBusy && !renderUrl) return;
    const message = renderUrl && !renderBusy
      ? 'Video ready — scroll down to preview & download.'
      : ('Rendering video… ' + Math.max(1, renderProgress) + '%');
    try { window.dispatchEvent(new CustomEvent('zs:progress', { detail: { message, busy: renderBusy } })); } catch(_){}
  }, [renderBusy, renderProgress, renderUrl]);
  React.useEffect(() => {
    if (renderUrl && !renderBusy && readyRef.current) {
      try { readyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(_){}
    }
  }, [renderUrl, renderBusy]);
  const renderRealVideo = async () => {
    if(renderBusy) return;
    const scenes = ((projectRef.current && projectRef.current.scenes) || []).slice();
    if(!scenes.length){ setRenderErr('No scenes to render.'); return; }
    if(typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream){ setRenderErr('Your browser does not support MediaRecorder + canvas.captureStream.'); return; }
    if(document.visibilityState !== 'visible'){
      console.warn('[zs] starting render with tab hidden — rAF may throttle; output could be choppy');
      setRenderErr('Tip: keep this tab focused during render for best quality. Continuing…');
    }
    setRenderBusy(true); setRenderErr(''); setRenderUrl(''); setRenderProgress(0);
    let audioCtx = null; let onVis = null; const _idbImgUrls = []; let _webmFallbackUrl = null;
    try {
      const _presetDims = { vertical: [1080, 1920], square: [1080, 1080], landscape: [1920, 1080] };
      const _presetId = (projectRef.current && projectRef.current.preset) || 'vertical';
      const [W, H] = _presetDims[_presetId] || _presetDims.vertical;
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
            let buf;
            if(String(s.audio).startsWith('idb:')) {
              const blob = await idbGetStudioAudio(s.id);
              if(!blob) return null;
              buf = await blob.arrayBuffer();
            } else {
              const res = await fetch(s.audio);
              buf = await res.arrayBuffer();
            }
            return await new Promise((resolve, reject) => { audioCtx.decodeAudioData(buf, resolve, reject); });
          } catch(err){ console.warn('[zs] audio decode failed', err); return null; }
        }));
      }
      const durations = scenes.map((s,i) => {
        const configured = Math.max(1, Number(s.duration)||3);
        const audioLen = audioBuffers[i] ? audioBuffers[i].duration : 0;
        if(audioLen > 0){
          return Math.max(2.0, Math.ceil((audioLen + 0.3) * 10) / 10);
        }
        return configured;
      });
      const INTRO_S = 1.4;
      const OUTRO_S = 1.2;
      const total = INTRO_S + durations.reduce((a,b)=>a+b, 0) + OUTRO_S;
      const stream = canvas.captureStream(30);
      if(audioDest){ audioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t)); }
      const mimeCandidates = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm;codecs=vp9','video/webm'];
      const mime = mimeCandidates.find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if(e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((resolve) => { rec.onstop = () => resolve(); });
      const imgs = await Promise.all(scenes.map(async (s) => {
        if(!s.image) return null;
        let src = s.image;
        if(String(src).startsWith('idb:')) {
          try {
            const blob = await idbGetStudioImage(s.id);
            if(!blob) return null;
            src = URL.createObjectURL(blob);
            _idbImgUrls.push(src);
          } catch(_) { return null; }
        }
        return new Promise((res) => {
          const im = new Image(); im.crossOrigin = 'anonymous';
          im.onload = () => res(im); im.onerror = () => res(null);
          im.src = src;
        });
      }));
      let tabWasHidden = false;
      onVis = () => { if(document.visibilityState !== 'visible'){ tabWasHidden = true; console.warn('[zs] tab hidden mid-render — playback may stutter'); } };
      document.addEventListener('visibilitychange', onVis);
      rec.start();
      const recStart = audioCtx ? audioCtx.currentTime + 0.05 : 0;
      if(audioCtx && audioDest){
        const AUDIO_FADE_S = 0.35;
        let cum = INTRO_S;
        for(let i=0; i<scenes.length; i++){
          const ab = audioBuffers[i];
          if(ab){
            const src = audioCtx.createBufferSource();
            const gain = audioCtx.createGain();
            src.buffer = ab; src.connect(gain); gain.connect(audioDest);
            const startAt = recStart + cum;
            const audibleDur = Math.min(ab.duration, durations[i]);
            const isFirst = (i === 0);
            const isLast = (i === scenes.length - 1);
            const fadeInS = isFirst ? 0.25 : AUDIO_FADE_S;
            gain.gain.setValueAtTime(0, startAt);
            gain.gain.linearRampToValueAtTime(1, startAt + fadeInS);
            const fadeOutStart = startAt + Math.max(fadeInS + 0.01, audibleDur - AUDIO_FADE_S);
            gain.gain.setValueAtTime(1, fadeOutStart);
            gain.gain.linearRampToValueAtTime(0, fadeOutStart + AUDIO_FADE_S);
            try { src.start(startAt); } catch(_){}
          }
          cum += durations[i];
        }
      }
      const drawProgressBar = (context, globalP) => {
        const g = Math.max(0, Math.min(1, globalP || 0));
        const barH = 3;
        context.globalAlpha = 1;
        context.fillStyle = 'rgba(255,255,255,0.15)';
        context.fillRect(0, 0, W, barH);
        context.fillStyle = 'rgba(99,102,241,0.9)';
        context.fillRect(0, 0, W * g, barH);
      };
      const wrapText = (context, text, maxW, maxLines) => {
        const words = String(text||'').split(/\s+/).filter(Boolean);
        const lines = [];
        let cur = '';
        for(const w of words){
          const trial = cur ? cur + ' ' + w : w;
          if(context.measureText(trial).width <= maxW){
            cur = trial;
          } else {
            if(cur) lines.push(cur);
            cur = w;
            if(maxLines && lines.length >= maxLines) break;
          }
        }
        if(cur && (!maxLines || lines.length < maxLines)) lines.push(cur);
        return lines.slice(0, maxLines || lines.length);
      };
      const drawSceneToCtx = (context, idx, progress, globalProgress) => {
        const p = Math.max(0, Math.min(1, progress || 0));
        context.globalAlpha = 1;
        context.fillStyle = '#0a0a0a'; context.fillRect(0,0,W,H);
        const sc = scenes[idx];
        const voFull = (sc.voLine||'').slice(0, 140);
        context.font = '24px system-ui';
        const voLayout = wrapText(context, voFull, W - 120, 2);
        const isMultiLine = voLayout.length >= 2;
        const bandH = isMultiLine ? 230 : 200;
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
          const bandGrad = context.createLinearGradient(0, H-bandH, 0, H);
          bandGrad.addColorStop(0, 'rgba(0,0,0,0)');
          bandGrad.addColorStop(1, 'rgba(0,0,0,0.72)');
          context.fillStyle = bandGrad; context.fillRect(0, H-bandH, W, bandH);
        } else {
          context.fillStyle = '#1a1a1a'; context.fillRect(40,40,W-80,H-80);
        }
        context.textAlign = 'left';
        context.shadowColor = 'rgba(0,0,0,0.85)';
        context.shadowBlur = 8;
        context.shadowOffsetY = 2;
        context.fillStyle = '#fff'; context.font = 'bold 42px system-ui';
        const title = (sc.title||('Scene '+(idx+1))).slice(0,60);
        const _sceneDur = durations[idx] || 3;
        const _titleInT = Math.min(1, Math.max(0, (p * _sceneDur) / 0.35));
        const _titleEase = 1 - Math.pow(1 - _titleInT, 3);
        const _titleBaseY = isMultiLine ? H-128 : H-100;
        const _titleY = _titleBaseY + (1 - _titleEase) * 14;
        const _prevAlpha = context.globalAlpha;
        context.globalAlpha = _titleEase;
        context.fillText(title, 60, _titleY);
        context.globalAlpha = _prevAlpha;
        context.shadowBlur = 6;
        context.font = '24px system-ui'; context.fillStyle = 'rgba(255,255,255,0.92)';
        const _ab = audioBuffers[idx];
        const _audibleRatio = _ab ? Math.min(1, Math.min(_ab.duration, durations[idx]) / durations[idx]) : 0.9;
        const _wordProgress = Math.min(1, p / Math.max(0.3, _audibleRatio * 0.95));
        const _words = voFull.split(/\s+/).filter(Boolean);
        const _revealed = _words.length ? Math.min(_words.length, Math.max(1, Math.floor(_words.length * _wordProgress))) : 0;
        const voText = _words.slice(0, _revealed).join(' ');
        const voLinesReveal = wrapText(context, voText, W - 120, 2);
        const voYs = isMultiLine ? [H - 74, H - 38] : [H - 50];
        voLinesReveal.forEach((ln, i) => { if(voYs[i] !== undefined) context.fillText(ln, 60, voYs[i]); });
        context.shadowColor = 'transparent';
        context.shadowBlur = 0;
        context.shadowOffsetY = 0;
        drawProgressBar(context, globalProgress);
      };
      const offscreen = document.createElement('canvas'); offscreen.width = W; offscreen.height = H;
      const offCtx = offscreen.getContext('2d');
      const FADE_S = 0.4;
      const projectTitle = ((project.name && String(project.name).trim()) || (project.logline && String(project.logline).trim()) || 'Your AI-generated video').slice(0, 70);
      const _titleTrim = String(project.name || '').trim();
      const _loglineTrim = String(project.logline || '').trim();
      const projectSubtitle = (_titleTrim && _loglineTrim && _loglineTrim !== _titleTrim) ? _loglineTrim.slice(0, 90) : '';
      const drawIntro = (alpha, scaleProgress, globalProgress) => {
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
        ctx.fillText(projectTitle, 0, projectSubtitle ? -28 : -6);
        if(projectSubtitle){
          ctx.fillStyle = 'rgba(255,255,255,0.78)'; ctx.font = '22px system-ui, -apple-system, Segoe UI, sans-serif';
          ctx.fillText(projectSubtitle, 0, 18);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '18px system-ui';
        ctx.fillText('zaidsaid.com', 0, projectSubtitle ? 62 : 44);
        ctx.restore();
        ctx.globalAlpha = 1;
        drawProgressBar(ctx, globalProgress);
      };
      const introStart = audioCtx ? audioCtx.currentTime : performance.now()/1000;
      while(true){
        const now = audioCtx ? audioCtx.currentTime : performance.now()/1000;
        const p = Math.min(1, (now - introStart) / INTRO_S);
        const fadeIn = 0.3, fadeOut = 0.25;
        let a = 1;
        if (p < fadeIn) a = p / fadeIn;
        else if (p > 1 - fadeOut) a = Math.max(0, (1 - p) / fadeOut);
        drawIntro(a, Math.min(1, p / 0.4), (p * INTRO_S) / total);
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
          drawSceneToCtx(ctx, i, p, (elapsed + dur * p) / total);
          if(now >= holdEnd) break;
          await new Promise(r => requestAnimationFrame(r));
        }
        if(!isLast && fadeS > 0){
          const holdProgress = Math.min(1, (dur - fadeS) / dur);
          drawSceneToCtx(offCtx, i, holdProgress, (elapsed + dur - fadeS) / total);
          const fadeStart = audioCtx ? audioCtx.currentTime : performance.now()/1000;
          while(true){
            const now = audioCtx ? audioCtx.currentTime : performance.now()/1000;
            const t = Math.min(1, (now - fadeStart) / fadeS);
            drawSceneToCtx(ctx, i+1, 0, (elapsed + dur - fadeS + t * fadeS) / total);
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
      const outroCTA = ((project.cta && String(project.cta).trim()) || 'Made with zaidsaid.com').slice(0, 80);
      const drawOutro = (alpha, globalProgress) => {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);
        const grad = ctx.createRadialGradient(W/2, H/2, 40, W/2, H/2, Math.max(W, H)*0.7);
        grad.addColorStop(0, 'rgba(236,72,153,0.18)');
        grad.addColorStop(1, 'rgba(10,10,10,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff'; ctx.font = 'bold 44px system-ui, -apple-system, Segoe UI, sans-serif';
        ctx.fillText(outroCTA, W/2, H/2 - 8);
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '20px system-ui';
        ctx.fillText('zaidsaid.com', W/2, H/2 + 44);
        ctx.globalAlpha = 1;
        drawProgressBar(ctx, globalProgress);
      };
      const outroStart = audioCtx ? audioCtx.currentTime : performance.now()/1000;
      while(true){
        const now = audioCtx ? audioCtx.currentTime : performance.now()/1000;
        const p = Math.min(1, (now - outroStart) / OUTRO_S);
        const fadeIn = 0.3, fadeOut = 0.25;
        let a = 1;
        if (p < fadeIn) a = p / fadeIn;
        else if (p > 1 - fadeOut) a = Math.max(0, (1 - p) / fadeOut);
        drawOutro(a, (total - OUTRO_S + p * OUTRO_S) / total);
        if (p >= 1) break;
        await new Promise(r => requestAnimationFrame(r));
      }
      rec.stop();
      await stopped;
      const webmBlob = new Blob(chunks, { type: mime });
      if(!webmBlob.size) throw new Error('Canvas capture produced no data — try keeping the tab focused.');
      setRenderProgress(60);
      let mp4Blob = null;
      try {
        mp4Blob = await reencodeWebmToPresetMP4(webmBlob, _presetId, (p) => setRenderProgress(Math.round(60 + p * 40)));
      } catch(ffErr) {
        console.warn('[zs] ffmpeg reencode failed, falling back to webm', ffErr);
        const _fbUrl = URL.createObjectURL(webmBlob);
        _webmFallbackUrl = _fbUrl;
        setWebmFallbackUrl(_fbUrl);
        throw new Error('MP4 encode failed: ' + ((ffErr && ffErr.message) || String(ffErr)) + '. A WebM fallback is available below.');
      }
      try { window.__zs_lastBlob = mp4Blob; window.__zs_lastDurS = total; } catch(_){}
      const url = URL.createObjectURL(mp4Blob);
      setRenderUrl(url);
      setRenderMeta({ bytes: mp4Blob.size||0, durationSec: total||0 });
      setRenderProgress(100);
      if(tabWasHidden){ console.warn('[zs] tab was hidden at least once during render'); }
    } catch(e){
      console.warn('[zs] render error', e);
      const _rawMsg = (e && e.message) || String(e);
      const _userMsg = tabWasHidden
        ? 'Render stopped because the tab was switched away. Keep this tab visible and try again.'
        : ('Render hit a snag: ' + _rawMsg);
      setRenderErr(_userMsg);
    } finally {
      setRenderBusy(false);
      if(onVis){ try { document.removeEventListener('visibilitychange', onVis); } catch(_){} }
      if(audioCtx){ try { audioCtx.close(); } catch(_){} }
      _idbImgUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch(_){} });
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
            <div className="text-lg font-semibold">Real video export — 1080p H.264 MP4</div>
            <div className="text-[12px] text-[color:var(--muted)] mt-1">Canvas+MediaRecorder capture (0→60%) then ffmpeg reencode to preset dims (60→100%). Keep this tab focused during render.</div>
          </div>
          <button className="btn btn-primary" onClick={renderRealVideo} disabled={renderBusy}>{renderBusy ? (renderProgress < 60 ? ('Recording… ' + renderProgress + '%') : ('Encoding… ' + renderProgress + '%')) : 'Render MP4'}</button>
        </div>
        {renderErr && !renderBusy && !renderUrl && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] text-red-300 max-w-[560px]">{renderErr}</div>
            <div className="flex items-center gap-2">
              {webmFallbackUrl && <a href={webmFallbackUrl} download={(project.name||'zaidsaid').replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-'+((project.preset||'vertical'))+'.webm'} className="btn btn-ghost text-xs">Download WebM fallback</a>}
              <button type="button" className="btn btn-primary text-xs" onClick={()=>{ setRenderErr(''); setWebmFallbackUrl(''); try { renderRealVideo(); } catch(_){} }}>Try again</button>
            </div>
          </div>
        )}
        {renderErr && (renderBusy || renderUrl) && <div className="mt-2 text-[12px] text-red-400">{renderErr}</div>}
        {renderBusy && (()=>{
          const _m = Math.floor(renderElapsed/60), _s = renderElapsed%60;
          const _elapsed = (_m > 0 ? _m + ':' + String(_s).padStart(2,'0') : _s + 's');
          return (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11.5px] text-[color:var(--muted)] tabular-nums mb-1">
                <span>{renderProgress < 60 ? 'Recording… ' : 'Encoding MP4… '}{Math.max(1, renderProgress)}%</span>
                <span>{_elapsed}</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-2 bg-emerald-400 transition-all" style={{ width: renderProgress + '%' }} />
              </div>
            </div>
          );
        })()}
        {renderUrl && !renderBusy && (()=>{
          const _bytes = renderMeta.bytes || 0;
          const _dur = renderMeta.durationSec || 0;
          const _mb = _bytes ? (_bytes/1048576) : 0;
          const _sizeLabel = _mb >= 1 ? (_mb.toFixed(1) + ' MB') : (_bytes ? Math.max(1, Math.round(_bytes/1024)) + ' KB' : '');
          const _durLabel = _dur ? (_dur < 60 ? (Math.round(_dur*10)/10) + 's' : Math.floor(_dur/60) + 'm ' + Math.round(_dur%60) + 's') : '';
          const _meta = [_durLabel, _sizeLabel].filter(Boolean).join(' · ');
          return (
          <div ref={readyRef} className="mt-4 grid gap-3 scroll-mt-4">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                <span className="inline-flex w-6 h-6 rounded-full bg-emerald-400/20 items-center justify-center text-emerald-300">{I.check({size:14})}</span>
                Video ready · tap Download to save
              </div>
              {_meta && <div className="text-[12px] text-[color:var(--muted)] tabular-nums">{_meta}</div>}
            </div>
            <video src={renderUrl} controls autoPlay muted playsInline className="w-full max-h-[360px] rounded-xl border border-[color:var(--line)] bg-black" />
            <div className="flex flex-wrap items-center gap-2">
              <a href={renderUrl} download={(project.name||'zaidsaid').replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-'+(project.preset||'vertical')+'.mp4'} className="btn btn-primary">{I.check({size:14})} Download .mp4</a>
              <button type="button" onClick={()=>{ const _text = (project.logline || project.name || 'my short video').toString().slice(0, 180); const _url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent('Just made a short video with zaidsaid.com — "' + _text + '"') + '&url=' + encodeURIComponent('https://zaidsaid.com'); try { window.open(_url, '_blank', 'noopener,noreferrer,width=560,height=520'); } catch(_){} }} className="btn btn-ghost text-xs" title="Share a tweet about this video">Share on X</button>
              {(project.logline || '').trim() && <button type="button" onClick={()=>{ const _t = (project.logline || '').toString().trim(); if (!_t) return; try { navigator.clipboard.writeText(_t); setLoglineCopied(true); setTimeout(()=>setLoglineCopied(false), 1200); } catch(_){} }} className="btn btn-ghost text-xs" title="Copy logline to clipboard">{loglineCopied ? '✓ Copied!' : 'Copy logline'}</button>}
              <button type="button" onClick={()=>{ setRenderUrl(''); setWebmFallbackUrl(''); try { renderRealVideo(); } catch(_){} }} className="btn btn-ghost text-xs">Render again</button>
              <button type="button" onClick={()=>{
                try { window.__zs_lastBlob = null; window.__zs_lastDurS = null; } catch(_){}
                setRenderUrl(''); setRenderErr(''); setRenderMeta({ bytes: 0, durationSec: 0 }); setWebmFallbackUrl('');
                const _scenes = ((projectRef.current && projectRef.current.scenes) || []);
                _scenes.forEach(s => { idbDelStudioImage(s.id).catch(()=>{}); idbDelStudioAudio(s.id).catch(()=>{}); });
                setProject(STUDIO_SEED);
                try { window.dispatchEvent(new CustomEvent('zs:advance-step', { detail: { from: 'export' } })); } catch(_){}
              }} className="btn btn-ghost text-xs">Make another video</button>
            </div>
          </div>
          );
        })()}
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
      const map = { script: 'storyboard', storyboard: 'voice', voice: 'export', export: 'script' };
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
  const resetProject = () => {
    const scenes = (project && project.scenes) || [];
    scenes.forEach(s => {
      idbDelStudioImage(s.id).catch(()=>{});
      idbDelStudioAudio(s.id).catch(()=>{});
    });
    setProject(STUDIO_SEED);
  };
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
        <StudioStepNav step={step} setStep={goto} project={project} />
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
  name: "Huberman × Attia long-form → 10 shorts",
  kind: "url",
  source: "https://example.com/podcast/huberman-attia-longevity-ep42",
  durationSec: 5520,
  brandKitId: "bk-zs",
  targetCount: 10,
  clips: [
    { id:"c1", title:"Zone 2 cardio is the single highest-ROI habit",                     start:  612, end:  654, virality: 92, hook:"The one zone that actually moves the needle.",        caption:"If you only do one thing for longevity, this is it.",             preset:"vertical",  status:"draft" },
    { id:"c2", title:"Why VO2 max is the strongest predictor of all-cause mortality",     start: 1488, end: 1524, virality: 88, hook:"VO2 max beats every other biomarker for mortality.",   caption:"One number predicts how long you live.",                           preset:"vertical",  status:"draft" },
    { id:"c3", title:"Protein per meal is the lever, not total daily grams",              start: 2340, end: 2385, virality: 74, hook:"Hit the per-meal threshold or the rest is wasted.",     caption:"Why your protein target is missing the point.",                    preset:"square",    status:"draft" },
    { id:"c4", title:"The cold plunge debate: cortisol spike vs recovery",                start: 3180, end: 3222, virality: 66, hook:"When cold plunges help — and when they block gains.",   caption:"Cold plunge: the truth nobody says out loud.",                     preset:"vertical",  status:"draft" },
    { id:"c5", title:"Sleep pressure is a muscle — train it",                             start: 4450, end: 4495, virality: 58, hook:"Build sleep pressure like you build strength.",         caption:"Sleep is a skill. Here's how to train it.",                        preset:"landscape", status:"draft" },
  ],
};
function clipDuration(c){ return Math.max(0, (c.end||0) - (c.start||0)); }

function slugifyClipTitle(s){
  const base = String(s||"clip").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  return base || "clip";
}

function buildClipExportText(clip, project){
  const band = viralityBand(clip.virality);
  const rule = "═══════════════════════════════════════";
  const out = [];
  out.push(rule);
  out.push("  " + (clip.title || "Untitled clip"));
  out.push(rule);
  out.push("");
  out.push("⏱  " + hmsFromSec(clip.start) + " – " + hmsFromSec(clip.end) + "  ·  " + (band.label + " " + (clip.virality||0)) + " virality  ·  " + platformFor(clip.preset));
  out.push("");
  if(clip.hook){ out.push("📣 HOOK"); out.push(clip.hook); out.push(""); }
  if(clip.caption){ out.push("📝 CAPTION"); out.push(clip.caption); out.push(""); }
  if(clip.platformCaptions && typeof clip.platformCaptions === "object"){
    const pc = clip.platformCaptions;
    if(pc.tiktok){ out.push("🎬 TIKTOK"); out.push(pc.tiktok); out.push(""); }
    if(pc.instagram){ out.push("📸 INSTAGRAM"); out.push(pc.instagram); out.push(""); }
    if(pc.twitter){ out.push("🐦 TWITTER / X"); out.push(pc.twitter); out.push(""); }
    if(pc.linkedin){ out.push("💼 LINKEDIN"); out.push(pc.linkedin); out.push(""); }
  }
  if(clip.hookBreakdown && typeof clip.hookBreakdown === "object"){
    const hb = clip.hookBreakdown;
    out.push("✨ WHY THIS WORKS");
    if(hb.emotional_trigger) out.push("Emotional trigger: " + hb.emotional_trigger);
    if(hb.curiosity_gap) out.push("Curiosity gap: " + hb.curiosity_gap);
    if(hb.audience_fit) out.push("Audience fit: " + hb.audience_fit);
    if(hb.one_liner) out.push("One-liner: " + hb.one_liner);
    out.push("");
  }
  if(Array.isArray(clip.hookAlts) && clip.hookAlts.length){
    out.push("🔀 HOOK A/B ALTERNATIVES");
    clip.hookAlts.forEach((alt, i) => {
      if(!alt) return;
      const frame = alt.frame ? "[" + alt.frame + "] " : "";
      out.push((i+1) + ". " + frame + (alt.title||"") + " — " + (alt.hook||""));
    });
    out.push("");
  }
  if(clip.thumbConcept && typeof clip.thumbConcept === "object"){
    const tc = clip.thumbConcept;
    out.push("🖼  THUMBNAIL CONCEPT");
    if(tc.text_overlay) out.push("Overlay: \"" + tc.text_overlay + "\"");
    if(tc.emoji) out.push("Emoji: " + tc.emoji);
    const bgParts = [];
    if(tc.bg_color) bgParts.push("Background: " + tc.bg_color);
    if(tc.bg_label) bgParts.push("Mood: " + tc.bg_label);
    if(bgParts.length) out.push(bgParts.join("  ·  "));
    if(tc.rationale) out.push(tc.rationale);
    out.push("");
  }
  if(clip.hookScore && typeof clip.hookScore === "object"){
    const hs = clip.hookScore;
    out.push("⚡ HOOK-SPEED SCORE");
    out.push((hs.score||0) + "/10 — " + (hs.verdict||""));
    if(hs.why) out.push(hs.why);
    if(hs.fix) out.push("Fix: \"" + hs.fix + "\"");
    out.push("");
  }
  if(Array.isArray(clip.objections) && clip.objections.length){
    out.push("🛡  OBJECTION PRE-ANSWERS");
    clip.objections.forEach((obj) => {
      if(!obj) return;
      if(obj.objection) out.push("OBJECTION: \"" + obj.objection + "\"");
      if(obj.preemptive) out.push("PREEMPTIVE LINE: \"" + obj.preemptive + "\"");
      out.push("");
    });
  }
  if(Array.isArray(clip.commentSeeds) && clip.commentSeeds.length){
    out.push("💬 COMMENT SEEDS (post these on your own clip in first 30 min)");
    clip.commentSeeds.forEach((seed) => {
      if(!seed || !seed.text) return;
      const label = seed.role === "pin" ? "PIN:       " : seed.role === "ask" ? "ASK:       " : "REPLY-BAIT: ";
      out.push(label + seed.text);
    });
    out.push("");
  }
  out.push("─── Generated by zaidsaid.com ───");
  return out.join("\n");
}

function RepurposeIntake({ project, setProject, onProcessSource, processBusy, processStatus, onFileUpload, toast }){
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
              onKeyDown={(e)=>{ if(e.key === "Enter" && !e.shiftKey && onProcessSource){ e.preventDefault(); onProcessSource(); } }}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
            {onProcessSource && (
              <button type="button" className="btn btn-primary shrink-0" onClick={onProcessSource} disabled={!!processBusy} title="Press Enter">
                {processBusy ? I.refresh({size:14, className:"opacity-60"}) : I.arrow({size:14})}
                <span className="ml-1 text-[12px]">{processBusy ? (processStatus || "Processing…") : "Generate clips"}</span>
              </button>
            )}
          </div>
          {!processBusy && processStatus && (
            <div className="mt-1 text-[11px] text-[color:var(--muted)]">{processStatus}</div>
          )}
          {project.transcriptSource === 'real' && (
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">Source: YouTube transcript</span>
          )}
          {project.transcriptSource === 'pasted' && (
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] border border-sky-400/30 bg-sky-500/10 text-sky-300">Source: pasted transcript</span>
          )}
          {project.transcriptSource === 'description' && (
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] border border-amber-400/30 bg-amber-500/10 text-amber-300">Source: description fallback — paste transcript below for sharper clips</span>
          )}
          {project.transcriptSource === 'transcribed' && (
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] border border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300">Source: ElevenLabs Scribe (auto-transcribed)</span>
          )}
          <details className="mt-2 rounded-xl border border-[color:var(--line)] bg-white/[0.02]">
            <summary className="cursor-pointer px-3 py-2 text-[12px] text-[color:var(--muted)] hover:text-white select-none">
              Paste full transcript (recommended for YouTube — sharper clips)
            </summary>
            <div className="px-3 pb-3">
              <textarea
                value={project.transcriptText || ""}
                onChange={(e)=>setProject({ ...project, transcriptText: e.target.value })}
                placeholder="Paste the full transcript here. We'll use it to cut clips precisely with real timestamps when possible."
                className="w-full bg-transparent border border-[color:var(--line)] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-white/20 min-h-[120px]"
              />
              <div className="mt-1 text-[11px] text-[color:var(--muted)]">
                {(project.transcriptText || "").trim().length > 0
                  ? ((project.transcriptText || "").trim().length + " chars — Enter / Generate will use this")
                  : "Tip: open the video on YouTube → ••• → Show transcript → copy/paste here."}
              </div>
            </div>
          </details>
          <details className="mt-2 rounded-xl border border-[color:var(--line)] bg-white/[0.02]">
            <summary className="cursor-pointer px-3 py-2 text-[12px] text-[color:var(--muted)] hover:text-white select-none">
              <strong>Need a local copy of this video? Download it →</strong>
            </summary>
            <div className="px-3 pb-3">
              <YouTubeDownloaderCard toast={toast} />
            </div>
          </details>
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
                type="number" min={3} max={20}
                value={project.targetCount || 10}
                onChange={(e)=>setProject({ ...project, targetCount: Math.max(3, Math.min(20, parseInt(e.target.value||"0", 10)||0)) })}
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
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Upload</span>
          <div className="mt-1 border border-dashed border-[color:var(--line)] rounded-xl p-4 text-[12px] text-[color:var(--muted)]">
            {project.uploadedVideoUrl ? (
              <div className="space-y-2">
                <video src={project.uploadedVideoUrl} controls className="w-full rounded-lg border border-[color:var(--line)] bg-black max-h-[200px]" />
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-white/80 text-[12px]">{project.uploadedVideoName || "uploaded.mp4"}</div>
                  <button type="button" className="chip" onClick={async ()=>{
                    try { URL.revokeObjectURL(project.uploadedVideoUrl); } catch(e){}
                    try { await idbDelete(IDB_UPLOAD_KEY); } catch(e){}
                    setProject({ ...project, uploadedVideoUrl: null, uploadedVideoName: null });
                  }}>Remove</button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-white/80 font-semibold">Upload a video or podcast</div>
                <div className="mt-1">MP4 · MOV · MP3 · WAV</div>
                <label className="btn mt-3 cursor-pointer inline-block">
                  Choose file
                  <input
                    type="file"
                    accept="video/*,audio/*"
                    className="hidden"
                    onChange={(e)=>{
                      const f = e.target.files && e.target.files[0];
                      if(!f) return;
                      try { if(project.uploadedVideoUrl) URL.revokeObjectURL(project.uploadedVideoUrl); } catch(_){}
                      const url = URL.createObjectURL(f);
                      const defaultName = f.name.replace(/\.[^.]+$/, '').slice(0, 80);
                      setProject({
                        ...project,
                        kind: "upload",
                        uploadedVideoUrl: url,
                        uploadedVideoName: f.name,
                        audioMap: null,
                        source: "",
                        transcriptText: "",
                        transcriptSegments: [],
                        chapters: [],
                        transcriptSource: "",
                        clips: [],
                        author: "",
                        name: defaultName,
                        durationSec: 0
                      });
                      if(onFileUpload) onFileUpload(url, f);
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RepurposeTranscriptStrip({ project }){
  const dur = Math.max(1, project.durationSec || 1);
  const peaks = Array.isArray(project.audioMap && project.audioMap.peaks) ? project.audioMap.peaks : null;
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
        <div className="relative h-6 rounded-lg overflow-hidden" style={{background:"linear-gradient(90deg, rgba(99,102,241,0.25), rgba(34,211,238,0.15))"}}>
          {peaks && peaks.map((v, i) => {
            const leftPct = (i / Math.max(1, peaks.length - 1)) * 100;
            const h = Math.max(20, Math.min(100, Math.round((v || 0) * 100)));
            return (
              <div key={i} aria-hidden className="absolute bottom-0 w-px" style={{left: leftPct + "%", height: h + "%", background:"rgba(99,102,241,0.5)"}} />
            );
          })}
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

function RepurposeClipPreview({ clip, clipBlobUrl, clipThumbUrl, uploadedVideoUrl, sourceUrl, width, height, cropPath }){
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(clip.start || 0);
  const [muted, setMuted] = useState(true);
  const dur = Math.max(0.1, (clip.end || 0) - (clip.start || 0));
  const ytId = !uploadedVideoUrl ? extractYouTubeVideoId(sourceUrl) : null;

  useEffect(() => {
    const v = videoRef.current;
    if(!v || !uploadedVideoUrl) return;
    const onTime = () => {
      setPos(v.currentTime);
      if(v.currentTime >= (clip.end || 0)){
        try { v.currentTime = clip.start || 0; } catch(e){}
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onLoaded = () => {
      try { v.currentTime = clip.start || 0; } catch(e){}
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("loadedmetadata", onLoaded);
    if(v.readyState >= 1) onLoaded();
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [uploadedVideoUrl, clip.start, clip.end]);

  const toggle = (e) => {
    if(e && e.stopPropagation) e.stopPropagation();
    const v = videoRef.current;
    if(!v) return;
    if(v.paused){
      if(v.currentTime < (clip.start || 0) || v.currentTime >= (clip.end || 0)){
        try { v.currentTime = clip.start || 0; } catch(e){}
      }
      v.play().catch(()=>{});
    } else {
      v.pause();
    }
  };

  const toggleMute = (e) => {
    if(e && e.stopPropagation) e.stopPropagation();
    const v = videoRef.current;
    if(!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const pct = Math.max(0, Math.min(100, ((pos - (clip.start || 0)) / dur) * 100));

  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const vid = videoRef.current;
    if(!canvas || !vid || !cropPath || !cropPath.length) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    let rafId;
    // x108d: clipBlobUrl plays a pre-cut video (0-based time); uploadedVideoUrl
    // plays the full source (clip-relative time needs clip.start subtracted).
    const isPreCut = !!clipBlobUrl;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const t = isPreCut ? (vid.currentTime || 0) : ((vid.currentTime || 0) - (clip.start || 0));
      const crop = cropAtTime(cropPath, t);
      if(crop){
        const vw = vid.videoWidth || 1;
        const vh = vid.videoHeight || 1;
        const scaleX = width / vw;
        const scaleY = height / vh;
        const rx = crop.x * scaleX, ry = crop.y * scaleY;
        const rw = crop.w * scaleX, rh = crop.h * scaleY;
        ctx.strokeStyle = "rgba(99,102,241,0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, rw, rh);
      }
      rafId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(rafId); ctx.clearRect(0, 0, width, height); };
  }, [cropPath, pos, width, height, clip.start, clipBlobUrl]);

  // x93: pre-cut clip blob — play the already-trimmed mp4 directly.
  if(clipBlobUrl){
    return (
      <div className="relative rounded-xl overflow-hidden bg-black shrink-0" style={{ width, height }}>
        <video
          ref={videoRef}
          src={clipBlobUrl}
          poster={clipThumbUrl || undefined}
          className="w-full h-full object-cover"
          controls
          playsInline
          preload="metadata"
        />
        {cropPath && cropPath.length > 0 && (
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width, height }}
          />
        )}
      </div>
    );
  }

  if(uploadedVideoUrl){
    return (
      <div className="relative rounded-xl overflow-hidden bg-black shrink-0" style={{ width, height }}>
        <video
          ref={videoRef}
          src={uploadedVideoUrl}
          className="w-full h-full object-cover"
          preload="auto"
          playsInline
          muted={muted}
          loop={false}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause preview" : "Play preview"}
          className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/30 transition-opacity opacity-0 hover:opacity-100"
        >
          <span className="rounded-full bg-white/90 text-black p-2 shadow-lg">
            {playing ? I.pause({size:14}) : I.play({size:14})}
          </span>
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute preview" : "Mute preview"}
          className="absolute top-1 right-1 rounded-full bg-black/60 hover:bg-black/80 text-white px-1.5 py-0.5 text-[10px] font-semibold"
        >
          {muted ? "🔇" : "🔊"}
        </button>
        {cropPath && cropPath.length > 0 && (
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width, height }}
          />
        )}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div className="h-full bg-gradient-to-r from-indigo-400 to-cyan-400" style={{ width: pct + "%" }} />
        </div>
      </div>
    );
  }

  if(ytId){
    const start = Math.max(0, Math.floor(clip.start || 0));
    const end = Math.max(start + 1, Math.ceil(clip.end || 0));
    // youtube-nocookie: better embed compat for videos that block standard domain
    const src = "https://www.youtube-nocookie.com/embed/" + ytId + "?start=" + start + "&end=" + end + "&controls=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3";
    const thumbSrc = "https://img.youtube.com/vi/" + ytId + "/hqdefault.jpg";
    return (
      <div className="relative rounded-xl overflow-hidden bg-black shrink-0" style={{ width, height }}>
        <img src={thumbSrc} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden style={{ zIndex: 0 }} />
        <iframe
          src={src}
          title={"Clip preview " + (clip.title || "")}
          className="absolute inset-0 w-full h-full"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ zIndex: 1 }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-cyan-500 opacity-90 flex items-center justify-center text-white/80 text-[10px] shrink-0"
      style={{ width, height }} aria-hidden>
      <span>{(clip.preset === "vertical" ? "9:16" : clip.preset === "square" ? "1:1" : "16:9")}</span>
    </div>
  );
}

function RepurposeClipCard({ clip, onField, onRegen, regenBusy, onRemove, onExplain, explainBusy, onHookAlts, hookAltsBusy, onThumbConcept, thumbConceptBusy, onHookScore, hookScoreBusy, onObjAnswer, objAnswerBusy, onCommentSeeds, commentSeedsBusy, onCopyPost, copyPostBusy, onRenderVideo, renderVideoBusy, renderVideoProgress, uploadEnabled, uploadedVideoUrl, sourceUrl, clipBlobUrl, clipThumbUrl, onShare, shareBusyPlatform, signals, trendingMatches, cropPath }){
  const [shareOpen, setShareOpen] = useState(false);
  const band = viralityBand(clip.virality);
  const preset = REPURPOSE_PRESETS.find(p => p.id === clip.preset) || REPURPOSE_PRESETS[0];
  const clipText = ((clip.hook || "") + " " + (clip.caption || "") + " " + (clip.title || "")).toLowerCase();
  const matchedTrendingKw = Array.isArray(trendingMatches)
    ? (trendingMatches.find(m => clipText.includes(m.keyword.toLowerCase())) || null)
    : null;
  const previewW = preset.id === "vertical" ? 144 : (preset.id === "square" ? 160 : 200);
  const previewH = preset.id === "vertical" ? 256 : (preset.id === "square" ? 160 : 112);
  const [exportFlash, setExportFlash] = useState(false);
  const exportText = () => {
    const txt = buildClipExportText(clip, null);
    try { navigator.clipboard.writeText(txt); } catch(e){}
    setExportFlash(true);
    setTimeout(() => setExportFlash(false), 1400);
  };
  const downloadExportTxt = () => {
    try {
      const txt = buildClipExportText(clip, null);
      const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = slugifyClipTitle(clip.title) + ".txt";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try{ URL.revokeObjectURL(a.href); a.remove(); } catch(e){} }, 250);
    } catch(e) { console.warn("clip export failed:", e); }
  };
  return (
    <div className="card p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={"px-2 py-0.5 rounded-md text-[11px] border " + band.border + " " + band.bg + " " + band.tone}>{I.flame({size:12})} {band.label} {clip.virality}</span>
            <span className="chip">{hmsFromSec(clip.start)} – {hmsFromSec(clip.end)}</span>
            <span className="chip">{clipDuration(clip)}s</span>
            <span className="chip">{preset.ratio} · {platformFor(clip.preset)}</span>
            {matchedTrendingKw && (
              <span className="chip text-emerald-200 !border-emerald-400/30 bg-emerald-500/10" title={"Trending: " + matchedTrendingKw.keyword}>📈 {matchedTrendingKw.keyword}</span>
            )}
          </div>
          <input
            value={clip.title}
            onChange={(e)=>onField("title", e.target.value)}
            className="mt-2 w-full bg-transparent border border-transparent hover:border-[color:var(--line)] focus:border-white/20 rounded-md px-1 py-0.5 font-semibold text-[14px] focus:outline-none"
            aria-label="Clip title"
          />
          <div className="text-[12px] text-[color:var(--muted)] mt-1">{clip.hook}</div>
        </div>
        <RepurposeClipPreview
          clip={clip}
          clipBlobUrl={clipBlobUrl}
          clipThumbUrl={clipThumbUrl}
          uploadedVideoUrl={uploadedVideoUrl}
          sourceUrl={sourceUrl}
          width={previewW}
          height={previewH}
          cropPath={cropPath}
        />
      </div>
      {signals && (() => {
        const start = clip.start, end = clip.end;
        const hasScene = Array.isArray(signals.scenes) && signals.scenes.some(s => s.t >= start && s.t <= end);
        const audioMatch = Array.isArray(signals.audioEvents) && signals.audioEvents.find(e => e.t + (e.d||0) >= start && e.t <= end && ['laughter','applause'].includes(String(e.label||'').toLowerCase()));
        const vhMatch = Array.isArray(signals.visualHighlights) && signals.visualHighlights.find(h => h.t + (h.d||0) >= start && h.t <= end);
        if(!hasScene && !audioMatch && !vhMatch) return null;
        return (
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {hasScene && <span className="chip text-[11px]" title="Scene cut in clip window">🎬 scene cut</span>}
            {audioMatch && <span className="chip text-[11px]" title={audioMatch.label}>🔊 {audioMatch.label}</span>}
            {vhMatch && <span className="chip text-[11px]" title={vhMatch.reason || vhMatch.mood || 'visual highlight'}>👁 {vhMatch.mood || 'highlight'}</span>}
          </div>
        );
      })()}
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
          {/* Regenerate — collapsed menu */}
          <details className="relative inline-block">
            <summary className="chip cursor-pointer select-none list-none">
              {regenBusy ? I.refresh({size:12,className:"opacity-40"}) : I.refresh({size:12})}
              {" "}{regenBusy ? "Working…" : "Regenerate"}
            </summary>
            <div className="absolute left-0 top-full mt-1 z-20 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] shadow-lg p-2 flex flex-col gap-1 min-w-[150px]">
              <button className="chip w-full text-left" onClick={()=>onRegen("title")} disabled={!!regenBusy}>{I.refresh({size:12})} Re-title</button>
              <button className="chip w-full text-left" onClick={()=>onRegen("hook")} disabled={!!regenBusy}>{I.refresh({size:12})} Re-hook</button>
              <button className="chip w-full text-left" onClick={()=>onRegen("virality")} disabled={!!regenBusy}>{I.flame({size:12})} Re-score</button>
              <div className="border-t border-[color:var(--line)] my-1" />
              <button className="chip w-full text-left" onClick={onHookAlts} disabled={!!hookAltsBusy}>{clip.hookAlts ? I.refresh({size:12}) : I.edit({size:12})} {hookAltsBusy ? "Generating…" : (clip.hookAlts ? "New alts" : "Hook A/B")}</button>
              <button className="chip w-full text-left" onClick={onThumbConcept} disabled={!!thumbConceptBusy}>{clip.thumbConcept ? I.refresh({size:12}) : I.spark({size:12})} {thumbConceptBusy ? "Generating…" : (clip.thumbConcept ? "New thumb" : "Thumbnail")}</button>
              <button className="chip w-full text-left" onClick={onHookScore} disabled={!!hookScoreBusy}>{clip.hookScore ? I.refresh({size:12}) : I.clock({size:12})} {hookScoreBusy ? "Scoring…" : (clip.hookScore ? "Re-score" : "Hook speed")}</button>
              <button className="chip w-full text-left" onClick={onObjAnswer} disabled={!!objAnswerBusy}>{clip.objections ? I.refresh({size:12}) : I.shield({size:12})} {objAnswerBusy ? "Predicting…" : (clip.objections ? "Refresh" : "Objections")}</button>
              <button className="chip w-full text-left" onClick={onCommentSeeds} disabled={!!commentSeedsBusy}>{clip.commentSeeds ? I.refresh({size:12}) : I.comment({size:12})} {commentSeedsBusy ? "Seeding…" : (clip.commentSeeds ? "Re-seed" : "Seed comments")}</button>
            </div>
          </details>
          <button className="chip" onClick={onExplain} disabled={!!explainBusy} aria-label="Explain why this clip scores high">
            {explainBusy ? "Analyzing…" : (clip.hookBreakdown ? I.refresh({size:12}) : I.spark({size:12}))}
            {" "}{explainBusy ? "" : (clip.hookBreakdown ? "Re-explain" : "Why this works")}
          </button>
          {/* Download — blob if available, else render */}
          <button className="chip" aria-label="Download clip" onClick={()=>{
            if(clipBlobUrl){
              const a = document.createElement("a");
              a.href = clipBlobUrl;
              a.download = slugifyClipTitle(clip.title) + ".mp4";
              document.body.appendChild(a); a.click();
              setTimeout(()=>{ try{ a.remove(); } catch(e){} }, 250);
            } else if(onRenderVideo){
              onRenderVideo();
            }
          }} disabled={!!renderVideoBusy}>
            {renderVideoBusy ? I.refresh({size:12,className:"opacity-40"}) : I.arrow({size:12})}
            {renderVideoBusy ? ("Rendering " + Math.round((renderVideoProgress||0)*100) + "%") : "Download"}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="chip"
            onClick={exportText}
            aria-label="Copy full clip package (title, hook, caption, platform captions, and all generated insights) to clipboard"
            title="Copy full clip package to clipboard"
          >
            {exportFlash ? I.check({size:12}) : I.copy({size:12})}
            {" "}{exportFlash ? "Copied" : "Export"}
          </button>
          <button
            className="chip"
            onClick={downloadExportTxt}
            aria-label="Download clip package as .txt file"
            title="Download .txt"
          >
            {I.arrow({size:12})} .txt
          </button>
          <button className="chip" onClick={onCopyPost} disabled={!!copyPostBusy}>{copyPostBusy ? I.refresh({size:12,className:"opacity-40"}) : I.copy({size:12})} {copyPostBusy ? "Copying…" : "Copy post"}</button>
          {onShare && (
            <button className="chip" onClick={()=>setShareOpen(v=>!v)} aria-expanded={shareOpen} aria-label="Share clip">
              {I.share ? I.share({size:12}) : I.arrow({size:12})} Share
            </button>
          )}
          <span className="chip">Status: {clip.status || "draft"}</span>
          <button className="chip" onClick={onRemove} aria-label="Remove clip">{I.x({size:12})}</button>
        </div>
        {shareOpen && onShare && (
          <div className="mt-2 flex items-center gap-2 flex-wrap rounded-xl border border-[color:var(--line)] bg-white/[0.02] p-2">
            <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)] mr-1">Share to</span>
            {[
              { k: "tiktok", label: "TikTok" },
              { k: "instagram", label: "Instagram" },
              { k: "shorts", label: "YT Shorts" },
              { k: "youtube", label: "YouTube" },
              { k: "x", label: "X" },
              { k: "rumble", label: "Rumble" }
            ].map(p => {
              const busy = shareBusyPlatform === p.k;
              return (
                <button key={p.k} className="chip" disabled={busy} onClick={()=>onShare(p.k)} title={"Download video + copy caption + open " + p.label}>
                  {busy ? I.refresh({size:12, className:"opacity-40"}) : I.arrow({size:12})}
                  {busy ? "Preparing…" : p.label}
                </button>
              );
            })}
            <span className="text-[11px] text-[color:var(--muted)] ml-1">
              {uploadEnabled ? "Downloads .webm + opens upload page" : "Upload a source video to export — caption still copies"}
            </span>
          </div>
        )}
      </div>
      {clip.hookBreakdown && typeof clip.hookBreakdown === "object" && (
        <div className="mt-3 rounded-xl border border-indigo-400/20 bg-indigo-500/8 p-3">
          <div className="text-[11px] uppercase tracking-widest text-indigo-300/70 mb-2">Why this works</div>
          {clip.hookBreakdown.one_liner && (
            <div className="text-[13px] font-medium text-white/90 mb-2 italic">&ldquo;{clip.hookBreakdown.one_liner}&rdquo;</div>
          )}
          <div className="grid gap-2 text-[12px] text-[color:var(--muted)]">
            {clip.hookBreakdown.emotional_trigger && (
              <div><span className="text-[11px] uppercase tracking-widest text-indigo-300/60 block mb-0.5">Emotional trigger</span>{clip.hookBreakdown.emotional_trigger}</div>
            )}
            {clip.hookBreakdown.curiosity_gap && (
              <div><span className="text-[11px] uppercase tracking-widest text-indigo-300/60 block mb-0.5">Curiosity gap</span>{clip.hookBreakdown.curiosity_gap}</div>
            )}
            {clip.hookBreakdown.audience_fit && (
              <div><span className="text-[11px] uppercase tracking-widest text-indigo-300/60 block mb-0.5">Audience fit</span>{clip.hookBreakdown.audience_fit}</div>
            )}
          </div>
        </div>
      )}
      {Array.isArray(clip.evidence) && clip.evidence.length > 0 && (
        <details className="mt-2 text-[11px]">
          <summary className="cursor-pointer list-none chip inline-flex items-center gap-1 select-none">
            Why this clip? — precision {clip.precisionScore != null ? clip.precisionScore : "?"} ({clip.verdict || "?"})
          </summary>
          <ul className="mt-1.5 pl-1 space-y-0.5">
            {clip.evidence.map((e, i) => {
              const icons = { scene_cut: "🎬", audio_event: "🔊", visual_highlight: "👁", audio_peak: "⚡", trending: "📈", hook: "🪝" };
              return (
                <li key={i} className="text-[color:var(--muted)]">
                  {icons[e.type] || "·"} {e.type} at {(+e.t).toFixed(1)}s{e.note ? " — " + e.note : ""}
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {clip.verdict === "weak" && (
        <span className="mt-1 inline-block text-[10px] uppercase tracking-widest text-white/30 border border-white/10 rounded px-1.5 py-0.5">weak</span>
      )}
      {Array.isArray(clip.hookAlts) && clip.hookAlts.length > 0 && (
        <div className="mt-3 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/8 p-3">
          <div className="text-[11px] uppercase tracking-widest text-fuchsia-300/70 mb-2">Hook A/B — pick one</div>
          <div className="grid gap-2">
            {clip.hookAlts.map((alt, i) => alt && (
              <div key={i} className="rounded-lg border border-fuchsia-400/15 bg-fuchsia-500/5 p-2.5 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {alt.frame && (
                    <span className="inline-block text-[10px] uppercase tracking-widest text-fuchsia-300/60 mb-1 border border-fuchsia-400/20 rounded px-1.5 py-0.5">{alt.frame}</span>
                  )}
                  <div className="text-[13px] font-semibold text-white/90 leading-snug">{alt.title}</div>
                  <div className="text-[12px] text-[color:var(--muted)] mt-0.5 leading-snug">{alt.hook}</div>
                </div>
                <button
                  className="chip shrink-0 mt-0.5"
                  onClick={()=>{ onField("title", alt.title); onField("hook", alt.hook); }}
                  aria-label={"Use hook variant " + (i+1)}
                >
                  {I.check({size:12})} Use
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {clip.thumbConcept && typeof clip.thumbConcept === "object" && (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/8 p-3">
          <div className="text-[11px] uppercase tracking-widest text-amber-300/70 mb-2">Thumbnail concept</div>
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-20 h-14 rounded-lg flex flex-col items-center justify-center text-white text-[11px] font-bold leading-tight text-center px-1 shadow-md"
              style={{ backgroundColor: clip.thumbConcept.bg_color || "#1a1a2e" }}>
              <span className="text-xl mb-0.5">{clip.thumbConcept.emoji}</span>
              <span className="uppercase text-[9px] tracking-wide leading-tight">{clip.thumbConcept.text_overlay}</span>
            </div>
            <div className="flex-1 min-w-0 text-[12px] text-[color:var(--muted)]">
              <div className="mb-1"><span className="text-[11px] uppercase tracking-widest text-amber-300/60 block mb-0.5">Text overlay</span>
                <span className="text-white/90 font-semibold">{clip.thumbConcept.text_overlay}</span> {clip.thumbConcept.emoji}
              </div>
              <div className="mb-1"><span className="text-[11px] uppercase tracking-widest text-amber-300/60 block mb-0.5">Background</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm border border-white/10" style={{ backgroundColor: clip.thumbConcept.bg_color }}></span>
                  {clip.thumbConcept.bg_color} — {clip.thumbConcept.bg_label}
                </span>
              </div>
              {clip.thumbConcept.rationale && (
                <div><span className="text-[11px] uppercase tracking-widest text-amber-300/60 block mb-0.5">Why it works</span>{clip.thumbConcept.rationale}</div>
              )}
            </div>
          </div>
        </div>
      )}
      {clip.hookScore && typeof clip.hookScore === "object" && (function(){
        const hs = clip.hookScore;
        const pct = Math.round((hs.score / 10) * 100);
        const barColor = hs.score >= 8 ? "#22d3ee" : hs.score >= 5 ? "#38bdf8" : "#7dd3fc";
        const verdictColor = hs.score >= 8 ? "text-cyan-300" : hs.score >= 5 ? "text-sky-300" : "text-sky-400/80";
        return (
          <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-500/8 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] uppercase tracking-widest text-sky-300/70">Hook speed &#40;first 3s&#41;</div>
              <div className="flex items-center gap-2">
                <span className={"text-[13px] font-bold tabular-nums " + verdictColor}>{hs.score}<span className="text-[10px] font-normal text-sky-300/50">/10</span></span>
                <span className={"text-[11px] px-1.5 py-0.5 rounded border " + (hs.score >= 8 ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-300" : hs.score >= 5 ? "border-sky-400/30 bg-sky-500/10 text-sky-300" : "border-sky-400/20 bg-sky-500/6 text-sky-400/70")}>{hs.verdict}</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/8 mb-3 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{width: pct + "%", backgroundColor: barColor}}></div>
            </div>
            <div className="grid gap-2 text-[12px] text-[color:var(--muted)]">
              {hs.why && <div><span className="text-[11px] uppercase tracking-widest text-sky-300/60 block mb-0.5">Why</span>{hs.why}</div>}
              {hs.fix && <div><span className="text-[11px] uppercase tracking-widest text-sky-300/60 block mb-0.5">Fix</span><span className="text-white/80">{hs.fix}</span></div>}
            </div>
          </div>
        );
      })()}
      {Array.isArray(clip.objections) && clip.objections.length > 0 && (
        <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/8 p-3">
          <div className="text-[11px] uppercase tracking-widest text-emerald-300/70 mb-2">Objection Pre-Answer</div>
          <div className="grid gap-3">
            {clip.objections.map((obj, i) => obj && (
              <div key={i} className="text-[12px]">
                <div><span className="text-[11px] uppercase tracking-widest text-emerald-300/60 block mb-0.5">Objection {i + 1}</span><span className="text-white/80 italic">&ldquo;{obj.objection}&rdquo;</span></div>
                <div className="mt-1"><span className="text-[11px] uppercase tracking-widest text-emerald-300/60 block mb-0.5">Say before it</span><span className="text-emerald-100/90">{obj.preemptive}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {Array.isArray(clip.commentSeeds) && clip.commentSeeds.length > 0 && (
        <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/8 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-widest text-violet-300/70">Comment Seed Kit</div>
            <div className="text-[10px] text-violet-300/50">Paste in first 30 min to seed engagement velocity</div>
          </div>
          <div className="grid gap-2">
            {clip.commentSeeds.map((seed, i) => seed && (
              <div key={i} className="rounded-lg border border-violet-400/15 bg-violet-500/5 p-2.5 flex items-start gap-2">
                <span className="shrink-0 text-[10px] uppercase tracking-widest border border-violet-400/20 bg-violet-500/10 text-violet-200 rounded px-1.5 py-0.5 mt-0.5">{seed.role === "pin" ? "Pin" : seed.role === "ask" ? "Ask" : "Reply-bait"}</span>
                <div className="flex-1 min-w-0 text-[12px] text-white/90 leading-snug">{seed.text}</div>
                <button className="chip shrink-0 mt-0.5" onClick={()=>{ try{ navigator.clipboard.writeText(seed.text); } catch(e){} }} aria-label={"Copy seed comment " + (i+1)}>
                  {I.copy({size:12})} Copy
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
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

/* ---- Re-title / Re-hook / Re-score Claude helper (x68) ---- */
async function regenFieldViaClaude(proxyUrl, clip, project, field){
  const url = (proxyUrl||"").replace(/\/$/, "") + "/v1/messages";
  const isNum = field === "virality";
  const valueProp = isNum
    ? { type: "number", minimum: 0, maximum: 100 }
    : { type: "string" };
  const tool = {
    name: "emit_field",
    description: "Return one regenerated value for the requested clip field.",
    input_schema: { type: "object", properties: { value: valueProp }, required: ["value"] },
  };
  const systemMsgs = {
    title:    "You're rewriting a single short-form clip title. Keep it under 10 words. Use a pattern-interrupt or curiosity gap. Return ONE title variant. No hashtags.",
    hook:     "You're rewriting a single hook for a short-form clip. The hook is the first spoken line; keep it under 90 characters; open with a pattern-interrupt; don't use hashtags; return ONE variant.",
    caption:  "You're rewriting a single short-form clip caption. Keep it punchy, under 200 characters, no hashtags. Return ONE caption variant.",
    virality: "You're scoring a short-form clip's virality potential on a 0-100 scale. 60 is average; 80+ means genuinely scroll-stopping. Return ONE integer score.",
  };
  const brand = (project && project.brand) || "";
  const preset = clip.preset || "vertical";
  const platform = preset === "square" ? "X / LinkedIn" : preset === "landscape" ? "YouTube / LinkedIn" : "TikTok / Reels / Shorts";
  const userMsg = JSON.stringify({
    field,
    brand: brand || undefined,
    platform,
    title: clip.title || "",
    hook: clip.hook || "",
    caption: clip.caption || "",
    virality: clip.virality || 60,
    preset: clip.preset || "vertical",
  });
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: systemMsgs[field] || systemMsgs.title,
      tools: [tool],
      tool_choice: { type: "tool", name: "emit_field" },
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const block = Array.isArray(j.content) ? j.content.find(b => b && b.type === "tool_use" && b.name === "emit_field") : null;
  if(!block || !block.input || block.input.value === undefined) throw new Error("no tool_use");
  return block.input.value;
}
/* ---- end Re-title / Re-hook / Re-score Claude helper ---- */

/* ---- Copy-post Claude helper (x69) ---- */
async function generateSocialPostViaClaude(proxyUrl, clip, project){
  const url = (proxyUrl||"").replace(/\/$/, "") + "/v1/messages";
  const tool = {
    name: "emit_post",
    description: "Return a ready-to-paste social post caption and hashtag array for the given clip.",
    input_schema: {
      type: "object",
      properties: {
        caption:  { type: "string", description: "1-2 sentence caption under 220 chars, platform-tuned, no emoji spam." },
        hashtags: { type: "array", items: { type: "string" }, description: "5-8 lowercase alphanumeric hashtags, no # prefix, no spaces." },
      },
      required: ["caption", "hashtags"],
    },
  };
  const preset = clip.preset || "vertical";
  const platformLabel = preset === "square" ? "X (Twitter) / LinkedIn" : preset === "landscape" ? "YouTube / LinkedIn" : "TikTok / Reels / Shorts";
  const systemMsgs = {
    vertical:  "You're writing a ready-to-paste TikTok / Reels / Shorts post. Refine the caption for this platform's tone, 1-2 sentences under 220 chars, no emoji spam. Then return 5-8 relevant hashtags (lowercase, alphanumeric, no '#' prefix). Return ONE caption variant via the emit_post tool.",
    square:    "You're writing a ready-to-paste X (Twitter) / LinkedIn post. Refine the caption for this platform's tone, 1-2 sentences under 220 chars, no emoji spam. Then return 5-8 relevant hashtags (lowercase, alphanumeric, no '#' prefix). Return ONE caption variant via the emit_post tool.",
    landscape: "You're writing a ready-to-paste YouTube / LinkedIn post. Refine the caption for this platform's tone, 1-2 sentences under 220 chars, no emoji spam. Then return 5-8 relevant hashtags (lowercase, alphanumeric, no '#' prefix). Return ONE caption variant via the emit_post tool.",
  };
  const brand = (project && project.brand) || "";
  const userMsg = JSON.stringify({
    title:    clip.title || "",
    hook:     clip.hook || "",
    caption:  clip.caption || "",
    brand:    brand || undefined,
    preset,
    platform: platformLabel,
  });
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemMsgs[preset] || systemMsgs.vertical,
      tools: [tool],
      tool_choice: { type: "tool", name: "emit_post" },
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const block = Array.isArray(j.content) ? j.content.find(b => b && b.type === "tool_use" && b.name === "emit_post") : null;
  if(!block || !block.input || !block.input.caption) throw new Error("no tool_use");
  const hashtags = Array.isArray(block.input.hashtags) ? block.input.hashtags : [];
  return { caption: block.input.caption, hashtags };
}
/* ---- end Copy-post Claude helper ---- */

/* ---- Per-clip video render helper (x72, overlay x74) ---- */
function wrapTextForCanvas(ctx, text, maxWidth, maxLines){
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for(const w of words){
    const test = cur ? cur + " " + w : w;
    if(ctx.measureText(test).width > maxWidth && cur){
      lines.push(cur);
      cur = w;
      if(lines.length >= maxLines - 1) break;
    } else {
      cur = test;
    }
  }
  if(cur) lines.push(cur);
  if(lines.length > maxLines) lines.length = maxLines;
  return lines;
}
async function renderClipVideoFromUpload(videoUrl, clip, onProgress, options){
  if(!videoUrl) throw new Error("no video");
  const preset = clip.preset || "vertical";
  const dims = preset === "square" ? { w: 720, h: 720 } : preset === "landscape" ? { w: 1280, h: 720 } : { w: 720, h: 1280 };
  const start = Math.max(0, Number(clip.start) || 0);
  const end = Math.max(start + 0.1, Number(clip.end) || (start + 1));
  const duration = end - start;
  const src = document.createElement("video");
  src.src = videoUrl;
  src.crossOrigin = "anonymous";
  src.muted = true; // required for autoplay without a fresh user gesture; captureStream() still surfaces the audio tracks
  src.playsInline = true;
  src.preload = "auto";
  await new Promise((res, rej) => {
    src.onloadedmetadata = () => res();
    src.onerror = () => rej(new Error("video load failed"));
  });
  await new Promise((res, rej) => {
    src.onseeked = () => res();
    src.onerror = () => rej(new Error("seek failed"));
    try { src.currentTime = start; } catch(e){ rej(e); }
  });
  const canvas = document.createElement("canvas");
  canvas.width = dims.w;
  canvas.height = dims.h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, dims.w, dims.h);
  const sw = src.videoWidth || 1280, sh = src.videoHeight || 720;
  const fitMode = (options && options.fit) || "cover";
  const scale = fitMode === "contain"
    ? Math.min(dims.w / sw, dims.h / sh)
    : Math.max(dims.w / sw, dims.h / sh);
  const dw = sw * scale, dh = sh * scale;
  const dx = (dims.w - dw) / 2, dy = (dims.h - dh) / 2;
  const overlay = (options && options.overlay) || {};
  const hookText = (overlay.hook || "").trim();
  const fontPx = preset === "vertical" ? 52 : preset === "square" ? 42 : 40;
  const maxLines = preset === "landscape" ? 2 : 3;
  const overlayPad = 24;
  const maxTextWidth = dims.w - overlayPad * 2 - 32;
  ctx.font = "bold " + fontPx + "px system-ui, -apple-system, 'Segoe UI', sans-serif";
  const overlayLines = hookText ? wrapTextForCanvas(ctx, hookText, maxTextWidth, maxLines) : [];
  const lineH = Math.round(fontPx * 1.2);
  const blockH = overlayLines.length ? overlayLines.length * lineH + overlayPad * 2 : 0;
  const blockY = preset === "landscape" ? dims.h - blockH - 40 : Math.round(dims.h * 0.68);
  const videoStream = canvas.captureStream(30);
  let audioTrack = null;
  try {
    const capFn = src.captureStream || src.mozCaptureStream;
    if(capFn){
      const vs = capFn.call(src);
      const ats = vs.getAudioTracks();
      if(ats && ats.length) audioTrack = ats[0];
    }
  } catch(e){ /* no audio */ }
  const combined = new MediaStream();
  videoStream.getVideoTracks().forEach(t => combined.addTrack(t));
  if(audioTrack) combined.addTrack(audioTrack);
  const mimeTry = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  let mime = "";
  for(const m of mimeTry){ if(window.MediaRecorder && MediaRecorder.isTypeSupported(m)){ mime = m; break; } }
  const rec = new MediaRecorder(combined, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if(e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => { rec.onstop = () => res(); });
  rec.start(100);
  const drawId = { raf: 0, stop: false };
  const draw = () => {
    if(drawId.stop) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, dims.w, dims.h);
    try { ctx.drawImage(src, dx, dy, dw, dh); } catch(e){}
    if(overlayLines.length){
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(overlayPad, blockY, dims.w - overlayPad * 2, blockH);
      ctx.font = "bold " + fontPx + "px system-ui, -apple-system, 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineWidth = Math.max(3, Math.round(fontPx / 14));
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.fillStyle = "#ffffff";
      const cx = dims.w / 2;
      for(let i = 0; i < overlayLines.length; i++){
        const ly = blockY + overlayPad + i * lineH;
        ctx.strokeText(overlayLines[i], cx, ly);
        ctx.fillText(overlayLines[i], cx, ly);
      }
    }
    drawId.raf = requestAnimationFrame(draw);
  };
  draw();
  await src.play();
  await new Promise((res) => {
    const tick = () => {
      const t = src.currentTime - start;
      if(typeof onProgress === "function") onProgress(Math.min(1, Math.max(0, t / duration)));
      if(src.currentTime >= end || src.ended){ res(); return; }
      setTimeout(tick, 100);
    };
    tick();
  });
  drawId.stop = true;
  try { cancelAnimationFrame(drawId.raf); } catch(e){}
  try { src.pause(); } catch(e){}
  try { rec.stop(); } catch(e){}
  await done;
  try { src.src = ""; } catch(e){}
  const blob = new Blob(chunks, { type: mime || "video/webm" });
  return blob;
}
/* ---- end Per-clip video render helper ---- */

/* ---- Hook Breakdown Panel helpers (x58) ---- */
async function generateHookBreakdownViaClaude(proxyUrl, clip, project){
  const url = (proxyUrl||"").replace(/\/$/, "") + "/v1/messages";
  const tool = {
    name: "emit_hook_breakdown",
    description: "Explain why a short-form clip will perform well: emotional trigger, curiosity gap, and audience fit.",
    input_schema: {
      type: "object",
      properties: {
        emotional_trigger: { type: "string", description: "1-2 sentences: the core emotion this clip activates (e.g. fear of missing out, pride, surprise)." },
        curiosity_gap:     { type: "string", description: "1-2 sentences: what unknown the hook creates that keeps viewers watching." },
        audience_fit:      { type: "string", description: "1-2 sentences: which audience segment this will over-perform with and why." },
        one_liner:         { type: "string", description: "A punchy 10-15 word summary of why this clip wins." },
      },
      required: ["emotional_trigger","curiosity_gap","audience_fit","one_liner"],
    },
  };
  const systemMsg = "You are a short-form video strategist. Given a clip's title, hook, and caption, explain why it will perform well on social media. Use the provided tool. Be specific and concrete — no generic advice.";
  const brand = (project && project.brand) || "";
  const userMsg = [
    brand ? "BRAND: " + brand : "",
    "CLIP TITLE: " + (clip.title||""),
    "HOOK: " + (clip.hook||""),
    "CAPTION: " + (clip.caption||""),
    "VIRALITY SCORE: " + (clip.virality||60) + "/100",
  ].filter(Boolean).join("\n\n");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemMsg,
      tools: [tool],
      tool_choice: { type: "tool", name: "emit_hook_breakdown" },
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const block = Array.isArray(j.content) ? j.content.find(c => c && c.type === "tool_use" && c.name === "emit_hook_breakdown") : null;
  if(!block || !block.input) throw new Error("no tool_use");
  return block.input;
}
function generateHookBreakdownLocal(clip){
  const v = clip.virality || 60;
  const title = (clip.title||"").toLowerCase();
  const hasSurprise = /truth|secret|actually|nobody|surprising|counterintuitive|debunk|mistake/.test(title);
  const hasNumber = /\d/.test(title);
  const hasContrast = /vs|versus|over|instead|not/.test(title);
  const emotional_trigger = hasSurprise
    ? "This clip triggers surprise and mild cognitive dissonance — viewers feel they've been missing something obvious. That discomfort drives shares."
    : hasContrast
    ? "The contrast framing activates a mild fear of being wrong, which primes viewers to watch through to validate or update their belief."
    : "The direct, specific claim creates a moment of recognition for viewers already invested in this topic — fueling saves and replays.";
  const curiosity_gap = hasNumber
    ? "Specific numbers in the hook promise a concrete payoff. Viewers stay to get the exact figure rather than a vague takeaway."
    : hasSurprise
    ? "The hook implies the viewer's current mental model is incomplete. They watch to find out exactly how — a classic open loop."
    : "The hook names a mechanism without explaining it, creating a small knowledge gap that compels the viewer to fill it.";
  const audience_fit = v >= 80
    ? "High overlap with health, productivity, and self-improvement audiences — segments with the highest save-and-share rates on short-form."
    : v >= 65
    ? "Strong fit for curious generalists who engage with explainer content. Likely to perform above average in the 25-40 demographic."
    : "Solid niche appeal for topic insiders. Engagement depth (comments, saves) will outperform raw view count.";
  const one_liner = hasSurprise
    ? "Surprise + concrete claim = instant pattern-interrupt for the scroll."
    : hasContrast
    ? "Contrast framing stokes the viewer's need to know who's right."
    : "Specific insight with clear audience relevance earns the watch.";
  return { emotional_trigger, curiosity_gap, audience_fit, one_liner };
}
/* ---- end Hook Breakdown Panel helpers ---- */

/* ---- Hook A/B Generator helpers (x59) ---- */
async function generateHookAltsViaClaude(proxyUrl, clip, project){
  const url = (proxyUrl||"").replace(/\/$/, "") + "/v1/messages";
  const tool = {
    name: "emit_hook_alts",
    description: "Generate 3 alternative hook/title pairs for a short-form clip. Each variant uses a different persuasion frame.",
    input_schema: {
      type: "object",
      properties: {
        alt1: {
          type: "object",
          description: "Curiosity-gap variant — opens an unanswered question.",
          properties: { title: { type: "string" }, hook: { type: "string" }, frame: { type: "string", description: "One-word label for the frame used, e.g. 'Curiosity'" } },
          required: ["title","hook","frame"],
        },
        alt2: {
          type: "object",
          description: "Identity/tribe variant — speaks directly to a specific audience identity.",
          properties: { title: { type: "string" }, hook: { type: "string" }, frame: { type: "string" } },
          required: ["title","hook","frame"],
        },
        alt3: {
          type: "object",
          description: "Contrarian/surprise variant — challenges a common belief.",
          properties: { title: { type: "string" }, hook: { type: "string" }, frame: { type: "string" } },
          required: ["title","hook","frame"],
        },
      },
      required: ["alt1","alt2","alt3"],
    },
  };
  const systemMsg = "You are a short-form video hook writer. Given a clip's current title, hook, and platform preset, produce 3 alternative title+hook pairs that each use a distinct persuasion frame. Titles ≤ 10 words. Hooks ≤ 15 words. Be specific to the clip topic — no generic filler.";
  const brand = (project && project.brand) || "";
  const preset = clip.preset || "vertical";
  const platform = preset === "square" ? "X / LinkedIn" : preset === "landscape" ? "YouTube / LinkedIn" : "TikTok / Reels / Shorts";
  const userMsg = [
    brand ? "BRAND: " + brand : "",
    "PLATFORM: " + platform,
    "CURRENT TITLE: " + (clip.title||""),
    "CURRENT HOOK: " + (clip.hook||""),
    "CAPTION: " + (clip.caption||""),
    "VIRALITY SCORE: " + (clip.virality||60) + "/100",
  ].filter(Boolean).join("\n\n");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemMsg,
      tools: [tool],
      tool_choice: { type: "tool", name: "emit_hook_alts" },
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const block = Array.isArray(j.content) ? j.content.find(c => c && c.type === "tool_use" && c.name === "emit_hook_alts") : null;
  if(!block || !block.input) throw new Error("no tool_use");
  return [block.input.alt1, block.input.alt2, block.input.alt3];
}
function generateHookAltsLocal(clip){
  const title = (clip.title||"").trim();
  const v = clip.virality || 60;
  // Three frames: curiosity, identity, contrarian
  const curiosityTitles = [
    "The one thing nobody tells you about this",
    "Why this works when everything else fails",
    "What actually happens when you do this",
  ];
  const identityTitles = [
    "If you care about your results, watch this",
    "For the 1% who want a real edge",
    "This is for people who are serious about it",
  ];
  const contrarianTitles = [
    "Stop doing what everyone recommends",
    "The advice you've been following is wrong",
    "Counterintuitive truth most people miss",
  ];
  const curiosityHooks = [
    "The answer surprised every expert we asked.",
    "Nobody talks about the second part of this.",
    "Stay for the part that changes everything.",
  ];
  const identityHooks = [
    "This is what separates the top 1% from everyone else.",
    "If you're serious, this is non-negotiable.",
    "High performers already know this. Now you do too.",
  ];
  const contrarianHooks = [
    "Everything you've heard about this is backwards.",
    "The mainstream advice is making things worse.",
    "Research says the opposite of what you think.",
  ];
  const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];
  return [
    { title: pick(curiosityTitles), hook: pick(curiosityHooks), frame: "Curiosity" },
    { title: pick(identityTitles),  hook: pick(identityHooks),  frame: "Identity" },
    { title: pick(contrarianTitles),hook: pick(contrarianHooks),frame: "Contrarian" },
  ];
}
/* ---- end Hook A/B Generator helpers ---- */

/* ---- Thumbnail Concept Generator helpers (x60) ---- */
async function generateThumbnailConceptViaClaude(proxyUrl, clip, project){
  const url = (proxyUrl||"").replace(/\/$/, "") + "/v1/messages";
  const tool = {
    name: "emit_thumbnail_concept",
    description: "Generate a short-form thumbnail concept for a clip: a bold text overlay (max 6 words), a single emoji that amplifies the message, and a background color cue as a hex code.",
    input_schema: {
      type: "object",
      properties: {
        text_overlay: { type: "string", description: "Bold text to overlay on thumbnail, max 6 words, all caps OK, no punctuation." },
        emoji: { type: "string", description: "Single emoji that amplifies the hook visually." },
        bg_color: { type: "string", description: "Hex color code for background mood, e.g. #1a1a2e for dark mystery, #ff6b35 for energy." },
        bg_label: { type: "string", description: "One-word label for the color mood, e.g. 'dark', 'energetic', 'calm', 'bold'." },
        rationale: { type: "string", description: "One sentence explaining why this concept fits the hook." },
      },
      required: ["text_overlay","emoji","bg_color","bg_label","rationale"],
    },
  };
  const systemMsg = "You are a short-form video thumbnail designer. Given a clip title and hook, produce a thumbnail concept that maximises click-through. Return tool_use only.";
  const userMsg = "CLIP TITLE: " + (clip.title||"") + "\n\nHOOK: " + (clip.hook||"") + "\n\nCAPTION DRAFT: " + (clip.caption||"");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemMsg,
      tools: [tool],
      tool_choice: { type: "tool", name: "emit_thumbnail_concept" },
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const block = Array.isArray(j.content) ? j.content.find(c => c && c.type === "tool_use" && c.name === "emit_thumbnail_concept") : null;
  if(!block || !block.input) throw new Error("no tool_use");
  return block.input;
}
function generateThumbnailConceptLocal(clip){
  const title = (clip.title||"").toUpperCase();
  const words = title.split(/\s+/).filter(Boolean).slice(0,6);
  const text_overlay = words.slice(0,5).join(" ") || "WATCH THIS";
  const virality = clip.virality || 60;
  let emoji = "🔥";
  let bg_color = "#1a1a2e";
  let bg_label = "dark";
  let rationale = "High-contrast dark background with bold overlay maximises perceived value.";
  if(/truth|secret|reveal|know/i.test(title)){
    emoji = "👀"; bg_color = "#0d0d0d"; bg_label = "mystery";
    rationale = "Dark mystery palette signals exclusive information that builds curiosity.";
  } else if(/money|income|rich|profit|earn/i.test(title)){
    emoji = "💰"; bg_color = "#1a2e1a"; bg_label = "growth";
    rationale = "Green-tinted bg ties visually to financial success cues.";
  } else if(/mistake|wrong|stop|never/i.test(title)){
    emoji = "🚨"; bg_color = "#2e1a1a"; bg_label = "urgency";
    rationale = "Red-tinted bg triggers urgency and stop-scroll impulse.";
  } else if(virality >= 80){
    emoji = "🚀"; bg_color = "#1a1a2e"; bg_label = "viral";
    rationale = "High virality clip benefits from bold high-energy thumbnail.";
  } else if(/how|step|way|trick|hack/i.test(title)){
    emoji = "🎯"; bg_color = "#1a2a2e"; bg_label = "clear";
    rationale = "Teal-dark bg signals instructional clarity.";
  }
  return { text_overlay, emoji, bg_color, bg_label, rationale };
}
/* ---- end Thumbnail Concept Generator helpers ---- */

/* ---- First-3-Seconds Scorecard helpers (x61) ---- */
async function generateHookScoreViaClaude(proxyUrl, clip){
  const url = (proxyUrl||"").replace(/\/$/, "") + "/v1/messages";
  const tool = {
    name: "emit_hook_score",
    description: "Score how effectively a short-form video hook grabs attention within the first 3 seconds. Return a 1-10 score, a pass/fail verdict, a concrete one-sentence fix, and a one-sentence explanation of the score.",
    input_schema: {
      type: "object",
      properties: {
        score:   { type: "integer", description: "Hook speed score from 1 (painfully slow) to 10 (instant attention grab). Base on word count, specificity, and pattern-interruption in the first 10 words." },
        verdict: { type: "string",  description: "Short verdict label: one of 'Strong hook', 'Needs work', or 'Too slow'. Match score: 8-10 = Strong hook, 5-7 = Needs work, 1-4 = Too slow." },
        why:     { type: "string",  description: "One sentence explaining why the hook earns this score — be specific about what works or fails." },
        fix:     { type: "string",  description: "One concrete, actionable rewrite suggestion that would raise the score by at least 2 points. Start with a verb." },
      },
      required: ["score","verdict","why","fix"],
    },
  };
  const systemMsg = "You are a short-form video hook specialist. Analyze the clip title and hook text to score how quickly it would grab a viewer scrolling at 1x speed. Focus on the first 3 seconds of comprehension. Return tool_use only.";
  const userMsg = "CLIP TITLE: " + (clip.title||"") + "\n\nHOOK: " + (clip.hook||"") + "\n\nCAPTION PREVIEW: " + (clip.caption||"");
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 400, system: systemMsg, tools: [tool], tool_choice: { type: "tool", name: "emit_hook_score" }, messages: [{ role: "user", content: userMsg }] }) });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const block = Array.isArray(j.content) ? j.content.find(c => c && c.type === "tool_use" && c.name === "emit_hook_score") : null;
  if(!block || !block.input) throw new Error("no tool_use");
  const s = block.input;
  s.score = Math.max(1, Math.min(10, parseInt(s.score, 10) || 5));
  return s;
}
function generateHookScoreLocal(clip){
  const hook = (clip.hook || clip.title || "").trim();
  const words = hook.split(/\s+/).filter(Boolean);
  let score = 5;
  // Boost: short hook (≤8 words), question mark, number, colon, power words
  if(words.length <= 5) score += 2;
  else if(words.length <= 8) score += 1;
  else if(words.length >= 15) score -= 2;
  if(/\?/.test(hook)) score += 1;
  if(/\d/.test(hook)) score += 1;
  if(/\b(never|always|secret|truth|real|why|stop|mistake|fix|hack|fastest|only)\b/i.test(hook)) score += 1;
  if(/^(the |a |an |in |on |at |if )/i.test(hook)) score -= 1;
  score = Math.max(1, Math.min(10, score));
  const verdict = score >= 8 ? "Strong hook" : score >= 5 ? "Needs work" : "Too slow";
  const why = score >= 8
    ? "The hook is punchy and specific — viewers know what they're getting instantly."
    : score >= 5
    ? "The hook is clear but doesn't create enough urgency in the first three seconds."
    : "The hook is too slow to stop a thumb mid-scroll — it takes too long to reach the payoff.";
  const fix = score >= 8
    ? "Test leading with the most surprising fact to push the score even higher."
    : score >= 5
    ? "Move the most intriguing word or number to the very first three words."
    : "Rewrite opening with a bold claim or specific number before the fifth word.";
  return { score, verdict, why, fix };
}
/* ---- end First-3-Seconds Scorecard helpers ---- */

/* ---- Objection Pre-Answer helpers (x62) ---- */
async function generateObjAnswerViaClaude(proxyUrl, clip, project){
  const url = (proxyUrl||"").replace(/\/$/, "") + "/v1/messages";
  const tool = {
    name: "emit_objections",
    description: "Predict up to 3 viewer objections that could cause mid-clip drop-off, and generate a 1–2 sentence preemptive script line the creator can say *before* each objection fires.",
    input_schema: {
      type: "object",
      properties: {
        objections: {
          type: "array",
          maxItems: 3,
          description: "Array of up to 3 objection+preemptive pairs ordered by drop-off risk (highest first).",
          items: {
            type: "object",
            properties: {
              objection: { type: "string", description: "The viewer's internal pushback in plain language, ≤12 words, written as a thought they'd have mid-watch (e.g. 'That only works if you already have money')." },
              preemptive: { type: "string", description: "1–2 sentence script line the creator says *before* this objection fires. Start with a transitional phrase like 'Now you might be thinking…' or 'Before you say…'. Keep it conversational." },
            },
            required: ["objection","preemptive"],
          },
        },
      },
      required: ["objections"],
    },
  };
  const brand = (project && project.brand) || "";
  const systemMsg = "You are a short-form video retention coach. Analyze the clip content and predict the top viewer objections that cause people to stop watching before the end. For each, write a preemptive script line the creator can weave in to neutralize the objection before it forms. Return tool_use only.";
  const userMsg = "BRAND: " + brand + "\n\nCLIP TITLE: " + (clip.title||"") + "\n\nHOOK: " + (clip.hook||"") + "\n\nCAPTION: " + (clip.caption||"");
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 700, system: systemMsg, tools: [tool], tool_choice: { type: "tool", name: "emit_objections" }, messages: [{ role: "user", content: userMsg }] }) });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const block = Array.isArray(j.content) ? j.content.find(c => c && c.type === "tool_use" && c.name === "emit_objections") : null;
  if(!block || !block.input) throw new Error("no tool_use");
  const arr = Array.isArray(block.input.objections) ? block.input.objections : [];
  return arr.filter(o => o && o.objection && o.preemptive).slice(0, 3);
}
function generateObjAnswerLocal(clip){
  const text = ((clip.title||"") + " " + (clip.hook||"") + " " + (clip.caption||"")).toLowerCase();
  const pools = [
    {
      triggers: ["money","invest","financ","rich","wealth","afford","cost","price","cheap","expensiv"],
      objection: "That only works if you already have money",
      preemptive: "Now before you say this is only for people with a big budget — the research shows the opposite. The smallest consistent action outperforms the occasional large one every time.",
    },
    {
      triggers: ["time","busy","schedule","daily","morning","habit","routine","every day","consistent"],
      objection: "I don't have time for this",
      preemptive: "I know what you're thinking — you don't have time. But we're talking about something so small it fits in a gap you already have.",
    },
    {
      triggers: ["science","study","research","evidence","proof","data","fact","expert","doctor"],
      objection: "That's just one cherry-picked study",
      preemptive: "And yes, a single study can be misleading — so let me give you the meta-analysis picture instead of just one data point.",
    },
    {
      triggers: ["hard","difficult","disciplin","motivat","willpower","effort","challeng","tough"],
      objection: "I've tried this before and it didn't work",
      preemptive: "Here's the part most people skip: the reason it didn't stick last time probably wasn't you — it was the sequence. Let me show you what changes the outcome.",
    },
    {
      triggers: ["everyone","always","never","best","worst","all","most","guaranteed","definit"],
      objection: "This sounds too good to be true",
      preemptive: "Before you scroll — I'm not going to tell you this works for everyone, because it doesn't. But here's the specific condition where it consistently does.",
    },
  ];
  const matched = pools.filter(p => p.triggers.some(t => text.includes(t)));
  const fallback = [
    { objection: "This doesn't apply to my situation", preemptive: "Now, this might feel niche — but the underlying principle applies much more broadly than you might think. Here's why." },
    { objection: "I've heard this before", preemptive: "Stay with me, because the part most people miss — even if they've seen a version of this — is coming up in about ten seconds." },
  ];
  const results = matched.length > 0 ? matched.slice(0, 3) : fallback.slice(0, 2);
  return results.map(r => ({ objection: r.objection, preemptive: r.preemptive }));
}
/* ---- end Objection Pre-Answer helpers ---- */

/* ---- Comment Seed Kit helpers (x63) ---- */
async function generateCommentSeedsViaClaude(proxyUrl, clip, project){
  const url = (proxyUrl||"").replace(/\/$/, "") + "/v1/messages";
  const tool = {
    name: "emit_comment_seeds",
    description: "Generate exactly 3 ready-to-paste seed comments the creator posts on their own clip within the first 30 minutes to boost algorithmic engagement velocity.",
    input_schema: {
      type: "object",
      properties: {
        seeds: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          description: "Exactly 3 seed comments, one for each role: pin, ask, reply.",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["pin","ask","reply"], description: "pin = creator-pins this; adds a killer stat or reinforces the hook. ask = open question to strangers to drive replies. reply = pre-written response to preempt the most likely objection comment." },
              text: { type: "string", description: "The comment text as the creator would post it. 1–2 sentences, conversational, no hashtags, no emoji spam, no self-promotion beyond the clip itself. Under 240 chars." },
            },
            required: ["role","text"],
          },
        },
      },
      required: ["seeds"],
    },
  };
  const brand = (project && project.brand) || "";
  const systemMsg = "You are a short-form growth strategist. The creator has just posted this clip. Generate exactly 3 seed comments they will paste on their own post within 30 minutes — one to pin (reinforces or extends the hook), one to ask (open question that invites strangers to reply), one reply-bait (pre-written response to the most likely dissenting comment). Tone: human, conversational, no hashtags, no emoji spam. Return tool_use only.";
  const userMsg = "BRAND: " + brand + "\n\nCLIP TITLE: " + (clip.title||"") + "\n\nHOOK: " + (clip.hook||"") + "\n\nCAPTION: " + (clip.caption||"");
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 700, system: systemMsg, tools: [tool], tool_choice: { type: "tool", name: "emit_comment_seeds" }, messages: [{ role: "user", content: userMsg }] }) });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const block = Array.isArray(j.content) ? j.content.find(c => c && c.type === "tool_use" && c.name === "emit_comment_seeds") : null;
  if(!block || !block.input) throw new Error("no tool_use");
  const arr = Array.isArray(block.input.seeds) ? block.input.seeds : [];
  return arr.filter(s => s && s.role && s.text).slice(0, 3);
}
function generateCommentSeedsLocal(clip){
  const title = (clip.title||"").trim();
  const hook = (clip.hook||"").trim();
  const text = (title + " " + hook + " " + (clip.caption||"")).toLowerCase();
  const topicPools = [
    {
      triggers: ["money","invest","financ","rich","wealth","afford","cost","price"],
      pin: "One number I cut for length: most people underestimate compounding by 3x. Stay for the timestamp at the end — that's where this actually lands.",
      ask: "What's the smallest money-habit that made the biggest difference for you? Genuinely asking — reading every reply.",
      reply: "Before anyone says 'this only works if you already have money' — it doesn't. The mechanism is the same at any scale, and the research on small-stake behavior backs it up.",
    },
    {
      triggers: ["time","busy","schedule","habit","routine","morning","daily"],
      pin: "The version I actually do is 90 seconds, not 10 minutes. Pinning this because most people bounce at the length claim.",
      ask: "What's the one tiny habit that stuck for you past the first 2 weeks? Curious what survives in the real world.",
      reply: "For the 'no time' crew — the whole point is this fits in gaps you already have. You don't add a slot; you use one.",
    },
    {
      triggers: ["science","study","research","evidence","proof","data","fact"],
      pin: "Sources in the thread. I'm linking the meta-analysis, not the single study, because the single-study version gets misquoted constantly.",
      ask: "Which part of this was new to you? Trying to figure out what to make the next one on.",
      reply: "For the 'one study isn't enough' replies — totally fair. The video is based on the meta-analysis; I'll drop the DOI in the replies.",
    },
  ];
  const matched = topicPools.filter(p => p.triggers.some(t => text.includes(t)));
  const chosen = matched[0] || {
    pin: "The part I had to cut for time is actually the best part — pinning this so you don't miss it: " + (hook ? hook.slice(0, 140) : "the payoff is in the last 10 seconds."),
    ask: "What did you take away from this? Genuinely curious — first 10 replies get a follow-up clip on whatever comes up.",
    reply: "For anyone about to comment 'this isn't for me' — the underlying point applies way more broadly than the specific example. Here's the general version …",
  };
  return [
    { role: "pin", text: chosen.pin },
    { role: "ask", text: chosen.ask },
    { role: "reply", text: chosen.reply },
  ];
}
/* ---- end Comment Seed Kit helpers ---- */

function YouTubeDownloaderCard({ toast }){
  const [urlIn, setUrlIn] = useState("");
  const [formats, setFormats] = useState([]);
  const [videoMeta, setVideoMeta] = useState(null);
  const [itag, setItag] = useState(0);
  const [dirHandle, setDirHandle] = useState(null);
  const [dirName, setDirName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg] = useState("");
  const supportsDirPicker = typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

  const workerBase = () => {
    const path = getAnthropicPath();
    return path ? path.replace(/\/anthropic\/?$/, "") : "https://zaidsaid-proxy.zaidsaid.workers.dev";
  };

  const fetchFormats = async () => {
    setErrMsg("");
    const v = (urlIn || "").trim();
    if(!v){ toast && toast("Paste a YouTube URL first", "error"); return; }
    setBusy(true); setStatus("Fetching formats…"); setProgress(0);
    try {
      const res = await fetch(workerBase() + "/youtube-formats?url=" + encodeURIComponent(v));
      const data = await res.json().catch(() => ({}));
      if(!res.ok) throw new Error(data.error || ("HTTP " + res.status));
      const fs = Array.isArray(data.formats)
        ? data.formats.slice().sort((a,b)=> (b.height||0) - (a.height||0) || (b.contentLength||0) - (a.contentLength||0))
        : [];
      if(!fs.length) throw new Error("No downloadable progressive formats returned — this video may be restricted.");
      setFormats(fs);
      setItag(fs[0].itag);
      setVideoMeta({ title: data.title || "", author: data.author || "", videoId: data.videoId, lengthSeconds: data.lengthSeconds || 0 });
      setStatus(fs.length + " formats available");
      toast && toast("Fetched " + fs.length + " formats", "success");
    } catch (err) {
      const msg = String((err && err.message) || err);
      setErrMsg(msg);
      setStatus("");
      toast && toast("Couldn't fetch formats: " + msg, "error");
    } finally { setBusy(false); }
  };

  const pickFolder = async () => {
    if(!supportsDirPicker){
      toast && toast("Your browser doesn't support folder picking — file will go to your default Downloads folder.", "warn");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      setDirHandle(handle);
      setDirName(handle.name || "(folder)");
      toast && toast("Save folder set", "success");
    } catch (err) {
      if(err && err.name !== "AbortError") toast && toast("Folder picker error: " + (err && err.message), "error");
    }
  };

  const startDownload = async () => {
    setErrMsg("");
    if(!videoMeta || !itag){ toast && toast("Fetch formats and pick a quality first", "error"); return; }
    const fmt = formats.find(f => f.itag === itag);
    const ext = (fmt && fmt.mimeType || "").includes("webm") ? "webm" : "mp4";
    const safeTitle = (videoMeta.title || videoMeta.videoId).replace(/[^A-Za-z0-9._ -]+/g, "_").slice(0, 80) || videoMeta.videoId;
    const filename = safeTitle + "." + ext;
    setBusy(true); setProgress(0); setStatus("Starting download…");
    try {
      const mediaUrl = workerBase() + "/youtube-media?v=" + encodeURIComponent(videoMeta.videoId) + "&itag=" + itag;
      const res = await fetch(mediaUrl);
      if(!res.ok || !res.body){
        let msg = "Server returned " + res.status;
        try { const j = await res.json(); if(j && j.error) msg = j.error; } catch(_){}
        throw new Error(msg);
      }
      const total = Number(res.headers.get("content-length")) || (fmt && fmt.contentLength) || 0;
      const reader = res.body.getReader();

      if(dirHandle){
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        let received = 0;
        while(true){
          const { done, value } = await reader.read();
          if(done) break;
          await writable.write(value);
          received += value.length;
          if(total) setProgress(Math.round((received / total) * 100));
          setStatus((received/1048576).toFixed(1) + " MB" + (total ? " of " + (total/1048576).toFixed(1) + " MB" : " downloaded"));
        }
        await writable.close();
        setProgress(100);
        setStatus("Saved to " + (dirName || "chosen folder") + " / " + filename);
        toast && toast("Saved to " + (dirName || "chosen folder"), "success");
      } else {
        const chunks = [];
        let received = 0;
        while(true){
          const { done, value } = await reader.read();
          if(done) break;
          chunks.push(value);
          received += value.length;
          if(total) setProgress(Math.round((received / total) * 100));
          setStatus((received/1048576).toFixed(1) + " MB" + (total ? " of " + (total/1048576).toFixed(1) + " MB" : " downloaded"));
        }
        const blob = new Blob(chunks, { type: (fmt && fmt.mimeType) || "video/mp4" });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl; a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { try { URL.revokeObjectURL(blobUrl); a.remove(); } catch(e){} }, 1000);
        setProgress(100);
        setStatus("Download started — check your default Downloads folder (" + filename + ")");
        toast && toast("Downloaded " + filename, "success");
      }
    } catch (err) {
      const msg = String((err && err.message) || err);
      setErrMsg(msg);
      toast && toast("Download failed: " + msg, "error");
    } finally { setBusy(false); }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Tool</div>
          <div className="text-lg font-semibold">YouTube downloader</div>
          <div className="text-[12px] text-[color:var(--muted)] mt-1">Paste a link, pick a quality, save to a folder on your computer. Progressive mp4 / webm only (up to ~720p for most videos).</div>
        </div>
      </div>
      <div className="mt-4 grid md:grid-cols-3 gap-3">
        <label className="md:col-span-2 block">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">YouTube URL</span>
          <div className="mt-1 flex items-center gap-2 bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 focus-within:border-white/20">
            <span className="text-[color:var(--muted)]" aria-hidden>{I.link({size:14})}</span>
            <input
              value={urlIn}
              onChange={(e)=>setUrlIn(e.target.value)}
              onKeyDown={(e)=>{ if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); fetchFormats(); } }}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
              disabled={busy}
            />
            <button type="button" className="btn btn-primary shrink-0" onClick={fetchFormats} disabled={busy || !urlIn.trim()} title="Press Enter">
              {busy && !formats.length ? I.refresh({size:14}) : I.arrow({size:14})}
              <span className="ml-1 text-[12px]">{busy && !formats.length ? "Fetching…" : "Fetch formats"}</span>
            </button>
          </div>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Quality</span>
          <select
            value={itag || ""}
            onChange={(e)=>setItag(parseInt(e.target.value||"0", 10)||0)}
            className="mt-1 w-full bg-transparent border border-[color:var(--line)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20"
            disabled={busy || !formats.length}
          >
            {!formats.length && <option value="" style={{background:"#0b0b10"}}>— fetch formats first —</option>}
            {formats.map(f => (
              <option key={f.itag} value={f.itag} style={{background:"#0b0b10"}}>
                {(f.qualityLabel || (f.height ? f.height + "p" : "unknown"))}
                {(f.mimeType||"").includes("webm") ? " · webm" : " · mp4"}
                {f.fps ? " · " + f.fps + "fps" : ""}
                {f.contentLength ? " · " + (f.contentLength/1048576).toFixed(1) + " MB" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {videoMeta && (
        <div className="mt-3 text-[12px] text-[color:var(--muted)]">
          <span className="text-white">{videoMeta.title || videoMeta.videoId}</span>
          {videoMeta.author ? <> · {videoMeta.author}</> : null}
          {videoMeta.lengthSeconds ? <> · {hmsFromSec(videoMeta.lengthSeconds)}</> : null}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="btn"
          onClick={pickFolder}
          disabled={busy || !supportsDirPicker}
          title={supportsDirPicker ? "Choose a folder to save the video into" : "This browser doesn't support folder picking — file will save to your default Downloads folder."}
        >
          {I.folder({size:14})}
          <span className="ml-1 text-[12px]">{dirHandle ? ("Folder: " + dirName) : (supportsDirPicker ? "Choose folder" : "Folder picker unsupported")}</span>
        </button>
        {dirHandle && (
          <button type="button" className="chip" onClick={()=>{ setDirHandle(null); setDirName(""); }}>Clear folder</button>
        )}
        <button
          type="button"
          className={"btn " + (busy || !itag ? "opacity-60 cursor-not-allowed" : "btn-primary")}
          onClick={startDownload}
          disabled={busy || !itag}
        >
          {I.arrow({size:14})}
          <span className="ml-1 text-[12px]">{busy ? "Working…" : "Download"}</span>
        </button>
        {!supportsDirPicker && (
          <span className="text-[11px] text-[color:var(--muted)]">Chrome/Edge support picking a folder. Other browsers save to the default Downloads folder.</span>
        )}
      </div>
      {(progress > 0 || status) && (
        <div className="mt-3">
          {progress > 0 && progress < 100 && (
            <div className="h-1 w-full rounded-full overflow-hidden bg-white/5">
              <div className="h-full" style={{width: progress + "%", background: "linear-gradient(90deg,var(--brand),var(--brand2))"}} />
            </div>
          )}
          {status && <div className="mt-1 text-[11px] text-[color:var(--muted)]">{status}</div>}
        </div>
      )}
      {errMsg && <div className="mt-2 text-[12px] text-rose-300">Error: {errMsg}</div>}
    </div>
  );
}

function RepurposeTab(){
  const [project, setProject] = useLocalState("repurpose.project", REPURPOSE_SEED);
  useEffect(() => {
    if(project && typeof project === "object" && Array.isArray(project.clips) && project.clips.length > 0) return;
    // x94: don't reseed to the Huberman demo if the user already has their own
    // source in flight. Otherwise clicking Generate (which clears clips) would
    // cause the next mount to wipe everything back to the demo.
    const hasOwnSource = project && (
      project.uploadedVideoUrl ||
      project.uploadedVideoName ||
      (project.source && String(project.source).trim() && !/example\.com/i.test(project.source)) ||
      (project.transcriptText && String(project.transcriptText).trim())
    );
    if(hasOwnSource) return;
    setProject(REPURPOSE_SEED);
  }, []);
  const [sort, setSort] = useLocalState("repurpose.sort", "virality");
  const [selected, setSelected] = useLocalState("repurpose.selected", []);
  const [batchPreset, setBatchPreset] = useLocalState("repurpose.batchPreset", "vertical");
  const [explainBusyId, setExplainBusyId] = useState(null);
  const [explainAllBusy, setExplainAllBusy] = useState(false);
  const [regenBusyId, setRegenBusyId] = useState(null);
  const [copyPostBusyId, setCopyPostBusyId] = useState(null);
  const [clipRenderBusyId, setClipRenderBusyId] = useState(null);
  const [clipRenderProgress, setClipRenderProgress] = useState(0);
  const [batchRenderBusy, setBatchRenderBusy] = useState(null);
  const [batchRenderProgress, setBatchRenderProgress] = useState(0);
  const toast = useToast();
  const [hookAltsBusyId, setHookAltsBusyId] = useState(null);
  const [processBusy, setProcessBusy] = useState(false);
  const [processStatus, setProcessStatus] = useState("");
  const audioScanKeyRef = useRef(null);

  const handleFileUpload = async (url, file) => {
    // x91: persist the File to IDB so a refresh can rehydrate a fresh blob URL.
    try { await idbPut(IDB_UPLOAD_KEY, file); } catch(_){ /* non-fatal */ }
    const scanKey = (file && file.name ? file.name : '') + ':' + (file && file.size ? file.size : '');
    if(audioScanKeyRef.current === scanKey) return;
    audioScanKeyRef.current = scanKey;
    analyzeUploadedVideoAudio(url, (result) => {
      if(!result) return;
      const compact = { duration: result.duration, peaks: result.peaks };
      setProject(p => ({ ...p, audioMap: compact }));
      toast('Audio analysis complete — ' + result.peaks.length + ' peaks detected', 'success');
    }).catch(() => {});
  };

  // x91: on mount, if we have a persisted upload name but the blob URL is dead
  // (page refresh), rehydrate the blob from IDB and mint a fresh URL. If IDB is
  // empty, clear the dangling reference so the upload area flips back to "Choose
  // file" instead of a broken <video> tag.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if(project.kind !== 'upload' || !project.uploadedVideoName) return;
      let alive = false;
      if(project.uploadedVideoUrl){
        try {
          const r = await fetch(project.uploadedVideoUrl, { method: 'HEAD' });
          alive = r.ok;
        } catch(_){}
      }
      if(alive || cancelled) return;
      try {
        const blob = await idbGet(IDB_UPLOAD_KEY);
        if(cancelled) return;
        if(blob){
          const newUrl = URL.createObjectURL(blob);
          setProject(p => ({ ...p, uploadedVideoUrl: newUrl }));
          toast('Restored uploaded file — ready to clip', 'success');
        } else if(project.uploadedVideoUrl){
          setProject(p => ({ ...p, uploadedVideoUrl: null, uploadedVideoName: null }));
          toast('Uploaded file was lost across sessions — please choose the file again.', 'warn');
        }
      } catch(_){
        if(!cancelled) setProject(p => ({ ...p, uploadedVideoUrl: null }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // x93: per-clip blob URL map — hydrated from IDB on mount and after clips change.
  const [clipBlobUrls, setClipBlobUrls] = useState({});
  useEffect(() => {
    if(!Array.isArray(project.clips) || project.clips.length === 0) return;
    const clipIds = project.clips.map(c => c.id).sort().join(',');
    const loadedIds = Object.keys(clipBlobUrls).sort().join(',');
    if(Object.keys(clipBlobUrls).length > 0 && loadedIds === clipIds) return;
    let cancelled = false;
    const minted = [];
    (async () => {
      const map = {};
      for(const clip of project.clips){
        try {
          const vBlob = await idbGetClip(clip.id);
          if(cancelled) break;
          if(vBlob){
            const vUrl = URL.createObjectURL(vBlob);
            minted.push(vUrl);
            map[clip.id] = { video: vUrl, thumb: null };
            const tBlob = await idbGetClip(clip.id + ":thumb");
            if(cancelled) break;
            if(tBlob){
              const tUrl = URL.createObjectURL(tBlob);
              minted.push(tUrl);
              map[clip.id].thumb = tUrl;
            }
          }
        } catch(_){}
      }
      if(!cancelled) setClipBlobUrls(map);
    })();
    return () => {
      cancelled = true;
      minted.forEach(u => { try { URL.revokeObjectURL(u); } catch(_){} });
    };
  }, [project.clips]);

  const processSource = async () => {
    if(processBusy) return;
    const sourceUrl = (project.source || "").trim();
    const isUpload = project.kind === 'upload' && !!project.uploadedVideoUrl;
    const pastedInitial = (project.transcriptText || "").trim();
    if(!sourceUrl && !pastedInitial && !isUpload){
      toast("Paste a URL, paste a transcript, or upload a video first", "error"); return;
    }
    setProcessBusy(true); setProcessStatus("Starting…");
    // x94: drop stale clips + selection so the user doesn't stare at demo/prior-run
    // titles while the new analysis runs.
    setProject(p => ({ ...p, clips: [] }));
    setSelected([]);
    try {
      let text = pastedInitial;
      let segments = Array.isArray(project.transcriptSegments) ? project.transcriptSegments.slice() : [];
      let meta = { title: project.name || "", author: project.author || "" };
      let fetchedChaps = [];
      let audioMp3Blob = null; // x97: held for signal collection after clip generation
      // x90: drop YT-origin transcript/chapters when the current source is an upload —
      // otherwise we'd cut clips against the wrong video's transcript.
      const transcriptLooksStale = isUpload && !sourceUrl && text.length > 0 &&
        !['pasted','transcribed'].includes(project.transcriptSource);
      if(transcriptLooksStale){
        text = '';
        segments = [];
        setProject(p => ({ ...p, transcriptText: '', transcriptSegments: [], chapters: [], transcriptSource: '' }));
      }
      const hasPastedTranscript = text.length > 0 && segments.length === 0;
      const isYT = !!sourceUrl && /youtu\.?be/i.test(sourceUrl);

      // x90: uploaded file with no transcript → auto-transcribe via ElevenLabs Scribe.
      if(isUpload && !text && !segments.length){
        let providers = {};
        try { providers = JSON.parse(localStorage.getItem('zaidsaid.v2.providers') || '{}'); } catch(_){}
        const eleven = providers.elevenlabs || {};
        const elevenEnabled = !!eleven.proxyUrl && eleven.enabled !== false;
        if(!elevenEnabled){
          toast('Configure ElevenLabs in Settings → Providers to auto-transcribe uploads, or paste the transcript below and re-run.', 'warn');
          return;
        }
        const durationMin = project.durationSec ? Math.ceil(project.durationSec / 60) : 0;
        setProcessStatus(durationMin ? ("Transcribing ~" + durationMin + " min via ElevenLabs Scribe…") : "Transcribing via ElevenLabs Scribe…");
        try {
          // x91: prefer IDB (survives refresh) and fall back to the blob URL.
          let blob = null;
          try { blob = await idbGet(IDB_UPLOAD_KEY); } catch(_){}
          if(!blob && project.uploadedVideoUrl){
            try {
              const blobRes = await fetch(project.uploadedVideoUrl);
              if(blobRes.ok) blob = await blobRes.blob();
            } catch(_){}
          }
          if(!blob) throw new Error("Couldn't read uploaded file. Choose the file again below and re-run.");

          // x92: Big videos blow through CF Workers' 500 MiB body limit. Extract
          // the audio track to a tiny MP3 first, then send only that upstream.
          const EXTRACT_THRESHOLD = 50 * 1024 * 1024; // 50 MB
          let uploadBlob = blob;
          let uploadFilename = project.uploadedVideoName || 'upload.mp4';
          const isVideo = (blob.type || '').startsWith('video/') || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(uploadFilename);
          if(isVideo && blob.size > EXTRACT_THRESHOLD){
            try {
              uploadBlob = await extractAudioAsMp3(
                blob,
                uploadFilename,
                (s) => setProcessStatus(s),
                (pct) => setProcessStatus("Extracting audio… " + Math.round(pct * 100) + "%")
              );
              uploadFilename = uploadFilename.replace(/\.[^.]+$/, '') + '.mp3';
              const mb = (blob.size/1048576).toFixed(0);
              const mb2 = (uploadBlob.size/1048576).toFixed(1);
              toast('Audio extracted: ' + mb + ' MB → ' + mb2 + ' MB', 'success');
              setProcessStatus("Transcribing extracted audio via ElevenLabs Scribe…");
            } catch(e){
              const msg = (e && e.message) || String(e);
              if(blob.size > 400 * 1024 * 1024){
                throw new Error("Audio extraction failed and the raw file is too big to upload: " + msg);
              }
              console.warn('[zs] audio extraction failed, falling back to raw upload:', e);
              setProcessStatus("Audio extraction failed — falling back to raw upload, this may be slow.");
            }
          }
          audioMp3Blob = uploadBlob; // x97: reuse for signal collection
          const elevenBase = String(eleven.proxyUrl).replace(/\/elevenlabs\/?$/, '');
          const stt = await transcribeUploadedFile(elevenBase, uploadBlob, uploadFilename);
          text = stt.text || '';
          segments = stt.segments || [];
          const transcriptWords = Array.isArray(stt.words) ? stt.words : []; // x110b: word-level for HyperFrames captions
          if(!text && !segments.length) throw new Error("Empty transcription — audio may be silent or unintelligible.");
          // x111c: also fetch speech-presence intervals so snapClipBoundaries can
          // trim leading/trailing dead air. Cheap (~realtime on CPU), best-effort.
          let transcriptVadIntervals = [];
          const aiVadBase = getAudioAiPath();
          if (aiVadBase) {
            transcriptVadIntervals = await fetchVadIntervals(aiVadBase, audioMp3Blob || uploadBlob);
          }
          const lastSeg = segments[segments.length-1];
          const derivedDur = lastSeg ? (lastSeg.t + lastSeg.d) : 0;
          setProject(p => ({
            ...p,
            transcriptText: text,
            transcriptSegments: segments,
            transcriptWords,
            transcriptVadIntervals,
            chapters: [],
            transcriptSource: 'transcribed',
            durationSec: derivedDur > 0 ? Math.round(derivedDur) : p.durationSec
          }));
          toast('Transcribed ' + segments.length + ' segments' + (transcriptVadIntervals.length ? ' · ' + transcriptVadIntervals.length + ' speech intervals' : ''), 'success');
        } catch(e){
          const msg = (e && e.message) || 'unknown';
          toast('Transcription failed: ' + msg, 'error');
          setProcessStatus('Failed');
          return;
        }
      }
      if(isYT){
        setProcessStatus("Fetching transcript…");
        try {
          const path = getAnthropicPath();
          const base = path ? path.replace(/\/anthropic\/?$/, "") : "https://zaidsaid-proxy.zaidsaid.workers.dev";
          const res = await fetch(base + "/youtube-transcript?url=" + encodeURIComponent(sourceUrl));
          if(res.ok){
            const data = await res.json();
            const tx = (data.transcript || data.description || "").trim();
            const segs = Array.isArray(data.segments) ? data.segments : [];
            const chaps = Array.isArray(data.chapters) ? data.chapters : [];
            fetchedChaps = chaps;
            // If user already pasted text but we got real segments from YT, use the segments for timing.
            if(segs.length > 0){
              segments = segs;
              if(!hasPastedTranscript) text = tx;
              meta = { title: data.title || meta.title, author: data.author || meta.author };
              setProject(p => ({
                ...p,
                transcriptText: hasPastedTranscript ? p.transcriptText : tx,
                transcriptSegments: segs,
                chapters: chaps,
                transcriptSource: 'real',
                name: p.name || data.title || "",
                author: p.author || data.author || "",
                durationSec: (!p.durationSec || p.durationSec === 5520) && data.lengthSeconds ? data.lengthSeconds : (p.durationSec || data.lengthSeconds || p.durationSec)
              }));
            } else if(tx && !hasPastedTranscript){
              text = tx;
              const errs = Array.isArray(data.errors) ? data.errors : [];
              if(errs.length > 0){
                toast('Transcript fetch issues: ' + errs.length + ' — using description fallback. Paste transcript below for sharper clips.', 'warn');
              } else if(data.source === "description" || data.fallback){
                toast("YouTube transcript unavailable — using description. For sharper clips, paste the full transcript below and re-run.", "warn");
              }
              setProject(p => ({
                ...p,
                transcriptText: tx,
                chapters: chaps,
                transcriptSource: 'description',
                name: p.name || data.title || "",
                author: p.author || data.author || "",
                durationSec: (!p.durationSec || p.durationSec === 5520) && data.lengthSeconds ? data.lengthSeconds : p.durationSec
              }));
            } else if(!tx && !hasPastedTranscript){
              if(chaps.length > 0){
                setProject(p => ({ ...p, chapters: chaps, transcriptSource: 'none' }));
              } else {
                setProject(p => ({ ...p, transcriptSource: 'none' }));
              }
              toast("No transcript available from YouTube. Paste the transcript below and press Enter for best clips.", "warn");
            }
          } else {
            if(!hasPastedTranscript) toast("Transcript fetch failed. Paste the transcript below and press Enter.", "warn");
          }
        } catch(e){ /* continue with whatever text we have */ }
      }
      if(!text) text = sourceUrl;
      // If we have pasted text but no segments from worker, try to parse timestamps from the paste.
      if(segments.length === 0 && text && text.length > 40){
        const pasted = parsePastedTranscript(text);
        if(pasted.length >= 3){
          segments = pasted;
          setProject(p => ({ ...p, transcriptSegments: pasted }));
        }
      }
      if(hasPastedTranscript && segments.length === 0){
        setProject(p => ({ ...p, transcriptSource: 'pasted' }));
      }
      const target = Number(project.targetCount) || 10;
      const chapters = fetchedChaps.length > 0 ? fetchedChaps : (Array.isArray(project.chapters) ? project.chapters : []);
      const audioMap = project.audioMap || null;
      setProcessStatus(segments.length > 0 ? ("Analyzing " + segments.length + " segments…") : "Generating clips…");
      const path = getAnthropicPath();
      const base = path ? path.replace(/\/anthropic\/?$/, "") : "https://zaidsaid-proxy.zaidsaid.workers.dev";

      // Phase D: kick off topic extraction + trending fetch in parallel with clip generation
      const trendingPromise = path ? (async () => {
        try {
          const kws = await extractTopicKeywords(path, text, setProcessStatus);
          if (!kws.length) return [];
          setProcessStatus("Fetching trending context…");
          return await fetchTrendingContext(base, kws);
        } catch(e) { console.warn('[zs] trending fetch failed', e); return []; }
      })() : Promise.resolve([]);

      let clips = null;
      if(path){
        try { clips = await analyzeViaClaudeTwoStage(path, text, target, segments, meta, chapters, audioMap); } catch(e){ console.warn('[zs] analyzeViaClaudeTwoStage failed', e); clips = null; }
      }
      if(!clips || !clips.length){ clips = analyzeLocal(text, target, segments, chapters, audioMap); }
      if(!clips || !clips.length){ toast("No clips generated — try a different source", "error"); return; }
      // x109: dedupe overlapping + drop fragment-length + drop obvious ad clips.
      // analyzeViaClaude already snap-extended boundaries; now cull the bad apples.
      if(segments && segments.length > 0){
        const before = clips.length;
        clips = dedupeAndCleanClips(clips, segments, { minDuration: 12, maxOverlapRatio: 0.4 });
        const dropped = before - clips.length;
        if(dropped > 0) toast("Dropped " + dropped + " fragment/overlap/ad clips", "info");
      }
      setProject(p => ({ ...p, clips, durationSec: p.durationSec || (clips[clips.length-1].end + 60) }));
      const src = segments.length > 0 ? "timestamped transcript" : (hasPastedTranscript ? "pasted transcript" : "source text");
      toast("Generated " + clips.length + " clips from " + src, "success");

      // x108c: unconditional precision pass right after clips land. Runs even
      // when signals (sensevoice/gemini) and trending return empty — the two
      // conditional re-score blocks below still re-run it if their signals
      // change the clip set.
      if (precisionEnabled && path && clips && clips.length) {
        (async () => {
          try {
            setProcessStatus("Precision pass…");
            const ppCtx = { signals: {}, audioMap, trendingMatches: [], segments, chapters, videoTitle: meta.title, videoAuthor: meta.author, durationSec: project.durationSec };
            const refinements = await runClippingPrecisionPass(path, clips, ppCtx);
            if (refinements.length) {
              const refMap = {};
              for (const r of refinements) refMap[r.id] = r;
              setProject(p => ({
                ...p,
                clips: p.clips.map(c => refMap[c.id] ? { ...c, precisionScore: refMap[c.id].precisionScore, verdict: refMap[c.id].verdict, evidence: refMap[c.id].evidence } : c)
              }));
              const strong = refinements.filter(r => r.verdict === "strong").length;
              const medium = refinements.filter(r => r.verdict === "medium").length;
              const weak = refinements.filter(r => r.verdict === "weak").length;
              toast("Precision pass: " + strong + " strong · " + medium + " medium · " + weak + " weak clips", "success");
            }
          } catch(e) { console.warn("[zs] precision pass (initial) failed", e); }
        })();
      }

      // Phase D: once trending arrives, store in signals and re-run scoring
      trendingPromise.then(async (trendingMatches) => {
        if (!trendingMatches || !trendingMatches.length) return;
        setProject(p => ({ ...p, signals: { ...(p.signals || {}), trendingMatches } }));
        if (!path) return;
        try {
          setProcessStatus("Re-scoring with trending signals…");
          const enrichedSignals = { trendingMatches };
          const enrichedClips = await analyzeViaClaudeTwoStage(path, text, target, segments, meta, chapters, audioMap, enrichedSignals);
          if (enrichedClips && enrichedClips.length) {
            setProject(p => ({ ...p, clips: enrichedClips }));
            toast("Re-scored " + enrichedClips.length + " clips with trending signals", "success");
            // x107: precision pass after trending re-score (non-upload path)
            if (precisionEnabled) {
              try {
                setProcessStatus("Precision pass…");
                const ppCtx = { signals: enrichedSignals, audioMap, trendingMatches, segments, chapters, videoTitle: meta.title, videoAuthor: meta.author, durationSec: project.durationSec };
                const refinements = await runClippingPrecisionPass(path, enrichedClips, ppCtx);
                if (refinements.length) {
                  const refMap = {};
                  for (const r of refinements) refMap[r.id] = r;
                  setProject(p => ({
                    ...p,
                    clips: p.clips.map(c => refMap[c.id] ? { ...c, precisionScore: refMap[c.id].precisionScore, verdict: refMap[c.id].verdict, evidence: refMap[c.id].evidence } : c)
                  }));
                  const strong = refinements.filter(r => r.verdict === "strong").length;
                  const medium = refinements.filter(r => r.verdict === "medium").length;
                  const weak = refinements.filter(r => r.verdict === "weak").length;
                  toast("Precision pass: " + strong + " strong · " + medium + " medium · " + weak + " weak clips", "success");
                }
              } catch(e) { console.warn("[zs] precision pass failed (trending path)", e); }
            }
          }
        } catch(e) { console.warn('[zs] trending re-score failed', e); }
        setProcessStatus("");
      }).catch(() => {});
      // x93: for uploads, cut real per-clip blobs + thumbnails into IDB.
      if(isUpload){
        let srcBlob = null;
        try { srcBlob = await idbGet(IDB_UPLOAD_KEY); } catch(_){}
        if(srcBlob){
          try {
            await generateClipAssets(srcBlob, clips, setProcessStatus, setClipBlobUrls);
            setProcessStatus("Done — " + clips.length + " clips");
          } catch(e){
            console.warn("[zs] generateClipAssets failed", e);
            setProcessStatus("Done — " + clips.length + " clips (cuts failed)");
          }
        } else {
          setProcessStatus("Done — " + clips.length + " clips");
        }
      } else {
        setProcessStatus("Done — " + clips.length + " clips");
      }
      // x97: Collect multi-modal signals in parallel (best-effort, non-blocking to clip display).
      // Only run when we have an audio/video blob and a worker path to proxy through.
      if(audioMp3Blob && path){
        (async () => {
          try {
            const workerBase = path.replace(/\/anthropic\/?$/, "");
            setProcessStatus("Collecting signals (scene-cut + audio events + visual highlights)…");
            const [sceneCuts, audioEvents, visualHighlights] = await Promise.all([
              detectSceneCuts(audioMp3Blob).catch(() => []),
              fetchSenseVoiceEvents(workerBase, audioMp3Blob).catch(() => []),
              fetchGeminiHighlights(workerBase, audioMp3Blob, target).catch(() => [])
            ]);
            // x111c: include VAD intervals (from project state when present) so
            // analyzeViaClaude's inline snapClipBoundaries call can trim dead
            // air at the boundaries.
            const vadFromState = Array.isArray(project.transcriptVadIntervals) ? project.transcriptVadIntervals : [];
            const signals = { scenes: sceneCuts, audioEvents, visualHighlights, vadIntervals: vadFromState };
            const hasAnySignal = sceneCuts.length > 0 || audioEvents.length > 0 || visualHighlights.length > 0;
            setProject(p => ({ ...p, signals }));
            if(!hasAnySignal){ setProcessStatus(""); return; }
            // Re-run Claude analysis with signals to boost clip scores.
            if(path){
              setProcessStatus("Re-scoring clips with signals…");
              try {
                const boostedClips = await analyzeViaClaudeTwoStage(path, text, target, segments, meta, chapters, audioMap, signals);
                if(boostedClips && boostedClips.length){
                  setProject(p => {
                    // Preserve user-edited clips by id; replace score+virality for existing ids.
                    const existingIds = new Set((p.clips || []).map(c => c.id));
                    const merged = boostedClips.map((bc, i) => {
                      const existing = (p.clips || []).find(c => c.id === bc.id);
                      if(existing){
                        return { ...existing, virality: bc.virality, scores: bc.scores };
                      }
                      return bc;
                    });
                    return { ...p, clips: merged };
                  });
                  toast("Clips re-scored with " + (sceneCuts.length ? "scenes " : "") + (audioEvents.length ? "audio " : "") + (visualHighlights.length ? "visual " : "") + "signals", "success");
                  // x107: precision pass after signal re-score (upload path)
                  if (precisionEnabled) {
                    try {
                      setProcessStatus("Precision pass…");
                      const trendingForPass = (await trendingPromise.catch(() => [])) || [];
                      const ppCtx = { signals, audioMap, trendingMatches: trendingForPass, segments, chapters, videoTitle: meta.title, videoAuthor: meta.author, durationSec: project.durationSec };
                      const refinements = await runClippingPrecisionPass(path, boostedClips, ppCtx);
                      if (refinements.length) {
                        const refMap = {};
                        for (const r of refinements) refMap[r.id] = r;
                        setProject(p => ({
                          ...p,
                          clips: p.clips.map(c => refMap[c.id] ? { ...c, precisionScore: refMap[c.id].precisionScore, verdict: refMap[c.id].verdict, evidence: refMap[c.id].evidence } : c)
                        }));
                        const strong = refinements.filter(r => r.verdict === "strong").length;
                        const medium = refinements.filter(r => r.verdict === "medium").length;
                        const weak = refinements.filter(r => r.verdict === "weak").length;
                        toast("Precision pass: " + strong + " strong · " + medium + " medium · " + weak + " weak clips", "success");
                      }
                    } catch(e) { console.warn("[zs] precision pass failed (signal path)", e); }
                  }
                }
              } catch(e){ console.warn('[zs] signal re-score failed', e); }
            }
            setProcessStatus("");
          } catch(e){
            console.warn('[zs] signal collection failed', e);
            setProcessStatus("");
          }
        })();
      }
    } catch(e){
      toast("Process failed: " + (e && e.message || "unknown"), "error");
      setProcessStatus("Failed");
    } finally {
      setProcessBusy(false);
      setTimeout(() => setProcessStatus(""), 3500);
    }
  };

  const clipField = (clipId, field, value) => {
    setProject({ ...project, clips: project.clips.map(c => c.id===clipId ? { ...c, [field]: value } : c) });
  };
  const clipRegen = async (clipId, field) => {
    if(regenBusyId) return;
    const clip = project.clips.find(c => c.id === clipId);
    if(!clip) return;
    setRegenBusyId(clipId + ":" + field);
    let v = null;
    const path = getAnthropicPath();
    if(path){
      try { v = await regenFieldViaClaude(path, clip, project, field); } catch(e){ v = null; }
    }
    if(v === null || v === undefined) v = clipRegenerate(field, clip);
    if(v === null || v === undefined){ setRegenBusyId(null); return; }
    clipField(clipId, field, v);
    setRegenBusyId(null);
  };
  const copyPost = async (clipId) => {
    if(copyPostBusyId) return;
    const clip = project.clips.find(c => c.id === clipId);
    if(!clip) return;
    setCopyPostBusyId(clipId);
    let post = null;
    try {
      const path = getAnthropicPath();
      let workingClip = clip;
      if(path && !clip.platformCaptions){
        try {
          const caps = await generateCaptionsViaClaude(path, clip, project);
          workingClip = { ...clip, platformCaptions: caps };
          setProject(prev => ({ ...prev, clips: prev.clips.map(cc => cc.id === clipId ? { ...cc, platformCaptions: caps } : cc) }));
        } catch(e){ /* proceed without platformCaptions */ }
      }
      const platformMap = { vertical: "tiktok", square: "twitter", landscape: "linkedin" };
      const pk = platformMap[workingClip.preset || "vertical"] || "tiktok";
      const seedCaption = (workingClip.platformCaptions && workingClip.platformCaptions[pk]) || workingClip.caption || "";
      const seedClip = { ...workingClip, caption: seedCaption };
      if(path){
        try { post = await generateSocialPostViaClaude(path, seedClip, project); } catch(e){ post = null; }
      }
      if(!post) post = { caption: (workingClip.hook || "") + "\n\n" + seedCaption, hashtags: ["shorts","fyp","viralvideo"] };
      const text = post.caption + "\n\n" + post.hashtags.map(h => "#" + h.replace(/^#/, "")).join(" ");
      try { await navigator.clipboard.writeText(text); } catch(e){}
      toast("Copied post \u2014 paste into your social", "success");
    } finally {
      setCopyPostBusyId(null);
    }
  };
  const [shareBusyId, setShareBusyId] = useState(null);
  const [shareMetadata, setShareMetadata] = useState(null); // { platform, title, description, hashtags, tags, thumbnailIdea }
  const shareClip = async (clipId, platform) => {
    if(shareBusyId) return;
    const clip = project.clips.find(c => c.id === clipId);
    if(!clip) return;
    setShareBusyId(clipId + ":" + platform);
    try {
      // YouTube / Shorts: generate platform-tuned metadata (title, description, hashtags, SEO tags)
      // via Claude with live trending context, render a playable 1080p MP4, open YT upload page,
      // surface a modal the user copies from per field.
      const isYouTube = platform === "youtube" || platform === "shorts";
      let metadata = null;
      let safeTitle = (clip.title || "clip").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "clip";
      if(isYouTube){
        const path = getAnthropicPath();
        if(path){
          try {
            toast("Generating YouTube metadata (scanning trending topics)…", "info");
            metadata = await generateYouTubeMetadataViaClaude(path, clip, project, platform === "shorts" ? "shorts" : "long");
            safeTitle = metadata.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 48) || safeTitle;
          } catch(e){
            console.warn("[zs] YT metadata failed, falling back to clip caption", e);
          }
        }
      }
      // Clipboard payload: for YT we put the description body so user can paste into description;
      // title/tags surface in the modal with individual copy buttons.
      const clipboardText = metadata
        ? (metadata.description + "\n\n" + metadata.hashtags.map(h => "#" + h.replace(/^#/, "")).join(" "))
        : buildClipExportText(clip, project);
      try { await navigator.clipboard.writeText(clipboardText); } catch(e){}
      // Render a real 1080p MP4 — smart crop path when enabled, fallback to two-pass.
      let downloaded = false;
      if(project.uploadedVideoUrl){
        try {
          const preset = clip.preset || "vertical";
          const cacheKey = clip.id + ":" + preset;
          const cached = smartCropCacheRef.current[cacheKey];
          let outBlob = null;
          if(smartCropEnabled && cached && cached.facesOverTime.length && cached.path.length){
            outBlob = await renderClipSmartCrop(project.uploadedVideoUrl, clip, preset, cached.path, null);
            outBlob = await reencodeWebmToPresetMP4(outBlob, preset, null);
          } else {
            const recBlob = await recordClipViaCaptureStream(project.uploadedVideoUrl, clip, null);
            outBlob = await reencodeWebmToPresetMP4(recBlob, preset, null);
          }
          // x110b: optional HyperFrames pass — adds title, animated word-level captions, lower-third.
          // Skipped silently when no hyperframes provider is configured.
          const hfBase = getHyperframesPath();
          if(hfBase && outBlob){
            try {
              setProcessStatus && setProcessStatus("Styling via HyperFrames…");
              const styled = await renderViaHyperFrames(hfBase, outBlob, clip, project);
              if(styled && styled.size > 0) outBlob = styled;
            } catch(e){ console.warn("[zs] hyperframes share-style failed, using raw clip:", e); }
          }
          const url = URL.createObjectURL(outBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = safeTitle + "-" + platform + ".mp4";
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch(e){} }, 60000);
          downloaded = true;
        } catch(e){ console.warn("[zs] share render failed", e); }
      }
      const UPLOAD_URLS = {
        tiktok: "https://www.tiktok.com/upload?lang=en",
        instagram: "https://www.instagram.com/",
        youtube: "https://studio.youtube.com/channel/UC/videos/upload",
        shorts: "https://studio.youtube.com/channel/UC/videos/upload?d=ud",
        x: "https://x.com/compose/post",
        rumble: "https://rumble.com/upload.php"
      };
      const url = UPLOAD_URLS[platform];
      if(url){ try { window.open(url, "_blank", "noopener,noreferrer"); } catch(e){} }
      if(metadata){
        setShareMetadata({ platform, clipId, ...metadata });
        toast((downloaded ? "1080p MP4 in Downloads · " : "") + "YT metadata generated — copy each field from the panel", "success");
      } else {
        const bits = [];
        if(downloaded) bits.push("video downloaded");
        bits.push("caption copied");
        if(!project.uploadedVideoUrl) bits.push("(upload source to include video)");
        toast("Share → " + platform + " — " + bits.join(", "), "success");
      }
    } catch(e){
      toast("Share failed: " + (e && e.message || "unknown"), "error");
    } finally {
      setShareBusyId(null);
    }
  };

  const renderClipVideo = async (clipId) => {
    if(clipRenderBusyId) return;
    if(!project.uploadedVideoUrl){ toast("Upload a video first", "error"); return; }
    const clip = project.clips.find(c => c.id === clipId);
    if(!clip) return;
    setClipRenderBusyId(clipId);
    setClipRenderProgress(0);
    try {
      const blob = await renderClipVideoFromUpload(project.uploadedVideoUrl, clip, (p) => setClipRenderProgress(p), { overlay: { hook: clip.hook } });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (clip.title || "clip").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "clip";
      a.download = safeTitle + ".webm";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch(e){} }, 500);
      toast("Clip video rendered \u2014 check downloads", "success");
    } catch(e){
      toast("Render failed: " + (e && e.message || "unknown"), "error");
    } finally {
      setClipRenderBusyId(null);
      setClipRenderProgress(0);
    }
  };
  const explainClip = async (clipId) => {
    if(explainBusyId || explainAllBusy) return;
    const clip = project.clips.find(c => c.id === clipId);
    if(!clip) return;
    setExplainBusyId(clipId);
    const path = getAnthropicPath();
    let bd = null;
    if(path){
      try { bd = await generateHookBreakdownViaClaude(path, clip, project); } catch(e){ bd = null; }
    }
    if(!bd) bd = generateHookBreakdownLocal(clip);
    setProject(prev => ({ ...prev, clips: prev.clips.map(c => c.id === clipId ? { ...c, hookBreakdown: bd } : c) }));
    setExplainBusyId(null);
  };
  const explainAllClips = async () => {
    if(explainAllBusy || explainBusyId) return;
    setExplainAllBusy(true);
    const path = getAnthropicPath();
    const updated = [];
    for(const clip of project.clips){
      let bd = null;
      if(path){
        try { bd = await generateHookBreakdownViaClaude(path, clip, project); } catch(e){ bd = null; }
      }
      if(!bd) bd = generateHookBreakdownLocal(clip);
      updated.push({ ...clip, hookBreakdown: bd });
    }
    setProject(prev => ({ ...prev, clips: updated }));
    setExplainAllBusy(false);
  };
  const generateHookAlts = async (clipId) => {
    if(hookAltsBusyId) return;
    const clip = project.clips.find(c => c.id === clipId);
    if(!clip) return;
    setHookAltsBusyId(clipId);
    const path = getAnthropicPath();
    let alts = null;
    if(path){
      try { alts = await generateHookAltsViaClaude(path, clip, project); } catch(e){ alts = null; }
    }
    if(!alts) alts = generateHookAltsLocal(clip);
    setProject(prev => ({ ...prev, clips: prev.clips.map(c => c.id === clipId ? { ...c, hookAlts: alts } : c) }));
    setHookAltsBusyId(null);
  };
  const [thumbBusyId, setThumbBusyId] = useState(null);
  const [hookScoreBusyId, setHookScoreBusyId] = useState(null);
  const [objAnswerBusyId, setObjAnswerBusyId] = useState(null);
  const [precisionEnabled, setPrecisionEnabled] = useLocalState("repurpose.precision", true);
  const [showWeak, setShowWeak] = useLocalState("repurpose.showWeak", false);
  const [smartCropEnabled, setSmartCropEnabled] = useLocalState("repurpose.smartCrop", true);
  const smartCropCacheRef = useRef({});
  const smartCropDetectRef = useRef(null);
  const [cropPaths, setCropPaths] = useState({});

  useEffect(() => {
    if(!smartCropEnabled || !project.uploadedVideoUrl || !project.clips.length) return;
    if(smartCropDetectRef.current) clearTimeout(smartCropDetectRef.current);
    smartCropDetectRef.current = setTimeout(async () => {
      const url = project.uploadedVideoUrl;
      const batchPresetLocal = safeGet("repurpose.batchPreset", "vertical");
      const sceneCuts = (project.signals && project.signals.scenes) || [];
      for(const clip of project.clips){
        const cacheKey = clip.id + ":" + (clip.preset || batchPresetLocal);
        if(smartCropCacheRef.current[cacheKey]) continue;
        try {
          const facesOverTime = await detectFacesInClip(url, clip, {});
          if(!facesOverTime.length) continue;
          const vid = document.createElement("video");
          vid.src = url;
          vid.preload = "metadata";
          await new Promise((res) => { vid.onloadedmetadata = res; vid.onerror = res; });
          const srcWH = [vid.videoWidth || 1920, vid.videoHeight || 1080];
          try { vid.src = ""; } catch(_){}
          const clipCuts = sceneCuts.filter(s => s.t >= clip.start && s.t <= clip.end).map(s => ({ t: s.t - clip.start }));
          const preset = clip.preset || batchPresetLocal;
          const path = computeCropPath(facesOverTime, clipCuts, srcWH, preset);
          smartCropCacheRef.current[cacheKey] = { facesOverTime, path };
          setCropPaths(prev => ({ ...prev, [cacheKey]: path }));
        } catch(_) {}
      }
    }, 500);
    return () => { if(smartCropDetectRef.current) clearTimeout(smartCropDetectRef.current); };
  }, [smartCropEnabled, project.uploadedVideoUrl, project.clips, project.signals]);

  const generateObjAnswer = async (clipId) => {
    if(objAnswerBusyId) return;
    const clip = project.clips.find(c => c.id === clipId);
    if(!clip) return;
    setObjAnswerBusyId(clipId);
    const path = getAnthropicPath();
    let objs = null;
    if(path){
      try { objs = await generateObjAnswerViaClaude(path, clip, project); } catch(e){ objs = null; }
    }
    if(!objs || !objs.length) objs = generateObjAnswerLocal(clip);
    setProject(prev => ({ ...prev, clips: prev.clips.map(c => c.id === clipId ? { ...c, objections: objs } : c) }));
    setObjAnswerBusyId(null);
  };
  const [commentSeedsBusyId, setCommentSeedsBusyId] = useState(null);
  const generateCommentSeeds = async (clipId) => {
    if(commentSeedsBusyId) return;
    const clip = project.clips.find(c => c.id === clipId);
    if(!clip) return;
    setCommentSeedsBusyId(clipId);
    const path = getAnthropicPath();
    let seeds = null;
    if(path){
      try { seeds = await generateCommentSeedsViaClaude(path, clip, project); } catch(e){ seeds = null; }
    }
    if(!seeds || !seeds.length) seeds = generateCommentSeedsLocal(clip);
    setProject(prev => ({ ...prev, clips: prev.clips.map(c => c.id === clipId ? { ...c, commentSeeds: seeds } : c) }));
    setCommentSeedsBusyId(null);
  };
  const generateHookScore = async (clipId) => {
    if(hookScoreBusyId) return;
    const clip = project.clips.find(c => c.id === clipId);
    if(!clip) return;
    setHookScoreBusyId(clipId);
    const path = getAnthropicPath();
    let score = null;
    if(path){
      try { score = await generateHookScoreViaClaude(path, clip); } catch(e){ score = null; }
    }
    if(!score) score = generateHookScoreLocal(clip);
    setProject(prev => ({ ...prev, clips: prev.clips.map(c => c.id === clipId ? { ...c, hookScore: score } : c) }));
    setHookScoreBusyId(null);
  };
  const generateThumbConcept = async (clipId) => {
    if(thumbBusyId) return;
    const clip = project.clips.find(c => c.id === clipId);
    if(!clip) return;
    setThumbBusyId(clipId);
    const path = getAnthropicPath();
    let concept = null;
    if(path){
      try { concept = await generateThumbnailConceptViaClaude(path, clip, project); } catch(e){ concept = null; }
    }
    if(!concept) concept = generateThumbnailConceptLocal(clip);
    setProject(prev => ({ ...prev, clips: prev.clips.map(c => c.id === clipId ? { ...c, thumbConcept: concept } : c) }));
    setThumbBusyId(null);
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
    // x93: clean up per-clip IDB entries and revoke any minted blob URLs.
    idbDeleteClip(clipId).catch(()=>{});
    idbDeleteClip(clipId + ":thumb").catch(()=>{});
    setClipBlobUrls(prev => {
      const entry = prev[clipId];
      if(entry){
        try { if(entry.video) URL.revokeObjectURL(entry.video); } catch(_){}
        try { if(entry.thumb) URL.revokeObjectURL(entry.thumb); } catch(_){}
        const next = { ...prev };
        delete next[clipId];
        return next;
      }
      return prev;
    });
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
  const exportClipsAsVideo = async () => {
    const selectedClips = project.clips.filter(c => selected.includes(c.id));
    if(selectedClips.length === 0){ toast("Select at least one clip", "warn"); return; }
    const preset = batchPreset || "vertical";
    setBatchRenderBusy(true);
    setBatchRenderProgress(0);
    setProcessStatus("");
    try {
      const outputs = [];
      for(let i = 0; i < selectedClips.length; i++){
        const clip = selectedClips[i];
        const safeTitle = (clip.title || "clip").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "clip";
        const onProg = (p) => setBatchRenderProgress(Math.round((i + p) / selectedClips.length * 100));
        let outBlob = null;
        let ext = "mp4";
        if(!project.uploadedVideoUrl){
          toast("Skipped clip " + (clip.title || clip.id) + " (no uploaded source)", "warn");
          continue;
        }
        try {
          const cacheKey = clip.id + ":" + (clip.preset || preset);
          const cached = smartCropCacheRef.current[cacheKey];
          if(smartCropEnabled && cached && cached.facesOverTime.length && cached.path.length){
            setProcessStatus("Smart-crop " + (i + 1) + "/" + selectedClips.length + "…");
            const rawBlob = await renderClipSmartCrop(project.uploadedVideoUrl, clip, clip.preset || preset, cached.path, (p) => onProg(p * 0.5));
            setProcessStatus("Encoding " + (i + 1) + "/" + selectedClips.length + " (1080p)…");
            outBlob = await reencodeWebmToPresetMP4(rawBlob, clip.preset || preset, (p) => onProg(0.5 + p * 0.5));
          } else {
            setProcessStatus("Recording " + (i + 1) + "/" + selectedClips.length + "…");
            const recBlob = await recordClipViaCaptureStream(project.uploadedVideoUrl, clip, (p) => onProg(p));
            setProcessStatus("Encoding " + (i + 1) + "/" + selectedClips.length + " (1080p)…");
            outBlob = await reencodeWebmToPresetMP4(recBlob, preset, (p) => onProg(p));
          }
          // x110b: optional HyperFrames styling pass per clip — silent skip when not configured.
          const hfBase = getHyperframesPath();
          if(hfBase && outBlob && outBlob.size){
            try {
              setProcessStatus("Styling " + (i + 1) + "/" + selectedClips.length + " via HyperFrames…");
              const styled = await renderViaHyperFrames(hfBase, outBlob, clip, project);
              if(styled && styled.size > 0) outBlob = styled;
            } catch(e){ console.warn("[zs] hyperframes batch-style failed for clip", clip.id, e); }
          }
        } catch(e){
          console.warn("[zs] captureStream/reencode failed for clip", clip.id, e);
          outBlob = null;
        }
        if(!outBlob || !outBlob.size){
          toast("Skipped clip " + (clip.title || clip.id) + " (render failed or empty output)", "warn");
          continue;
        }
        outputs.push({ name: safeTitle + "_" + preset + "." + ext, blob: outBlob });
      }
      if(outputs.length === 0) throw new Error("Nothing encoded");
      if(outputs.length === 1){
        downloadBlob(outputs[0].blob, outputs[0].name);
      } else {
        setProcessStatus("Packing zip…");
        const loadZip = await awaitZipLoader();
        const JSZip = await loadZip();
        const zip = new JSZip();
        outputs.forEach(o => zip.file(o.name, o.blob));
        const zipBlob = await zip.generateAsync({ type: "blob" }, (meta) => setBatchRenderProgress(Math.round(90 + meta.percent * 0.1)));
        downloadBlob(zipBlob, "clips-" + preset + "-" + Date.now() + ".zip");
      }
      toast("Exported " + outputs.length + " clip(s)", "success");
    } catch(e){
      toast("Batch export failed: " + (e && e.message || "unknown"), "error");
    } finally {
      setBatchRenderBusy(null);
      setBatchRenderProgress(0);
      setProcessStatus("");
    }
  };
  const exportClipsAsText = () => {
    if(!project.clips.length) return;
    let targets = project.clips.filter(c => selected.includes(c.id) || (!selected.length && c.status === "approved"));
    if(targets.length === 0) targets = project.clips;
    try {
      const body = targets.map(c => buildClipExportText(c, project)).join("\n\n\n");
      const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const nameSlug = (project.name || "zaidsaid-clips").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "zaidsaid-clips";
      a.download = nameSlug + "-clips.txt";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try{ URL.revokeObjectURL(a.href); a.remove(); } catch(e){} }, 250);
    } catch(e) { console.warn("batch text export failed:", e); }
  };
  const resetSeed = () => setProject(REPURPOSE_SEED);

  const sorted = useMemo(() => {
    let arr = project.clips.slice();
    if (!showWeak) arr = arr.filter(c => c.verdict !== "weak");
    if(sort === "virality") arr.sort((a,b) => b.virality - a.virality);
    else if(sort === "duration") arr.sort((a,b) => clipDuration(b) - clipDuration(a));
    else if(sort === "start") arr.sort((a,b) => a.start - b.start);
    return arr;
  }, [project.clips, sort, showWeak]);

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
      </div>

      <div className="grid gap-4">
        <RepurposeIntake project={project} setProject={setProject} onProcessSource={processSource} processBusy={processBusy} processStatus={processStatus} onFileUpload={handleFileUpload} toast={toast} />
        <RepurposeTranscriptStrip project={project} />

        <div className="card p-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[color:var(--muted)]">Ranked highlights</div>
              <div className="text-lg font-semibold">{project.clips.length} clips · top pick {Math.max(...project.clips.map(c=>c.virality))} virality</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button className="chip" onClick={() => {
                const segs = project.transcriptSegments || [];
                if(segs.length === 0){ toast("No transcript segments to snap against", "warn"); return; }
                const vadIntervals = Array.isArray(project.transcriptVadIntervals) ? project.transcriptVadIntervals : null;
                let changed = 0;
                const snapped = project.clips.map(c => {
                  const s = snapClipBoundaries({ start: c.start, end: c.end }, segs, { maxExtendEnd: 30, maxBackStart: 15, vadIntervals });
                  if(Math.abs(s.start - c.start) > 0.05 || Math.abs(s.end - c.end) > 0.05){ changed++; return { ...c, start: s.start, end: s.end }; }
                  return c;
                });
                if(changed === 0){ toast("All clips already aligned to sentence boundaries", "info"); return; }
                setProject(p => ({ ...p, clips: snapped }));
                toast("Re-snapped " + changed + " clip" + (changed===1?'':'s') + " to complete thoughts", "success");
              }} disabled={!project.clips || project.clips.length===0}>Fix cuts</button>
              <button className="chip" onClick={() => setPrecisionEnabled(v => !v)}>Precision pass {precisionEnabled ? "ON" : "OFF"}</button>
              <button className="chip" onClick={() => { setSmartCropEnabled(v => !v); smartCropCacheRef.current = {}; setCropPaths({}); }}>Smart crop {smartCropEnabled ? "ON" : "OFF"}</button>
              <button className="chip" onClick={() => setShowWeak(v => !v)}>Show weak {showWeak ? "ON" : "OFF"}</button>
              <button className="chip" onClick={generateAllCaptions} disabled={captionsBusy || !project.clips || project.clips.length===0}>{captionsBusy ? "Generating…" : "Generate captions"}</button>
              {captionsSource && (
                <span className={"chip " + (captionsSource === "claude" ? "text-emerald-200 !border-emerald-400/30 bg-emerald-500/10" : "text-sky-200 !border-sky-400/30 bg-sky-500/10")}>{captionsSource === "claude" ? "Claude" : "Local"}</span>
              )}
              <button className="chip" onClick={explainAllClips} disabled={explainAllBusy || !!explainBusyId || !project.clips || project.clips.length===0}>{explainAllBusy ? "Analyzing…" : (I.spark({size:12}))} {explainAllBusy ? "" : "Explain all"}</button>
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
                    regenBusy={regenBusyId && regenBusyId.startsWith(c.id + ":") ? regenBusyId.split(":")[1] : null}
                    onRemove={()=>removeClip(c.id)}
                    onExplain={()=>explainClip(c.id)}
                    explainBusy={explainBusyId === c.id || (explainAllBusy && !c.hookBreakdown)}
                    onHookAlts={()=>generateHookAlts(c.id)}
                    hookAltsBusy={hookAltsBusyId === c.id}
                    onThumbConcept={()=>generateThumbConcept(c.id)}
                    thumbConceptBusy={thumbBusyId === c.id}
                    onHookScore={()=>generateHookScore(c.id)}
                    hookScoreBusy={hookScoreBusyId === c.id}
                    onObjAnswer={()=>generateObjAnswer(c.id)}
                    objAnswerBusy={objAnswerBusyId === c.id}
                    onCommentSeeds={()=>generateCommentSeeds(c.id)}
                    commentSeedsBusy={commentSeedsBusyId === c.id}
                    onCopyPost={()=>copyPost(c.id)}
                    copyPostBusy={copyPostBusyId === c.id}
                    onRenderVideo={()=>renderClipVideo(c.id)}
                    renderVideoBusy={clipRenderBusyId === c.id}
                    renderVideoProgress={clipRenderBusyId === c.id ? clipRenderProgress : 0}
                    uploadEnabled={!!project.uploadedVideoUrl}
                    uploadedVideoUrl={project.uploadedVideoUrl}
                    sourceUrl={project.source}
                    clipBlobUrl={clipBlobUrls[c.id] ? clipBlobUrls[c.id].video : null}
                    clipThumbUrl={clipBlobUrls[c.id] ? clipBlobUrls[c.id].thumb : null}
                    onShare={(platform)=>shareClip(c.id, platform)}
                    shareBusyPlatform={shareBusyId && shareBusyId.startsWith(c.id + ":") ? shareBusyId.split(":")[1] : null}
                    signals={project.signals || null}
                    trendingMatches={(project.signals && project.signals.trendingMatches) || []}
                    cropPath={smartCropEnabled ? (cropPaths[c.id + ":" + (c.preset || batchPreset)] || null) : null}
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
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button className="btn btn-primary" onClick={exportClipsAsVideo}
              disabled={!project.clips.length || !!batchRenderBusy || !project.uploadedVideoUrl}
              title={!project.uploadedVideoUrl ? "Upload a source video to export rendered clips" : ""}>
              {batchRenderBusy
                ? (processStatus || "Encoding…") + " " + (batchRenderProgress || 0) + "%"
                : <>{I.arrow({size:14})} Export selected as video</>}
            </button>
            <button className="btn btn-outline" onClick={exportClipsAsText}
              disabled={!project.clips.length || !!batchRenderBusy}>
              Export metadata (.txt)
            </button>
            <span className="text-[11px] text-[color:var(--muted)]">
              Video export re-encodes each selected clip via ffmpeg.wasm at the chosen preset (9:16 / 1:1 / 16:9). Multiple clips download as a zip. Metadata export is text only.
            </span>
          </div>
        </div>
        {shareMetadata && (
          <ShareMetadataModal
            meta={shareMetadata}
            onClose={() => setShareMetadata(null)}
            toast={toast}
          />
        )}
      </div>
    </div>
  );
}

function ShareMetadataModal({ meta, onClose, toast }){
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbUrl, setThumbUrl] = useState(null);
  const copyField = async (label, text) => {
    try { await navigator.clipboard.writeText(text); toast("Copied " + label, "success"); }
    catch(e){ toast("Copy failed — select & copy manually", "warn"); }
  };
  const hashLine = (meta.hashtags || []).map(h => "#" + h.replace(/^#/, "")).join(" ");
  const tagsLine = (meta.tags || []).join(", ");
  const descForClipboard = meta.description + (hashLine ? "\n\n" + hashLine : "");
  const platformLabel = meta.platform === "shorts" ? "YouTube Shorts" : meta.platform === "youtube" ? "YouTube" : meta.platform;
  const variants = Array.isArray(meta.titleVariants) && meta.titleVariants.length ? meta.titleVariants : [meta.title];
  const thumb = meta.thumbnail || null;
  const renderThumb = async () => {
    if(!thumb){ toast("No thumbnail brief in this bundle — regenerate metadata", "warn"); return; }
    setThumbBusy(true);
    try {
      // x114b: try HyperFrames satori first when configured — server-side SVG
      // → PNG with crisp text in 1-2s. Falls through to the Pollinations +
      // canvas-overlay path when hyperframes is disabled or unreachable.
      let blob = await renderThumbnailViaHyperFrames(thumb);
      let viaHF = !!blob;
      if(!blob) blob = await renderThumbnailFromBrief(thumb);
      const url = URL.createObjectURL(blob);
      setThumbUrl(url);
      toast(viaHF ? "Thumbnail rendered (HyperFrames) — click to download" : "Thumbnail rendered — click to download", "success");
    } catch(e){
      toast("Thumbnail render failed: " + (e.message || "unknown"), "error");
    } finally {
      setThumbBusy(false);
    }
  };
  const downloadThumb = () => {
    if(!thumbUrl) return;
    const a = document.createElement("a");
    a.href = thumbUrl;
    a.download = "thumbnail-" + (thumb && thumb.headline ? thumb.headline.toLowerCase().replace(/[^a-z0-9]+/g,"-") : "clip") + ".jpg";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 60000);
  };
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[color:var(--panel)] border border-[color:var(--line)] rounded-2xl p-6 max-w-3xl w-full mt-10 zs-fade-in" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold">{platformLabel} metadata</h3>
            <p className="text-[12px] text-[color:var(--muted)] mt-1">AI-generated from your clip + live trending context. Copy each field into the upload page.</p>
          </div>
          <button className="chip" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] font-semibold text-[color:var(--muted)]">Title variants — {variants.length} patterns, copy one</label>
            </div>
            <div className="space-y-2">
              {variants.map((t, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-[color:var(--panel2)] border border-[color:var(--line)]">
                  <span className={"chip shrink-0 " + (i===0 ? "!border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "")}>{i===0 ? "★" : i+1}</span>
                  <div className="flex-1 text-sm">{t}</div>
                  <span className="text-[11px] text-[color:var(--muted)] shrink-0">{t.length}</span>
                  <button className="chip shrink-0" onClick={() => copyField("title", t)}>Copy</button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] font-semibold text-[color:var(--muted)]">Description (with hashtags)</label>
              <button className="chip" onClick={() => copyField("description", descForClipboard)}>Copy description</button>
            </div>
            <div className="p-3 rounded-lg bg-[color:var(--panel2)] border border-[color:var(--line)] text-[13px] whitespace-pre-wrap max-h-64 overflow-y-auto">{descForClipboard}</div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] font-semibold text-[color:var(--muted)]">SEO tags ({(meta.tags||[]).length})</label>
              <button className="chip" onClick={() => copyField("SEO tags", tagsLine)}>Copy tags</button>
            </div>
            <div className="p-3 rounded-lg bg-[color:var(--panel2)] border border-[color:var(--line)] text-[12px] text-[color:var(--muted)]">{tagsLine || "—"}</div>
          </div>
          {thumb && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[12px] font-semibold text-[color:var(--muted)]">Thumbnail brief + render</label>
                <div className="flex gap-2">
                  <button className="chip" disabled={thumbBusy} onClick={renderThumb}>{thumbBusy ? "Rendering…" : "Generate thumbnail"}</button>
                  {thumbUrl && <button className="chip" onClick={downloadThumb}>Download</button>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[color:var(--panel2)] border border-[color:var(--line)] text-[12px] space-y-2">
                  <div><span className="text-[color:var(--muted)]">Headline:</span> <strong className="text-white">{thumb.headline}</strong></div>
                  <div><span className="text-[color:var(--muted)]">Subject:</span> {thumb.subject}</div>
                  <div><span className="text-[color:var(--muted)]">Background:</span> {thumb.background}</div>
                  <div><span className="text-[color:var(--muted)]">Palette:</span> {thumb.palette}</div>
                  <div className="italic text-[color:var(--muted)]">{thumb.reasoning}</div>
                </div>
                <div className="flex items-center justify-center rounded-lg bg-[color:var(--panel2)] border border-[color:var(--line)] min-h-[280px] overflow-hidden">
                  {thumbUrl
                    ? <img src={thumbUrl} alt="Generated thumbnail" className="max-h-[420px] w-auto rounded" />
                    : <span className="text-[11px] text-[color:var(--muted)] italic p-4 text-center">Click "Generate thumbnail" — Pollinations renders the base, we composite clean text on top.</span>}
                </div>
              </div>
            </div>
          )}
          {meta.trendingUsed > 0 && (
            <div className="text-[11px] text-[color:var(--muted)]">Folded in {meta.trendingUsed} trending signals from Google / HN / Reddit / X.</div>
          )}
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
// x105: Architecture reshaped to match the real 8 Studio stages and the actual
// provider wiring. `claude` uses the user's Anthropic subscription via the
// worker proxy — treated as "included", not paid-per-call. Everything else
// free/local: Pollinations for images, browser SpeechSynthesis for voice,
// Canvas Ken Burns for motion, ffmpeg.wasm for export.
const PIPELINE_STAGES = [
  { id:"research",   label:"Research",   icon:"search", providers:["claude","grok"],                     defaultProvider:"claude",           latency:2.5, cost:0.00, desc:"Sub-agent: gather sources + extract trending angles. Uses your Anthropic subscription." },
  { id:"script",     label:"Script",     icon:"edit",   providers:["claude","grok"],                     defaultProvider:"claude",           latency:3.0, cost:0.00, desc:"Sub-agent: write the beat-by-beat narration. Voice-matched copy with hooks + payoffs." },
  { id:"storyboard", label:"Storyboard", icon:"layers", providers:["flux-free","stability"],             defaultProvider:"flux-free",        latency:8.0, cost:0.00, desc:"Sub-agent: shot descriptions per beat + images from Pollinations Flux (free)." },
  { id:"assets",     label:"Assets",     icon:"link",   providers:["reuse-scene","pexels"],              defaultProvider:"reuse-scene",      latency:0.5, cost:0.00, desc:"B-roll per scene. Reuses scene image (free) or pulls from Pexels stock (free with key)." },
  { id:"motion",     label:"Motion",     icon:"spark",  providers:["local-ken-burns","pollinations-wan"],defaultProvider:"local-ken-burns",  latency:0.5, cost:0.00, desc:"Ken Burns pan/zoom animation in the canvas (free). Optional image→video via Pollinations Wan." },
  { id:"voice",      label:"Voice",      icon:"mic",    providers:["browser-tts","elevenlabs"],          defaultProvider:"browser-tts",      latency:1.5, cost:0.00, desc:"Free browser SpeechSynthesis by default. ElevenLabs if you add a key in Settings." },
  { id:"timeline",   label:"Timeline",   icon:"layers", providers:["local"],                             defaultProvider:"local",            latency:0.0, cost:0.00, desc:"Local arrangement — reorder scenes, set durations, add transitions. No API." },
  { id:"export",     label:"Export",     icon:"play",   providers:["ffmpeg-wasm"],                       defaultProvider:"ffmpeg-wasm",      latency:8.0, cost:0.00, desc:"ffmpeg.wasm renders 1080p H.264 MP4 matching the preset. All client-side." }
];

// x105: provider metadata. `kind: "included"` = runs through the user's
// Anthropic subscription via our Cloudflare Worker proxy (treated as
// always-on, no per-call metering in our UI). `kind: "free"` = free public
// API / browser built-in / local compute. `kind: "byok"` = user supplies
// their own key in Settings.
const PROVIDER_META = {
  "claude":             { label:"Claude (Anthropic)",    kind:"included", pricingNote:"runs through your Anthropic subscription" },
  "grok":               { label:"Grok (xAI, free tier)", kind:"free",     pricingNote:"free tier via xAI — backup LLM" },
  "flux-free":          { label:"Pollinations Flux",     kind:"free",     pricingNote:"free image endpoint — no key needed" },
  "stability":          { label:"Stability SD3",         kind:"byok",     pricingNote:"requires Stability API key (out of credits on this account)" },
  "reuse-scene":        { label:"Reuse scene image",     kind:"free",     pricingNote:"zero extra cost — uses storyboard art" },
  "pexels":             { label:"Pexels stock",          kind:"byok",     pricingNote:"free API key, unlimited photos + videos" },
  "local-ken-burns":    { label:"Canvas Ken Burns",      kind:"free",     pricingNote:"client-side pan/zoom — no API" },
  "pollinations-wan":   { label:"Pollinations Wan-fast", kind:"free",     pricingNote:"free image→video (low quota)" },
  "browser-tts":        { label:"Browser SpeechSynthesis", kind:"free",   pricingNote:"built into Chrome — no key, OK quality" },
  "elevenlabs":         { label:"ElevenLabs",            kind:"byok",     pricingNote:"10K chars/mo free with key; paid thereafter" },
  "local":              { label:"Local (client-side)",   kind:"free",     pricingNote:"no API" },
  "ffmpeg-wasm":        { label:"ffmpeg.wasm",           kind:"free",     pricingNote:"30 MB one-time download, runs in browser" }
};

// x105: palette per provider kind — matches the new semantics.
const PROVIDER_KIND_STYLE = {
  "included": { badge:"INCLUDED", cls:"border-indigo-500/40 text-indigo-200 bg-indigo-500/10" },
  "free":     { badge:"FREE",     cls:"border-emerald-500/40 text-emerald-200 bg-emerald-500/10" },
  "byok":     { badge:"BYO-KEY",  cls:"border-amber-500/40 text-amber-200 bg-amber-500/10" }
};

function ArchitectureTab(){
  const [picks, setPicks] = React.useState(() => {
    // x105: sanitize existing picks against the current PIPELINE_STAGES shape.
    // Old stored state may reference removed providers (openai, heygen, local-llm, etc.);
    // fall back to each stage's defaultProvider for any unknown value so the UI
    // never renders an orphaned row.
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem("zaidsaid.v2.arch.picks") || "{}"); } catch(e){}
    const init = {};
    PIPELINE_STAGES.forEach(s => {
      const v = stored[s.id];
      init[s.id] = (v && s.providers.includes(v)) ? v : s.defaultProvider;
    });
    return init;
  });
  const [active, setActive] = React.useState(PIPELINE_STAGES[0].id);

  React.useEffect(() => {
    try { localStorage.setItem("zaidsaid.v2.arch.picks", JSON.stringify(picks)); } catch(e){}
  }, [picks]);

  const totalLatency = PIPELINE_STAGES.reduce((sum, s) => sum + (s.latency || 0), 0);
  const activeStage = PIPELINE_STAGES.find(s => s.id === active);
  const includedCount = PIPELINE_STAGES.filter(s => (PROVIDER_META[picks[s.id]]||{}).kind === "included").length;
  const freeCount     = PIPELINE_STAGES.filter(s => (PROVIDER_META[picks[s.id]]||{}).kind === "free").length;
  const byokCount     = PIPELINE_STAGES.filter(s => (PROVIDER_META[picks[s.id]]||{}).kind === "byok").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold">Architecture</div>
          <div className="text-xs text-[color:var(--muted)] mt-1">The 8-stage Studio pipeline, one sub-agent per stage. Claude stages use your Anthropic subscription. Every other stage is free or uses a BYOK free tier — no per-run cost out-of-the-box.</div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="card p-4"><div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">Est. end-to-end latency</div><div className="text-2xl font-semibold mt-1">{totalLatency.toFixed(1)}s</div><div className="text-[11px] text-[color:var(--muted)] mt-1">{PIPELINE_STAGES.length} stages · sequential</div></div>
        <div className="card p-4"><div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">Per-run cost</div><div className="text-2xl font-semibold mt-1">$0.00</div><div className="text-[11px] text-[color:var(--muted)] mt-1">Anthropic subscription + free APIs</div></div>
        <div className="card p-4"><div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)]">Stage mix</div><div className="text-sm font-semibold mt-2 flex gap-2 flex-wrap">{includedCount>0 && <span className={"chip " + PROVIDER_KIND_STYLE.included.cls}>{includedCount} included</span>}{freeCount>0 && <span className={"chip " + PROVIDER_KIND_STYLE.free.cls}>{freeCount} free</span>}{byokCount>0 && <span className={"chip " + PROVIDER_KIND_STYLE.byok.cls}>{byokCount} BYO-key</span>}</div></div>
      </div>

      <div className="card p-4">
        <div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)] mb-3">Pipeline — 8 stages, one sub-agent each</div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((s, i) => {
            const p = picks[s.id];
            const meta = PROVIDER_META[p] || { label: p, kind:"free" };
            const kindStyle = PROVIDER_KIND_STYLE[meta.kind] || PROVIDER_KIND_STYLE.free;
            const isActive = s.id === active;
            return (
              <React.Fragment key={s.id}>
                <button onClick={()=>setActive(s.id)} className={"shrink-0 w-44 text-left p-3 rounded-xl border transition " + (isActive ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 hover:border-white/30")}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-bold text-[color:var(--muted)]">{String(i+1).padStart(2,'0')}</span>
                    <span className="text-xs font-semibold">{s.label}</span>
                  </div>
                  <div className="text-[10px] text-[color:var(--muted)] mt-2 truncate">{meta.label}</div>
                  <div className="mt-2 flex items-center gap-1">
                    <span className={"text-[9px] px-1.5 py-0.5 rounded-full border " + kindStyle.cls}>{kindStyle.badge}</span>
                    <span className="text-[10px] text-[color:var(--muted)]">{s.latency.toFixed(1)}s</span>
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
            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-[color:var(--muted)]">{String(PIPELINE_STAGES.findIndex(s=>s.id===activeStage.id)+1).padStart(2,'0')}</span>
            <div>
              <div className="font-semibold">{activeStage.label}</div>
              <div className="text-[11px] text-[color:var(--muted)]">{activeStage.desc}</div>
            </div>
          </div>
          <div className="text-[11px] uppercase tracking-wider text-[color:var(--muted)] mt-3 mb-2">Provider</div>
          <div className="grid md:grid-cols-2 gap-2">
            {activeStage.providers.map(p => {
              const meta = PROVIDER_META[p] || { label:p, kind:"free", pricingNote:"" };
              const kindStyle = PROVIDER_KIND_STYLE[meta.kind] || PROVIDER_KIND_STYLE.free;
              const isPicked = picks[activeStage.id] === p;
              const isSingle = activeStage.providers.length === 1;
              return (
                <button key={p} disabled={isSingle} onClick={()=>setPicks(x => ({ ...x, [activeStage.id]: p }))} className={"text-left p-3 rounded-lg border " + (isPicked ? "border-indigo-400 bg-indigo-500/10" : "border-white/10 hover:border-white/20") + (isSingle ? " cursor-default" : "")}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{meta.label}</div>
                    <span className={"text-[10px] px-2 py-0.5 rounded-full border " + kindStyle.cls}>{kindStyle.badge}</span>
                  </div>
                  <div className="text-[11px] text-[color:var(--muted)] mt-1">{meta.pricingNote}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-[11px] text-[color:var(--muted)]">Latency estimate: <span className="text-white">{activeStage.latency.toFixed(1)}s</span></div>
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
