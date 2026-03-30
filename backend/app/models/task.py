from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import TaskSource, TaskStatus
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Task(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tasks"

    organization_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    deal_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("deals.id"), nullable=True)
    project_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("projects.id"), nullable=True)
    contact_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("contacts.id"), nullable=True)
    assignee_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        SqlEnum(TaskStatus, native_enum=False),
        nullable=False,
        default=TaskStatus.open,
    )
    due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[TaskSource] = mapped_column(
        SqlEnum(TaskSource, native_enum=False),
        nullable=False,
        default=TaskSource.manual,
    )

    organization: Mapped["Organization"] = relationship(back_populates="tasks")
    deal: Mapped[Optional["Deal"]] = relationship(back_populates="tasks")
    project: Mapped[Optional["Project"]] = relationship(back_populates="tasks")
    contact: Mapped[Optional["Contact"]] = relationship(back_populates="tasks")
    assignee: Mapped[Optional["User"]] = relationship(back_populates="assigned_tasks")
