from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class AIActionExecution(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_action_executions"

    proposal_id: Mapped[UUID] = mapped_column(
        ForeignKey("ai_action_proposals.id"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    executed_by_user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
