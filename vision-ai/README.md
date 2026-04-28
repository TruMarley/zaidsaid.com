# vision-ai

Open-source vision AI sidecar — subject segmentation, person/face tracking,
semantic asset search.

## Tools

| Route               | Tool       | What it does                                      |
| ------------------- | ---------- | ------------------------------------------------- |
| `POST /segment`     | SAM2       | Subject mask cutout (RGBA PNG or JSON polygons)   |
| `POST /track-people`| YOLOv8     | Bounding boxes + stable IDs across video frames   |
| `POST /embed-image` | OpenCLIP   | Image → 512/768-dim embedding                     |
| `POST /embed-text`  | OpenCLIP   | Text → 512/768-dim embedding (cosine to images)   |
| `GET  /ping`        | —          | Health + warm-model report                        |

## Run

```bash
cd vision-ai
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8790
```

Cold-start sizes:
- YOLOv8n: ~6 MB, loads in <1 s
- SAM2-hiera-base-plus: ~160 MB, ~5 s
- OpenCLIP ViT-B-32: ~600 MB, ~3 s

Subsequent requests reuse the warm model (sub-100 ms for ViT-B-32 embedding).

## Where each plugs into zaidsaid

**SAM2 → smart-crop (x108) upgrade.** MediaPipe gives a face bbox; SAM2
gives a true subject mask. For talking-head clips with hands/props
(cooking, demo, sketch), the mask captures more useful context.

**YOLOv8 → multi-person clip splits.** Pair with audio-ai's pyannote
diarization to do "everything Speaker A said while Speaker A was on
camera". Useful for podcast clipping where guests rotate.

**OpenCLIP → B-roll matching.** For each clip's transcript paragraph,
embed text via `/embed-text`, find the nearest stock clip from a Pexels
/ Pollinations index pre-embedded via `/embed-image`. Drops the
dependency on an LLM-generated keyword query.

## Deploy

CPU works for embeddings and YOLOv8n. SAM2 is GPU-friendly (4× faster on
T4). For GPU sidecar: Modal / Replicate / RunPod, same pattern as
`audio-ai`.

## Front-end wiring

Tracked as x112b/c/d — same shape as x110b for HyperFrames:
- x112b: `getVisionAiPath()` helper + `vision` provider seed
- x112c: SAM2-driven smart-crop upgrade behind a feature flag
- x112d: OpenCLIP B-roll match for Studio's Storyboard stage
