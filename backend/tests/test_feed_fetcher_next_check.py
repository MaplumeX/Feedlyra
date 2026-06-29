from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.services.feed_fetcher import (
    DEFAULT_CHECK_INTERVAL,
    MAX_BACKOFF,
    _compute_next_check,
    _parse_retry_after,
)


@dataclass
class _FeedStub:
    """Duck-typed stand-in for the Feed ORM.

    ``_compute_next_check`` only reads ``parsing_error_count``; using a plain
    dataclass keeps the unit test free of DB/session coupling, matching the
    project's "trusted unit tests cover pure logic" convention.
    """

    parsing_error_count: int = 0


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------

class TestComputeNextCheckSuccess:
    def test_success_returns_default_interval_no_disable(self) -> None:
        feed = _FeedStub(parsing_error_count=0)
        before = _now()
        next_check, should_disable = _compute_next_check(feed)
        after = _now()
        assert should_disable is False
        assert before + DEFAULT_CHECK_INTERVAL <= next_check <= after + DEFAULT_CHECK_INTERVAL


class TestComputeNextCheckBackoff:
    def test_error_count_one_backoff_within_bounds_no_disable(self) -> None:
        feed = _FeedStub(parsing_error_count=1)
        before = _now()
        next_check, should_disable = _compute_next_check(feed)
        after = _now()
        expected = timedelta(seconds=300 * (2 ** 1))
        assert should_disable is False  # 1 < limit (3)
        assert before + expected <= next_check <= after + expected

    def test_error_count_two_no_disable(self) -> None:
        feed = _FeedStub(parsing_error_count=2)
        _, should_disable = _compute_next_check(feed)
        assert should_disable is False  # 2 < 3

    def test_backoff_capped_at_max(self) -> None:
        feed = _FeedStub(parsing_error_count=20)
        before = _now()
        next_check, _ = _compute_next_check(feed)
        after = _now()
        # 300*2**20 >> MAX_BACKOFF(24h), so next_check must be capped at 24h.
        assert before + MAX_BACKOFF <= next_check <= after + MAX_BACKOFF


class TestComputeNextCheckDisable:
    def test_error_count_at_limit_disables(self) -> None:
        feed = _FeedStub(parsing_error_count=settings.POLLING_PARSING_ERROR_LIMIT)
        _, should_disable = _compute_next_check(feed)
        assert should_disable is True

    def test_error_count_above_limit_disables(self) -> None:
        feed = _FeedStub(parsing_error_count=settings.POLLING_PARSING_ERROR_LIMIT + 5)
        _, should_disable = _compute_next_check(feed)
        assert should_disable is True


class TestComputeNextCheckRetryAfter:
    def test_retry_after_overrides_schedule(self) -> None:
        feed = _FeedStub(parsing_error_count=1)  # would normally backoff 600s
        before = _now()
        retry_after = timedelta(seconds=42)
        next_check, _ = _compute_next_check(feed, retry_after=retry_after)
        after = _now()
        assert before + retry_after <= next_check <= after + retry_after

    def test_retry_after_zero(self) -> None:
        feed = _FeedStub(parsing_error_count=0)
        before = _now()
        next_check, _ = _compute_next_check(feed, retry_after=timedelta(seconds=0))
        after = _now()
        assert before <= next_check <= after + timedelta(seconds=1)

    def test_retry_after_disables_still_computed_from_count(self) -> None:
        feed = _FeedStub(parsing_error_count=settings.POLLING_PARSING_ERROR_LIMIT)
        _, should_disable = _compute_next_check(feed, retry_after=timedelta(seconds=10))
        assert should_disable is True


# ---------------------------------------------------------------------------

class TestParseRetryAfter:
    def test_none_returns_none(self) -> None:
        assert _parse_retry_after(None) is None

    def test_empty_returns_none(self) -> None:
        assert _parse_retry_after("") is None
        assert _parse_retry_after("   ") is None

    def test_integer_seconds(self) -> None:
        assert _parse_retry_after("120") == timedelta(seconds=120)

    def test_negative_seconds_returns_none(self) -> None:
        assert _parse_retry_after("-5") is None

    def test_invalid_string_returns_none(self) -> None:
        assert _parse_retry_after("not-a-date-or-number") is None

    def test_http_date_future(self) -> None:
        future = (datetime.now(timezone.utc) + timedelta(seconds=60)).replace(microsecond=0)
        # RFC 7231 IMF-fixdate format
        http_date = future.strftime("%a, %d %b %Y %H:%M:%S GMT")
        delta = _parse_retry_after(http_date)
        assert delta is not None
        # Allow a little slack.
        assert timedelta(seconds=55) <= delta <= timedelta(seconds=65)

    def test_http_date_past_clamps_to_zero(self) -> None:
        past = datetime.now(timezone.utc) - timedelta(seconds=60)
        http_date = past.strftime("%a, %d %b %Y %H:%M:%S GMT")
        delta = _parse_retry_after(http_date)
        assert delta == timedelta(seconds=0)

    def test_naive_http_date_treated_as_utc(self) -> None:
        future = (datetime.now(timezone.utc) + timedelta(seconds=30)).replace(microsecond=0)
        http_date = future.strftime("%a, %d %b %Y %H:%M:%S GMT")
        delta = _parse_retry_after(http_date)
        assert delta is not None
        assert timedelta(seconds=25) <= delta <= timedelta(seconds=35)
