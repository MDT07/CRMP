from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import InboxAccessDep, PaginationDep, SessionDep
from app.schemas.message import MessageCreate, MessageRead
from app.services.message_service import MessageService

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/", response_model=list[MessageRead])
async def list_messages(
    session: SessionDep,
    access: InboxAccessDep,
    pagination: PaginationDep,
) -> list[MessageRead]:
    messages = await MessageService(session).list_messages(
        access.organization_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return [MessageRead.model_validate(message) for message in messages]


@router.post("/", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
async def create_message(
    payload: MessageCreate,
    session: SessionDep,
    access: InboxAccessDep,
) -> MessageRead:
    message = await MessageService(session).create_message(access.organization_id, payload)
    return MessageRead.model_validate(message)


@router.get("/{message_id}", response_model=MessageRead)
async def get_message(
    message_id: UUID,
    session: SessionDep,
    access: InboxAccessDep,
) -> MessageRead:
    message = await MessageService(session).get_message(access.organization_id, message_id)
    return MessageRead.model_validate(message)
