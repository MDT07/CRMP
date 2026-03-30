from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ProjectStatus
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    deal_id: Mapped[UUID] = mapped_column(ForeignKey("deals.id"), nullable=False, unique=True)
    owner_user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[ProjectStatus] = mapped_column(
        SqlEnum(ProjectStatus, native_enum=False),
        nullable=False,
        default=ProjectStatus.planned,
    )
    kickoff_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    target_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="projects")
    deal: Mapped["Deal"] = relationship(back_populates="project")
    owner: Mapped[Optional["User"]] = relationship()
    tasks: Mapped[list["Task"]] = relationship(back_populates="project")
    messages: Mapped[list["Message"]] = relationship(back_populates="project")
