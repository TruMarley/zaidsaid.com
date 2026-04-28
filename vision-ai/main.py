"""
zaidsaid vision-ai sidecar

Three open-source vision tools behind one FastAPI:
  - SAM2 (Apache-2.0)        — subject segmentation: extract / replace bg
  - YOLOv8 (Ultralytics)     — person/face tracking with stable IDs
  - OpenCLIP (MIT)           — semantic embedding for B-roll asset search

Same lazy-load pattern as audio-ai. Models warm on first request and stay
warm. Service starts in <1s.

Routes:
  POST /segment             — SAM2: return mask(s) for the subject(s) in a frame
  POST /track-people        — YOLOv8: bounding boxes + stable IDs across frames
                              (consume on a sampled video — 2 fps is plenty)
  POST /embed-image         — OpenCLIP: image → vector for semantic search
  POST /embed-text          — OpenCLIP: text → vector for "find a clip that
                              matches this transcript paragraph"
  GET  /ping                — health + warm-model report
"""
from __future__ import annotations

import io
import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI(title="zaidsaid-vision-ai", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("VISION_AI_CORS_ORIGIN", "*")],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

_MODELS: dict[str, Any] = {}


@app.get("/ping")
def ping() -> dict[str, Any]:
    return {"ok": True, "service": "zaidsaid-vision-ai", "warm": sorted(_MODELS.keys())}


# -----------------------------------------------------------------------------
# SAM2 — subject segmentation
# -----------------------------------------------------------------------------


@app.post("/segment")
async def segment(
    file: UploadFile = File(..., description="Single frame (JPEG/PNG)"),
    point_x: float | None = Form(None, description="Click point x (normalized 0-1) — optional, default center"),
    point_y: float | None = Form(None, description="Click point y (normalized 0-1)"),
    return_format: str = Form("png", description="png (RGBA mask cutout) | json (raw mask coords)"),
) -> Any:
    """
    SAM2 single-frame segmentation. Returns either an RGBA cutout (subject
    isolated, transparent bg) or raw mask polygons.

    Wire this into smart-crop to replace MediaPipe's bbox with a true
    subject mask — useful when the subject occupies <30% of the frame and
    the existing face-bbox crop misses context (hands, body, props).
    """
    img_bytes = await file.read()
    px = 0.5 if point_x is None else max(0.0, min(1.0, point_x))
    py = 0.5 if point_y is None else max(0.0, min(1.0, point_y))
    if return_format not in ("png", "json"):
        raise HTTPException(400, "return_format must be png or json")
    return _sam2_single(img_bytes, px=px, py=py, return_format=return_format)


# -----------------------------------------------------------------------------
# YOLOv8 — person / face tracking
# -----------------------------------------------------------------------------


@app.post("/track-people")
async def track_people(
    file: UploadFile = File(..., description="Video (MP4) — sample at 2 fps internally"),
    sample_fps: float = Form(2.0, description="Frames per second to sample"),
    classes: str = Form("person", description="Comma-separated COCO class names"),
    model: str = Form("yolov8n.pt", description="yolov8n.pt | yolov8s.pt | yolov8m.pt"),
) -> JSONResponse:
    """
    Sample the video at low fps and run YOLOv8 with byte-track. Returns:
      { tracks: [{ id, class, frames: [{t, x, y, w, h, conf}] }],
        sampled_frames, fps }

    Use this to (a) refine smart-crop when MediaPipe loses lock,
    (b) export per-person clips ("everything where speaker A is on screen"),
    (c) auto-blur untracked subjects for privacy.
    """
    with _tmpdir() as tmp:
        in_path = await _stash_upload(file, tmp, "in.mp4")
        t0 = time.time()
        result = _yolo_track(in_path, sample_fps=sample_fps, classes=classes, model=model)
        result["elapsed_sec"] = round(time.time() - t0, 3)
        return JSONResponse(result)


# -----------------------------------------------------------------------------
# OpenCLIP — semantic embeddings for asset search
# -----------------------------------------------------------------------------


@app.post("/embed-image")
async def embed_image(
    file: UploadFile = File(...),
    model: str = Form("ViT-B-32", description="ViT-B-32 | ViT-L-14 | ViT-H-14"),
    pretrained: str = Form("laion2b_s34b_b79k"),
) -> JSONResponse:
    """OpenCLIP image embedding — 512-dim (B-32) or 768-dim (L-14). Cosine-comparable to /embed-text vectors."""
    img_bytes = await file.read()
    vec, dim = _clip_embed_image(img_bytes, model=model, pretrained=pretrained)
    return JSONResponse({"vec": vec, "dim": dim, "model": model})


@app.post("/embed-text")
async def embed_text(
    text: str = Form(...),
    model: str = Form("ViT-B-32"),
    pretrained: str = Form("laion2b_s34b_b79k"),
) -> JSONResponse:
    """OpenCLIP text embedding. Use it to search a Pexels / Pollinations index by transcript paragraph semantics."""
    vec, dim = _clip_embed_text(text, model=model, pretrained=pretrained)
    return JSONResponse({"vec": vec, "dim": dim, "model": model})


# -----------------------------------------------------------------------------
# Lazy tool wrappers
# -----------------------------------------------------------------------------


