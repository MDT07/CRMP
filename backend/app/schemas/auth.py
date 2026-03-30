from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.organization import OrganizationRead, OrganizationSummary


class RegisterRequest(BaseModel):
    organization_name: str = Field(min_length=2, max_length=255)
    organization_slug: str = Field(min_length=2, max_length=120)
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=255)


class UserRead(BaseModel):
    id: UUID
    organization_id: UUID
    email: EmailStr
    name: str
    role: UserRole
    is_active: bool
    organization: Optional[OrganizationSummary] = None

    model_config = {"from_attributes": True}


class AuthenticatedUser(UserRead):
    organization: Optional[OrganizationRead] = None


class SessionResponse(BaseModel):
    token_type: str = "session"
    expires_in: int
    user: AuthenticatedUser


class TokenClaims(BaseModel):
    sub: UUID
    org: UUID
    role: UserRole
