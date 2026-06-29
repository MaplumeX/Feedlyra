from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

# Shared HTTP defaults used by feed_fetcher and the global client.
HTTP_TIMEOUT = 30
USER_AGENT = "Feedlyra/0.1 (RSS Reader)"

_global_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    """Return the app-level shared httpx client.

    All feed fetch / full-text extraction / favicon discovery code MUST go
    through this client so connections are pooled and concurrency is bounded.
    Raises ``RuntimeError`` if used outside of the app lifespan.
    """
    if _global_client is None:
        raise RuntimeError("http client not initialized — lifespan did not run")
    return _global_client


async def init_http_client() -> None:
    """Create the shared global ``httpx.AsyncClient``. lifespan startup hook."""
    global _global_client
    if _global_client is not None:
        return
    _global_client = httpx.AsyncClient(
        limits=httpx.Limits(max_connections=64, max_keepalive_connections=16),
        timeout=HTTP_TIMEOUT,
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    )
    logger.info("Shared httpx client initialized")


async def close_http_client() -> None:
    """Close the shared global ``httpx.AsyncClient``. lifespan shutdown hook."""
    global _global_client
    if _global_client is None:
        return
    try:
        await _global_client.aclose()
    except Exception:
        logger.exception("Error closing shared httpx client")
    _global_client = None
