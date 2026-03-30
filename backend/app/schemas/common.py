from __future__ import annotations

from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TimestampedRead(ORMModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class ListResponse(ORMModel, Generic[T]):
    items: list[T]
    total: int
