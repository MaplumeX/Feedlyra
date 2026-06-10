from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import async_session
from app.routers.articles import router as articles_router
from app.routers.auth import router as auth_router
from app.routers.categories import router as categories_router
from app.routers.feeds import router as feeds_router
from app.routers.ai import router as ai_router
from app.routers.automation import router as automation_router
from app.services.feed_fetcher import refresh_all_due_feeds

logger = logging.getLogger(__name__)

FEED_REFRESH_INTERVAL = 300  # seconds


async def _periodic_feed_refresh() -> None:
    while True:
        try:
            async with async_session() as db:
                await refresh_all_due_feeds(db)
        except Exception:
            logger.exception("Error during periodic feed refresh")
        await asyncio.sleep(FEED_REFRESH_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    task = asyncio.create_task(_periodic_feed_refresh())
    yield
    task.cancel()


app = FastAPI(title="Feedlyra", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(feeds_router)
app.include_router(categories_router)
app.include_router(articles_router)
app.include_router(ai_router)
app.include_router(automation_router)
