from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.feed import Feed
from app.services.feed_batch import (
    FeedRow,
    _hostname_of,
    apply_per_host_limit,
    build_due_feed_query,
)
from app.services.feed_fetcher import fetch_and_store_feed

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class JobProgressTracker:
    """In-memory progress counters for a manually-triggered feed job batch.

    Only batches that are explicitly enqueued (import / refresh-all / manual
    single refresh) are counted. The periodic due-tick does NOT count so that
    the tracker reads all-zero when the system is idle.

    Lifecycle of a tracked batch:
      - ``reset(total=N)`` starts a new batch (pending = N, rest = 0)
      - ``enqueue(...)`` adds more feeds to the *current* batch
      - ``on_start`` moves a feed pending → running
      - ``on_done`` / ``on_fail`` move a feed running → done / failed
    Counts are expected to be driven in order but defensively clamped to >= 0.
    """

    total: int = 0
    pending: int = 0
    running: int = 0
    done: int = 0
    failed: int = 0
    last_updated_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    def _touch(self) -> None:
        self.last_updated_at = datetime.now(timezone.utc)

    def reset(self, total: int) -> None:
        """Begin a new tracked batch with ``total`` feeds, all pending."""
        if total < 0:
            total = 0
        self.total = total
        self.pending = total
        self.running = 0
        self.done = 0
        self.failed = 0
        self._touch()

    def enqueue(self, feed_ids: list[object]) -> None:
        """Add feeds to the current batch (counted as pending)."""
        n = len(feed_ids)
        self.total += n
        self.pending += n
        self._touch()

    def on_start(self, feed_id: object) -> None:  # noqa: ARG002 — id kept for parity/future hooks
        if self.pending > 0:
            self.pending -= 1
        self.running += 1
        self._touch()

    def on_done(self, feed_id: object) -> None:  # noqa: ARG002
        if self.running > 0:
            self.running -= 1
        self.done += 1
        self._touch()

    def on_fail(self, feed_id: object) -> None:  # noqa: ARG002
        if self.running > 0:
            self.running -= 1
        self.failed += 1
        self._touch()

    def snapshot(self) -> dict[str, object]:
        """Return a JSON-serializable view for ``GET /api/feeds/jobs/status``."""
        return {
            "total": self.total,
            "pending": self.pending,
            "running": self.running,
            "done": self.done,
            "failed": self.failed,
            "last_updated_at": self.last_updated_at.isoformat(),
        }


@dataclass(slots=True)
class Job:
    """A unit of feed-fetch work enqueued onto the worker pool.

    ``kind`` distinguishes the trigger source: ``"due"`` for the periodic
    scheduler tick (not progress-tracked) and ``"manual"`` for import /
    refresh-all / single refresh (progress-tracked). ``result_future`` is set
    by :meth:`WorkerPool.run_single` so the submitting coroutine can block on
    the worker's outcome.
    """

    feed_id: UUID
    user_id: UUID
    kind: str  # "due" | "manual"
    result_future: asyncio.Future | None = None


