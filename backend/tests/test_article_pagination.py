from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.models.article import Article
from app.routers.articles import (
    _article_snapshot_query,
    _decode_article_cursor,
    _encode_article_cursor,
    _new_article_count_query,
    _pending_initial_feed_query,
    _validate_article_baseline,
)


def test_article_cursor_round_trip_with_published_date() -> None:
    article = Article(
        id=UUID("00000000-0000-0000-0000-000000000123"),
        feed_id=UUID("00000000-0000-0000-0000-000000000456"),
        title="Example",
        url="https://example.com/article",
        published_at=datetime(2026, 6, 6, 8, 0, tzinfo=timezone.utc),
        fetched_at=datetime(2026, 6, 6, 8, 5, tzinfo=timezone.utc),
        created_at=datetime(2026, 6, 6, 8, 10, tzinfo=timezone.utc),
    )

    snapshot_at = datetime(2026, 6, 6, 9, 0, tzinfo=timezone.utc)
    cursor = _decode_article_cursor(_encode_article_cursor(article, 2, snapshot_at))

    assert cursor.published_at == article.published_at
    assert cursor.created_at == article.created_at
    assert cursor.article_id == article.id
    assert cursor.page == 2
    assert cursor.snapshot_at == snapshot_at


def test_article_cursor_round_trip_without_published_date() -> None:
    article = Article(
        id=UUID("00000000-0000-0000-0000-000000000123"),
        feed_id=UUID("00000000-0000-0000-0000-000000000456"),
        title="Example",
        url="https://example.com/article",
        published_at=None,
        fetched_at=datetime(2026, 6, 6, 8, 5, tzinfo=timezone.utc),
        created_at=datetime(2026, 6, 6, 8, 10, tzinfo=timezone.utc),
    )

    snapshot_at = datetime(2026, 6, 6, 9, 0, tzinfo=timezone.utc)
    cursor = _decode_article_cursor(_encode_article_cursor(article, 3, snapshot_at))

    assert cursor.published_at is None
    assert cursor.page == 3
    assert cursor.snapshot_at == snapshot_at


def test_invalid_article_cursor_returns_bad_request() -> None:
    with pytest.raises(HTTPException) as exc_info:
        _decode_article_cursor("not-a-valid-cursor")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid article cursor"


def test_naive_datetime_article_cursor_returns_bad_request() -> None:
    payload = {
        "published_at": "2026-06-06T08:00:00",
        "created_at": "2026-06-06T08:10:00",
        "article_id": "00000000-0000-0000-0000-000000000123",
        "page": 2,
        "snapshot_at": "2026-06-06T09:00:00+00:00",
    }
    cursor = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")

    with pytest.raises(HTTPException) as exc_info:
        _decode_article_cursor(cursor)

    assert exc_info.value.status_code == 400


def test_naive_snapshot_article_cursor_returns_bad_request() -> None:
    payload = {
        "published_at": "2026-06-06T08:00:00+00:00",
        "created_at": "2026-06-06T08:10:00+00:00",
        "article_id": "00000000-0000-0000-0000-000000000123",
        "page": 2,
        "snapshot_at": "2026-06-06T09:00:00",
    }
    cursor = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")

    with pytest.raises(HTTPException) as exc_info:
        _decode_article_cursor(cursor)

    assert exc_info.value.status_code == 400


def test_new_article_count_query_uses_created_time_without_page_limit() -> None:
    query = _new_article_count_query(
        since=datetime(2026, 6, 6, 8, 0, tzinfo=timezone.utc),
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        feed_id=UUID("00000000-0000-0000-0000-000000000002"),
        read_status="unread",
        starred=True,
    )
    sql = str(query)

    assert "articles.created_at >" in sql
    assert "articles.published_at" not in sql
    assert "LIMIT" not in sql
    assert "read_status" in sql
    assert "starred_articles" in sql
    assert "articles.is_initial_fetch" in sql


def test_article_snapshot_uses_latest_visible_user_article() -> None:
    query = _article_snapshot_query(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
    )
    sql = str(query)

    assert "max(articles.created_at)" in sql
    assert "feeds.user_id" in sql
    assert "read_status" not in sql
    assert "starred_articles" not in sql


def test_pending_initial_feed_query_ignores_failed_fetches() -> None:
    query = _pending_initial_feed_query(
        user_id=UUID("00000000-0000-0000-0000-000000000001"),
        feed_id=UUID("00000000-0000-0000-0000-000000000002"),
    )
    sql = str(query)

    assert "feeds.checked_at IS NULL" in sql
    assert "feeds.parsing_error_count" in sql
    assert "feeds.id" in sql


def test_article_baseline_requires_timezone() -> None:
    with pytest.raises(HTTPException) as exc_info:
        _validate_article_baseline(datetime(2026, 6, 6, 8, 0))

    assert exc_info.value.status_code == 400
