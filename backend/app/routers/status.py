"""
Status Router

SSE (Server-Sent Events) endpoint for streaming status updates to the frontend.
"""

import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.status_manager import status_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status/stream")
async def status_stream():
    """
    Server-Sent Events endpoint for real-time status updates.
    
    Returns a stream of status events including:
    - Model loading progress
    - Warnings and errors
    - Task completion notifications
    """
    return StreamingResponse(
        status_manager.stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/status/test")
async def status_test():
    """Test endpoint to trigger a status message."""
    await status_manager.broadcast("Test status message", status_manager._current_status.type if status_manager._current_status else status_manager._current_status)
    return {"status": "ok", "message": "Test status sent"}
