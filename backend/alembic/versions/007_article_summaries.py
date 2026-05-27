"""Add article summaries by content source

Revision ID: 007
Revises: 006
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PGUUID

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "article_summaries",
        sa.Column("id", PGUUID(as_uuid=True), primary_key=True),
        sa.Column(
            "article_id",
            PGUUID(as_uuid=True),
            sa.ForeignKey("articles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "article_id",
            "source",
            "model",
            name="uq_article_summaries_article_source_model",
        ),
    )

    op.execute(
        """
        INSERT INTO article_summaries (
            id,
            article_id,
            source,
            content_hash,
            summary,
            model,
            created_at,
            updated_at
        )
        SELECT
            (
                substr(md5(ai.article_id::text || ':feed:' || ai.summary_model), 1, 8)
                || '-' ||
                substr(md5(ai.article_id::text || ':feed:' || ai.summary_model), 9, 4)
                || '-' ||
                substr(md5(ai.article_id::text || ':feed:' || ai.summary_model), 13, 4)
                || '-' ||
                substr(md5(ai.article_id::text || ':feed:' || ai.summary_model), 17, 4)
                || '-' ||
                substr(md5(ai.article_id::text || ':feed:' || ai.summary_model), 21, 12)
            )::uuid,
            ai.article_id,
            'feed',
            md5(COALESCE(a.content, a.content_snippet, '')),
            ai.summary,
            ai.summary_model,
            COALESCE(ai.summary_created_at, now()),
            COALESCE(ai.summary_created_at, now())
        FROM article_ai_data ai
        JOIN articles a ON a.id = ai.article_id
        WHERE ai.summary IS NOT NULL
          AND ai.summary_model IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_table("article_summaries")
