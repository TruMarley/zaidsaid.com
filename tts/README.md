# tts

Open-source TTS sidecar — two engines for two distinct use cases:

| Engine             | Use                                                  | Latency (CPU)     |
| ------------------ | ---------------------------------------------------- | ----------------- |
| **piper** (rhasspy)| Default voices for narration, replaces EL cost line  | ~80 ms / sentence |
| **Coqui XTTS-v2**  | Voice cloning from a 6-30 sec reference clip         | ~3× realtime      |

## Routes

| Method | Path | Engine | What it does |
|--------|------|--------|--------------|
| GET | /voices | — | List bundled piper voices |
| POST | /synthesize | piper | text → wav (preset voice) |
| POST | /clone | Coqui XTTS-v2 | text + ref-audio → wav (cloned voice) |
| GET | /ping | — | Health + warm-model report |

## Run

```bash
cd tts
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8791
```

Voices download on first call:
- piper voice (~50 MB) cached at `~/.cache/piper/`
- XTTS-v2 weights (~1.5 GB) cached at `~/.local/share/tts/`

## Where it plugs in

- **Studio Voice stage** (`runVoice`) — currently routes to ElevenLabs or
  the browser's `SpeechSynthesis`. piper is a third option: free, local,
  no per-call cost. Wire as a new provider under the `voice` arch pick.
- **Voice cloning** for "narrate this in the host's own voice" — a
  capability ElevenLabs charges $22/mo for and gates behind voice-lab
  uploads. XTTS-v2 does it from a single ref clip with no account.

## Cost-savings math

ElevenLabs Multilingual v2: $0.30/1k chars (~150 chars/sec → ~$1.20/hr of
output). piper on commodity CPU: ~$0.00 (electricity). For Studio's
typical 60-second voiceover, $0.02 → $0.

## Front-end wiring

Tracked as x113b — add `tts` provider to PIPELINE_STAGES voice picks.
