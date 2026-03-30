from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import AnalyticsAccessDep, SessionDep
from app.schemas.analytics import (
    ChannelMixPoint,
    DashboardOverview,
    GrowthPoint,
    PipelineStagePoint,
    RepPerformancePoint,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardOverview)
async def dashboard(session: SessionDep, access: AnalyticsAccessDep) -> DashboardOverview:
    return await AnalyticsService(session).get_dashboard_overview(access.organization_id)


@router.get("/growth", response_model=list[GrowthPoint])
async def growth(session: SessionDep, access: AnalyticsAccessDep) -> list[GrowthPoint]:
    return await AnalyticsService(session).get_growth_series(access.organization_id)


@router.get("/pipeline", response_model=list[PipelineStagePoint])
async def pipeline(session: SessionDep, access: AnalyticsAccessDep) -> list[PipelineStagePoint]:
    return await AnalyticsService(session).get_pipeline_breakdown(access.organization_id)


@router.get("/channels", response_model=list[ChannelMixPoint])
async def channels(session: SessionDep, access: AnalyticsAccessDep) -> list[ChannelMixPoint]:
    return await AnalyticsService(session).get_channel_mix(access.organization_id)


@router.get("/reps", response_model=list[RepPerformancePoint])
async def reps(session: SessionDep, access: AnalyticsAccessDep) -> list[RepPerformancePoint]:
    return await AnalyticsService(session).get_rep_performance(access.organization_id)
