from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import TimestampedRead


class AutomationRuleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: Optional[str] = None
    event_type: str = Field(min_length=2, max_length=120)
    conditions: dict[str, Any] = Field(default_factory=dict)
    actions: list[dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True


class AutomationRuleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    description: Optional[str] = None
    event_type: Optional[str] = Field(default=None, min_length=2, max_length=120)
    conditions: Optional[dict[str, Any]] = None
    actions: Optional[list[dict[str, Any]]] = None
    is_active: Optional[bool] = None


class AutomationRuleRead(TimestampedRead):
    organization_id: UUID
    name: str
    description: Optional[str] = None
    event_type: str
    conditions: dict[str, Any] = Field(default_factory=dict)
    actions: list[dict[str, Any]] = Field(default_factory=list)
    is_active: bool


class AutomationRuleRunRead(BaseModel):
    id: UUID
    organization_id: UUID
    rule_id: UUID
    source_event_id: Optional[UUID] = None
    status: str
    detail: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    executed_at: datetime

    model_config = {"from_attributes": True}
