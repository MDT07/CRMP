from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.events.repository import EventRepository
from app.events.subscribers import run_local_subscribers
from app.models.enums import EventSource
from app.models.event import Event

logger = logging.getLogger(__name__)


class EventPublisher(Protocol):
    async def publish(self, event: Event) -> None:
        ...


class NoopEventPublisher:
    async def publish(self, event: Event) -> None:
        _ = event


class EventDispatcher:
    def __init__(
        self,
        session: AsyncSession,
        publisher: EventPublisher | None = None,
    ):
        self.session = session
        self.publisher = publisher or NoopEventPublisher()
        self.repository = EventRepository(session)

    async def publish(
        self,
        *,
        organization_id: UUID | None,
        event_type: str,
        entity_type: str,
        entity_id: str | None,
        payload: dict[str, Any] | None = None,
        source: EventSource = EventSource.api,
    ) -> Event:
        event = await self.repository.create_event(
            organization_id=organization_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload or {},
            source=source,
        )
        await self.publisher.publish(event)
        return event

    async def process_pending_events(self, *, limit: int = 100, max_cycles: int = 4) -> int:
        processed_count = 0
        cycles = 0

        while processed_count < limit and cycles < max_cycles:
            pending_events = await self.repository.list_pending_events(
                limit=max(1, limit - processed_count)
            )
            pending_events = [
                event for event in pending_events if event.processing_started_at is None
            ]
            if not pending_events:
                break

            for event in pending_events:
                event.processing_started_at = datetime.now(timezone.utc)
                await self.session.flush()

                try:
                    await run_local_subscribers(event, self.session)
                except Exception as exc:
                    event.failure_count += 1
                    event.processing_error = str(exc)[:500]
                    event.processing_started_at = None
                    logger.exception("Failed processing event %s", event.id)
                else:
                    event.processed_at = datetime.now(timezone.utc)
                    event.processing_started_at = None
                    event.processing_error = None

                processed_count += 1
                if processed_count >= limit:
                    break

            await self.session.commit()
            cycles += 1

        return processed_count
