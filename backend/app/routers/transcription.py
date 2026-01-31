"""Transcription API router."""

import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from app.services.transcription_manager import transcription_manager
from app.utils.audio import load_audio_with_fallback

logger = logging.getLogger(__name__)

router = APIRouter()


class TranscriptionResponse(BaseModel):
    """Response model for transcription endpoint."""
    text: str


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(default=None),
):
    """
    Transcribe an audio file to text using Whisper.
    
    Args:
        audio: Audio file to transcribe
        language: Optional language hint (e.g., 'English', 'Chinese', or ISO code like 'en')
    
    Returns:
        TranscriptionResponse with transcribed text
    """
    try:
        logger.info(f"Transcription request: filename={audio.filename}, language={language}")
        
        # Read audio data
        audio_data = await audio.read()
        
        # Save to temp file and read with soundfile
        suffix = Path(audio.filename or "").suffix or ".tmp"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name
        
        try:
            import torchaudio
            import torch

            # Load audio with soundfile; fallback to ffmpeg for formats like m4a.
            audio_array, sample_rate = load_audio_with_fallback(tmp_path)
            
            # Convert to torch tensor for resampling
            tensor = torch.from_numpy(audio_array).float()
            
            # Handle shapes: sf.read gives (time, channels) or (time,), torchaudio wants (channels, time)
            if len(tensor.shape) == 1:
                tensor = tensor.unsqueeze(0)  # (time,) -> (1, time)
            else:
                tensor = tensor.permute(1, 0)  # (time, channels) -> (channels, time)
            
            # Resample to 16kHz if needed (Whisper expects 16kHz)
            if sample_rate != 16000:
                resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
                tensor = resampler(tensor)
                sample_rate = 16000
            
            # Convert to mono if stereo check shape (channels, time)
            if tensor.shape[0] > 1:
                tensor = torch.mean(tensor, dim=0, keepdim=True)
            
            # Convert to numpy array (1D)
            audio_array = tensor.squeeze().numpy().astype(np.float32, copy=False)
            if audio_array.size == 0:
                raise ValueError("Empty audio buffer")

            # Clean up any non-finite values and normalize if needed
            if not np.isfinite(audio_array).all():
                audio_array = np.nan_to_num(audio_array)
            peak = float(np.max(np.abs(audio_array)))
            rms = float(np.sqrt(np.mean(np.square(audio_array))))
            if peak > 1.0:
                audio_array = audio_array / peak
                peak = float(np.max(np.abs(audio_array)))
                rms = float(np.sqrt(np.mean(np.square(audio_array))))

            # Auto-gain if the signal is very quiet
            if rms > 0 and rms < 0.01:
                target_rms = 0.05
                gain = min(target_rms / rms, 10.0)
                audio_array = np.clip(audio_array * gain, -1.0, 1.0)
                peak = float(np.max(np.abs(audio_array)))
                rms = float(np.sqrt(np.mean(np.square(audio_array))))

            duration = audio_array.shape[0] / sample_rate
            logger.info(
                "Transcription audio stats: duration=%.2fs, sample_rate=%d, peak=%.4f, rms=%.4f",
                duration,
                sample_rate,
                peak,
                rms,
            )
            
            # Transcribe
            text = transcription_manager.transcribe(
                audio=audio_array,
                sample_rate=sample_rate,
                language=language,
            )
            
            return TranscriptionResponse(text=text)
            
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            
    except Exception as e:
        logger.exception("Transcription failed")
        raise HTTPException(status_code=500, detail=str(e))
