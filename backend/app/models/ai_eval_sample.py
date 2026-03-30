from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class AIEvalSample(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_eval_samples"

    eval_run_id: Mapped[UUID] = mapped_column(ForeignKey("ai_eval_runs.id"), nullable=False, index=True)
    sample_name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    prompt_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    grounding_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    evidence: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    proposed_actions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    response_excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False)
