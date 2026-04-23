// ESM module loaded natively by the browser (type="module"). Exposes a single
// global that app.js awaits before any MediaPipe face detection work.
//
// x108: Babel standalone (the in-browser transpiler used for app.js) does NOT
// preserve dynamic `import()` of .mjs modules — it rewrites to `require()`,
// which throws in the browser. Native <script type="module"> does handle the
// dynamic import correctly, so we load MediaPipe's vision bundle here and
// hoist the symbols onto window for app.js to pick up synchronously via
// `window.zsLoadMediaPipe()`.
window.zsLoadMediaPipe = async () => {
  const base = new URL("./vendor/mediapipe/vision/", window.location.href).href;
  const mod = await import("./vendor/mediapipe/vision/vision_bundle.mjs");
  return {
    FilesetResolver: mod.FilesetResolver,
    FaceDetector: mod.FaceDetector,
    base
  };
};
