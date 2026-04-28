# audio-ai

Open-source audio AI sidecar for zaidsaid. Replaces / complements the
per-call vendors the front-end currently leans on (ElevenLabs Scribe).

## Tools wrapped

| Route             | Tool                                      | What it does                                         |
| ----------------- | ----------------------------------------- | ---------------------------------------------------- |
| `POST /transcribe`| WhisperX or faster-whisper                | Word-level transcription (drop-in for Scribe)        |
| `POST /diarize`   | pyannote-audio                            | Speaker labels — who's talking when                  |
| `POST /separate`  | demucs                                    | Vocals vs music vs drums vs other (copyright cleanup)|
| `POST /vad`       | silero-vad                                | Voice-activity intervals (snap clip boundaries)      |
| `POST /silence-trim` | auto-editor                            | Drop dead air, return keep ranges                    |
| `POST /captions`  | captacity                                 | Burn whisper captions onto a video                   |
| `GET  /ping`      | —                                         | Health + warm-model report                           |

## Run

```bash
cd audio-ai
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8789
```

Models lazy-load on first call (cold start ~30s for whisper-large, ~5s for
silero-vad). Subsequent calls reuse the warm model.

`pyannote` requires a HuggingFace token with access to
`pyannote/speaker-diarization-3.1` — pass it as the `hf_token` form field.

## How it plugs into zaidsaid

Same pattern as `hyperframes-renderer`:

1. Run this service somewhere reachable (local dev: `:8789`; production:
   put it behind the cloudflare-worker via `wrangler secret put AUDIO_AI_URL`).
2. The proxy forwards `/audio/*` → `${AUDIO_AI_URL}/*`.
3. Front-end providers seed an `audio-ai` entry pointing at
   `_ZS_WORKER + "/audio"`, default `enabled: false`.
4. Flip the toggle in Settings → Providers when you want to use it.

## Replacement candidates inside the existing pipeline

| Current path                               | Audio-AI replacement / addition                                  |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `transcribeUploadedFile` → ElevenLabs      | `POST /transcribe` (WhisperX) — zero per-call cost + diarization |
| Sentence-snap heuristic in `snapClipBoundaries` | `POST /vad` for sub-segment speech presence                |
| (none)                                     | `POST /separate` — strip music before TikTok upload              |
| Pre-clip detection on long uploads         | `POST /silence-trim` — drop dead air upfront                     |
| HyperFrames "captions only" template       | `POST /captions` — lighter path when no title/lower-third needed |

## Deploy targets

CPU works for everything except WhisperX-large (slow). For GPU:

- **Modal** — `modal serve main.py` once you wrap each route in a Modal app
- **Replicate** — push as a cog; routes become endpoints
- **RunPod / Banana / Beam** — same pattern
- **Self-hosted GPU box** — `uvicorn` + Caddy/nginx in front

CPU-only deploy fine on Fly.io / Render / Cloud Run with 4 GB RAM.

## Cost-savings math (rough)

ElevenLabs Scribe: $0.40/hr of audio. WhisperX on a $0.50/hr Modal A10
GPU runs ~6× realtime → $0.083/hr of audio at large-v3. **5× cheaper**
above ~10 hours/day of throughput.
