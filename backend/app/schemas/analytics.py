from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class DashboardMetrics(BaseModel):
    total_revenue: float = 0.0
    active_clients: int = 0
    deals_closed: int = 0
    conversion_rate: float = 0.0


class GrowthPoint(BaseModel):
    label: str
    revenue: float = 0.0
    deals_closed: int = 0
    leads_created: int = 0


class DashboardOverview(BaseModel):
    metrics: DashboardMetrics
    growth: list[GrowthPoint] = Field(default_factory=list)


class PipelineStagePoint(BaseModel):
    stage: str
    count: int = 0
    value: float = 0.0


class ChannelMixPoint(BaseModel):
    channel: str
    inbound_count: int = 0
    outbound_count: int = 0
    total_count: int = 0


class RepPerformancePoint(BaseModel):
    user_id: UUID
    name: str
    open_deals: int = 0
    won_deals: int = 0
    won_revenue: float = 0.0
    open_tasks: int = 0
