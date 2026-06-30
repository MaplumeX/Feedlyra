from __future__ import annotations

from datetime import datetime
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ArticleAIData(Base):
    __tablename__ = "article_ai_data"

    article_id: Mapped[PyUUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True
    )
    summary: Mapped[str | None] = mapped_column(Text)
    summary_model: Mapped[str | None] = mapped_column(String(50))
    summary_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    translated_title: Mapped[str | None] = mapped_column(Text)
    translated_content: Mapped[str | None] = mapped_column(Text)
    translation_lang: Mapped[str | None] = mapped_column(String(10))
    translation_model: Mapped[str | None] = mapped_column(String(50))
    translation_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    article: Mapped["Article"] = relationship("Article", back_populates="ai_data")


class ArticleSummary(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "article_summaries"
    __table_args__ = (
        UniqueConstraint(
            "article_id", "source", "model", "lang",
            name="uq_article_summaries_article_source_model_lang",
        ),
    )

    article_id: Mapped[PyUUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False
    )
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    # UI language the summary was generated in (i18n code, e.g. "en"/"zh-CN").
    # Cache is isolated by lang so switching UI language re-fetches a fresh summary.
    lang: Mapped[str] = mapped_column(String(10), nullable=False)

    article: Mapped["Article"] = relationship("Article", back_populates="summary_rows")


class Conversation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "conversations"

    user_id: Mapped[PyUUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(200))
    history_summary: Mapped[str | None] = mapped_column(Text)

    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")
    references: Mapped[list["ConversationReference"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class ConversationReference(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "conversation_references"
    __table_args__ = (
        UniqueConstraint("conversation_id", "article_id", name="uq_conversation_references_conversation_article"),
    )

    conversation_id: Mapped[PyUUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    article_id: Mapped[PyUUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False
    )
    is_auto: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    conversation: Mapped["Conversation"] = relationship(back_populates="references")
    article: Mapped["Article"] = relationship(back_populates="conversation_references")


class ArticleChat(Base):
    __tablename__ = "article_chats"

    id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    article_id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    model: Mapped[str | None] = mapped_column(String(50))
    history_summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="chat", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    chat_id: Mapped[PyUUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("article_chats.id", ondelete="CASCADE"), nullable=True
    )
    conversation_id: Mapped[PyUUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=True
    )
    role: Mapped[str] = mapped_column(String(10), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # Agent tool-calling fields (migration 016). nullable: only present when the
    # message participates in a tool exchange.
    # - role='assistant' may carry tool_calls (the deltas it asked to run).
    # - role='tool' carries tool_call_id + name linking back to the call.
    tool_calls: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    tool_call_id: Mapped[str | None] = mapped_column(String, nullable=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)

    chat: Mapped["ArticleChat | None"] = relationship(back_populates="messages")
    conversation: Mapped["Conversation | None"] = relationship(back_populates="messages")
