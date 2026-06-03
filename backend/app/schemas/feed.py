from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FeedCreate(BaseModel):
    url: str = Field(max_length=2048)
    category_id: UUID | None = None
    auto_full_text: bool = False


class FeedUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    category_id: UUID | None = None
    auto_full_text: bool | None = None


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
