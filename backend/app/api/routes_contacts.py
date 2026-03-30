from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import ContactsAccessDep, PaginationDep, SessionDep
from app.schemas.contact import ContactCreate, ContactRead, ContactUpdate
from app.services.contact_service import ContactService

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("/", response_model=list[ContactRead])
async def list_contacts(
    session: SessionDep,
    access: ContactsAccessDep,
    pagination: PaginationDep,
) -> list[ContactRead]:
    contacts = await ContactService(session).list_contacts(
        access.organization_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return [ContactRead.model_validate(contact) for contact in contacts]


@router.post("/", response_model=ContactRead, status_code=status.HTTP_201_CREATED)
async def create_contact(
    payload: ContactCreate,
    session: SessionDep,
    access: ContactsAccessDep,
) -> ContactRead:
    contact = await ContactService(session).create_contact(access.organization_id, payload)
    return ContactRead.model_validate(contact)


@router.get("/{contact_id}", response_model=ContactRead)
async def get_contact(
    contact_id: UUID,
    session: SessionDep,
    access: ContactsAccessDep,
) -> ContactRead:
    contact = await ContactService(session).get_contact(access.organization_id, contact_id)
    return ContactRead.model_validate(contact)


@router.patch("/{contact_id}", response_model=ContactRead)
async def update_contact(
    contact_id: UUID,
    payload: ContactUpdate,
    session: SessionDep,
    access: ContactsAccessDep,
) -> ContactRead:
    contact = await ContactService(session).update_contact(
        access.organization_id,
        contact_id,
        payload,
    )
    return ContactRead.model_validate(contact)
