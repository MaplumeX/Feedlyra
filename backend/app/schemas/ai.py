from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SummarizeResponse(BaseModel):
    summary: str
    model: str


class TranslateRequest(BaseModel):
    target_lang: str = Field(default="zh", max_length=10)


class TranslateResponse(BaseModel):
    translated_title: str
    translated_content: str
    model: str
    lang: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10000)


class ChatMessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    chat_id: str
    messages: list[ChatMessageResponse]


class AIConfigUpdate(BaseModel):
    base_url: str | None = Field(default=None, max_length=500)
    api_key: str | None = Field(default=None, max_length=255)
    model: str | None = Field(default=None, max_length=100)


class AIConfigResponse(BaseModel):
    base_url: str | None
    model: str | None
    has_api_key: bool
