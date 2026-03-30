from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class AIEvalRun(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_eval_runs"

    organization_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
    )
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    suite_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
