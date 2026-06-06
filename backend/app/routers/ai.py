from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import delete as sql_delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.dependencies import get_current_user, get_db
from app.models.ai import ArticleAIData, ArticleSummary, ChatMessage, Conversation, ConversationReference
from app.models.article import Article
from app.models.feed import Feed
from app.models.user import User
from app.services.article_summary import (
    SUMMARY_SOURCE_FEED,
    SUMMARY_SOURCE_FULL,
    SummarySource,
    get_summary_content,
    get_summary_content_hash,
)
from app.schemas.ai import (
    AIConfigResponse,
    AIConfigUpdate,
    ChatHistoryResponse,
    ChatMessageResponse,
    ChatRequest,
    ConversationCreate,
    ConversationListResponse,
    ConversationReferenceCreate,
    ConversationReferenceResponse,
    ConversationResponse,
    ConversationUpdate,
    FeatureAIConfigResponse,
    FeatureAIConfigUpdate,
    ImageUploadResponse,
    SummarizeResponse,
    TranslateRequest,
    TranslateResponse,
    TruncateChatMessagesRequest,
)
from app.services.llm import (
    Feature,
    build_chat_messages,
    encrypt_api_key,
    generate_summary,
    get_user_llm_client,
    get_user_model,
    stream_chat,
    summarize_chat_history,
    translate_article,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB


def _validate_summary_source(source: str) -> SummarySource:
    if source in (SUMMARY_SOURCE_FEED, SUMMARY_SOURCE_FULL):
        return source
    raise HTTPException(status_code=400, detail="Invalid summary source")


def _build_feature_response(user: User, feature: Feature) -> FeatureAIConfigResponse:
    feature_base = getattr(user, f"{feature}_base_url")
    feature_key = getattr(user, f"{feature}_api_key")
    feature_model = getattr(user, f"{feature}_model")
    enabled = bool(feature_base or feature_key or feature_model)
    return FeatureAIConfigResponse(
        enabled=enabled,
        base_url=feature_base,
        model=feature_model,
        has_api_key=feature_key is not None,
    )


def _apply_feature_update(
    user: User,
    feature: Feature,
    update: FeatureAIConfigUpdate | None,
) -> None:
    if update is None:
        return
    if update.enabled is False:
        setattr(user, f"{feature}_base_url", None)
        setattr(user, f"{feature}_api_key", None)
        setattr(user, f"{feature}_model", None)
        return
    if update.base_url is not None:
        setattr(user, f"{feature}_base_url", update.base_url or None)
    if update.api_key is not None:
        setattr(user, f"{feature}_api_key", encrypt_api_key(update.api_key) if update.api_key else None)
    if update.model is not None:
        setattr(user, f"{feature}_model", update.model or None)


# ---------------------------------------------------------------------------
# AI Config endpoints
# ---------------------------------------------------------------------------

@router.put("/config", response_model=AIConfigResponse)
async def update_ai_config(
    body: AIConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if body.base_url is not None:
        user.ai_base_url = body.base_url
    if body.api_key is not None:
        user.ai_api_key = encrypt_api_key(body.api_key)
    if body.model is not None:
        user.ai_model = body.model
    if body.translate_default_lang is not None:
        user.translate_default_lang = body.translate_default_lang

    _apply_feature_update(user, "translate", body.translate)
    _apply_feature_update(user, "summary", body.summary)
    _apply_feature_update(user, "chat", body.chat)

    await db.commit()
    await db.refresh(user)

    return {
        "base_url": user.ai_base_url,
        "model": user.ai_model,
        "has_api_key": user.ai_api_key is not None,
        "translate_default_lang": user.translate_default_lang or "zh",
        "translate": _build_feature_response(user, "translate"),
        "summary": _build_feature_response(user, "summary"),
        "chat": _build_feature_response(user, "chat"),
    }


@router.get("/config", response_model=AIConfigResponse)
async def get_ai_config(
    user: User = Depends(get_current_user),
) -> dict:
    return {
        "base_url": user.ai_base_url,
        "model": user.ai_model,
        "has_api_key": user.ai_api_key is not None,
        "translate_default_lang": user.translate_default_lang or "zh",
        "translate": _build_feature_response(user, "translate"),
        "summary": _build_feature_response(user, "summary"),
        "chat": _build_feature_response(user, "chat"),
    }


@router.get("/effective-translate-lang/{feed_id}")
async def get_effective_translate_lang(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Resolve the effective target language for a feed.

    Priority: per-feed override -> global user default -> "zh"
    """
    result = await db.execute(
        select(Feed).where(Feed.id == feed_id, Feed.user_id == user.id)
    )
    feed = result.scalar_one_or_none()
    if feed is None:
        raise HTTPException(status_code=404, detail="Feed not found")

    effective_lang = feed.translate_target_lang or user.translate_default_lang or "zh"
    return {"target_lang": effective_lang}


@router.get("/test-connection")
async def test_ai_connection(
    user: User = Depends(get_current_user),
) -> dict:
    """Test the AI connection by making a minimal LLM API call."""
    try:
        client = get_user_llm_client(user)
        model = get_user_model(user)
        # Minimal completion request to verify API key and endpoint
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=5,
        )
        return {"status": "ok", "model": model}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")


# ---------------------------------------------------------------------------
# Summarize / Translate endpoints
# ---------------------------------------------------------------------------

@router.post("/articles/{article_id}/summarize", response_model=SummarizeResponse)
async def summarize_article(
    article_id: UUID,
    source: str = Query(default=SUMMARY_SOURCE_FEED),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    # Verify article belongs to user
    result = await db.execute(
        select(Article).join(Feed, Feed.id == Article.feed_id).where(
            Feed.user_id == user.id, Article.id == article_id
        )
    )
    article = result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    summary_source = _validate_summary_source(source)
    content = get_summary_content(article, summary_source)
    if summary_source == SUMMARY_SOURCE_FULL and not content:
        raise HTTPException(status_code=422, detail="Full content is not available")
    if not content:
        raise HTTPException(status_code=422, detail="Article content is not available")

    content_hash = get_summary_content_hash(content)

    model = get_user_model(user, "summary")

    # Check for cached summary
    summary_result = await db.execute(
        select(ArticleSummary).where(
            ArticleSummary.article_id == article_id,
            ArticleSummary.source == summary_source,
            ArticleSummary.model == model,
        )
    )
    article_summary = summary_result.scalar_one_or_none()

    if article_summary and article_summary.content_hash == content_hash:
        return {
            "summary": article_summary.summary,
            "model": article_summary.model,
            "source": article_summary.source,
            "content_hash": article_summary.content_hash,
        }

    # Generate summary
    try:
        client = get_user_llm_client(user, "summary")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    summary = await generate_summary(client, model, article.title, content)

    now = datetime.now(timezone.utc)

    if article_summary is None:
        article_summary = ArticleSummary(
            article_id=article_id,
            source=summary_source,
            content_hash=content_hash,
            summary=summary,
            model=model,
            created_at=now,
            updated_at=now,
        )
        db.add(article_summary)
    else:
        article_summary.summary = summary
        article_summary.content_hash = content_hash
        article_summary.updated_at = now

    await db.commit()

    return {
        "summary": summary,
        "model": model,
        "source": summary_source,
        "content_hash": content_hash,
    }


@router.post("/articles/{article_id}/translate", response_model=TranslateResponse)
async def translate_article_endpoint(
    article_id: UUID,
    body: TranslateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    # Verify article belongs to user
    result = await db.execute(
        select(Article).join(Feed, Feed.id == Article.feed_id).where(
            Feed.user_id == user.id, Article.id == article_id
        )
    )
    article = result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    # Check for cached translation
    ai_data_result = await db.execute(
        select(ArticleAIData).where(ArticleAIData.article_id == article_id)
    )
    ai_data = ai_data_result.scalar_one_or_none()

    model = get_user_model(user, "translate")

    if (
        ai_data
        and ai_data.translated_content
        and ai_data.translation_lang == body.target_lang
        and ai_data.translation_model == model
    ):
        return {
            "translated_title": ai_data.translated_title or article.title,
            "translated_content": ai_data.translated_content,
            "model": ai_data.translation_model,
            "lang": ai_data.translation_lang,
        }

    # Generate translation
    try:
        client = get_user_llm_client(user, "translate")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    translated_title, translated_content = await translate_article(
        client, model, article.title, article.readable_content, body.target_lang
    )

    now = datetime.now(timezone.utc)

    if ai_data is None:
        ai_data = ArticleAIData(
            article_id=article_id,
            translated_title=translated_title,
            translated_content=translated_content,
            translation_lang=body.target_lang,
            translation_model=model,
            translation_created_at=now,
        )
        db.add(ai_data)
    else:
        ai_data.translated_title = translated_title
        ai_data.translated_content = translated_content
        ai_data.translation_lang = body.target_lang
        ai_data.translation_model = model
        ai_data.translation_created_at = now

    await db.commit()

    return {
        "translated_title": translated_title,
        "translated_content": translated_content,
        "model": model,
        "lang": body.target_lang,
    }


# ---------------------------------------------------------------------------
# Conversation CRUD
# ---------------------------------------------------------------------------

@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """List user's conversations ordered by updated_at desc."""
    # Count total
    count_result = await db.execute(
        select(func.count(Conversation.id)).where(Conversation.user_id == user.id)
    )
    total = count_result.scalar() or 0

    # Fetch conversations with last message info via subquery
    last_msg_sub = (
        select(
            ChatMessage.conversation_id,
            func.max(ChatMessage.created_at).label("last_message_at"),
        )
        .group_by(ChatMessage.conversation_id)
        .subquery()
    )

    result = await db.execute(
        select(
            Conversation,
            last_msg_sub.c.last_message_at,
        )
        .outerjoin(last_msg_sub, Conversation.id == last_msg_sub.c.conversation_id)
        .where(Conversation.user_id == user.id)
        .order_by(func.coalesce(last_msg_sub.c.last_message_at, Conversation.updated_at).desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = result.all()

    items: list[dict] = []
    for conv, last_message_at in rows:
        # Get last message preview
        preview_result = await db.execute(
            select(ChatMessage.content)
            .where(ChatMessage.conversation_id == conv.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        )
        preview = preview_result.scalar_one_or_none()
        preview_text = (preview[:100] + "...") if preview and len(preview) > 100 else preview

        # Count references
        ref_count_result = await db.execute(
            select(func.count(ConversationReference.id)).where(
                ConversationReference.conversation_id == conv.id
            )
        )
        ref_count = ref_count_result.scalar() or 0

        items.append({
            "id": conv.id,
            "title": conv.title,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "last_message_preview": preview_text,
            "last_message_at": last_message_at,
            "references_count": ref_count,
        })

    return {"items": items, "total": total}


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    body: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Create a new conversation. If article_id provided, auto-create a reference."""
    conv = Conversation(
        user_id=user.id,
        title=body.title,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)

    # Auto-reference article if provided
    if body.article_id:
        # Verify article belongs to user
        article_result = await db.execute(
            select(Article).join(Feed, Feed.id == Article.feed_id).where(
                Feed.user_id == user.id, Article.id == body.article_id
            )
        )
        article = article_result.scalar_one_or_none()
        if article is None:
            raise HTTPException(status_code=404, detail="Article not found")

        ref = ConversationReference(
            conversation_id=conv.id,
            article_id=body.article_id,
            is_auto=True,
        )
        db.add(ref)
        await db.commit()

    # Re-read to get updated references count
    ref_count_result = await db.execute(
        select(func.count(ConversationReference.id)).where(
            ConversationReference.conversation_id == conv.id
        )
    )
    ref_count = ref_count_result.scalar() or 0

    return {
        "id": conv.id,
        "title": conv.title,
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "last_message_preview": None,
        "last_message_at": None,
        "references_count": ref_count,
    }


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get conversation details."""
    conv = await _get_owned_conversation(db, conversation_id, user.id)

    # Get last message info
    preview_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conv.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(1)
    )
    last_msg = preview_result.scalar_one_or_none()
    preview_text = None
    last_message_at = None
    if last_msg:
        preview_text = (last_msg.content[:100] + "...") if len(last_msg.content) > 100 else last_msg.content
        last_message_at = last_msg.created_at

    # Count references
    ref_count_result = await db.execute(
        select(func.count(ConversationReference.id)).where(
            ConversationReference.conversation_id == conv.id
        )
    )
    ref_count = ref_count_result.scalar() or 0

    return {
        "id": conv.id,
        "title": conv.title,
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "last_message_preview": preview_text,
        "last_message_at": last_message_at,
        "references_count": ref_count,
    }


@router.put("/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: UUID,
    body: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Update conversation (title)."""
    conv = await _get_owned_conversation(db, conversation_id, user.id)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(conv, field, value)
    await db.commit()
    await db.refresh(conv)

    # Get last message info
    preview_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conv.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(1)
    )
    last_msg = preview_result.scalar_one_or_none()
    preview_text = None
    last_message_at = None
    if last_msg:
        preview_text = (last_msg.content[:100] + "...") if len(last_msg.content) > 100 else last_msg.content
        last_message_at = last_msg.created_at

    # Count references
    ref_count_result = await db.execute(
        select(func.count(ConversationReference.id)).where(
            ConversationReference.conversation_id == conv.id
        )
    )
    ref_count = ref_count_result.scalar() or 0

    return {
        "id": conv.id,
        "title": conv.title,
        "created_at": conv.created_at,
        "updated_at": conv.updated_at,
        "last_message_preview": preview_text,
        "last_message_at": last_message_at,
        "references_count": ref_count,
    }


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Delete conversation and all messages/references. Also cleans up associated image files."""
    conv = await _get_owned_conversation(db, conversation_id, user.id)

    # Find and delete image files associated with messages in this conversation
    msgs_result = await db.execute(
        select(ChatMessage).where(ChatMessage.conversation_id == conv.id)
    )
    for msg in msgs_result.scalars().all():
        if msg.attachments:
            for att in msg.attachments:
                filename = att.get("filename") if isinstance(att, dict) else None
                if filename:
                    _delete_image_file(filename)

    await db.delete(conv)
    await db.commit()

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Conversation References
# ---------------------------------------------------------------------------

@router.get("/conversations/{conversation_id}/references", response_model=list[ConversationReferenceResponse])
async def list_conversation_references(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    """List references for a conversation."""
    conv = await _get_owned_conversation(db, conversation_id, user.id)

    result = await db.execute(
        select(ConversationReference)
        .where(ConversationReference.conversation_id == conv.id)
        .order_by(ConversationReference.created_at)
    )
    refs = result.scalars().all()

    # Fetch article titles
    items: list[dict] = []
    for ref in refs:
        article_result = await db.execute(
            select(Article.title).where(Article.id == ref.article_id)
        )
        article_title = article_result.scalar_one_or_none() or "Unknown Article"
        items.append({
            "id": ref.id,
            "article_id": ref.article_id,
            "article_title": article_title,
            "is_auto": ref.is_auto,
            "created_at": ref.created_at,
        })

    return items


@router.post("/conversations/{conversation_id}/references", response_model=ConversationReferenceResponse)
async def add_conversation_reference(
    conversation_id: UUID,
    body: ConversationReferenceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Add a reference to a conversation."""
    conv = await _get_owned_conversation(db, conversation_id, user.id)

    # Verify article belongs to user
    article_result = await db.execute(
        select(Article).join(Feed, Feed.id == Article.feed_id).where(
            Feed.user_id == user.id, Article.id == body.article_id
        )
    )
    article = article_result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    # Check for duplicate
    existing_result = await db.execute(
        select(ConversationReference).where(
            ConversationReference.conversation_id == conv.id,
            ConversationReference.article_id == body.article_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        # Already referenced — update is_auto if needed
        if body.is_auto and not existing.is_auto:
            existing.is_auto = True
            await db.commit()
        return {
            "id": existing.id,
            "article_id": existing.article_id,
            "article_title": article.title,
            "is_auto": existing.is_auto,
            "created_at": existing.created_at,
        }

    ref = ConversationReference(
        conversation_id=conv.id,
        article_id=body.article_id,
        is_auto=body.is_auto,
    )
    db.add(ref)
    await db.commit()
    await db.refresh(ref)

    return {
        "id": ref.id,
        "article_id": ref.article_id,
        "article_title": article.title,
        "is_auto": ref.is_auto,
        "created_at": ref.created_at,
    }


@router.delete("/conversations/{conversation_id}/references/{reference_id}")
async def remove_conversation_reference(
    conversation_id: UUID,
    reference_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Remove a reference from a conversation."""
    conv = await _get_owned_conversation(db, conversation_id, user.id)

    ref_result = await db.execute(
        select(ConversationReference).where(
            ConversationReference.id == reference_id,
            ConversationReference.conversation_id == conv.id,
        )
    )
    ref = ref_result.scalar_one_or_none()
    if ref is None:
        raise HTTPException(status_code=404, detail="Reference not found")

    await db.delete(ref)
    await db.commit()

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Conversation Chat
# ---------------------------------------------------------------------------

@router.post("/conversations/{conversation_id}/chat")
async def chat_with_conversation(
    conversation_id: UUID,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Stream a chat response for a conversation."""
    conv = await _get_owned_conversation(db, conversation_id, user.id)
    return await _do_conversation_chat(conv, body, db, user)


@router.get("/conversations/{conversation_id}/chat/history", response_model=ChatHistoryResponse)
async def get_conversation_chat_history(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get chat history for a conversation."""
    conv = await _get_owned_conversation(db, conversation_id, user.id)

    messages_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conv.id)
        .order_by(ChatMessage.created_at)
    )
    messages = messages_result.scalars().all()

    return {
        "chat_id": str(conv.id),
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "attachments": m.attachments,
                "created_at": m.created_at,
            }
            for m in messages
        ],
    }


@router.put("/conversations/{conversation_id}/chat/messages/truncate")
async def truncate_conversation_messages(
    conversation_id: UUID,
    body: TruncateChatMessagesRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Truncate chat messages from the specified one onwards.

    Deletes the anchor message and all subsequent messages, then invalidates
    the history summary cache. Used for message edit: after truncating, the
    caller sends a new chat request which creates a fresh user message.
    """
    conv = await _get_owned_conversation(db, conversation_id, user.id)

    # Find the anchor message
    anchor_result = await db.execute(
        select(ChatMessage).where(
            ChatMessage.id == body.after,
            ChatMessage.conversation_id == conv.id,
        )
    )
    anchor = anchor_result.scalar_one_or_none()
    if anchor is None:
        raise HTTPException(status_code=404, detail="Message not found")

    if anchor.role != "user":
        raise HTTPException(status_code=400, detail="Can only truncate from a user message")

    # Delete the anchor message and all messages after it
    await db.execute(
        sql_delete(ChatMessage).where(
            ChatMessage.conversation_id == conv.id,
            ChatMessage.created_at >= anchor.created_at,
        )
    )

    # Invalidate cached history summary since history changed
    conv.history_summary = None
    await db.commit()

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Image Upload & Serve
# ---------------------------------------------------------------------------

@router.post("/conversations/{conversation_id}/images", response_model=ImageUploadResponse)
async def upload_conversation_image(
    conversation_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Upload an image for a conversation."""
    conv = await _get_owned_conversation(db, conversation_id, user.id)

    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image type. Allowed: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}",
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image size exceeds 10MB limit")

    # Generate unique filename
    ext = file.content_type.split("/")[-1]
    if ext == "jpeg":
        ext = "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"

    # Save to disk
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / filename
    with open(file_path, "wb") as f:
        f.write(content)

    url = f"/api/ai/images/{filename}"

    return {
        "url": url,
        "filename": filename,
        "mime_type": file.content_type or "application/octet-stream",
        "size": len(content),
    }


@router.get("/images/{filename}")
async def serve_image(
    filename: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Serve uploaded image files. Verifies the user owns a conversation referencing this image."""
    from fastapi.responses import FileResponse

    # Prevent path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Verify the user owns at least one conversation.
    # Images are uploaded via conversation-scoped endpoints, so any authenticated
    # user with conversations can access images. For a more restrictive check,
    # query ChatMessage.attachments JSON for the filename.
    conv_result = await db.execute(
        select(Conversation.id).where(Conversation.user_id == user.id).limit(1)
    )
    if conv_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Image not found")

    file_path = Path(settings.UPLOAD_DIR) / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(file_path)


# ---------------------------------------------------------------------------
# Legacy article-scoped chat endpoints (backward compatibility)
# ---------------------------------------------------------------------------

@router.post("/articles/{article_id}/chat")
async def chat_with_article(
    article_id: UUID,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Legacy article-scoped chat. Internally creates/uses a conversation for the article."""
    # Verify article belongs to user
    result = await db.execute(
        select(Article).join(Feed, Feed.id == Article.feed_id).where(
            Feed.user_id == user.id, Article.id == article_id
        )
    )
    article = result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    # Find or create a conversation for this article
    # Look for a conversation that has a reference to this article
    ref_result = await db.execute(
        select(ConversationReference.conversation_id)
        .join(Conversation, Conversation.id == ConversationReference.conversation_id)
        .where(
            Conversation.user_id == user.id,
            ConversationReference.article_id == article_id,
        )
        .order_by(Conversation.updated_at.desc())
        .limit(1)
    )
    conv_id = ref_result.scalar_one_or_none()

    if conv_id is None:
        # Create a new conversation with this article as a reference
        conv = Conversation(
            user_id=user.id,
            title=f"Chat about: {article.title[:80]}",
        )
        db.add(conv)
        await db.commit()
        await db.refresh(conv)

        ref = ConversationReference(
            conversation_id=conv.id,
            article_id=article_id,
            is_auto=True,
        )
        db.add(ref)
        await db.commit()
        conv_id = conv.id

    # Re-dispatch to the conversation chat endpoint logic
    # Reuse the conversation chat handler
    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user.id)
    )
    conv = conv_result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return await _do_conversation_chat(conv, body, db, user)


@router.get("/articles/{article_id}/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Legacy article-scoped chat history. Returns conversation-based history."""
    # Verify article belongs to user
    result = await db.execute(
        select(Article).join(Feed, Feed.id == Article.feed_id).where(
            Feed.user_id == user.id, Article.id == article_id
        )
    )
    article = result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    # Find conversation for this article
    ref_result = await db.execute(
        select(ConversationReference.conversation_id)
        .join(Conversation, Conversation.id == ConversationReference.conversation_id)
        .where(
            Conversation.user_id == user.id,
            ConversationReference.article_id == article_id,
        )
        .order_by(Conversation.updated_at.desc())
        .limit(1)
    )
    conv_id = ref_result.scalar_one_or_none()

    if conv_id is None:
        return {"chat_id": "", "messages": []}

    # Return conversation-based history
    messages_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conv_id)
        .order_by(ChatMessage.created_at)
    )
    messages = messages_result.scalars().all()

    return {
        "chat_id": str(conv_id),
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "attachments": m.attachments,
                "created_at": m.created_at,
            }
            for m in messages
        ],
    }


@router.put("/articles/{article_id}/chat/messages/truncate")
async def truncate_chat_messages(
    article_id: UUID,
    body: TruncateChatMessagesRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Legacy article-scoped message truncation."""
    # Verify article belongs to user
    result = await db.execute(
        select(Article).join(Feed, Feed.id == Article.feed_id).where(
            Feed.user_id == user.id, Article.id == article_id
        )
    )
    article = result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    # Find conversation for this article
    ref_result = await db.execute(
        select(ConversationReference.conversation_id)
        .join(Conversation, Conversation.id == ConversationReference.conversation_id)
        .where(
            Conversation.user_id == user.id,
            ConversationReference.article_id == article_id,
        )
        .order_by(Conversation.updated_at.desc())
        .limit(1)
    )
    conv_id = ref_result.scalar_one_or_none()
    if conv_id is None:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Find the anchor message
    anchor_result = await db.execute(
        select(ChatMessage).where(ChatMessage.id == body.after, ChatMessage.conversation_id == conv_id)
    )
    anchor = anchor_result.scalar_one_or_none()
    if anchor is None:
        raise HTTPException(status_code=404, detail="Message not found")

    if anchor.role != "user":
        raise HTTPException(status_code=400, detail="Can only truncate from a user message")

    # Delete the anchor message and all messages after it
    await db.execute(
        sql_delete(ChatMessage).where(
            ChatMessage.conversation_id == conv_id,
            ChatMessage.created_at >= anchor.created_at,
        )
    )

    # Invalidate cached history summary since history changed
    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id)
    )
    conv = conv_result.scalar_one_or_none()
    if conv:
        conv.history_summary = None
    await db.commit()

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_owned_conversation(
    db: AsyncSession, conversation_id: UUID, user_id: UUID
) -> Conversation:
    """Get a conversation owned by the user, or raise 404."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        )
    )
    conv = result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


async def _do_conversation_chat(
    conv: Conversation,
    body: ChatRequest,
    db: AsyncSession,
    user: User,
):
    """Shared chat logic for both conversation and legacy article endpoints."""
    from fastapi.responses import StreamingResponse

    # Get all referenced articles
    refs_result = await db.execute(
        select(ConversationReference)
        .where(ConversationReference.conversation_id == conv.id)
    )
    refs = refs_result.scalars().all()

    articles_data: list[dict] = []
    for ref in refs:
        article_result = await db.execute(
            select(Article).join(Feed, Feed.id == Article.feed_id).where(
                Feed.user_id == user.id, Article.id == ref.article_id
            )
        )
        article = article_result.scalar_one_or_none()
        if article:
            articles_data.append({
                "title": article.title,
                "content": article.readable_content,
            })

    # Store user message with attachment metadata
    attachments_data: list[dict] | None = None
    if body.images:
        attachments_data = []
        for img in body.images:
            if img.startswith("/api/ai/images/"):
                # Uploaded image reference
                filename = img.rsplit("/", 1)[-1]
                attachments_data.append({"type": "image", "source": "upload", "filename": filename, "url": img})
            elif img.startswith("data:"):
                # Inline base64 image
                attachments_data.append({"type": "image", "source": "inline"})
            else:
                # URL-based image
                attachments_data.append({"type": "image", "source": "url", "url": img})

    user_msg = ChatMessage(
        id=uuid.uuid4(),
        conversation_id=conv.id,
        role="user",
        content=body.message,
        attachments=attachments_data,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user_msg)
    await db.commit()

    # Auto-generate title from first user message
    if not conv.title:
        conv.title = body.message[:100] + ("..." if len(body.message) > 100 else "")
        await db.commit()

    # Get chat history
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conv.id)
        .order_by(ChatMessage.created_at)
    )
    history_msgs = history_result.scalars().all()
    if history_msgs and history_msgs[-1].id == user_msg.id:
        history_msgs = history_msgs[:-1]
    chat_history_dicts = [{"role": m.role, "content": m.content} for m in history_msgs]

    # Determine history summary and trimmed history
    HISTORY_FULL_TURNS = 6
    SUMMARY_THRESHOLD = 8
    history_summary = conv.history_summary
    if len(chat_history_dicts) > SUMMARY_THRESHOLD * 2:
        older = chat_history_dicts[:-HISTORY_FULL_TURNS * 2]
        recent = chat_history_dicts[-HISTORY_FULL_TURNS * 2:]
        if not history_summary and older:
            try:
                client_for_summary = get_user_llm_client(user, "chat")
                model_for_summary = get_user_model(user, "chat")
                history_summary = await summarize_chat_history(client_for_summary, model_for_summary, older)
                conv.history_summary = history_summary
                await db.commit()
            except ValueError:
                logger.warning("Failed to summarize chat history (missing API config), proceeding without summary")
            except Exception:
                logger.exception("Failed to summarize chat history, proceeding without summary")
        chat_history_dicts = recent

    # Build messages for LLM
    messages = build_chat_messages(
        chat_history=chat_history_dicts,
        new_message=body.message,
        history_summary=history_summary,
        articles=articles_data if articles_data else None,
        images=body.images,
    )

    # Create LLM client
    try:
        client = get_user_llm_client(user, "chat")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    model = get_user_model(user, "chat")

    # Collect full response for storage
    full_response_parts: list[str] = []
    conv_id = conv.id

    async def event_stream():
        try:
            async for chunk in stream_chat(client, model, messages):
                full_response_parts.append(chunk)
                data = json.dumps({"content": chunk})
                yield f"data: {data}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("Error during chat streaming")
            error_data = json.dumps({"error": str(e)})
            yield f"data: {error_data}\n\n"
            yield "data: [DONE]\n\n"

        # Store assistant message after streaming completes
        full_response = "".join(full_response_parts)
        if full_response:
            async with async_session() as store_db:
                assistant_msg = ChatMessage(
                    id=uuid.uuid4(),
                    conversation_id=conv_id,
                    role="assistant",
                    content=full_response,
                    created_at=datetime.now(timezone.utc),
                )
                store_db.add(assistant_msg)
                await store_db.commit()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _delete_image_file(filename: str) -> None:
    """Delete an image file from disk, ignoring errors."""
    try:
        file_path = Path(settings.UPLOAD_DIR) / filename
        if file_path.exists():
            file_path.unlink()
    except Exception:
        logger.warning("Failed to delete image file %s", filename)
