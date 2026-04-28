# Production image for the vision-ai sidecar.
# Python 3.11 + ffmpeg + PyTorch + SAM2 + ultralytics + open-clip-torch.
# Heaviest of the four sidecars (~4-5 GB) — every dep is PyTorch-based.
# Models lazy-load on first request.
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8790 \
    VISION_AI_CORS_ORIGIN=* \
    HF_HOME=/tmp/hf-cache \
    YOLO_CONFIG_DIR=/tmp/yolo-cfg

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      build-essential \
      curl \
      ca-certificates \
      libgl1 \
      libglib2.0-0 \
      libsm6 \
      libxext6 \
      libxrender1 \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml ./

# CRITICAL: install CPU-only torch + torchvision FIRST. Otherwise sam2,
# ultralytics, and open-clip-torch transitively pull the ~6 GB CUDA stack.
RUN uv pip install --system --no-cache-dir \
      --index-strategy unsafe-best-match \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      "torch>=2.4,<2.10" \
      "torchvision>=0.19,<0.25"

RUN uv pip install --system --no-cache-dir \
      "fastapi>=0.115" \
      "uvicorn[standard]>=0.32" \
      "python-multipart>=0.0.20" \
      "pydantic>=2.9" \
      "pillow>=10.4" \
      "numpy>=1.26" \
      "opencv-python-headless>=4.10" \
      "ultralytics>=8.3" \
      "lap" \
      "huggingface_hub" \
      "sam2>=1.1" \
      "open-clip-torch>=2.30"

COPY main.py ./

EXPOSE 8790

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8790"]
