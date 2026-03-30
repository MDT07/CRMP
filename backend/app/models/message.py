from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy import JSON, Float, ForeignKey, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import MessageChannel, MessageDirection
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Message(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "messages"

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    deal_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("deals.id"), nullable=True)
    project_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("projects.id"), nullable=True)
    contact_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("contacts.id"), nullable=True)
    author_user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    direction: Mapped[MessageDirection] = mapped_column(
        SqlEnum(MessageDirection, native_enum=False),
        nullable=False,
    )
    channel: Mapped[MessageChannel] = mapped_column(
        SqlEnum(MessageChannel, native_enum=False),
        nullable=False,
        default=MessageChannel.email,
    )
    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    external_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    payload_meta: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    ai_lead_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_intent: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    ai_priority: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ai_sentiment: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_product_relevance: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="messages")
    deal: Mapped[Optional["Deal"]] = relationship(back_populates="messages")
    project: Mapped[Optional["Project"]] = relationship(back_populates="messages")
    contact: Mapped[Optional["Contact"]] = relationship(back_populates="messages")
    author: Mapped[Optional["User"]] = relationship(back_populates="authored_messages")
