"""Add auto_translate, translate_target_lang to feeds and translate_default_lang to users

Revision ID: 011
Revises: 010
Create Date: 2026-06-06
"""

from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("feeds", sa.Column("auto_translate", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("feeds", sa.Column("translate_target_lang", sa.String(10), nullable=True))
    op.add_column("users", sa.Column("translate_default_lang", sa.String(10), server_default="zh", nullable=False))


def downgrade() -> None:
    op.drop_column("users", "translate_default_lang")
    op.drop_column("feeds", "translate_target_lang")
    op.drop_column("feeds", "auto_translate")
