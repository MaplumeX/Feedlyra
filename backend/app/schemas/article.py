from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ArticleResponse(BaseModel):
    id: str
    feed_id: str
    title: str
    url: str
    content: str | None
    content_snippet: str | None
    author: str | None
    published_at: datetime | None
    fetched_at: datetime
    is_read: bool = False
    is_starred: bool = False
    feed_title: str | None = None
    summary: str | None = None
    summary_model: str | None = None
    translated_title: str | None = None
    translated_content: str | None = None
    translation_lang: str | None = None

    model_config = {"from_attributes": True}


class ArticleListResponse(BaseModel):
    items: list[ArticleResponse]
    total: int
    page: int
    limit: int


class ReadToggle(BaseModel):
    read: bool


class StarToggle(BaseModel):
    starred: bool


class MarkAllRead(BaseModel):
    feed_id: str | None = None
