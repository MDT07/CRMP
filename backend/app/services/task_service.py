from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.dispatcher import EventDispatcher
from app.events.event_types import EventTypes
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.reference_guard import OrganizationReferenceGuard


class TaskService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_tasks(
        self,
        organization_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> list[Task]:
        result = await self.session.scalars(
            select(Task)
            .where(Task.organization_id == organization_id)
            .order_by(Task.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.all())

    async def create_task(
        self,
        organization_id: UUID,
        payload: TaskCreate,
        *,
        emit_event: bool = True,
        commit: bool = True,
    ) -> Task:
        guard = OrganizationReferenceGuard(self.session)
        contact = await guard.ensure_contact(
            organization_id,
            payload.contact_id,
            field_name="contact_id",
        )
        deal = await guard.ensure_deal(
            organization_id,
            payload.deal_id,
            field_name="deal_id",
        )
        project = await guard.ensure_project(
            organization_id,
            payload.project_id,
            field_name="project_id",
        )
        await guard.ensure_user(
            organization_id,
            payload.assignee_id,
            field_name="assignee_id",
        )

        if deal is not None and contact is not None and deal.contact_id != contact.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="`contact_id` must match the deal's contact when both are provided.",
            )
        if project is not None and deal is not None and project.deal_id != deal.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="`project_id` must belong to the selected `deal_id`.",
            )

        task = Task(organization_id=organization_id, **payload.model_dump())
        self.session.add(task)
        await self.session.flush()

        if emit_event:
            await EventDispatcher(self.session).publish(
                organization_id=organization_id,
                event_type=EventTypes.TASK_CREATED,
                entity_type="task",
                entity_id=str(task.id),
                payload={
                    "task_id": str(task.id),
                    "contact_id": str(task.contact_id) if task.contact_id else None,
                    "deal_id": str(task.deal_id) if task.deal_id else None,
                    "status": task.status.value,
                },
            )

        if commit:
            await self.session.commit()
            await self.session.refresh(task)
            await EventDispatcher(self.session).process_pending_events(limit=100)
        return task

    async def get_task(self, organization_id: UUID, task_id: UUID) -> Task:
        task = await self.session.scalar(
            select(Task)
            .where(Task.organization_id == organization_id)
            .where(Task.id == task_id)
        )
        if task is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
        return task

    async def update_task(
        self,
        organization_id: UUID,
        task_id: UUID,
        payload: TaskUpdate,
    ) -> Task:
        task = await self.get_task(organization_id, task_id)
        updates = payload.model_dump(exclude_unset=True)
        guard = OrganizationReferenceGuard(self.session)

        contact_id = task.contact_id
        deal_id = task.deal_id
        project_id = task.project_id
        if "contact_id" in updates:
            contact = await guard.ensure_contact(
                organization_id,
                updates["contact_id"],
                field_name="contact_id",
            )
            contact_id = contact.id if contact else None
        if "deal_id" in updates:
            deal = await guard.ensure_deal(
                organization_id,
                updates["deal_id"],
                field_name="deal_id",
            )
            deal_id = deal.id if deal else None
        if "project_id" in updates:
            project = await guard.ensure_project(
                organization_id,
                updates["project_id"],
                field_name="project_id",
            )
            project_id = project.id if project else None
        if "assignee_id" in updates:
            await guard.ensure_user(
                organization_id,
                updates["assignee_id"],
                field_name="assignee_id",
            )

        deal = await guard.ensure_deal(organization_id, deal_id, field_name="deal_id")
        contact = await guard.ensure_contact(
            organization_id,
            contact_id,
            field_name="contact_id",
        )
        project = await guard.ensure_project(
            organization_id,
            project_id,
            field_name="project_id",
        )

        if deal is not None and contact is not None and deal.contact_id != contact.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="`contact_id` must match the deal's contact when both are provided.",
            )
        if project is not None and deal is not None and project.deal_id != deal.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="`project_id` must belong to the selected `deal_id`.",
            )

        for field, value in updates.items():
            setattr(task, field, value)
        await self.session.commit()
        await self.session.refresh(task)
        return task
