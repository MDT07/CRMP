from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Optional
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.rate_limit import check_api_key_request_limit, check_invalid_api_key_limit
from app.core.security import decode_access_token, hash_api_key_secret, oauth2_scheme
from app.db.session import get_db_session
from app.models.enums import UserRole
from app.models.organization_api_key import OrganizationAPIKey
from app.models.user import User
from app.services.auth_service import AuthService

SessionDep = Annotated[AsyncSession, Depends(get_db_session)]


@dataclass
class PaginationParams:
    limit: int = 20
    offset: int = 0


def get_pagination_params(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> PaginationParams:
    return PaginationParams(limit=limit, offset=offset)


PaginationDep = Annotated[PaginationParams, Depends(get_pagination_params)]


@dataclass
class WorkspaceAccess:
    organization_id: UUID
    auth_kind: str
    user: Optional[User] = None
    api_key_id: Optional[UUID] = None
    api_key_modules: tuple[str, ...] = ()


def _default_user_modules() -> tuple[str, ...]:
    return (
        "contacts",
        "deals",
        "inbox",
        "automations",
        "analytics",
        "settings",
    )


async def _resolve_user_from_request(
    request: Request,
    bearer_token: Optional[str],
    session: AsyncSession,
) -> Optional[User]:
    settings = get_settings()
    token = bearer_token or request.cookies.get(settings.session_cookie_name)
    if not token:
        return None

    try:
        claims = decode_access_token(token)
        user_id = UUID(str(claims["sub"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate access token.",
        ) from exc

    user = await AuthService(session).get_user_by_id(user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The authenticated user is not available.",
        )
    return user


async def get_current_user(
    request: Request,
    bearer_token: Annotated[Optional[str], Depends(oauth2_scheme)],
    session: SessionDep,
) -> User:
    user = await _resolve_user_from_request(request, bearer_token, session)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


async def get_workspace_access(
    request: Request,
    bearer_token: Annotated[Optional[str], Depends(oauth2_scheme)],
    session: SessionDep,
    api_key: Annotated[Optional[str], Header(alias="X-CRMP-API-Key")] = None,
) -> WorkspaceAccess:
    try:
        user = await _resolve_user_from_request(request, bearer_token, session)
    except HTTPException:
        if not api_key:
            raise
        user = None

    if user is not None:
        return WorkspaceAccess(
            organization_id=user.organization_id,
            auth_kind="user",
            user=user,
            api_key_modules=_default_user_modules(),
        )

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    api_key_hash = hash_api_key_secret(api_key)
    key_record = await session.scalar(
        select(OrganizationAPIKey)
        .where(OrganizationAPIKey.token_hash == api_key_hash)
        .where(OrganizationAPIKey.status == "active")
    )
    if key_record is None:
        settings = get_settings()
        client_identifier = request.client.host if request.client else "unknown"
        allowed_invalid, retry_after_invalid, _ = await check_invalid_api_key_limit(
            client_identifier,
            limit=settings.api_key_invalid_attempts_per_minute,
        )
        if not allowed_invalid:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many invalid API key attempts. Please retry shortly.",
                headers={"Retry-After": str(retry_after_invalid)},
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key.",
        )

    settings = get_settings()
    allowed, retry_after, remaining = await check_api_key_request_limit(
        key_record.id,
        limit=settings.api_key_rate_limit_requests_per_minute,
    )

    request.state.crmp_api_key_id = key_record.id
    request.state.crmp_rate_limit_limit = settings.api_key_rate_limit_requests_per_minute
    request.state.crmp_rate_limit_remaining = remaining
    request.state.crmp_rate_limit_reset = retry_after

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="API key rate limit exceeded. Please retry shortly.",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(settings.api_key_rate_limit_requests_per_minute),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(retry_after),
            },
        )

    return WorkspaceAccess(
        organization_id=key_record.organization_id,
        auth_kind="api_key",
        api_key_id=key_record.id,
        api_key_modules=tuple(key_record.modules or []),
    )


WorkspaceAccessDep = Annotated[WorkspaceAccess, Depends(get_workspace_access)]


def require_api_key_module(module: str):
    async def dependency(access: WorkspaceAccessDep) -> WorkspaceAccess:
        if access.auth_kind != "api_key":
            return access

        if module not in access.api_key_modules:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This API key does not include the '{module}' module scope.",
            )
        return access

    return dependency


def require_any_api_key_module(*modules: str):
    normalized_modules = tuple(module for module in modules if module)

    async def dependency(access: WorkspaceAccessDep) -> WorkspaceAccess:
        if access.auth_kind != "api_key":
            return access

        if any(module in access.api_key_modules for module in normalized_modules):
            return access

        allowed = ", ".join(f"'{module}'" for module in normalized_modules)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This API key must include one of the following module scopes: {allowed}.",
        )

    return dependency


ContactsAccessDep = Annotated[
    WorkspaceAccess,
    Depends(require_api_key_module("contacts")),
]
DealsAccessDep = Annotated[
    WorkspaceAccess,
    Depends(require_api_key_module("deals")),
]
InboxAccessDep = Annotated[
    WorkspaceAccess,
    Depends(require_api_key_module("inbox")),
]
AutomationsAccessDep = Annotated[
    WorkspaceAccess,
    Depends(require_api_key_module("automations")),
]
AnalyticsAccessDep = Annotated[
    WorkspaceAccess,
    Depends(require_api_key_module("analytics")),
]
ProjectsAccessDep = Annotated[
    WorkspaceAccess,
    Depends(require_api_key_module("deals")),
]
TasksAccessDep = Annotated[
    WorkspaceAccess,
    Depends(require_any_api_key_module("deals", "automations")),
]


def require_roles(*roles: UserRole):
    async def dependency(current_user: CurrentUserDep) -> User:
        if roles and current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return dependency
