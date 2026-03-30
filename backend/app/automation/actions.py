from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import TaskSource
from app.models.event import Event
from app.schemas.task import TaskCreate
from app.services.ai_service import AIService
from app.services.task_service import TaskService


async def execute_action(
    session: AsyncSession,
    *,
    organization_id: UUID,
    event: Event,
    action: dict[str, Any],
) -> None:
    action_type = action.get("type")
    if action_type == "create_follow_up_task":
        title = action.get("title") or f"Follow up on {event.event_type}"
        task_payload = TaskCreate(
            title=title,
            description=action.get("description"),
            due_at=action.get("due_at"),
            source=TaskSource.automation,
            contact_id=event.payload.get("contact_id"),
            deal_id=event.payload.get("deal_id"),
        )
        await TaskService(session).create_task(
            organization_id=organization_id,
            payload=task_payload,
            emit_event=False,
            commit=False,
        )
    if action_type == "refresh_deal_score" and event.payload.get("deal_id"):
        deal_id = event.payload["deal_id"]
        await AIService(session).score_deal_from_event(
            organization_id=organization_id,
            deal_id=deal_id if isinstance(deal_id, UUID) else UUID(str(deal_id)),
        )
