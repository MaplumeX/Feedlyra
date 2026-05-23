# Logging Guidelines

> How logging is done in this project.

---

## Overview

Python standard library `logging`. No third-party logging library. Module-level logger via `logging.getLogger(__name__)`. Application relies on uvicorn's default logging output — no custom logging configuration.

---

## Log Levels

| Level | Method | When to use |
|-------|--------|-------------|
| Exception | `logger.exception()` | Unexpected errors with full traceback (feed refresh failure, chat streaming error, background summarization failure) |
| Warning | `logger.warning()` | Recoverable issues (user has no valid AI config, skipped operation) |
| Info | `logger.info()` | Currently unused but appropriate for startup/shutdown events, periodic task cycles |
| Debug | `logger.debug()` | Currently unused |

---

## Pattern

```python
import logging

logger = logging.getLogger(__name__)

# In exception handlers
except Exception:
    logger.exception("Periodic feed refresh failed")

# For recoverable issues
logger.warning("User %s has no AI config", user.id)
```

---

## What to Log

- Unhandled exceptions with full traceback (`logger.exception`)
- Recoverable degradation warnings (missing config, fallback behavior)
- No `logger.info()` or `logger.debug()` calls currently exist, but they're appropriate for:
  - Application startup/shutdown
  - Periodic task cycle start/end
  - Successful significant operations (feed refresh completed)

---

## What NOT to Log

- API keys or secrets (even partial/masked — leaks length info)
- User passwords or tokens
- Full request/response bodies (may contain sensitive data)

---

## Structured Logging

No structured logging currently. All log messages are plain strings with `%s` formatting. If structured logging is introduced, use `extra={}` fields rather than embedding structured data in the message string.
