"""add_ai_chat_messages_table_fixed

Revision ID: 8825e8e13f6e
Revises: 7d5c06f12e80
Create Date: 2026-04-05 07:16:36.869623
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision: str = '8825e8e13f6e'
down_revision: Union[str, None] = 'f7a8e9d3b4c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ai_chat_messages table
    op.create_table(
        'ai_chat_messages',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('session_id', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('user', 'assistant', 'system', name='aichatroles'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=False),
        sa.Column('token_count', sa.Integer(), nullable=True),
        sa.Column('model_used', sa.String(length=255), nullable=True),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.Index('ix_ai_chat_messages_session_id', 'session_id'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    # Drop ai_chat_messages table
    op.drop_table('ai_chat_messages')
    # Drop the enum type
    op.execute("DROP TYPE IF EXISTS aichatroles")
