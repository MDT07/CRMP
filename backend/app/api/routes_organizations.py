from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import CurrentUserDep, SessionDep, require_roles
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.organization import (
    OrganizationMemberRead,
    OrganizationUpdate,
    WorkspaceBootstrapResponse,
    WorkspaceRead,
)
from app.services.organization_service import OrganizationService

router = APIRouter(prefix="/organizations", tags=["organizations"])

AdminManagerDep = Annotated[
    User,
    Depends(require_roles(UserRole.admin, UserRole.manager)),
]


@router.get("/current", response_model=WorkspaceRead)
async def get_current_workspace(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> WorkspaceRead:
    return await OrganizationService(session).get_workspace(current_user.organization_id)


@router.patch("/current", response_model=WorkspaceRead)
async def update_current_workspace(
    payload: OrganizationUpdate,
    session: SessionDep,
    current_user: AdminManagerDep,
) -> WorkspaceRead:
    return await OrganizationService(session).update_organization(
        current_user.organization_id,
        payload,
    )


@router.get("/current/members", response_model=list[OrganizationMemberRead])
async def list_current_workspace_members(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> list[OrganizationMemberRead]:
    members = await OrganizationService(session).list_members(current_user.organization_id)
    return [OrganizationMemberRead.model_validate(member) for member in members]


@router.post("/current/bootstrap", response_model=WorkspaceBootstrapResponse)
async def bootstrap_current_workspace(
    session: SessionDep,
    current_user: AdminManagerDep,
) -> WorkspaceBootstrapResponse:
    service = OrganizationService(session)
    seeded = await service.bootstrap_workspace(current_user.organization_id, current_user)
    workspace = await service.get_workspace(current_user.organization_id)
    detail = (
        "Starter CRM data created for this workspace."
        if seeded
        else "Workspace already has CRM data, so bootstrap was skipped."
    )
    return WorkspaceBootstrapResponse(
        seeded=seeded,
        detail=detail,
        workspace=workspace,
    )
