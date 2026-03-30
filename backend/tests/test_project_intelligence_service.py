from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.config import get_settings
from app.services.project_intelligence_service import ProjectIntelligenceService


def _write(path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


@pytest.mark.asyncio
async def test_project_snapshot_includes_focus_matches(tmp_path) -> None:
    _write(
        tmp_path / "backend" / "app" / "services" / "auth_service.py",
        "def check_auth():\n    # TODO tighten auth checks\n    return True\n",
    )
    _write(
        tmp_path / "backend" / "app" / "api" / "routes_auth.py",
        "from app.services.auth_service import check_auth\n",
    )
    _write(
        tmp_path / "src" / "app" / "components" / "AuthPanel.tsx",
        "export function AuthPanel() { return null; }\n",
    )
    _write(
        tmp_path / "backend" / "tests" / "test_auth_flow.py",
        "def test_auth_flow():\n    assert True\n",
    )

    settings = get_settings()
    previous_root = settings.project_assistant_root
    previous_max_files = settings.project_assistant_max_files
    settings.project_assistant_root = str(tmp_path)
    settings.project_assistant_max_files = 100

    try:
        service = ProjectIntelligenceService(AsyncMock())
        snapshot = await service.get_snapshot(uuid4(), focus="auth", limit=6)
    finally:
        settings.project_assistant_root = previous_root
        settings.project_assistant_max_files = previous_max_files

    assert snapshot.total_files >= 4
    assert snapshot.focus == "auth"
    assert snapshot.hotspots
    assert any("auth" in item.path.lower() for item in snapshot.focus_matches)


@pytest.mark.asyncio
async def test_project_chat_returns_fallback_when_llm_unavailable(tmp_path) -> None:
    _write(
        tmp_path / "backend" / "app" / "services" / "project_service.py",
        "def project_step():\n    return 'ok'\n",
    )
    _write(
        tmp_path / "src" / "app" / "components" / "ProjectsPage.tsx",
        "export function ProjectsPage() { return null; }\n",
    )

    settings = get_settings()
    previous_root = settings.project_assistant_root
    previous_max_files = settings.project_assistant_max_files
    settings.project_assistant_root = str(tmp_path)
    settings.project_assistant_max_files = 100

    try:
        service = ProjectIntelligenceService(AsyncMock())
        service.llm_client.complete_text = AsyncMock(return_value=None)
        response = await service.chat(
            uuid4(),
            prompt="Where should I start to update project behavior?",
            focus="project",
            limit=6,
        )
    finally:
        settings.project_assistant_root = previous_root
        settings.project_assistant_max_files = previous_max_files

    assert response.mode == "fallback"
    assert "Snapshot" in response.content
    assert response.snapshot.total_files >= 2
