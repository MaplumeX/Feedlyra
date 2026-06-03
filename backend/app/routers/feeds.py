from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.article import Article, ReadStatus
from app.models.category import Category
from app.models.feed import Feed
from app.models.user import User
from app.schemas.feed import (
    DiscoveredFeed,
    FeedCreate,
    FeedDiscoveryRequest,
    FeedResponse,
    FeedUpdate,
    FeedWithUnread,
    OPMLExportResponse,
)
from app.services.feed_fetcher import (
    discover_feed_urls,
    fetch_and_store_feed,
    generate_opml,
    parse_opml,
    refresh_all_feeds,
)

router = APIRouter(prefix="/api/feeds", tags=["feeds"])


@router.post("", response_model=FeedResponse, status_code=status.HTTP_201_CREATED)
async def add_feed(
    body: FeedCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Feed:
    result = await db.execute(select(Feed).where(Feed.user_id == user.id, Feed.url == body.url))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Feed already exists")

    if body.category_id is not None:
        cat_result = await db.execute(
            select(Category).where(Category.id == body.category_id, Category.user_id == user.id)
        )
        if cat_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Category not found")

    feed = Feed(user_id=user.id, title="", url=body.url, category_id=body.category_id, auto_full_text=body.auto_full_text)
    db.add(feed)
    await db.commit()
    await db.refresh(feed)

    try:
        await fetch_and_store_feed(feed, db)
        await db.refresh(feed)
    except Exception:
        pass

    if not feed.title:
        feed.title = body.url
        await db.commit()
        await db.refresh(feed)

    return feed


@router.get("", response_model=list[FeedWithUnread])
async def list_feeds(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    result = await db.execute(
        select(Feed, Category.title)
        .outerjoin(Category, Feed.category_id == Category.id)
        .where(Feed.user_id == user.id)
        .order_by(Feed.title)
    )
    rows = result.all()

    feed_ids = [row[0].id for row in rows]
    unread_counts: dict[str, int] = {}
    if feed_ids:
        count_result = await db.execute(
            select(Article.feed_id, func.count(Article.id))
            .outerjoin(
                ReadStatus,
                (ReadStatus.article_id == Article.id) & (ReadStatus.user_id == user.id),
            )
            .where(Article.feed_id.in_(feed_ids), ReadStatus.article_id.is_(None))
            .group_by(Article.feed_id)
        )
        unread_counts = {row[0]: row[1] for row in count_result.all()}

    return [
        {
            **FeedResponse.model_validate(row[0]).model_dump(),
            "unread_count": unread_counts.get(row[0].id, 0),
            "category_id": row[0].category_id,
            "category_name": row[1],
        }
        for row in rows
    ]


@router.get("/{feed_id}", response_model=FeedResponse)
async def get_feed(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Feed:
    result = await db.execute(select(Feed).where(Feed.id == feed_id, Feed.user_id == user.id))
    feed = result.scalar_one_or_none()
    if feed is None:
        raise HTTPException(status_code=404, detail="Feed not found")
    return feed


@router.put("/{feed_id}", response_model=FeedResponse)
async def update_feed(
    feed_id: UUID,
    body: FeedUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Feed:
    result = await db.execute(select(Feed).where(Feed.id == feed_id, Feed.user_id == user.id))
    feed = result.scalar_one_or_none()
    if feed is None:
        raise HTTPException(status_code=404, detail="Feed not found")

    update_data = body.model_dump(exclude_unset=True)

    if "title" in update_data:
        feed.title = update_data["title"]
    if "category_id" in update_data:
        new_cat_id = update_data["category_id"]
        if new_cat_id is not None:
            cat_result = await db.execute(
                select(Category).where(Category.id == new_cat_id, Category.user_id == user.id)
            )
            if cat_result.scalar_one_or_none() is None:
                raise HTTPException(status_code=404, detail="Category not found")
        feed.category_id = new_cat_id
    if "auto_full_text" in update_data:
        feed.auto_full_text = update_data["auto_full_text"]
    await db.commit()
    await db.refresh(feed)
    return feed


@router.delete("/{feed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feed(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    result = await db.execute(select(Feed).where(Feed.id == feed_id, Feed.user_id == user.id))
    feed = result.scalar_one_or_none()
    if feed is None:
        raise HTTPException(status_code=404, detail="Feed not found")

    await db.execute(delete(Feed).where(Feed.id == feed_id))
    await db.commit()


@router.post("/refresh-all")
async def refresh_all(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    return await refresh_all_feeds(db, user.id)


@router.post("/{feed_id}/refresh", response_model=FeedResponse)
async def refresh_feed(
    feed_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Feed:
    result = await db.execute(select(Feed).where(Feed.id == feed_id, Feed.user_id == user.id))
    feed = result.scalar_one_or_none()
    if feed is None:
        raise HTTPException(status_code=404, detail="Feed not found")

    try:
        await fetch_and_store_feed(feed, db)
        await db.refresh(feed)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to refresh feed: {e}")

    return feed


@router.post("/import/opml", response_model=list[FeedResponse], status_code=status.HTTP_201_CREATED)
async def import_opml(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Feed]:
    content = await file.read()
    try:
        parsed_feeds = parse_opml(content.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid OPML file")

    result = await db.execute(select(Feed.url).where(Feed.user_id == user.id))
    existing_urls = {row[0] for row in result.all()}

    # Collect unique category titles from parsed feeds
    category_titles = {pf.get("category") for pf in parsed_feeds if pf.get("category")}
    title_to_category: dict[str, Category] = {}

    if category_titles:
        cat_result = await db.execute(
            select(Category).where(Category.user_id == user.id, Category.title.in_(category_titles))
        )
        existing_cats = cat_result.scalars().all()
        title_to_category = {c.title: c for c in existing_cats}

        for title in category_titles:
            if title not in title_to_category:
                cat = Category(user_id=user.id, title=title)
                db.add(cat)
                title_to_category[title] = cat

    created: list[Feed] = []
    for pf in parsed_feeds:
        url = pf.get("url", "")
        if not url or url in existing_urls:
            continue

        category_id = None
        cat_title = pf.get("category")
        if cat_title and cat_title in title_to_category:
            category_id = title_to_category[cat_title].id

        feed = Feed(
            user_id=user.id,
            title=pf.get("title") or url,
            url=url,
            site_url=pf.get("site_url"),
            category_id=category_id,
        )
        db.add(feed)
        created.append(feed)
        existing_urls.add(url)

    await db.commit()
    for feed in created:
        await db.refresh(feed)

    return created


@router.get("/export/opml", response_model=OPMLExportResponse)
async def export_opml(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    result = await db.execute(
        select(Feed, Category.title)
        .outerjoin(Category, Feed.category_id == Category.id)
        .where(Feed.user_id == user.id)
        .order_by(Feed.title)
    )
    rows = result.all()

    # Build list of (Feed, category_title | None) tuples
    feeds_with_category = [(row[0], row[1]) for row in rows]

    return {"xml": generate_opml(feeds_with_category)}


@router.post("/discover", response_model=list[DiscoveredFeed])
async def discover_feeds(body: FeedDiscoveryRequest) -> list[dict]:
    try:
        feeds = await discover_feed_urls(body.url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to discover feeds: {e}")

    if not feeds:
        raise HTTPException(status_code=404, detail="No feeds found at this URL")

    return feeds
