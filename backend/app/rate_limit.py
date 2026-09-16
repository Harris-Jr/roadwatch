"""
Minimal in-memory rate limiter for the authentication endpoints
(/auth/login, /auth/signup, /auth/refresh).

Deliberately dependency-free (no Redis, no slowapi) to avoid adding
infrastructure this project doesn't otherwise need. Fixed-window counter
per (client IP, bucket name).

Known limitation, stated plainly rather than glossed over: this state
lives in a single process's memory. It works correctly for the single
`uvicorn` worker this project's docker-compose runs. If you ever scale
the api service to multiple workers/replicas (`uvicorn --workers N`, or
multiple containers behind a load balancer), each process gets its own
counters and the effective limit multiplies by the worker count. At that
point, swap the in-memory dict below for Redis (`INCR` + `EXPIRE`) —
the public interface (`check_rate_limit`) doesn't need to change.

IP address is taken from `request.client.host`, which is only correct if
the app is reachable directly. Behind Nginx/a reverse proxy, configure
`--proxy-headers` (uvicorn) or trust `X-Forwarded-For` appropriately, or
every request will appear to come from the proxy's IP and share one
bucket — see the "Setting Up Real Routing"-style deployment notes in the
README for the equivalent Nginx config this needs.
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status

# bucket_name -> client_key -> (window_start_epoch_seconds, count)
_buckets: dict[str, dict[str, tuple[float, int]]] = defaultdict(dict)
_lock = Lock()

WINDOW_SECONDS = 60


def _client_key(request: Request) -> str:
    if request.client:
        return request.client.host
    return "unknown"


def check_rate_limit(request: Request, bucket: str, limit_per_minute: int) -> None:
    """Raises 429 if the caller has exceeded `limit_per_minute` requests to
    `bucket` within the current 60-second window. Call this as the first
    line of a route (or as a FastAPI dependency) — see app/routers/auth.py
    for usage."""
    key = _client_key(request)
    now = time.time()

    with _lock:
        window_start, count = _buckets[bucket].get(key, (now, 0))
        if now - window_start >= WINDOW_SECONDS:
            # New window.
            _buckets[bucket][key] = (now, 1)
            return
        if count >= limit_per_minute:
            retry_after = int(WINDOW_SECONDS - (now - window_start))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait before trying again.",
                headers={"Retry-After": str(max(retry_after, 1))},
            )
        _buckets[bucket][key] = (window_start, count + 1)


def reset_rate_limits() -> None:
    """Test helper — clears all counters between test cases."""
    with _lock:
        _buckets.clear()
