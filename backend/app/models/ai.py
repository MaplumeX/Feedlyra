from __future__ import annotations

from datetime import datetime
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


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


class ArticleChat(Base):
    __tablename__ = "article_chats"

    id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    article_id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    model: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="chat", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    chat_id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("article_chats.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(10), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    chat: Mapped["ArticleChat"] = relationship(back_populates="messages")
