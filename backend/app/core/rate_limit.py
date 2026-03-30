from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional
from uuid import UUID

from redis.asyncio import Redis
from redis.asyncio import from_url as redis_from_url

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_redis_client: Optional[Redis] = None
_redis_init_attempted = False
_local_rate_counters: dict[str, tuple[int, float]] = {}
_local_rate_lock = asyncio.Lock()


async def _get_redis_client() -> Optional[Redis]:
    global _redis_client, _redis_init_attempted
    if _redis_client is not None:
        return _redis_client
    if _redis_init_attempted:
        return None

    _redis_init_attempted = True
    settings = get_settings()
    try:
        _redis_client = redis_from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
        )
        await _redis_client.ping()
        return _redis_client
    except Exception:
        logger.warning("Redis rate limiter unavailable; falling back to local in-memory limiter.")
        _redis_client = None
        return None


async def _check_local_window(
    key: str,
    *,
    limit: int,
    window_seconds: int,
) -> tuple[bool, int, int]:
    now = time.time()
    async with _local_rate_lock:
        current_count, reset_at = _local_rate_counters.get(key, (0, now + window_seconds))
        if reset_at <= now:
            current_count = 0
            reset_at = now + window_seconds

        current_count += 1
        _local_rate_counters[key] = (current_count, reset_at)

        retry_after = max(1, int(reset_at - now))
        remaining = max(0, limit - current_count)
        return current_count <= limit, retry_after, remaining


async def check_rate_limit_key(
    rate_key: str,
    *,
    limit: int,
    window_seconds: int = 60,
) -> tuple[bool, int, int]:
    if limit <= 0:
        return True, 0, 0

    redis_client = await _get_redis_client()
    if redis_client is not None:
        try:
            current_count = await redis_client.incr(rate_key)
            if current_count == 1:
                await redis_client.expire(rate_key, window_seconds)

            ttl_seconds = await redis_client.ttl(rate_key)
            retry_after = ttl_seconds if ttl_seconds and ttl_seconds > 0 else window_seconds
            remaining = max(0, limit - int(current_count))
            return current_count <= limit, retry_after, remaining
        except Exception:
            logger.warning(
                "Redis rate limit check failed for key %s; using local fallback.",
                rate_key,
            )

    return await _check_local_window(rate_key, limit=limit, window_seconds=window_seconds)


async def check_api_key_request_limit(
    api_key_id: UUID,
    *,
    limit: int,
    window_seconds: int = 60,
) -> tuple[bool, int, int]:
    return await check_rate_limit_key(
        f"crmp:rate:api-key:{api_key_id}",
        limit=limit,
        window_seconds=window_seconds,
    )


async def check_invalid_api_key_limit(
    client_identifier: str,
    *,
    limit: int,
    window_seconds: int = 60,
) -> tuple[bool, int, int]:
    return await check_rate_limit_key(
        f"crmp:rate:invalid-api-key:{client_identifier}",
        limit=limit,
        window_seconds=window_seconds,
    )
