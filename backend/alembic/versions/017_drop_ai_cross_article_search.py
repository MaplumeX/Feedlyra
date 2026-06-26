"""Drop ai_cross_article_search toggle from users

Revision ID: 017
Revises: 016
Create Date: 2026-06-26

The "auto-retrieve related articles" setting was a toggle controlling whether
the agent loop exposed search/read tools to the model. With the agent loop now
always exposing tools (search_articles / list_articles / read_article are a
default AI capability), the column is dead and is dropped.
"""

from alembic import op
import sqlalchemy as sa


revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("users", "ai_cross_article_search")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "ai_cross_article_search",
            sa.Boolean(),
            server_default="true",
            nullable=False,
        ),
    )
