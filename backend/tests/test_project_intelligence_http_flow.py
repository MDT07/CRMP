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
from app.services.project_intelligence_service import ProjectIntelligenceService


def _snapshot_payload() -> dict[str, object]:
    now = datetime.now(timezone.utc)
    return {
        "snapshot_id": "test-snapshot",
        "generated_at": now,
        "project_root": "/tmp/project",
        "total_files": 42,
        "total_directories": 8,
        "language_breakdown": {"Python": 20, "TypeScript": 10},
        "areas": [
            {
                "path": "backend",
                "file_count": 20,
                "last_modified_at": now,
            }
        ],
        "recent_files": [
            {
                "path": "backend/app/api/routes_ai.py",
                "reason": "Edited 2m ago.",
                "score": 1,
                "last_modified_at": now,
            }
        ],
        "hotspots": [
            {
                "path": "backend/app/services/ai_service.py",
                "reason": "Edited 3m ago, core backend path",
                "score": 5,
                "last_modified_at": now,
            }
        ],
        "decision_hints": [
            {
                "title": "Start from the highest hotspot",
                "detail": "Open backend/app/services/ai_service.py first.",
                "confidence": "high",
            }
        ],
        "focus": "ai",
        "focus_matches": [
            {
                "path": "backend/app/api/routes_ai.py",
                "source": "path",
                "line": None,
                "snippet": "backend/app/api/routes_ai.py",
            }
        ],
        "detail": "Scanned 42 files.",
    }


@pytest.fixture
async def project_intelligence_http_harness() -> AsyncIterator[AsyncClient]:
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
async def test_project_intelligence_snapshot_endpoint(
    project_intelligence_http_harness: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    get_snapshot_mock = AsyncMock(return_value=_snapshot_payload())
    monkeypatch.setattr(ProjectIntelligenceService, "get_snapshot", get_snapshot_mock)

    response = await project_intelligence_http_harness.get(
        "/api/v1/ai/project-intelligence",
        params={"focus": "ai", "limit": 6},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["snapshot_id"] == "test-snapshot"
    assert body["focus"] == "ai"


@pytest.mark.asyncio
async def test_project_intelligence_chat_endpoint(
    project_intelligence_http_harness: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    chat_mock = AsyncMock(
        return_value={
            "content": "Start from backend/app/services/ai_service.py.",
            "mode": "fallback",
            "snapshot": _snapshot_payload(),
        }
    )
    monkeypatch.setattr(ProjectIntelligenceService, "chat", chat_mock)

    response = await project_intelligence_http_harness.post(
        "/api/v1/ai/project-intelligence/chat",
        json={
            "prompt": "Where should I start?",
            "focus": "ai",
            "limit": 6,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "fallback"
    assert body["snapshot"]["snapshot_id"] == "test-snapshot"
