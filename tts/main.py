"""
zaidsaid tts sidecar

Two open-source TTS engines behind one FastAPI:
  - piper (rhasspy) — fast ONNX-based, dozens of multilingual voices.
                     Replacement for ElevenLabs default voices (cost line).
  - Coqui XTTS-v2  — voice cloning from a 6-30 sec reference clip.
                     Unique capability — ElevenLabs cloning is paid +
                     gated; XTTS-v2 runs locally.

Routes:
  POST /synthesize   — piper: text → wav (no cloning)
  POST /clone        — Coqui XTTS-v2: text + reference audio → wav
                       (clones the reference voice)
  GET  /voices       — list bundled piper voices
  GET  /ping         — health + warm-model report
"""
from __future__ import annotations

import io
import os
import shutil
import tempfile
import time
import wave
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI(title="zaidsaid-tts", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("TTS_CORS_ORIGIN", "*")],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

_MODELS: dict[str, Any] = {}

# Default voice library — voices download lazily on first use via piper.
PIPER_VOICES = {
    "en-amy":   "en_US-amy-medium",
    "en-ryan":  "en_US-ryan-medium",
    "en-libby": "en_GB-jenny_dioco-medium",
    "en-alan":  "en_GB-alan-medium",
}


@app.get("/ping")
def ping() -> dict[str, Any]:
    return {"ok": True, "service": "zaidsaid-tts", "warm": sorted(_MODELS.keys())}


@app.get("/voices")
def voices() -> dict[str, Any]:
    return {"piper": PIPER_VOICES, "xtts": ["voice cloning — supply reference_audio in /clone"]}


@app.post("/synthesize")
async def synthesize(
    text: str = Form(...),
    voice: str = Form("en-amy"),
    speed: float = Form(1.0, ge=0.5, le=2.0),
) -> StreamingResponse:
    """
    piper TTS — text → audio/wav. Drop-in for ElevenLabs default voices
    when the speaker isn't a custom-cloned voice. Latency ~80ms / sentence
    on CPU after first call.
    """
    if voice not in PIPER_VOICES:
        raise HTTPException(400, f"unknown voice '{voice}'. Available: {list(PIPER_VOICES)}")
    wav_bytes = _piper_synthesize(text, voice_alias=voice, speed=speed)
    return StreamingResponse(io.BytesIO(wav_bytes), media_type="audio/wav")


@app.post("/clone")
async def clone(
    text: str = Form(...),
    reference_audio: UploadFile = File(..., description="6-30 sec WAV of the target voice"),
    language: str = Form("en"),
) -> StreamingResponse:
    """
    Coqui XTTS-v2 voice cloning. Uploads a 6-30 second reference clip of
    the target speaker; service synthesizes `text` in that voice.

    ~5x slower than piper; takes ~3s of compute per second of output on
    CPU, ~0.5s on GPU.
    """
    with _tmpdir() as tmp:
        ref = tmp / "ref.wav"
        with ref.open("wb") as f:
            while True:
                chunk = await reference_audio.read(1 << 20)
                if not chunk:
                    break
                f.write(chunk)
        out = tmp / "out.wav"
        _xtts_clone(text, ref_path=ref, out_path=out, language=language)
        wav_bytes = out.read_bytes()
    return StreamingResponse(io.BytesIO(wav_bytes), media_type="audio/wav")


# -----------------------------------------------------------------------------
# Lazy tool wrappers
# -----------------------------------------------------------------------------


def _piper_synthesize(text: str, *, voice_alias: str, speed: float) -> bytes:
    from piper import PiperVoice  # type: ignore[import-untyped]
    from piper.download import ensure_voice_exists, find_voice  # type: ignore[import-untyped]

    voice_id = PIPER_VOICES[voice_alias]
    cache_dir = Path(os.environ.get("PIPER_CACHE", str(Path.home() / ".cache" / "piper")))
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = f"piper:{voice_id}"
    if key not in _MODELS:
        ensure_voice_exists(voice_id, [str(cache_dir)], str(cache_dir), {"voices": {}})
        onnx_path, _config_path = find_voice(voice_id, [str(cache_dir)])
        _MODELS[key] = PiperVoice.load(str(onnx_path))
    voice = _MODELS[key]
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(voice.config.sample_rate)
        for audio_bytes in voice.synthesize_stream_raw(text, length_scale=1.0 / max(0.1, speed)):
            w.writeframes(audio_bytes)
    return buf.getvalue()


def _xtts_clone(text: str, *, ref_path: Path, out_path: Path, language: str) -> None:
    from TTS.api import TTS  # type: ignore[import-untyped]

    key = "xtts-v2"
    if key not in _MODELS:
        _MODELS[key] = TTS("tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=False)
    tts = _MODELS[key]
    tts.tts_to_file(
        text=text,
        speaker_wav=str(ref_path),
        language=language,
        file_path=str(out_path),
    )


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


class _tmpdir:
    def __enter__(self) -> Path:
        self._d = Path(tempfile.mkdtemp(prefix="tts-"))
        return self._d

    def __exit__(self, *_: Any) -> None:
        shutil.rmtree(self._d, ignore_errors=True)
