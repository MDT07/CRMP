from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.dispatcher import EventDispatcher
from app.events.event_types import EventTypes
from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactUpdate
from app.services.reference_guard import OrganizationReferenceGuard


class ContactService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_contacts(
        self,
        organization_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> list[Contact]:
        result = await self.session.scalars(
            select(Contact)
            .where(Contact.organization_id == organization_id)
            .order_by(Contact.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.all())

    async def create_contact(self, organization_id: UUID, payload: ContactCreate) -> Contact:
        guard = OrganizationReferenceGuard(self.session)
        await guard.ensure_user(organization_id, payload.owner_user_id, field_name="owner_user_id")
        await guard.ensure_company(organization_id, payload.company_id, field_name="company_id")

        contact = Contact(organization_id=organization_id, **payload.model_dump())
        self.session.add(contact)
        await self.session.flush()
        dispatcher = EventDispatcher(self.session)
        await dispatcher.publish(
            organization_id=organization_id,
            event_type=EventTypes.CONTACT_CREATED,
            entity_type="contact",
            entity_id=str(contact.id),
            payload={"contact_id": str(contact.id), "status": contact.status.value},
        )
        await self.session.commit()
        await self.session.refresh(contact)
        await dispatcher.process_pending_events(limit=100)
        return contact

    async def get_contact(self, organization_id: UUID, contact_id: UUID) -> Contact:
        contact = await self.session.scalar(
            select(Contact)
            .where(Contact.organization_id == organization_id)
            .where(Contact.id == contact_id)
        )
        if contact is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found.")
        return contact

    async def update_contact(
        self,
        organization_id: UUID,
        contact_id: UUID,
        payload: ContactUpdate,
        *,
        commit: bool = True,
    ) -> Contact:
        contact = await self.get_contact(organization_id, contact_id)
        updates = payload.model_dump(exclude_unset=True)
        guard = OrganizationReferenceGuard(self.session)

        if "owner_user_id" in updates and updates["owner_user_id"] is not None:
            await guard.ensure_user(
                organization_id,
                updates["owner_user_id"],
                field_name="owner_user_id",
            )
        if "company_id" in updates and updates["company_id"] is not None:
            await guard.ensure_company(
                organization_id,
                updates["company_id"],
                field_name="company_id",
            )

        for field, value in updates.items():
            setattr(contact, field, value)
        if commit:
            await self.session.commit()
            await self.session.refresh(contact)
        else:
            await self.session.flush()
        return contact
