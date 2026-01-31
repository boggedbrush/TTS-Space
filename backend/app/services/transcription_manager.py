"""
Transcription Service Manager

Singleton class to manage Whisper model for automatic speech recognition.
Supports lazy loading and GPU acceleration.
"""

import logging
import threading
import tempfile
from typing import Optional

import torch
import numpy as np

logger = logging.getLogger(__name__)


class TranscriptionManager:
    """Singleton manager for Whisper transcription model."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._pipeline = None
        self._model_lock = threading.Lock()
        self._device = self._detect_device()
        self._initialized = True

        logger.info(f"Transcription Manager initialized. Device: {self._device}")

    def _detect_device(self) -> str:
        """Detect the best available compute device."""
        if torch.cuda.is_available():
            return "cuda:0"
        
        # Check for Apple Silicon (MPS)
        if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            return "mps"
            
        return "cpu"

    def _get_pipeline(self):
        """Get or load the Whisper pipeline."""
        from app.services.status_manager import status_manager
        
        with self._model_lock:
            if self._pipeline is None:
                logger.info("Loading Whisper model for transcription...")
                status_manager.info("Loading transcription model...")

                try:
                    from transformers import pipeline

                    # Use whisper-base for good balance of speed and accuracy
                    self._pipeline = pipeline(
                        "automatic-speech-recognition",
                        model="openai/whisper-base",
                        device=self._device,
                        torch_dtype=torch.float16 if self._device != "cpu" else torch.float32,
                    )
                    
                    logger.info("Whisper model loaded successfully")
                    status_manager.success("Transcription model loaded")

                except Exception as e:
                    logger.error(f"Failed to load Whisper model: {e}")
                    status_manager.error(f"Failed to load transcription model: {e}")
                    raise

            return self._pipeline

    def transcribe(
        self,
        audio: np.ndarray,
        sample_rate: int,
        language: Optional[str] = None,
    ) -> str:
        """
        Transcribe audio to text.

        Args:
            audio: Audio data as numpy array
            sample_rate: Sample rate of the audio
            language: Optional language hint (ISO 639-1 code, e.g., 'en', 'zh')

        Returns:
            Transcribed text
        """
        from app.services.status_manager import status_manager
        
        pipe = self._get_pipeline()
        
        status_manager.info("Transcribing audio...")
        
        try:
            # Prepare audio input
            audio_input = {"array": audio, "sampling_rate": sample_rate}
            
            # Build generation kwargs
            generate_kwargs = {
                "return_timestamps": True
            }
            if language:
                # Map common language names to codes
                lang_map = {
                    "English": "en",
                    "Chinese": "zh",
                    "Japanese": "ja",
                    "Korean": "ko",
                    "German": "de",
                    "French": "fr",
                    "Russian": "ru",
                    "Portuguese": "pt",
                    "Spanish": "es",
                    "Italian": "it",
                }
                lang_code = lang_map.get(language, language.lower()[:2] if len(language) >= 2 else None)
                if lang_code:
                    generate_kwargs["language"] = lang_code
            
            result = pipe(audio_input, generate_kwargs=generate_kwargs)
            text = result["text"].strip()
            
            logger.info(f"Transcription complete: {len(text)} characters")
            status_manager.success("Transcription complete")
            
            return text
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            status_manager.error(f"Transcription failed: {e}")
            raise

    def unload(self):
        """Unload the model to free memory."""
        with self._model_lock:
            if self._pipeline is not None:
                del self._pipeline
                self._pipeline = None
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                elif hasattr(torch, 'mps') and torch.mps.is_available():
                    torch.mps.empty_cache()
                logger.info("Transcription model unloaded")


# Global singleton instance
transcription_manager = TranscriptionManager()
