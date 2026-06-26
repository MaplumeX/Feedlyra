"""Add tool-call fields to chat_messages

Revision ID: 016
Revises: 015
Create Date: 2026-06-26
"""

from alembic import op
import sqlalchemy as sa


revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # tool_calls: assistant message may carry a list of tool_call deltas (JSON)
    op.add_column(
        "chat_messages",
        sa.Column("tool_calls", sa.JSON(), nullable=True),
    )
    # tool_call_id: when role='tool', links this result back to the tool_call id
    op.add_column(
        "chat_messages",
        sa.Column("tool_call_id", sa.String(), nullable=True),
    )
    # name: when role='tool', the tool function name
    op.add_column(
        "chat_messages",
        sa.Column("name", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("chat_messages", "name")
    op.drop_column("chat_messages", "tool_call_id")
    op.drop_column("chat_messages", "tool_calls")
