from __future__ import annotations

from datetime import datetime

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    # Global AI config (fallback)
    ai_base_url: Mapped[str | None] = mapped_column(String(500))
    ai_api_key: Mapped[str | None] = mapped_column(Text)
    ai_model: Mapped[str | None] = mapped_column(String(100))
    # Per-feature AI config overrides
    translate_base_url: Mapped[str | None] = mapped_column(String(500))
    translate_api_key: Mapped[str | None] = mapped_column(Text)
    translate_model: Mapped[str | None] = mapped_column(String(100))
    summary_base_url: Mapped[str | None] = mapped_column(String(500))
    summary_api_key: Mapped[str | None] = mapped_column(Text)
    summary_model: Mapped[str | None] = mapped_column(String(100))
    chat_base_url: Mapped[str | None] = mapped_column(String(500))
    chat_api_key: Mapped[str | None] = mapped_column(Text)
    chat_model: Mapped[str | None] = mapped_column(String(100))
