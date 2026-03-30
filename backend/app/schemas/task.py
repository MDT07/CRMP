from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import TaskSource, TaskStatus
from app.schemas.common import TimestampedRead


class TaskCreate(BaseModel):
    deal_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    assignee_id: Optional[UUID] = None
    title: str = Field(min_length=2, max_length=255)
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.open
    due_at: Optional[datetime] = None
    source: TaskSource = TaskSource.manual


class TaskUpdate(BaseModel):
    deal_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    assignee_id: Optional[UUID] = None
    title: Optional[str] = Field(default=None, min_length=2, max_length=255)
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    due_at: Optional[datetime] = None
    source: Optional[TaskSource] = None


class TaskRead(TimestampedRead):
    organization_id: UUID
    deal_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    assignee_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    status: TaskStatus
    due_at: Optional[datetime] = None
    source: TaskSource
