# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

Backend quality standards derived from implementing AI features (PR3/PR4) and debugging SSE streaming, Fernet encryption, and OpenAI client integration.

---

## Forbidden Patterns

### Don't: Bare `except: pass` in service code

```python
# Bad — swallows ALL errors including config/auth failures
try:
    await summarize(article)
except:
    pass
```

**Why**: Silent failures hide real bugs (wrong API key, missing config, network errors) and make debugging impossible.

**Instead**:
```python
try:
    await summarize(article)
except ValueError as e:
    logger.warning("Skip auto-summarize: %s", e)
except Exception:
    logger.exception("Unexpected error during auto-summarize")
```

---

### Don't: Use request-injected DB sessions inside StreamingResponse generators

```python
# Bad — request session closes before generator finishes
async def event_stream(db: AsyncSession):
    # db may be closed by the time this yields
    yield f"data: {json.dumps(chunk)}\n\n"
    db.add(assistant_msg)  # session already closed!
    await db.commit()
```

**Why**: FastAPI resolves dependencies before returning the StreamingResponse. The request-scoped session closes when the response object is created, but the generator runs lazily — the session is dead by the time `yield` executes.

**Instead**:
```python
async def event_stream():
    async with async_session() as db:
        # independent session with its own lifecycle
        yield f"data: {json.dumps(chunk)}\n\n"
        db.add(assistant_msg)
        await db.commit()
```

---

### Don't: Access `chunk.choices[0]` without guarding empty choices in OpenAI streaming

```python
# Bad — final chunks can have empty choices array
delta = chunk.choices[0].delta.content
```

**Why**: OpenAI API sends final stream chunks with `choices: []`. Accessing index 0 raises `IndexError`.

**Instead**:
```python
if not chunk.choices:
    continue
delta = chunk.choices[0].delta.content
```

---

## Required Patterns

### Fernet Key Derivation via SHA256

When encrypting secrets (API keys) at rest with Fernet, the key MUST be derived from the app's `SECRET_KEY` using SHA256 — not by truncating/padding the raw string.

```python
import hashlib, base64
from cryptography.fernet import Fernet

def _derive_fernet_key(secret: str) -> bytes:
    return base64.urlsafe_b64encode(
        hashlib.sha256(secret.encode()).digest()
    )

fernet = Fernet(_derive_fernet_key(settings.SECRET_KEY))
```

**Why**: Fernet requires exactly 32 url-safe base64-encoded bytes (256 bits). Naive approaches like `secret.encode().ljust(32)[:32]` don't produce valid Fernet keys and raise `ValueError` at runtime.

---

### API Key Response Hygiene

API endpoints that return AI config MUST use `has_api_key: bool` instead of returning the plaintext key.

```python
class AIConfigResponse(BaseModel):
    ai_base_url: str | None
    has_api_key: bool  # NEVER: ai_api_key: str | None
    ai_model: str | None
```

**Why**: Returning plaintext secrets in API responses exposes them in logs, browser DevTools, and any middleware. Even masked values leak length information.

---

### Don't: Assume feedparser returns simple strings for icon/image

```python
# Bad — icon/image can be FeedParserDict (dict subclass), not just str
icon_url = parsed.feed.get("icon")
return icon_url  # might be a dict!
```

**Why**: feedparser's `icon` and `image` fields may return a `FeedParserDict` (dict subclass with `href`/`url` keys) instead of a plain string, depending on the feed format.

**Instead**:
```python
icon = parsed.feed.get("icon")
if isinstance(icon, dict):
    icon_url = icon.get("href") or icon.get("url")
elif isinstance(icon, str):
    icon_url = icon
```

---

### Gotcha: Return `resp.url` after redirect, not the constructed URL

```python
# Bad — if server redirects /favicon.ico to a CDN, the constructed URL doesn't match the actual resource
favicon_url = urljoin(site_url, "/favicon.ico")
resp = await client.head(favicon_url)
if resp.status_code < 400:
    return favicon_url  # may 404 when loaded later
```

**Why**: CDN-hosted favicons may redirect `/favicon.ico` to a different domain. Returning the pre-redirect URL means the browser loads a URL that no longer serves the resource.

**Instead**:
```python
return str(resp.url)  # the final URL after all redirects
```

---

## Testing Requirements

- SSE streaming endpoints must test with independent DB sessions
- Fernet key derivation must be tested against `cryptography.fernet.Fernet()` constructor (invalid keys throw `ValueError`)
- OpenAI streaming mock must include chunks with empty `choices` array

---

## Code Review Checklist

- [ ] SSE generators use independent DB sessions, not request-injected ones
- [ ] OpenAI streaming code guards `if not chunk.choices: continue`
- [ ] Fernet key derivation uses SHA256, not string manipulation
- [ ] API key fields in responses are boolean indicators, not plaintext
- [ ] No bare `except: pass` — use specific exception types with logging
- [ ] feedparser `icon`/`image` fields may be dict or str — always check type before accessing
