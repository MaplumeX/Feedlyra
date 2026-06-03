"""Add auto_full_text column to feeds table

Revision ID: 009
Revises: 008
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("feeds", sa.Column("auto_full_text", sa.Boolean(), server_default="false", nullable=False))


def downgrade() -> None:
    op.drop_column("feeds", "auto_full_text")
