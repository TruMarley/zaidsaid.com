# Production image for the audio-ai sidecar.
# Python 3.11 + ffmpeg + ML stack (faster-whisper, silero-vad, demucs, auto-editor,
# captacity, moviepy, ffmpeg-python). Heavy ML deps lazy-import on first
# request — boot is sub-second.
#
# Image is large (~3-4 GB) because PyTorch + transitive ML libs. Models
# themselves download to ephemeral storage on first request per route.
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_COMPILE_BYTECODE=1 \
    PORT=8789 \
    AUDIO_AI_CORS_ORIGIN=* \
    HF_HOME=/tmp/hf-cache

# ffmpeg for audio I/O across every route; build-essential for any wheels
# that need to compile (lap, ctranslate2, etc.). curl for healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      build-essential \
      curl \
      ca-certificates \
      libsndfile1 \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

# uv = fast pip (10-100× faster) — installs the same wheels.
RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml ./

# CRITICAL: install torch + torchaudio + torchcodec from PyTorch's CPU-only
# index BEFORE other deps. Otherwise pip pulls the 6 GB CUDA stack
# transitively for libs that only need CPU inference on Fly's shared boxes.
RUN uv pip install --system --no-cache-dir \
      --index-strategy unsafe-best-match \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      "torch>=2.4,<2.10" \
      "torchaudio>=2.4,<2.10"

# Core deps. faster-whisper uses CTranslate2 (no torch dep). silero-vad's
# I/O backend is torchaudio (already CPU-only above).
RUN uv pip install --system --no-cache-dir \
      "fastapi>=0.115" \
      "uvicorn[standard]>=0.32" \
      "python-multipart>=0.0.20" \
      "pydantic>=2.9" \
      "ffmpeg-python>=0.2.0" \
      "silero-vad>=5.1" \
      "onnxruntime>=1.20" \
      "auto-editor>=27" \
      "faster-whisper>=1.1"

# Heavy optional deps — separate layer so faster-whisper updates don't bust
# the demucs cache. Comment out to slim the image.
RUN uv pip install --system --no-cache-dir \
      "demucs>=4.0" \
      "moviepy>=1.0"

COPY main.py ./

EXPOSE 8789

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8789"]
