from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyUpdate


class CompanyService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_companies(
        self,
        organization_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> list[Company]:
        result = await self.session.scalars(
            select(Company)
            .where(Company.organization_id == organization_id)
            .order_by(Company.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.all())

    async def create_company(self, organization_id: UUID, payload: CompanyCreate) -> Company:
        company = Company(organization_id=organization_id, **payload.model_dump())
        self.session.add(company)
        await self.session.commit()
        await self.session.refresh(company)
        return company

    async def get_company(self, organization_id: UUID, company_id: UUID) -> Company:
        company = await self.session.scalar(
            select(Company)
            .where(Company.organization_id == organization_id)
            .where(Company.id == company_id)
        )
        if company is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found.")
        return company

    async def update_company(
        self,
        organization_id: UUID,
        company_id: UUID,
        payload: CompanyUpdate,
    ) -> Company:
        company = await self.get_company(organization_id, company_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(company, field, value)
        await self.session.commit()
        await self.session.refresh(company)
        return company
