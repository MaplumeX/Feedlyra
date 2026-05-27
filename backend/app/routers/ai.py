from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.dependencies import get_current_user, get_db
from app.models.ai import ArticleAIData, ArticleChat, ArticleSummary, ChatMessage
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
    FeatureAIConfigResponse,
    FeatureAIConfigUpdate,
    SummarizeResponse,
    TranslateRequest,
    TranslateResponse,
)
from app.services.llm import (
    Feature,
    build_chat_messages,
    encrypt_api_key,
    generate_summary,
    get_user_llm_client,
    get_user_model,
    stream_chat,
    translate_article,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])


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

    _apply_feature_update(user, "translate", body.translate)
    _apply_feature_update(user, "summary", body.summary)
    _apply_feature_update(user, "chat", body.chat)

    await db.commit()
    await db.refresh(user)

    return {
        "base_url": user.ai_base_url,
        "model": user.ai_model,
        "has_api_key": user.ai_api_key is not None,
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
        "translate": _build_feature_response(user, "translate"),
        "summary": _build_feature_response(user, "summary"),
        "chat": _build_feature_response(user, "chat"),
    }


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


@router.post("/articles/{article_id}/chat")
async def chat_with_article(
    article_id: UUID,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse

    # Verify article belongs to user
    result = await db.execute(
        select(Article).join(Feed, Feed.id == Article.feed_id).where(
            Feed.user_id == user.id, Article.id == article_id
        )
    )
    article = result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    # Get or create chat
    chat_result = await db.execute(
        select(ArticleChat).where(
            ArticleChat.article_id == article_id,
            ArticleChat.user_id == user.id,
        )
    )
    chat = chat_result.scalar_one_or_none()

    model = get_user_model(user, "chat")

    if chat is None:
        chat = ArticleChat(
            id=uuid.uuid4(),
            article_id=article_id,
            user_id=user.id,
            model=model,
            created_at=datetime.now(timezone.utc),
        )
        db.add(chat)
        await db.commit()
        await db.refresh(chat)

    # Store user message
    user_msg = ChatMessage(
        id=uuid.uuid4(),
        chat_id=chat.id,
        role="user",
        content=body.message,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user_msg)
    await db.commit()

    # Get chat history
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.chat_id == chat.id)
        .order_by(ChatMessage.created_at)
    )
    history_msgs = history_result.scalars().all()
    if history_msgs and history_msgs[-1].id == user_msg.id:
        history_msgs = history_msgs[:-1]
    chat_history = [{"role": m.role, "content": m.content} for m in history_msgs]

    # Build messages for LLM
    messages = build_chat_messages(article.title, article.readable_content, chat_history, body.message)

    # Create LLM client
    try:
        client = get_user_llm_client(user, "chat")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Collect full response for storage
    full_response_parts: list[str] = []
    chat_id = chat.id

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
        # Use a separate session since the request db session may be closed
        full_response = "".join(full_response_parts)
        if full_response:
            async with async_session() as store_db:
                assistant_msg = ChatMessage(
                    id=uuid.uuid4(),
                    chat_id=chat_id,
                    role="assistant",
                    content=full_response,
                    created_at=datetime.now(timezone.utc),
                )
                store_db.add(assistant_msg)
                await store_db.commit()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/articles/{article_id}/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    article_id: UUID,
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

    chat_result = await db.execute(
        select(ArticleChat).where(
            ArticleChat.article_id == article_id,
            ArticleChat.user_id == user.id,
        )
    )
    chat = chat_result.scalar_one_or_none()

    if chat is None:
        return {"chat_id": "", "messages": []}

    messages_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.chat_id == chat.id)
        .order_by(ChatMessage.created_at)
    )
    messages = messages_result.scalars().all()

    return {
        "chat_id": str(chat.id),
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at,
            }
            for m in messages
        ],
    }
