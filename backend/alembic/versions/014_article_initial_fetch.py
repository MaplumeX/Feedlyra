"""Track articles created by a feed's initial fetch

Revision ID: 014
Revises: 013
Create Date: 2026-06-11
"""

from alembic import op
import sqlalchemy as sa


revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column(
            "is_initial_fetch",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("articles", "is_initial_fetch")
