from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import jieba
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

# Single Chinese particles / function words that jieba commonly emits as
# standalone tokens — drop them so only content words become search terms.
# Deliberately narrow: do NOT list content-adjacent words like “文章/今天/看看”
# here, because stripping them would zero out queries where they are the
# only usable term (e.g. "简单看看今天有什么文章" must keep a term to match on).
_CN_STOPWORDS: frozenset[str] = frozenset(
    {
        "的", "了", "是", "在", "和", "与", "也", "都", "就", "还", "又",
        "把", "被", "让", "使", "对", "向", "为", "着", "过", "吗", "呢",
        "吧", "啊", "呀", "哦", "嗯", "什么", "怎么", "哪些", "哪个",
        "这个", "那个", "这些", "那些",
    }
)

_MIN_TOKEN_LEN = 2


def _tokenize(query: str) -> list[str]:
    """Split a natural-language query into searchable content-word tokens.

    Uses jieba precise-mode segmentation so a full natural-language sentence
    like "简单看看今天有什么文章" is broken into real terms ("简单/看看/今天/
    有/什么/文章") rather than being kept as one giant CJK block — which
    previously caused `(target) |"%整句%"` substring searches to never match.

    - Latin/digit tokens must be >= 2 chars (drops "a", "1").
    - CJK tokens are filtered by a function-word stoplist so particles like
      "的/了/是" and generic问句词 like "什么/今天/文章" don't dilute hits.
    - Result: content words used as ILIKE `%word%` substrings, which
      substring-match titles/summaries containing those words.
    """
    if not query:
        return []
    tokens: list[str] = []
    for raw in jieba.cut(query, cut_all=False):
        t = raw.strip()
        if len(t) < _MIN_TOKEN_LEN:
            continue
        if t.lower() in STOPWORDS or t in _CN_STOPWORDS:
            continue
        # Drop tokens that are only punctuation/symbols (jieba sometimes emits
        # runs like "..." or "——" as standalone tokens). A token must contain
        # at least one alphanumeric or Han character to be usable for ILIKE.
        if not any(c.isalnum() or "\u4e00" <= c <= "\u9fff" for c in t):
            continue
        tokens.append(t)
    return tokens


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
