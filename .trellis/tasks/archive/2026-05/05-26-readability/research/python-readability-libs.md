# Research: Python Readability Libraries for Web Content Extraction

- **Query**: Research Python implementations of Mozilla Readability algorithm for extracting main content from web pages, focusing on HTML output for an RSS reader backend
- **Scope**: mixed (internal codebase + external libraries)
- **Date**: 2026-05-26

## Findings

### 1. readability-lxml (PyPI: `readability`)

| Attribute | Value |
|---|---|
| PyPI name | `readability-lxml` (import as `readability`) |
| Latest version | 0.8.4.1 |
| Last release | 2025-05-03 |
| GitHub | https://github.com/buriy/python-readability |
| Stars | 2,894 |
| License | Apache-2.0 |
| Last GitHub push | 2026-01-26 (Python 3.14 support) |
| Dependencies | `chardet`, `lxml[html_clean]`, `cssselect`, `lxml-html-clean` (Python < 3.11) |

**Installation**: `pip install readability-lxml`

**Usage**:
```python
from readability import Document

doc = Document(html_string, url=page_url)
title = doc.title()
short_title = doc.short_title()
author = doc.author()
summary_html = doc.summary()  # Returns HTML string
content_html = doc.content()  # Returns document body HTML

# Optional: partial HTML (no <html><body> wrapper)
summary_html = doc.summary(html_partial=False)

# Optional: keep all images
summary_html = doc.summary(keep_all_images=True)

# Hint extraction with keywords
doc = Document(html, positive_keywords=["news-item", "block"],
               negative_keywords=["sidebar", "ads"])
```

**Input/Output**:
- Input: HTML string (or lxml HtmlElement)
- Output: `doc.summary()` returns **HTML** string (preserves formatting, links, images)
- `doc.content()` returns the full document body HTML
- `doc.title()`, `doc.short_title()`, `doc.author()` return plain text strings

