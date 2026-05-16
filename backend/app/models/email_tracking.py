"""Email Tracking model."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class EmailTracking(Base, TimestampMixin):
    __tablename__ = "email_tracking"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    message_id: Mapped[UUID] = mapped_column(ForeignKey("email_messages.id"), nullable=False)
    tracking_type: Mapped[str] = mapped_column(String(50), nullable=False)
    was_opened: Mapped[bool] = mapped_column(Boolean, default=False)
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    open_count: Mapped[int] = mapped_column(default=0)
    ip_address: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
