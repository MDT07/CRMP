from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Optional
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from fastapi import APIRouter, Header, HTTPException, Request
from httpx import ASGITransport, AsyncClient

import app.main as main_module
from app.api.dependencies import AnalyticsAccessDep, WorkspaceAccess, get_workspace_access
from app.core.config import get_settings
from app.main import create_application


@pytest.fixture
async def api_key_http_harness(
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[dict[str, object]]:
    settings = get_settings()
    previous_event_worker = settings.event_worker_enabled
    settings.event_worker_enabled = False

    organization_id = uuid4()
    analytics_key_id = uuid4()
    contacts_key_id = uuid4()

    app = create_application()

    async def override_workspace_access(
        request: Request,
        api_key: Optional[str] = Header(default=None, alias="X-CRMP-API-Key"),
    ) -> WorkspaceAccess:
        if api_key == "crmp_test_analytics":
            request.state.crmp_api_key_id = analytics_key_id
            request.state.crmp_rate_limit_limit = 240
            request.state.crmp_rate_limit_remaining = 239
            request.state.crmp_rate_limit_reset = 60
            return WorkspaceAccess(
                organization_id=organization_id,
                auth_kind="api_key",
                api_key_id=analytics_key_id,
                api_key_modules=("analytics",),
            )

        if api_key == "crmp_test_contacts":
            request.state.crmp_api_key_id = contacts_key_id
            request.state.crmp_rate_limit_limit = 240
            request.state.crmp_rate_limit_remaining = 239
            request.state.crmp_rate_limit_reset = 60
            return WorkspaceAccess(
                organization_id=organization_id,
                auth_kind="api_key",
                api_key_id=contacts_key_id,
                api_key_modules=("contacts",),
            )

        raise HTTPException(status_code=401, detail="Invalid API key.")

    app.dependency_overrides[get_workspace_access] = override_workspace_access

    test_router = APIRouter(prefix="/_test", tags=["test"])

    @test_router.get("/analytics-guard")
    async def analytics_guard(_: AnalyticsAccessDep) -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(test_router, prefix=settings.api_v1_prefix)

    touch_mock = AsyncMock()
    monkeypatch.setattr(main_module, "touch_api_key_last_used", touch_mock)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield {
            "client": client,
            "touch_mock": touch_mock,
            "analytics_key_id": analytics_key_id,
            "organization_id": organization_id,
        }

    app.dependency_overrides.clear()
    settings.event_worker_enabled = previous_event_worker


@pytest.mark.asyncio
async def test_scoped_api_key_request_updates_last_used_on_success(
    api_key_http_harness: dict[str, object],
) -> None:
    client = api_key_http_harness["client"]
    touch_mock = api_key_http_harness["touch_mock"]
    analytics_key_id = api_key_http_harness["analytics_key_id"]

    assert isinstance(client, AsyncClient)
    assert isinstance(touch_mock, AsyncMock)
    assert isinstance(analytics_key_id, UUID)

    response = await client.get(
        "/api/v1/_test/analytics-guard",
        headers={"X-CRMP-API-Key": "crmp_test_analytics"},
    )

    assert response.status_code == 200
    assert response.headers["X-RateLimit-Limit"] == "240"
    assert response.headers["X-RateLimit-Remaining"] == "239"
    assert response.headers["X-RateLimit-Reset"] == "60"
    assert touch_mock.await_count == 1
    assert touch_mock.await_args.args[0] == analytics_key_id


@pytest.mark.asyncio
async def test_forbidden_scope_does_not_update_last_used(
    api_key_http_harness: dict[str, object],
) -> None:
    client = api_key_http_harness["client"]
    touch_mock = api_key_http_harness["touch_mock"]

    assert isinstance(client, AsyncClient)
    assert isinstance(touch_mock, AsyncMock)

    response = await client.get(
        "/api/v1/_test/analytics-guard",
        headers={"X-CRMP-API-Key": "crmp_test_contacts"},
    )

    assert response.status_code == 403
    assert touch_mock.await_count == 0


@pytest.mark.asyncio
async def test_invalid_api_key_returns_unauthorized_and_not_tracked(
    api_key_http_harness: dict[str, object],
) -> None:
    client = api_key_http_harness["client"]
    touch_mock = api_key_http_harness["touch_mock"]

    assert isinstance(client, AsyncClient)
    assert isinstance(touch_mock, AsyncMock)

    response = await client.get(
        "/api/v1/_test/analytics-guard",
        headers={"X-CRMP-API-Key": "crmp_test_invalid"},
    )

    assert response.status_code == 401
    assert touch_mock.await_count == 0
