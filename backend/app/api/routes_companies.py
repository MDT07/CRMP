from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import ContactsAccessDep, PaginationDep, SessionDep
from app.schemas.company import CompanyCreate, CompanyRead, CompanyUpdate
from app.services.company_service import CompanyService

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/", response_model=list[CompanyRead])
async def list_companies(
    session: SessionDep,
    access: ContactsAccessDep,
    pagination: PaginationDep,
) -> list[CompanyRead]:
    companies = await CompanyService(session).list_companies(
        access.organization_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return [CompanyRead.model_validate(company) for company in companies]


@router.post("/", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
async def create_company(
    payload: CompanyCreate,
    session: SessionDep,
    access: ContactsAccessDep,
) -> CompanyRead:
    company = await CompanyService(session).create_company(access.organization_id, payload)
    return CompanyRead.model_validate(company)


@router.get("/{company_id}", response_model=CompanyRead)
async def get_company(
    company_id: UUID,
    session: SessionDep,
    access: ContactsAccessDep,
) -> CompanyRead:
    company = await CompanyService(session).get_company(access.organization_id, company_id)
    return CompanyRead.model_validate(company)


@router.patch("/{company_id}", response_model=CompanyRead)
async def update_company(
    company_id: UUID,
    payload: CompanyUpdate,
    session: SessionDep,
    access: ContactsAccessDep,
) -> CompanyRead:
    company = await CompanyService(session).update_company(
        access.organization_id,
        company_id,
        payload,
    )
    return CompanyRead.model_validate(company)
