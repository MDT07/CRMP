from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import MessageChannel, MessageDirection
from app.schemas.common import TimestampedRead


class MessageCreate(BaseModel):
    deal_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    author_user_id: Optional[UUID] = None
    direction: MessageDirection
    channel: MessageChannel = MessageChannel.email
    subject: Optional[str] = Field(default=None, max_length=255)
    body: str = Field(min_length=1)
    external_message_id: Optional[str] = None
    payload_meta: dict[str, object] = Field(default_factory=dict)


class MessageRead(TimestampedRead):
    organization_id: UUID
    deal_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    author_user_id: Optional[UUID] = None
    direction: MessageDirection
    channel: MessageChannel
    subject: Optional[str] = None
    body: str
    external_message_id: Optional[str] = None
    payload_meta: dict[str, object] = Field(default_factory=dict)
    ai_lead_score: Optional[float] = None
    ai_intent: Optional[str] = None
    ai_priority: Optional[str] = None
    ai_sentiment: Optional[float] = None
    ai_product_relevance: Optional[str] = None
