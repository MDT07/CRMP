from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse

from app.api.dependencies import CurrentUserDep, SessionDep
from app.core.config import get_settings
from app.models.email_provider import EmailProvider
from app.schemas.email import (
    EmailAccountList,
    EmailAccountRead,
    EmailAccountUpdate,
    EmailMessageList,
    EmailMessageRead,
    EmailMessageUpdate,
    EmailThreadDetail,
    EmailThreadList,
    EmailSyncRequest,
    EmailSyncResponse,
)
from app.services.email_service import EmailService
from app.services.gmail_oauth_service import GmailOAuthService
from app.services.gmail_sync_service import GmailSyncService

router = APIRouter(prefix="/email", tags=["email"])


def get_email_service(session: SessionDep) -> EmailService:
    return EmailService(session)


def get_gmail_oauth_service(session: SessionDep) -> GmailOAuthService:
    return GmailOAuthService(session)


def get_gmail_sync_service(session: SessionDep) -> GmailSyncService:
    return GmailSyncService(session)


# Account Routes
@router.get("/accounts", response_model=EmailAccountList)
async def list_email_accounts(
    current_user: CurrentUserDep,
    service: EmailService = Depends(get_email_service),
) -> EmailAccountList:
    """List all email accounts for the current user."""
    accounts = await service.get_accounts_by_user(current_user.id)
    return EmailAccountList(accounts=[EmailAccountRead.model_validate(a) for a in accounts])


@router.get("/accounts/{account_id}", response_model=EmailAccountRead)
async def get_email_account(
    account_id: UUID,
    current_user: CurrentUserDep,
    service: EmailService = Depends(get_email_service),
) -> EmailAccountRead:
    """Get a specific email account."""
    account = await service.get_account(account_id, current_user.id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email account not found",
        )
    return EmailAccountRead.model_validate(account)


@router.patch("/accounts/{account_id}", response_model=EmailAccountRead)
async def update_email_account(
    account_id: UUID,
    payload: EmailAccountUpdate,
    current_user: CurrentUserDep,
    service: EmailService = Depends(get_email_service),
) -> EmailAccountRead:
    """Update an email account."""
    account = await service.update_account(account_id, current_user.id, payload)
    return EmailAccountRead.model_validate(account)


@router.delete("/accounts/{account_id}")
async def delete_email_account(
    account_id: UUID,
    current_user: CurrentUserDep,
    service: EmailService = Depends(get_email_service),
    gmail_service: GmailOAuthService = Depends(get_gmail_oauth_service),
) -> dict[str, bool]:
    """Delete an email account."""
    account = await service.get_account(account_id, current_user.id)
    if account and account.provider == EmailProvider.gmail:
        # Revoke Gmail token
        await gmail_service.revoke_token(account)

    await service.delete_account(account_id, current_user.id)
    return {"success": True}


# Message Routes
@router.get("/messages", response_model=EmailMessageList)
async def list_email_messages(
    current_user: CurrentUserDep,
    account_id: Optional[UUID] = Query(None),
    contact_id: Optional[UUID] = Query(None),
    deal_id: Optional[UUID] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    service: EmailService = Depends(get_email_service),
) -> EmailMessageList:
    """List email messages with optional filters."""
    import logging

    logger = logging.getLogger(__name__)

    try:
        messages = await service.get_messages(
            account_id=account_id,
            contact_id=contact_id,
            deal_id=deal_id,
            limit=limit,
            offset=offset,
        )
        logger.info(f"Retrieved {len(messages)} messages")

        # Validate each message individually to catch validation errors
        validated_messages = []
        for msg in messages:
            try:
                validated = EmailMessageRead.model_validate(msg)
                validated_messages.append(validated)
            except Exception as e:
                logger.error(f"Validation error for message {msg.id}: {e}")
                # Skip invalid messages
                continue

        return EmailMessageList(
            messages=validated_messages,
            next_cursor=None,
        )
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        import traceback

        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch messages: {str(e)}",
        )


@router.get("/messages/{message_id}", response_model=EmailMessageRead)
async def get_email_message(
    message_id: UUID,
    current_user: CurrentUserDep,
    service: EmailService = Depends(get_email_service),
) -> EmailMessageRead:
    """Get a specific email message."""
    # TODO: Implement get_message method
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not yet implemented",
    )


@router.patch("/messages/{message_id}", response_model=EmailMessageRead)
async def update_email_message(
    message_id: UUID,
    payload: EmailMessageUpdate,
    current_user: CurrentUserDep,
    service: EmailService = Depends(get_email_service),
) -> EmailMessageRead:
    """Update an email message (e.g., mark as read)."""
    message = await service.update_message(message_id, current_user.id, payload)
    return EmailMessageRead.model_validate(message)


