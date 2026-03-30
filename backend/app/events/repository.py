from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EventSource
from app.models.event import Event


class EventRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_event(
        self,
        *,
        organization_id: UUID | None,
        event_type: str,
        entity_type: str,
        entity_id: str | None,
        payload: dict[str, Any],
        source: EventSource = EventSource.api,
    ) -> Event:
        event = Event(
            organization_id=organization_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
            source=source,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(event)
        await self.session.flush()
        return event

    async def list_pending_events(self, *, limit: int = 100) -> list[Event]:
        result = await self.session.scalars(
            select(Event)
            .where(Event.processed_at.is_(None))
            .where(Event.failure_count < 5)
            .order_by(Event.created_at.asc())
            .limit(limit)
        )
        return list(result.all())
