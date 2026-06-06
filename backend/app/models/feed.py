from __future__ import annotations

from datetime import datetime
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, Integer
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Feed(TimestampMixin, Base):
    __tablename__ = "feeds"

    id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    site_url: Mapped[str | None] = mapped_column(String(2048))
    description: Mapped[str | None] = mapped_column(Text)
    etag_header: Mapped[str | None] = mapped_column(String(500))
    last_modified_header: Mapped[str | None] = mapped_column(String(500))
    icon_url: Mapped[str | None] = mapped_column(String(2048))
    parsing_error_count: Mapped[int] = mapped_column(Integer, default=0)
    parsing_error_message: Mapped[str | None] = mapped_column(Text)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    category_id: Mapped[PyUUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    auto_full_text: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    auto_translate: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    translate_target_lang: Mapped[str | None] = mapped_column(String(10))

    articles: Mapped[list["Article"]] = relationship("Article", back_populates="feed")
    category: Mapped["Category | None"] = relationship("Category", back_populates="feeds")
