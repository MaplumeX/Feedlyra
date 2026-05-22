from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.article import Article, ReadStatus, StarredArticle
from app.models.ai import ArticleAIData
from app.models.feed import Feed
from app.models.user import User
from app.schemas.article import ArticleListResponse, ArticleResponse, MarkAllRead, ReadToggle, StarToggle

router = APIRouter(prefix="/api/articles", tags=["articles"])


@router.get("", response_model=ArticleListResponse)
async def list_articles(
    feed_id: str | None = Query(None),
    read_status: str | None = Query(None),
    starred: bool | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
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

    offset = (page - 1) * limit
    query = query.order_by(Article.published_at.desc().nullslast(), Article.created_at.desc())
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    article_ids = [row[0].id for row in rows]

    read_ids: set[str] = set()
    starred_ids: set[str] = set()
    ai_data_map: dict[str, ArticleAIData] = {}
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

    items = []
    for article, feed_title in rows:
        item = ArticleResponse.model_validate(article)
        item.is_read = article.id in read_ids
        item.is_starred = article.id in starred_ids
        item.feed_title = feed_title
        ai_data = ai_data_map.get(article.id)
        if ai_data:
            item.summary = ai_data.summary
            item.summary_model = ai_data.summary_model
            item.translated_title = ai_data.translated_title
            item.translated_content = ai_data.translated_content
            item.translation_lang = ai_data.translation_lang
        items.append(item)

    return {"items": items, "total": total, "page": page, "limit": limit}


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


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    result = await db.execute(
        select(Article, Feed.title.label("feed_title"))
        .join(Feed, Feed.id == Article.feed_id)
        .where(Feed.user_id == user.id, Article.id == article_id)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Article not found")

    article, feed_title = row

    read_result = await db.execute(
        select(ReadStatus).where(
            ReadStatus.user_id == user.id, ReadStatus.article_id == article_id
        )
    )
    is_read = read_result.scalar_one_or_none() is not None

    starred_result = await db.execute(
        select(StarredArticle).where(
            StarredArticle.user_id == user.id, StarredArticle.article_id == article_id
        )
    )
    is_starred = starred_result.scalar_one_or_none() is not None

    ai_data_result = await db.execute(
        select(ArticleAIData).where(ArticleAIData.article_id == article_id)
    )
    ai_data = ai_data_result.scalar_one_or_none()

    item = ArticleResponse.model_validate(article)
    item.is_read = is_read
    item.is_starred = is_starred
    item.feed_title = feed_title
    if ai_data:
        item.summary = ai_data.summary
        item.summary_model = ai_data.summary_model
        item.translated_title = ai_data.translated_title
        item.translated_content = ai_data.translated_content
        item.translation_lang = ai_data.translation_lang
    return item


@router.put("/{article_id}/read", response_model=ArticleResponse)
async def toggle_read(
    article_id: str,
    body: ReadToggle,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
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

    starred_result = await db.execute(
        select(StarredArticle).where(
            StarredArticle.user_id == user.id, StarredArticle.article_id == article_id
        )
    )
    is_starred = starred_result.scalar_one_or_none() is not None

    feed_result = await db.execute(select(Feed.title).where(Feed.id == article.feed_id))
    feed_title = feed_result.scalar()

    item = ArticleResponse.model_validate(article)
    item.is_read = body.read
    item.is_starred = is_starred
    item.feed_title = feed_title
    return item


@router.put("/{article_id}/star", response_model=ArticleResponse)
async def toggle_star(
    article_id: str,
    body: StarToggle,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
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

    read_result = await db.execute(
        select(ReadStatus).where(
            ReadStatus.user_id == user.id, ReadStatus.article_id == article_id
        )
    )
    is_read = read_result.scalar_one_or_none() is not None

    feed_result = await db.execute(select(Feed.title).where(Feed.id == article.feed_id))
    feed_title = feed_result.scalar()

    item = ArticleResponse.model_validate(article)
    item.is_read = is_read
    item.is_starred = body.starred
    item.feed_title = feed_title
    return item
