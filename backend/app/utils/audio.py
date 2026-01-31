"""Audio decoding helpers with ffmpeg fallback."""

import logging
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)


def _convert_to_wav(input_path: str) -> str:
    """Convert arbitrary audio file to WAV using ffmpeg."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_wav:
        wav_path = tmp_wav.name
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                input_path,
                "-acodec",
                "pcm_s16le",
                wav_path,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            check=True,
        )
    except FileNotFoundError as exc:
        try:
            os.unlink(wav_path)
        except OSError:
            pass
        raise RuntimeError("ffmpeg is required to decode this audio format") from exc
    except subprocess.CalledProcessError as exc:
        try:
            os.unlink(wav_path)
        except OSError:
            pass
        stderr = exc.stderr.decode("utf-8", errors="ignore").strip()
        detail = stderr.splitlines()[-1] if stderr else "Unknown error"
        raise RuntimeError(f"ffmpeg failed to decode audio: {detail}") from exc
    return wav_path


def load_audio_with_fallback(input_path: str) -> tuple[np.ndarray, int]:
    """Load audio with soundfile, falling back to ffmpeg decode if needed."""
    try:
        return sf.read(input_path)
    except sf.LibsndfileError:
        logger.info("soundfile failed to read audio; attempting ffmpeg decode: %s", input_path)
        wav_path = _convert_to_wav(input_path)
        try:
            return sf.read(wav_path)
        finally:
            try:
                os.unlink(wav_path)
            except OSError:
                pass
