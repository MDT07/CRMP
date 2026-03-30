from uuid import uuid4

import pytest

import app.core.rate_limit as rate_limit_module
from app.core.rate_limit import check_api_key_request_limit, check_invalid_api_key_limit


@pytest.mark.asyncio
async def test_local_fallback_rate_limit_blocks_after_limit() -> None:
    original_redis_getter = rate_limit_module._get_redis_client

    async def no_redis_client():
        return None

    rate_limit_module._get_redis_client = no_redis_client
    try:
        key_id = uuid4()
        allowed_first, _, remaining_first = await check_api_key_request_limit(
            key_id,
            limit=1,
            window_seconds=60,
        )
        allowed_second, retry_after, remaining_second = await check_api_key_request_limit(
            key_id,
            limit=1,
            window_seconds=60,
        )
    finally:
        rate_limit_module._get_redis_client = original_redis_getter

    assert allowed_first is True
    assert remaining_first == 0
    assert allowed_second is False
    assert retry_after > 0
    assert remaining_second == 0


@pytest.mark.asyncio
async def test_rate_limit_disabled_when_limit_is_non_positive() -> None:
    allowed, retry_after, remaining = await check_api_key_request_limit(uuid4(), limit=0)

    assert allowed is True
    assert retry_after == 0
    assert remaining == 0


@pytest.mark.asyncio
async def test_invalid_api_key_limiter_uses_same_local_fallback() -> None:
    original_redis_getter = rate_limit_module._get_redis_client

    async def no_redis_client():
        return None

    rate_limit_module._get_redis_client = no_redis_client
    try:
        allowed_first, _, _ = await check_invalid_api_key_limit(
            "127.0.0.1",
            limit=1,
            window_seconds=60,
        )
        allowed_second, retry_after, _ = await check_invalid_api_key_limit(
            "127.0.0.1",
            limit=1,
            window_seconds=60,
        )
    finally:
        rate_limit_module._get_redis_client = original_redis_getter

    assert allowed_first is True
    assert allowed_second is False
    assert retry_after > 0
