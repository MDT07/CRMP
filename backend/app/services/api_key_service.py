from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import (
    build_api_key_secret,
    hash_api_key_secret,
    mask_api_key_secret,
)
from app.models.organization_api_key import OrganizationAPIKey
from app.models.user import User
from app.schemas.api_key import (
    OrganizationAPIKeyCreate,
    OrganizationAPIKeyCreateResponse,
    OrganizationAPIKeyRead,
)


class APIKeyService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_keys(self, organization_id: UUID) -> list[OrganizationAPIKeyRead]:
        keys = await self.session.scalars(
            select(OrganizationAPIKey)
            .options(selectinload(OrganizationAPIKey.created_by))
            .where(OrganizationAPIKey.organization_id == organization_id)
            .order_by(OrganizationAPIKey.created_at.desc())
        )
        return [self._serialize_key(record) for record in keys.all()]

    async def create_key(
        self,
        organization_id: UUID,
        actor: User,
        payload: OrganizationAPIKeyCreate,
    ) -> OrganizationAPIKeyCreateResponse:
        secret = build_api_key_secret(payload.scope)
        api_key = OrganizationAPIKey(
            organization_id=organization_id,
            created_by_user_id=actor.id,
            name=payload.name or self._default_name(payload.scope),
            scope=payload.scope,
            modules=list(payload.modules),
            status="active",
            token_hash=hash_api_key_secret(secret),
            masked_token=mask_api_key_secret(secret),
        )
        self.session.add(api_key)
        await self.session.commit()
        api_key = await self._get_key(organization_id, api_key.id)
        return OrganizationAPIKeyCreateResponse(
            api_key=self._serialize_key(api_key),
            secret=secret,
        )

    async def revoke_key(
        self,
        organization_id: UUID,
        api_key_id: UUID,
        actor: User,
    ) -> OrganizationAPIKeyRead:
        api_key = await self._get_key(organization_id, api_key_id)
        if api_key.status != "revoked":
            api_key.status = "revoked"
            api_key.revoked_by_user_id = actor.id
            api_key.revoked_at = datetime.now(timezone.utc)
            await self.session.commit()
            api_key = await self._get_key(organization_id, api_key.id)
        return self._serialize_key(api_key)

    async def _get_key(
        self,
        organization_id: UUID,
        api_key_id: UUID,
    ) -> OrganizationAPIKey:
        api_key = await self.session.scalar(
            select(OrganizationAPIKey)
            .options(selectinload(OrganizationAPIKey.created_by))
            .where(OrganizationAPIKey.id == api_key_id)
            .where(OrganizationAPIKey.organization_id == organization_id)
        )
        if api_key is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found.",
            )
        return api_key

    @staticmethod
    def _default_name(scope: str) -> str:
        return {
            "server": "Server integration",
            "automation": "Automation worker",
            "public": "Public embed",
        }.get(scope, "Workspace API key")

    @staticmethod
    def _serialize_key(record: OrganizationAPIKey) -> OrganizationAPIKeyRead:
        return OrganizationAPIKeyRead(
            id=record.id,
            created_at=record.created_at,
            updated_at=record.updated_at,
            organization_id=record.organization_id,
            created_by_user_id=record.created_by_user_id,
            revoked_by_user_id=record.revoked_by_user_id,
            name=record.name,
            scope=record.scope,
            modules=list(record.modules or []),
            status=record.status,
            prefix=record.scope,
            masked_token=record.masked_token,
            created_by_name=record.created_by.name if record.created_by else None,
            last_used_at=record.last_used_at,
            revoked_at=record.revoked_at,
        )
