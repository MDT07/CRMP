from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import (
    AuthenticatedUser,
    LoginRequest,
    RegisterRequest,
    SessionResponse,
)


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()

    async def register(self, payload: RegisterRequest) -> User:
        existing_user = await self.session.scalar(
            select(User).where(func.lower(User.email) == payload.email.lower())
        )
        if existing_user is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with that email already exists.",
            )

        existing_org = await self.session.scalar(
            select(Organization).where(
                func.lower(Organization.slug) == payload.organization_slug.lower()
            )
        )
        if existing_org is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That organization slug is already in use.",
            )

        organization = Organization(
            name=payload.organization_name,
            slug=payload.organization_slug,
        )
        user = User(
            organization=organization,
            email=payload.email.lower(),
            hashed_password=hash_password(payload.password),
            name=payload.name,
            role=UserRole.admin,
        )
        self.session.add_all([organization, user])
        await self.session.commit()
        return await self._get_user_with_org(user.id)

    async def authenticate(self, payload: LoginRequest) -> User:
        user = await self.session.scalar(
            select(User).where(func.lower(User.email) == payload.email.lower())
        )
        if user is None or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account is inactive.",
            )
        user.last_login_at = datetime.now(timezone.utc)
        await self.session.commit()
        return await self._get_user_with_org(user.id)

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        return await self._get_user_with_org(user_id)

    async def _get_user_with_org(self, user_id: UUID) -> User | None:
        return await self.session.scalar(
            select(User)
            .options(selectinload(User.organization))
            .where(User.id == user_id)
        )

    def build_session_token(self, user: User) -> str:
        return create_access_token(
            subject=str(user.id),
            organization_id=str(user.organization_id),
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
        )

    def build_session_response(self, user: User) -> SessionResponse:
        return SessionResponse(
            expires_in=self.settings.access_token_expire_minutes * 60,
            user=AuthenticatedUser.model_validate(user),
        )
