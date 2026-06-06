from __future__ import annotations

import base64
import binascii
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.sql import Select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.article import Article, ReadStatus, StarredArticle
from app.models.ai import ArticleAIData, ArticleSummary
from app.models.feed import Feed
from app.models.user import User
from app.schemas.article import (
    ArticleListResponse,
    ArticleResponse,
    ArticleSummaryResponse,
    BatchRead,
    MarkAllRead,
    ReadToggle,
    StarToggle,
)
from app.services.feed_fetcher import _fetch_and_extract_content, _html_to_text
from app.services.article_summary import SUMMARY_SOURCE_FEED
from app.services.llm import get_user_model

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/articles", tags=["articles"])


@dataclass(frozen=True)
class ArticleCursor:
    published_at: datetime | None
    created_at: datetime
    article_id: UUID
    page: int


def _encode_article_cursor(article: Article, page: int) -> str:
    payload = {
        "published_at": article.published_at.isoformat() if article.published_at else None,
        "created_at": article.created_at.isoformat(),
        "article_id": str(article.id),
        "page": page,
    }
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode()
    return encoded.rstrip("=")


def _decode_article_cursor(value: str) -> ArticleCursor:
    try:
        padding = "=" * (-len(value) % 4)
        payload = json.loads(base64.urlsafe_b64decode(value + padding))
        if not isinstance(payload, dict):
            raise ValueError

        published_at_raw = payload.get("published_at")
        if published_at_raw is not None and not isinstance(published_at_raw, str):
            raise ValueError
        published_at = (
            datetime.fromisoformat(published_at_raw)
            if isinstance(published_at_raw, str)
            else None
        )
        created_at_raw = payload.get("created_at")
        article_id_raw = payload.get("article_id")
        page_raw = payload.get("page")
        if (
            not isinstance(created_at_raw, str)
            or not isinstance(article_id_raw, str)
            or not isinstance(page_raw, int)
            or page_raw < 2
        ):
            raise ValueError

        created_at = datetime.fromisoformat(created_at_raw)
        if created_at.utcoffset() is None:
            raise ValueError
        if published_at is not None and published_at.utcoffset() is None:
            raise ValueError

        return ArticleCursor(
            published_at=published_at,
            created_at=created_at,
            article_id=UUID(article_id_raw),
            page=page_raw,
        )
    except (ValueError, TypeError, json.JSONDecodeError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail="Invalid article cursor") from exc


def _apply_article_cursor(query: Select, cursor: ArticleCursor) -> Select:
    tie_breaker = or_(
        Article.created_at < cursor.created_at,
        and_(
            Article.created_at == cursor.created_at,
            Article.id < cursor.article_id,
        ),
    )
    if cursor.published_at is None:
        return query.where(Article.published_at.is_(None), tie_breaker)

    return query.where(
        or_(
            Article.published_at < cursor.published_at,
            Article.published_at.is_(None),
            and_(
                Article.published_at == cursor.published_at,
                tie_breaker,
            ),
        )
    )


def _apply_ai_data(item: ArticleResponse, ai_data: ArticleAIData | None) -> None:
    if not ai_data:
        return
    item.translated_title = ai_data.translated_title
    item.translated_content = ai_data.translated_content
    item.translation_lang = ai_data.translation_lang


def _summary_response(summary: ArticleSummary) -> ArticleSummaryResponse:
    return ArticleSummaryResponse(
        summary=summary.summary,
        model=summary.model,
        content_hash=summary.content_hash,
        created_at=summary.created_at,
    )


def _apply_summaries(item: ArticleResponse, summaries: list[ArticleSummary]) -> None:
    item.summaries = {summary.source: _summary_response(summary) for summary in summaries}
    feed_summary = item.summaries.get(SUMMARY_SOURCE_FEED)
    item.summary = feed_summary.summary if feed_summary else None
    item.summary_model = feed_summary.model if feed_summary else None