class WorkerPool:
    """Bounded async worker pool that processes feed-fetch jobs.

    Each worker opens its OWN ``async_session`` (never a request-scoped one —
    the pool is a long-lived background component that outlives any HTTP
    request; see backend quality-guidelines "Don't: request-injected DB
    sessions"). Jobs are consumed from an :class:`asyncio.Queue`; ``None`` is
    the shutdown sentinel.
    """

    def __init__(
        self,
        size: int,
        fetch_fn,
        tracker: JobProgressTracker,
    ) -> None:
        self._size = size
        self._fetch_fn = fetch_fn
        self.tracker = tracker
        self._queue: asyncio.Queue[Job | None] = asyncio.Queue()
        self._workers: list[asyncio.Task] = []
        # feed_ids currently being fetched by a worker; used to drop duplicate
        # jobs (e.g. a due-tick selecting a feed that a manual import already
        # enqueued). Articles have no unique constraint on (feed_id, url), so a
        # cross-session double-fetch would create duplicate rows.
        self._inflight: set[UUID] = set()

    @classmethod
    def start(
        cls,
        size: int,
        fetch_fn,
        tracker: JobProgressTracker,
    ) -> WorkerPool:
        pool = cls(size=size, fetch_fn=fetch_fn, tracker=tracker)
        pool._spawn_workers()
        return pool

    def _spawn_workers(self) -> None:
        for i in range(self._size):
            self._workers.append(
                asyncio.create_task(self._worker_loop(i), name=f"feed-worker-{i}")
            )

    def push(self, job: Job, track: bool) -> None:
        """Enqueue a job.

        ``track`` records whether the worker should drive the progress tracker
        for this job (manual batches: import / refresh-all / single refresh).
        The periodic due-tick enqueues with ``track=False``.
        """
        # ``track`` mirrors ``job.kind == "manual"``; it is threaded through as
        # an explicit argument to keep the enqueue contract from design.md
        # (``enqueue(job, track=True)``). The worker re-derives it from kind so
        # the boolean never has to be stored on the Job.
        self._queue.put_nowait(job)

    async def run_single(self, feed_id: UUID, user_id: UUID) -> Feed:
        """Synchronously (from the caller's POV) refresh a single feed.

        Pushes one manual job carrying a Future, awaits it, then loads the
        freshly-committed feed in its own session and returns it. Occupies one
        worker slot for the duration of the fetch (acceptable — single feeds
        fetch in <30s; see design.md "关键权衡 4").
        """
        loop = asyncio.get_running_loop()
        future: asyncio.Future = loop.create_future()
        job = Job(feed_id=feed_id, user_id=user_id, kind="manual", result_future=future)
        self.push(job, track=True)
        # Wait for the worker to finish (or propagate its exception).
        await future
        async with async_session() as db:
            result = await db.execute(select(Feed).where(Feed.id == feed_id))
            feed = result.scalar_one_or_none()
            if feed is None:
                raise RuntimeError(f"Feed {feed_id} disappeared after refresh")
            return feed

    async def shutdown(self) -> None:
        """Cancel workers and drain. Idempotent."""
        if not self._workers:
            return
        # Wake every worker so they observe the sentinel and exit.
        for _ in self._workers:
            try:
                self._queue.put_nowait(None)
            except Exception:
                pass
        try:
            await asyncio.gather(*self._workers, return_exceptions=True)
        finally:
            self._workers = []

    async def _worker_loop(self, index: int) -> None:
        while True:
            job = await self._queue.get()
            try:
                if job is None:
                    return
                await self._process(job)
            except Exception:
                logger.exception("feed-worker-%s: unexpected error", index)
            finally:
                self._queue.task_done()

    async def _process(self, job: Job) -> None:
        if job.feed_id in self._inflight:
            # Another worker is already fetching this feed; skip the duplicate
            # to avoid cross-session double-writes. run_single callers surface
            # as 502 so the client can retry once the in-flight fetch commits.
            if job.result_future is not None and not job.result_future.done():
                job.result_future.set_exception(
                    RuntimeError(f"Feed {job.feed_id} is already being refreshed")
                )
            logger.debug("Skipping duplicate job for feed %s (in flight)", job.feed_id)
            return
        self._inflight.add(job.feed_id)
        tracked = job.kind == "manual"
        if tracked:
            self.tracker.on_start(job.feed_id)
        try:
            async with async_session() as db:
                result = await db.execute(select(Feed).where(Feed.id == job.feed_id))
                feed = result.scalar_one_or_none()
                if feed is None:
                    raise RuntimeError(f"Feed {job.feed_id} not found")
                await self._fetch_fn(feed, db)
            if tracked:
                self.tracker.on_done(job.feed_id)
            if job.result_future is not None and not job.result_future.done():
                job.result_future.set_result(job.feed_id)
        except Exception:
            logger.exception("Worker failed to fetch feed %s", job.feed_id)
            if tracked:
                self.tracker.on_fail(job.feed_id)
            if job.result_future is not None and not job.result_future.done():
                job.result_future.set_exception(
                    RuntimeError(f"Feed refresh failed for {job.feed_id}")
                )
        finally:
            self._inflight.discard(job.feed_id)


