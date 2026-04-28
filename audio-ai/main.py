"""
zaidsaid audio-ai sidecar

Open-source replacements / complements for the per-call audio AI vendors
zaidsaid currently leans on. Each route is independent; heavy ML deps are
lazy-imported inside the route so the service starts in a fraction of a
second and only pays the cold-start cost on the first request per tool.

Routes:
  POST /transcribe        — WhisperX or faster-whisper (word-level timings)
  POST /diarize           — pyannote-audio (speaker labels)
  POST /separate          — demucs (vocals/drums/bass/other stems)
  POST /vad               — silero-vad (speech-presence intervals)
  POST /silence-trim      — auto-editor (drop dead air, return cut list)
  POST /captions          — captacity (burn whisper captions onto a video)
  GET  /ping              — health + warm-model report

Run:
  uv sync
  uv run uvicorn main:app --host 0.0.0.0 --port 8789
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

app = FastAPI(title="zaidsaid-audio-ai", version="0.1.0")

# Permissive CORS — production traffic enters via the cloudflare-worker which
# owns origin policy. Pin via AUDIO_AI_CORS_ORIGIN env if running this
# directly in a browser dev loop.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("AUDIO_AI_CORS_ORIGIN", "*")],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# Lazy-loaded model cache. Each tool warms once and stays in memory.
_MODELS: dict[str, Any] = {}


@app.get("/ping")
def ping() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "zaidsaid-audio-ai",
        "warm": sorted(_MODELS.keys()),
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    engine: str = Form("faster-whisper"),
    model: str = Form("base"),
    language: str | None = Form(None),
    diarize: bool = Form(False),
    hf_token: str | None = Form(None),
) -> JSONResponse:
    """
    Word-level transcription. Drop-in for ElevenLabs Scribe — output shape:
      { text, segments: [{t, d, text}], words: [{text, start, end, speaker?}] }

    engine="faster-whisper"  → CPU/GPU efficient, no diarization
    engine="whisperx"        → faster-whisper + alignment + diarization (needs hf_token)
    """
    with _tmpdir() as tmp:
        in_path = await _stash_upload(file, tmp, "in.wav")
        t0 = time.time()
        if engine == "faster-whisper":
            data = _faster_whisper(in_path, model=model, language=language)
        elif engine == "whisperx":
            data = _whisperx(in_path, model=model, language=language, diarize=diarize, hf_token=hf_token)
        else:
            raise HTTPException(400, f"unknown engine '{engine}'")
        data["elapsed_sec"] = round(time.time() - t0, 3)
        return JSONResponse(data)


@app.post("/diarize")
async def diarize(
    file: UploadFile = File(...),
    hf_token: str | None = Form(None),
) -> JSONResponse:
    """
    Speaker diarization via pyannote-audio. Output:
      { turns: [{start, end, speaker}], num_speakers }

    Requires a HuggingFace token with access to pyannote/speaker-diarization-3.1.
    """
    with _tmpdir() as tmp:
        in_path = await _stash_upload(file, tmp, "in.wav")
        t0 = time.time()
        turns, n = _pyannote(in_path, hf_token=hf_token)
        return JSONResponse({"turns": turns, "num_speakers": n, "elapsed_sec": round(time.time() - t0, 3)})


@app.post("/separate")
async def separate(
    file: UploadFile = File(...),
    stems: str = Form("vocals"),
    model: str = Form("htdemucs"),
) -> FileResponse:
    """
    demucs source separation. Returns the requested stem as audio/wav.

    stems="vocals"  → speech-only track for clean ASR / cleaner clipping
    stems="other"   → music + sfx without vocals (keep music, lose dialog)
    stems="drums" | "bass" | "all"
    """
    with _tmpdir() as tmp:
        in_path = await _stash_upload(file, tmp, "in.wav")
        out_path = _demucs(in_path, stems=stems, model=model, work_dir=tmp)
        return FileResponse(out_path, media_type="audio/wav", filename=f"{stems}.wav")


@app.post("/vad")
async def vad(
    file: UploadFile = File(...),
    threshold: float = Form(0.5),
    min_silence_ms: int = Form(300),
) -> JSONResponse:
    """
    silero-vad — voice-activity intervals. Output:
      { intervals: [{start, end}], duration_sec }

    Use the intervals to snap clip boundaries to actual speech presence —
    fixes the mid-sentence-cut family of bugs without depending on punctuation.
    """
    with _tmpdir() as tmp:
        in_path = await _stash_upload(file, tmp, "in.wav")
        intervals, dur = _silero_vad(in_path, threshold=threshold, min_silence_ms=min_silence_ms)
        return JSONResponse({"intervals": intervals, "duration_sec": dur})


@app.post("/silence-trim")
async def silence_trim(
    file: UploadFile = File(...),
    threshold: float = Form(0.04),
    margin_ms: int = Form(150),
) -> JSONResponse:
    """
    auto-editor — return the cut list (keep ranges) without rendering.
    Pre-pass on long uploads to drop dead air before clip-detection runs.
      { keeps: [{start, end}], original_duration_sec, kept_duration_sec }
    """
    with _tmpdir() as tmp:
        in_path = await _stash_upload(file, tmp, "in.mp4")
        keeps, orig, kept = _auto_editor_keeps(in_path, threshold=threshold, margin_ms=margin_ms, work_dir=tmp)
        return JSONResponse({"keeps": keeps, "original_duration_sec": orig, "kept_duration_sec": kept})


@app.post("/captions")
async def captions(
    file: UploadFile = File(...),
    model: str = Form("base"),
    style: str = Form("default"),
) -> FileResponse:
    """
    Burn whisper-aligned captions directly onto a video. Use this when you
    want legible captions without the full HyperFrames composition (no
    title, no lower-third, no overlay design — just bottom-third subtitles).
    """
    with _tmpdir() as tmp:
        in_path = await _stash_upload(file, tmp, "in.mp4")
        out_path = _captacity(in_path, model=model, style=style, work_dir=tmp)
        return FileResponse(out_path, media_type="video/mp4", filename="captioned.mp4")


# -----------------------------------------------------------------------------
# Lazy-imported tool wrappers — each loads its model on first call.
# -----------------------------------------------------------------------------


def _faster_whisper(path: Path, *, model: str, language: str | None) -> dict[str, Any]:
    from faster_whisper import WhisperModel  # type: ignore[import-untyped]

    key = f"faster_whisper:{model}"
    if key not in _MODELS:
        _MODELS[key] = WhisperModel(model, device="auto", compute_type="auto")
    m = _MODELS[key]
    segments, info = m.transcribe(str(path), language=language, word_timestamps=True)
    out_segments: list[dict[str, Any]] = []
    out_words: list[dict[str, Any]] = []
    text_parts: list[str] = []
    for seg in segments:
        out_segments.append({"t": round(seg.start, 3), "d": round(seg.end - seg.start, 3), "text": seg.text.strip()})
        text_parts.append(seg.text.strip())
        for w in seg.words or []:
            out_words.append({"text": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)})
    return {"text": " ".join(text_parts).strip(), "segments": out_segments, "words": out_words, "language": info.language}


def _whisperx(path: Path, *, model: str, language: str | None, diarize: bool, hf_token: str | None) -> dict[str, Any]:
    import whisperx  # type: ignore[import-untyped]

    key = f"whisperx:{model}"
    if key not in _MODELS:
        _MODELS[key] = whisperx.load_model(model, device="auto", compute_type="auto")
    m = _MODELS[key]
    audio = whisperx.load_audio(str(path))
    result = m.transcribe(audio, language=language)
    align_model, align_meta = whisperx.load_align_model(language_code=result["language"], device="auto")
    aligned = whisperx.align(result["segments"], align_model, align_meta, audio, device="auto")
    if diarize:
        if not hf_token:
            raise HTTPException(400, "diarize=true requires hf_token (HuggingFace pyannote access)")
        diar_pipe = whisperx.DiarizationPipeline(use_auth_token=hf_token, device="auto")
        diar = diar_pipe(audio)
        aligned = whisperx.assign_word_speakers(diar, aligned)
    out_words = [
        {"text": w["word"], "start": round(w["start"], 3), "end": round(w["end"], 3), **({"speaker": w["speaker"]} if "speaker" in w else {})}
        for seg in aligned["segments"] for w in seg.get("words", [])
        if w.get("start") is not None and w.get("end") is not None
    ]
    out_segments = [{"t": round(s["start"], 3), "d": round(s["end"] - s["start"], 3), "text": s["text"].strip()} for s in aligned["segments"]]
    return {"text": " ".join(s["text"].strip() for s in aligned["segments"]).strip(), "segments": out_segments, "words": out_words, "language": result["language"]}


def _pyannote(path: Path, *, hf_token: str | None) -> tuple[list[dict[str, Any]], int]:
    if not hf_token:
        raise HTTPException(400, "pyannote requires hf_token (HuggingFace access to pyannote/speaker-diarization-3.1)")
    from pyannote.audio import Pipeline  # type: ignore[import-untyped]

    key = "pyannote:diarization-3.1"
    if key not in _MODELS:
        _MODELS[key] = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=hf_token)
    pipe = _MODELS[key]
    diar = pipe(str(path))
    turns: list[dict[str, Any]] = []
    speakers: set[str] = set()
    for segment, _, label in diar.itertracks(yield_label=True):
        turns.append({"start": round(segment.start, 3), "end": round(segment.end, 3), "speaker": label})
        speakers.add(label)
    return turns, len(speakers)


def _demucs(path: Path, *, stems: str, model: str, work_dir: Path) -> Path:
    import torch  # type: ignore[import-untyped]
    from demucs.apply import apply_model  # type: ignore[import-untyped]
    from demucs.audio import save_audio  # type: ignore[import-untyped]
    from demucs.pretrained import get_model  # type: ignore[import-untyped]
    from demucs.separate import load_track  # type: ignore[import-untyped]

    key = f"demucs:{model}"
    if key not in _MODELS:
        _MODELS[key] = get_model(model)
    m = _MODELS[key]
    m.cpu().eval()
    wav = load_track(str(path), m.audio_channels, m.samplerate)
    ref = wav.mean(0)
    wav = (wav - ref.mean()) / ref.std()
    sources = apply_model(m, wav[None], split=True, overlap=0.25, progress=False)[0]
    sources = sources * ref.std() + ref.mean()
    if stems == "all":
        out = work_dir / "all.wav"
        save_audio(sources.sum(0), str(out), samplerate=m.samplerate)
        return out
    if stems not in m.sources:
        raise HTTPException(400, f"unknown stem '{stems}', model has {list(m.sources)}")
    idx = m.sources.index(stems)
    out = work_dir / f"{stems}.wav"
    save_audio(sources[idx], str(out), samplerate=m.samplerate)
    return out


def _silero_vad(path: Path, *, threshold: float, min_silence_ms: int) -> tuple[list[dict[str, float]], float]:
    from silero_vad import get_speech_timestamps, load_silero_vad, read_audio  # type: ignore[import-untyped]

    if "silero_vad" not in _MODELS:
        _MODELS["silero_vad"] = load_silero_vad()
    model = _MODELS["silero_vad"]
    audio = read_audio(str(path), sampling_rate=16000)
    ts = get_speech_timestamps(audio, model, threshold=threshold, min_silence_duration_ms=min_silence_ms, sampling_rate=16000)
    intervals = [{"start": round(t["start"] / 16000, 3), "end": round(t["end"] / 16000, 3)} for t in ts]
    duration = round(len(audio) / 16000, 3)
    return intervals, duration


def _auto_editor_keeps(path: Path, *, threshold: float, margin_ms: int, work_dir: Path) -> tuple[list[dict[str, float]], float, float]:
    """auto-editor analysis-only: produce the keep list without rendering."""
    import subprocess

    out_json = work_dir / "ae.json"
    cmd = [
        "auto-editor", str(path),
        "--export", "json",
        "--edit", f"audio:threshold={threshold}",
        "--margin", f"{margin_ms}ms",
        "-o", str(out_json),
        "--no-open",
        "--quiet",
    ]
    subprocess.run(cmd, check=True, cwd=str(work_dir))
    data = json.loads(out_json.read_text())
    timeline = data.get("v1", {}).get("chunks") or data.get("chunks") or []
    keeps: list[dict[str, float]] = []
    fps = float(data.get("source", {}).get("fps") or data.get("fps") or 30.0)
    orig = 0.0
    kept = 0.0
    for chunk in timeline:
        start_f, end_f, speed = chunk
        start = start_f / fps
        end = end_f / fps
        orig = max(orig, end)
        if speed and float(speed) <= 1.0001 and float(speed) >= 0.9999:
            keeps.append({"start": round(start, 3), "end": round(end, 3)})
            kept += end - start
    return keeps, round(orig, 3), round(kept, 3)


def _captacity(path: Path, *, model: str, style: str, work_dir: Path) -> Path:
    import captacity  # type: ignore[import-untyped]

    out = work_dir / "captioned.mp4"
    captacity.add_captions(
        video_file=str(path),
        output_file=str(out),
        model_size=model,
        font="Helvetica",
        font_size=80 if style == "default" else 110,
        font_color="white",
        stroke_color="black",
        stroke_width=3,
    )
    return out


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


class _tmpdir:
    """Context manager for a per-request temp directory."""

    def __enter__(self) -> Path:
        self._d = Path(tempfile.mkdtemp(prefix="audio-ai-"))
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
