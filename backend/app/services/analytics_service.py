from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.deal import Deal
from app.models.enums import ContactStatus, DealStage, TaskStatus
from app.models.event import Event
from app.models.message import Message
from app.models.task import Task
from app.models.user import User
from app.schemas.analytics import (
    ChannelMixPoint,
    DashboardMetrics,
    DashboardOverview,
    GrowthPoint,
    PipelineStagePoint,
    RepPerformancePoint,
)


class AnalyticsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_dashboard_overview(self, organization_id: UUID) -> DashboardOverview:
        total_revenue = await self.session.scalar(
            select(func.coalesce(func.sum(Deal.amount), 0))
            .where(Deal.organization_id == organization_id)
            .where(Deal.pipeline_stage == DealStage.closed_won)
        )
        active_clients = await self.session.scalar(
            select(func.count(Contact.id))
            .where(Contact.organization_id == organization_id)
            .where(Contact.status != ContactStatus.inactive)
        )
        deals_closed = await self.session.scalar(
            select(func.count(Deal.id))
            .where(Deal.organization_id == organization_id)
            .where(Deal.pipeline_stage == DealStage.closed_won)
        )
        total_deals = await self.session.scalar(
            select(func.count(Deal.id)).where(Deal.organization_id == organization_id)
        )

        revenue_value = float(total_revenue or Decimal("0"))
        closed_value = int(deals_closed or 0)
        total_deals_value = int(total_deals or 0)
        conversion_rate = (
            round((closed_value / total_deals_value) * 100, 2) if total_deals_value else 0.0
        )

        metrics = DashboardMetrics(
            total_revenue=revenue_value,
            active_clients=int(active_clients or 0),
            deals_closed=closed_value,
            conversion_rate=conversion_rate,
        )
        growth = await self.get_growth_series(organization_id)
        return DashboardOverview(metrics=metrics, growth=growth)

    async def get_growth_series(self, organization_id: UUID, periods: int = 8) -> list[GrowthPoint]:
        today = date.today()
        start_date = today - timedelta(weeks=periods - 1)

        deals = list(
            (
                await self.session.scalars(
                    select(Deal).where(Deal.organization_id == organization_id)
                )
            ).all()
        )
        contacts = list(
            (
                await self.session.scalars(
                    select(Contact).where(Contact.organization_id == organization_id)
                )
            ).all()
        )

        growth_map: dict[date, GrowthPoint] = {}
        for index in range(periods):
            bucket_date = start_date + timedelta(weeks=index)
            label = bucket_date.strftime("%b %d")
            growth_map[bucket_date] = GrowthPoint(label=label)

        for deal in deals:
            bucket_date = deal.created_at.date() - timedelta(days=deal.created_at.date().weekday())
            if bucket_date < start_date:
                continue
            growth_map.setdefault(bucket_date, GrowthPoint(label=bucket_date.strftime("%b %d")))
            if deal.pipeline_stage == DealStage.closed_won:
                growth_map[bucket_date].revenue += float(deal.amount)
                growth_map[bucket_date].deals_closed += 1

        for contact in contacts:
            contact_date = contact.created_at.date()
            bucket_date = contact_date - timedelta(days=contact_date.weekday())
            if bucket_date < start_date:
                continue
            growth_map.setdefault(bucket_date, GrowthPoint(label=bucket_date.strftime("%b %d")))
            growth_map[bucket_date].leads_created += 1

        return [growth_map[bucket_date] for bucket_date in sorted(growth_map.keys())]

    async def ingest_event(self, event: Event) -> None:
        _ = event
        # Placeholder for ClickHouse or rollup updates in later phases.

    async def get_automation_health(self, organization_id: UUID) -> dict[str, int]:
        overdue_tasks = await self.session.scalar(
            select(func.count(Task.id))
            .where(Task.organization_id == organization_id)
            .where(Task.status.in_([TaskStatus.open, TaskStatus.in_progress]))
        )
        return {"overdue_tasks": int(overdue_tasks or 0)}

    async def get_pipeline_breakdown(self, organization_id: UUID) -> list[PipelineStagePoint]:
        rows = (
            await self.session.execute(
                select(
                    Deal.pipeline_stage,
                    func.count(Deal.id),
                    func.coalesce(func.sum(Deal.amount), 0),
                )
                .where(Deal.organization_id == organization_id)
                .group_by(Deal.pipeline_stage)
            )
        ).all()
        by_stage = {
            stage.value if hasattr(stage, "value") else str(stage): PipelineStagePoint(
                stage=stage.value if hasattr(stage, "value") else str(stage),
                count=int(count_value or 0),
                value=float(amount or Decimal("0")),
            )
            for stage, count_value, amount in rows
        }

        ordered_stages = [
            DealStage.lead.value,
            DealStage.qualified.value,
            DealStage.proposal.value,
            DealStage.negotiation.value,
            DealStage.closed_won.value,
            DealStage.closed_lost.value,
        ]
        return [
            by_stage.get(stage, PipelineStagePoint(stage=stage, count=0, value=0.0))
            for stage in ordered_stages
        ]

    async def get_channel_mix(self, organization_id: UUID) -> list[ChannelMixPoint]:
        rows = (
            await self.session.execute(
                select(
                    Message.channel,
                    Message.direction,
                    func.count(Message.id),
                )
                .where(Message.organization_id == organization_id)
                .group_by(Message.channel, Message.direction)
            )
        ).all()

        channel_map: dict[str, ChannelMixPoint] = {}
        for channel, direction, count_value in rows:
            channel_key = channel.value if hasattr(channel, "value") else str(channel)
            point = channel_map.setdefault(
                channel_key,
                ChannelMixPoint(channel=channel_key),
            )
            if (direction.value if hasattr(direction, "value") else str(direction)) == "inbound":
                point.inbound_count += int(count_value or 0)
            else:
                point.outbound_count += int(count_value or 0)
            point.total_count += int(count_value or 0)

        return sorted(channel_map.values(), key=lambda point: point.total_count, reverse=True)

    async def get_rep_performance(self, organization_id: UUID) -> list[RepPerformancePoint]:
        users = list(
            (
                await self.session.scalars(
                    select(User)
                    .where(User.organization_id == organization_id)
                    .order_by(User.name.asc())
                )
            ).all()
        )

        deal_rows = (
            await self.session.execute(
                select(
                    Deal.owner_user_id,
                    func.sum(
                        case(
                            (Deal.pipeline_stage == DealStage.closed_won, 1),
                            else_=0,
                        )
                    ),
                    func.sum(
                        case(
                            (
                                Deal.pipeline_stage.in_(
                                    [
                                        DealStage.lead,
                                        DealStage.qualified,
                                        DealStage.proposal,
                                        DealStage.negotiation,
                                    ]
                                ),
                                1,
                            ),
                            else_=0,
                        )
                    ),
                    func.coalesce(
                        func.sum(
                            case(
                                (Deal.pipeline_stage == DealStage.closed_won, Deal.amount),
                                else_=0,
                            )
                        ),
                        0,
                    ),
                )
                .where(Deal.organization_id == organization_id)
                .group_by(Deal.owner_user_id)
            )
        ).all()
        deals_by_owner: dict[UUID, tuple[int, int, float]] = {}
        for owner_id, won_count, open_count, won_revenue in deal_rows:
            if owner_id is None:
                continue
            deals_by_owner[owner_id] = (
                int(won_count or 0),
                int(open_count or 0),
                float(won_revenue or Decimal("0")),
            )

        task_rows = (
            await self.session.execute(
                select(
                    Task.assignee_id,
                    func.count(Task.id),
                )
                .where(Task.organization_id == organization_id)
                .where(Task.status.in_([TaskStatus.open, TaskStatus.in_progress]))
                .group_by(Task.assignee_id)
            )
        ).all()
        tasks_by_assignee: dict[UUID, int] = {}
        for assignee_id, open_tasks in task_rows:
            if assignee_id is None:
                continue
            tasks_by_assignee[assignee_id] = int(open_tasks or 0)

        points: list[RepPerformancePoint] = []
        for user in users:
            won_deals, open_deals, won_revenue = deals_by_owner.get(user.id, (0, 0, 0.0))
            points.append(
                RepPerformancePoint(
                    user_id=user.id,
                    name=user.name,
                    open_deals=open_deals,
                    won_deals=won_deals,
                    won_revenue=won_revenue,
                    open_tasks=tasks_by_assignee.get(user.id, 0),
                )
            )

        points.sort(key=lambda point: (point.won_revenue, point.won_deals), reverse=True)
        return points
