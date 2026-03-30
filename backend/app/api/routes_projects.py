from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, status

from app.api.dependencies import PaginationDep, ProjectsAccessDep, SessionDep
from app.schemas.project import (
    ProjectConvertFromDeal,
    ProjectCreate,
    ProjectRead,
    ProjectUpdate,
)
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=list[ProjectRead])
async def list_projects(
    session: SessionDep,
    access: ProjectsAccessDep,
    pagination: PaginationDep,
) -> list[ProjectRead]:
    projects = await ProjectService(session).list_projects(
        access.organization_id,
        limit=pagination.limit,
        offset=pagination.offset,
    )
    return [ProjectRead.model_validate(project) for project in projects]


@router.post("/", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    session: SessionDep,
    access: ProjectsAccessDep,
) -> ProjectRead:
    project = await ProjectService(session).create_project(access.organization_id, payload)
    return ProjectRead.model_validate(project)


@router.post(
    "/from-deal/{deal_id}",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
)
async def convert_deal_to_project(
    deal_id: UUID,
    payload: ProjectConvertFromDeal,
    session: SessionDep,
    access: ProjectsAccessDep,
) -> ProjectRead:
    project = await ProjectService(session).convert_from_deal(
        access.organization_id,
        deal_id,
        payload,
    )
    return ProjectRead.model_validate(project)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: UUID,
    session: SessionDep,
    access: ProjectsAccessDep,
) -> ProjectRead:
    project = await ProjectService(session).get_project(access.organization_id, project_id)
    return ProjectRead.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    session: SessionDep,
    access: ProjectsAccessDep,
) -> ProjectRead:
    project = await ProjectService(session).update_project(
        access.organization_id,
        project_id,
        payload,
    )
    return ProjectRead.model_validate(project)
