# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

This directory contains guidelines for backend development in the Feedlyra project. Each file documents real conventions derived from the codebase.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Done |
| [Database Guidelines](./database-guidelines.md) | ORM patterns, queries, migrations | Done |
| [Error Handling](./error-handling.md) | Error types, handling strategies | Done |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Done |
| [Logging Guidelines](./logging-guidelines.md) | Log levels, patterns | Done |

---

## Key Conventions

- **File header**: Every `.py` file starts with `from __future__ import annotations`
- **Type annotations**: Full `Mapped[]` style on models; `str | None` union syntax (Python 3.10+ style, not `Optional`)
- **Config**: `pydantic-settings` with `.env` file loading. Module-level singleton: `settings = Settings()`
- **Async-first**: Everything is async — database, HTTP client, LLM calls all use async/await
- **UUID primary keys**: All PKs are PostgreSQL UUIDs with `default=uuid4`
- **Pydantic schemas**: Separate schema files per domain. `model_config = {"from_attributes": True}` for ORM compatibility
- **No repository pattern**: Routers and services both write SQL directly
- **Encryption of secrets**: User AI API keys are encrypted at rest with Fernet (key derived from `SECRET_KEY` via SHA256)
- **No tests, no linting, no CI** — currently not configured
- **Content extraction**: Use `readability-lxml` + httpx for web content extraction. Sync library calls wrapped in `run_in_executor()`. Never use `trafilatura.fetch_url()` — always use httpx for HTTP requests (proxy support). See `feed_fetcher.py:_fetch_and_extract_content` for the pattern.
- **Summary content extraction**: For LLM summarization, use `extract_content_for_summary()` instead of simple `content[:N]` truncation. It preserves first/last paragraphs and extracts first sentences from middle paragraphs, ensuring conclusions aren't lost. Falls back to simple truncation when no paragraph structure detected.
- **Chat content extraction**: Chat feature reuses `extract_content_for_summary()` with a 20000-char limit (vs 8000 for summary). Same smart paragraph extraction, wider window for Q&A context.
- **Chat history summarization**: When chat exceeds 8 turns, older turns beyond the last 6 are summarized via LLM and cached in `article_chats.history_summary`. Lazy + cached — only computed once per chat.
- **Conversation model**: AI chat uses independent `Conversation` entities (not bound to articles) with `ConversationReference` links for multi-article context. One `article_id` auto-injection via `is_auto=True`; additional articles added manually. All references equivalent in LLM context.
- **Multi-article LLM context**: `build_chat_messages()` accepts a list of articles + budget-aware truncation with separator overhead calculation. Each article uses `extract_content_for_summary()` with a per-article char budget.
- **Image attachments**: Chat messages support image attachments via `attachments` JSON column. Images stored on local filesystem under `UPLOAD_DIR`. Uploaded images sent to LLM as OpenAI vision `image_url` content blocks.
- **Migration transition**: `chat_messages.conversation_id` (new FK) coexists with `chat_id` (legacy FK to `article_chats`). Both nullable. Migration copies `article_chats` → `conversations` + creates references.

---

**Language**: All documentation should be written in **English**.
