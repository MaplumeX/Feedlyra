from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from time import mktime
from urllib.parse import urlparse

import feedparser
import httpx
import trafilatura
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.feed import Feed

logger = logging.getLogger(__name__)

HTTP_TIMEOUT = 30
MAX_CONCURRENT_FETCHES = 10
DEFAULT_CHECK_INTERVAL = timedelta(minutes=15)
MAX_BACKOFF = timedelta(hours=24)
USER_AGENT = "Feedlyra/0.1 (RSS Reader)"


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.text = ""

    def handle_data(self, data: str) -> None:
        self.text += data


def _extract_feed_urls_from_html(html: str, base_url: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "lxml")
    links: list[dict[str, str]] = []
    for link in soup.find_all("link", rel="alternate"):
        href = link.get("href", "")
        link_type = link.get("type", "")
        if not href:
            continue
        if "rss" in link_type or "atom" in link_type or "feed" in link_type:
            title = link.get("title", "")
            if href.startswith("/"):
                parsed = urlparse(base_url)
                href = f"{parsed.scheme}://{parsed.netloc}{href}"
            links.append({"title": title, "url": href})
    return links


async def discover_feed_urls(url: str) -> list[dict[str, str]]:
    async with httpx.AsyncClient(
        timeout=HTTP_TIMEOUT, follow_redirects=True, headers={"User-Agent": USER_AGENT}
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return _extract_feed_urls_from_html(resp.text, url)


async def _fetch_feed_content(
    url: str, etag: str | None = None, last_modified: str | None = None
) -> tuple[int, bytes, str | None, str | None]:
    headers = {"User-Agent": USER_AGENT}
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=True) as client:
        resp = await client.get(url, headers=headers)
        resp_etag = resp.headers.get("etag")
        resp_lm = resp.headers.get("last-modified")
        return resp.status_code, resp.content, resp_etag, resp_lm


def _parse_feed(content: bytes) -> feedparser.FeedParserDict:
    return feedparser.parse(content)


def _extract_full_text(url: str) -> str | None:
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            return trafilatura.extract(downloaded, favor_precision=True)
    except Exception:
        pass
    return None


def _compute_next_check(feed: Feed) -> datetime:
    now = datetime.now(timezone.utc)
    if feed.parsing_error_count > 0:
        backoff_seconds = min(300 * (2 ** feed.parsing_error_count), int(MAX_BACKOFF.total_seconds()))
        return now + timedelta(seconds=backoff_seconds)
    return now + DEFAULT_CHECK_INTERVAL


def _html_to_text(html: str, max_len: int = 500) -> str:
    extractor = _TextExtractor()
    try:
        extractor.feed(html)
    except Exception:
        pass
    return extractor.text[:max_len]


def _parse_published(entry: feedparser.FeedParserDict) -> datetime | None:
    parsed_time = entry.get("published_parsed")
    if not parsed_time:
        return None
    try:
        return datetime.fromtimestamp(mktime(parsed_time), tz=timezone.utc)
    except Exception:
        return None


