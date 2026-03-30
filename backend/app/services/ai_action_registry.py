from __future__ import annotations

from collections.abc import Mapping
from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.enums import MessageDirection, TaskSource, TaskStatus
from app.schemas.automation import (
    AutomationRuleCreate,
    AutomationRuleUpdate,
)
from app.schemas.company import CompanyCreate, CompanyUpdate
from app.schemas.contact import ContactCreate, ContactUpdate
from app.schemas.deal import DealCreate, DealUpdate
from app.schemas.message import MessageCreate
from app.schemas.project import (
    ProjectConvertFromDeal,
    ProjectCreate,
    ProjectUpdate,
)
from app.schemas.task import TaskCreate, TaskUpdate

FORBIDDEN_ACTION_TOKENS = (
    "api_key",
    "auth",
    "session",
    "role",
    "permission",
    "member",
    "user_management",
)


class ActionValidationError(ValueError):
    pass


class AddInternalNoteActionPayload(BaseModel):
    entity_type: str = Field(min_length=2, max_length=80)
    entity_id: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=5000)


class UpdateCompanyActionPayload(CompanyUpdate):
    company_id: UUID


class UpdateContactActionPayload(ContactUpdate):
    contact_id: UUID


class UpdateDealActionPayload(DealUpdate):
    deal_id: UUID


class CreateOutboundMessageActionPayload(MessageCreate):
    direction: MessageDirection = MessageDirection.outbound

    @field_validator("direction")
    @classmethod
    def outbound_only(cls, value: MessageDirection) -> MessageDirection:
        if value != MessageDirection.outbound:
            raise ValueError("AI agent message proposals can only be outbound.")
        return value


class CreateFollowUpTaskActionPayload(TaskCreate):
    status: TaskStatus = TaskStatus.open
    source: TaskSource = TaskSource.automation


class UpdateTaskActionPayload(TaskUpdate):
    task_id: UUID


class UpdateProjectActionPayload(ProjectUpdate):
    project_id: UUID


class ConvertDealToProjectActionPayload(ProjectConvertFromDeal):
    deal_id: UUID


class UpdateAutomationRuleActionPayload(AutomationRuleUpdate):
    rule_id: UUID


class _ProjectCreateActionPayload(ProjectCreate):
    kickoff_date: Optional[date] = None
    target_end_date: Optional[date] = None


class _AutomationRuleCreateActionPayload(AutomationRuleCreate):
    conditions: dict[str, Any] = Field(default_factory=dict)
    actions: list[dict[str, Any]] = Field(default_factory=list)


class _TaskCreateActionPayload(TaskCreate):
    due_at: Optional[datetime] = None


ACTION_PAYLOAD_MODELS: dict[str, type[BaseModel]] = {
    "create_follow_up_task": CreateFollowUpTaskActionPayload,
    "update_contact": UpdateContactActionPayload,
    "update_deal": UpdateDealActionPayload,
    "add_internal_note": AddInternalNoteActionPayload,
    "create_company": CompanyCreate,
    "update_company": UpdateCompanyActionPayload,
    "create_contact": ContactCreate,
    "create_deal": DealCreate,
    "create_message": CreateOutboundMessageActionPayload,
    "create_task": _TaskCreateActionPayload,
    "update_task": UpdateTaskActionPayload,
    "create_project": _ProjectCreateActionPayload,
    "update_project": UpdateProjectActionPayload,
    "convert_deal_to_project": ConvertDealToProjectActionPayload,
    "create_automation_rule": _AutomationRuleCreateActionPayload,
    "update_automation_rule": UpdateAutomationRuleActionPayload,
}

ALLOWED_ACTION_TYPES: tuple[str, ...] = tuple(ACTION_PAYLOAD_MODELS.keys())


def is_forbidden_action_type(action_type: str) -> bool:
    normalized = action_type.strip().lower()
    return any(token in normalized for token in FORBIDDEN_ACTION_TOKENS)


def validate_action_payload(action_type: str, payload: Mapping[str, Any]) -> dict[str, Any]:
    normalized = action_type.strip().lower()
    if not normalized:
        raise ActionValidationError("Missing `action_type`.")
    if is_forbidden_action_type(normalized):
        raise ActionValidationError(f"Action type '{normalized}' is forbidden.")

    payload_model = ACTION_PAYLOAD_MODELS.get(normalized)
    if payload_model is None:
        raise ActionValidationError(f"Action type '{normalized}' is not allowed.")

    try:
        parsed = payload_model.model_validate(dict(payload))
    except Exception as exc:  # pragma: no cover - exact Pydantic error text is not stable.
        raise ActionValidationError(str(exc)) from exc

    return parsed.model_dump(mode="json", exclude_unset=True)


def normalize_action_blueprint(blueprint: Mapping[str, Any]) -> dict[str, Any]:
    action_type = str(blueprint.get("action_type") or "").strip().lower()
    action_payload = blueprint.get("action_payload") or {}
    if not isinstance(action_payload, Mapping):
        raise ActionValidationError("`action_payload` must be an object.")

    normalized_payload = validate_action_payload(action_type, action_payload)
    normalized = dict(blueprint)
    normalized["action_type"] = action_type
    normalized["action_payload"] = normalized_payload
    return normalized


def normalize_action_blueprints(
    blueprints: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    normalized: list[dict[str, Any]] = []
    errors: list[str] = []
    for index, blueprint in enumerate(blueprints):
        try:
            normalized.append(normalize_action_blueprint(blueprint))
        except ActionValidationError as exc:
            errors.append(f"proposal[{index}]: {exc}")
    return normalized, errors
