# Research: RSS Feed Parsing Solutions for Python + FastAPI Backend

- **Query**: Python RSS/Atom feed parsing libraries, periodic feed fetching best practices, full-text extraction, major RSS reader architectures
- **Scope**: External
- **Date**: 2026-05-22

## Findings

### 1. Python RSS/Atom Feed Parsing Libraries

| Library | Version | Stars | Last Release | License | Python | Status |
|---|---|---|---|---|---|---|
| feedparser | 6.0.12 | 2,370 | 2025-09-10 | BSD-2-Clause | >=3.10 | Active, production-stable |
| feedfinder2 | 0.0.4 | N/A | Very old | N/A | N/A | Unmaintained, only 3 releases ever |
| RSS-Parser | 2.1.1 | N/A | Recent | N/A | N/A | Alternative, less known |

#### feedparser (Recommended Primary Choice)

**Core API**:
```python
import feedparser
d = feedparser.parse('https://example.com/feed.xml')
# d.feed          - feed-level metadata (title, link, subtitle, etc.)
# d.entries       - list of entries (articles)
# d.bozo          - True if feed is malformed
# d.bozo_exception - exception details if bozo
# d.etag          - ETag header from HTTP response
# d.modified      - Last-Modified header
# d.status        - HTTP status code (304 = not modified)
```

**Key characteristics**:
- Supports RSS 1.0/2.0, Atom 0.3/1.0, RDF, JSON Feed
- Handles malformed feeds gracefully (bozo bit pattern)
- Automatic encoding detection and conversion
- HTTP caching support via ETag/Last-Modified headers
- Sanitizes HTML content by default
- **Critical limitation**: Uses synchronous `requests` library internally for HTTP fetching (see `feedparser/http.py`), not compatible with async FastAPI without thread pool wrapping
- Dependencies: `sgmllib3k==1.0.0`, `requests>=2.20.0`
- Open issues: 105 (moderate backlog)

**Async usage pattern for FastAPI**:
```python
import asyncio
import feedparser
from functools import partial

async def parse_feed_async(url: str):
    """Run feedparser in thread pool since it's synchronous."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, partial(feedparser.parse, url))
    return result
```

**Alternative async approach**: Use `httpx` (async) to fetch raw content, then pass to feedparser:
```python
import httpx
import feedparser

async def fetch_and_parse(url: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers={"Accept": "application/atom+xml,application/rss+xml"})
    # feedparser.parse() accepts raw content bytes/string
    return feedparser.parse(response.content)
```
This approach is preferred for FastAPI because:
- Full control over HTTP client (timeouts, retries, rate limiting, user-agent)
- Supports HTTP/2, connection pooling
- Can implement ETag/Last-Modified caching manually
- Async I/O doesn't block the event loop

#### feedfinder2

- Last version 0.0.4, essentially unmaintained
- Purpose: Given a website URL, discover its RSS/Atom feed URL(s)
- Uses feedparser internally
- Too unmaintained for production use; implement feed discovery manually using HTML parsing (lxml/beautifulsoup4) of `<link rel="alternate" type="application/rss+xml">` tags

### 2. Periodic Feed Fetching Best Practices

#### Scheduling Approaches for FastAPI

| Approach | Library | Complexity | Best For |
|---|---|---|---|
| In-process scheduler | APScheduler 3.11.2 | Low | Small-medium deployments |
| Lightweight task queue | arq 0.28.0 (async, Redis-backed) | Medium | Async-first, moderate scale |
| Full task queue | Celery 5.6.3 + Redis/RabbitMQ | High | Large scale, complex workflows |
| Simple async loop | asyncio + periodic task | Very Low | MVP, minimal dependencies |

**Recommended for MVP**: Start with a simple asyncio periodic task pattern within FastAPI, evolve to arq (async Redis task queue) if needed.

```python
# Simple periodic fetcher within FastAPI
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background feed refresh task
    task = asyncio.create_task(periodic_feed_refresh(app))
    yield
    task.cancel()

async def periodic_feed_refresh(app: FastAPI):
    while True:
        await refresh_all_feeds()
        await asyncio.sleep(300)  # 5 minutes
```

