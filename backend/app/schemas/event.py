from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import EventSource


class EventRead(BaseModel):
    id: UUID
    organization_id: Optional[UUID] = None
    event_type: str
    entity_type: str
    entity_id: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    source: EventSource
    created_at: datetime
    processed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
