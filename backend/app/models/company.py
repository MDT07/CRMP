from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Company(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "companies"

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    industry: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    size: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    extra_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    organization: Mapped["Organization"] = relationship(back_populates="companies")
    contacts: Mapped[list["Contact"]] = relationship(back_populates="company")