# Thread Routes
@router.get("/threads", response_model=EmailThreadList)
async def list_email_threads(
    current_user: CurrentUserDep,
    account_id: Optional[UUID] = Query(None),
    contact_id: Optional[UUID] = Query(None),
    deal_id: Optional[UUID] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> EmailThreadList:
    """List email threads with optional filters."""
    # TODO: Implement thread listing
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not yet implemented",
    )


@router.get("/threads/{thread_id}", response_model=EmailThreadDetail)
async def get_email_thread(
    thread_id: UUID,
    current_user: CurrentUserDep,
) -> EmailThreadDetail:
    """Get a specific email thread with all messages."""
    # TODO: Implement thread detail
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Not yet implemented",
    )


# Sync Routes
@router.post("/sync", response_model=EmailSyncResponse)
async def sync_emails(
    payload: EmailSyncRequest,
    current_user: CurrentUserDep,
    service: EmailService = Depends(get_email_service),
    gmail_sync: GmailSyncService = Depends(get_gmail_sync_service),
) -> EmailSyncResponse:
    """Manually trigger email sync for an account or all accounts."""
    synced = 0
    errors = 0

    if payload.account_id:
        # Sync specific account
        account = await service.get_account(payload.account_id, current_user.id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email account not found",
            )

        if account.provider == EmailProvider.gmail:
            s, e = await gmail_sync.sync_account(account)
            synced += s
            errors += e
        else:
            # TODO: Implement Outlook sync
            errors += 1
    else:
        # Sync all accounts
        accounts = await service.get_accounts_by_user(current_user.id)
        for account in accounts:
            if account.sync_enabled:
                try:
                    if account.provider == EmailProvider.gmail:
                        s, e = await gmail_sync.sync_account(account)
                        synced += s
                        errors += e
                    else:
                        # TODO: Implement Outlook sync
                        errors += 1
                except Exception:
                    errors += 1

    return EmailSyncResponse(synced=synced, errors=errors)


# OAuth Routes
@router.post("/connect/gmail")
async def connect_gmail(
    current_user: CurrentUserDep,
    service: GmailOAuthService = Depends(get_gmail_oauth_service),
) -> dict[str, str]:
    """Initiate Gmail OAuth flow. Returns authorization URL."""
    auth_url = service.get_auth_url(
        user_id=current_user.id,
        organization_id=current_user.organization_id,
    )
    return {"auth_url": auth_url}


@router.post("/connect/outlook")
async def connect_outlook(
    current_user: CurrentUserDep,
) -> dict[str, str]:
    """Initiate Outlook OAuth flow."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Outlook OAuth not yet implemented",
    )


@router.get("/oauth/callback")
async def oauth_callback(
    request: Request,
    code: str,
    state: str,
    error: Optional[str] = None,
    service: GmailOAuthService = Depends(get_gmail_oauth_service),
    sync_service: GmailSyncService = Depends(get_gmail_sync_service),
) -> RedirectResponse:
    """Handle OAuth callback from Google/Outlook."""
    settings = get_settings()

    if error:
        # Redirect to frontend with error
        return RedirectResponse(
            url=f"{settings.frontend_url}/settings/email?error={error}",
            status_code=302,
        )

    try:
        # Exchange code for tokens and create account
        account, _ = await service.exchange_code(code, state)

        # Trigger initial sync in background (for now, just run it)
        # In production, this should be a background job
        try:
            await sync_service.sync_account(account)
        except Exception as e:
            # Log error but don't fail the connection
            logger.error(f"Initial sync failed: {e}")

        # Redirect to frontend with success
        return RedirectResponse(
            url=f"{settings.frontend_url}/settings/email?success=true",
            status_code=302,
        )

    except HTTPException as e:
        return RedirectResponse(
            url=f"{settings.frontend_url}/settings/email?error={e.detail}",
            status_code=302,
        )
    except Exception:
        return RedirectResponse(
            url=f"{settings.frontend_url}/settings/email?error=unknown_error",
            status_code=302,
        )


# Send Email
@router.post("/send")
async def send_email(
    request: Request,
    current_user: CurrentUserDep,
    service: EmailService = Depends(get_email_service),
    gmail_sync: GmailSyncService = Depends(get_gmail_sync_service),
) -> dict[str, str]:
    """Send an email."""
    # TODO: Implement send endpoint with proper request body
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Send email not yet implemented",
    )
