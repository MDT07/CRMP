from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.dispatcher import EventDispatcher
from app.events.event_types import EventTypes
from app.models.deal import Deal
from app.schemas.deal import DealCreate, DealStageUpdate, DealUpdate
from app.services.reference_guard import OrganizationReferenceGuard


class DealService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_deals(
        self,
        organization_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> list[Deal]:
        result = await self.session.scalars(
            select(Deal)
            .where(Deal.organization_id == organization_id)
            .order_by(Deal.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.all())

    async def create_deal(self, organization_id: UUID, payload: DealCreate) -> Deal:
        guard = OrganizationReferenceGuard(self.session)
        await guard.ensure_contact(organization_id, payload.contact_id, field_name="contact_id")
        await guard.ensure_user(organization_id, payload.owner_user_id, field_name="owner_user_id")

        deal = Deal(organization_id=organization_id, **payload.model_dump())
        self.session.add(deal)
        await self.session.flush()
        dispatcher = EventDispatcher(self.session)
        await dispatcher.publish(
            organization_id=organization_id,
            event_type=EventTypes.DEAL_CREATED,
            entity_type="deal",
            entity_id=str(deal.id),
            payload={
                "deal_id": str(deal.id),
                "contact_id": str(deal.contact_id),
                "pipeline_stage": deal.pipeline_stage.value,
                "amount": float(deal.amount),
            },
        )
        await self.session.commit()
        await self.session.refresh(deal)
        await dispatcher.process_pending_events(limit=100)
        return deal

    async def get_deal(self, organization_id: UUID, deal_id: UUID) -> Deal:
        deal = await self.session.scalar(
            select(Deal)
            .where(Deal.organization_id == organization_id)
            .where(Deal.id == deal_id)
        )
        if deal is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found.")
        return deal

    async def update_deal(
        self,
        organization_id: UUID,
        deal_id: UUID,
        payload: DealUpdate,
        *,
        commit: bool = True,
    ) -> Deal:
        deal = await self.get_deal(organization_id, deal_id)
        previous_stage = deal.pipeline_stage
        updates = payload.model_dump(exclude_unset=True)
        guard = OrganizationReferenceGuard(self.session)

        if "contact_id" in updates:
            if updates["contact_id"] is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="`contact_id` cannot be null for a deal.",
                )
            await guard.ensure_contact(
                organization_id,
                updates["contact_id"],
                field_name="contact_id",
            )

        if "owner_user_id" in updates and updates["owner_user_id"] is not None:
            await guard.ensure_user(
                organization_id,
                updates["owner_user_id"],
                field_name="owner_user_id",
            )

        for field, value in updates.items():
            setattr(deal, field, value)

        if deal.pipeline_stage != previous_stage:
            await EventDispatcher(self.session).publish(
                organization_id=organization_id,
                event_type=EventTypes.DEAL_STAGE_CHANGED,
                entity_type="deal",
                entity_id=str(deal.id),
                payload={
                    "deal_id": str(deal.id),
                    "contact_id": str(deal.contact_id),
                    "previous_stage": previous_stage.value,
                    "pipeline_stage": deal.pipeline_stage.value,
                    "probability": deal.probability,
                },
            )

        if commit:
            await self.session.commit()
            await self.session.refresh(deal)
            await EventDispatcher(self.session).process_pending_events(limit=100)
        else:
            await self.session.flush()
        return deal

    async def update_stage(
        self,
        organization_id: UUID,
        deal_id: UUID,
        payload: DealStageUpdate,
        *,
        commit: bool = True,
    ) -> Deal:
        deal = await self.get_deal(organization_id, deal_id)
        previous_stage = deal.pipeline_stage
        deal.pipeline_stage = payload.pipeline_stage
        if payload.probability is not None:
            deal.probability = payload.probability

        await EventDispatcher(self.session).publish(
            organization_id=organization_id,
            event_type=EventTypes.DEAL_STAGE_CHANGED,
            entity_type="deal",
            entity_id=str(deal.id),
            payload={
                "deal_id": str(deal.id),
                "contact_id": str(deal.contact_id),
                "previous_stage": previous_stage.value,
                "pipeline_stage": deal.pipeline_stage.value,
                "probability": deal.probability,
            },
        )
        if commit:
            await self.session.commit()
            await self.session.refresh(deal)
            await EventDispatcher(self.session).process_pending_events(limit=100)
        else:
            await self.session.flush()
        return deal
