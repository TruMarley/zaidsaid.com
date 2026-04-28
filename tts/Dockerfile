# Production image for the tts sidecar.
# Python 3.11 + piper (ONNX-based, lightest sidecar). Coqui XTTS-v2 also
# installed but optional — comment the second uv pip block to slim further.
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8791 \
    TTS_CORS_ORIGIN=* \
    PIPER_CACHE=/tmp/piper-cache

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      build-essential \
      curl \
      ca-certificates \
      espeak-ng \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml ./

# Core: piper (small ONNX, ~50 MB per voice cached at first request).
RUN uv pip install --system --no-cache-dir \
      "fastapi>=0.115" \
      "uvicorn[standard]>=0.32" \
      "python-multipart>=0.0.20" \
      "pydantic>=2.9" \
      "numpy>=1.26" \
      "piper-tts>=1.4"

# Optional: Coqui XTTS-v2 (voice cloning). Pulls in PyTorch — adds ~2 GB.
# Comment out if you don't need cloning to ship a 200 MB image instead.
# RUN uv pip install --system --no-cache-dir "TTS>=0.22"

COPY main.py ./

EXPOSE 8791

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8791"]
