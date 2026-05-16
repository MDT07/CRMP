"""Email Thread model."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class EmailThread(Base, TimestampMixin):
    __tablename__ = "email_threads"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    account_id: Mapped[UUID] = mapped_column(ForeignKey("email_accounts.id"), nullable=False)
    external_thread_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    subject: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    participants: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
