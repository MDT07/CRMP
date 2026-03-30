from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import TimestampedRead

APIKeyScope = Literal["server", "public", "automation"]
APIKeyModule = Literal[
    "contacts",
    "deals",
    "inbox",
    "automations",
    "analytics",
    "settings",
]


class OrganizationAPIKeyCreate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    scope: APIKeyScope
    modules: list[APIKeyModule] = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("modules")
    @classmethod
    def dedupe_modules(cls, value: list[APIKeyModule]) -> list[APIKeyModule]:
        deduped: list[APIKeyModule] = []
        for module in value:
            if module not in deduped:
                deduped.append(module)
        if not deduped:
            raise ValueError("At least one module must be selected.")
        return deduped


class OrganizationAPIKeyRead(TimestampedRead):
    organization_id: UUID
    created_by_user_id: UUID
    revoked_by_user_id: Optional[UUID] = None
    name: str
    scope: APIKeyScope
    modules: list[APIKeyModule] = Field(default_factory=list)
    status: str
    prefix: str
    masked_token: str
    created_by_name: Optional[str] = None
    last_used_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None


class OrganizationAPIKeyCreateResponse(BaseModel):
    api_key: OrganizationAPIKeyRead
    secret: str
