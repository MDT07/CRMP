"""Add email integration tables

Revision ID: 59f76edd7bbe
Revises: d6f8b7a1c2d3
Create Date: 2026-03-31 00:50:46.636244
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "59f76edd7bbe"
down_revision: Union[str, None] = "d6f8b7a1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### Create Email Provider Enum ###
    op.execute("DROP TYPE IF EXISTS emailprovider;")
    op.execute("CREATE TYPE emailprovider AS ENUM ('gmail', 'outlook');")

    # ### Email Account Table ###
    op.create_table(
        "email_account",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "organization_id",
            sa.UUID(),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "provider",
            postgresql.ENUM("gmail", "outlook", name="emailprovider", create_type=False),
            nullable=False,
        ),
        sa.Column("email_address", sa.String(255), nullable=False),
        sa.Column("access_token_encrypted", sa.Text(), nullable=False),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=False),
        sa.Column("token_expires_at", sa.DateTime(timezone=True)),
        sa.Column("scopes", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("sync_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True)),
        sa.Column("sync_cursor", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "user_id", "provider", "email_address", name="uq_email_account_user_provider_email"
        ),
    )
    op.create_index("ix_email_account_user_id", "email_account", ["user_id"])
    op.create_index("ix_email_account_organization_id", "email_account", ["organization_id"])
    op.create_index("ix_email_account_provider", "email_account", ["provider"])

    # ### Email Thread Table ###
    op.create_table(
        "email_thread",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "account_id",
            sa.UUID(),
            sa.ForeignKey("email_account.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider_thread_id", sa.String(255), nullable=False),
        sa.Column("subject", sa.Text()),
        sa.Column("participants", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("message_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_message_at", sa.DateTime(timezone=True)),
        sa.Column("is_tracked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("contact_id", sa.UUID(), sa.ForeignKey("contacts.id", ondelete="SET NULL")),
        sa.Column("deal_id", sa.UUID(), sa.ForeignKey("deals.id", ondelete="SET NULL")),
        sa.Column("company_id", sa.UUID(), sa.ForeignKey("companies.id", ondelete="SET NULL")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "account_id", "provider_thread_id", name="uq_email_thread_account_provider"
        ),
    )
    op.create_index("ix_email_thread_account_id", "email_thread", ["account_id"])
    op.create_index("ix_email_thread_contact_id", "email_thread", ["contact_id"])
    op.create_index("ix_email_thread_deal_id", "email_thread", ["deal_id"])
    op.create_index("ix_email_thread_company_id", "email_thread", ["company_id"])
    op.create_index("ix_email_thread_last_message_at", "email_thread", ["last_message_at"])

    # ### Email Message Table ###
    op.create_table(
        "email_message",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "account_id",
            sa.UUID(),
            sa.ForeignKey("email_account.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("thread_id", sa.UUID(), sa.ForeignKey("email_thread.id", ondelete="CASCADE")),
        sa.Column("provider_message_id", sa.String(255), nullable=False),
        sa.Column("subject", sa.Text()),
        sa.Column("from_email", sa.String(255)),
        sa.Column("from_name", sa.String(255)),
        sa.Column("to_emails", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("cc_emails", postgresql.JSONB(), server_default="[]"),
        sa.Column("bcc_emails", postgresql.JSONB(), server_default="[]"),
        sa.Column("body_text", sa.Text()),
        sa.Column("body_html", sa.Text()),
        sa.Column("snippet", sa.Text()),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("received_at", sa.DateTime(timezone=True)),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_draft", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("labels", postgresql.JSONB(), server_default="[]"),
        sa.Column("contact_id", sa.UUID(), sa.ForeignKey("contacts.id", ondelete="SET NULL")),
        sa.Column("deal_id", sa.UUID(), sa.ForeignKey("deals.id", ondelete="SET NULL")),
        sa.Column("company_id", sa.UUID(), sa.ForeignKey("companies.id", ondelete="SET NULL")),
        sa.Column("has_attachments", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("attachments", postgresql.JSONB(), server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "account_id", "provider_message_id", name="uq_email_message_account_provider"
        ),
    )
    op.create_index("ix_email_message_account_id", "email_message", ["account_id"])
    op.create_index("ix_email_message_thread_id", "email_message", ["thread_id"])
    op.create_index("ix_email_message_contact_id", "email_message", ["contact_id"])
    op.create_index("ix_email_message_deal_id", "email_message", ["deal_id"])
    op.create_index("ix_email_message_company_id", "email_message", ["company_id"])
    op.create_index("ix_email_message_sent_at", "email_message", ["sent_at"])
    op.create_index("ix_email_message_received_at", "email_message", ["received_at"])
    op.create_index("ix_email_message_from_email", "email_message", ["from_email"])

    # ### Email Tracking Table ###
    op.create_table(
        "email_tracking",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "message_id",
            sa.UUID(),
            sa.ForeignKey("email_message.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tracking_pixel_id", sa.UUID(), unique=True),
        sa.Column("opened_at", sa.DateTime(timezone=True)),
        sa.Column("open_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("open_locations", postgresql.JSONB(), server_default="[]"),
        sa.Column("link_clicks", postgresql.JSONB(), server_default="[]"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_email_tracking_message_id", "email_tracking", ["message_id"])
    op.create_index("ix_email_tracking_pixel_id", "email_tracking", ["tracking_pixel_id"])


def downgrade() -> None:
    # ### Drop Email Tables ###
    op.drop_table("email_tracking")
    op.drop_table("email_message")
    op.drop_table("email_thread")
    op.drop_table("email_account")

    # ### Drop Email Provider Enum ###
    op.execute("DROP TYPE IF EXISTS emailprovider;")
