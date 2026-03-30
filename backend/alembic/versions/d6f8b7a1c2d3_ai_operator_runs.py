"""ai operator runs

Revision ID: d6f8b7a1c2d3
Revises: c4d2d8a0f9b1
Create Date: 2026-03-20 09:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d6f8b7a1c2d3"
down_revision: Union[str, None] = "c4d2d8a0f9b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_agent_runs",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("trace_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("run_kind", sa.String(length=24), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("tone", sa.String(length=48), nullable=False),
        sa.Column("page", sa.String(length=120), nullable=True),
        sa.Column("route", sa.String(length=255), nullable=True),
        sa.Column("model", sa.String(length=160), nullable=True),
        sa.Column("output_mode", sa.String(length=24), nullable=True),
        sa.Column("selection_context", sa.JSON(), nullable=False),
        sa.Column("context_snapshot", sa.JSON(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("output_content", sa.Text(), nullable=True),
        sa.Column("error_detail", sa.String(length=500), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_agent_runs_organization_id",
        "ai_agent_runs",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_ai_agent_runs_requested_by_user_id",
        "ai_agent_runs",
        ["requested_by_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_ai_agent_runs_status",
        "ai_agent_runs",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_ai_agent_runs_trace_id",
        "ai_agent_runs",
        ["trace_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_ai_agent_runs_trace_id", table_name="ai_agent_runs")
    op.drop_index("ix_ai_agent_runs_status", table_name="ai_agent_runs")
    op.drop_index("ix_ai_agent_runs_requested_by_user_id", table_name="ai_agent_runs")
    op.drop_index("ix_ai_agent_runs_organization_id", table_name="ai_agent_runs")
    op.drop_table("ai_agent_runs")
