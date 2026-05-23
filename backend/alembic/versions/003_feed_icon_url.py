"""Add icon_url column to feeds table

Revision ID: 003
Revises: 002
Create Date: 2026-05-23
"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("feeds", sa.Column("icon_url", sa.String(2048), nullable=True))


def downgrade() -> None:
    op.drop_column("feeds", "icon_url")
