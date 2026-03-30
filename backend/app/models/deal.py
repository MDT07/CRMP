from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import DealStage
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Deal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "deals"

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    contact_id: Mapped[UUID] = mapped_column(ForeignKey("contacts.id"), nullable=False)
    owner_user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    pipeline_stage: Mapped[DealStage] = mapped_column(
        SqlEnum(DealStage, native_enum=False),
        nullable=False,
        default=DealStage.lead,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    probability: Mapped[float] = mapped_column(nullable=False, default=0.0)
    expected_close_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="deals")
    contact: Mapped["Contact"] = relationship(back_populates="deals")
    owner: Mapped[Optional["User"]] = relationship(back_populates="owned_deals")
    messages: Mapped[list["Message"]] = relationship(back_populates="deal")
    tasks: Mapped[list["Task"]] = relationship(back_populates="deal")
    project: Mapped[Optional["Project"]] = relationship(back_populates="deal")
