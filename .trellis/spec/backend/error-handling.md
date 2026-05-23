# Error Handling

> How errors are handled in this project.

---

## Overview

All errors are raised via FastAPI's `HTTPException`. No custom exception classes, no exception handlers, no centralized error middleware. Services propagate exceptions upward; routers catch and convert to HTTPException where needed.

---

## Error Response Format

FastAPI's default `{"detail": "message"}` JSON shape. No custom error envelope or error code system.

```json
{"detail": "Feed not found"}
```

---

## Status Code Convention

| Code | Usage |
|------|-------|
| `400` | Bad Request — invalid OPML, missing AI config, connection test failure |
| `401` | Unauthorized — invalid credentials/tokens |
| `404` | Not Found — standard resource-not-found |
| `409` | Conflict — duplicate feed |
| `502` | Bad Gateway — upstream feed fetch failure |

---

## Error Handling Patterns

### Router-level catch

Services generally do NOT catch exceptions internally. They propagate to the router:

```python
# app/routers/ai.py
try:
    client = get_user_llm_client(user)
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
```

### Service-level logging + re-raise

For background/long-running tasks, log and re-raise:

```python
# app/services/feed_fetcher.py
except Exception:
    logger.exception("Periodic feed refresh failed")
    raise
```

### SSE streaming errors

Return error as SSE data event:

```python
yield f"data: {json.dumps({'error': str(e)})}\n\n"
```

---

## Common Mistakes

- **Bare `except Exception: pass`** — Several places (notably `add_feed`, `_extract_full_text`, `_html_to_text`) silently swallow errors. This hides real bugs. See [[quality-guidelines]] for the forbidden pattern and correct alternative.
- **Returning plaintext API keys in error responses** — Even error responses can leak secrets in logs/middleware. Use `has_api_key: bool` instead.
