from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.email_provider import EmailProvider


# Schemas for Email Account
class EmailAccountCreate(BaseModel):
    provider: EmailProvider
    email_address: EmailStr


class EmailAccountRead(BaseModel):
    id: UUID
    user_id: UUID
    organization_id: UUID
    provider: EmailProvider
    email_address: EmailStr
    scopes: list[str]
    sync_enabled: bool
    last_sync_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmailAccountUpdate(BaseModel):
    sync_enabled: Optional[bool] = None


# Schemas for Email Message
class EmailRecipient(BaseModel):
    email: EmailStr
    name: Optional[str] = None


class EmailAttachment(BaseModel):
    filename: str
    mime_type: str
    size: int


class EmailMessageRead(BaseModel):
    id: UUID
    account_id: UUID
    thread_id: Optional[UUID] = None
    subject: Optional[str] = None
    from_email: Optional[EmailStr] = None
    from_name: Optional[str] = None
    to_emails: list[EmailRecipient] = []
    cc_emails: list[EmailRecipient] = []
    bcc_emails: list[EmailRecipient] = []
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    snippet: Optional[str] = None
    sent_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    is_read: bool = False
    is_sent: bool = False
    is_draft: bool = False
    is_archived: bool = False
    labels: list[str] = []
    has_attachments: bool = False
    attachments: list[EmailAttachment] = []
    contact_id: Optional[UUID] = None
    deal_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmailMessageSend(BaseModel):
    account_id: UUID
    to: list[EmailStr]
    cc: list[EmailStr] = Field(default_factory=list)
    bcc: list[EmailStr] = Field(default_factory=list)
    subject: str = Field(min_length=1, max_length=1000)
    body: str = Field(min_length=1)
    body_type: str = Field(default="text", pattern="^(text|html)$")
    track_opens: bool = False
    track_clicks: bool = False


class EmailMessageUpdate(BaseModel):
    is_read: Optional[bool] = None
    is_archived: Optional[bool] = None


# Schemas for Email Thread
class EmailThreadRead(BaseModel):
    id: UUID
    account_id: UUID
    subject: Optional[str] = None
    participants: list[EmailStr]
    message_count: int
    last_message_at: Optional[datetime] = None
    is_tracked: bool
    contact_id: Optional[UUID] = None
    deal_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmailThreadDetail(EmailThreadRead):
    messages: list[EmailMessageRead]


# Schemas for Email Tracking
class EmailTrackingRead(BaseModel):
    id: UUID
    message_id: UUID
    tracking_pixel_id: Optional[UUID] = None
    opened_at: Optional[datetime] = None
    open_count: int
    open_locations: list[dict[str, Any]]
    link_clicks: list[dict[str, Any]]
    created_at: datetime

    model_config = {"from_attributes": True}


# OAuth Callback
class OAuthCallbackRequest(BaseModel):
    code: str
    state: str


# Sync Request
class EmailSyncRequest(BaseModel):
    account_id: Optional[UUID] = None


class EmailSyncResponse(BaseModel):
    synced: int
    errors: int


# List Responses
class EmailAccountList(BaseModel):
    accounts: list[EmailAccountRead]


class EmailMessageList(BaseModel):
    messages: list[EmailMessageRead]
    next_cursor: Optional[str] = None


class EmailThreadList(BaseModel):
    threads: list[EmailThreadRead]
    next_cursor: Optional[str] = None
