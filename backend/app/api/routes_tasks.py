from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import PaginationDep, SessionDep, TasksAccessDep
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/", response_model=list[TaskRead])
async def list_tasks(
    session: SessionDep,
    access: TasksAccessDep,
    pagination: PaginationDep,
) -> list[TaskRead]:
    tasks = await TaskService(session).list_tasks(
        access.organization_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return [TaskRead.model_validate(task) for task in tasks]


@router.post("/", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    session: SessionDep,
    access: TasksAccessDep,
) -> TaskRead:
    task = await TaskService(session).create_task(access.organization_id, payload)
    return TaskRead.model_validate(task)


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(
    task_id: UUID,
    session: SessionDep,
    access: TasksAccessDep,
) -> TaskRead:
    task = await TaskService(session).get_task(access.organization_id, task_id)
    return TaskRead.model_validate(task)


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    session: SessionDep,
    access: TasksAccessDep,
) -> TaskRead:
    task = await TaskService(session).update_task(
        access.organization_id,
        task_id,
        payload,
    )
    return TaskRead.model_validate(task)
