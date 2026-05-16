from __future__ import annotations

import base64
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.email_account import EmailAccount
from app.models.email_provider import EmailProvider
from app.schemas.email import EmailAccountCreate
from app.services.email_service import EmailService


class GmailOAuthService:
    """Service for handling Gmail OAuth flow and API operations."""

    # Google OAuth endpoints
    AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"
    GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"

    # Required OAuth scopes
    SCOPES = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/userinfo.email",
    ]

    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()
        self.email_service = EmailService(session)

    def _generate_state(self, user_id: UUID, organization_id: UUID) -> str:
        """Generate OAuth state parameter with user info encoded."""
        state_data = {
            "user_id": str(user_id),
            "organization_id": str(organization_id),
            "provider": "gmail",
            "nonce": secrets.token_urlsafe(16),
        }
        state_json = json.dumps(state_data)
        return base64.urlsafe_b64encode(state_json.encode()).decode().rstrip("=")

    def _parse_state(self, state: str) -> dict[str, Any]:
        """Parse OAuth state parameter."""
        try:
            # Add padding if needed
            padding = 4 - len(state) % 4
            if padding != 4:
                state += "=" * padding

            state_json = base64.urlsafe_b64decode(state.encode()).decode()
            return json.loads(state_json)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid state parameter: {str(e)}",
            )

    def get_auth_url(self, user_id: UUID, organization_id: UUID) -> str:
        """Generate Gmail OAuth authorization URL."""
        if not self.settings.gmail_client_id:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Gmail OAuth not configured. Please set GMAIL_CLIENT_ID.",
            )

        state = self._generate_state(user_id, organization_id)

        params = {
            "client_id": self.settings.gmail_client_id,
            "redirect_uri": self.settings.gmail_redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.SCOPES),
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }

        # Build URL
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.AUTH_URL}?{query_string}"

    async def exchange_code(self, code: str, state: str) -> tuple[EmailAccount, str]:
        """Exchange OAuth code for tokens and create email account."""
        # Parse state
        state_data = self._parse_state(state)
        user_id = UUID(state_data["user_id"])
        organization_id = UUID(state_data["organization_id"])

        if not self.settings.gmail_client_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Gmail OAuth not configured. Please set GMAIL_CLIENT_SECRET.",
            )

        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                self.TOKEN_URL,
                data={
                    "code": code,
                    "client_id": self.settings.gmail_client_id,
                    "client_secret": self.settings.gmail_client_secret,
                    "redirect_uri": self.settings.gmail_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to exchange code: {token_response.text}",
            )

        token_data = token_response.json()
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
        scopes = token_data.get("scope", "").split()

        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No refresh token received. User may have already authorized.",
            )

        # Get user email from Gmail API
        email_address = await self._get_user_email(access_token)

        # Calculate token expiry
        token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        # Create email account
        account_create = EmailAccountCreate(
            provider=EmailProvider.gmail,
            email_address=email_address,
        )

        account = await self.email_service.create_account(
            user_id=user_id,
            organization_id=organization_id,
            payload=account_create,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=token_expires_at,
            scopes=scopes,
        )

        return account, access_token

    async def _get_user_email(self, access_token: str) -> str:
        """Get user's email address from Gmail API."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GMAIL_API_BASE}/users/me/profile",
                headers={"Authorization": f"Bearer {access_token}"},
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to get user profile: {response.text}",
            )

        profile = response.json()
        return profile["emailAddress"]

    async def refresh_access_token(self, account: EmailAccount) -> str:
        """Refresh OAuth access token for an account."""
        if account.provider != EmailProvider.gmail:
            raise ValueError("Account is not a Gmail account")

        if not self.settings.gmail_client_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Gmail OAuth not configured",
            )

        # Decrypt refresh token (TODO: implement proper encryption)
        refresh_token = account.refresh_token_encrypted

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.settings.gmail_client_id,
                    "client_secret": self.settings.gmail_client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Failed to refresh token: {response.text}",
            )

        token_data = response.json()
        access_token = token_data["access_token"]
        expires_in = token_data.get("expires_in", 3600)

        # Update account
        account.access_token_encrypted = access_token  # TODO: Encrypt
        account.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        await self.session.commit()

        return access_token

    async def get_valid_access_token(self, account: EmailAccount) -> str:
        """Get a valid access token, refreshing if necessary."""
        if account.token_expires_at and account.token_expires_at < datetime.now(timezone.utc):
            return await self.refresh_access_token(account)
        return account.access_token_encrypted  # TODO: Decrypt

    async def revoke_token(self, account: EmailAccount) -> None:
        """Revoke OAuth token."""
        # Decrypt token (TODO: implement proper encryption)
        token = account.access_token_encrypted

        async with httpx.AsyncClient() as client:
            await client.post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": token},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
