from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import ProjectStatus
from app.schemas.common import TimestampedRead


class ProjectCreate(BaseModel):
    deal_id: UUID
    owner_user_id: Optional[UUID] = None
    name: str = Field(min_length=2, max_length=255)
    status: ProjectStatus = ProjectStatus.planned
    kickoff_date: Optional[date] = None
    target_end_date: Optional[date] = None
    notes: Optional[str] = None


class ProjectUpdate(BaseModel):
    owner_user_id: Optional[UUID] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    status: Optional[ProjectStatus] = None
    kickoff_date: Optional[date] = None
    target_end_date: Optional[date] = None
    notes: Optional[str] = None


class ProjectConvertFromDeal(BaseModel):
    owner_user_id: Optional[UUID] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    kickoff_date: Optional[date] = None
    target_end_date: Optional[date] = None
    notes: Optional[str] = None


class ProjectRead(TimestampedRead):
    organization_id: UUID
    deal_id: UUID
    owner_user_id: Optional[UUID] = None
    name: str
    status: ProjectStatus
    kickoff_date: Optional[date] = None
    target_end_date: Optional[date] = None
    notes: Optional[str] = None
