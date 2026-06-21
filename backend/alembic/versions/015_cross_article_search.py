"""Add ai_cross_article_search toggle to users

Revision ID: 015
Revises: 014
Create Date: 2026-06-21
"""

from alembic import op
import sqlalchemy as sa


revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "ai_cross_article_search",
            sa.Boolean(),
            server_default="true",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "ai_cross_article_search")
