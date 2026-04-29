# Production image for the HyperFrames render service.
# Node 22 + system Chromium (for Puppeteer) + ffmpeg.
#
# Build:  docker build -t hf-renderer .
# Run:    docker run --rm -p 8788:8788 hf-renderer
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=8788 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    HF_CORS_ORIGIN=*

# Chromium for Puppeteer + ffmpeg + the small set of fonts/libs
# Chrome needs to render text and load video correctly.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ffmpeg \
      ca-certificates \
      fonts-liberation \
      fonts-noto-color-emoji \
      libnss3 \
      libxss1 \
      libasound2 \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache npm install when only source changes
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

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
