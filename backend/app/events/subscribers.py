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


async def automation_subscriber(event: Event, session: AsyncSession) -> None:
    from app.services.automation_service import AutomationService

    await AutomationService(session).handle_event(event)


async def run_local_subscribers(event: Event, session: AsyncSession) -> None:
    handlers_by_event: dict[str, list[EventHandler]] = {
        EventTypes.MESSAGE_RECEIVED: [analytics_subscriber, automation_subscriber],
        EventTypes.DEAL_STAGE_CHANGED: [analytics_subscriber, automation_subscriber],
        EventTypes.PROJECT_CREATED: [analytics_subscriber, automation_subscriber],
        EventTypes.CONTACT_INACTIVE: [analytics_subscriber, automation_subscriber],
        EventTypes.DEAL_CREATED: [analytics_subscriber],
        EventTypes.CONTACT_CREATED: [analytics_subscriber],
        EventTypes.TASK_CREATED: [analytics_subscriber],
        EventTypes.AUTOMATION_RULE_EXECUTED: [analytics_subscriber],
    }
    for handler in handlers_by_event.get(event.event_type, []):
        await handler(event, session)
