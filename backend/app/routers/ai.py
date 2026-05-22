from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.dependencies import get_current_user, get_db
from app.models.ai import ArticleAIData, ArticleChat, ChatMessage
from app.models.article import Article
from app.models.feed import Feed
from app.models.user import User
from app.schemas.ai import (
    AIConfigResponse,
    AIConfigUpdate,
    ChatHistoryResponse,
    ChatMessageResponse,
    ChatRequest,
    SummarizeResponse,
    TranslateRequest,
    TranslateResponse,
)
from app.services.llm import (
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

    await db.commit()
    await db.refresh(user)

    return {
        "base_url": user.ai_base_url,
        "model": user.ai_model,
        "has_api_key": user.ai_api_key is not None,
    }


@router.get("/config", response_model=AIConfigResponse)
async def get_ai_config(
    user: User = Depends(get_current_user),
) -> dict:
    return {
        "base_url": user.ai_base_url,
        "model": user.ai_model,
        "has_api_key": user.ai_api_key is not None,
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
    article_id: str,
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

    # Check for cached summary
    ai_data_result = await db.execute(
        select(ArticleAIData).where(ArticleAIData.article_id == article_id)
    )
    ai_data = ai_data_result.scalar_one_or_none()

    model = get_user_model(user)

    if ai_data and ai_data.summary and ai_data.summary_model == model:
        return {"summary": ai_data.summary, "model": ai_data.summary_model}

    # Generate summary
    try:
        client = get_user_llm_client(user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    content = article.content or article.content_snippet or ""
    summary = await generate_summary(client, model, article.title, content)

    now = datetime.now(timezone.utc)

    if ai_data is None:
        ai_data = ArticleAIData(
            article_id=article_id,
            summary=summary,
            summary_model=model,
            summary_created_at=now,
        )
        db.add(ai_data)
    else:
        ai_data.summary = summary
        ai_data.summary_model = model
        ai_data.summary_created_at = now

    await db.commit()

    return {"summary": summary, "model": model}


@router.post("/articles/{article_id}/translate", response_model=TranslateResponse)
async def translate_article_endpoint(
    article_id: str,
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

    model = get_user_model(user)

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
        client = get_user_llm_client(user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    content = article.content or article.content_snippet or ""
    translated_title, translated_content = await translate_article(
        client, model, article.title, content, body.target_lang
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
    article_id: str,
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

    model = get_user_model(user)

    if chat is None:
        chat = ArticleChat(
            id=str(uuid.uuid4()),
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
        id=str(uuid.uuid4()),
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
    chat_history = [{"role": m.role, "content": m.content} for m in history_msgs]

    # Build messages for LLM
    content = article.content or article.content_snippet or ""
    messages = build_chat_messages(article.title, content, chat_history, body.message)

    # Create LLM client
    try:
        client = get_user_llm_client(user)
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
                    id=str(uuid.uuid4()),
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
    article_id: str,
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
        "chat_id": chat.id,
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
