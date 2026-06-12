from __future__ import annotations

from datetime import datetime
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    feed_id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("feeds.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(1000), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    full_content: Mapped[str | None] = mapped_column(Text)
    content_snippet: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(2048))
    author: Mapped[str | None] = mapped_column(String(255))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_initial_fetch: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )

    feed: Mapped["Feed"] = relationship(back_populates="articles")
    ai_data: Mapped["ArticleAIData | None"] = relationship(
        "ArticleAIData", back_populates="article", uselist=False
    )
    summary_rows: Mapped[list["ArticleSummary"]] = relationship(
        "ArticleSummary", back_populates="article", cascade="all, delete-orphan"
    )
    conversation_references: Mapped[list["ConversationReference"]] = relationship(
        "ConversationReference", back_populates="article", cascade="all, delete-orphan"
    )

    @property
    def readable_content(self) -> str:
        return self.full_content or self.content or self.content_snippet or ""


class ReadStatus(Base):
    __tablename__ = "read_status"

    user_id: Mapped[PyUUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    article_id: Mapped[PyUUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True
    )
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class StarredArticle(Base):
    __tablename__ = "starred_articles"

    user_id: Mapped[PyUUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    article_id: Mapped[PyUUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True
    )
    starred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
