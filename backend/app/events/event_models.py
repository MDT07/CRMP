from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import EventSource


class DomainEvent(BaseModel):
    organization_id: Optional[UUID] = None
    event_type: str
    entity_type: str
    entity_id: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    source: EventSource = EventSource.api
    created_at: datetime
