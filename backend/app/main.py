from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.articles import router as articles_router
from app.routers.auth import router as auth_router
from app.routers.categories import router as categories_router
from app.routers.feeds import router as feeds_router
from app.routers.ai import router as ai_router
from app.routers.automation import router as automation_router
from app.services.feed_worker import (
    init_scheduler,
    init_worker_pool,
    shutdown_scheduler,
    shutdown_worker_pool,
)
from app.services.http_client import close_http_client, init_http_client

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    await init_http_client()
    init_worker_pool()
    init_scheduler()
    try:
        yield
    finally:
        # Stop the scheduler first so no new jobs are enqueued, then drain
        # the worker pool, then close the shared httpx client.
        await shutdown_scheduler()
        await shutdown_worker_pool()
        await close_http_client()


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


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe used by the Docker Compose healthcheck."""
    return {"status": "ok"}
