from __future__ import annotations

import base64
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_account import EmailAccount
from app.models.email_message import EmailMessage
from app.models.email_provider import EmailProvider
from app.services.email_service import EmailService
from app.services.gmail_oauth_service import GmailOAuthService


class GmailSyncService:
    """Service for syncing emails from Gmail API."""

    GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"

    def __init__(self, session: AsyncSession):
        self.session = session
        self.oauth_service = GmailOAuthService(session)
        self.email_service = EmailService(session)

    async def sync_account(self, account: EmailAccount) -> tuple[int, int]:
        """
        Sync emails for a Gmail account.
        Returns (synced_count, error_count).
        """
        if account.provider != EmailProvider.gmail:
            raise ValueError("Account is not a Gmail account")

        # Get valid access token
        access_token = await self.oauth_service.get_valid_access_token(account)

        synced_count = 0
        error_count = 0

        try:
            # Get list of message IDs to sync
            history_id = account.sync_cursor

            if history_id:
                # Incremental sync using history API
                message_ids = await self._get_history_changes(access_token, history_id)
            else:
                # Initial sync - get recent messages
                message_ids = await self._get_recent_messages(access_token)

            # Fetch and save each message
            for message_id in message_ids[:100]:  # Limit to 100 messages per sync
                try:
                    await self._sync_message(account.id, access_token, message_id)
                    synced_count += 1
                except Exception as e:
                    error_count += 1
                    logger.error(f"Error syncing message {message_id}: {e}")

            # Update account sync state
            account.last_sync_at = datetime.now(timezone.utc)
            # Get latest history ID for next sync
            latest_history_id = await self._get_latest_history_id(access_token)
            if latest_history_id:
                account.sync_cursor = latest_history_id

            await self.session.commit()

        except Exception as e:
            error_count += 1
            logger.error(f"Error syncing account {account.id}: {e}")
            raise

        return synced_count, error_count

    async def _get_recent_messages(self, access_token: str) -> list[str]:
        """Get recent message IDs from Gmail."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GMAIL_API_BASE}/users/me/messages",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "maxResults": 100,
                    "q": "in:inbox OR in:sent",  # Only sync inbox and sent
                },
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to get messages: {response.text}",
            )

        data = response.json()
        messages = data.get("messages", [])
        return [msg["id"] for msg in messages]

    async def _get_history_changes(self, access_token: str, history_id: str) -> list[str]:
        """Get message IDs that have changed since last sync."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GMAIL_API_BASE}/users/me/history",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "startHistoryId": history_id,
                    "historyTypes": "messageAdded",
                },
            )

        if response.status_code != 200:
            # History ID might be expired, fall back to full sync
            return await self._get_recent_messages(access_token)

        data = response.json()
        history = data.get("history", [])

        message_ids = []
        for history_record in history:
            for message_added in history_record.get("messagesAdded", []):
                message_ids.append(message_added["message"]["id"])

        return message_ids

    async def _get_latest_history_id(self, access_token: str) -> Optional[str]:
        """Get the latest history ID from Gmail."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GMAIL_API_BASE}/users/me/profile",
                headers={"Authorization": f"Bearer {access_token}"},
            )

        if response.status_code == 200:
            data = response.json()
            return data.get("historyId")
        return None

    async def _sync_message(
        self, account_id: UUID, access_token: str, message_id: str
    ) -> EmailMessage:
        """Fetch and save a single message from Gmail."""
        # Check if message already exists
        existing = await self._get_existing_message(account_id, message_id)
        if existing:
            return existing

        # Fetch message from Gmail
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.GMAIL_API_BASE}/users/me/messages/{message_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"format": "full"},
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to get message: {response.text}",
            )

        gmail_message = response.json()

        # Parse message data
        message_data = self._parse_gmail_message(gmail_message)

        # Get or create thread
        thread_id = None
        gmail_thread_id = gmail_message.get("threadId")
        if gmail_thread_id:
            thread = await self.email_service.get_or_create_thread(
                account_id, gmail_thread_id, message_data.get("subject")
            )
            thread_id = thread.id

        # Create message
        message = await self.email_service.create_message(
            account_id=account_id,
            provider_message_id=message_id,
            thread_id=thread_id,
            subject=message_data.get("subject"),
            from_email=message_data.get("from_email"),
            from_name=message_data.get("from_name"),
            to_emails=message_data.get("to_emails", []),
            cc_emails=message_data.get("cc_emails", []),
            bcc_emails=message_data.get("bcc_emails", []),
            body_text=message_data.get("body_text"),
            body_html=message_data.get("body_html"),
            snippet=message_data.get("snippet"),
            sent_at=message_data.get("sent_at"),
            received_at=message_data.get("received_at"),
            is_read=message_data.get("is_read", False),
            is_sent=message_data.get("is_sent", False),
            is_draft=message_data.get("is_draft", False),
            labels=message_data.get("labels", []),
            has_attachments=message_data.get("has_attachments", False),
            attachments=message_data.get("attachments", []),
        )

        # Update thread stats if thread exists
        if thread_id:
            await self.email_service.update_thread_stats(thread_id)

        return message

    async def _get_existing_message(
        self, account_id: UUID, provider_message_id: str
    ) -> Optional[EmailMessage]:
        """Check if message already exists in database."""
        from sqlalchemy import select

        result = await self.session.execute(
            select(EmailMessage).where(
                EmailMessage.account_id == account_id,
                EmailMessage.provider_message_id == provider_message_id,
            )
        )
        return result.scalar_one_or_none()

    def _parse_gmail_message(self, gmail_message: dict) -> dict[str, Any]:
        """Parse Gmail message format into our schema."""
        payload = gmail_message.get("payload", {})
        headers = payload.get("headers", [])

        # Extract headers
        header_map = {h["name"].lower(): h["value"] for h in headers}

        from_value = header_map.get("from", "")
        from_email, from_name = self._parse_email_address(from_value)

        to_emails = self._parse_email_list(header_map.get("to", ""))
        cc_emails = self._parse_email_list(header_map.get("cc", ""))
        bcc_emails = self._parse_email_list(header_map.get("bcc", ""))

        subject = header_map.get("subject", "")

        # Parse dates
        sent_at = None
        if "date" in header_map:
            try:
                # Parse RFC 2822 date
                from email.utils import parsedate_to_datetime

                sent_at = parsedate_to_datetime(header_map["date"])
            except Exception:
                pass

        received_at = datetime.now(timezone.utc)

        # Extract body
        body_text, body_html = self._extract_body(payload)

        # Check for attachments
        has_attachments = False
        attachments = []
        for part in payload.get("parts", []):
            if part.get("filename"):
                has_attachments = True
                attachments.append(
                    {
                        "filename": part.get("filename"),
                        "mime_type": part.get("mimeType"),
                        "size": part.get("body", {}).get("size", 0),
                    }
                )

        # Get labels
        labels = gmail_message.get("labelIds", [])

        # Check status
        is_read = "UNREAD" not in labels
        is_sent = "SENT" in labels
        is_draft = "DRAFT" in labels

        return {
            "subject": subject,
            "from_email": from_email,
            "from_name": from_name,
            "to_emails": to_emails,
            "cc_emails": cc_emails,
            "bcc_emails": bcc_emails,
            "body_text": body_text,
            "body_html": body_html,
            "snippet": gmail_message.get("snippet"),
            "sent_at": sent_at,
            "received_at": received_at,
            "is_read": is_read,
            "is_sent": is_sent,
            "is_draft": is_draft,
            "labels": labels,
            "has_attachments": has_attachments,
            "attachments": attachments,
        }

    def _parse_email_address(self, address_str: str) -> tuple[Optional[str], Optional[str]]:
        """Parse email address string into email and name."""
        if not address_str:
            return None, None

        try:
            from email.utils import parseaddr

            name, email_addr = parseaddr(address_str)
            return email_addr if email_addr else None, name if name else None
        except Exception:
            return address_str.strip(), None

    def _parse_email_list(self, addresses_str: str) -> list[dict]:
        """Parse comma-separated email addresses."""
        if not addresses_str:
            return []

        emails = []
        for addr in addresses_str.split(","):
            email, name = self._parse_email_address(addr.strip())
            if email:
                emails.append({"email": email, "name": name})
        return emails

    def _extract_body(self, payload: dict) -> tuple[Optional[str], Optional[str]]:
        """Extract text and HTML body from message payload."""
        text_body = None
        html_body = None

        mime_type = payload.get("mimeType", "")

        if mime_type == "text/plain":
            text_body = self._decode_body(payload.get("body", {}).get("data", ""))
        elif mime_type == "text/html":
            html_body = self._decode_body(payload.get("body", {}).get("data", ""))
        elif mime_type.startswith("multipart/"):
            for part in payload.get("parts", []):
                part_text, part_html = self._extract_body(part)
                if part_text and not text_body:
                    text_body = part_text
                if part_html and not html_body:
                    html_body = part_html

        return text_body, html_body

    def _decode_body(self, data: str) -> Optional[str]:
        """Decode base64url encoded body data."""
        if not data:
            return None

        try:
            # Gmail uses base64url encoding
            padding = 4 - len(data) % 4
            if padding != 4:
                data += "=" * padding
            decoded = base64.urlsafe_b64decode(data)
            return decoded.decode("utf-8", errors="replace")
        except Exception:
            return None

    async def send_message(
        self,
        account: EmailAccount,
        to: list[str],
        subject: str,
        body: str,
        body_type: str = "text",
        cc: Optional[list[str]] = None,
        bcc: Optional[list[str]] = None,
    ) -> str:
        """Send an email via Gmail API."""
        access_token = await self.oauth_service.get_valid_access_token(account)

        # Build email message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = account.email_address
        msg["To"] = ", ".join(to)

        if cc:
            msg["Cc"] = ", ".join(cc)
        if bcc:
            msg["Bcc"] = ", ".join(bcc)

        # Add body
        if body_type == "html":
            msg.attach(MIMEText(body, "html"))
        else:
            msg.attach(MIMEText(body, "plain"))

        # Encode message
        raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

        # Send via API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.GMAIL_API_BASE}/users/me/messages/send",
                headers={"Authorization": f"Bearer {access_token}"},
                json={"raw": raw_message},
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to send message: {response.text}",
            )

        sent_message = response.json()
        return sent_message["id"]
