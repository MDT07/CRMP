from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy import JSON, Float, ForeignKey, String
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ContactStatus
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Contact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "contacts"

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    owner_user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    company_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("companies.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[ContactStatus] = mapped_column(
        SqlEnum(ContactStatus, native_enum=False),
        nullable=False,
        default=ContactStatus.lead,
    )
    lead_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    extra_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    organization: Mapped["Organization"] = relationship(back_populates="contacts")
    owner: Mapped[Optional["User"]] = relationship(back_populates="owned_contacts")
    company: Mapped[Optional["Company"]] = relationship(back_populates="contacts")
    deals: Mapped[list["Deal"]] = relationship(back_populates="contact")
    messages: Mapped[list["Message"]] = relationship(back_populates="contact")
    tasks: Mapped[list["Task"]] = relationship(back_populates="contact")
