# Production image for the HyperFrames render service.
# Node 22 + system Chromium (for Puppeteer) + ffmpeg.
#
# Build:  docker build -t hf-renderer .
# Run:    docker run --rm -p 8788:8788 hf-renderer
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=8788 \
    HF_CORS_ORIGIN=*
# x128f: don't skip Puppeteer's bundled Chromium download — HF uses the
# `HeadlessExperimental.beginFrame` CDP method which the apt-get
# `chromium` package doesn't expose. Letting Puppeteer install its own
# Chromium (matched to its API expectations) is the supported path.

# ffmpeg + the small set of system libs Chromium needs at runtime.
# Chromium itself comes from Puppeteer's npm install, not apt.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      ca-certificates \
      fonts-liberation \
      fonts-noto-color-emoji \
      libnss3 \
      libxss1 \
      libasound2 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libdrm2 \
      libgbm1 \
      libgtk-3-0 \
      libpango-1.0-0 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libxkbcommon0 \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache npm install when only source changes
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# x131b: pre-download HF's bundled Chrome at build time. HF uses a separate
# Chrome from Puppeteer (managed by `hyperframes browser ensure`) and on a
# read-only / ephemeral container will otherwise download 107 MB on first
# render. Baking it into the image cuts cold-start render time from ~30s
# (download + extract) to ~5s (just launch).
ENV HYPERFRAMES_BROWSER_DIR=/app/.hyperframes-browser
RUN node_modules/.bin/hyperframes browser ensure

COPY server.mjs ./
COPY templates/ ./templates/
COPY bin/ ./bin/
COPY registry/ ./registry/
COPY projects/ ./projects/

# Render output dir (ephemeral; per-request workdirs go through os.tmpdir())
RUN mkdir -p renders

EXPOSE 8788

# dumb-init reaps zombie Chrome processes left behind by hyperframes' workers
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.mjs"]
