"""private first ai security

Revision ID: bf5148e5b7d2
Revises: 9a4f1d2b8c13
Create Date: 2026-03-19 18:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bf5148e5b7d2"
down_revision: Union[str, None] = "9a4f1d2b8c13"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notes",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("author_user_id", sa.Uuid(), nullable=True),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", sa.String(length=120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("payload_meta", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["author_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notes_entity_type", "notes", ["entity_type"], unique=False)
    op.create_index("ix_notes_entity_id", "notes", ["entity_id"], unique=False)

    op.create_table(
        "ai_action_proposals",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("approved_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("rejected_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("thread_id", sa.String(length=255), nullable=False),
        sa.Column("trace_id", sa.String(length=64), nullable=False),
        sa.Column("action_type", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("target_entity_type", sa.String(length=80), nullable=True),
        sa.Column("target_entity_id", sa.String(length=120), nullable=True),
        sa.Column("action_payload", sa.JSON(), nullable=False),
        sa.Column("diff_payload", sa.JSON(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("rejection_reason", sa.String(length=500), nullable=True),
        sa.Column("last_error", sa.String(length=500), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["rejected_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_action_proposals_thread_id",
        "ai_action_proposals",
        ["thread_id"],
        unique=False,
    )
    op.create_index(
        "ix_ai_action_proposals_trace_id",
        "ai_action_proposals",
        ["trace_id"],
        unique=False,
    )
    op.create_index(
        "ix_ai_action_proposals_status",
        "ai_action_proposals",
        ["status"],
        unique=False,
    )

    op.create_table(
        "ai_action_executions",
        sa.Column("proposal_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("executed_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("trace_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("result_payload", sa.JSON(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["proposal_id"], ["ai_action_proposals.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["executed_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_action_executions_proposal_id",
        "ai_action_executions",
        ["proposal_id"],
        unique=False,
    )
    op.create_index(
        "ix_ai_action_executions_trace_id",
        "ai_action_executions",
        ["trace_id"],
        unique=False,
    )

    op.create_table(
        "ai_eval_runs",
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("trace_id", sa.String(length=64), nullable=False),
        sa.Column("suite_name", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_eval_runs_trace_id", "ai_eval_runs", ["trace_id"], unique=False)
    op.create_index("ix_ai_eval_runs_suite_name", "ai_eval_runs", ["suite_name"], unique=False)
    op.create_index(
        "ix_ai_eval_runs_organization_id",
        "ai_eval_runs",
        ["organization_id"],
        unique=False,
    )

    op.create_table(
        "ai_eval_samples",
        sa.Column("eval_run_id", sa.Uuid(), nullable=False),
        sa.Column("sample_name", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("prompt_snapshot", sa.Text(), nullable=False),
        sa.Column("grounding_snapshot", sa.JSON(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("proposed_actions", sa.JSON(), nullable=False),
        sa.Column("response_excerpt", sa.Text(), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["eval_run_id"], ["ai_eval_runs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_eval_samples_eval_run_id",
        "ai_eval_samples",
        ["eval_run_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_ai_eval_samples_eval_run_id", table_name="ai_eval_samples")
    op.drop_table("ai_eval_samples")

    op.drop_index("ix_ai_eval_runs_organization_id", table_name="ai_eval_runs")
    op.drop_index("ix_ai_eval_runs_suite_name", table_name="ai_eval_runs")
    op.drop_index("ix_ai_eval_runs_trace_id", table_name="ai_eval_runs")
    op.drop_table("ai_eval_runs")

    op.drop_index("ix_ai_action_executions_trace_id", table_name="ai_action_executions")
    op.drop_index("ix_ai_action_executions_proposal_id", table_name="ai_action_executions")
    op.drop_table("ai_action_executions")

    op.drop_index("ix_ai_action_proposals_status", table_name="ai_action_proposals")
    op.drop_index("ix_ai_action_proposals_trace_id", table_name="ai_action_proposals")
    op.drop_index("ix_ai_action_proposals_thread_id", table_name="ai_action_proposals")
    op.drop_table("ai_action_proposals")

    op.drop_index("ix_notes_entity_id", table_name="notes")
    op.drop_index("ix_notes_entity_type", table_name="notes")
    op.drop_table("notes")
