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