async def fetch_and_store_feed(feed: Feed, db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    status_code, content, etag, last_modified = await _fetch_feed_content(
        feed.url, feed.etag_header, feed.last_modified_header
    )

    if status_code == 304:
        feed.checked_at = now
        feed.next_check_at = _compute_next_check(feed)
        await db.commit()
        return

    if status_code >= 400:
        feed.parsing_error_count += 1
        feed.parsing_error_message = f"HTTP {status_code}"
        feed.checked_at = now
        feed.next_check_at = _compute_next_check(feed)
        await db.commit()
        return

    parsed = _parse_feed(content)

    is_real_error = parsed.bozo and not isinstance(
        parsed.get("bozo_exception", None), feedparser.CharacterEncodingOverride
    )

    if is_real_error:
        feed.parsing_error_count += 1
        feed.parsing_error_message = str(parsed.bozo_exception)[:500]
    else:
        feed.parsing_error_count = 0
        feed.parsing_error_message = None

    if not parsed.entries:
        feed.checked_at = now
        feed.next_check_at = _compute_next_check(feed)
        if etag:
            feed.etag_header = etag
        if last_modified:
            feed.last_modified_header = last_modified
        await db.commit()
        return

    if not feed.title and parsed.feed.get("title"):
        feed.title = parsed.feed.get("title", "")
    if not feed.site_url and parsed.feed.get("link"):
        feed.site_url = parsed.feed.get("link")
    if not feed.description and parsed.feed.get("subtitle"):
        feed.description = parsed.feed.get("subtitle")

    if etag:
        feed.etag_header = etag
    if last_modified:
        feed.last_modified_header = last_modified

    existing_urls_result = await db.execute(
        select(Article.url).where(Article.feed_id == feed.id)
    )
    existing_urls = {row[0] for row in existing_urls_result.all()}

    new_articles: list[Article] = []
    for entry in parsed.entries:
        entry_url = entry.get("link", "")
        if not entry_url or entry_url in existing_urls:
            continue

        content_value: str | None = None
        if entry.get("content"):
            content_value = entry.content[0].get("value", "")
        elif entry.get("summary"):
            content_value = entry.get("summary", "")

        snippet = entry.get("summary", "") or ""
        if not snippet and content_value:
            snippet = _html_to_text(content_value)

        if not content_value:
            loop = asyncio.get_running_loop()
            extracted = await loop.run_in_executor(None, _extract_full_text, entry_url)
            if extracted:
                content_value = extracted
                if not snippet:
                    snippet = extracted[:500]

        article = Article(
            feed_id=feed.id,
            title=entry.get("title", "Untitled"),
            url=entry_url,
            content=content_value,
            content_snippet=snippet[:500] if snippet else None,
            author=entry.get("author", None),
            published_at=_parse_published(entry),
            fetched_at=now,
            created_at=now,
        )
        new_articles.append(article)

    if new_articles:
        db.add_all(new_articles)

    feed.checked_at = now
    feed.next_check_at = _compute_next_check(feed)
    await db.commit()

    # Trigger background summarization for new articles if user has AI config
    if new_articles:
        try:
            from app.models.user import User
            from app.models.ai import ArticleAIData
            from app.services.llm import generate_summary, get_user_llm_client, get_user_model

            user_result = await db.execute(select(User).where(User.id == feed.user_id))
            feed_user = user_result.scalar_one_or_none()
            if feed_user and feed_user.ai_api_key:
                try:
                    client = get_user_llm_client(feed_user)
                    model = get_user_model(feed_user)
                    for article in new_articles:
                        try:
                            summary = await generate_summary(
                                client, model, article.title, article.content or article.content_snippet or ""
                            )
                            ai_data = ArticleAIData(
                                article_id=article.id,
                                summary=summary,
                                summary_model=model,
                                summary_created_at=datetime.now(timezone.utc),
                            )
                            db.add(ai_data)
                        except Exception:
                            logger.exception("Failed to summarize article %s", article.id)
                    await db.commit()
                except ValueError:
                    logger.warning("User %s has no valid AI config, skipping summarization", feed.user_id)
                except Exception:
                    logger.exception("Failed to generate summaries for feed %s", feed.id)
        except Exception:
            logger.exception("Error during background summarization setup for feed %s", feed.id)


async def refresh_all_due_feeds(db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Feed).where((Feed.next_check_at.is_(None)) | (Feed.next_check_at <= now))
    )
    feeds = result.scalars().all()

    sem = asyncio.Semaphore(MAX_CONCURRENT_FETCHES)

    async def _fetch_with_sem(feed: Feed) -> None:
        async with sem:
            try:
                await fetch_and_store_feed(feed, db)
            except Exception:
                feed.parsing_error_count += 1
                feed.parsing_error_message = "Unexpected fetch error"
                feed.checked_at = now
                feed.next_check_at = _compute_next_check(feed)
                await db.commit()

    await asyncio.gather(*[_fetch_with_sem(f) for f in feeds])


def generate_opml(feeds: list[Feed]) -> str:
    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append('<opml version="2.0">')
    lines.append("  <head>")
    lines.append("    <title>Feedlyra Subscriptions</title>")
    lines.append("  </head>")
    lines.append("  <body>")
    for feed in feeds:
        title_escaped = feed.title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        url_escaped = feed.url.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        site_escaped = ""
        if feed.site_url:
            site_escaped = f' htmlUrl="{feed.site_url.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")}"'
        lines.append(f'    <outline type="rss" text="{title_escaped}" title="{title_escaped}" xmlUrl="{url_escaped}"{site_escaped} />')
    lines.append("  </body>")
    lines.append("</opml>")
    return "\n".join(lines)


def parse_opml(xml_content: str) -> list[dict[str, str | None]]:
    soup = BeautifulSoup(xml_content, "lxml")
    feeds: list[dict[str, str | None]] = []
    for outline in soup.find_all("outline"):
        xml_url = outline.get("xmlurl") or outline.get("xmlUrl")
        if xml_url:
            feeds.append({
                "title": outline.get("title") or outline.get("text"),
                "url": xml_url,
                "site_url": outline.get("htmlurl") or outline.get("htmlUrl"),
            })
    return feeds
