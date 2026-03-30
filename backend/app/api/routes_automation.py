from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.dependencies import AutomationsAccessDep, SessionDep
from app.schemas.automation import (
    AutomationRuleCreate,
    AutomationRuleRead,
    AutomationRuleRunRead,
    AutomationRuleUpdate,
)
from app.services.automation_service import AutomationService

router = APIRouter(prefix="/automations", tags=["automation"])


@router.get("/rules", response_model=list[AutomationRuleRead])
async def list_rules(
    session: SessionDep,
    access: AutomationsAccessDep,
) -> list[AutomationRuleRead]:
    rules = await AutomationService(session).list_rules(access.organization_id)
    return [AutomationRuleRead.model_validate(rule) for rule in rules]


@router.post("/rules", response_model=AutomationRuleRead, status_code=status.HTTP_201_CREATED)
async def create_rule(
    payload: AutomationRuleCreate,
    session: SessionDep,
    access: AutomationsAccessDep,
) -> AutomationRuleRead:
    rule = await AutomationService(session).create_rule(access.organization_id, payload)
    return AutomationRuleRead.model_validate(rule)


@router.patch("/rules/{rule_id}", response_model=AutomationRuleRead)
async def update_rule(
    rule_id: UUID,
    payload: AutomationRuleUpdate,
    session: SessionDep,
    access: AutomationsAccessDep,
) -> AutomationRuleRead:
    rule = await AutomationService(session).update_rule(
        access.organization_id,
        rule_id,
        payload,
    )
    return AutomationRuleRead.model_validate(rule)


@router.get("/rules/{rule_id}/runs", response_model=list[AutomationRuleRunRead])
async def list_rule_runs(
    rule_id: UUID,
    session: SessionDep,
    access: AutomationsAccessDep,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[AutomationRuleRunRead]:
    runs = await AutomationService(session).list_rule_runs(
        access.organization_id,
        rule_id,
        limit=limit,
    )
    return [AutomationRuleRunRead.model_validate(run) for run in runs]
