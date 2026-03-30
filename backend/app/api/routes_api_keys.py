from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api.dependencies import SessionDep, require_roles
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.api_key import (
    OrganizationAPIKeyCreate,
    OrganizationAPIKeyCreateResponse,
    OrganizationAPIKeyRead,
)
from app.services.api_key_service import APIKeyService

router = APIRouter(prefix="/organizations/current/api-keys", tags=["api_keys"])

AdminManagerDep = Annotated[
    User,
    Depends(require_roles(UserRole.admin, UserRole.manager)),
]


@router.get("", response_model=list[OrganizationAPIKeyRead])
async def list_current_workspace_api_keys(
    session: SessionDep,
    current_user: AdminManagerDep,
) -> list[OrganizationAPIKeyRead]:
    return await APIKeyService(session).list_keys(current_user.organization_id)


@router.post(
    "",
    response_model=OrganizationAPIKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_current_workspace_api_key(
    payload: OrganizationAPIKeyCreate,
    session: SessionDep,
    current_user: AdminManagerDep,
) -> OrganizationAPIKeyCreateResponse:
    return await APIKeyService(session).create_key(
        current_user.organization_id,
        current_user,
        payload,
    )


@router.post("/{api_key_id}/revoke", response_model=OrganizationAPIKeyRead)
async def revoke_current_workspace_api_key(
    api_key_id: UUID,
    session: SessionDep,
    current_user: AdminManagerDep,
) -> OrganizationAPIKeyRead:
    return await APIKeyService(session).revoke_key(
        current_user.organization_id,
        api_key_id,
        current_user,
    )
