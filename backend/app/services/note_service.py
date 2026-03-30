from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note


class NoteService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_note(
        self,
        organization_id: UUID,
        *,
        entity_type: str,
        entity_id: str,
        body: str,
        author_user_id: UUID | None = None,
        payload_meta: dict[str, Any] | None = None,
        commit: bool = True,
    ) -> Note:
        note = Note(
            organization_id=organization_id,
            author_user_id=author_user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            body=body,
            payload_meta=payload_meta or {},
        )
        self.session.add(note)
        if commit:
            await self.session.commit()
            await self.session.refresh(note)
        else:
            await self.session.flush()
        return note
