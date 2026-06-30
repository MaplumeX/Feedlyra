# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

SQLAlchemy 2.0 async with asyncpg driver for PostgreSQL. Alembic for migrations. No repository/DAO layer — routers and services query the database directly.

---

## Engine & Session Setup

Configured in `app/database.py`:

```python
_DATABASE_POOL_SIZE = 10
_DATABASE_MAX_OVERFLOW = 5
_DATABASE_POOL_RECYCLE = 1800

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=_DATABASE_POOL_SIZE,
    max_overflow=_DATABASE_MAX_OVERFLOW,
    pool_recycle=_DATABASE_POOL_RECYCLE,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

- `expire_on_commit=False` — allows post-commit attribute access without re-querying
- Dependency injection via `get_db()` in `app/dependencies.py` yields an `AsyncSession`

### Don't: omit `pool_pre_ping` / `pool_recycle` on the async engine

Without `pool_pre_ping`, SQLAlchemy hands out connections the DB side has already
closed (PG restart, machine sleep/wake, `idle_in_transaction_session_timeout`,
cloud PG idle reaping). The first operation on such a connection is
`_start_transaction`, which raises `asyncpg.InterfaceError: connection is closed`
in `get_current_user` / every route. Restarting the backend temporarily "fixes"
it by rebuilding the pool, which is the tell-tale symptom.

Required pool parameters:

- `pool_pre_ping=True` — CHECK before reuse; bad connections are discarded and
  replaced. This is the primary fix.
- `pool_recycle` — recycle connections before the DB side reaps idle ones. Must be
  less than the shortest server-side idle timeout (PG `idle_in_transaction_session_timeout`,
  cloud PG idle reaper). Dev default `1800` (30 min) is conservative; tune down
  for managed PGs that reap faster.
- `pool_size` / `max_overflow` — `pool_size` must be `>= settings.WORKER_POOL_SIZE`
  (default 8) so the feed worker cannot exhaust the pool; `max_overflow` leaves
  headroom for concurrent request handlers sharing the same engine.

---

## Base & Mixins

Defined in `app/models/base.py`:

- `Base(DeclarativeBase)` — standard SQLAlchemy 2.0 declarative base
- `UUIDMixin` — provides `id: Mapped[PyUUID]` primary key with `default=uuid4`, stored as PostgreSQL `UUID`
- `TimestampMixin` — provides `created_at` and `updated_at` with `server_default=func.now()` and `onupdate=func.now()`

**Known inconsistency**: Some models (Feed, Article, ReadStatus, etc.) manually re-declare UUID PKs instead of using `UUIDMixin`. This is a legacy pattern, not a convention. New models should use the mixins.

---

## Model Conventions

- Type annotations: `Mapped[str | None]` (Python 3.10+ union syntax, not `Optional`)
- Table names: plural nouns for primary entities (`users`, `feeds`, `articles`), compound/snake_case for junction tables
- Relationships: bidirectional with `back_populates`, cascade delete via `ondelete="CASCADE"` at FK column level
- All models re-exported from `app/models/__init__.py`

Example (`app/models/article.py`):

```python
class Article(Base):
    __tablename__ = "articles"

    id: Mapped[PyUUID] = mapped_column(primary_key=True, default=uuid4)
    feed_id: Mapped[PyUUID] = mapped_column(ForeignKey("feeds.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(500))
    content: Mapped[str | None] = mapped_column(Text)

    feed: Mapped["Feed"] = relationship("Feed", back_populates="articles")
```

---

## Query Patterns

All queries use `select()` with `await db.execute(...)`:

```python
# Single object lookup
result = await db.execute(select(Model).where(Model.field == value))
obj = result.scalar_one_or_none()

# List with pagination
result = await db.execute(
    select(Model).offset((page - 1) * limit).limit(limit)
)
items = result.scalars().all()
```

No ORM query builder abstractions. No raw SQL strings.

---

## Scenario: Stable Article List Cursor Pagination

### 1. Scope / Trigger

- Trigger: article list filters (`read_status`, `starred`, `feed_id`) can change membership while the frontend keeps an infinite list open.
- Offset pagination is unsafe for mutable filters because removing an earlier row shifts later offsets and causes a boundary article to be skipped.

### 2. Signatures

- API: `GET /api/articles?feed_id=<uuid>&read_status=unread|read&starred=true&limit=50&cursor=<opaque>`.
- Initial request omits `cursor`; legacy `page` remains supported for non-cursor clients.
- Response: `ArticleListResponse { items, total, page, limit, next_cursor: str | null, snapshot_at: datetime }`.
- Sort order: `published_at DESC NULLS LAST, created_at DESC, id DESC`.

### 3. Contracts

- `next_cursor` is opaque to clients. Clients pass it back unchanged and must not parse or construct it.
- Cursor payload records the last row's `published_at`, `created_at`, `id`, the next response page number, and the first page's `snapshot_at`.
- The first page snapshot is the latest committed `created_at` across all articles owned by the user, or the Unix epoch when none exist. It is intentionally independent of list filters so later unread/starred membership changes cannot become "new".
- Every page applies `Article.created_at <= snapshot_at`; articles committed after the first page remain outside that pagination chain and are detected by the separate count API.
- `id DESC` is the unique final tie-breaker; removing it can duplicate or skip rows with identical timestamps.
- Cursor filtering uses the same null ordering as the SQL `ORDER BY`.
- `total` always counts the complete filtered result set, not the number remaining after the cursor.
- The server fetches `limit + 1` rows; `next_cursor` is non-null only when another row exists.
- Read/star mutations do not invalidate a cursor because cursor fields are independent of filter membership.

### 4. Validation & Error Matrix

- Missing cursor -> first/legacy page behavior.
- Valid server-generated cursor -> next stable page.
- Invalid base64/JSON/UUID/page -> `400 Invalid article cursor`.
- Naive cursor or snapshot datetime without timezone -> `400 Invalid article cursor`.
- Cursor reaches the end -> `200` with `next_cursor=null`.

### 5. Good/Base/Bad Cases

- Good: page 1 contains 50 unread rows; one becomes read; the cursor still loads the next article after the original page boundary without skipping.
- Good: a feed transaction commits after the snapshot query; its later `created_at` is excluded from the current pages and counted as new.
- Base: an old client sends `page=2` without a cursor and retains legacy offset behavior.
- Bad: frontend computes page 2 from `page * limit < total` after a read/star mutation; one article shifts before the offset and is never rendered.

### 6. Tests Required

- Unit: cursor round-trip preserves nullable `published_at`, `created_at`, `id`, page, and `snapshot_at`.
- Unit: malformed and timezone-naive cursors return `400`.
- Unit: the snapshot query uses the latest user-owned article without applying read/star filters.
- Frontend regression: automatic count polling does not replace infinite-query pages.
- Frontend regression: read/star transitions keep rendered rows while adjusting filtered totals.

### 7. Wrong vs Correct

#### Wrong

```typescript
getNextPageParam: (lastPage) =>
  lastPage.page * lastPage.limit < lastPage.total
    ? lastPage.page + 1
    : undefined
```

#### Correct

```typescript
getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined
```

---

## Migrations

Alembic with async support (`alembic/env.py` uses `async_engine_from_config` + `run_sync`).

- Migration files use sequential numeric IDs (`"001"`, `"002"`) not hashes
- Migrations are hand-written (not auto-generated)
- Run: `alembic upgrade head`

---

## Scenario: Article Full-Content Storage

### 1. Scope / Trigger
- Trigger: article extraction needs to preserve both feed-provided content and fetched readable full content across the database, API, and frontend.

### 2. Signatures
- DB: `articles.content: Text | null` stores original feed content or the feed fetcher's initial fallback content.
- DB: `articles.full_content: Text | null` stores manually fetched readable full content.
- API: `POST /api/articles/{article_id}/extract -> ArticleResponse`.
- Schema: `ArticleResponse.full_content: str | None`.

### 3. Contracts
- `content` remains the original/default article body shown when an article opens.
- `full_content` is nullable until extraction succeeds.
- Extracting an article writes only `full_content`; it must not overwrite `content`.
- If `full_content` already exists, the extract endpoint returns the article response without refetching the remote URL.
- AI article operations that do not expose content-source choice may use the richest available content via `Article.readable_content`: `full_content`, then `content`, then `content_snippet`, then empty string.
- AI summaries are source-aware and must not use `Article.readable_content`; see "Scenario: Source-Aware Article Summary Cache".

### 4. Validation & Error Matrix
- Article not owned by the current user -> `404 Article not found`.
- Readability/http extraction returns no content -> `422 Failed to extract article content`.
- Existing `full_content` -> `200 ArticleResponse` with cached content, no network extraction.

### 5. Good/Base/Bad Cases
- Good: feed content exists, extraction succeeds, response contains both `content` and `full_content`.
- Base: no feed content exists, extraction succeeds, `content_snippet` may be populated from extracted text while `content` remains unchanged.
- Bad: extraction overwrites `content`, making the frontend unable to toggle back to the original/default view.

### 6. Tests Required
- API integration: extracting an article sets `full_content` and preserves `content`.
- API integration: extracting the same article twice returns cached `full_content` without replacing `content`.
- Frontend/API contract: article response types include nullable `full_content`.

### 7. Wrong vs Correct
#### Wrong
```python
article.content = extracted
```

#### Correct
```python
article.full_content = extracted
```

---

## Common Mistakes

- **Not using mixins**: New models that manually declare `id`/`created_at`/`updated_at` instead of `UUIDMixin`/`TimestampMixin` create inconsistency. Use the mixins.
- **Missing `ondelete="CASCADE"`**: Without database-level cascade, orphaned records remain after parent deletion.
- **Using `expire_on_commit=True`**: The default causes lazy-load errors after commit in async context. Always use `expire_on_commit=False`.
- **Nullable override columns without fallback logic**: Adding nullable per-feature columns to a user/config table without a corresponding `feature_val or global_val` resolution helper leads to inconsistent fallback behavior across call sites. Always pair override columns with a resolution function.

---

## Scenario: Per-Feature AI Config Overrides

### 1. Scope / Trigger
- Trigger: users need different models/providers for different AI features (translation, summary, chat), with fallback to a shared global config.

### 2. Signatures
- DB: `users.translate_base_url: String(500) | null`, `users.translate_api_key: Text | null`, `users.translate_model: String(100) | null` (same pattern for `summary_*` and `chat_*`).
- DB: existing `users.ai_base_url`, `users.ai_api_key`, `users.ai_model` serve as global fallback.
- Service: `get_user_llm_client(user, feature: "translate" | "summary" | "chat" | None) -> AsyncOpenAI`.
- Service: `get_user_model(user, feature: "translate" | "summary" | "chat" | None) -> str`.
- API: `FeatureAIConfigResponse { enabled, base_url, model, has_api_key }`.
- API: `AIConfigResponse { base_url, model, has_api_key, translate, summary, chat }`.

### 3. Contracts
- Priority chain: feature-specific value → global user value → server default (`settings.AI_DEFAULT_*`).
- `enabled` is true when ANY of the three feature-specific columns is non-null.
- Setting `enabled: false` in the update payload clears all three feature-specific columns (sets them to NULL).
- Feature API key encryption uses the same Fernet mechanism as the global key.
- API endpoints pass the feature name explicitly: `get_user_llm_client(user, "summary")`, not `get_user_llm_client(user)`.
- Articles router uses `get_user_model(user, "summary")` for filtering cached summaries — it must match the model that generated them.

### 4. Validation & Error Matrix
- Missing global API key AND missing feature API key → `ValueError("No API key configured...")` → `400`.
- Feature override columns are all nullable — no validation on individual NULL values.
- When `enabled: false` is sent, columns are cleared regardless of current state.

### 5. Good/Base/Bad Cases
- Good: user sets `summary_model = "gpt-4o"` and `translate_model = "deepseek-chat"`, each feature uses its own model.
- Base: user only sets global config, all features fall back to the same model.
- Bad: feature endpoint calls `get_user_model(user)` without the feature parameter, silently using the global model when a per-feature override exists.

### 6. Tests Required
- Unit: `_get_feature_attrs` returns feature value when set, global value when feature is NULL, None when both are NULL.
- API integration: `GET /api/ai/config` returns `translate.enabled: true` after setting translate overrides.
- API integration: `PUT /api/ai/config` with `translate: {enabled: false}` clears all three translate columns.
- API integration: summarize endpoint uses the summary model, not the global model.

### 7. Wrong vs Correct
#### Wrong
```python
# Forgetting the feature parameter — silently uses global model
model = get_user_model(user)
client = get_user_llm_client(user)
```

#### Correct
```python
model = get_user_model(user, "summary")
client = get_user_llm_client(user, "summary")
```

---

## Scenario: Source-Aware Article Summary Cache

### 1. Scope / Trigger
- Trigger: article summaries must track which content source they summarize because users can switch between feed content and extracted full content.

### 2. Signatures
- DB: `article_summaries.id: UUID` primary key.
- DB: `article_summaries.article_id: UUID` references `articles.id` with `ondelete="CASCADE"`.
- DB: `article_summaries.source: String(20)` stores `"feed"` or `"full"`.
- DB: `article_summaries.content_hash: String(64)` stores the hash of the exact source content summarized.
- DB: `article_summaries.summary: Text` stores generated markdown/plain text.
- DB: `article_summaries.model: String(100)` stores the AI model.
- DB: `article_summaries.lang: String(10)` NOT NULL stores the UI language code (`"en"` / `"zh-CN"`) the summary was generated for. Legacy rows backfilled to `"en"` via `server_default`.
- DB: unique constraint on `(article_id, source, model, lang)` — name `uq_article_summaries_article_source_model_lang`. Language is part of the cache key, NOT an override.
- API: `POST /api/ai/articles/{article_id}/summarize?source=feed|full&lang=<ui_lang> -> SummarizeResponse`.
- API: `ArticleResponse.summaries: dict[str, ArticleSummaryResponse]`.

### 3. Contracts
- `source=feed` summarizes `article.content`, falling back to `article.content_snippet`.
- `source=full` summarizes `article.full_content` only.
- Cache reuse requires matching `article_id`, `source`, `model`, `content_hash`, AND `lang`.
- Summary OUTPUT language follows the requesting UI language, NOT the article body language; `generate_summary` is instructed via `_summary_lang_name(lang)` (e.g. `zh-CN`→`Chinese (Simplified)`).
- Article list/detail responses should include summaries only for the current user's configured model AND the requested `lang`. Any endpoint returning `ArticleResponse` with summaries MUST filter `ArticleSummary.lang == lang`; see "Scenario: Summary Language Isolation by UI Language".
- `ArticleResponse.summary` and `ArticleResponse.summary_model` remain compatibility aliases for the current-model feed summary only.
- Legacy `article_ai_data.summary` rows are migrated into `article_summaries` with `source='feed'`; old summary columns are not used for new summary writes.

### 4. Validation & Error Matrix
- Article not owned by the current user -> `404 Article not found`.
- `source` is not `feed` or `full` -> `400 Invalid summary source`.
- `source=full` and `article.full_content` is empty -> `422 Full content is not available`.
- `source=feed` and neither `content` nor `content_snippet` exists -> `422 Article content is not available`.
- Missing AI configuration -> `400` with the LLM config error message.

### 5. Good/Base/Bad Cases
- Good: feed summary and full summary for the same article/model coexist and do not overwrite each other.
- Base: user has only a feed summary; switching to full content shows no full summary until generated.
- Bad: summary generation uses `Article.readable_content`, causing a full-content summary to be returned while the UI is showing feed content.

### 6. Tests Required
- API integration: existing feed summary cache is reused only when source, model, and content hash match.
- API integration: generating a full summary writes `source='full'` and does not modify the feed summary.
- Migration regression: legacy `article_ai_data.summary` becomes a feed summary row.
- Frontend/API contract: article response includes `summaries.feed` and/or `summaries.full`.

### 7. Wrong vs Correct
#### Wrong
```python
summary = await generate_summary(client, model, article.title, article.readable_content)
```

#### Correct
```python
content = get_summary_content(article, summary_source)
summary = await generate_summary(client, model, article.title, content, target_lang=lang)
```

---

## Scenario: Summary Language Isolation by UI Language

### 1. Scope / Trigger
- Trigger: `ArticleSummary` caches summaries per language. Any endpoint that returns `ArticleResponse` (which embeds `summaries: dict[source, ArticleSummaryResponse]`) MUST filter cached summaries by the requested UI `lang`; otherwise multi-language rows for the same source overwrite each other in the dict and the wrong-language summary leaks to the UI.

### 2. Signatures
- DB: `article_summaries.lang: String(10) NOT NULL` (legacy rows backfilled `"en"` via migration `server_default`).
- DB: unique constraint `(article_id, source, model, lang)`.
- Service: `generate_summary(client, model, title, content, target_lang="en")` — `target_lang` is an i18n code; mapped to an English language name via `_summary_lang_name()` before formatting the system prompt.
- Service: `SUMMARY_LANG_NAMES = {"zh-CN": "Chinese (Simplified)", "en": "English"}`; unknown codes fall back to `"English"`.
- API: `POST /api/ai/articles/{article_id}/summarize?source=...&lang=<code>` — validates `lang in SUMMARY_LANG_NAMES`, else `400`.
- API: `GET /api/articles?...&lang=<code>` and `GET /api/articles/{id}?lang=<code>` — accept `lang` (default `"en"`), do NOT validate (fall back to en, must never crash the list page).
- Frontend: `useSummarize` / `useArticle` / `useArticles` / `useInfiniteArticles` thread `i18n.language` (normalized to `zh-CN`/`en`) into the query string AND into the React Query `queryKey` (so switching UI language re-fetches instead of returning the cached other-language detail).

### 3. Contracts
- The summary output language is the requesting UI language, full stop. The article body's language is NOT considered.
- Language caching is isolation, not override: switching UI language does NOT reuse or overwrite the other language's row — each `(article, source, model, lang)` row is independent. Switching back to the original language hits the original cache (no repeat token spend).
- `summaries[source]` is a dict keyed by `source`; the backend MUST pre-filter by `lang` so at most one row per source survives into the dict. Filtering after dict assembly is too late (already overwritten).
- **Every** endpoint returning `ArticleResponse` with `summaries` must apply the lang filter — not only `get_article` / `list_articles`. Mutations that return the full article (`toggle_read`, `toggle_star`, `extract_article_content`) MUST also filter by `lang`, because `applyArticleTransitionsToCache` replaces the entire cached article with the mutation response; an unfiltered response would swap a Chinese-UI user's summary for an English one until the next refetch.
- Migration backfill: old rows get `lang='en'` via `server_default="en"`. A Chinese-UI user's first request therefore misses the cache (en row) and generates a fresh `zh-CN` row — a one-time token cost, intended.

### 4. Validation & Error Matrix
- `summarize?lang=<unknown>` -> `400` (reject silent fallback; never generate a summary in a guessed language).
- `articles?lang=<unknown>` / `articles/{id}?lang=<unknown>` -> no validation; behaves as `en` (list/detail must never 500 due to a bad lang).
- `articles?lang` omitted entirely -> defaults to `en` (backward-compat for old clients).
- Old cached rows after migration -> visible only to `en` UI; other-UI requests generate new rows.

### 5. Good/Base/Bad Cases
- Good: en-UI user generates an en summary; switches to zh-CN UI, generates a zh-CN summary; the en row is untouched; switches back to en UI, the en summary is served from cache with no LLM call.
- Base: legacy rows exist only as `lang='en'`; a zh-CN-UI user's first open triggers a one-time zh-CN generation.
- Bad: `toggle_read` returns the article without a `lang` filter; `applyArticleTransitionsToCache` writes the (unfiltered, default-en) summaries into a zh-CN-UI user's detail cache, briefly showing the English summary until the (stale) query refetches.
- Bad: queryKey omits `lang`; switching UI language keeps the old-language article detail in cache and never re-fetches.

### 6. Tests Required
- Unit (`test_article_summary.py`): `generate_summary(target_lang=...)` selects the right system-prompt language name and the old article-body-language rule is gone.
- API integration: `summarize?lang=zh-CN` writes a `lang='zh-CN'` row and does NOT modify the `lang='en'` row for the same `(article, source, model)`.
- API integration: `GET /api/articles/{id}?lang=en` returns only `summaries` whose `lang=='en'`, even when a `zh-CN` row exists for the same source.
- API integration: `summarize?lang=xx` returns `400`.
- Frontend regression: switching UI language triggers a refetch of the article detail/list queries (queryKey includes lang), not a silent return of the cached other-language article.

### 7. Wrong vs Correct
#### Wrong — mutation returns article unfiltered by lang
```python
@router.put("/{article_id}/read")
async def toggle_read(article_id: UUID, body: ReadUpdate, db, user):
    article = await _build_article_response(db, article_id, user)  # no lang
    return article  # en summaries overwrite a zh-CN-UI user's cache via setQueryData
```

#### Correct — every ArticleResponse path receives lang
```python
@router.put("/{article_id}/read")
async def toggle_read(article_id: UUID, body: ReadUpdate, lang: str = Query(default="en"), db, user):
    article = await _build_article_response(db, article_id, user, lang=lang)
    return article
```

#### Wrong — queryKey without lang
```tsx
queryKeys.articles.detail = (id) => ["articles", "detail", id] as const;
```

#### Correct — lang in queryKey forces refetch on UI language switch
```tsx
queryKeys.articles.detail = (id, lang) => ["articles", "detail", id, lang] as const;
```

---

## Scenario: Chat History Summarization & Message Truncation

### 1. Scope / Trigger
- Trigger: long chat conversations need smarter context management than a hardcoded message cap; message editing requires server-side history truncation.

### 2. Signatures
- DB: `article_chats.history_summary: Text | null` — cached LLM-generated summary of older conversation turns.
- API: `PUT /api/ai/articles/{article_id}/chat/messages/truncate` — body: `{after: UUID}`, deletes the anchor message and all subsequent messages in the chat.
- Service: `summarize_chat_history(client, model, messages) -> str` — generates a 2-3 sentence summary of older history.
- Service: `build_chat_messages(..., history_summary: str | None = None)` — accepts optional summary to inject.

### 3. Contracts
- `history_summary` is lazy-computed: only when chat exceeds 8 turns (16 messages), and only if not already cached.
- Summarization covers messages beyond the last 6 turns (12 messages); the recent 6 turns are sent in full.
- On summarize failure, chat proceeds without summary (graceful degradation).
- Message truncation (`PUT .../truncate`) deletes the anchor message AND all messages after it (`created_at >= anchor.created_at`).
- Truncation invalidates `history_summary` (sets to NULL) since history changed.
- Only user-role messages can be used as anchors (server validates `anchor.role == "user"`).

### 4. Validation & Error Matrix
- Article not owned by user -> `404 Article not found`.
- Chat not found -> `404 Chat not found`.
- Anchor message not found in this chat -> `404 Message not found`.
- Anchor message is not a user message -> `400 Can only truncate from a user message`.
- Summarization LLM call fails -> proceed without summary, log warning.

### 5. Good/Base/Bad Cases
- Good: 20-turn conversation triggers summarization, older turns compressed, recent 6 turns preserved verbatim.
- Base: < 8 turns, no summarization needed, full history sent.
- Bad: summarization fails, but chat still works with recent 6 turns only (older context lost but not broken).

### 6. Tests Required
- Unit: `build_chat_messages` includes `history_summary` as system message when provided.
- Unit: `build_chat_messages` uses `extract_content_for_summary` instead of raw truncation.
- API integration: `PUT .../truncate` deletes anchor + subsequent messages, preserves earlier ones.
- API integration: `PUT .../truncate` sets `history_summary = NULL`.
- API integration: first chat request past 8 turns computes and caches `history_summary`.

### 7. Wrong vs Correct
#### Wrong
```python
# Truncating only messages AFTER the anchor — leaves stale user message content
await db.execute(
    sql_delete(ChatMessage).where(
        ChatMessage.chat_id == chat.id,
        ChatMessage.created_at > anchor.created_at,
    )
)
```

#### Correct
```python
# Delete anchor + subsequent — next chat request creates fresh user message
await db.execute(
    sql_delete(ChatMessage).where(
        ChatMessage.chat_id == chat.id,
        ChatMessage.created_at >= anchor.created_at,
    )
)
```

---

## Scenario: Conversation Model & Cross-Article References

### 1. Scope / Trigger
- Trigger: AI chat needs independent conversations not bound to a single article, with the ability to reference multiple articles as context.

### 2. Signatures
- DB: `conversations.id: UUID` primary key (UUIDMixin).
- DB: `conversations.user_id: UUID` FK to `users.id` with `ondelete="CASCADE"`, NOT NULL.
- DB: `conversations.title: String(200) | null` — auto-generated from first message, user-editable.
- DB: `conversations.history_summary: Text | null` — migrated from `article_chats.history_summary`.
- DB: `conversations.created_at / updated_at` — TimestampMixin.
- DB: `conversation_references.id: UUID` primary key (UUIDMixin).
- DB: `conversation_references.conversation_id: UUID` FK to `conversations.id` with `ondelete="CASCADE"`, NOT NULL.
- DB: `conversation_references.article_id: UUID` FK to `articles.id` with `ondelete="CASCADE"`, NOT NULL.
- DB: `conversation_references.is_auto: Boolean` NOT NULL default=False — True when auto-injected from current article.
- DB: `conversation_references.created_at` — TimestampMixin.
- DB: Unique constraint on `conversation_references(conversation_id, article_id)` — prevents duplicate references.
- DB: `chat_messages.conversation_id: UUID | null` FK to `conversations.id` with `ondelete="CASCADE"` — new column alongside `chat_id` for migration transition.
- DB: `chat_messages.attachments: JSON | null` — image metadata array: `[{"type": "image", "url": "...", "filename": "...", "mime_type": "...", "size": 12345}]`.
- API: `GET /api/ai/conversations` — list conversations with pagination, last message preview.
- API: `POST /api/ai/conversations` — create conversation; if `article_id` provided, auto-create reference with `is_auto=True`.
- API: `GET/PUT/DELETE /api/ai/conversations/{id}` — conversation CRUD.
- API: `GET/POST /api/ai/conversations/{id}/references` — list/add references.
- API: `DELETE /api/ai/conversations/{id}/references/{ref_id}` — remove reference.
- API: `POST /api/ai/conversations/{id}/images` — multipart image upload.
- API: `GET /api/ai/images/{filename}` — serve uploaded image with auth check.

### 3. Contracts
- Conversations are independent entities — not bound to articles. Article context is injected via `conversation_references`.
- Auto-reference (`is_auto=True`) and manual references are equivalent in LLM context — same format in system prompt.
- `is_auto=True` references are created when opening chat from an article page. User can remove them.
- When adding a reference that already exists with `is_auto=False`, the existing row's `is_auto` is set to `True` (merge behavior, not error).
- `chat_messages.conversation_id` is the new FK. `chat_id` (pointing to `article_chats`) is nullable for backward compatibility during migration.
- Image files are stored on local filesystem under `UPLOAD_DIR` (default: `./uploads/chat_images/`).
- Image deletion: when a conversation is deleted, associated image files are cleaned up from the filesystem.
- `chat_messages.attachments` JSON contains full image metadata. Uploaded images store `filename` for filesystem lookup; inline base64 images store the data URL directly.

### 4. Validation & Error Matrix
- Conversation not owned by user -> `404 Conversation not found`.
- Reference article not owned by user -> `404 Article not found`.
- Duplicate reference (same conversation + article) -> silently merge `is_auto` flag, return `200`.
- Image upload: unsupported type -> `400 Unsupported image type`.
- Image upload: exceeds 10MB -> `400 Image too large`.
- Image serve: filename not found -> `404 Image not found`.
- Image serve: path traversal attempt -> `404 Image not found`.
- Missing AI configuration -> `400` with LLM config error message.

### 5. Good/Base/Bad Cases
- Good: conversation references 3 articles, all content injected into LLM context with clear section headers.
- Base: conversation has no references (standalone free-form chat).
- Bad: reference content exceeds budget but no budget-aware truncation applied — LLM context truncated by provider.

### 6. Tests Required
- API integration: creating a conversation with `article_id` auto-creates a reference with `is_auto=True`.
- API integration: adding a duplicate reference merges `is_auto` flag instead of erroring.
- API integration: deleting a conversation removes associated image files from filesystem.
- Migration: existing `article_chats` rows become conversations with proper references.
- Migration: downgrade deletes conversation-owned messages before restoring `chat_id` NOT NULL constraint.

### 7. Wrong vs Correct
#### Wrong
```python
# Forgetting budget-aware truncation for multi-article content
for ref in references:
    content = extract_content_for_summary(article.title, article.readable_content)
    all_content += content  # Could exceed LLM context window
```

#### Correct
```python
# Budget-aware truncation with separator overhead
budget = MAX_CONTENT_CHARS
sep_len = len("\n\n---\n\n")
available = budget - sep_len * max(0, len(articles) - 1)
per_article = available // len(articles)
for article in articles:
    chunk = extract_content_for_summary(article.title, article.readable_content, per_article)
    parts.append(chunk)
```

---

## Scenario: Automation Rules Engine

### 1. Scope / Trigger

- Trigger: when `feed_fetcher.fetch_and_store_feed` ingests new articles, the automation engine filters and mutates them before the feed transaction commits.
- Rules let users auto-`mark_read`, `star`, `delete`, `auto_translate`, or `auto_extract` matching articles without writing per-feed code.

### 2. Signatures

- DB: `automation_rules.id: UUID` PK (manual `uuid4`, not `UUIDMixin`).
- DB: `automation_rules.user_id: UUID` FK `users.id` `ondelete="CASCADE"` NOT NULL.
- DB: `automation_rules.scope: String(20)` — `"global" | "category" | "feed"`.
- DB: `automation_rules.scope_id: UUID | null` — the category/feed id; NULL for global.
- DB: `automation_rules.conditions: JSON NOT NULL` — `list[ConditionSchema]`.
- DB: `automation_rules.actions: JSON NOT NULL` — `list[ActionSchema]`.
- DB: `automation_rules.priority: Integer NOT NULL` default `0`.
- DB: `automation_rules.enabled: Boolean NOT NULL` default `true`.
- Schema: `ConditionSchema { field: "title"|"author"|"url"|"content", operator: "contains"|"not_contains"|"matches_regex", value: str, logic: "and"|"or" }`.
- Schema: `ActionSchema { type: "mark_read"|"star"|"delete"|"auto_translate"|"auto_extract", params: dict | None }`.
- Service: `apply_delete_rules(feed, articles, db) -> list[Article]` — runs before `db.add_all`.
- Service: `apply_non_delete_rules(feed, articles, db) -> None` — runs after articles are added; flushes within the caller's transaction.
- Service: `_matches_conditions(article, conditions) -> bool` — pure function, unit-tested in `tests/test_automation.py`.
- API: `GET/POST /api/automation-rules`, `GET/PUT/DELETE /api/automation-rules/{id}`.

### 3. Contracts

- **Two-phase application inside one feed fetch** (see `feed_fetcher.py:fetch_and_store_feed`):
  1. `apply_delete_rules` filters `new_articles` in-memory **before** `db.add_all(new_articles)`. Deleted articles never reach the DB.
  2. `db.add_all(new_articles)` stores the survivors.
  3. `apply_non_delete_rules` applies `mark_read`/`star`/`auto_translate`/`auto_extract` to the now-persisted articles, then `await db.flush()` so changes ride the caller's `commit`.
- **Scope resolution** (`_load_rules_for_feed`): enabled rules where `scope == "global"`, OR (`scope == "category"` AND `scope_id == feed.category_id`), OR (`scope == "feed"` AND `scope_id == feed.id`). Category scope is skipped when the feed has no category.
- **Rule order**: `priority DESC, created_at ASC`. Higher priority runs first; deletes winnow before lower-priority non-delete rules see the article.
- **A rule that has any `delete` action is treated as a delete rule** — ALL its actions are evaluated in the delete phase, and the rule is excluded from the non-delete phase. A rule with both `delete` and `mark_read` surprises users; the frontend (`RuleEditorDialog`) warns about this combination. Do not split one rule's actions across phases.
- **Condition evaluation** (`_matches_conditions`):
  - `getattr(article, cond["field"], "") or ""` — missing/None field coerces to empty string, never crashes.
  - `contains`/`not_contains` are case-insensitive substring tests on the lowercased field.
  - `matches_regex` uses `re.search(..., re.IGNORECASE)`; an invalid pattern (`re.error`) is swallowed → no match (does not raise).
  - The first condition's `logic` is ignored (treated as `and`); subsequent conditions combine with the previous result via their own `logic`.
  - Empty `conditions` list matches everything.
- **`auto_translate` action** reuses `get_user_llm_client(user, "translate")` + `get_user_model(user, "translate")` and writes `ArticleAIData.translated_*` (creates the row if absent, updates if the lang/model changed). Missing AI config is caught and skipped with a warning.
- **`auto_extract` action** calls `_fetch_and_extract_content(article.url)` and stores `article.full_content`; skipped if already present. Never overwrites `content`.
- **Per-rule / per-action error isolation**: a failing rule or action is caught and logged (`logger.warning(...)`) and skipped — one bad rule must not abort the feed fetch. The top-level `try/except` in `feed_fetcher` around each `apply_*` call additionally falls back to "store all articles" if the engine itself throws.

### 4. Validation & Error Matrix

- Create/update with `scope == "global"` and a non-null `scope_id` → `400 Global rules must not have scope_id`.
- Create/update with `scope in ("category","feed")` and null `scope_id` → `400 Category/Feed rules require scope_id`.
- Category scope references a category not owned by the user → `404 Category not found`.
- Feed scope references a feed not owned by the user → `404 Feed not found`.
- `scope_id` query filter on `list` endpoint uses `Query(pattern="^(global|category|feed)$")`.
- Rule not owned by the user on get/update/delete → `404 Automation rule not found`.
- Invalid regex in a condition → no raise; condition does not match.

### 5. Good/Base/Bad Cases

- Good: a `global` rule with `title contains "sponsored"` + `delete` removes sponsored entries across all feeds before they are stored; a `feed`-scoped `mark_read` rule still sees the survivors.
- Base: a feed has no matching rules; `new_articles` pass through both phases unchanged.
- Bad: a rule combines `delete` and `star` — the `star` action is silently ignored because the whole rule runs only in the delete phase. Either split into two rules or drop one action.
- Bad: lowering an article into DB before `apply_delete_rules` — the article is briefly committed and shows up in counts/lists before being filtered.

### 6. Tests Required

- Unit (`tests/test_automation.py`): `_matches_conditions` covers empty conditions, single contains/no-match, not_contains, valid + invalid regex, AND/OR logic, first-condition-logic-ignored, case-insensitive, None-field handling for both `contains` and `not_contains`.
- Integration: `apply_delete_rules` removes matching articles and returns survivors before `db.add_all`.
- Integration: `apply_non_delete_rules` creates `ReadStatus`/`StarredArticle` rows only for rules whose conditions match, deduping against existing rows via a pre-fetched id set.
- Integration: a rule with a `delete` action is excluded from the non-delete phase.
- Integration: a failing rule/action does not abort the feed fetch.

### 7. Wrong vs Correct

#### Wrong

```python
# Deleting inside the non-delete phase — deleted articles hit the DB first
db.add_all(new_articles)
await apply_delete_rules(feed, new_articles, db)  # articles already persisted!
```

#### Correct

```python
# Delete phase filters in-memory BEFORE storage; non-delete phase runs AFTER
new_articles = await apply_delete_rules(feed, new_articles, db)
db.add_all(new_articles)
await apply_non_delete_rules(feed, new_articles, db)
```

```python
# Wrong: treating a rule as delete-only based on the presence of a delete action
# but still running its mark_read in the non-delete phase
delete_rules = [r for r in rules if _rule_has_delete_action(r)]
non_delete_rules = rules  # ❌ includes delete-rule actions again

# Correct: a rule with a delete action is fully excluded from the non-delete phase
non_delete_rules = [r for r in rules if not _rule_has_delete_action(r)]
```

## Scenario: Cross-Article Auto-Retrieval Service

### 1. Scope / Trigger
- Trigger: the `search_articles` agent tool calls `retrieve_relevant_articles()` when the LLM decides to search the user's subscriptions (see the Agent Loop scenario in `routers/ai.py` flow). The retrieval function is the shared building block for future candidates ②③④ (daily digest, dedup/clustering, semantic filter). Its **signature** is the stable contract; the **keyword implementation** may be swapped for a vector implementation later.
- Legacy "silently inject auto-refs when a conversation has no references" path was **removed** when chat became an agent loop (task 06-26-ai-chat-agent-loop). Retrieval now only runs when the model explicitly calls `search_articles`; `read_article` writes `is_auto=True` refs for articles the agent actually read.

### 2. Signatures
- Tools (`agent_tools.TOOLS`) are always exposed (`tools = TOOLS`); the old `users.ai_cross_article_search` toggle (migration 015) was removed in migration 017 — AI retrieval is a default capability, not a user switch.
- Service: `app/services/retrieval.py::retrieve_relevant_articles(db, *, user_id, query, since=None, days=7, limit=5) -> list[Article]`.
- Service (pure helpers, unit-tested without a DB): `_tokenize(query) -> list[str]`, `_score_and_rank(candidates: list[tuple[Article, str]], tokens, limit) -> list[Article]`.
- Tool layer: `app/services/agent_tools.py::execute_tool(name, args, *, user_id, conversation_id, db)` wraps retrieval for the agent loop.

### 3. Contracts
- **Stable contract**: the function returns `list[Article]` sorted by relevance then recency; the caller (agent tool) is responsible for converting to the tool result JSON. `since: datetime` is an explicit parameter so future ②digest (past 24h) can reuse the entry without changing the signature.
- **Tokenization (jieba)**: `_tokenize` uses `jieba.cut(query, cut_all=False)` (precise mode). A full natural-language sentence like `"简单看看今天有什么文章"` MUST be split into real content words (`简单/看看/今天/什么/文章`), not kept as one CJK block — keeping it whole made `ILIKE '%整句%'` match nothing and was the 2026-06-25 zero-hit incident. Filters: tokens shorter than 2 chars dropped; whole-token STOPWORDS (EN + a narrow CN function-word set) dropped; tokens with no alphanumeric OR Han char dropped (kills jieba's punctuation runs like `"..."`).
- **Candidate set**: `Article JOIN Feed LEFT JOIN ArticleSummary ON source='feed'`, `WHERE Feed.user_id == user_id AND COALESCE(published_at, created_at) >= since`. User isolation reuses `Feed.user_id` (same convention as `routers/articles.py::_apply_article_filters`), not an article-level user column.
- **Scoring**: Python-side `sum(1 for t in lower_tokens if t in f"{title} {summary_text}".lower())`; sort `hits DESC, then (published_at or created_at) DESC`; return top-`limit`. Zero-hit articles dropped; empty `tokens` → return `[]` immediately (caller returns an empty result set, not an error).
- **Failure mode**: tool execution failures are caught in `agent_loop._run_one_tool` and returned to the model as a tool message with an `error` field, so the agent can react (e.g. retry with a different keyword). The chat stream must never break because a tool failed.

### 4. Validation & Error Matrix
- Query has no extractable tokens (all stopwords / punctuation / single chars) → return `[]`, `search_articles` returns `{count:0, results:[]}`. Model decides next step (retry keyword or answer). `200`.
- No article matches within the time window → return `[]`, same as above. `200`.
- `since` is timezone-naive → normalized to UTC inside the function (do not raise).
- Retrieval raises (e.g. DB error) → caught in `_run_one_tool`, returned to model as tool message `{"error": ...}`; agent may retry with a new keyword or answer from prior context. `200` with normal SSE stream.
- Conversation already has references (legacy `/articles/{id}/chat` pre-seeds one) → no special path; the agent may still call `search_articles` if the model judges the pre-seeded article insufficient.

### 5. Good/Base/Bad Cases
- Good: new conversation, question "订阅源里关于 AI 的文章有哪些" → model calls `search_articles(query="AI")` → tokens `[AI]` → 5 articles in the last 7 days match → model lists real titles, may `read_article(id)` to summarize one in depth.
- Base: new conversation, question is pure small talk ("你好") → model answers directly, never calls `search_articles`. One agent round, no tool events.
- Bad (pre-agent, 2026-06-25): `_tokenize` kept `"简单看看今天有什么文章"` as ONE CJK block → `ILIKE '%整句%'%'` matched nothing → 0 refs → model answered "我无法访问互联网". Fixed by jieba segmentation.
- Bad: `read_article` called twice for the same article in one chat → second insert hits `conversation_references(conversation_id, article_id)` unique constraint. Must use a savepoint so the rollback only undoes the duplicate insert, not the whole transaction (which holds the just-flushed assistant tool_call message). See "Scenario: StreamingResponse & DB Session Lifetime".

### 6. Tests Required
- Unit (`tests/test_retrieval.py`, pure-logic only — matches `test_automation.py` test style, no DB fixtures): `_tokenize` covers empty/English/jieba-segmented-sentence/stopwords/punctuation-only-returns-empty/natural-language-sentence-vs-title-word-hit; `_score_and_rank` covers empty tokens/zero-hit drop/hits-desc/recency-tiebreak/limit truncation/summary-text hit/`created_at` fallback/tz-naive normalization/mixed CJK+EN.
- Regression: `test_natural_language_sentence_matches_title_word` asserts `"简单看看今天有什么文章"` now matches an article whose title contains a content word (e.g. `今天`) — guards the 2026-06-25 zero-hit regression.
- The DB-backed `retrieve_relevant_articles` function is **not** unit-tested (consistent with this project's "trusted unit tests cover pure logic that has no DB/HTTP coupling" convention). Its `COALESCE` + user-isolation + dedup behavior is verified by static review and end-to-end manual scenarios (PRD acceptance 1/2/3).

### 7. Wrong vs Correct

#### Wrong
```python
# Raw candidate rows hide a dedup landmine: article_summaries has a (article_id, source, model)
# unique constraint, so a user who changed summary models has MULTIPLE source='feed' rows
# per article. The outerjoin then emits one row per summary, duplicating the article.
result = await db.execute(stmt)
candidates = [(a, s or "") for a, s in result.all()]   # same article appears 2-3×

# Bulk-inserting auto-refs without guarding duplicates within the batch hits the
# conversation_references(conversation_id, article_id) unique constraint on flush.
for art in retrieved:                                  # retrieved contains the dup
    db.add(ConversationReference(conversation_id=conv.id, article_id=art.id, is_auto=True))
await db.flush()                                       # IntegrityError → swallowed by try/except → whole batch lost
```

#### Correct
```python
# Dedupe by Article.id in Python before scoring — also fixes the hidden side effect
# where duplicate scoring inflated one article's rank and shrank others' top-K chances.
result = await db.execute(stmt)
seen: set[UUID] = set()
candidates: list[tuple[Article, str]] = []
for article, summary_text in result.all():
    if article.id in seen:
        continue
    seen.add(article.id)
    candidates.append((article, summary_text or ""))

return _score_and_rank(candidates, tokens, limit)
```

#### Wrong
```python
# Keeping a full CJK sentence as one token makes ILIKE substring match nothing.
# The 2026-06-25 incident: "简单看看今天有什么文章" was tokenized as ONE block,
# so `%简单看看今天有什么文章%` matched no title.
_TOKEN_PATTERN = re.compile(r"[A-Za-z0-9]{2,}|[\u4e00-\u9fff]{2,}")
def _tokenize(query: str) -> list[str]:
    cleaned = query.translate(str.maketrans("", "", "的了是在和与"))
    raw = _TOKEN_PATTERN.findall(cleaned)            # ["简单看看今天有什么文章"] — one block
    return [t for t in raw if t.lower() not in STOPWORDS]
```

#### Correct
```python
import jieba

def _tokenize(query: str) -> list[str]:
    if not query:
        return []
    tokens: list[str] = []
    for raw in jieba.cut(query, cut_all=False):       # precise-mode segmentation
        t = raw.strip()
        if len(t) < 2:
            continue
        if t.lower() in STOPWORDS or t in _CN_STOPWORDS:
            continue
        # jieba sometimes emits punctuation runs (e.g. "...") as tokens;
        # require at least one alphanumeric or Han char so they are dropped.
        if not any(c.isalnum() or "\u4e00" <= c <= "\u9fff" for c in t):
            continue
        tokens.append(t)
    return tokens
# "简单看看今天有什么文章" → ["简单", "看看", "今天", "文章"]  ✓
```

## Scenario: AI Chat Agent Loop

### 1. Scope / Trigger
- Trigger: chat endpoints `POST /conversations/{id}/chat` and legacy `POST /articles/{id}/chat` now run an agent loop (task 06-26-ai-chat-agent-loop) instead of a single prompt-and-stream call. The model decides, via tool calling, when to search/read articles before answering.
- Cross-layer contract change: new SSE event types, new ChatMessage columns, new request-scoped-session hazard. Code-spec depth is mandatory.

### 2. Signatures
- Router: `_do_conversation_chat(conv, body, db, user)` no longer assembles the prompt or streams directly. It stores the user message (request-scoped `db`, committed before returning) and returns `StreamingResponse(run_agent_chat(...))`.
- Loop: `services/agent_loop.py::run_agent_chat(conv, user, user_message, user_msg_id, images) -> AsyncIterator[str]`. **Owns its own `async with async_session() as db`** — the generator outlives the request-scoped session. See `quality-guidelines.md` "Don't: request-injected DB sessions inside StreamingResponse generators".
- LLM streaming helper: `services/llm.py::stream_chat_with_tools(client, model, messages, tools=None, tool_choice="auto") -> AsyncIterator[tuple[str | None, dict | None]]`. `stream_chat` (no tools) is retained as the fallback path.
- Tools: `services/agent_tools.py::TOOLS` (schema list) + `execute_tool(name, args, *, user_id, conversation_id, db) -> ToolResult`. Three tools (always exposed): `search_articles(query)` keyword lookup (top 5 over last 7 days), `list_articles(days/feed_id/unread_only/limit)` structured filter for list/count questions (returns `{id,title,published_at,feed_title,summary_snippet}`, ordered by `COALESCE(published_at,created_at) DESC`, scoped by `Feed.user_id`), `read_article(article_id)` full text. `ToolResult(content: str, summary: str)` — `content` is JSON fed to the model; `summary` is the human-facing SSE line.
- Guard rail: `agent_loop.MAX_TOOL_ROUNDS = 8`. At the cap a system message is injected and one final no-tools round runs.
- DB: `ChatMessage.tool_calls JSON nullable`, `ChatMessage.tool_call_id String nullable`, `ChatMessage.name String nullable` (migration 016). `role` extends to `"user" | "assistant" | "tool"`.

### 3. Contracts
- **SSE event protocol** (backward-compatible: old clients ignore unknown keys):
  - `{"content": "<delta>"}` — streamed answer text (unchanged from pre-agent).
  - `{"type": "tool_call_start", "name": "<tool>", "args": <parsed args dict | raw string>}` — agent is invoking a tool.
  - `{"type": "tool_call_end", "name": "<tool>", "result_summary": "<short line, e.g. 找到 3 篇>"}` — tool finished. Full result is NOT sent to the client; it stays in the `tool` message fed to the model.
  - `data: [DONE]` — stream end.
- **Message persistence contract**: every agent round persists (each via its own `await db.commit()`, **not** `flush()`):
  - `role="assistant"` carrying `tool_calls=[...]` (content may be `""`/null) — the model's tool-call request frame.
  - `role="tool"` carrying `tool_call_id` + `name` + `content` (the tool result JSON) — one per tool_call.
  - `role="assistant"` final answer carrying `content=<full streamed text>`, `tool_calls=None`.
- **History replay**: `_prepare_messages` loads ALL persisted ChatMessage rows (including `tool`/`tool_calls` frames) in order and rebuilds the OpenAI messages array — no tools are re-executed; their results already sit in `tool` messages. The history endpoint (`/chat/history`) **filters out** `role="tool"` and empty `tool_calls`-bearing assistant frames from the UI payload (see `routers/ai.py::_is_displayed`), but the LLM replay path reads the full set.
- **Tools always exposed**: `run_agent_chat` sets `tools = TOOLS` unconditionally — search/list/read are a default AI capability (the old `user.ai_cross_article_search` toggle and no-tools system-prompt variant were removed in migration 017). The single `_AGENT_SYSTEM_PROMPT` constant names all three tools and guides the model to pick the right one by question type (keyword search vs structured list vs read).
- **Guard rail (`R6`)**: when `rounds >= 8`, inject `{role:system, content:"已达工具调用上限，请基于已获取信息回答本条消息。"}` and run one final no-tools stream round, then converge. Never hard-error.
- **Graceful degradation (`R8`)**: any exception inside `run_agent_chat` after content was already streamed → end with `[DONE]`. Before any content → fall back to `_plain_fallback` (no-tools `stream_chat`). The chat endpoint must never 500 due to an agent-loop failure.

### 4. Validation & Error Matrix
- No API key configured (`get_user_llm_client` raises `ValueError`) → yield `{"error": "..."}` + `[DONE]`. `200`.
- Model emits a tool_call with malformed args JSON → `_safe_json` returns the raw string; `_run_one_tool` treats non-dict as empty args; tool returns its own error `{"error":"missing query"}`-style content. Model retries or answers. `200`.
- Tool execution raises → caught in `_run_one_tool`, returned to model as `{"error": str(e)}` tool message; agent may continue. `200`.
- `read_article` duplicate ConversationReference insert → SAVEPOINT rollback only; assistant tool_call message survives. `200`.
- Tool-call round count reaches 8 → guard rail injects system message; final no-tools round. `200`.
- Agent loop raises mid-stream after content was yielded → emit `[DONE]`, do NOT attempt fuller fallback (user already saw partial answer). `200`.
- Agent loop raises before any content → `_plain_fallback` streams a plain no-tools answer. `200`.

### 5. Good/Base/Bad Cases
- Good: "订阅源里关于 AI 的文章有哪些" → assistant streams prologue → `search_articles(query="AI")` → 5 candidates → assistant lists titles → `read_article(id)` → assistant summarizes full text. 3 rounds, 6 persisted messages, 1 `is_auto=True` ref, SSE shows "正在搜索「AI」… / 找到 5 篇 / 正在阅读《…》".
- Base: "你好" → model answers directly, no tool calls. One no-tool round, 2 persisted messages (user + assistant), zero tool events.
- Bad (pre-fix): `run_agent_chat` accepted the request-scoped `db` and used it inside the generator → session closed by the time the first `yield` ran → `db.add()`/`flush()` silently no-op'd or raised → only the user message (committed pre-return) persisted, all assistant/tool frames lost.
- Bad (pre-fix): `_persist_assistant` used `db.flush()` without `commit()` → on `async with` exit the whole transaction rolled back → empty history on reload.
- Bad (pre-fix): `read_article` caught `IntegrityError` with `await db.rollback()` → rolled back the just-flushed assistant tool_call message in the same transaction → dangling `tool` message with no preceding `assistant.tool_calls`.
- Bad (pre-fix): single `AGENT_SYSTEM_PROMPT` told the model to "use search_articles/read_article tools" even when the toggle was off → model apologised "I can't access your feed" because it was told to use tools it didn't have. (The toggle itself was later removed as semantically dead — see migration 017.)

### 6. Tests Required
- `tests/test_agent_loop.py` (pure logic — no DB/HTTP):
  - `_accumulate_round` covers: pure content round; arguments accumulated across multiple fragments (the streaming delta pitfall); multiple tool_calls indexed & sorted; content + tool_calls interleaved in one round; empty stream; `to_openai_dict()` shape.
  - `MAX_TOOL_ROUNDS == 8`; `RAIL_LIMIT_SYSTEM` mentions upper limit + "回答".
  - `_safe_json` covers: empty → `{}`; valid JSON → parsed; malformed → raw string fallback.
- `tests/test_agent_tools.py` (pure logic — routing + shape): tool schema shape (3 function-type tools: search/list/read, required params, Chinese action-oriented descriptions); `execute_tool` routing for unknown tool / missing query / empty query / list_articles invalid feed_id UUID / missing article_id / invalid UUID / no-token query (bails before DB). `ToolResult` shape.
- `tests/test_history_filter.py` (pure logic): `_is_displayed` hides `role="tool"` and `tool_calls`-bearing assistant frames; shows user + final assistant.
- `tests/test_agent_loop.py::TestSystemPrompt`: single `_AGENT_SYSTEM_PROMPT` constant mentions all three tools (search/list/read).
- The DB-backed `run_agent_chat` end-to-end is **not** unit-tested; verified by manual SSE curl + DB inspection (messages persisted with correct roles/tool_calls/tool_call_id, ConversationReference written with `is_auto=True`).

### 7. Wrong vs Correct

#### Wrong — request-scoped session in the streaming generator
```python
async def _do_conversation_chat(conv, body, db, user):
    async def event_stream():
        async for sse in run_agent_chat(conv, user, body.message, user_msg_id, body.images, db):
            yield sse          # db (request-scoped) is already closed here
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

#### Correct — loop owns a fresh session
```python
async def _do_conversation_chat(conv, body, db, user):
    # user_msg committed here on the request-scoped db (still alive pre-return)
    async def event_stream():
        async for sse in run_agent_chat(conv, user, body.message, user_msg_id, body.images):
            yield sse          # run_agent_chat opens its own async_session()
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

#### Wrong — flush without commit, then rollback on duplicate
```python
# 1) flush (not commit) leaves rows in the transaction
db.add(ChatMessage(role="assistant", tool_calls=[...]))
await db.flush()
# 2) a later IntegrityError rollback wipes the assistant frame too
db.add(ConversationReference(...))
try:
    await db.flush()
except IntegrityError:
    await db.rollback()        # nukes everything since the last commit
```

#### Correct — commit each round, use savepoint for duplicates
```python
# Each persisted message commits immediately so later failures can't drop it.
db.add(ChatMessage(role="assistant", content=content, tool_calls=tool_calls, created_at=datetime.now(timezone.utc)))
await db.commit()

# Duplicate-ref guard uses a SAVEPOINT, not a full rollback.
try:
    async with db.begin_nested():
        db.add(ConversationReference(conversation_id=conv_id, article_id=aid, is_auto=True))
except IntegrityError:
    pass
```
