"""Email Message model."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class EmailMessage(Base, TimestampMixin):
    __tablename__ = "email_messages"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    account_id: Mapped[UUID] = mapped_column(ForeignKey("email_accounts.id"), nullable=False)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    thread_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    subject: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    sender: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recipients: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    is_draft: Mapped[bool] = mapped_column(Boolean, default=False)
    folder: Mapped[str] = mapped_column(String(50), default="inbox")
