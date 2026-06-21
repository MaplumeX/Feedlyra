from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai import ArticleSummary
from app.models.article import Article
from app.models.feed import Feed
from app.services.article_summary import SUMMARY_SOURCE_FEED as FEED_SOURCE

DEFAULT_DAYS = 7
DEFAULT_LIMIT = 5

# Minimal Chinese + English stopwords. Kept tiny on purpose — ILIKE substring
# matching is forgiving, and a long stopword list hurts recall more than it helps.
STOPWORDS: frozenset[str] = frozenset(
    {
        # English (matched as whole tokens)
        "the", "a", "an", "of", "and", "or", "to", "in", "on", "is", "are",
        "was", "were", "be", "for", "by", "with", "this", "that", "it",
        # Two-char Chinese function words (matched as whole tokens)
        "这个", "那个",
    }
)

# Single Chinese particles never become tokens on their own (regex requires
# {2,}), but they DO glue real tokens together — "的动态" would match as one
# block. Strip them at the character level BEFORE tokenizing so "的动态" →
# "动态". Without this, the whole-token STOPWORDS set above cannot split them.
_CN_PARTICLE_CHARS = "的了是在和与"

_TOKEN_PATTERN = re.compile(r"[A-Za-z0-9]{2,}|[\u4e00-\u9fff]{2,}")


def _tokenize(query: str) -> list[str]:
    """Split a natural-language query into searchable tokens.

    - Latin/digit tokens must be >= 2 chars (drops "a", "1").
    - CJK tokens are maximal runs of Han characters (length >= 2), kept as one
      block — ILIKE `%block%` is substring-friendly for Chinese.
    - Chinese particles (的/了/是/…) are stripped at the character level first
      so they don't glue real tokens together ("的动态" → "动态").
    - A small stopword list filters the most common whole tokens.
    """
    if not query:
        return []
    cleaned = query.translate(str.maketrans("", "", _CN_PARTICLE_CHARS))
    raw = _TOKEN_PATTERN.findall(cleaned)
    return [t for t in raw if t.lower() not in STOPWORDS]


def _score_and_rank(
    candidates: list[tuple[Article, str]],
    tokens: list[str],
    limit: int,
) -> list[Article]:
    """Rank candidate articles by token-hit count, tie-break by recency.

    Pure function — unit-testable without a DB. The DB layer only assembles
    `(Article, summary_text)` pairs and delegates here.

    - `hits` counts how many query tokens appear (case-insensitively) in
      `title + summary_text`.
    - Sort: hits DESC, then `published_at` (fallback `created_at`) DESC.
    - Returns at most `limit` articles. Zero-hit articles are dropped.
    """
    if not tokens:
        return []

    lowered_tokens = [t.lower() for t in tokens]
    scored: list[tuple[int, datetime, Article]] = []

    for article, summary_text in candidates:
        hay = f"{article.title} {summary_text}".lower()
        hits = sum(1 for t in lowered_tokens if t in hay)
        if hits:
            ts = article.published_at or article.created_at
            # ts may be timezone-naive in tests; normalize to comparable form.
            if ts is None:
                ts = datetime.min.replace(tzinfo=timezone.utc)
            elif ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            scored.append((hits, ts, article))

    if not scored:
        return []

    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [article for _, _, article in scored[:limit]]


async def retrieve_relevant_articles(
    db: AsyncSession,
    *,
    user_id: UUID,
    query: str,
    since: datetime | None = None,
    days: int = DEFAULT_DAYS,
    limit: int = DEFAULT_LIMIT,
) -> list[Article]:
    """Return up to `limit` articles relevant to `query` for a user.

    Keyword-based retrieval over recent articles (title + cached feed summary).
    Stable signature: a future vector implementation may replace the body, not
    the contract.

    - `since`: inclusive lower bound on `COALESCE(published_at, created_at)`.
      Defaults to `now - days`.
    - Returns `list[Article]` sorted by relevance then recency. Empty when no
      tokens can be extracted or no candidate matches.
    """
    tokens = _tokenize(query)
    if not tokens:
        return []

    if since is None:
        since = datetime.now(timezone.utc) - timedelta(days=days)
    elif since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)

    # Candidate set: the user's recent articles, LEFT JOINed to their cached
    # feed-summary text. We carry summary_text back to Python for scoring.
    stmt = (
        select(Article, ArticleSummary.summary)
        .join(Feed, Feed.id == Article.feed_id)
        .outerjoin(
            ArticleSummary,
            (ArticleSummary.article_id == Article.id)
            & (ArticleSummary.source == FEED_SOURCE),
        )
        .where(Feed.user_id == user_id)
        .where(
            (Article.published_at >= since)
            | ((Article.published_at.is_(None)) & (Article.created_at >= since))
        )
    )

    result = await db.execute(stmt)
    # An article may carry multiple feed summaries (different `model` values
    # accumulate as the user changes their summary model). The outerjoin then
    # emits one row per summary, so dedupe by article id — otherwise the same
    # article would be scored twice and inserted as a duplicate
    # ConversationReference (the unique constraint guards cross-request dupes,
    # not dupes within this batch, which would raise on flush and silently drop
    # all auto-refs for the message).
    candidates: list[tuple[Article, str]] = []
    seen: set[UUID] = set()
    for article, summary_text in result.all():
        if article.id in seen:
            continue
        seen.add(article.id)
        candidates.append((article, summary_text or ""))

    return _score_and_rank(candidates, tokens, limit)
