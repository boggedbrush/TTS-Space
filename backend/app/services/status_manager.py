"""
Status Manager

Singleton service for managing real-time status updates using Server-Sent Events (SSE).
Broadcasts status messages to all connected clients.
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from enum import Enum
from typing import AsyncGenerator, Set
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class StatusType(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    PROGRESS = "progress"
    SUCCESS = "success"


@dataclass
class StatusMessage:
    """A status message to be broadcast to clients."""
    message: str
    type: StatusType
    timestamp: float
    progress: float | None = None  # 0-100 for progress type
    
    def to_sse(self) -> str:
        """Format as SSE event data."""
        import json
        data = {
            "message": self.message,
            "type": self.type.value,
            "timestamp": self.timestamp,
        }
        if self.progress is not None:
            data["progress"] = self.progress
        return f"data: {json.dumps(data)}\n\n"


class StatusManager:
    """Singleton manager for broadcasting status updates via SSE."""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._queues: Set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()
        self._current_status: StatusMessage | None = None
        self._initialized = True
        logger.info("Status Manager initialized")
    
    async def broadcast(
        self,
        message: str,
        status_type: StatusType = StatusType.INFO,
        progress: float | None = None,
    ):
        """Broadcast a status message to all connected clients."""
        status = StatusMessage(
            message=message,
            type=status_type,
            timestamp=time.time(),
            progress=progress,
        )
        self._current_status = status
        
        async with self._lock:
            dead_queues = set()
            for queue in self._queues:
                try:
                    await queue.put(status)
                except Exception:
                    dead_queues.add(queue)
            
            # Remove dead queues
            self._queues -= dead_queues
        
        logger.debug(f"Broadcast status: [{status_type.value}] {message}")
    
    def broadcast_sync(
        self,
        message: str,
        status_type: StatusType = StatusType.INFO,
        progress: float | None = None,
    ):
        """Synchronous broadcast for use in non-async contexts."""
        try:
            loop = asyncio.get_running_loop()
            asyncio.run_coroutine_threadsafe(
                self.broadcast(message, status_type, progress),
                loop
            )
        except RuntimeError:
            # No running event loop, log and skip
            logger.debug(f"Status (no loop): [{status_type.value}] {message}")
    
    @asynccontextmanager
    async def subscribe(self) -> AsyncGenerator[asyncio.Queue, None]:
        """Subscribe to status updates. Use as async context manager."""
        queue: asyncio.Queue = asyncio.Queue()
        
        async with self._lock:
            self._queues.add(queue)
            logger.debug(f"Client subscribed. Total clients: {len(self._queues)}")
        
        try:
            # Send current status if available
            if self._current_status:
                await queue.put(self._current_status)
            yield queue
        finally:
            async with self._lock:
                self._queues.discard(queue)
                logger.debug(f"Client unsubscribed. Total clients: {len(self._queues)}")
    
    async def stream(self) -> AsyncGenerator[str, None]:
        """Generate SSE stream for a client."""
        async with self.subscribe() as queue:
            while True:
                try:
                    # Send ping every 15 seconds to keep connection alive
                    status = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield status.to_sse()
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                except Exception as e:
                    logger.error(f"Error in status stream: {e}")
                    break
    
    # Convenience methods for common status types
    def info(self, message: str):
        """Broadcast an info status."""
        self.broadcast_sync(message, StatusType.INFO)
    
    def warning(self, message: str):
        """Broadcast a warning status."""
        self.broadcast_sync(message, StatusType.WARNING)
    
    def error(self, message: str):
        """Broadcast an error status."""
        self.broadcast_sync(message, StatusType.ERROR)
    
    def progress(self, message: str, percent: float):
        """Broadcast a progress status."""
        self.broadcast_sync(message, StatusType.PROGRESS, percent)
    
    def success(self, message: str):
        """Broadcast a success status."""
        self.broadcast_sync(message, StatusType.SUCCESS)


# Global singleton instance
status_manager = StatusManager()
