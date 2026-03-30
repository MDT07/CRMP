from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import JSON, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    industry: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    size: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    extra_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    users: Mapped[list["User"]] = relationship(back_populates="organization")
    companies: Mapped[list["Company"]] = relationship(back_populates="organization")
    contacts: Mapped[list["Contact"]] = relationship(back_populates="organization")
    deals: Mapped[list["Deal"]] = relationship(back_populates="organization")
    projects: Mapped[list["Project"]] = relationship(back_populates="organization")
    messages: Mapped[list["Message"]] = relationship(back_populates="organization")
    tasks: Mapped[list["Task"]] = relationship(back_populates="organization")
    events: Mapped[list["Event"]] = relationship(back_populates="organization")
    api_keys: Mapped[list["OrganizationAPIKey"]] = relationship(back_populates="organization")
    automation_rules: Mapped[list["AutomationRule"]] = relationship(back_populates="organization")
    automation_rule_runs: Mapped[list["AutomationRuleRun"]] = relationship(
        back_populates="organization"
    )
