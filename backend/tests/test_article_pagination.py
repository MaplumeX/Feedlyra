from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.models.article import Article
from app.routers.articles import _decode_article_cursor, _encode_article_cursor


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

    cursor = _decode_article_cursor(_encode_article_cursor(article, 2))

    assert cursor.published_at == article.published_at
    assert cursor.created_at == article.created_at
    assert cursor.article_id == article.id
    assert cursor.page == 2


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

    cursor = _decode_article_cursor(_encode_article_cursor(article, 3))

    assert cursor.published_at is None
    assert cursor.page == 3


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
    }
    cursor = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")

    with pytest.raises(HTTPException) as exc_info:
        _decode_article_cursor(cursor)

    assert exc_info.value.status_code == 400
