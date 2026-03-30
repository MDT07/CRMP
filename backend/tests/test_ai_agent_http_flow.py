from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.dependencies import get_current_user
from app.core.config import get_settings
from app.db.session import get_db_session
from app.main import create_application
from app.services.ai_agent_service import AIAgentService


def _build_run_payload() -> dict[str, object]:
    now = datetime.now(timezone.utc)
    return {
        "id": uuid4(),
        "created_at": now,
        "updated_at": now,
        "organization_id": uuid4(),
        "requested_by_user_id": uuid4(),
        "trace_id": uuid4().hex,
        "status": "completed",
        "run_kind": "sync",
        "prompt": "Summarize this pipeline.",
        "tone": "focused",
        "page": "Pipeline",
        "route": "/pipeline",
        "model": None,
        "output_mode": "fallback",
        "selection_context": {"data_source": "live", "selected_entities": []},
        "context_snapshot": {"resolved_context": {}},
        "evidence": [],
        "output_content": "Pipeline summary ready.",
        "error_detail": None,
        "started_at": now,
        "finished_at": now,
    }


def _build_proposal_payload() -> dict[str, object]:
    now = datetime.now(timezone.utc)
    return {
        "id": uuid4(),
        "created_at": now,
        "updated_at": now,
        "organization_id": uuid4(),
        "requested_by_user_id": uuid4(),
        "approved_by_user_id": None,
        "rejected_by_user_id": None,
        "thread_id": "agent-run:test",
        "trace_id": uuid4().hex,
        "action_type": "create_follow_up_task",
        "status": "pending",
        "title": "Create follow-up task",
        "detail": "Track the next action.",
        "reasoning": "User asked for next steps.",
        "target_entity_type": "task",
        "target_entity_id": None,
        "action_payload": {
            "title": "Follow up",
            "status": "open",
            "source": "automation",
        },
        "diff_payload": {"before": None, "after": {"title": "Follow up"}},
        "evidence": [],
        "rejection_reason": None,
        "last_error": None,
        "approved_at": None,
        "rejected_at": None,
        "executed_at": None,
        "expires_at": now,
    }


@pytest.fixture
async def ai_agent_http_harness(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AsyncClient]:
    settings = get_settings()
    previous_event_worker = settings.event_worker_enabled
    settings.event_worker_enabled = False

    app = create_application()

    async def override_db_session():
        yield AsyncMock()

    async def override_current_user():
        return SimpleNamespace(
            id=uuid4(),
            organization_id=uuid4(),
            role="admin",
            is_active=True,
        )

    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[get_current_user] = override_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()
    settings.event_worker_enabled = previous_event_worker


@pytest.mark.asyncio
async def test_sync_agent_run_returns_run_and_proposals(
    ai_agent_http_harness: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_payload = _build_run_payload()
    proposal_payload = _build_proposal_payload()
    run_sync_mock = AsyncMock(return_value=(run_payload, [proposal_payload]))
    monkeypatch.setattr(AIAgentService, "run_sync", run_sync_mock)

    response = await ai_agent_http_harness.post(
        "/api/v1/ai/agent/run",
        json={
            "prompt": "Summarize and propose the next action.",
            "selection": {"data_source": "live", "selected_entities": []},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["run"]["status"] == "completed"
    assert body["proposed_actions"][0]["action_type"] == "create_follow_up_task"


@pytest.mark.asyncio
async def test_async_agent_run_queue_endpoint_returns_created(
    ai_agent_http_harness: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    run_payload = _build_run_payload()
    run_payload["status"] = "queued"
    run_payload["run_kind"] = "async"
    create_async_mock = AsyncMock(return_value=run_payload)
    monkeypatch.setattr(AIAgentService, "create_async_run", create_async_mock)

    response = await ai_agent_http_harness.post(
        "/api/v1/ai/agent/runs",
        json={
            "prompt": "Create follow-up tasks in background.",
            "selection": {"data_source": "live", "selected_entities": []},
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["run"]["status"] == "queued"
    assert body["run"]["run_kind"] == "async"


@pytest.mark.asyncio
async def test_agent_endpoint_rejects_api_key_only_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = get_settings()
    previous_event_worker = settings.event_worker_enabled
    settings.event_worker_enabled = False

    app = create_application()

    async def override_db_session():
        yield AsyncMock()

    app.dependency_overrides[get_db_session] = override_db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/v1/ai/agent/run",
            json={
                "prompt": "Summarize this workspace.",
                "selection": {"data_source": "live", "selected_entities": []},
            },
            headers={"X-CRMP-API-Key": "crmp_test_key"},
        )

    app.dependency_overrides.clear()
    settings.event_worker_enabled = previous_event_worker

    assert response.status_code == 401
