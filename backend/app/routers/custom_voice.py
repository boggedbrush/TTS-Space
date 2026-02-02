"""Custom Voice API router."""

import base64
import io
import json
import logging
from typing import AsyncGenerator

import soundfile as sf
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse

from app.config import STREAM_REQUEST_TIMEOUT_S, STREAM_SEGMENT_CHARS
from app.models import CustomVoiceRequest
from app.services.tts_manager import tts_manager
from app.utils.inference import run_inference
from app.utils.text import split_text

logger = logging.getLogger(__name__)

router = APIRouter()

# Valid speakers
VALID_SPEAKERS = {
    "Aiden", "Dylan", "Eric", "Ono_anna", "Ryan",
    "Serena", "Sohee", "Uncle_fu", "Vivian"
}


@router.post("/custom-voice")
async def generate_custom_voice(request: CustomVoiceRequest):
    """
    Generate speech using a pre-trained custom voice.
    
    Supports 9 speakers with optional style instructions.
    """
    try:
        logger.info(
            f"Custom Voice request: text={request.text[:50]}..., "
            f"speaker={request.speaker}, lang={request.language}, model={request.model_size}"
        )
        
        # Validate speaker
        if request.speaker not in VALID_SPEAKERS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid speaker. Must be one of: {', '.join(sorted(VALID_SPEAKERS))}"
            )
        
        # Validate model size
        if request.model_size not in ("0.6B", "1.7B"):
            raise HTTPException(status_code=400, detail="Invalid model size")
        
        audio, sr = tts_manager.generate_custom_voice(
            text=request.text,
            language=request.language,
            speaker=request.speaker,
            instruct=request.instruct,
            model_size=request.model_size,
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
        logger.exception("Custom Voice generation failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/custom-voice/stream")
async def stream_custom_voice(payload: CustomVoiceRequest, request: Request):
    if payload.speaker not in VALID_SPEAKERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid speaker. Must be one of: {', '.join(sorted(VALID_SPEAKERS))}",
        )
    if payload.model_size not in ("0.6B", "1.7B"):
        raise HTTPException(status_code=400, detail="Invalid model size")

    segments = split_text(payload.text, STREAM_SEGMENT_CHARS) or [payload.text]

    async def event_generator() -> AsyncGenerator[str, None]:
        total = len(segments)
        for index, segment in enumerate(segments):
            if await request.is_disconnected():
                break
            try:
                audio, sr = await run_inference(
                    tts_manager.generate_custom_voice,
                    text=segment,
                    language=payload.language,
                    speaker=payload.speaker,
                    instruct=payload.instruct,
                    model_size=payload.model_size,
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
