import time
from collections import defaultdict
from typing import Callable, Dict, List

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class RateLimiter:
    """Sliding-window request counter, keyed by client IP."""

    def __init__(self, max_requests: int = 100, window_seconds: float = 60.0) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: Dict[str, List[float]] = defaultdict(list)

    def reset(self) -> None:
        self._hits.clear()

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds
        hits = [t for t in self._hits[key] if t > window_start]
        hits.append(now)
        self._hits[key] = hits
        return len(hits) <= self.max_requests


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        limiter: RateLimiter = request.app.state.rate_limiter
        client_ip = request.client.host if request.client else "unknown"

        if not limiter.is_allowed(client_ip):
            return JSONResponse(
                status_code=429,
                content={"error": "Too Many Requests", "details": "Rate limit of 100 requests per minute exceeded"},
            )

        return await call_next(request)
