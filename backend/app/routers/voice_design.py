"""Voice Design API router."""

import base64
import io
import json
import logging
from typing import AsyncGenerator

import soundfile as sf
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse

from app.config import STREAM_REQUEST_TIMEOUT_S, STREAM_SEGMENT_CHARS
from app.models import VoiceDesignRequest
from app.services.tts_manager import tts_manager
from app.utils.inference import run_inference
from app.utils.text import split_text

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/voice-design")
async def generate_voice_design(request: VoiceDesignRequest):
    """
    Generate speech using Voice Design mode.
    
    Creates a new voice from a natural language description.
    Uses the 1.7B VoiceDesign model.
    """
    try:
        logger.info(f"Voice Design request: text={request.text[:50]}..., lang={request.language}")
        
        audio, sr = tts_manager.generate_voice_design(
            text=request.text,
            language=request.language,
            instruct=request.voice_description,
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
        
    except Exception as e:
        logger.exception("Voice Design generation failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/voice-design/stream")
async def stream_voice_design(payload: VoiceDesignRequest, request: Request):
    segments = split_text(payload.text, STREAM_SEGMENT_CHARS) or [payload.text]

    async def event_generator() -> AsyncGenerator[str, None]:
        total = len(segments)
        for index, segment in enumerate(segments):
            if await request.is_disconnected():
                break
            try:
                audio, sr = await run_inference(
                    tts_manager.generate_voice_design,
                    text=segment,
                    language=payload.language,
                    instruct=payload.voice_description,
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
