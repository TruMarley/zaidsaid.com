// ESM module loaded natively by the browser (not Babel-transformed, so the
// dynamic import() survives). Exposes a single global that app.js awaits
// before any ffmpeg.wasm work.
//
// x99: @ffmpeg/ffmpeg + @ffmpeg/util are now self-hosted under ./vendor/
// because Chrome refuses to construct a Worker from a cross-origin URL
// (even with CORS + CSP permission), and @ffmpeg/ffmpeg@0.12.10 does
// `new Worker(new URL("./worker.js", import.meta.url), {type:"module"})`
// relative to its own module URL. Serving the ESM bundle same-origin
// lets the Worker constructor succeed. @ffmpeg/core (WASM) is still
// loaded from unpkg via toBlobURL — that path uses a blob: URL so it's
// effectively same-origin from the Worker's perspective.
window.zsLoadFfmpeg = async () => {
  const [ffmpegMod, utilMod] = await Promise.all([
    import("./vendor/ffmpeg/esm/index.js"),
    import("./vendor/util/esm/index.js")
  ]);
  return {
    FFmpeg: ffmpegMod.FFmpeg,
    fetchFile: utilMod.fetchFile,
    toBlobURL: utilMod.toBlobURL
  };
};
