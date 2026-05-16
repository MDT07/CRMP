"""API routes for NVIDIA Nemotron-3-Nano-4B CRM Assistant.

Provides endpoints for the multi-purpose nematron assistant including:
- Contact analysis
- Deal scoring
- Email drafting
- Follow-up suggestions
- Meeting preparation
- Pipeline analysis
"""

from __future__ import annotations

import logging
from typing import Any, Optional
from uuid import UUID

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Query

from app.api.dependencies import OptionalCurrentUserDep, SessionDep
from app.schemas.ai import (
    AssistantMessageResponse,
    AssistantStatusResponse,
    NematronChatRequest,
)
from app.services.nematron_service import NematronCRMService

router = APIRouter(prefix="/nematron", tags=["nematron"])


@router.get("/status", response_model=AssistantStatusResponse)
async def nematron_status(
    session: SessionDep,
    _: OptionalCurrentUserDep,
) -> AssistantStatusResponse:
    """Get nematron assistant status and capabilities."""
    service = NematronCRMService(session)
    capabilities = service.get_capabilities()

    # Check if LLM is reachable
    from app.ai.llm_client import LLMClient

    llm_client = LLMClient()
    llm_status = await llm_client.get_status(requested_model=service.model_id)

    return AssistantStatusResponse(
        mode="llm" if llm_status.get("reachable") else "fallback",
        reachable=llm_status.get("reachable", False),
        is_local=llm_status.get("is_local", True),
        base_url=llm_status.get("base_url", ""),
        configured_model=service.model_id,
        available_models=llm_status.get("available_models", []),
        loaded_models=llm_status.get("loaded_models", []),
        detail=llm_status.get("detail", ""),
    )


@router.get("/capabilities")
async def nematron_capabilities(
    session: SessionDep,
    _: OptionalCurrentUserDep,
) -> dict[str, Any]:
    """Get detailed nematron capabilities and optimal use cases."""
    service = NematronCRMService(session)
    return service.get_capabilities()


@router.post("/analyze/contact/{contact_id}")
async def analyze_contact(
    contact_id: UUID,
    session: SessionDep,
    current_user: OptionalCurrentUserDep,
) -> dict[str, Any]:
    """Analyze a contact and provide actionable insights."""
    if not current_user:
        return {
            "error": "Authentication required for contact analysis",
            "contact_id": str(contact_id),
        }

    service = NematronCRMService(session)
    result = await service.analyze_contact(
        current_user.organization_id,
        contact_id,
    )
    if not result:
        return {
            "error": "Contact not found or analysis failed",
            "contact_id": str(contact_id),
        }
    return result


@router.post("/analyze/deal/{deal_id}")
async def analyze_deal(
    deal_id: UUID,
    session: SessionDep,
    current_user: OptionalCurrentUserDep,
) -> dict[str, Any]:
    """Analyze a deal and provide scoring/insights."""
    if not current_user:
        return {
            "error": "Authentication required for deal analysis",
            "deal_id": str(deal_id),
        }

    service = NematronCRMService(session)
    result = await service.analyze_deal(
        current_user.organization_id,
        deal_id,
    )
    if not result:
        return {
            "error": "Deal not found or analysis failed",
            "deal_id": str(deal_id),
        }
    return result


@router.post("/draft/email/{message_id}")
async def draft_email_reply(
    message_id: UUID,
    session: SessionDep,
    current_user: OptionalCurrentUserDep,
    tone: str = Query(default="professional"),
) -> dict[str, Any]:
    """Draft an email reply for a message."""
    service = NematronCRMService(session)
    result = await service.draft_email_reply(
        current_user.organization_id,
        message_id,
        tone=tone,
    )
    if not result:
        return {
            "error": "Message not found or draft generation failed",
            "message_id": str(message_id),
        }
    return result


@router.post("/suggest/follow-up/{entity_type}/{entity_id}")
async def suggest_follow_up(
    entity_type: str,
    entity_id: UUID,
    session: SessionDep,
    current_user: OptionalCurrentUserDep,
) -> dict[str, Any]:
    """Suggest follow-up action for a contact or deal."""
    service = NematronCRMService(session)
    result = await service.suggest_follow_up(
        current_user.organization_id,
        entity_type,
        entity_id,
    )
    if not result:
        return {
            "error": "Entity not found or suggestion generation failed",
            "entity_type": entity_type,
            "entity_id": str(entity_id),
        }
    return result


@router.post("/meeting/prep")
async def prepare_meeting_brief(
    session: SessionDep,
    current_user: OptionalCurrentUserDep,
    contact_ids: list[UUID] = Query(),
    deal_ids: Optional[list[UUID]] = Query(default=None),
    meeting_type: str = Query(default="discovery"),
) -> dict[str, Any]:
    """Prepare a meeting brief with attendees and context."""
    service = NematronCRMService(session)
    result = await service.prepare_meeting_brief(
        current_user.organization_id,
        contact_ids,
        deal_ids=deal_ids,
        meeting_type=meeting_type,
    )
    if not result:
        return {
            "error": "Meeting brief generation failed",
            "contact_ids": [str(cid) for cid in contact_ids],
        }
    return result


