from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.models.article import Article
from app.services.retrieval import _score_and_rank, _tokenize


def _make_article(
    title: str = "Test Article",
    summary_text: str = "",
    published_at: datetime | None = None,
    created_at: datetime | None = None,
) -> Article:
    now = datetime.now(timezone.utc)
    return Article(
        id=uuid4(),
        feed_id=uuid4(),
        title=title,
        url="https://example.com/test",
        content="",
        fetched_at=now,
        created_at=created_at or now,
        published_at=published_at,
    )


# ---------------------------------------------------------------------------
# _tokenize tests
# ---------------------------------------------------------------------------


class TestTokenize:
    def test_empty_query(self) -> None:
        assert _tokenize("") == []

    def test_english_tokens(self) -> None:
        assert _tokenize("OpenAI news update") == ["OpenAI", "news", "update"]

    def test_drops_single_char_latin(self) -> None:
        # "a" and "1" are too short to be tokens
        assert _tokenize("a 1 go") == ["go"]

    def test_chinese_blocks_as_single_tokens(self) -> None:
        # Consecutive Han chars stay as one block; single Han char dropped (len < 2)
        tokens = _tokenize("最近 OpenAI 的动态")
        assert tokens == ["最近", "OpenAI", "动态"]

    def test_mixed_alphanumeric(self) -> None:
        assert _tokenize("GPU prices 2024") == ["GPU", "prices", "2024"]

    def test_stopwords_filtered(self) -> None:
        tokens = _tokenize("the OpenAI and 的 news")
        assert tokens == ["OpenAI", "news"]

    def test_punctuation_only(self) -> None:
        assert _tokenize("!!! ??? ...") == []

    def test_case_preserved_for_matching(self) -> None:
        # Matching is case-insensitive at score time, but token keeps original case
        assert _tokenize("Breaking NEWS") == ["Breaking", "NEWS"]


# ---------------------------------------------------------------------------
# _score_and_rank tests
# ---------------------------------------------------------------------------


class TestScoreAndRank:
    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def test_empty_tokens_returns_empty(self) -> None:
        article = _make_article(title="Anything")
        result = _score_and_rank([(article, "")], [], limit=5)
        assert result == []

    def test_zero_hits_dropped(self) -> None:
        a_hit = _make_article(title="OpenAI release")
        a_miss = _make_article(title="Weather report")
        result = _score_and_rank(
            [(a_hit, ""), (a_miss, "")],
            ["openai"],
            limit=5,
        )
        assert result == [a_hit]

    def test_ranks_by_hit_count_desc(self) -> None:
        a_one = _make_article(title="OpenAI release")
        a_two = _make_article(title="OpenAI OpenAI double")
        result = _score_and_rank(
            [(a_one, ""), (a_two, "")],
            ["openai"],
            limit=5,
        )
        assert result == [a_two, a_one]

    def test_same_hits_tiebreak_by_recency(self) -> None:
        now = self._now()
        older = _make_article(title="OpenAI news", published_at=now - timedelta(days=2))
        newer = _make_article(title="OpenAI news", published_at=now)
        result = _score_and_rank(
            [(older, ""), (newer, "")],
            ["openai"],
            limit=5,
        )
        assert result == [newer, older]

    def test_limit_truncates(self) -> None:
        articles = [
            _make_article(title=f"OpenAI item {i}", published_at=self._now() - timedelta(hours=i))
            for i in range(10)
        ]
        result = _score_and_rank(
            [(a, "") for a in articles],
            ["openai"],
            limit=3,
        )
        assert len(result) == 3
        # With equal hits, the three most recent should win
        assert result == articles[:3]

    def test_summary_text_is_searched(self) -> None:
        # Title has no token, but cached summary does -> still a hit
        article = _make_article(title="Untitled", summary_text="discusses OpenAI strategy")
        result = _score_and_rank([(article, "discusses OpenAI strategy")], ["openai"], limit=5)
        assert result == [article]

    def test_created_at_fallback_when_published_at_none(self) -> None:
        # published_at is None — recency tiebreak must use created_at, not crash
        now = self._now()
        older = _make_article(
            title="OpenAI news",
            published_at=None,
            created_at=now - timedelta(days=2),
        )
        newer = _make_article(
            title="OpenAI news",
            published_at=None,
            created_at=now,
        )
        result = _score_and_rank(
            [(older, ""), (newer, "")],
            ["openai"],
            limit=5,
        )
        assert result == [newer, older]

    def test_naive_datetimes_normalized(self) -> None:
        # Tests and some feeds may produce tz-naive timestamps; ranking must not raise
        naive = _make_article(
            title="OpenAI news",
            published_at=datetime(2024, 1, 1),
        )
        aware = _make_article(
            title="OpenAI news",
            published_at=datetime(2024, 6, 1, tzinfo=timezone.utc),
        )
        result = _score_and_rank(
            [(naive, ""), (aware, "")],
            ["openai"],
            limit=5,
        )
        # Aware (June) is more recent than naive (Jan after tz normalization)
        assert result == [aware, naive]

    def test_chinese_query_matches_chinese_title(self) -> None:
        article = _make_article(title="OpenAI 最新动态发布")
        result = _score_and_rank([(article, "")], ["OpenAI", "最新", "动态"], limit=5)
        assert result == [article]

    def test_empty_candidates_returns_empty(self) -> None:
        assert _score_and_rank([], ["anything"], limit=5) == []

    def test_chinese_and_english_mix_scoring(self) -> None:
        # One article matches 2 tokens (Chinese + English), another matches 1
        both = _make_article(title="OpenAI 最新发布")
        one = _make_article(title="OpenAI weekly")
        result = _score_and_rank(
            [(both, ""), (one, "")],
            ["openai", "最新"],
            limit=5,
        )
        assert result == [both, one]
