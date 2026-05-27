"""Add per-feature AI config columns to users table

Revision ID: 008
Revises: 007
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Translation
    op.add_column("users", sa.Column("translate_base_url", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("translate_api_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("translate_model", sa.String(100), nullable=True))
    # Summarization
    op.add_column("users", sa.Column("summary_base_url", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("summary_api_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("summary_model", sa.String(100), nullable=True))
    # Chat
    op.add_column("users", sa.Column("chat_base_url", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("chat_api_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("chat_model", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "chat_model")
    op.drop_column("users", "chat_api_key")
    op.drop_column("users", "chat_base_url")
    op.drop_column("users", "summary_model")
    op.drop_column("users", "summary_api_key")
    op.drop_column("users", "summary_base_url")
    op.drop_column("users", "translate_model")
    op.drop_column("users", "translate_api_key")
    op.drop_column("users", "translate_base_url")
