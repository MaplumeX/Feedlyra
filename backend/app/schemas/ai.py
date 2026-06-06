from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SummarizeResponse(BaseModel):
    summary: str
    model: str
    source: str
    content_hash: str


class TranslateRequest(BaseModel):
    target_lang: str = Field(default="zh", max_length=10)


class TranslateResponse(BaseModel):
    translated_title: str
    translated_content: str
    model: str
    lang: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10000)
    images: list[str] | None = None  # base64 encoded image data OR uploaded image URLs


class ChatMessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    attachments: list[dict] | None = None
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    chat_id: str
    messages: list[ChatMessageResponse]


class TruncateChatMessagesRequest(BaseModel):
    after: UUID


class ConversationCreate(BaseModel):
    title: str | None = None
    article_id: UUID | None = None


class ConversationUpdate(BaseModel):
    title: str | None = None


class ConversationResponse(BaseModel):
    id: UUID
    title: str | None
    created_at: datetime
    updated_at: datetime
    last_message_preview: str | None = None
    last_message_at: datetime | None = None
    references_count: int = 0


class ConversationListResponse(BaseModel):
    items: list[ConversationResponse]
    total: int


class ConversationReferenceCreate(BaseModel):
    article_id: UUID
    is_auto: bool = False


class ConversationReferenceResponse(BaseModel):
    id: UUID
    article_id: UUID
    article_title: str
    is_auto: bool
    created_at: datetime


class ImageUploadResponse(BaseModel):
    url: str
    filename: str
    mime_type: str
    size: int


class FeatureAIConfigUpdate(BaseModel):
    enabled: bool | None = None
    base_url: str | None = Field(default=None, max_length=500)
    api_key: str | None = Field(default=None, max_length=255)
    model: str | None = Field(default=None, max_length=100)


class AIConfigUpdate(BaseModel):
    base_url: str | None = Field(default=None, max_length=500)
    api_key: str | None = Field(default=None, max_length=255)
    model: str | None = Field(default=None, max_length=100)
    translate: FeatureAIConfigUpdate | None = None
    summary: FeatureAIConfigUpdate | None = None
    chat: FeatureAIConfigUpdate | None = None


class FeatureAIConfigResponse(BaseModel):
    enabled: bool
    base_url: str | None
    model: str | None
    has_api_key: bool


class AIConfigResponse(BaseModel):
    base_url: str | None
    model: str | None
    has_api_key: bool
    translate: FeatureAIConfigResponse
    summary: FeatureAIConfigResponse
    chat: FeatureAIConfigResponse
