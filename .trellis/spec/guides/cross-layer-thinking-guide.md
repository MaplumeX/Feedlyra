# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

Common cross-layer bugs:
- API returns format A, frontend expects format B
- Database stores X, service transforms to Y, but loses data
- Multiple layers implement the same logic differently

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves:

```
Source → Transform → Store → Retrieve → Transform → Display
```

For each arrow, ask:
- What format is the data in?
- What could go wrong?
- Who is responsible for validation?

### Step 2: Identify Boundaries

| Boundary | Common Issues |
|----------|---------------|
| API ↔ Service | Type mismatches, missing fields |
| Service ↔ Database | Format conversions, null handling |
| Backend ↔ Frontend | Serialization, date formats |
| Component ↔ Component | Props shape changes |

### Step 3: Define Contracts

For each boundary:
- What is the exact input format?
- What is the exact output format?
- What errors can occur?

---

## Common Cross-Layer Mistakes

### Mistake 1: Implicit Format Assumptions

**Bad**: Assuming date format without checking

**Good**: Explicit format conversion at boundaries

### Mistake 2: Scattered Validation

**Bad**: Validating the same thing in multiple layers

**Good**: Validate once at the entry point

### Mistake 3: Leaky Abstractions

**Bad**: Component knows about database schema

**Good**: Each layer only knows its neighbors

---

## Checklist for Cross-Layer Features

Before implementation:
- [ ] Mapped the complete data flow
- [ ] Identified all layer boundaries
- [ ] Defined format at each boundary
- [ ] Decided where validation happens

After implementation:
- [ ] Tested with edge cases (null, empty, invalid)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Multiple teams are involved
- Data format is complex
- Feature has caused bugs before

---

## Background Async Tasks in FastAPI Request Handlers

When a request handler needs to trigger background work (e.g. fetching RSS content after OPML import), use `asyncio.create_task()` with a **separate database session** from `async_session()` — NOT the request-scoped session from `Depends(get_db)`.

**Why**: The request-scoped `db` session closes after the response is sent. Background tasks that outlive the request will get `MissingGreenlet` or session-closed errors.

```python
from app.database import async_session

for fid in feed_ids:
    async def _bg_fetch(feed_id=fid):
        async with async_session() as bg_db:
            try:
                result = await bg_db.execute(select(Feed).where(Feed.id == feed_id))
                feed = result.scalar_one_or_none()
                if feed:
                    await fetch_and_store_feed(feed, bg_db)
                    await bg_db.commit()
            except Exception:
                logger.warning("Background fetch failed for feed %s", feed_id)

    asyncio.create_task(_bg_fetch())
```

**Checklist**:
- [ ] Background task creates its own `async_session()` — never uses the request `db`
- [ ] Default argument captures loop variable (`feed_id=fid`) to avoid closure-over-loop-variable bug
- [ ] Exceptions are caught and logged — never let background tasks crash silently
- [ ] No `await` on the `create_task` result — the API returns immediately
- [ ] Frontend invalidates relevant queries after the API returns so the UI updates when data arrives

---

## Message Editing: Ordering Dependency Between Truncate and New Request

When the user edits a message, the frontend must:
1. Call `PUT /api/ai/articles/{id}/chat/messages/truncate` to delete the old anchor + subsequent messages server-side
2. Wait for the truncate response
3. Then send `POST /api/ai/articles/{id}/chat` with the new message

**Common mistake**: fire-and-forget the truncate, then immediately send the new chat request. The new chat request may arrive before the truncate completes, causing it to read stale history and produce a response based on deleted messages context.

**Correct pattern**:
```typescript
// Wait for truncate to complete before sending new message
await truncateChatMessages(articleId, msgId);
doStream(editedText);
```

**Checklist**:
- [ ] Truncate API call is `await`ed before the next chat request
- [ ] Frontend trims local state immediately (optimistic update) but waits for server confirmation before triggering new LLM call

---

## Multi-Article LLM Context: Reference Resolution Data Flow

When a conversation references multiple articles, the data flows across 4 layers:

```
DB (conversation_references + articles)
  → Service (llm.py: build_chat_messages with articles list)
    → Router (ai.py: chat_with_conversation assembles references + content)
      → SSE Streaming (same as single-article chat)
```

**Key boundaries**:

1. **DB → Service**: Router fetches all references for a conversation, then fetches each article's content via `Article.readable_content`. Passes `articles: list[{"title": str, "content": str}]` to `build_chat_messages`.

2. **Service → LLM**: `build_chat_messages` combines multi-article content with budget-aware truncation. Each article gets `budget_per_article = (total_budget - separator_overhead) / num_articles`. Uses `extract_content_for_summary` for each article.

3. **Separator overhead**: When joining N articles, there are N-1 separators. Must subtract `separator_len * (N-1)` from the total budget before dividing equally.

**Common mistake**: Forgetting separator overhead in budget calculation, causing the combined content to exceed the LLM context window.

```python
# Wrong: no separator overhead — total content can exceed budget
budget_per_article = MAX_CONTENT_CHARS // len(articles)

# Correct: subtract separator overhead first
sep_len = len("\n\n---\n\n")
available = MAX_CONTENT_CHARS - sep_len * max(0, len(articles) - 1)
budget_per_article = available // len(articles)
```

**Checklist**:
- [ ] All referenced articles fetched and content extracted
- [ ] Budget-aware truncation accounts for separator overhead
- [ ] Multi-article system prompt uses clear section headers for each article
- [ ] `extract_content_for_summary` used for each article (not raw truncation)

---

## Image Upload Data Flow

Image attachments traverse from browser to LLM across 5 layers:

```
Browser (File object → base64)
  → API (POST /conversations/{id}/images → save to filesystem)
  → API (POST /conversations/{id}/chat → include image metadata in message)
  → Service (llm.py: build_chat_messages → OpenAI vision format)
  → LLM (text + image_url content blocks)
```

**Key boundaries**:

1. **Browser → API (upload)**: Multipart form data. Backend validates type (JPEG/PNG/GIF/WebP) and size (≤10MB). Saves to local filesystem under `UPLOAD_DIR/{uuid}.{ext}`. Returns `ImageUploadResponse` with relative URL path.

2. **Browser → API (chat)**: On send, pending images are converted to base64 via `FileReader.readAsDataURL()`. Sent as `images: ["data:image/png;base64,..."]` in chat request body. For previously uploaded images, the `attachments` metadata already has the URL.

3. **API → Service**: Router passes `images: list[str]` (base64 data URLs) to `build_chat_messages`. Also stores attachment metadata on the `ChatMessage` row.

4. **Service → LLM**: `build_chat_messages` creates OpenAI vision message format: user message becomes a list of content blocks `[{"type": "text", "text": "..."}, {"type": "image_url", "image_url": {"url": "data:image/..."}}]`.

**Common mistake**: Using relative image URLs in the chat message `attachments` metadata for frontend rendering without prefixing with API base URL — images 404 because frontend runs on a different port.

```typescript
// Wrong: relative URL 404s in dev (frontend port ≠ backend port)
<img src={att.url} />  // att.url = "/api/ai/images/abc.jpg"

// Correct: prefix with API base
<img src={att.url.startsWith("/") ? `${API_BASE}${att.url}` : att.url} />
```

**Checklist**:
- [ ] Image type and size validated on upload
- [ ] Image files stored outside the repo directory (not in static assets)
- [ ] Base64 images included in LLM request as vision content blocks
- [ ] Relative image URLs prefixed with API base for frontend rendering
- [ ] Blob URLs revoked after image loads to prevent memory leaks
- [ ] Conversation deletion cleans up image files from filesystem

