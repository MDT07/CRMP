from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.email_account import EmailAccount
from app.models.email_message import EmailMessage
from app.models.email_thread import EmailThread
from app.models.email_tracking import EmailTracking
from app.schemas.email import (
    EmailAccountCreate,
    EmailAccountUpdate,
    EmailMessageUpdate,
)


class EmailService:
    """Service for managing email accounts and messages."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()

    # Account Management
    async def create_account(
        self,
        user_id: UUID,
        organization_id: UUID,
        payload: EmailAccountCreate,
        access_token: str,
        refresh_token: str,
        token_expires_at: datetime,
        scopes: list[str],
    ) -> EmailAccount:
        """Create a new email account after OAuth flow."""
        # Encrypt tokens (in production, use proper encryption)
        access_token_encrypted = access_token  # TODO: Implement encryption
        refresh_token_encrypted = refresh_token  # TODO: Implement encryption

        account = EmailAccount(
            user_id=user_id,
            organization_id=organization_id,
            provider=payload.provider,
            email_address=str(payload.email_address),
            access_token_encrypted=access_token_encrypted,
            refresh_token_encrypted=refresh_token_encrypted,
            token_expires_at=token_expires_at,
            scopes=scopes,
        )

        self.session.add(account)
        await self.session.commit()
        await self.session.refresh(account)

        return account

    async def get_account(self, account_id: UUID, user_id: UUID) -> Optional[EmailAccount]:
        """Get an email account by ID, ensuring user owns it."""
        result = await self.session.execute(
            select(EmailAccount)
            .where(EmailAccount.id == account_id)
            .where(EmailAccount.user_id == user_id)
            .options(selectinload(EmailAccount.threads))
        )
        return result.scalar_one_or_none()

    async def get_accounts_by_user(self, user_id: UUID) -> list[EmailAccount]:
        """Get all email accounts for a user."""
        result = await self.session.execute(
            select(EmailAccount).where(EmailAccount.user_id == user_id)
        )
        return list(result.scalars().all())

    async def update_account(
        self,
        account_id: UUID,
        user_id: UUID,
        payload: EmailAccountUpdate,
    ) -> EmailAccount:
        """Update an email account."""
        account = await self.get_account(account_id, user_id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email account not found",
            )

        if payload.sync_enabled is not None:
            account.sync_enabled = payload.sync_enabled

        await self.session.commit()
        await self.session.refresh(account)
        return account

    async def delete_account(self, account_id: UUID, user_id: UUID) -> None:
        """Delete an email account."""
        account = await self.get_account(account_id, user_id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email account not found",
            )

        await self.session.delete(account)
        await self.session.commit()

    # Token Management
    async def get_valid_access_token(self, account: EmailAccount) -> str:
        """Get a valid access token, refreshing if necessary."""
        if account.token_expires_at and account.token_expires_at < datetime.now(timezone.utc):
            # Token expired, need to refresh
            return await self._refresh_access_token(account)

        return account.access_token_encrypted  # TODO: Decrypt

    async def _refresh_access_token(self, account: EmailAccount) -> str:
        """Refresh OAuth access token."""
        # Implementation depends on provider
        # This will be implemented in provider-specific services
        raise NotImplementedError("Token refresh must be implemented by provider-specific service")

    # Message Management
    async def create_message(
        self,
        account_id: UUID,
        provider_message_id: str,
        thread_id: Optional[UUID],
        subject: Optional[str],
        from_email: Optional[str],
        from_name: Optional[str],
        to_emails: list[dict],
        cc_emails: list[dict],
        bcc_emails: list[dict],
        body_text: Optional[str],
        body_html: Optional[str],
        snippet: Optional[str],
        sent_at: Optional[datetime],
        received_at: Optional[datetime],
        is_read: bool = False,
        is_sent: bool = False,
        is_draft: bool = False,
        labels: Optional[list[str]] = None,
        has_attachments: bool = False,
        attachments: Optional[list[dict]] = None,
    ) -> EmailMessage:
        """Create or update an email message."""
        # Check if message already exists
        existing = await self.session.scalar(
            select(EmailMessage).where(
                EmailMessage.account_id == account_id,
                EmailMessage.provider_message_id == provider_message_id,
            )
        )

        if existing:
            # Update existing message
            existing.is_read = is_read
            existing.labels = labels or []
            await self.session.commit()
            return existing

        # Create new message
        message = EmailMessage(
            account_id=account_id,
            thread_id=thread_id,
            provider_message_id=provider_message_id,
            subject=subject,
            from_email=from_email,
            from_name=from_name,
            to_emails=to_emails,
            cc_emails=cc_emails,
            bcc_emails=bcc_emails,
            body_text=body_text,
            body_html=body_html,
            snippet=snippet,
            sent_at=sent_at,
            received_at=received_at,
            is_read=is_read,
            is_sent=is_sent,
            is_draft=is_draft,
            labels=labels or [],
            has_attachments=has_attachments,
            attachments=attachments or [],
        )

        self.session.add(message)
        await self.session.commit()
        await self.session.refresh(message)

        # Auto-link to CRM entities
        await self._link_message_to_crm(message)

        return message

    async def _link_message_to_crm(self, message: EmailMessage) -> None:
        """Auto-link email message to CRM contacts, deals, and companies."""
        from app.models.contact import Contact
        from app.models.company import Company

        if message.from_email:
            # Try to find contact by email
            contact = await self.session.scalar(
                select(Contact).where(Contact.email == message.from_email)
            )
            if contact:
                message.contact_id = contact.id
                message.company_id = contact.company_id
            else:
                # Try to find company by domain
                domain = message.from_email.split("@")[-1]
                company = await self.session.scalar(select(Company).where(Company.domain == domain))
                if company:
                    message.company_id = company.id

        await self.session.commit()

    async def get_messages(
        self,
        account_id: Optional[UUID] = None,
        contact_id: Optional[UUID] = None,
        deal_id: Optional[UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[EmailMessage]:
        """Get email messages with optional filters."""
        query = select(EmailMessage)

        if account_id:
            query = query.where(EmailMessage.account_id == account_id)
        if contact_id:
            query = query.where(EmailMessage.contact_id == contact_id)
        if deal_id:
            query = query.where(EmailMessage.deal_id == deal_id)

        query = query.order_by(EmailMessage.received_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update_message(
        self,
        message_id: UUID,
        user_id: UUID,
        payload: EmailMessageUpdate,
    ) -> EmailMessage:
        """Update an email message."""
        # Get message with account to verify ownership
        result = await self.session.execute(
            select(EmailMessage)
            .join(EmailAccount)
            .where(EmailMessage.id == message_id)
            .where(EmailAccount.user_id == user_id)
        )
        message = result.scalar_one_or_none()

        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email message not found",
            )

        if payload.is_read is not None:
            message.is_read = payload.is_read
        if payload.is_archived is not None:
            message.is_archived = payload.is_archived

        await self.session.commit()
        await self.session.refresh(message)
        return message

    # Thread Management
    async def get_or_create_thread(
        self,
        account_id: UUID,
        provider_thread_id: str,
        subject: Optional[str] = None,
    ) -> EmailThread:
        """Get existing thread or create new one."""
        result = await self.session.execute(
            select(EmailThread).where(
                EmailThread.account_id == account_id,
                EmailThread.provider_thread_id == provider_thread_id,
            )
        )
        thread = result.scalar_one_or_none()

        if thread:
            return thread

        # Create new thread
        thread = EmailThread(
            account_id=account_id,
            provider_thread_id=provider_thread_id,
            subject=subject,
        )

        self.session.add(thread)
        await self.session.commit()
        await self.session.refresh(thread)

        return thread

    async def update_thread_stats(self, thread_id: UUID) -> None:
        """Update thread message count and last message timestamp."""
        result = await self.session.execute(
            select(EmailMessage)
            .where(EmailMessage.thread_id == thread_id)
            .order_by(EmailMessage.sent_at.desc())
        )
        messages = list(result.scalars().all())

        if messages:
            thread = await self.session.get(EmailThread, thread_id)
            if thread:
                thread.message_count = len(messages)
                thread.last_message_at = messages[0].sent_at

                # Update participants
                participants = set()
                for msg in messages:
                    if msg.from_email:
                        participants.add(msg.from_email)
                    for recipient in msg.to_emails:
                        if isinstance(recipient, dict) and "email" in recipient:
                            participants.add(recipient["email"])

                thread.participants = list(participants)

                await self.session.commit()

    # Sync Operations
    async def sync_account(self, account_id: UUID, user_id: UUID) -> tuple[int, int]:
        """Sync emails for an account. Returns (synced_count, error_count)."""
        account = await self.get_account(account_id, user_id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email account not found",
            )

        if not account.sync_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sync is disabled for this account",
            )

        # This method will be implemented by provider-specific services
        # For now, just update the last_sync_at
        account.last_sync_at = datetime.now(timezone.utc)
        await self.session.commit()

        return 0, 0  # Placeholder

    # Tracking
    async def create_tracking(self, message_id: UUID) -> EmailTracking:
        """Create tracking record for a message."""
        tracking_pixel_id = UUID(bytes=secrets.token_bytes(16))

        tracking = EmailTracking(
            message_id=message_id,
            tracking_pixel_id=tracking_pixel_id,
        )

        self.session.add(tracking)
        await self.session.commit()
        await self.session.refresh(tracking)

        return tracking

    async def record_open(
        self,
        tracking_pixel_id: UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        """Record an email open event."""
        result = await self.session.execute(
            select(EmailTracking).where(EmailTracking.tracking_pixel_id == tracking_pixel_id)
        )
        tracking = result.scalar_one_or_none()

        if tracking:
            tracking.open_count += 1
            if not tracking.opened_at:
                tracking.opened_at = datetime.now(timezone.utc)

            # Record location data
            if ip_address or user_agent:
                tracking.open_locations.append(
                    {
                        "ip": ip_address,
                        "user_agent": user_agent,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )

            await self.session.commit()
