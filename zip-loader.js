// ESM module loaded natively by the browser (not Babel-transformed, so the
// dynamic import() survives). Exposes window.zsLoadJSZip that app.js awaits
// before any zip operation.
window.zsLoadJSZip = async () => {
  try {
    const mod = await import("https://unpkg.com/jszip@3.10.1/dist/jszip.min.js");
    // JSZip UMD build sets window.JSZip when executed as script. ESM dynamic
    // import may surface it as mod.default or window.JSZip depending on bundler.
    const JSZip = window.JSZip || (mod && mod.default) || mod;
    if(JSZip && typeof JSZip === "function") return JSZip;
    throw new Error("JSZip not resolved from ESM import");
  } catch(_) {
    // Fallback: inject a classic <script> tag and wait for window.JSZip.
    return new Promise((resolve, reject) => {
      if(window.JSZip) return resolve(window.JSZip);
      const s = document.createElement("script");
      s.src = "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js";
      s.onload = () => { window.JSZip ? resolve(window.JSZip) : reject(new Error("JSZip script loaded but window.JSZip not set")); };
      s.onerror = () => reject(new Error("JSZip script load failed"));
      document.head.appendChild(s);
    });
  }
};
