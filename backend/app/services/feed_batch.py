from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(slots=True)
class FeedRow:
    """Lightweight projection of a due feed used by the batch builder.

    Avoids loading the full ORM ``Feed`` in the batch layer so the scheduler
    can cheaply build candidate sets for per-host bucketing.
    """

    feed_id: str
    user_id: str
    url: str
    hostname: str | None


def _hostname_of(url: str) -> str | None:
    parsed = urlparse(url)
    return parsed.hostname


def build_due_feed_query(
    *,
    batch_size: int,
    error_limit: int,
    limit_per_host: int,  # noqa: ARG001 — kept in signature for parity with batch config
) -> tuple[str, list[object]]:
    """Build the SQL + params for the due-feed batch query.

    Conditions:
      - ``next_check_at <= now()`` (or NULL)
      - ``disabled IS NOT true`` (WithoutDisabledFeeds)
      - when ``error_limit > 0``: ``parsing_error_count < error_limit``
      - ``ORDER BY next_check_at ASC``
      - ``LIMIT batch_size``

    ``limit_per_host`` is *not* expressible in a single SQL query, so it is
    applied in Python via :func:`apply_per_host_limit`. It is accepted here so
    the batch config is a single record.
    """
    where_clauses: list[str] = [
        "(feeds.next_check_at IS NULL OR feeds.next_check_at <= now())",
        "feeds.disabled IS NOT true",
    ]
    params: list[object] = []

    if error_limit > 0:
        where_clauses.append("feeds.parsing_error_count < :error_limit")
        params.append(error_limit)

    sql = (
        "SELECT feeds.id AS feed_id, feeds.user_id, feeds.url "
        "FROM feeds "
        "WHERE " + " AND ".join(where_clauses) + " "
        "ORDER BY feeds.next_check_at ASC NULLS LAST "
        "LIMIT :batch_size"
    )
    params.append(batch_size)
    return sql, params


def apply_per_host_limit(
    feeds: list[FeedRow], limit_per_host: int
) -> list[FeedRow]:
    """Cap the number of feeds per hostname.

    Iterates in input order (which the caller should have ordered by
    ``next_check_at ASC``) and keeps at most ``limit_per_host`` feeds per host.
    A ``limit_per_host`` of 0 or less disables the filter.
    """
    if limit_per_host <= 0:
        return list(feeds)

    counts: dict[str | None, int] = {}
    kept: list[FeedRow] = []
    for feed in feeds:
        host = feed.hostname
        if counts.get(host, 0) >= limit_per_host:
            continue
        counts[host] = counts.get(host, 0) + 1
        kept.append(feed)
    return kept
