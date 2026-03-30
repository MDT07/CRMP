"""projects outbox and automation runs

Revision ID: 9a4f1d2b8c13
Revises: e6c2c2515809
Create Date: 2026-03-19 12:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9a4f1d2b8c13"
down_revision: Union[str, None] = "e6c2c2515809"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("deal_id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "planned",
                "active",
                "on_hold",
                "completed",
                "cancelled",
                name="projectstatus",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("kickoff_date", sa.Date(), nullable=True),
        sa.Column("target_end_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("deal_id"),
    )

    op.create_table(
        "automation_rule_runs",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("rule_id", sa.Uuid(), nullable=False),
        sa.Column("source_event_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["rule_id"], ["automation_rules.id"]),
        sa.ForeignKeyConstraint(["source_event_id"], ["events.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_automation_rule_runs_rule_id",
        "automation_rule_runs",
        ["rule_id"],
        unique=False,
    )
    op.create_index(
        "ix_automation_rule_runs_executed_at",
        "automation_rule_runs",
        ["executed_at"],
        unique=False,
    )

    op.add_column("messages", sa.Column("project_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_messages_project_id_projects",
        "messages",
        "projects",
        ["project_id"],
        ["id"],
    )
    op.add_column("tasks", sa.Column("project_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_tasks_project_id_projects",
        "tasks",
        "projects",
        ["project_id"],
        ["id"],
    )

    op.add_column("events", sa.Column("processing_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("events", sa.Column("processing_error", sa.String(length=500), nullable=True))
    op.add_column(
        "events",
        sa.Column("failure_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.alter_column("events", "failure_count", server_default=None)


def downgrade() -> None:
    op.drop_column("events", "failure_count")
    op.drop_column("events", "processing_error")
    op.drop_column("events", "processing_started_at")

    op.drop_constraint("fk_tasks_project_id_projects", "tasks", type_="foreignkey")
    op.drop_column("tasks", "project_id")
    op.drop_constraint("fk_messages_project_id_projects", "messages", type_="foreignkey")
    op.drop_column("messages", "project_id")

    op.drop_index("ix_automation_rule_runs_executed_at", table_name="automation_rule_runs")
    op.drop_index("ix_automation_rule_runs_rule_id", table_name="automation_rule_runs")
    op.drop_table("automation_rule_runs")

    op.drop_table("projects")
