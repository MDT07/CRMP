from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.automation.actions import execute_action
from app.automation.rules_engine import RulesEngine
from app.automation.rules_repository import RulesRepository
from app.events.dispatcher import EventDispatcher
from app.events.event_types import EventTypes
from app.models.automation_rule import AutomationRule
from app.models.automation_run import AutomationRuleRun
from app.models.enums import EventSource
from app.models.event import Event
from app.schemas.automation import AutomationRuleCreate, AutomationRuleUpdate


class AutomationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.rules_repository = RulesRepository(session)
        self.rules_engine = RulesEngine()

    async def list_rules(self, organization_id: UUID) -> list[AutomationRule]:
        return await self.rules_repository.list_rules(organization_id)

    async def create_rule(
        self,
        organization_id: UUID,
        payload: AutomationRuleCreate,
    ) -> AutomationRule:
        rule = AutomationRule(organization_id=organization_id, **payload.model_dump())
        self.session.add(rule)
        await self.session.commit()
        await self.session.refresh(rule)
        return rule

    async def get_rule(self, organization_id: UUID, rule_id: UUID) -> AutomationRule:
        rule = await self.session.scalar(
            select(AutomationRule)
            .where(AutomationRule.organization_id == organization_id)
            .where(AutomationRule.id == rule_id)
        )
        if rule is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found.")
        return rule

    async def update_rule(
        self,
        organization_id: UUID,
        rule_id: UUID,
        payload: AutomationRuleUpdate,
    ) -> AutomationRule:
        rule = await self.get_rule(organization_id, rule_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(rule, field, value)
        await self.session.commit()
        await self.session.refresh(rule)
        return rule

    async def list_rule_runs(
        self,
        organization_id: UUID,
        rule_id: UUID,
        *,
        limit: int = 50,
    ) -> list[AutomationRuleRun]:
        await self.get_rule(organization_id, rule_id)
        runs = await self.session.scalars(
            select(AutomationRuleRun)
            .where(AutomationRuleRun.organization_id == organization_id)
            .where(AutomationRuleRun.rule_id == rule_id)
            .order_by(AutomationRuleRun.executed_at.desc())
            .limit(limit)
        )
        return list(runs.all())

    async def handle_event(self, event: Event) -> None:
        if event.organization_id is None:
            return
        rules = await self.rules_repository.find_for_event(event.organization_id, event.event_type)
        for rule in rules:
            if self.rules_engine.matches(rule, event):
                run = AutomationRuleRun(
                    organization_id=event.organization_id,
                    rule_id=rule.id,
                    source_event_id=event.id,
                    status="success",
                    detail=None,
                    payload={
                        "rule_name": rule.name,
                        "source_event_type": event.event_type,
                        "action_count": len(rule.actions),
                    },
                    executed_at=datetime.now(timezone.utc),
                )

                try:
                    for action in rule.actions:
                        await execute_action(
                            self.session,
                            organization_id=event.organization_id,
                            event=event,
                            action=action,
                        )
                except Exception as exc:
                    run.status = "failed"
                    run.detail = str(exc)[:500]

                self.session.add(run)
                await self.session.commit()

                await EventDispatcher(self.session).publish(
                    organization_id=event.organization_id,
                    event_type=EventTypes.AUTOMATION_RULE_EXECUTED,
                    entity_type="automation_rule",
                    entity_id=str(rule.id),
                    payload={
                        "rule_id": str(rule.id),
                        "run_id": str(run.id),
                        "status": run.status,
                        "source_event_id": str(event.id),
                    },
                    source=EventSource.automation,
                )