async def _build_article_response(
    article: Article, user: User, db: AsyncSession, feed_title: str | None = None
) -> ArticleResponse:
    """Build a full ArticleResponse with read/starred/ai_data enriched."""
    if feed_title is None:
        feed_result = await db.execute(select(Feed.title).where(Feed.id == article.feed_id))
        feed_title = feed_result.scalar()

    read_result = await db.execute(
        select(ReadStatus).where(
            ReadStatus.user_id == user.id, ReadStatus.article_id == article.id
        )
    )
    is_read = read_result.scalar_one_or_none() is not None

    starred_result = await db.execute(
        select(StarredArticle).where(
            StarredArticle.user_id == user.id, StarredArticle.article_id == article.id
        )
    )
    is_starred = starred_result.scalar_one_or_none() is not None

    ai_data_result = await db.execute(
        select(ArticleAIData).where(ArticleAIData.article_id == article.id)
    )
    ai_data = ai_data_result.scalar_one_or_none()

    item = ArticleResponse.model_validate(article)
    item.is_read = is_read
    item.is_starred = is_starred
    item.feed_title = feed_title
    model = get_user_model(user, "summary")
    summaries_result = await db.execute(
        select(ArticleSummary).where(
            ArticleSummary.article_id == article.id,
            ArticleSummary.model == model,
        )
    )
    summaries = list(summaries_result.scalars().all())

    _apply_ai_data(item, ai_data)
    _apply_summaries(item, summaries)
    return item


