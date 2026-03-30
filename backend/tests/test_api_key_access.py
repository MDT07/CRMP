from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from starlette.requests import Request

import app.api.dependencies as dependency_module
from app.api.dependencies import (
    WorkspaceAccess,
    get_workspace_access,
    require_any_api_key_module,
    require_api_key_module,
)


@pytest.mark.asyncio
async def test_user_session_bypasses_api_key_scope_checks() -> None:
    dependency = require_api_key_module("contacts")
    access = WorkspaceAccess(
        organization_id=uuid4(),
        auth_kind="user",
    )

    result = await dependency(access)

    assert result is access


@pytest.mark.asyncio
async def test_api_key_with_required_scope_is_allowed() -> None:
    dependency = require_api_key_module("automations")
    access = WorkspaceAccess(
        organization_id=uuid4(),
        auth_kind="api_key",
        api_key_id=uuid4(),
        api_key_modules=("automations", "deals"),
    )

    result = await dependency(access)

    assert result is access


@pytest.mark.asyncio
async def test_api_key_without_required_scope_is_rejected() -> None:
    dependency = require_api_key_module("analytics")
    access = WorkspaceAccess(
        organization_id=uuid4(),
        auth_kind="api_key",
        api_key_id=uuid4(),
        api_key_modules=("contacts", "inbox"),
    )

    with pytest.raises(HTTPException) as exc:
        await dependency(access)

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_api_key_with_any_allowed_scope_is_accepted() -> None:
    dependency = require_any_api_key_module("deals", "automations")
    access = WorkspaceAccess(
        organization_id=uuid4(),
        auth_kind="api_key",
        api_key_id=uuid4(),
        api_key_modules=("automations", "inbox"),
    )

    result = await dependency(access)

    assert result is access


@pytest.mark.asyncio
async def test_api_key_missing_all_allowed_scopes_is_rejected() -> None:
    dependency = require_any_api_key_module("deals", "automations")
    access = WorkspaceAccess(
        organization_id=uuid4(),
        auth_kind="api_key",
        api_key_id=uuid4(),
        api_key_modules=("contacts", "inbox"),
    )

    with pytest.raises(HTTPException) as exc:
        await dependency(access)

    assert exc.value.status_code == 403


def build_request() -> Request:
    return Request({"type": "http", "method": "GET", "path": "/", "headers": []})


@pytest.mark.asyncio
async def test_workspace_access_sets_request_state_for_api_key() -> None:
    api_key_id = uuid4()
    org_id = uuid4()
    key_record = SimpleNamespace(
        id=api_key_id,
        organization_id=org_id,
        modules=["contacts"],
        status="active",
    )
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=key_record)
    request = build_request()
    rate_limit_mock = AsyncMock(return_value=(True, 60, 239))
    original_rate_limiter = dependency_module.check_api_key_request_limit
    dependency_module.check_api_key_request_limit = rate_limit_mock

    try:
        access = await get_workspace_access(
            request=request,
            bearer_token=None,
            session=session,
            api_key="crmp_contacts_example",
        )
    finally:
        dependency_module.check_api_key_request_limit = original_rate_limiter

    assert access.auth_kind == "api_key"
    assert access.organization_id == org_id
    assert access.api_key_id == api_key_id
    assert request.state.crmp_api_key_id == api_key_id
    assert request.state.crmp_rate_limit_limit == 240
    assert request.state.crmp_rate_limit_remaining == 239
    assert request.state.crmp_rate_limit_reset == 60


@pytest.mark.asyncio
async def test_workspace_access_rejects_unknown_api_key() -> None:
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=None)
    request = build_request()
    invalid_attempt_mock = AsyncMock(return_value=(True, 60, 59))
    original_invalid_attempt_limiter = dependency_module.check_invalid_api_key_limit
    dependency_module.check_invalid_api_key_limit = invalid_attempt_mock

    try:
        with pytest.raises(HTTPException) as exc:
            await get_workspace_access(
                request=request,
                bearer_token=None,
                session=session,
                api_key="crmp_invalid_example",
            )
    finally:
        dependency_module.check_invalid_api_key_limit = original_invalid_attempt_limiter

    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_workspace_access_returns_429_when_rate_limited() -> None:
    api_key_id = uuid4()
    org_id = uuid4()
    key_record = SimpleNamespace(
        id=api_key_id,
        organization_id=org_id,
        modules=["contacts"],
        status="active",
    )
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=key_record)
    request = build_request()
    rate_limit_mock = AsyncMock(return_value=(False, 17, 0))
    original_rate_limiter = dependency_module.check_api_key_request_limit
    dependency_module.check_api_key_request_limit = rate_limit_mock

    try:
        with pytest.raises(HTTPException) as exc:
            await get_workspace_access(
                request=request,
                bearer_token=None,
                session=session,
                api_key="crmp_contacts_example",
            )
    finally:
        dependency_module.check_api_key_request_limit = original_rate_limiter

    assert exc.value.status_code == 429
    assert exc.value.headers == {
        "Retry-After": "17",
        "X-RateLimit-Limit": "240",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": "17",
    }


@pytest.mark.asyncio
async def test_workspace_access_returns_429_for_invalid_api_key_burst() -> None:
    session = AsyncMock()
    session.scalar = AsyncMock(return_value=None)
    request = build_request()
    invalid_attempt_mock = AsyncMock(return_value=(False, 33, 0))
    original_invalid_attempt_limiter = dependency_module.check_invalid_api_key_limit
    dependency_module.check_invalid_api_key_limit = invalid_attempt_mock

    try:
        with pytest.raises(HTTPException) as exc:
            await get_workspace_access(
                request=request,
                bearer_token=None,
                session=session,
                api_key="crmp_invalid_example",
            )
    finally:
        dependency_module.check_invalid_api_key_limit = original_invalid_attempt_limiter

    assert exc.value.status_code == 429
    assert exc.value.headers == {"Retry-After": "33"}
