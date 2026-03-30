from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.config import get_settings
from app.schemas.ai import (
    AgentRunRequest,
    AgentSelectionContext,
    AssistantMessageRequest,
    ProjectIntelligenceSnapshot,
)
from app.services.ai_agent_service import AIAgentService
from app.services.ai_service import AIService
from app.services.grounded_ai_service import GroundedInboxService
from app.services.project_intelligence_service import ProjectIntelligenceService


@pytest.fixture(autouse=True)
def reset_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_ai_service_uses_chat_model_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_MODEL", "fallback-model")
    monkeypatch.setenv("LLM_MODEL_CHAT", "chat-model")

    service = AIService(AsyncMock())
    service.llm_client.complete_text = AsyncMock(return_value="hello from chat")

    response = await service.copilot_message(
        uuid4(),
        AssistantMessageRequest(prompt="Summarize this."),
    )

    assert response.mode == "llm"
    assert service.llm_client.complete_text.await_args.kwargs["model"] == "chat-model"


@pytest.mark.asyncio
async def test_grounded_inbox_uses_chat_model_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_MODEL", "fallback-model")
    monkeypatch.setenv("LLM_MODEL_CHAT", "chat-model")

    service = GroundedInboxService(AsyncMock())
    service.llm_client.complete_text = AsyncMock(return_value="grounded response")

    _, mode = await service._generate_content(
        prompt="Draft a reply.",
        tone="focused",
        thread_summary={"participant": "Customer"},
        grounding_payload={"messages": []},
        model=None,
    )

    assert mode == "llm"
    assert service.llm_client.complete_text.await_args.kwargs["model"] == "chat-model"


@pytest.mark.asyncio
async def test_ai_agent_uses_agent_model_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLM_MODEL", "fallback-model")
    monkeypatch.setenv("LLM_MODEL_AGENT", "agent-model")

    service = AIAgentService(AsyncMock())
    service.llm_client.complete_text = AsyncMock(return_value="agent output")

    payload = AgentRunRequest(
        prompt="Plan the next actions.",
        selection=AgentSelectionContext(),
    )

    _, mode = await service._generate_content(payload, context_snapshot={})

    assert mode == "llm"
    assert service.llm_client.complete_text.await_args.kwargs["model"] == "agent-model"


@pytest.mark.asyncio
async def test_project_intel_uses_project_model_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LLM_MODEL", "fallback-model")
    monkeypatch.setenv("LLM_MODEL_PROJECT_INTEL", "project-model")

    service = ProjectIntelligenceService(AsyncMock())
    service.llm_client.complete_text = AsyncMock(return_value="project guidance")

    snapshot = ProjectIntelligenceSnapshot(
        snapshot_id="snapshot",
        generated_at=datetime.now(timezone.utc),
        project_root="/tmp/project",
        total_files=1,
        total_directories=1,
        language_breakdown={"Python": 1},
        areas=[],
        recent_files=[],
        hotspots=[],
        decision_hints=[],
        focus=None,
        focus_matches=[],
        detail="ok",
    )

    _, mode = await service._generate_chat_response(
        prompt="Where should I start?",
        snapshot=snapshot,
    )

    assert mode == "llm"
    assert service.llm_client.complete_text.await_args.kwargs["model"] == "project-model"
