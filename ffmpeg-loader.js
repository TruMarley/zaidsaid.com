// ESM module loaded natively by the browser (not Babel-transformed, so the
// dynamic import() survives). Exposes a single global that app.js awaits
// before any ffmpeg.wasm work.
window.zsLoadFfmpeg = async () => {
  const [ffmpegMod, utilMod] = await Promise.all([
    import("https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js"),
    import("https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js")
  ]);
  return {
    FFmpeg: ffmpegMod.FFmpeg,
    fetchFile: utilMod.fetchFile,
    toBlobURL: utilMod.toBlobURL
  };
};
