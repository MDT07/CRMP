from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation_rule import AutomationRule


class RulesRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_rules(self, organization_id: UUID) -> list[AutomationRule]:
        result = await self.session.scalars(
            select(AutomationRule)
            .where(AutomationRule.organization_id == organization_id)
            .order_by(AutomationRule.created_at.desc())
        )
        return list(result.all())

    async def find_for_event(self, organization_id: UUID, event_type: str) -> list[AutomationRule]:
        result = await self.session.scalars(
            select(AutomationRule)
            .where(AutomationRule.organization_id == organization_id)
            .where(AutomationRule.event_type == event_type)
            .where(AutomationRule.is_active.is_(True))
            .order_by(AutomationRule.created_at.desc())
        )
        return list(result.all())
