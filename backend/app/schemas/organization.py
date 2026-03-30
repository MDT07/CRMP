from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.common import TimestampedRead


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=2, max_length=120)
    industry: Optional[str] = None
    size: Optional[str] = None
    domain: Optional[str] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    slug: Optional[str] = Field(default=None, min_length=2, max_length=120)
    industry: Optional[str] = None
    size: Optional[str] = None
    domain: Optional[str] = None
    extra_data: Optional[dict[str, object]] = None
    is_active: Optional[bool] = None


class OrganizationRead(TimestampedRead):
    name: str
    slug: str
    industry: Optional[str] = None
    size: Optional[str] = None
    domain: Optional[str] = None
    is_active: bool
    extra_data: dict[str, object] = Field(default_factory=dict)


class OrganizationSummary(BaseModel):
    id: UUID
    name: str
    slug: str


class OrganizationMemberRead(TimestampedRead):
    organization_id: UUID
    email: EmailStr
    name: str
    role: UserRole
    is_active: bool
    last_login_at: Optional[datetime] = None


class WorkspaceStats(BaseModel):
    members: int = 0
    companies: int = 0
    contacts: int = 0
    deals: int = 0
    projects: int = 0
    tasks: int = 0
    messages: int = 0


class WorkspaceRead(OrganizationRead):
    stats: WorkspaceStats = Field(default_factory=WorkspaceStats)
    crm_ready: bool = False


class WorkspaceBootstrapResponse(BaseModel):
    seeded: bool
    detail: str
    workspace: WorkspaceRead
