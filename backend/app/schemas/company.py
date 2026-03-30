from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import TimestampedRead


class CompanyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    industry: Optional[str] = None
    size: Optional[str] = None
    domain: Optional[str] = None
    extra_data: dict[str, object] = Field(default_factory=dict)


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    industry: Optional[str] = None
    size: Optional[str] = None
    domain: Optional[str] = None
    extra_data: Optional[dict[str, object]] = None


class CompanyRead(TimestampedRead):
    organization_id: UUID
    name: str
    industry: Optional[str] = None
    size: Optional[str] = None
    domain: Optional[str] = None
    extra_data: dict[str, object] = Field(default_factory=dict)