def _sam2_single(img_bytes: bytes, *, px: float, py: float, return_format: str) -> Any:
    import numpy as np
    from PIL import Image

    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    arr = np.array(img)
    h, w = arr.shape[:2]
    point = np.array([[int(px * w), int(py * h)]], dtype=np.float32)
    label = np.array([1], dtype=np.int32)

    if "sam2" not in _MODELS:
        import torch  # type: ignore[import-untyped]
        from sam2.sam2_image_predictor import SAM2ImagePredictor  # type: ignore[import-untyped]
        device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
        _MODELS["sam2"] = SAM2ImagePredictor.from_pretrained("facebook/sam2.1-hiera-base-plus", device=device)
    predictor = _MODELS["sam2"]
    predictor.set_image(arr)
    masks, scores, _ = predictor.predict(point_coords=point, point_labels=label, multimask_output=False)
    mask = masks[0]  # bool HxW

    if return_format == "json":
        # Compact: bbox + run-length for the mask
        ys, xs = np.where(mask)
        if len(ys) == 0:
            return JSONResponse({"empty": True})
        return JSONResponse({
            "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
            "score": float(scores[0]),
            "h": int(h), "w": int(w),
            "area_ratio": float(mask.sum() / (h * w)),
        })

    # RGBA cutout
    rgba = np.dstack([arr, (mask * 255).astype(np.uint8)])
    out_buf = io.BytesIO()
    Image.fromarray(rgba, mode="RGBA").save(out_buf, format="PNG")
    out_buf.seek(0)
    return StreamingResponse(out_buf, media_type="image/png")


def _yolo_track(path: Path, *, sample_fps: float, classes: str, model: str) -> dict[str, Any]:
    import cv2  # type: ignore[import-untyped]
    from ultralytics import YOLO  # type: ignore[import-untyped]

    key = f"yolo:{model}"
    if key not in _MODELS:
        _MODELS[key] = YOLO(model)
    yolo = _MODELS[key]

    name_to_idx = {v: k for k, v in yolo.names.items()}
    class_filter = [name_to_idx[c.strip()] for c in classes.split(",") if c.strip() in name_to_idx]

    cap = cv2.VideoCapture(str(path))
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    step = max(1, int(round(src_fps / max(0.5, sample_fps))))

    tracks: dict[int, dict[str, Any]] = {}
    sampled = 0
    frame_idx = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_idx % step == 0:
            t = frame_idx / src_fps
            results = yolo.track(frame, persist=True, classes=class_filter or None, verbose=False)[0]
            if results.boxes is not None and results.boxes.id is not None:
                ids = results.boxes.id.int().cpu().tolist()
                xywh = results.boxes.xywh.cpu().tolist()
                clss = results.boxes.cls.int().cpu().tolist()
                confs = results.boxes.conf.cpu().tolist()
                for i, (oid, (cx, cy, w, h), cls_id, conf) in enumerate(zip(ids, xywh, clss, confs)):
                    rec = tracks.setdefault(oid, {"id": int(oid), "class": yolo.names[int(cls_id)], "frames": []})
                    rec["frames"].append({"t": round(t, 3), "x": float(cx - w / 2), "y": float(cy - h / 2), "w": float(w), "h": float(h), "conf": float(conf)})
            sampled += 1
        frame_idx += 1
    cap.release()
    return {
        "tracks": list(tracks.values()),
        "sampled_frames": sampled,
        "src_fps": round(float(src_fps), 3),
        "total_frames": total_frames,
    }


def _clip_load(model: str, pretrained: str):
    import open_clip  # type: ignore[import-untyped]
    import torch  # type: ignore[import-untyped]

    key = f"clip:{model}:{pretrained}"
    if key not in _MODELS:
        m, _, preprocess = open_clip.create_model_and_transforms(model, pretrained=pretrained)
        m.eval()
        tokenizer = open_clip.get_tokenizer(model)
        _MODELS[key] = (m, preprocess, tokenizer)
    return _MODELS[key]


def _clip_embed_image(img_bytes: bytes, *, model: str, pretrained: str) -> tuple[list[float], int]:
    import torch  # type: ignore[import-untyped]
    from PIL import Image

    m, preprocess, _ = _clip_load(model, pretrained)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    tensor = preprocess(img).unsqueeze(0)
    with torch.no_grad():
        feat = m.encode_image(tensor)
        feat = feat / feat.norm(dim=-1, keepdim=True)
    vec = feat[0].cpu().tolist()
    return vec, len(vec)


def _clip_embed_text(text: str, *, model: str, pretrained: str) -> tuple[list[float], int]:
    import torch  # type: ignore[import-untyped]

    m, _, tokenizer = _clip_load(model, pretrained)
    tokens = tokenizer([text])
    with torch.no_grad():
        feat = m.encode_text(tokens)
        feat = feat / feat.norm(dim=-1, keepdim=True)
    vec = feat[0].cpu().tolist()
    return vec, len(vec)


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


class _tmpdir:
    def __enter__(self) -> Path:
        self._d = Path(tempfile.mkdtemp(prefix="vision-ai-"))
        return self._d

    def __exit__(self, *_: Any) -> None:
        shutil.rmtree(self._d, ignore_errors=True)


async def _stash_upload(file: UploadFile, tmp: Path, name: str) -> Path:
    p = tmp / name
    with p.open("wb") as f:
        while True:
            chunk = await file.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    return p
