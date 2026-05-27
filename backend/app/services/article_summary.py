from __future__ import annotations

import hashlib
from typing import Literal

from app.models.article import Article

SummarySource = Literal["feed", "full"]

SUMMARY_SOURCE_FEED: SummarySource = "feed"
SUMMARY_SOURCE_FULL: SummarySource = "full"


def get_summary_content(article: Article, source: SummarySource) -> str:
    if source == SUMMARY_SOURCE_FULL:
        return article.full_content or ""
    return article.content or article.content_snippet or ""


def get_summary_content_hash(content: str) -> str:
    return hashlib.md5(content.encode(), usedforsecurity=False).hexdigest()
