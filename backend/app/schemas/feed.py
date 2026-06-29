from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FeedCreate(BaseModel):
    url: str = Field(max_length=2048)
    category_id: UUID | None = None
    auto_full_text: bool = False
    auto_translate: bool = False
    translate_target_lang: str | None = None


class FeedUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    category_id: UUID | None = None
    auto_full_text: bool | None = None
    auto_translate: bool | None = None
    translate_target_lang: str | None = None


class FeedResponse(BaseModel):
    id: UUID
    title: str
    url: str
    site_url: str | None
    icon_url: str | None = None
    description: str | None
    parsing_error_count: int
    parsing_error_message: str | None
    checked_at: datetime | None
    created_at: datetime
    auto_full_text: bool = False
    auto_translate: bool = False
    translate_target_lang: str | None = None

    model_config = {"from_attributes": True}


class FeedWithUnread(FeedResponse):
    unread_count: int = 0
    category_id: UUID | None = None
    category_name: str | None = None


class OPMLExportResponse(BaseModel):
    xml: str


class DiscoveredFeed(BaseModel):
    title: str | None
    url: str


class FeedDiscoveryRequest(BaseModel):
    url: str = Field(max_length=2048)


class BulkFeedMoveRequest(BaseModel):
    feed_ids: list[UUID] = Field(min_length=1)
    category_id: UUID | None = None


class BulkFeedDeleteRequest(BaseModel):
    feed_ids: list[UUID] = Field(min_length=1)


class BulkMoveResult(BaseModel):
    updated: list[UUID]
    not_found: list[UUID]


class BulkDeleteResult(BaseModel):
    deleted: list[UUID]
    not_found: list[UUID]
