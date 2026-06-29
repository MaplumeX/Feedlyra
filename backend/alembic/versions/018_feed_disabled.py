"""Add disabled column to feeds table

Revision ID: 018
Revises: 017
Create Date: 2026-06-29

Adds a ``disabled`` flag to ``feeds`` so the feed scheduler can stop
auto-polling feeds whose parsing error count has reached the configured
limit (aligned with Miniflux's ``POLLING_PARSING_ERROR_LIMIT``). A manual
refresh resets the flag. Existing rows default to ``false``.
"""

from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "feeds",
        sa.Column("disabled", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("feeds", "disabled")
