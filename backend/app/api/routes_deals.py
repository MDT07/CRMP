from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import DealsAccessDep, PaginationDep, SessionDep
from app.schemas.deal import DealCreate, DealRead, DealStageUpdate, DealUpdate
from app.services.deal_service import DealService

router = APIRouter(prefix="/deals", tags=["deals"])


@router.get("/", response_model=list[DealRead])
async def list_deals(
    session: SessionDep,
    access: DealsAccessDep,
    pagination: PaginationDep,
) -> list[DealRead]:
    deals = await DealService(session).list_deals(
        access.organization_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return [DealRead.model_validate(deal) for deal in deals]


@router.post("/", response_model=DealRead, status_code=status.HTTP_201_CREATED)
async def create_deal(
    payload: DealCreate,
    session: SessionDep,
    access: DealsAccessDep,
) -> DealRead:
    deal = await DealService(session).create_deal(access.organization_id, payload)
    return DealRead.model_validate(deal)


@router.get("/{deal_id}", response_model=DealRead)
async def get_deal(
    deal_id: UUID,
    session: SessionDep,
    access: DealsAccessDep,
) -> DealRead:
    deal = await DealService(session).get_deal(access.organization_id, deal_id)
    return DealRead.model_validate(deal)


@router.patch("/{deal_id}", response_model=DealRead)
async def update_deal(
    deal_id: UUID,
    payload: DealUpdate,
    session: SessionDep,
    access: DealsAccessDep,
) -> DealRead:
    deal = await DealService(session).update_deal(
        access.organization_id,
        deal_id,
        payload,
    )
    return DealRead.model_validate(deal)


@router.post("/{deal_id}/stage", response_model=DealRead)
async def update_deal_stage(
    deal_id: UUID,
    payload: DealStageUpdate,
    session: SessionDep,
    access: DealsAccessDep,
) -> DealRead:
    deal = await DealService(session).update_stage(
        access.organization_id,
        deal_id,
        payload,
    )
    return DealRead.model_validate(deal)
