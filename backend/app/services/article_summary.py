from __future__ import annotations

import hashlib
import re
from typing import Literal

from app.models.article import Article

SummarySource = Literal["feed", "full"]

SUMMARY_SOURCE_FEED: SummarySource = "feed"
SUMMARY_SOURCE_FULL: SummarySource = "full"


def _strip_html_tags(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text)


def _extract_first_sentence(paragraph: str) -> str:
    for sep in ("。", "."):
        idx = paragraph.find(sep)
        if idx != -1:
            return paragraph[: idx + len(sep)]
    return paragraph


def extract_content_for_summary(content: str, max_chars: int = 8000) -> str:
    if not content or max_chars <= 0:
        return ""

    # Try HTML-aware splitting first, then plain-text double-newline
    html_splits = re.split(r"</?(?:p|br|div|h[1-6])\s*/?>", content)
    plain_splits = re.split(r"\n\n+", content)

    # Pick the split that produces more segments (better paragraph detection)
    segments: list[str]
    if len(html_splits) >= len(plain_splits) and len(html_splits) > 1:
        segments = [_strip_html_tags(s).strip() for s in html_splits]
    elif len(plain_splits) > 1:
        segments = [s.strip() for s in plain_splits]
    else:
        # Fall back: strip HTML tags and do simple truncation
        stripped = _strip_html_tags(content).strip()
        return stripped[:max_chars]

    segments = [s for s in segments if s]
    if len(segments) <= 1:
        stripped = _strip_html_tags(content).strip()
        return stripped[:max_chars]

    # Build paragraphs: first full, middle first-sentences only, last full
    first = segments[0]
    last = segments[-1]
    middle_parts = [_extract_first_sentence(s) for s in segments[1:-1]]

    # Budget calculation — account for "\n\n" separators between parts
    SEPARATOR_LEN = 2
    budget = max_chars
    result_parts: list[str] = []

    # Always include first paragraph
    cost = len(first)
    if cost <= budget:
        result_parts.append(first)
        budget -= cost
    else:
        result_parts.append(first[:budget])
        return "\n\n".join(result_parts)

    # Always include last paragraph (needs separator before it)
    cost = SEPARATOR_LEN + len(last)
    if cost <= budget:
        result_parts.append(last)
        budget -= cost
    else:
        available = budget - SEPARATOR_LEN
        if available > 0:
            result_parts.append(last[:available])
        return "\n\n".join(result_parts)

    # Insert middle first-sentences, trimming from the end if over budget
    for part in reversed(middle_parts):
        cost = SEPARATOR_LEN + len(part)
        if cost <= budget:
            result_parts.insert(1, part)
            budget -= cost
        elif budget > SEPARATOR_LEN:
            available = budget - SEPARATOR_LEN
            result_parts.insert(1, part[:available])
            budget = 0
            break
        else:
            break

    return "\n\n".join(result_parts)


def get_summary_content(article: Article, source: SummarySource) -> str:
    if source == SUMMARY_SOURCE_FULL:
        return article.full_content or ""
    return article.content or article.content_snippet or ""


def get_summary_content_hash(content: str) -> str:
    return hashlib.md5(content.encode(), usedforsecurity=False).hexdigest()
