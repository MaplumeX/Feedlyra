from __future__ import annotations

import re

from app.services.feed_batch import (
    FeedRow,
    _hostname_of,
    apply_per_host_limit,
    build_due_feed_query,
)


def _row(url: str, feed_id: str = "f1", user_id: str = "u1") -> FeedRow:
    return FeedRow(feed_id=feed_id, user_id=user_id, url=url, hostname=_hostname_of(url))


class TestHostnameExtraction:
    def test_hostname_from_https_url(self) -> None:
        assert _hostname_of("https://blog.example.com/feed.xml") == "blog.example.com"

    def test_hostname_from_http_url(self) -> None:
        assert _hostname_of("http://example.com/rss") == "example.com"

    def test_hostname_missing_scheme(self) -> None:
        assert _hostname_of("example.com/feed") is None

    def test_hostname_unknown_scheme(self) -> None:
        assert _hostname_of("ftp://example.com/feed") == "example.com"


class TestApplyPerHostLimit:
    def test_limit_zero_disables_filter(self) -> None:
        feeds = [_row("https://a.com/1"), _row("https://a.com/2"), _row("https://a.com/3")]
        assert apply_per_host_limit(feeds, 0) == feeds

    def test_limit_negative_disables_filter(self) -> None:
        feeds = [_row("https://a.com/1"), _row("https://a.com/2")]
        assert apply_per_host_limit(feeds, -1) == feeds

    def test_same_host_at_most_limit(self) -> None:
        feeds = [
            _row("https://a.com/1", "1"),
            _row("https://a.com/2", "2"),
            _row("https://a.com/3", "3"),
            _row("https://a.com/4", "4"),
        ]
        kept = apply_per_host_limit(feeds, 2)
        assert [f.feed_id for f in kept] == ["1", "2"]

    def test_different_hosts_independent(self) -> None:
        feeds = [
            _row("https://a.com/1", "1"),
            _row("https://b.com/2", "2"),
            _row("https://a.com/3", "3"),
            _row("https://b.com/4", "4"),
            _row("https://c.com/5", "5"),
        ]
        kept = apply_per_host_limit(feeds, 1)
        assert [f.feed_id for f in kept] == ["1", "2", "5"]

    def test_preserves_input_order(self) -> None:
        feeds = [
            _row("https://a.com/1", "1"),
            _row("https://b.com/2", "2"),
            _row("https://a.com/3", "3"),
        ]
        kept = apply_per_host_limit(feeds, 1)
        assert [f.feed_id for f in kept] == ["1", "2"]

    def test_limit_larger_than_count_keeps_all(self) -> None:
        feeds = [_row("https://a.com/1", "1"), _row("https://a.com/2", "2")]
        kept = apply_per_host_limit(feeds, 10)
        assert [f.feed_id for f in kept] == ["1", "2"]

    def test_does_not_mutate_input(self) -> None:
        feeds = [_row("https://a.com/1"), _row("https://a.com/2")]
        result = apply_per_host_limit(feeds, 1)
        assert len(feeds) == 2  # original list untouched
        assert result is not feeds

    def test_empty_input(self) -> None:
        assert apply_per_host_limit([], 3) == []

    def test_none_hostname_bucketed_together(self) -> None:
        # Malformed URLs without a scheme have hostname None — they share one bucket.
        feeds = [
            _row("a.com/1", "1"),
            _row("b.com/2", "2"),
            _row("c.com/3", "3"),
        ]
        kept = apply_per_host_limit(feeds, 1)
        assert [f.feed_id for f in kept] == ["1"]


class TestBuildDueFeedQuery:
    def test_includes_due_condition(self) -> None:
        sql, _ = build_due_feed_query(batch_size=100, error_limit=3, limit_per_host=3)
        assert "next_check_at IS NULL OR feeds.next_check_at <= now()" in sql

    def test_includes_without_disabled_feeds(self) -> None:
        sql, _ = build_due_feed_query(batch_size=100, error_limit=3, limit_per_host=3)
        assert re.search(r"disabled IS NOT true", sql)

    def test_includes_error_limit_when_positive(self) -> None:
        sql, params = build_due_feed_query(batch_size=100, error_limit=3, limit_per_host=3)
        assert "parsing_error_count < :error_limit" in sql
        assert 3 in params

    def test_omits_error_limit_when_zero(self) -> None:
        sql, params = build_due_feed_query(batch_size=100, error_limit=0, limit_per_host=3)
        assert "parsing_error_count" not in sql
        assert 3 not in params  # only batch_size param present

    def test_orders_by_next_check_at_asc(self) -> None:
        sql, _ = build_due_feed_query(batch_size=100, error_limit=3, limit_per_host=3)
        assert re.search(r"ORDER BY feeds.next_check_at ASC", sql)

    def test_applies_batch_size_limit(self) -> None:
        sql, params = build_due_feed_query(batch_size=50, error_limit=3, limit_per_host=3)
        assert "LIMIT :batch_size" in sql
        assert 50 in params

    def test_selects_projection_columns(self) -> None:
        sql, _ = build_due_feed_query(batch_size=100, error_limit=3, limit_per_host=3)
        assert "feeds.id AS feed_id" in sql
        assert "feeds.user_id" in sql
        assert "feeds.url" in sql
