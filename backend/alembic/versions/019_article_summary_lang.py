"""Add lang column to article_summaries

Revision ID: 019
Revises: 018
Create Date: 2026-06-30

Adds a ``lang`` column to ``article_summaries`` so cached summaries are
isolated by language. The AI summary now follows the UI (i18n) language
instead of the article body language, so the unique constraint is widened
from ``(article_id, source, model)`` to ``(article_id, source, model, lang)``.
Existing rows default to ``en`` (matching the backend's default lang).
"""

from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "article_summaries",
        sa.Column("lang", sa.String(length=10), server_default="en", nullable=False),
    )
    op.drop_constraint(
        "uq_article_summaries_article_source_model",
        "article_summaries",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_article_summaries_article_source_model_lang",
        "article_summaries",
        ["article_id", "source", "model", "lang"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_article_summaries_article_source_model_lang",
        "article_summaries",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_article_summaries_article_source_model",
        "article_summaries",
        ["article_id", "source", "model"],
    )
    op.drop_column("article_summaries", "lang")
