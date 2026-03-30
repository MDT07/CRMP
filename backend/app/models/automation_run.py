from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import UUIDPrimaryKeyMixin


class AutomationRuleRun(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "automation_rule_runs"

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    rule_id: Mapped[UUID] = mapped_column(ForeignKey("automation_rules.id"), nullable=False)
    source_event_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("events.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="success")
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="automation_rule_runs")
    rule: Mapped["AutomationRule"] = relationship(back_populates="runs")
    source_event: Mapped[Optional["Event"]] = relationship()
