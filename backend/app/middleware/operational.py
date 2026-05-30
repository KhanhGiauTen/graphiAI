from __future__ import annotations

import logging
import time
from collections import deque
from threading import Lock
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from app.config import settings


logger = logging.getLogger("graphify.requests")


class OperationalHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-request-id") or uuid4().hex
        started_at = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - started_at) * 1000

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"
        if settings.SECURITY_HEADERS_ENABLED:
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            response.headers.setdefault("X-Frame-Options", "DENY")
            response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")

        if settings.REQUEST_LOGGING_ENABLED:
            logger.info(
                "%s %s -> %s %.2fms request_id=%s",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
                request_id,
            )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        enabled: bool | None = None,
        requests_per_window: int | None = None,
        window_seconds: int | None = None,
        exempt_paths: list[str] | None = None,
    ) -> None:
        super().__init__(app)
        self.enabled = settings.RATE_LIMIT_ENABLED if enabled is None else enabled
        self.requests_per_window = requests_per_window or settings.RATE_LIMIT_REQUESTS
        self.window_seconds = window_seconds or settings.RATE_LIMIT_WINDOW_SECONDS
        self.exempt_paths = tuple(exempt_paths if exempt_paths is not None else settings.rate_limit_exempt_paths)
        self._hits: dict[str, deque[float]] = {}
        self._lock = Lock()

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not self.enabled or request.url.path in self.exempt_paths:
            return await call_next(request)

        now = time.time()
        key = self._client_key(request)
        allowed, remaining, reset_seconds = self._record_hit(key, now)
        headers = {
            "X-RateLimit-Limit": str(self.requests_per_window),
            "X-RateLimit-Remaining": str(max(remaining, 0)),
            "X-RateLimit-Reset": str(reset_seconds),
        }
        if not allowed:
            headers["Retry-After"] = str(reset_seconds)
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers=headers,
            )

        response = await call_next(request)
        response.headers.update(headers)
        return response

    def _record_hit(self, key: str, now: float) -> tuple[bool, int, int]:
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            window_start = now - self.window_seconds
            while hits and hits[0] <= window_start:
                hits.popleft()

            if len(hits) >= self.requests_per_window:
                reset_seconds = max(1, int(round(self.window_seconds - (now - hits[0]))))
                return False, self.requests_per_window - len(hits), reset_seconds

            hits.append(now)
            remaining = self.requests_per_window - len(hits)
            reset_seconds = (
                self.window_seconds
                if len(hits) == 1
                else max(1, int(round(self.window_seconds - (now - hits[0]))))
            )
            return True, remaining, reset_seconds

    def _client_key(self, request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",", 1)[0].strip()
        return request.client.host if request.client else "unknown"
