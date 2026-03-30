from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import DealStage
from app.schemas.common import TimestampedRead


class DealCreate(BaseModel):
    contact_id: UUID
    owner_user_id: Optional[UUID] = None
    title: str = Field(min_length=2, max_length=255)
    pipeline_stage: DealStage = DealStage.lead
    amount: Decimal = Field(default=Decimal("0"))
    currency: str = Field(default="USD", min_length=3, max_length=3)
    probability: float = Field(default=0, ge=0, le=100)
    expected_close_date: Optional[date] = None
    source: Optional[str] = None
    description: Optional[str] = None


class DealUpdate(BaseModel):
    contact_id: Optional[UUID] = None
    owner_user_id: Optional[UUID] = None
    title: Optional[str] = Field(default=None, min_length=2, max_length=255)
    pipeline_stage: Optional[DealStage] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    probability: Optional[float] = Field(default=None, ge=0, le=100)
    expected_close_date: Optional[date] = None
    source: Optional[str] = None
    description: Optional[str] = None


class DealStageUpdate(BaseModel):
    pipeline_stage: DealStage
    probability: Optional[float] = Field(default=None, ge=0, le=100)


class DealRead(TimestampedRead):
    organization_id: UUID
    contact_id: UUID
    owner_user_id: Optional[UUID] = None
    title: str
    pipeline_stage: DealStage
    amount: Decimal
    currency: str
    probability: float
    expected_close_date: Optional[date] = None
    source: Optional[str] = None
    description: Optional[str] = None
