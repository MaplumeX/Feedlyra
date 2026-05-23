from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    title: str = Field(max_length=200)


class CategoryUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)


class CategoryResponse(BaseModel):
    id: UUID
    title: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryWithCount(CategoryResponse):
    feed_count: int = 0
