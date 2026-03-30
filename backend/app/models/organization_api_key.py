from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class OrganizationAPIKey(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organization_api_keys"

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    revoked_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    scope: Mapped[str] = mapped_column(String(32), nullable=False)
    modules: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active")
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    masked_token: Mapped[str] = mapped_column(String(32), nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="api_keys")
    created_by: Mapped["User"] = relationship(
        foreign_keys=[created_by_user_id],
        back_populates="created_api_keys",
    )
    revoked_by: Mapped[Optional["User"]] = relationship(
        foreign_keys=[revoked_by_user_id],
        back_populates="revoked_api_keys",
    )
