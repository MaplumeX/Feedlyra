"""Add history_summary column to article_chats table

Revision ID: 010
Revises: 009
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("article_chats", sa.Column("history_summary", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("article_chats", "history_summary")
