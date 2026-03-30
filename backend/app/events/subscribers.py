from __future__ import annotations

from collections.abc import Awaitable, Callable
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.events.event_types import EventTypes
from app.models.event import Event

EventHandler = Callable[[Event, AsyncSession], Awaitable[None]]


async def analytics_subscriber(event: Event, session: AsyncSession) -> None:
    from app.services.analytics_service import AnalyticsService

    await AnalyticsService(session).ingest_event(event)


async def ai_subscriber(event: Event, session: AsyncSession) -> None:
    from app.services.ai_service import AIService

    if event.organization_id is None or event.entity_id is None:
        return
    if event.event_type == EventTypes.MESSAGE_RECEIVED:
        await AIService(session).analyze_message(event.organization_id, UUID(event.entity_id))
    if event.event_type == EventTypes.DEAL_STAGE_CHANGED and event.payload.get("deal_id"):
        await AIService(session).score_deal_from_event(
            event.organization_id,
            UUID(str(event.payload["deal_id"])),
        )


async def automation_subscriber(event: Event, session: AsyncSession) -> None:
    from app.services.automation_service import AutomationService

    await AutomationService(session).handle_event(event)


async def ai_agent_run_subscriber(event: Event, session: AsyncSession) -> None:
    from app.services.ai_agent_service import AIAgentService

    if event.organization_id is None:
        return
    run_id = event.payload.get("run_id")
    if not run_id:
        return
    await AIAgentService(session).execute_queued_run(event.organization_id, UUID(str(run_id)))


async def run_local_subscribers(event: Event, session: AsyncSession) -> None:
    handlers_by_event: dict[str, list[EventHandler]] = {
        EventTypes.MESSAGE_RECEIVED: [ai_subscriber, analytics_subscriber, automation_subscriber],
        EventTypes.DEAL_STAGE_CHANGED: [ai_subscriber, analytics_subscriber, automation_subscriber],
        EventTypes.PROJECT_CREATED: [analytics_subscriber, automation_subscriber],
        EventTypes.CONTACT_INACTIVE: [analytics_subscriber, automation_subscriber],
        EventTypes.DEAL_CREATED: [analytics_subscriber],
        EventTypes.CONTACT_CREATED: [analytics_subscriber],
        EventTypes.TASK_CREATED: [analytics_subscriber],
        EventTypes.DEAL_SCORED: [analytics_subscriber],
        EventTypes.AI_INSIGHT_CREATED: [analytics_subscriber],
        EventTypes.AI_AGENT_RUN_REQUESTED: [ai_agent_run_subscriber],
    }
    for handler in handlers_by_event.get(event.event_type, []):
        await handler(event, session)
