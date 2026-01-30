"""
TTS Model Manager

Singleton class to manage Qwen3-TTS model loading and inference.
Supports lazy loading and caching of models to minimize memory usage.
"""

import logging
import threading
from typing import Dict, Optional, Tuple, Union
from pathlib import Path

import torch
import numpy as np

logger = logging.getLogger(__name__)

# Model IDs
MODEL_IDS = {
    "voice_design": "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    "base_0.6B": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
    "base_1.7B": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    "custom_0.6B": "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
    "custom_1.7B": "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
}


class TTSManager:
    """Singleton manager for Qwen3-TTS models."""

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

        self._models: Dict[str, object] = {}
        self._model_lock = threading.Lock()
        self._device = self._detect_device()
        self._dtype = torch.bfloat16 if self._device != "cpu" else torch.float32
        self._initialized = True

        logger.info(f"TTS Manager initialized. Device: {self._device}, Dtype: {self._dtype}")

    def _detect_device(self) -> str:
        """Detect the best available compute device."""
        if torch.cuda.is_available():
            return "cuda:0"
        
        # Check for Apple Silicon (MPS)
        if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            return "mps"
            
        # Check for ROCm (AMD GPU)
        try:
            if hasattr(torch.version, 'hip') and torch.version.hip is not None:
                return "cuda:0"  # ROCm uses cuda device naming
        except Exception:
            pass
        return "cpu"

    def _get_model(self, model_key: str):
        """Get or load a model by key."""
        if model_key not in MODEL_IDS:
            raise ValueError(f"Unknown model key: {model_key}")

        with self._model_lock:
            if model_key not in self._models:
                model_id = MODEL_IDS[model_key]
                logger.info(f"Loading model: {model_id}")

                try:
                    from qwen_tts import Qwen3TTSModel

                    # Determine attention implementation
                    attn_impl = None
                    if self._device != "cpu":
                        try:
                            import flash_attn
                            attn_impl = "flash_attention_2"
                        except ImportError:
                            attn_impl = "sdpa"  # Fallback to scaled dot product attention

                    model = Qwen3TTSModel.from_pretrained(
                        model_id,
                        device_map=self._device,
                        torch_dtype=self._dtype,
                        attn_implementation=attn_impl,
                    )
                    self._models[model_key] = model
                    logger.info(f"Model loaded: {model_id}")

                except Exception as e:
                    logger.error(f"Failed to load model {model_id}: {e}")
                    raise

            return self._models[model_key]

    def generate_voice_design(
        self,
        text: str,
        language: str = "Auto",
        instruct: str = "",
    ) -> Tuple[np.ndarray, int]:
        """
        Generate speech using the Voice Design model.

        Args:
            text: Text to synthesize
            language: Target language
            instruct: Voice description/design instruction

        Returns:
            Tuple of (audio_array, sample_rate)
        """
        model = self._get_model("voice_design")
        wavs, sr = model.generate_voice_design(
            text=text,
            language=language if language != "Auto" else "Auto",
            instruct=instruct,
        )
        return wavs[0], sr

    def generate_voice_clone(
        self,
        text: str,
        language: str = "Auto",
        ref_audio: Union[str, Tuple[np.ndarray, int]] = None,
        ref_text: Optional[str] = None,
        x_vector_only: bool = False,
        model_size: str = "1.7B",
    ) -> Tuple[np.ndarray, int]:
        """
        Generate speech by cloning a reference voice.

        Args:
            text: Text to synthesize
            language: Target language
            ref_audio: Reference audio (path, URL, or (array, sr) tuple)
            ref_text: Transcript of reference audio
            x_vector_only: Use only speaker embedding (no transcript needed)
            model_size: "0.6B" or "1.7B"

        Returns:
            Tuple of (audio_array, sample_rate)
        """
        model_key = f"base_{model_size}"
        model = self._get_model(model_key)

        wavs, sr = model.generate_voice_clone(
            text=text,
            language=language if language != "Auto" else "Auto",
            ref_audio=ref_audio,
            ref_text=ref_text if not x_vector_only else None,
            x_vector_only_mode=x_vector_only,
        )
        return wavs[0], sr

    def generate_custom_voice(
        self,
        text: str,
        language: str = "Auto",
        speaker: str = "Vivian",
        instruct: Optional[str] = None,
        model_size: str = "1.7B",
    ) -> Tuple[np.ndarray, int]:
        """
        Generate speech using a pre-trained custom voice.

        Args:
            text: Text to synthesize
            language: Target language
            speaker: Speaker name
            instruct: Optional style instruction
            model_size: "0.6B" or "1.7B"

        Returns:
            Tuple of (audio_array, sample_rate)
        """
        model_key = f"custom_{model_size}"
        model = self._get_model(model_key)

        kwargs = {
            "text": text,
            "language": language if language != "Auto" else "Auto",
            "speaker": speaker,
        }
        if instruct:
            kwargs["instruct"] = instruct

        wavs, sr = model.generate_custom_voice(**kwargs)
        return wavs[0], sr

    def unload_model(self, model_key: str):
        """Unload a specific model to free memory."""
        with self._model_lock:
            if model_key in self._models:
                del self._models[model_key]
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                elif hasattr(torch, 'mps') and torch.mps.is_available():
                    torch.mps.empty_cache()
                logger.info(f"Unloaded model: {model_key}")

    def unload_all(self):
        """Unload all models."""
        with self._model_lock:
            self._models.clear()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            elif hasattr(torch, 'mps') and torch.mps.is_available():
                torch.mps.empty_cache()
            logger.info("Unloaded all models")


# Global singleton instance
tts_manager = TTSManager()