@router.get("/analyze/pipeline")
async def analyze_pipeline(
    session: SessionDep,
    current_user: OptionalCurrentUserDep,
    timeframe: str = Query(default="current quarter"),
) -> dict[str, Any]:
    """Analyze overall pipeline health."""
    service = NematronCRMService(session)
    result = await service.analyze_pipeline(
        current_user.organization_id,
        timeframe=timeframe,
    )
    if not result:
        return {
            "error": "Pipeline analysis failed",
            "organization_id": str(current_user.organization_id),
        }
    return result


@router.get("/tasks/prioritize")
async def prioritize_tasks(
    session: SessionDep,
    current_user: OptionalCurrentUserDep,
    limit: int = Query(default=20, ge=1, le=50),
) -> dict[str, Any]:
    """Intelligently prioritize tasks for the user."""
    service = NematronCRMService(session)
    result = await service.prioritize_tasks(
        current_user.organization_id,
        user_id=current_user.id,
        limit=limit,
    )
    if not result:
        return {
            "error": "Task prioritization failed",
            "user_id": str(current_user.id),
        }
    return result


@router.post("/generate/summary")
async def generate_summary(
    session: SessionDep,
    current_user: OptionalCurrentUserDep,
    summary_type: str = Query(),
    entity_ids: Optional[list[UUID]] = Query(default=None),
    focus_areas: Optional[list[str]] = Query(default=None),
) -> dict[str, Any]:
    """Generate smart summaries of CRM data."""
    service = NematronCRMService(session)
    result = await service.generate_summary(
        current_user.organization_id,
        summary_type,
        entity_ids=entity_ids,
        focus_areas=focus_areas,
    )
    if not result:
        return {
            "error": "Summary generation failed",
            "summary_type": summary_type,
        }
    return result


@router.post("/suggest/automation")
async def suggest_automation(
    session: SessionDep,
    current_user: OptionalCurrentUserDep,
    workflow_description: str,
) -> dict[str, Any]:
    """Suggest automation improvements for a workflow."""
    service = NematronCRMService(session)
    result = await service.suggest_automation(
        workflow_description,
        organization_id=current_user.organization_id,
    )
    if not result:
        return {
            "error": "Automation suggestion failed",
            "workflow": workflow_description,
        }
    return result


@router.post("/chat", response_model=AssistantMessageResponse)
async def nematron_chat(
    payload: NematronChatRequest,
    session: SessionDep,
    current_user: OptionalCurrentUserDep,
) -> AssistantMessageResponse:
    """General chat with nematron CRM assistant."""
    try:
        service = NematronCRMService(session)
        organization_id = current_user.organization_id if current_user else None
        user_id = current_user.id if current_user else None
        result = await service.chat(
            payload.message,
            organization_id,
            user_id,
            payload.session_id
        )
        return AssistantMessageResponse(
            content=result.get("response", "I'm here to help with your CRM tasks."),
            mode=result.get("mode", "fallback"),
        )
    except Exception as e:
        # Return fallback response on any error
        return AssistantMessageResponse(
            content=f"I encountered an issue: {str(e)}",
            mode="fallback",
        )


@router.get("/chat/history")
async def get_chat_history(
    session_id: str,
    session: SessionDep,
    current_user: OptionalCurrentUserDep,
) -> list[dict[str, Any]]:
    """Get chat history for a session."""
    try:
        from app.models.ai_chat_message import AIChatMessage
        from sqlalchemy import select

        organization_id = current_user.organization_id if current_user else None
        if not organization_id:
            return []

        messages = await session.scalars(
            select(AIChatMessage)
            .where(AIChatMessage.organization_id == organization_id)
            .where(AIChatMessage.session_id == session_id)
            .order_by(AIChatMessage.created_at.asc())
        )

        return [
            {
                "id": str(msg.id),
                "role": msg.role.value,
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
                "metadata": msg.message_metadata,
            }
            for msg in messages
        ]
    except Exception as e:
        logger.exception(f"Failed to get chat history: {e}")
        return []
async def execute_multitask(
    tasks: list[dict[str, Any]],
    session: SessionDep,
    current_user: OptionalCurrentUserDep,
) -> dict[str, Any]:
    """Execute multiple CRM tasks efficiently."""
    service = NematronCRMService(session)
    result = await service.execute_multitask(
        tasks,
        current_user.organization_id,
    )
    if not result:
        return {
            "error": "Multitask execution failed",
            "task_count": len(tasks),
        }
    return result
