from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from time import mktime
from urllib.parse import urljoin, urlparse
from xml.sax.saxutils import escape as xml_escape

from uuid import UUID

import feedparser
import httpx
from bs4 import BeautifulSoup
from readability import Document
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.feed import Feed

logger = logging.getLogger(__name__)

HTTP_TIMEOUT = 30
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


def _extract_content_html(html: str, url: str) -> str | None:
    try:
        doc = Document(html, url=url)
        return doc.summary()
    except Exception:
        logger.warning("readability-lxml extraction failed for %s", url)
        return None


async def _fetch_and_extract_content(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(
            timeout=HTTP_TIMEOUT, follow_redirects=True, headers={"User-Agent": USER_AGENT}
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            html = resp.text

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _extract_content_html, html, url)
    except Exception:
        logger.warning("Failed to fetch/extract content for %s", url)
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


def _extract_feed_icon(parsed: feedparser.FeedParserDict) -> str | None:
    """Extract icon URL from feedparser result. Priority: icon > image."""
    icon = parsed.feed.get("icon")
    if isinstance(icon, dict):
        icon_url = icon.get("href") or icon.get("url")
        if icon_url and isinstance(icon_url, str):
            return icon_url
    elif isinstance(icon, str):
        return icon

    image = parsed.feed.get("image")
    if isinstance(image, dict):
        icon_url = image.get("href") or image.get("url")
        if icon_url and isinstance(icon_url, str):
            return icon_url
    elif isinstance(image, str):
        return image

    return None


def _extract_image_url(entry: feedparser.FeedParserDict, content: str | None) -> str | None:
    """Extract image URL from a feedparser entry.

    Priority:
    1. entry.media_thumbnail — first item's url
    2. entry.media_content — first item with medium="image"
    3. entry.enclosures — first item with type starting with "image/"
    4. First <img src="..."> from HTML content
    """
    # 1. media_thumbnail
    media_thumbnails = entry.get("media_thumbnail", [])
    if media_thumbnails:
        thumb = media_thumbnails[0]
        url = thumb.get("url") if isinstance(thumb, dict) else None
        if url and isinstance(url, str):
            return url

    # 2. media_content with medium="image"
    media_contents = entry.get("media_content", [])
    for mc in media_contents:
        if isinstance(mc, dict) and mc.get("medium") == "image":
            url = mc.get("url")
            if url and isinstance(url, str):
                return url

    # 3. enclosures with image type
    enclosures = entry.get("enclosures", [])
    for enc in enclosures:
        if isinstance(enc, dict):
            enc_type = enc.get("type", "")
            if enc_type.startswith("image/"):
                url = enc.get("href") or enc.get("url")
                if url and isinstance(url, str):
                    return url

    # 4. Extract first <img> from HTML content
    if content:
        match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', content, re.IGNORECASE)
        if match:
            return match.group(1)

    return None


async def _discover_favicon(site_url: str) -> str | None:
    """Best-effort favicon discovery from site URL.

    Tries /favicon.ico first, then parses HTML for <link rel="icon">.
    """
    try:
        favicon_url = urljoin(site_url, "/favicon.ico")
        async with httpx.AsyncClient(
            timeout=10, follow_redirects=True, headers={"User-Agent": USER_AGENT}
        ) as client:
            resp = await client.head(favicon_url)
            if resp.status_code < 400:
                return str(resp.url)
    except Exception:
        logger.warning("Favicon HEAD request failed for %s", site_url)

    try:
        async with httpx.AsyncClient(
            timeout=10, follow_redirects=True, headers={"User-Agent": USER_AGENT}
        ) as client:
            resp = await client.get(site_url)
            if resp.status_code >= 400:
                return None
            soup = BeautifulSoup(resp.text, "lxml")
            link = soup.find("link", rel=lambda r: r and "icon" in r)
            if link and link.get("href"):
                href = link["href"]
                if isinstance(href, str):
                    return urljoin(site_url, href)
    except Exception:
        logger.warning("Favicon HTML discovery failed for %s", site_url)

    return None


async def fetch_and_store_feed(feed: Feed, db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    is_initial_fetch = feed.checked_at is None
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

    if not feed.icon_url:
        icon_url = _extract_feed_icon(parsed)
        if icon_url:
            feed.icon_url = icon_url
        elif feed.site_url:
            favicon = await _discover_favicon(feed.site_url)
            if favicon:
                feed.icon_url = favicon

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
        if snippet:
            snippet = _html_to_text(snippet)
        elif content_value:
            snippet = _html_to_text(content_value)

        if not content_value:
            extracted = await _fetch_and_extract_content(entry_url)
            if extracted:
                content_value = extracted
                if not snippet:
                    snippet = _html_to_text(extracted)

        article = Article(
            feed_id=feed.id,
            title=entry.get("title", "Untitled"),
            url=entry_url,
            content=content_value,
            content_snippet=snippet[:500] if snippet else None,
            image_url=_extract_image_url(entry, content_value),
            author=entry.get("author", None),
            published_at=_parse_published(entry),
            fetched_at=now,
            created_at=now,
            is_initial_fetch=is_initial_fetch,
        )
        new_articles.append(article)

    if new_articles:
        # Apply delete rules before storing articles
        try:
            from app.services.automation import apply_delete_rules
            new_articles = await apply_delete_rules(feed, new_articles, db)
        except Exception:
            logger.warning("Error applying delete automation rules, storing all articles")

    if new_articles:
        db.add_all(new_articles)

    # Apply non-delete rules after storing articles
    if new_articles:
        try:
            from app.services.automation import apply_non_delete_rules
            await apply_non_delete_rules(feed, new_articles, db)
        except Exception:
            logger.warning("Error applying non-delete automation rules")

    if new_articles:
        ingested_at = datetime.now(timezone.utc)
        for article in new_articles:
            article.created_at = ingested_at

    feed.checked_at = now
    feed.next_check_at = _compute_next_check(feed)
    await db.commit()


async def refresh_all_feeds(db: AsyncSession, user_id: UUID) -> dict[str, int]:
    result = await db.execute(select(Feed).where(Feed.user_id == user_id))
    feeds = result.scalars().all()

    refreshed = 0
    failed = 0
    for feed in feeds:
        try:
            await fetch_and_store_feed(feed, db)
            refreshed += 1
        except Exception:
            failed += 1
            logger.exception("Failed to refresh feed %s", feed.id)

    return {"refreshed": refreshed, "failed": failed}


async def refresh_all_due_feeds(db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Feed).where((Feed.next_check_at.is_(None)) | (Feed.next_check_at <= now))
    )
    feeds = result.scalars().all()

    for feed in feeds:
        try:
            await fetch_and_store_feed(feed, db)
        except Exception:
            feed.parsing_error_count += 1
            feed.parsing_error_message = "Unexpected fetch error"
            feed.checked_at = now
            feed.next_check_at = _compute_next_check(feed)
            await db.commit()


def generate_opml(feeds_with_category: list[tuple[Feed, str | None]]) -> str:
    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append('<opml version="2.0">')
    lines.append("  <head>")
    lines.append("    <title>Feedlyra Subscriptions</title>")
    lines.append("  </head>")
    lines.append("  <body>")

    # Group feeds by category
    categorized: dict[str | None, list[Feed]] = {}
    for feed, cat_title in feeds_with_category:
        categorized.setdefault(cat_title, []).append(feed)

    _xattr = {'"': "&quot;"}

    # Output categorized feeds first
    for cat_title, feeds in categorized.items():
        if cat_title is None:
            continue
        cat_escaped = xml_escape(cat_title, _xattr)
        lines.append(f'    <outline text="{cat_escaped}" title="{cat_escaped}">')
        for feed in feeds:
            title_escaped = xml_escape(feed.title, _xattr)
            url_escaped = xml_escape(feed.url, _xattr)
            site_escaped = ""
            if feed.site_url:
                site_escaped = f' htmlUrl="{xml_escape(feed.site_url, _xattr)}"'
            lines.append(f'      <outline type="rss" text="{title_escaped}" title="{title_escaped}" xmlUrl="{url_escaped}"{site_escaped} />')
        lines.append("    </outline>")

    # Output uncategorized feeds
    uncategorized = categorized.get(None, [])
    for feed in uncategorized:
        title_escaped = xml_escape(feed.title, _xattr)
        url_escaped = xml_escape(feed.url, _xattr)
        site_escaped = ""
        if feed.site_url:
            site_escaped = f' htmlUrl="{xml_escape(feed.site_url, _xattr)}"'
        lines.append(f'    <outline type="rss" text="{title_escaped}" title="{title_escaped}" xmlUrl="{url_escaped}"{site_escaped} />')

    lines.append("  </body>")
    lines.append("</opml>")
    return "\n".join(lines)


def parse_opml(xml_content: str) -> list[dict[str, str | None]]:
    """Parse OPML with nested outline support.

    Outer outlines without xmlUrl are treated as categories.
    Inner outlines with xmlUrl are feeds assigned to the parent category.
    Top-level outlines with xmlUrl are uncategorized feeds.
    """
    soup = BeautifulSoup(xml_content, "xml")
    feeds: list[dict[str, str | None]] = []

    body = soup.find("body")
    if not body:
        return feeds

    for outline in body.find_all("outline", recursive=False):
        xml_url = outline.get("xmlurl") or outline.get("xmlUrl")
        if xml_url:
            # Top-level feed (uncategorized)
            feeds.append({
                "title": outline.get("title") or outline.get("text"),
                "url": xml_url,
                "site_url": outline.get("htmlurl") or outline.get("htmlUrl"),
                "category": None,
            })
        else:
            # Category outline — look for nested feed outlines
            category_title = outline.get("title") or outline.get("text")
            for child in outline.find_all("outline", recursive=False):
                child_xml_url = child.get("xmlurl") or child.get("xmlUrl")
                if child_xml_url:
                    feeds.append({
                        "title": child.get("title") or child.get("text"),
                        "url": child_xml_url,
                        "site_url": child.get("htmlurl") or child.get("htmlUrl"),
                        "category": category_title,
                    })

    return feeds
