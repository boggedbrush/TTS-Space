"""Voice Clone API router."""

import base64
import io
import json
import logging
import tempfile
from pathlib import Path
from typing import AsyncGenerator, Optional

import numpy as np
import soundfile as sf
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import Response, StreamingResponse

from app.config import STREAM_REQUEST_TIMEOUT_S, STREAM_SEGMENT_CHARS
from app.services.tts_manager import tts_manager
from app.utils.audio import load_audio_with_fallback
from app.utils.inference import run_inference
from app.utils.text import split_text

logger = logging.getLogger(__name__)

router = APIRouter()


def _prepare_reference_audio(ref_audio: UploadFile) -> tuple[np.ndarray, int]:
    audio_data = ref_audio.file.read()

    suffix = Path(ref_audio.filename or "").suffix or ".tmp"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_data)
        tmp_path = tmp.name

    try:
        ref_audio_array, ref_sr = load_audio_with_fallback(tmp_path)

        if len(ref_audio_array.shape) > 1:
            ref_audio_array = np.mean(ref_audio_array, axis=1)

        ref_audio_array = ref_audio_array.astype(np.float32, copy=False)
        if ref_audio_array.size == 0:
            raise ValueError("Empty reference audio buffer")
        if not np.isfinite(ref_audio_array).all():
            ref_audio_array = np.nan_to_num(ref_audio_array)

        target_sr = 24000
        if ref_sr != target_sr:
            import torch
            import torchaudio

            tensor = torch.from_numpy(ref_audio_array).float().unsqueeze(0)
            resampler = torchaudio.transforms.Resample(orig_freq=ref_sr, new_freq=target_sr)
            tensor = resampler(tensor)
            ref_audio_array = tensor.squeeze(0).numpy().astype(np.float32, copy=False)
            ref_sr = target_sr

        peak = float(np.max(np.abs(ref_audio_array)))
        if peak > 1.0:
            ref_audio_array = ref_audio_array / peak

        ref_audio_array = np.clip(ref_audio_array, -1.0, 1.0)
        return ref_audio_array, ref_sr
    finally:
        import os
        os.unlink(tmp_path)


@router.post("/voice-clone")
async def generate_voice_clone(
    text: str = Form(...),
    language: str = Form(default="Auto"),
    model_size: str = Form(default="1.7B"),
    ref_text: Optional[str] = Form(default=None),
    x_vector_only: str = Form(default="false"),
    ref_audio: UploadFile = File(...),
):
    """
    Generate speech by cloning a reference voice.
    
    Accepts a reference audio file and optionally its transcript.
    X-Vector Only mode uses just the speaker embedding.
    """
    try:
        logger.info(
            f"Voice Clone request: text={text[:50]}..., lang={language}, "
            f"model={model_size}, x_vector_only={x_vector_only}"
        )
        
        # Parse boolean
        x_vector_only_bool = x_vector_only.lower() in ("true", "1", "yes")
        
        # Validate model size
        if model_size not in ("0.6B", "1.7B"):
            raise HTTPException(status_code=400, detail="Invalid model size")
        
        # Validate ref_text if not x_vector_only
        if not x_vector_only_bool and not ref_text:
            raise HTTPException(
                status_code=400,
                detail="Reference text is required unless x_vector_only is enabled"
            )
        
        ref_audio_array, ref_sr = _prepare_reference_audio(ref_audio)

        audio, sr = tts_manager.generate_voice_clone(
            text=text,
            language=language,
            ref_audio=(ref_audio_array, ref_sr),
            ref_text=ref_text,
            x_vector_only=x_vector_only_bool,
            model_size=model_size,
        )
        
        # Convert to WAV bytes
        buffer = io.BytesIO()
        sf.write(buffer, audio, sr, format="WAV")
        buffer.seek(0)
        
        duration = len(audio) / sr
        
        return Response(
            content=buffer.read(),
            media_type="audio/wav",
            headers={
                "X-Audio-Duration": str(duration),
                "X-Sample-Rate": str(sr),
            },
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Voice Clone generation failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/voice-clone/stream")
async def stream_voice_clone(
    request: Request,
    text: str = Form(...),
    language: str = Form(default="Auto"),
    model_size: str = Form(default="1.7B"),
    ref_text: Optional[str] = Form(default=None),
    x_vector_only: str = Form(default="false"),
    ref_audio: UploadFile = File(...),
):
    if model_size not in ("0.6B", "1.7B"):
        raise HTTPException(status_code=400, detail="Invalid model size")
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    x_vector_only_bool = x_vector_only.lower() in ("true", "1", "yes")
    if not x_vector_only_bool and not ref_text:
        raise HTTPException(
            status_code=400,
            detail="Reference text is required unless x_vector_only is enabled",
        )

    ref_audio_array, ref_sr = _prepare_reference_audio(ref_audio)
    segments = split_text(text, STREAM_SEGMENT_CHARS) or [text]

    async def event_generator() -> AsyncGenerator[str, None]:
        total = len(segments)
        for index, segment in enumerate(segments):
            if await request.is_disconnected():
                break
            try:
                audio, sr = await run_inference(
                    tts_manager.generate_voice_clone,
                    text=segment,
                    language=language,
                    ref_audio=(ref_audio_array, ref_sr),
                    ref_text=ref_text,
                    x_vector_only=x_vector_only_bool,
                    model_size=model_size,
                    timeout=STREAM_REQUEST_TIMEOUT_S,
                )
                buffer = io.BytesIO()
                sf.write(buffer, audio, sr, format="WAV")
                payload_json = json.dumps({
                    "index": index,
                    "total": total,
                    "audio": base64.b64encode(buffer.getvalue()).decode("ascii"),
                })
                yield f"data: {payload_json}\n\n"
            except Exception as exc:
                payload_json = json.dumps({
                    "index": index,
                    "total": total,
                    "error": f"Generation failed: {exc}",
                })
                yield f"data: {payload_json}\n\n"
                break

    return StreamingResponse(event_generator(), media_type="text/event-stream")
