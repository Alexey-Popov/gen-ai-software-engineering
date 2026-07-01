import threading
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-memory, per-IP fixed-window rate limiter (Task 4D)."""

    def __init__(self, app, limit: int = 100, window_seconds: int = 60) -> None:
        super().__init__(app)
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, list] = {}
        self._lock = threading.Lock()

    async def dispatch(self, request, call_next):
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        with self._lock:
            window = self._hits.get(ip)
            if window is None or now - window[0] >= self.window:
                self._hits[ip] = [now, 1]
                allowed = True
            else:
                window[1] += 1
                allowed = window[1] <= self.limit

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": f"Rate limit of {self.limit} requests per minute exceeded",
                },
            )
        return await call_next(request)
