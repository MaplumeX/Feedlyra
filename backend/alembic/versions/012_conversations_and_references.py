"""Add conversations and conversation_references tables, update chat_messages

Revision ID: 012
Revises: 011
Create Date: 2026-06-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create conversations table
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column("history_summary", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_conversations_user_id", "conversations", ["user_id"])

    # 2. Create conversation_references table
    op.create_table(
        "conversation_references",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "article_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("articles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("is_auto", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "conversation_id", "article_id", name="uq_conversation_references_conversation_article"
        ),
    )
    op.create_index(
        "ix_conversation_references_conversation_id",
        "conversation_references",
        ["conversation_id"],
    )
    op.create_index(
        "ix_conversation_references_article_id",
        "conversation_references",
        ["article_id"],
    )

    # 3. Add conversation_id column to chat_messages (nullable initially)
    op.add_column(
        "chat_messages",
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )

    # 4. Add attachments column to chat_messages
    op.add_column(
        "chat_messages",
        sa.Column("attachments", postgresql.JSON(), nullable=True),
    )

    # 5. Migrate existing article_chats data into conversations
    # For each article_chat, create a conversation and link its messages.
    op.execute(
        """
        INSERT INTO conversations (id, user_id, title, history_summary, created_at, updated_at)
        SELECT
            ac.id,
            ac.user_id,
            a.title,
            ac.history_summary,
            ac.created_at,
            ac.created_at
        FROM article_chats ac
        JOIN articles a ON a.id = ac.article_id
        """
    )

    # 6. Link existing chat_messages to their new conversations
    op.execute(
        """
        UPDATE chat_messages cm
        SET conversation_id = cm.chat_id
        WHERE cm.chat_id IS NOT NULL
        """
    )

    # 7. Create conversation_references from migrated article_chats
    op.execute(
        """
        INSERT INTO conversation_references (id, conversation_id, article_id, is_auto, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            ac.id,
            ac.article_id,
            true,
            ac.created_at,
            ac.created_at
        FROM article_chats ac
        """
    )

    # 8. Make chat_id nullable (messages now belong to conversations instead)
    op.alter_column("chat_messages", "chat_id", nullable=True)


def downgrade() -> None:
    # Delete conversation-owned messages (they have no chat_id) before making chat_id NOT NULL
    op.execute("DELETE FROM chat_messages WHERE chat_id IS NULL")

    # Revert chat_id to NOT NULL (only safe after deleting conversation-owned messages)
    op.alter_column("chat_messages", "chat_id", nullable=False)

    # Drop new columns from chat_messages
    op.drop_column("chat_messages", "attachments")
    op.drop_column("chat_messages", "conversation_id")

    # Drop conversation_references
    op.drop_index("ix_conversation_references_article_id")
    op.drop_index("ix_conversation_references_conversation_id")
    op.drop_table("conversation_references")

    # Drop conversations
    op.drop_index("ix_conversations_user_id")
    op.drop_table("conversations")