class FeedScheduler:
    """Periodic due-feed batch driver.

    Every ``interval`` seconds (or when woken by :meth:`wake_now`), builds a
    due-feed batch via :mod:`app.services.feed_batch` and pushes jobs onto the
    worker pool with ``track=False`` (the periodic tick does not drive the
    in-memory progress tracker — only manually-triggered batches do).
    """

    def __init__(
        self,
        pool: WorkerPool,
        interval: int,
    ) -> None:
        self._pool = pool
        self._interval = interval
        self._tick_task: asyncio.Task | None = None
        self._wake_event = asyncio.Event()

    def start(self) -> None:
        if self._tick_task is not None:
            return
        self._tick_task = asyncio.create_task(self._run(), name="feed-scheduler")

    async def shutdown(self) -> None:
        task = self._tick_task
        self._tick_task = None
        if task is None:
            return
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Feed scheduler task raised during shutdown")

    def wake_now(self) -> None:
        """Trigger an immediate tick without waiting for the interval."""
        self._wake_event.set()

    async def _run(self) -> None:
        while True:
            try:
                await self.tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Feed scheduler tick failed")
            try:
                await asyncio.wait_for(
                    self._wake_event.wait(), timeout=self._interval
                )
            except asyncio.TimeoutError:
                pass
            self._wake_event.clear()

    async def tick(self) -> None:
        """Run one due-feed batch: query due feeds, apply per-host limit, enqueue."""
        from app.config import settings

        error_limit = settings.POLLING_PARSING_ERROR_LIMIT
        # Reuse the SQL string from the batch builder (already tested), and
        # build the bind mapping here. The builder returns a positional param
        # list that is not directly executable with named placeholders, so we
        # reconstruct the dict from the known conditions.
        sql, _ = build_due_feed_query(
            batch_size=settings.BATCH_SIZE,
            error_limit=error_limit,
            limit_per_host=settings.POLLING_LIMIT_PER_HOST,
        )
        params: dict[str, object] = {"batch_size": settings.BATCH_SIZE}
        if error_limit > 0:
            params["error_limit"] = error_limit

        from sqlalchemy import text

        async with async_session() as db:
            result = await db.execute(text(sql), params)
            rows = result.all()

        feeds: list[FeedRow] = [
            FeedRow(
                feed_id=str(row.feed_id),
                user_id=str(row.user_id),
                url=row.url,
                hostname=_hostname_of(row.url),
            )
            for row in rows
        ]
        kept = apply_per_host_limit(feeds, settings.POLLING_LIMIT_PER_HOST)
        skipped = len(feeds) - len(kept)
        for f in kept:
            self._pool.push(
                Job(
                    feed_id=UUID(f.feed_id),
                    user_id=UUID(f.user_id),
                    kind="due",
                ),
                track=False,
            )
        logger.info(
            "Feed scheduler tick: due=%d enqueued=%d skipped_per_host=%d",
            len(feeds),
            len(kept),
            skipped,
        )


# ---- module-level singletons (owned by lifespan) ----

_tracker: JobProgressTracker | None = None
_worker_pool: WorkerPool | None = None
_scheduler: FeedScheduler | None = None


def get_tracker() -> JobProgressTracker:
    """Return the in-memory progress tracker singleton."""
    global _tracker
    if _tracker is None:
        _tracker = JobProgressTracker()
    return _tracker


def init_worker_pool() -> WorkerPool:
    """Create and start the global worker pool. lifespan startup hook."""
    from app.config import settings

    global _worker_pool
    if _worker_pool is not None:
        return _worker_pool
    _worker_pool = WorkerPool.start(
        size=settings.WORKER_POOL_SIZE,
        fetch_fn=fetch_and_store_feed,
        tracker=get_tracker(),
    )
    logger.info("Feed worker pool started (size=%d)", settings.WORKER_POOL_SIZE)
    return _worker_pool


def get_worker_pool() -> WorkerPool:
    if _worker_pool is None:
        raise RuntimeError("worker pool not initialized — lifespan did not run")
    return _worker_pool


def init_scheduler() -> FeedScheduler:
    """Create and start the global feed scheduler. lifespan startup hook."""
    from app.config import settings

    global _scheduler
    if _scheduler is not None:
        return _scheduler
    if _worker_pool is None:
        raise RuntimeError("worker pool must be initialized before scheduler")
    _scheduler = FeedScheduler(pool=_worker_pool, interval=settings.FEED_REFRESH_INTERVAL)
    _scheduler.start()
    logger.info("Feed scheduler started (interval=%ds)", settings.FEED_REFRESH_INTERVAL)
    return _scheduler


def get_scheduler() -> FeedScheduler:
    if _scheduler is None:
        raise RuntimeError("scheduler not initialized — lifespan did not run")
    return _scheduler


async def shutdown_worker_pool() -> None:
    global _worker_pool
    if _worker_pool is None:
        return
    try:
        await _worker_pool.shutdown()
    except Exception:
        logger.exception("Error shutting down worker pool")
    _worker_pool = None


async def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    try:
        await _scheduler.shutdown()
    except Exception:
        logger.exception("Error shutting down feed scheduler")
    _scheduler = None
