"""Add image_url column to articles

Revision ID: 005
Revises: 004
Create Date: 2026-05-24
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column("image_url", sa.String(2048), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("articles", "image_url")