**Quality vs Readability.js**:
- This is a Python port of the original Arc90 Readability algorithm (not a direct port of Mozilla's Readability.js)
- The algorithm uses similar scoring heuristics (positive/negative regex, link density, class weight) but is NOT identical to the JavaScript implementation
- Compared to Mozilla Readability.js, it may handle some edge cases differently
- It does NOT include `isProbablyReaderable()` check (but trafilatura's fork does)

**Maintenance**:
- Actively maintained: latest commit 2026-01-26 adding Python 3.14 support
- Release 0.8.4.1 on 2025-05-03
- 37 open issues on GitHub

**Key observation**: trafilatura already ships a **forked copy** of this library internally at `trafilatura/readability_lxml.py`. The fork is simplified (no `url` param for link resolution, no `positive_keywords`/`negative_keywords`, no `keep_all_images`, no `html_partial`) and used as a fallback extraction method.

---

### 2. readabilipy (PyPI: `readabilipy`)

| Attribute | Value |
|---|---|
| PyPI name | `readabilipy` |
| Latest version | 0.3.0 |
| Last release | 2024-12-02 |
| GitHub | https://github.com/alan-turing-institute/ReadabiliPy |
| Stars | 356 |
| License | MIT |
| Dependencies | `beautifulsoup4>=4.7.1`, `html5lib`, `lxml`, `regex` |

**Node.js subprocess**: YES - when `use_readability=True`, it calls Mozilla's Readability.js via a Node.js subprocess. Requires Node.js v10+ and `npm install` of the bundled JS package.

**Pure Python mode**: YES - default mode (`use_readability=False`) uses its own pure-Python extraction (`simple_tree_from_html_string`), which uses BeautifulSoup + html5lib with heuristic simplifiers.

**Usage**:
```python
from readabilipy import simple_json_from_html_string, simple_tree_from_html_string

# Pure Python mode (default)
result = simple_json_from_html_string(html_string)
# Returns dict: {title, byline, date, content, plain_content, plain_text}
# content = HTML string, plain_content = simplified HTML, plain_text = plain text

# With Mozilla Readability.js (requires Node.js)
result = simple_json_from_html_string(html_string, use_readability=True)
# Returns dict with same structure, content comes from Readability.js

# Tree-based extraction (pure Python)
tree = simple_tree_from_html_string(html_string)
# Returns a BeautifulSoup Tag (div element) with cleaned HTML content
```

**Input/Output**:
- Input: HTML string
- Output: `simple_json_from_html_string` returns a dict with `content` (HTML), `plain_content` (simplified HTML), `plain_text` (text)
- `simple_tree_from_html_string` returns a BeautifulSoup Tag object

**Node.js dependency details**:
- Ships `ExtractArticle.js` and `package.json` in `readabilipy/javascript/`
- Writes HTML to a temp file, calls `node ExtractArticle.js -i input.html -o output.json`
- Reads JSON output back from temp file
- NOT async-safe by default (uses synchronous `subprocess.run`)
- Temp file approach could have concurrency issues under high load

**Maintenance**:
- Less active: last commit 2024-12-02 (version bump + Python version update)
- 18 open issues

**Quality**:
- When using `use_readability=True`, output quality matches Mozilla Readability.js exactly (since it IS Readability.js)
- Pure Python mode uses a simpler heuristic approach, likely lower quality than Readability.js

---

### 3. pyreadability (PyPI: `pyreadability`)

| Attribute | Value |
|---|---|
| PyPI name | `pyreadability` |
| Latest version | 0.4.0 |
| Last release | 2014-12-17 |
| Dependencies | None listed |

**This library is abandoned.** Last release was over 11 years ago. No GitHub repository found. Not recommended for any use.

---

### 4. trafilatura (already a project dependency)

| Attribute | Value |
|---|---|
| PyPI name | `trafilatura` |
| Latest version | 2.0.0 |
| Last release | 2024-12-03 |
| GitHub | https://github.com/adbar/trafilatura |
| Stars | 6,003 |
| License | Apache-2.0 |
| Dependencies | `certifi`, `charset_normalizer>=3.4.0`, `courlan>=1.3.2`, `htmldate>=1.9.2`, `justext>=3.0.1`, `lxml>=5.3.0`, `urllib3<3` |

**HTML output via `output_format` parameter**:
```python
import trafilatura

# Extract as HTML
html_output = trafilatura.extract(downloaded_html, output_format="html")

# Other formats: "csv", "json", "markdown", "txt", "xml", "xmltei"
html_output = trafilatura.extract(
    downloaded_html,
    output_format="html",
    include_images=True,      # experimental, include <img> tags
    include_formatting=True,  # keep structural formatting elements
    include_links=True,       # keep links with targets (experimental)
    include_tables=True,      # include <table> elements
    favor_precision=True,     # prefer less but correct extraction
    favor_recall=True,        # prefer more text when unsure
)
```

**HTML output format details**:
- `output_format="html"` calls `build_html_output()` which:
  1. Takes trafilatura's internal XML representation
  2. Converts XML tags to standard HTML tags via `HTML_CONVERSIONS` mapping
  3. Wraps in `<html><body>...</body></html>` structure
  4. Returns pretty-printed HTML string
- The HTML output is NOT the original page HTML; it's a reconstruction from trafilatura's intermediate representation
- Images are only included with `include_images=True` (experimental feature)
- Links are only included with `include_links=True` (experimental feature)

**Internal Readability usage**:
- trafilatura ships its own fork of `readability-lxml` at `trafilatura/readability_lxml.py`
- Used as a **fallback/safety net** in `compare_extraction()` (external.py)
- When trafilatura's own XPath-based extraction produces poor results, it falls back to the Readability algorithm
- The fork returns XML (via `lxml.etree.tostring(method="xml")`), not HTML directly

**HTTP client**:
- Uses `urllib3` (not httpx) internally for `fetch_url()`
- Supports pycurl for faster downloads if installed
- Supports SOCKS proxy via `urllib3.contrib.socks`
- Does NOT support httpx or async HTTP clients

**Current usage in project** (`feed_fetcher.py:87-93`):
```python
def _extract_full_text(url: str) -> str | None:
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            return trafilatura.extract(downloaded, favor_precision=True)
    except Exception:
        pass
    return None
```
Issues:
1. Uses `trafilatura.fetch_url()` (urllib3-based) instead of app's httpx client
2. Returns plain text (`trafilatura.extract()` default is `output_format="txt"`)
3. Called synchronously in executor via `run_in_executor()`

---

### 5. Comparison: Readability vs trafilatura

| Feature | readability-lxml | readabilipy (Readability.js) | trafilatura |
|---|---|---|---|
| Algorithm | Arc90 Readability (Python) | Mozilla Readability.js (via Node) or pure Python | XPath + heuristics + justext + Readability fallback |
| HTML output | `doc.summary()` returns HTML directly | `content` field returns HTML | `extract(output_format="html")` returns reconstructed HTML |
| Image preservation | `keep_all_images=True` | Preserves in Readability.js mode | `include_images=True` (experimental) |
| Link preservation | Preserved by default | Preserved in Readability.js mode | `include_links=True` (experimental) |
| Title extraction | `doc.title()`, `doc.short_title()` | `result["title"]` | Included in metadata |
| Author extraction | `doc.author()` | `result["byline"]` | Included in metadata |
| JavaScript-rendered content | No | No (Readability.js runs on static HTML) | No |
| Paywall handling | No special handling | No special handling | No special handling |
| Custom HTTP client | N/A (no built-in downloader) | N/A (no built-in downloader) | Uses urllib3; can accept pre-fetched HTML |
| Async compatible | Yes (pure Python, sync) | Problematic (Node.js subprocess, temp files) | Yes (pure Python, sync - use with executor) |
| Input | HTML string or lxml element | HTML string | HTML string, bytes, lxml element, or urllib3 response |
| Extraction quality (general) | Good for article-style pages | Best (when using Readability.js) - matches Firefox Reader Mode | Best overall - uses multiple strategies + fallback |
| Extraction quality (non-article) | Moderate | Moderate (Readability.js tuned for articles) | Good - handles forums, comments, metadata |
| Edge case handling | Moderate | Good (Readability.js mature) | Best - multi-strategy with fallback chain |

**Key insight**: trafilatura already uses readability-lxml internally as a fallback. Adding readability-lxml separately would be redundant in terms of algorithm coverage. The main advantage of adding readability-lxml directly would be:
1. Getting **HTML output** (trafilatura's internal readability returns XML)
2. Using `positive_keywords`/`negative_keywords` hints (not available in trafilatura's fork)
3. Using `url` parameter for link resolution (not in trafilatura's fork)

---

### 6. Integration Patterns

**Pattern A: readability-lxml with httpx (recommended for HTML extraction)**
```python
import httpx
from readability import Document

async def extract_article_html(url: str) -> dict | None:
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    # Run sync readability in executor to avoid blocking event loop
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, _readability_extract, resp.text, url)
    return result

def _readability_extract(html: str, url: str) -> dict:
    doc = Document(html, url=url)
    return {
        "title": doc.short_title(),
        "content": doc.summary(),  # HTML output
    }
```

**Pattern B: trafilatura with output_format="html" and httpx**
```python
import httpx
import trafilatura

async def extract_article_html(url: str) -> str | None:
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None,
        trafilatura.extract,
        resp.text,
    )
    return result

# Or with bare_extraction for more control:
def _trafilatura_extract_html(html: str) -> str | None:
    return trafilatura.extract(
        html,
        output_format="html",
        include_images=True,
        include_links=True,
        favor_precision=True,
    )
```

**Pattern C: readabilipy with Node.js (NOT recommended for production async)**
- The Node.js subprocess + temp file approach is problematic for:
  - Concurrent requests (temp file collisions, though they use unique prefixes)
  - Deployment environments without Node.js
  - Async performance (synchronous subprocess blocks)

**Async compatibility notes**:
- `readability-lxml` uses lxml (C extension) internally - it's synchronous but fast. Use `run_in_executor()` to avoid blocking the event loop.
- `trafilatura.extract()` is synchronous - same pattern with `run_in_executor()`.
- Both libraries are NOT thread-safe for the same Document instance (create new Document per call).
- `readabilipy` with `use_readability=True` should NOT be used in async contexts due to subprocess blocking.

**HTTP client considerations**:
- Both `readability-lxml` and `trafilatura.extract()` accept pre-fetched HTML strings
- This allows using httpx (already in project) for HTTP fetching with proxy support
- `trafilatura.load_html()` can accept strings, bytes, or lxml HtmlElement
- `readability.Document` accepts strings or lxml HtmlElement
- This is a significant improvement over the current `_extract_full_text()` which uses `trafilatura.fetch_url()`

---

### Files Found

| File Path | Description |
|---|---|
| `backend/app/services/feed_fetcher.py` | Current extraction logic using trafilatura (lines 87-93) |
| `backend/pyproject.toml` | Project dependencies (trafilatura, lxml, beautifulsoup4, httpx already present) |

### Related Specs

- `.trellis/tasks/05-26-readability/prd.md` - PRD for this feature

### External References

- [readability-lxml on PyPI](https://pypi.org/project/readability-lxml/) - latest 0.8.4.1
- [readability-lxml on GitHub](https://github.com/buriy/python-readability) - 2,894 stars
- [ReadabiliPy on PyPI](https://pypi.org/project/readabilipy/) - latest 0.3.0
- [ReadabiliPy on GitHub](https://github.com/alan-turing-institute/ReadabiliPy) - 356 stars
- [trafilatura on PyPI](https://pypi.org/project/trafilatura/) - latest 2.0.0
- [trafilatura on GitHub](https://github.com/adbar/trafilatura) - 6,003 stars
- [Mozilla Readability.js](https://github.com/mozilla/readability) - the original JavaScript implementation

## Caveats / Not Found

- No direct benchmark comparing readability-lxml HTML output quality vs trafilatura HTML output quality was found
- trafilatura's `include_images` and `include_links` are marked as experimental - stability not guaranteed
- readability-lxml does NOT implement Mozilla's `isProbablyReaderable()` check, but trafilatura's fork does include it
- No Python library provides a faithful, maintained port of Mozilla Readability.js without requiring Node.js
- The `readabilipy` pure-Python mode is a different algorithm from Readability.js, despite the package name suggesting otherwise
- pyreadability is abandoned (2014) and should not be considered
