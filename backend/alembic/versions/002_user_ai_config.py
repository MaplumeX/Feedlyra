"""Add ai_base_url, ai_api_key, ai_model columns to users table

Revision ID: 002
Revises: 001
Create Date: 2026-05-22
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("ai_base_url", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("ai_api_key", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("ai_model", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "ai_model")
    op.drop_column("users", "ai_api_key")
    op.drop_column("users", "ai_base_url")
