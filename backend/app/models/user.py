from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import UserRole
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, native_enum=False),
        nullable=False,
        default=UserRole.rep,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    organization: Mapped["Organization"] = relationship(back_populates="users")
    owned_contacts: Mapped[list["Contact"]] = relationship(back_populates="owner")
    owned_deals: Mapped[list["Deal"]] = relationship(back_populates="owner")
    authored_messages: Mapped[list["Message"]] = relationship(back_populates="author")
    assigned_tasks: Mapped[list["Task"]] = relationship(back_populates="assignee")
    created_api_keys: Mapped[list["OrganizationAPIKey"]] = relationship(
        foreign_keys="[OrganizationAPIKey.created_by_user_id]",
        back_populates="created_by",
    )
    revoked_api_keys: Mapped[list["OrganizationAPIKey"]] = relationship(
        foreign_keys="[OrganizationAPIKey.revoked_by_user_id]",
        back_populates="revoked_by",
    )
