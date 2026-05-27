"""Add full_content column to articles

Revision ID: 006
Revises: 005
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column("full_content", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("articles", "full_content")
