from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.article import Article, ReadStatus
from app.models.category import Category
from app.models.feed import Feed
from app.models.user import User
from app.schemas.feed import (
    BulkDeleteResult,
    BulkFeedDeleteRequest,
    BulkFeedMoveRequest,
    BulkMoveResult,
    DiscoveredFeed,
    FeedCreate,
    FeedDiscoveryRequest,
    FeedResponse,
    FeedUpdate,
    FeedWithUnread,
    JobStatusResponse,
    OPMLExportResponse,
)
from app.services.feed_fetcher import (
    DEFAULT_CHECK_INTERVAL,
    discover_feed_urls,
    generate_opml,
    parse_opml,
    refresh_all_feeds,
)
from app.services.feed_worker import Job, get_tracker, get_worker_pool

logger = logging.getLogger(__name__)

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

    feed = Feed(
        user_id=user.id,
        title="",
        url=body.url,
        category_id=body.category_id,
        auto_full_text=body.auto_full_text,
        auto_translate=body.auto_translate,
        translate_target_lang=body.translate_target_lang,
        next_check_at=datetime.now(timezone.utc),
    )
    db.add(feed)
    await db.commit()
    await db.refresh(feed)

    # Decoupled from fetch: the feed is created as a pending shell marked due
    # (next_check_at = now). The background worker pool / scheduler picks it up
    # on the next tick; no asyncio.create_task here. See design.md "导入解耦".
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


@router.post("/bulk/move", response_model=BulkMoveResult)
async def bulk_move_feeds(
    body: BulkFeedMoveRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BulkMoveResult:
    if body.category_id is not None:
        cat_result = await db.execute(
            select(Category).where(Category.id == body.category_id, Category.user_id == user.id)
        )
        if cat_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Category not found")

    feed_id_set = set(body.feed_ids)
    found_result = await db.execute(
        select(Feed.id).where(Feed.id.in_(feed_id_set), Feed.user_id == user.id)
    )
    found_ids = [row[0] for row in found_result.all()]
    not_found = list(feed_id_set - set(found_ids))

    if found_ids:
        await db.execute(
            update(Feed)
            .where(Feed.id.in_(found_ids), Feed.user_id == user.id)
            .values(category_id=body.category_id)
        )
        await db.commit()

    return BulkMoveResult(updated=found_ids, not_found=not_found)


@router.post("/bulk/delete", response_model=BulkDeleteResult)
async def bulk_delete_feeds(
    body: BulkFeedDeleteRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BulkDeleteResult:
    feed_id_set = set(body.feed_ids)
    found_result = await db.execute(
        select(Feed.id).where(Feed.id.in_(feed_id_set), Feed.user_id == user.id)
    )
    found_ids = [row[0] for row in found_result.all()]
    not_found = list(feed_id_set - set(found_ids))

    if found_ids:
        await db.execute(
            delete(Feed).where(Feed.id.in_(found_ids), Feed.user_id == user.id)
        )
        await db.commit()

    return BulkDeleteResult(deleted=found_ids, not_found=not_found)


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
    if "auto_translate" in update_data:
        feed.auto_translate = update_data["auto_translate"]
    if "translate_target_lang" in update_data:
        feed.translate_target_lang = update_data["translate_target_lang"]
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


@router.post("/refresh-all", status_code=status.HTTP_202_ACCEPTED)
async def refresh_all(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    # Marks the user's due feeds next_check_at = now(), commits, resets the
    # progress tracker, and enqueues manual (track=True) jobs onto the worker
    # pool. Fetching happens asynchronously in the pool's own sessions; this
    # handler returns immediately with 202 + {total}. See design.md "接口语义".
    return await refresh_all_feeds(db, user.id)


@router.get("/jobs/status", response_model=JobStatusResponse)
async def get_jobs_status() -> dict[str, object]:
    # In-memory snapshot of the currently-tracked batch. The periodic due-tick
    # does NOT drive the tracker (track=False), so this reads all-zero when no
    # import / refresh-all / single-refresh batch is active. A process restart
    # zeroes the counters; due feeds are recovered idempotently by the next
    # scheduler tick. See prd.md "进度可见性实现".
    return get_tracker().snapshot()


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

    # Synchronous manual refresh: enqueue one manual job carrying a Future and
    # block until the worker finishes. The worker opens its own session and
    # commits; we then refresh this request-scoped feed to read the newly
    # committed title/site_url/icon and reset the disabled/error state so auto
    # scheduling resumes (see prd.md "disabled feed 在手动 refresh 成功后重置").
    try:
        await get_worker_pool().run_single(feed_id, user.id)
    except Exception as e:
        logger.warning("Manual refresh failed for feed %s: %s", feed_id, e)
        raise HTTPException(status_code=502, detail=f"Failed to refresh feed: {e}")

    await db.refresh(feed)
    # Only reset disabled / error_count on a genuinely successful refresh.
    # fetch_and_store_feed handles 429 / 4xx / parse errors internally and
    # returns normally, leaving parsing_error_message set — that is a soft
    # failure, NOT a success, so we must not clear the error state here
    # (prd.md: "disabled feed 在手动 refresh 成功后重置").
    if not feed.parsing_error_message:
        feed.disabled = False
        feed.parsing_error_count = 0
        await db.commit()
        await db.refresh(feed)
    return feed


@router.post("/import/opml", response_model=list[FeedResponse], status_code=status.HTTP_201_CREATED)
async def import_opml(
    file: UploadFile,
    auto_full_text: bool = Form(False),
    auto_translate: bool = Form(False),
    translate_target_lang: str | None = Form(None),
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

        # Flush so freshly-created categories are assigned ids BEFORE we read
        # them below; otherwise accessing ``.id`` would trigger an implicit
        # autoflush of the pending feeds (prd.md AC "OPML 导入不再因 category.id
        # 触发隐式 autoflush").
        await db.flush()

    now = datetime.now(timezone.utc)
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
            auto_full_text=auto_full_text,
            auto_translate=auto_translate,
            translate_target_lang=translate_target_lang,
            # Future due time keeps the periodic tick from selecting these
            # feeds while the manual batch is in flight; the worker's fetch
            # overwrites next_check_at on completion.
            next_check_at=now + DEFAULT_CHECK_INTERVAL,
        )
        db.add(feed)
        created.append(feed)
        existing_urls.add(url)

    await db.commit()
    for feed in created:
        await db.refresh(feed)

    # Decoupled: import only wrote shells marked due (next_check_at = now). To
    # make progress visible without waiting for the 60s scheduler tick, enqueue
    # manual (track=True) jobs directly onto the worker pool and reset the
    # tracker for this batch. The scheduler's due-tick also reads due feeds
    # (track=False) so a process restart between import and fetch still recovers
    # idempotently. fetch_and_store_feed is idempotent (etag/304 + guid dedup),
    # so a possible overlap is harmless. See design.md "跨层数据流".
    if created:
        tracker = get_tracker()
        tracker.reset(total=len(created))
        pool = get_worker_pool()
        for feed in created:
            pool.push(
                Job(feed_id=feed.id, user_id=user.id, kind="manual"),
                track=True,
            )

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
