from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ArticleSummaryResponse(BaseModel):
    summary: str
    model: str
    content_hash: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ArticleResponse(BaseModel):
    id: UUID
    feed_id: UUID
    title: str
    url: str
    content: str | None
    full_content: str | None
    content_snippet: str | None
    image_url: str | None
    author: str | None
    published_at: datetime | None
    fetched_at: datetime
    is_read: bool = False
    is_starred: bool = False
    feed_title: str | None = None
    summary: str | None = None
    summary_model: str | None = None
    summaries: dict[str, ArticleSummaryResponse] = Field(default_factory=dict)
    translated_title: str | None = None
    translated_content: str | None = None
    translation_lang: str | None = None

    model_config = {"from_attributes": True}


class ArticleListResponse(BaseModel):
    items: list[ArticleResponse]
    total: int
    page: int
    limit: int
    next_cursor: str | None = None


class ReadToggle(BaseModel):
    read: bool


class StarToggle(BaseModel):
    starred: bool


class MarkAllRead(BaseModel):
    feed_id: UUID | None = None


class BatchRead(BaseModel):
    article_ids: list[UUID]
