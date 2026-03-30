from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.dispatcher import EventDispatcher
from app.events.event_types import EventTypes
from app.models.enums import MessageDirection
from app.models.message import Message
from app.schemas.message import MessageCreate
from app.services.reference_guard import OrganizationReferenceGuard


class MessageService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_messages(
        self,
        organization_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> list[Message]:
        result = await self.session.scalars(
            select(Message)
            .where(Message.organization_id == organization_id)
            .order_by(Message.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.all())

    async def create_message(self, organization_id: UUID, payload: MessageCreate) -> Message:
        guard = OrganizationReferenceGuard(self.session)
        contact = await guard.ensure_contact(
            organization_id,
            payload.contact_id,
            field_name="contact_id",
        )
        deal = await guard.ensure_deal(
            organization_id,
            payload.deal_id,
            field_name="deal_id",
        )
        project = await guard.ensure_project(
            organization_id,
            payload.project_id,
            field_name="project_id",
        )
        await guard.ensure_user(
            organization_id,
            payload.author_user_id,
            field_name="author_user_id",
        )

        if deal is not None and contact is not None and deal.contact_id != contact.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="`contact_id` must match the deal's contact when both are provided.",
            )
        if project is not None and deal is not None and project.deal_id != deal.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="`project_id` must belong to the selected `deal_id`.",
            )

        message = Message(organization_id=organization_id, **payload.model_dump())
        self.session.add(message)
        await self.session.flush()

        if message.direction == MessageDirection.inbound:
            await EventDispatcher(self.session).publish(
                organization_id=organization_id,
                event_type=EventTypes.MESSAGE_RECEIVED,
                entity_type="message",
                entity_id=str(message.id),
                payload={
                    "message_id": str(message.id),
                    "contact_id": str(message.contact_id) if message.contact_id else None,
                    "deal_id": str(message.deal_id) if message.deal_id else None,
                    "channel": message.channel.value,
                    "body_length": len(message.body),
                    "has_subject": bool(message.subject),
                },
            )

        await self.session.commit()
        await self.session.refresh(message)
        await EventDispatcher(self.session).process_pending_events(limit=100)
        return message

    async def get_message(self, organization_id: UUID, message_id: UUID) -> Message:
        message = await self.session.scalar(
            select(Message)
            .where(Message.organization_id == organization_id)
            .where(Message.id == message_id)
        )
        if message is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")
        return message
