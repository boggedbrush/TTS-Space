"""
Qwen3-TTS Backend API Server

FastAPI application for text-to-speech synthesis using Qwen3-TTS models.
Supports three modes: Voice Design, Voice Clone, and Custom Voice.
"""

import os
import io
import logging
from contextlib import asynccontextmanager
from typing import Optional

import torch
import soundfile as sf
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse

from app.routers import voice_design, voice_clone, custom_voice, status
from app.services.tts_manager import tts_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown."""
    logger.info("Starting Qwen3-TTS API Server...")
    
    # Log device info
    if torch.cuda.is_available():
        device = torch.cuda.get_device_name(0)
        logger.info(f"CUDA available: {device}")
    elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        logger.info("Apple Silicon GPU (MPS) available")
    elif hasattr(torch, 'hip') and torch.hip.is_available():
        logger.info("ROCm (AMD GPU) available")
    else:
        logger.warning("No GPU detected, using CPU (will be slower)")
    
    yield
    
    # Cleanup on shutdown
    logger.info("Shutting down Qwen3-TTS API Server...")
    tts_manager.unload_all()


app = FastAPI(
    title="Qwen3-TTS API",
    description="Premium Text-to-Speech API with Voice Design, Voice Clone, and Custom Voice modes",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend - permissive for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Audio-Duration", "X-Sample-Rate"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors."""
    logger.exception(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    gpu_available = torch.cuda.is_available() or (hasattr(torch, 'hip') and torch.hip.is_available())
    return {
        "status": "healthy",
        "gpu_available": gpu_available,
        "loaded_models": list(tts_manager._models.keys()) if hasattr(tts_manager, '_models') else [],
    }


@app.get("/api/info")
async def api_info():
    """API information and capabilities."""
    return {
        "name": "Qwen3-TTS API",
        "version": "1.0.0",
        "modes": {
            "voice_design": {
                "description": "Create new voices from natural language descriptions",
                "model": "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
            },
            "voice_clone": {
                "description": "Clone voices from reference audio",
                "models": [
                    "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
                    "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
                ],
            },
            "custom_voice": {
                "description": "Use pre-trained premium speakers",
                "models": [
                    "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
                    "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
                ],
            },
        },
        "languages": [
            "Auto", "Chinese", "English", "Japanese", "Korean",
            "French", "German", "Spanish", "Portuguese", "Russian",
        ],
        "speakers": [
            "Aiden", "Dylan", "Eric", "Ono_anna", "Ryan",
            "Serena", "Sohee", "Uncle_fu", "Vivian",
        ],
    }


# Include routers
app.include_router(voice_design.router, prefix="/api", tags=["Voice Design"])
app.include_router(voice_clone.router, prefix="/api", tags=["Voice Clone"])
app.include_router(custom_voice.router, prefix="/api", tags=["Custom Voice"])
app.include_router(status.router, prefix="/api", tags=["Status"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