@router.get("", response_model=ArticleListResponse)
async def list_articles(
    feed_id: UUID | None = Query(None),
    read_status: str | None = Query(None),
    starred: bool | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    query = (
        select(Article, Feed.title.label("feed_title"))
        .join(Feed, Feed.id == Article.feed_id)
        .where(Feed.user_id == user.id)
    )

    if feed_id:
        query = query.where(Article.feed_id == feed_id)

    if read_status == "unread":
        query = query.outerjoin(
            ReadStatus,
            (ReadStatus.article_id == Article.id) & (ReadStatus.user_id == user.id),
        ).where(ReadStatus.article_id.is_(None))
    elif read_status == "read":
        query = query.join(
            ReadStatus,
            (ReadStatus.article_id == Article.id) & (ReadStatus.user_id == user.id),
        )

    if starred is True:
        query = query.join(
            StarredArticle,
            (StarredArticle.article_id == Article.id) & (StarredArticle.user_id == user.id),
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    response_page = page
    if cursor:
        decoded_cursor = _decode_article_cursor(cursor)
        query = _apply_article_cursor(query, decoded_cursor)
        response_page = decoded_cursor.page
    else:
        query = query.offset((page - 1) * limit)

    query = query.order_by(
        Article.published_at.desc().nullslast(),
        Article.created_at.desc(),
        Article.id.desc(),
    ).limit(limit + 1)

    result = await db.execute(query)
    fetched_rows = result.all()
    has_more = len(fetched_rows) > limit
    rows = fetched_rows[:limit]

    article_ids = [row[0].id for row in rows]

    read_ids: set[UUID] = set()
    starred_ids: set[UUID] = set()
    ai_data_map: dict[UUID, ArticleAIData] = {}
    summary_map: dict[UUID, list[ArticleSummary]] = {}
    model = get_user_model(user, "summary")
    if article_ids:
        read_result = await db.execute(
            select(ReadStatus.article_id).where(
                ReadStatus.user_id == user.id, ReadStatus.article_id.in_(article_ids)
            )
        )
        read_ids = {row[0] for row in read_result.all()}

        starred_result = await db.execute(
            select(StarredArticle.article_id).where(
                StarredArticle.user_id == user.id, StarredArticle.article_id.in_(article_ids)
            )
        )
        starred_ids = {row[0] for row in starred_result.all()}

        ai_result = await db.execute(
            select(ArticleAIData).where(ArticleAIData.article_id.in_(article_ids))
        )
        ai_data_map = {a.article_id: a for a in ai_result.scalars().all()}

        summary_result = await db.execute(
            select(ArticleSummary).where(
                ArticleSummary.article_id.in_(article_ids),
                ArticleSummary.model == model,
            )
        )
        for summary in summary_result.scalars().all():
            summary_map.setdefault(summary.article_id, []).append(summary)

    items = []
    for article, feed_title in rows:
        item = ArticleResponse.model_validate(article)
        item.is_read = article.id in read_ids
        item.is_starred = article.id in starred_ids
        item.feed_title = feed_title
        _apply_ai_data(item, ai_data_map.get(article.id))
        _apply_summaries(item, summary_map.get(article.id, []))
        items.append(item)

    next_cursor = None
    if has_more and rows:
        next_cursor = _encode_article_cursor(rows[-1][0], response_page + 1)

    return {
        "items": items,
        "total": total,
        "page": response_page,
        "limit": limit,
        "next_cursor": next_cursor,
    }


@router.put("/mark-all-read")
async def mark_all_read(
    body: MarkAllRead,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    query = (
        select(Article.id)
        .join(Feed, Feed.id == Article.feed_id)
        .where(Feed.user_id == user.id)
    )

    if body.feed_id:
        query = query.where(Article.feed_id == body.feed_id)

    result = await db.execute(query)
    article_ids = [row[0] for row in result.all()]

    if not article_ids:
        return {"marked_count": 0}

    existing_read = await db.execute(
        select(ReadStatus.article_id).where(
            ReadStatus.user_id == user.id,
            ReadStatus.article_id.in_(article_ids),
        )
    )
    already_read_ids = {row[0] for row in existing_read.all()}
    new_ids = [aid for aid in article_ids if aid not in already_read_ids]

    now = datetime.now(timezone.utc)
    for aid in new_ids:
        db.add(ReadStatus(user_id=user.id, article_id=aid, read_at=now))

    await db.commit()

    return {"marked_count": len(new_ids)}


@router.put("/batch-read")
async def batch_read(
    body: BatchRead,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if not body.article_ids:
        return {"marked_count": 0}

    # Only allow marking articles that belong to the user's feeds
    valid_result = await db.execute(
        select(Article.id).join(Feed, Feed.id == Article.feed_id).where(
            Feed.user_id == user.id, Article.id.in_(body.article_ids),
        )
    )
    valid_ids = {row[0] for row in valid_result.all()}

    existing_read = await db.execute(
        select(ReadStatus.article_id).where(
            ReadStatus.user_id == user.id,
            ReadStatus.article_id.in_(valid_ids),
        )
    )
    already_read_ids = {row[0] for row in existing_read.all()}
    new_ids = [aid for aid in valid_ids if aid not in already_read_ids]

    now = datetime.now(timezone.utc)
    for aid in new_ids:
        db.add(ReadStatus(user_id=user.id, article_id=aid, read_at=now))

    await db.commit()

    return {"marked_count": len(new_ids)}


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ArticleResponse:
    result = await db.execute(
        select(Article, Feed.title.label("feed_title"))
        .join(Feed, Feed.id == Article.feed_id)
        .where(Feed.user_id == user.id, Article.id == article_id)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Article not found")

    article, feed_title = row
    return await _build_article_response(article, user, db, feed_title=feed_title)


@router.put("/{article_id}/read", response_model=ArticleResponse)
async def toggle_read(
    article_id: UUID,
    body: ReadToggle,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ArticleResponse:
    result = await db.execute(
        select(Article).join(Feed, Feed.id == Article.feed_id).where(
            Feed.user_id == user.id, Article.id == article_id
        )
    )
    article = result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    existing = await db.execute(
        select(ReadStatus).where(
            ReadStatus.user_id == user.id, ReadStatus.article_id == article_id
        )
    )
    read_status_row = existing.scalar_one_or_none()

    if body.read and read_status_row is None:
        db.add(ReadStatus(user_id=user.id, article_id=article_id, read_at=datetime.now(timezone.utc)))
    elif not body.read and read_status_row is not None:
        await db.delete(read_status_row)

    await db.commit()

    return await _build_article_response(article, user, db)


@router.put("/{article_id}/star", response_model=ArticleResponse)
async def toggle_star(
    article_id: UUID,
    body: StarToggle,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ArticleResponse:
    result = await db.execute(
        select(Article).join(Feed, Feed.id == Article.feed_id).where(
            Feed.user_id == user.id, Article.id == article_id
        )
    )
    article = result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    existing = await db.execute(
        select(StarredArticle).where(
            StarredArticle.user_id == user.id, StarredArticle.article_id == article_id
        )
    )
    starred_row = existing.scalar_one_or_none()

    if body.starred and starred_row is None:
        db.add(
            StarredArticle(user_id=user.id, article_id=article_id, starred_at=datetime.now(timezone.utc))
        )
    elif not body.starred and starred_row is not None:
        await db.delete(starred_row)

    await db.commit()

    return await _build_article_response(article, user, db)


@router.post("/{article_id}/extract", response_model=ArticleResponse)
async def extract_article_content(
    article_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ArticleResponse:
    result = await db.execute(
        select(Article).join(Feed, Feed.id == Article.feed_id).where(
            Feed.user_id == user.id, Article.id == article_id
        )
    )
    article = result.scalar_one_or_none()
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    if article.full_content:
        return await _build_article_response(article, user, db)

    extracted = await _fetch_and_extract_content(article.url)
    if extracted is None:
        raise HTTPException(status_code=422, detail="Failed to extract article content")

    article.full_content = extracted
    if not article.content_snippet:
        article.content_snippet = _html_to_text(extracted)
    await db.commit()
    await db.refresh(article)

    return await _build_article_response(article, user, db)
