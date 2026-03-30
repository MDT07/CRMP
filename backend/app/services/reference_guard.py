from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.project import Project
from app.models.user import User


class OrganizationReferenceGuard:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def ensure_user(
        self,
        organization_id: UUID,
        user_id: UUID | None,
        *,
        field_name: str = "user_id",
    ) -> User | None:
        if user_id is None:
            return None
        return await self._ensure_model(
            User,
            organization_id=organization_id,
            entity_id=user_id,
            field_name=field_name,
        )

    async def ensure_company(
        self,
        organization_id: UUID,
        company_id: UUID | None,
        *,
        field_name: str = "company_id",
    ) -> Company | None:
        if company_id is None:
            return None
        return await self._ensure_model(
            Company,
            organization_id=organization_id,
            entity_id=company_id,
            field_name=field_name,
        )

    async def ensure_contact(
        self,
        organization_id: UUID,
        contact_id: UUID | None,
        *,
        field_name: str = "contact_id",
    ) -> Contact | None:
        if contact_id is None:
            return None
        return await self._ensure_model(
            Contact,
            organization_id=organization_id,
            entity_id=contact_id,
            field_name=field_name,
        )

    async def ensure_deal(
        self,
        organization_id: UUID,
        deal_id: UUID | None,
        *,
        field_name: str = "deal_id",
    ) -> Deal | None:
        if deal_id is None:
            return None
        return await self._ensure_model(
            Deal,
            organization_id=organization_id,
            entity_id=deal_id,
            field_name=field_name,
        )

    async def ensure_project(
        self,
        organization_id: UUID,
        project_id: UUID | None,
        *,
        field_name: str = "project_id",
    ) -> Project | None:
        if project_id is None:
            return None
        return await self._ensure_model(
            Project,
            organization_id=organization_id,
            entity_id=project_id,
            field_name=field_name,
        )

    async def _ensure_model(
        self,
        model: Any,
        *,
        organization_id: UUID,
        entity_id: UUID,
        field_name: str,
    ):
        record = await self.session.scalar(
            select(model)
            .where(model.organization_id == organization_id)
            .where(model.id == entity_id)
        )
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"`{field_name}` must reference an entity in the current organization.",
            )
        return record
