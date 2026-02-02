import asyncio
from typing import Any, Callable

from app.config import MAX_CONCURRENCY, REQUEST_TIMEOUT_S

_semaphore = asyncio.Semaphore(MAX_CONCURRENCY)


async def run_inference(callable_fn: Callable[..., Any], *args: Any, timeout: int | None = None, **kwargs: Any) -> Any:
    async with _semaphore:
        job = asyncio.to_thread(callable_fn, *args, **kwargs)
        effective_timeout = REQUEST_TIMEOUT_S if timeout is None else timeout
        if effective_timeout and effective_timeout > 0:
            return await asyncio.wait_for(job, timeout=effective_timeout)
        return await job
