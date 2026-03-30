from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.api.dependencies import CurrentUserDep, SessionDep
from app.core.config import get_settings
from app.schemas.auth import AuthenticatedUser, LoginRequest, RegisterRequest, SessionResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )


@router.post("/register", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    response: Response,
    session: SessionDep,
) -> SessionResponse:
    service = AuthService(session)
    user = await service.register(payload)
    _set_session_cookie(response, service.build_session_token(user))
    return service.build_session_response(user)


@router.post("/login", response_model=SessionResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    session: SessionDep,
) -> SessionResponse:
    service = AuthService(session)
    user = await service.authenticate(payload)
    _set_session_cookie(response, service.build_session_token(user))
    return service.build_session_response(user)


@router.get("/me", response_model=AuthenticatedUser)
async def me(current_user: CurrentUserDep) -> AuthenticatedUser:
    return AuthenticatedUser.model_validate(current_user)


@router.post("/logout")
async def logout(response: Response) -> dict[str, bool]:
    settings = get_settings()
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
    )
    return {"ok": True}