**If scaling needed**: arq is the best fit for async FastAPI:
- Built for async/await from the ground up
- Uses Redis as task broker (lightweight vs Celery's RabbitMQ requirement)
- Native support in FastAPI via dependency injection
- Worker processes tasks concurrently with `asyncio`

#### Concurrency and Rate Limiting

**Key patterns observed from Miniflux**:
- Worker pool pattern: configurable number of workers consuming from a job queue channel
- Each worker processes one feed at a time
- Feed refresh is a single atomic operation per feed
- Miniflux default: uses Go channels + goroutine pool, Python equivalent is `asyncio.Semaphore`

**Python async concurrency control**:
```python
async def refresh_all_feeds():
    sem = asyncio.Semaphore(10)  # max 10 concurrent fetches
    async with sem:
        await fetch_feed(feed_url)
```

**Rate limiting considerations**:
- Respect `ETag` and `Last-Modified` HTTP headers to avoid re-downloading unchanged feeds (HTTP 304)
- Store `etag` and `modified` per feed in database, send on next request
- feedparser exposes these: `d.etag`, `d.modified`
- Implement per-domain rate limiting to avoid overwhelming single hosts
- Add configurable per-feed refresh interval (respect `<ttl>` in RSS, `pub:period` in Atom)
- Randomize fetch timing slightly to avoid thundering herd on popular feeds
- Set reasonable HTTP timeouts (connect: 10s, read: 30s)
- Honor HTTP 429 (Too Many Requests) and Retry-After header
- Respect robots.txt and Crawl-Delay

#### Error Handling for Broken Feeds

**Pattern from Miniflux's Feed model** (see `internal/model/feed.go`):
- `ParsingErrorMsg` - store last error message
- `ParsingErrorCount` - track consecutive failures
- `CheckedAt` / `NextCheckAt` - schedule next check based on failure count
- Exponential backoff on consecutive failures (check less frequently for broken feeds)
- Disable feed after N consecutive failures (with user notification)

**Recommended error handling strategy**:
```python
if result.bozo and not isinstance(result.bozo_exception, feedparser.CharacterEncodingOverride):
    # Real parsing error
    feed.parsing_error_count += 1
    feed.parsing_error_message = str(result.bozo_exception)
    # Exponential backoff: 5min, 10min, 20min, 40min, ... up to 24h max
    backoff = min(300 * (2 ** feed.parsing_error_count), 86400)
    feed.next_check_at = now + timedelta(seconds=backoff)
else:
    feed.parsing_error_count = 0
    feed.parsing_error_message = None
```

**Specific feed error categories**:
- HTTP errors (4xx, 5xx): retry with backoff
- DNS resolution failures: mark as unreachable, retry later
- Malformed XML (bozo=1): feedparser handles most gracefully, store warning
- CharacterEncodingOverride: benign, not a real error
- Feed permanently gone (HTTP 410): disable feed, notify user

### 3. Full-Text Extraction from Article URLs

| Library | Version | Stars | Last Release | License | Maintained | Quality |
|---|---|---|---|---|---|---|
| trafilatura | 2.0.0 | 5,990 | 2024-12-03 | Apache 2.0 | Active | Best in class (per academic benchmarks) |
| readability-lxml | 0.8.4.1 | 2,895 | Recent | Apache 2.0 | Moderate | Good, simple |
| newspaper3k | 0.2.8 | 15,056 | 2014-12-17 | MIT | **Unmaintained** | NLP features but stale |
| python-readability | 0.1.3 | N/A | N/A | N/A | Minimal | Basic |

#### trafilatura (Recommended)

**Why best choice**:
- Won ScrapingHub's article extraction benchmark
- Won academic evaluation (Lejeune & Barbaresi 2020)
- Best single tool by ROUGE-LSum Mean F1 (Bevendorff et al. 2023)
- Used by HuggingFace, IBM, Microsoft Research, Stanford, Allen Institute
- Active maintenance, regular releases through 2024

**Core API**:
```python
import trafilatura

# Fetch and extract from URL
downloaded = trafilatura.fetch_url(url)
if downloaded:
    # Extract main text + metadata
    result = trafilatura.extract(
        downloaded,
        output_format='json',  # or 'txt', 'markdown', 'xml', 'csv'
        include_metadata=True,  # title, author, date, etc.
        include_comments=False,
        include_tables=True,
        include_images=True,
        favor_precision=True,  # prefer precision over recall
    )

# Also supports sitemap/feed discovery
trafilatura.sitemaps.find_sitemaps(domain)
trafilatura.feeds.find_feeds(url)
```

**Key features**:
- Built-in URL fetching with polite crawling
- Metadata extraction: title, author, date, categories, tags
- Multiple output formats: TXT, Markdown, JSON, CSV, XML, XML-TEI
- Language detection (optional)
- jusText and readability algorithms integrated
- Dependencies: certifi, charset_normalizer, courlan, htmldate, justext, lxml, urllib3
- **Limitation**: Synchronous HTTP fetching internally (similar to feedparser), needs thread pool for async

**Note on license**: trafilatura >= 1.8.0 uses Apache 2.0; versions < 1.8.0 were GPLv3+

#### readability-lxml (Alternative)

- Python port of Mozilla's Readability algorithm
- Simple API: `Document(html_content).summary()`
- Less feature-rich than trafilatura but lighter weight
- Good fallback if trafilatura is too heavy

#### newspaper3k (Not Recommended)

- 15K stars but **last release was 2014** (0.0.9)
- The `newspaper3k` package on PyPI (0.2.8) is a community fork, not the original
- Has NLP features (NLP summarization, keyword extraction) but these are stale/slow
- Known issues with modern websites (JavaScript-rendered content, paywalls)
- Not suitable for production use despite high star count

#### Miniflux's Approach to Content Extraction

From `internal/reader/scraper/scraper.go`:
1. First try **custom CSS selector rules** if the site has predefined rules (maintained list of ~50 sites)
2. Fall back to **readability algorithm** (custom Go implementation) if no custom rules
3. Readability uses candidate scoring with positive/negative keyword heuristics (similar to Mozilla Readability)

From `internal/reader/processor/processor.go`:
- Per-site processors for YouTube, Bilibili, Odysee, Nebula (extract video metadata)
- Reading time calculation

**Recommended strategy for Feedlyra**:
1. Use `feedparser` to parse RSS/Atom feeds and get article entries
2. If feed entry has full content in `<content:encoded>` or `<summary>`, use that directly
3. If only excerpt/link provided, use `trafilatura` to fetch and extract full text from article URL
4. Cache extracted content to avoid re-fetching

### 4. Major RSS Reader Architectures

#### Miniflux (Go + PostgreSQL)

**Architecture overview** (from source analysis):
- Single binary, no ORM, direct SQL
- PostgreSQL only (same as Feedlyra's chosen DB)
- Worker pool pattern for feed refresh

**Key architectural components**:
```
internal/
  reader/
    fetcher/    - HTTP request building (ETag, Last-Modified, User-Agent, proxy)
    parser/     - Feed format detection and dispatch (Atom/RSS/JSON/RDF)
    atom/       - Atom feed parser
    rss/        - RSS feed parser
    rdf/        - RDF feed parser
    json/       - JSON Feed parser
    handler/    - Feed CRUD + refresh orchestration
    processor/  - Per-site content processors (YouTube, etc.)
    scraper/    - Full-text extraction (CSS rules + readability fallback)
    readability/- Readability algorithm implementation
    sanitizer/  - HTML sanitization
    rewrite/    - Content rewriting rules
    filter/    - Article filtering (blocklist/keeplist regex)
    icon/      - Favicon fetching
    opml/      - OPML import/export
    urlcleaner/ - UTM/tracking parameter removal
  worker/       - Worker pool (configurable worker count, channel-based job queue)
  model/        - Data models (Feed, Entry, User, etc.)
  storage/      - Database layer (PostgreSQL queries)
  integration/  - Third-party service integrations (25+ services)
```

**Feed refresh flow**:
1. Scheduler pushes jobs (userID, feedID) to worker pool channel
2. Worker goroutine picks job from channel
3. Worker calls `feedHandler.RefreshFeed(store, userID, feedID, false)`
4. RefreshFeed: fetches HTTP response -> detects format -> parses -> processes entries -> stores
5. HTTP caching: sends ETag + Last-Modified, skips if 304
6. Error tracking: stores error count + message, exponential backoff on next check

**Scheduling strategies** (from `internal/model/feed.go`):
- `SchedulerRoundRobin`: Simple round-robin across all feeds
- `SchedulerEntryFrequency`: Adjusts check frequency based on how often a feed publishes new entries (more active feeds checked more often)

**Feed model key fields**:
- `EtagHeader`, `LastModifiedHeader` - HTTP cache headers
- `ParsingErrorMsg`, `ParsingErrorCount` - error tracking
- `CheckedAt`, `NextCheckAt` - scheduling
- `ScraperRules`, `RewriteRules` - content extraction customization
- `BlocklistRules`, `KeeplistRules` - article filtering
- `Crawler` - whether to fetch full article content
- `UserAgent`, `Cookie`, `Username`, `Password` - authentication
- `DisableHTTP2`, `FetchViaProxy`, `ProxyURL` - network options

#### FreshRSS (PHP + SQLite/MySQL/PostgreSQL)

**Architecture overview** (from source analysis):
- PHP application, traditional MVC
- Supports multiple database backends

**Key architectural components**:
```
app/
  Models/      - Feed, Entry, User, Category models
  Controllers/ - HTTP request handling
  Services/    - Business logic services
  SQL/         - Database migration scripts
  Utils/       - Utilities
  i18n/        - Internationalization
  views/       - Templates
```

**Feed model** (from `app/Models/Feed.php`):
- `KIND_RSS` (0): Normal RSS/Atom
- `KIND_RSS_FORCED` (2): Invalid but forced RSS/Atom
- `KIND_HTML_XPATH` (10): HTML + XPath scraping
- `KIND_XML_XPATH` (15): XML + XPath scraping
- `KIND_JSON_XPATH` (20): JSON + XPath scraping
- `KIND_JSONFEED` (25): JSON Feed
- Supports HTTP auth, XPath scraping, multiple feed kinds
- `ttl` field for refresh interval
- `error` field for tracking consecutive errors
- `pathEntries` for custom scraping rules per feed

**Feed refresh**:
- Uses `actualize_script.php` for CLI-based feed refresh (can run as cron job)
- PHP's `SimplePie` library for feed parsing
- XPath-based scraping for non-RSS sources (HTML, JSON, XML)

#### Feedbin (Ruby + PostgreSQL, Commercial/Proprietary)

- Closed source, commercial RSS reader service
- Known architectural patterns (from public docs/blog posts):
  - Ruby on Rails backend
  - PostgreSQL for data storage
  - Sidekiq (Redis-backed) for background job processing
  - Full-text search via Elasticsearch (later moved to PostgreSQL tsvector)
  - Extracts full content via custom readability implementation
  - Podcast support with audio enclosure handling

#### Common Architectural Patterns Across RSS Readers

1. **Worker pool / job queue**: All major readers use background workers, not inline HTTP fetching
2. **HTTP caching**: ETag + Last-Modified support is universal (saves bandwidth and server load)
3. **Error tracking with backoff**: Consecutive failure counting + exponential backoff on next check
4. **Content extraction as optional**: "Crawler" flag per feed to decide whether to fetch full article text
5. **Multiple feed format support**: RSS 1.0/2.0, Atom, JSON Feed at minimum
6. **HTML sanitization**: Always sanitize feed HTML before rendering (XSS prevention)
7. **Tracking parameter removal**: Strip UTM_*, fbclid, etc. from URLs
8. **OPML import/export**: Standard for feed subscription management
9. **Feed discovery**: Given a website URL, auto-discover its feed URL via `<link>` tags
10. **Per-feed customization**: User-agent, cookies, auth, proxy, scraping rules per feed

### Related Specs

- `.trellis/tasks/05-22-ai-rss/prd.md` - Project PRD specifying Python + FastAPI backend, PostgreSQL, RSS feed management
- `.trellis/spec/backend/index.md` - Backend guidelines (currently unfilled)
- `.trellis/spec/backend/directory-structure.md` - Backend structure (currently unfilled)

## Caveats / Not Found

- feedparser has no native async support; must use thread pool or split HTTP fetching from parsing
- newspaper3k appears popular (15K stars) but is effectively unmaintained since 2014; the PyPI package is a community fork
- feedfinder2 is unmaintained; feed auto-discovery will need manual implementation via HTML parsing
- trafilatura's internal HTTP client is synchronous; for async FastAPI, use httpx to fetch + trafilatura to extract from HTML string
- Miniflux and FreshRSS are written in Go/PHP respectively; their architectural patterns are transferable but not their code
- No well-maintained Python-specific async RSS reader framework was found; Feedlyra will need to build its own feed refresh infrastructure
- OPML support: `opml` package (0.5) exists but is minimal; may need custom implementation for full OPML 2.0 support
