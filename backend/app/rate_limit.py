"""A small fixed-window limiter for failed login attempts.

Deliberately in-process and deliberately narrow. It exists to blunt password
guessing against `/auth/login`, not to be a general quota system: the counters
live in memory, reset when the app restarts, and are not shared between
workers. That is adequate for a single-uvicorn deployment; if this ever runs
multi-process, move the store to Redis (or adopt slowapi with a Redis backend)
rather than trusting these numbers.

Only *failures* are counted, and a success clears the record — so someone who
knows their password is never throttled, however often they sign in.
"""

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

# Ten wrong passwords in five minutes is far beyond human fumbling and far
# below what makes guessing worthwhile.
MAX_FAILURES = 10
WINDOW_SECONDS = 5 * 60


class FailureLimiter:
    def __init__(
        self, max_failures: int = MAX_FAILURES, window_seconds: int = WINDOW_SECONDS
    ) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self._failures: dict[str, list[float]] = defaultdict(list)

    def _recent(self, key: str, now: float) -> list[float]:
        """Failures still inside the window, dropping the ones that aged out."""
        cutoff = now - self.window_seconds
        recent = [at for at in self._failures[key] if at > cutoff]
        if recent:
            self._failures[key] = recent
        else:
            # Don't let the dict grow a key per IP that ever tried once.
            self._failures.pop(key, None)
        return recent

    def check(self, key: str) -> None:
        """Raise 429 if `key` has spent its attempts. Call before verifying."""
        now = time.monotonic()
        recent = self._recent(key, now)
        if len(recent) < self.max_failures:
            return
        retry_after = int(recent[0] + self.window_seconds - now) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed sign-in attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    def record_failure(self, key: str) -> None:
        self._failures[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)

    def clear(self) -> None:
        """Drop every counter — used to isolate tests from each other."""
        self._failures.clear()


def client_key(request: Request) -> str:
    """Throttle by source address.

    Per-IP rather than per-email on purpose: keying on the email would let
    anyone lock a known user out of their own garden by failing on their
    behalf. Behind a reverse proxy every caller shares an address, so a proxied
    deployment should forward the real one and read it here.
    """
    return request.client.host if request.client else "unknown"


login_limiter = FailureLimiter()
