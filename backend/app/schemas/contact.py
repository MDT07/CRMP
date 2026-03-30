from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import ContactStatus
from app.schemas.common import TimestampedRead


class ContactCreate(BaseModel):
    owner_user_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    name: str = Field(min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: ContactStatus = ContactStatus.lead
    tags: list[str] = Field(default_factory=list)
    extra_data: dict[str, object] = Field(default_factory=dict)


class ContactUpdate(BaseModel):
    owner_user_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: Optional[ContactStatus] = None
    lead_score: Optional[float] = Field(default=None, ge=0, le=100)
    tags: Optional[list[str]] = None
    extra_data: Optional[dict[str, object]] = None


class ContactRead(TimestampedRead):
    organization_id: UUID
    owner_user_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: ContactStatus
    lead_score: float
    tags: list[str] = Field(default_factory=list)
    extra_data: dict[str, object] = Field(default_factory=dict)
