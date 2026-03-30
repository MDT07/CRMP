from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.dispatcher import EventDispatcher
from app.events.event_types import EventTypes
from app.models.deal import Deal
from app.models.enums import DealStage
from app.models.project import Project
from app.schemas.project import ProjectConvertFromDeal, ProjectCreate, ProjectUpdate
from app.services.reference_guard import OrganizationReferenceGuard


class ProjectService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.guard = OrganizationReferenceGuard(session)

    async def list_projects(
        self,
        organization_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> list[Project]:
        result = await self.session.scalars(
            select(Project)
            .where(Project.organization_id == organization_id)
            .order_by(Project.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.all())

    async def get_project(self, organization_id: UUID, project_id: UUID) -> Project:
        project = await self.session.scalar(
            select(Project)
            .where(Project.organization_id == organization_id)
            .where(Project.id == project_id)
        )
        if project is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
        return project

    async def create_project(self, organization_id: UUID, payload: ProjectCreate) -> Project:
        deal = await self._ensure_convertible_deal(organization_id, payload.deal_id)
        await self.guard.ensure_user(
            organization_id,
            payload.owner_user_id,
            field_name="owner_user_id",
        )
        await self._ensure_no_existing_project(organization_id, payload.deal_id)

        project = Project(
            organization_id=organization_id,
            deal_id=payload.deal_id,
            owner_user_id=payload.owner_user_id or deal.owner_user_id,
            name=payload.name,
            status=payload.status,
            kickoff_date=payload.kickoff_date,
            target_end_date=payload.target_end_date,
            notes=payload.notes,
        )
        self.session.add(project)
        await self.session.flush()

        dispatcher = EventDispatcher(self.session)
        await dispatcher.publish(
            organization_id=organization_id,
            event_type=EventTypes.PROJECT_CREATED,
            entity_type="project",
            entity_id=str(project.id),
            payload={
                "project_id": str(project.id),
                "deal_id": str(project.deal_id),
                "status": project.status.value,
            },
        )

        await self.session.commit()
        await self.session.refresh(project)
        await dispatcher.process_pending_events(limit=100)
        return project

    async def convert_from_deal(
        self,
        organization_id: UUID,
        deal_id: UUID,
        payload: ProjectConvertFromDeal,
    ) -> Project:
        deal = await self._ensure_convertible_deal(organization_id, deal_id)
        existing = await self._find_project_by_deal(organization_id, deal_id)
        if existing is not None:
            return existing

        await self.guard.ensure_user(
            organization_id,
            payload.owner_user_id,
            field_name="owner_user_id",
        )

        create_payload = ProjectCreate(
            deal_id=deal.id,
            owner_user_id=payload.owner_user_id or deal.owner_user_id,
            name=payload.name or f"{deal.title} - Delivery",
            kickoff_date=payload.kickoff_date,
            target_end_date=payload.target_end_date,
            notes=payload.notes,
        )
        return await self.create_project(organization_id, create_payload)

    async def update_project(
        self,
        organization_id: UUID,
        project_id: UUID,
        payload: ProjectUpdate,
    ) -> Project:
        project = await self.get_project(organization_id, project_id)
        updates = payload.model_dump(exclude_unset=True)
        if "owner_user_id" in updates and updates["owner_user_id"] is not None:
            await self.guard.ensure_user(
                organization_id,
                updates["owner_user_id"],
                field_name="owner_user_id",
            )
        for field, value in updates.items():
            setattr(project, field, value)

        await self.session.commit()
        await self.session.refresh(project)
        return project

    async def _ensure_convertible_deal(self, organization_id: UUID, deal_id: UUID) -> Deal:
        deal = await self.guard.ensure_deal(organization_id, deal_id, field_name="deal_id")
        if deal.pipeline_stage != DealStage.closed_won:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only `closed_won` deals can be converted into projects.",
            )
        return deal

    async def _ensure_no_existing_project(self, organization_id: UUID, deal_id: UUID) -> None:
        existing = await self._find_project_by_deal(organization_id, deal_id)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A project already exists for this deal.",
            )

    async def _find_project_by_deal(
        self,
        organization_id: UUID,
        deal_id: UUID,
    ) -> Project | None:
        return await self.session.scalar(
            select(Project)
            .where(Project.organization_id == organization_id)
            .where(Project.deal_id == deal_id)
        )
