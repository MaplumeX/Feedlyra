from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

from app.models.article import Article
from app.services.automation import _matches_conditions


def _make_article(
    title: str = "Test Article",
    author: str | None = "Test Author",
    url: str = "https://example.com/test",
    content: str | None = "Test content body",
) -> Article:
    return Article(
        id=uuid4(),
        feed_id=uuid4(),
        title=title,
        url=url,
        content=content,
        author=author,
        fetched_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# _matches_conditions tests
# ---------------------------------------------------------------------------


class TestMatchesConditions:
    def test_empty_conditions_matches_everything(self) -> None:
        article = _make_article()
        assert _matches_conditions(article, []) is True

    def test_single_contains_match(self) -> None:
        article = _make_article(title="Breaking: Important News")
        conditions = [{"field": "title", "operator": "contains", "value": "Important", "logic": "and"}]
        assert _matches_conditions(article, conditions) is True

    def test_single_contains_no_match(self) -> None:
        article = _make_article(title="Regular News")
        conditions = [{"field": "title", "operator": "contains", "value": "Sports", "logic": "and"}]
        assert _matches_conditions(article, conditions) is False

    def test_not_contains_match(self) -> None:
        article = _make_article(title="Tech News")
        conditions = [{"field": "title", "operator": "not_contains", "value": "sports", "logic": "and"}]
        assert _matches_conditions(article, conditions) is True

    def test_not_contains_no_match(self) -> None:
        article = _make_article(title="Sports News")
        conditions = [{"field": "title", "operator": "not_contains", "value": "sports", "logic": "and"}]
        assert _matches_conditions(article, conditions) is False

    def test_matches_regex(self) -> None:
        article = _make_article(title="Issue #123: Bug fix")
        conditions = [{"field": "title", "operator": "matches_regex", "value": r"#\d+", "logic": "and"}]
        assert _matches_conditions(article, conditions) is True

    def test_matches_regex_no_match(self) -> None:
        article = _make_article(title="Regular title")
        conditions = [{"field": "title", "operator": "matches_regex", "value": r"#\d+", "logic": "and"}]
        assert _matches_conditions(article, conditions) is False

    def test_matches_regex_invalid_pattern(self) -> None:
        article = _make_article(title="Some title")
        conditions = [{"field": "title", "operator": "matches_regex", "value": "[invalid", "logic": "and"}]
        # Invalid regex should not match (not crash)
        assert _matches_conditions(article, conditions) is False

    def test_and_logic(self) -> None:
        article = _make_article(title="Sports News", author="John")
        conditions = [
            {"field": "title", "operator": "contains", "value": "Sports", "logic": "and"},
            {"field": "author", "operator": "contains", "value": "John", "logic": "and"},
        ]
        assert _matches_conditions(article, conditions) is True

    def test_and_logic_one_fails(self) -> None:
        article = _make_article(title="Sports News", author="Jane")
        conditions = [
            {"field": "title", "operator": "contains", "value": "Sports", "logic": "and"},
            {"field": "author", "operator": "contains", "value": "John", "logic": "and"},
        ]
        assert _matches_conditions(article, conditions) is False

    def test_or_logic(self) -> None:
        article = _make_article(title="Sports News", author="Jane")
        conditions = [
            {"field": "title", "operator": "contains", "value": "Sports", "logic": "and"},
            {"field": "author", "operator": "contains", "value": "John", "logic": "or"},
        ]
        assert _matches_conditions(article, conditions) is True

    def test_or_logic_both_fail(self) -> None:
        article = _make_article(title="Tech News", author="Jane")
        conditions = [
            {"field": "title", "operator": "contains", "value": "Sports", "logic": "and"},
            {"field": "author", "operator": "contains", "value": "John", "logic": "or"},
        ]
        assert _matches_conditions(article, conditions) is False

    def test_case_insensitive_contains(self) -> None:
        article = _make_article(title="BREAKING NEWS")
        conditions = [{"field": "title", "operator": "contains", "value": "breaking", "logic": "and"}]
        assert _matches_conditions(article, conditions) is True

    def test_url_field(self) -> None:
        article = _make_article(url="https://example.com/sports/article")
        conditions = [{"field": "url", "operator": "contains", "value": "sports", "logic": "and"}]
        assert _matches_conditions(article, conditions) is True

    def test_content_field(self) -> None:
        article = _make_article(content="This is a long article about technology.")
        conditions = [{"field": "content", "operator": "contains", "value": "technology", "logic": "and"}]
        assert _matches_conditions(article, conditions) is True

    def test_none_field_value(self) -> None:
        article = _make_article(author=None)
        conditions = [{"field": "author", "operator": "contains", "value": "anything", "logic": "and"}]
        # None field should not match
        assert _matches_conditions(article, conditions) is False

    def test_none_field_not_contains(self) -> None:
        article = _make_article(author=None)
        conditions = [{"field": "author", "operator": "not_contains", "value": "anything", "logic": "and"}]
        # None field: not_contains should be True (nothing is in nothing)
        assert _matches_conditions(article, conditions) is True

    def test_first_condition_logic_ignored(self) -> None:
        article = _make_article(title="Test")
        conditions = [{"field": "title", "operator": "contains", "value": "Test", "logic": "or"}]
        # First condition's logic is ignored; should still match
        assert _matches_conditions(article, conditions) is True

    def test_complex_and_or_combination(self) -> None:
        article = _make_article(title="Sports News", author="John", content="Football results")
        # (title contains Sports) AND (author contains Bob OR content contains Football)
        conditions = [
            {"field": "title", "operator": "contains", "value": "Sports", "logic": "and"},
            {"field": "author", "operator": "contains", "value": "Bob", "logic": "or"},
            {"field": "content", "operator": "contains", "value": "Football", "logic": "and"},
        ]
        # True AND (False OR True) AND True
        # 1st: True
        # 2nd: True OR False = True
        # 3rd: True AND True = True
        assert _matches_conditions(article, conditions) is True
