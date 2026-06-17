# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

SQLAlchemy 2.0 async with asyncpg driver for PostgreSQL. Alembic for migrations. No repository/DAO layer — routers and services query the database directly.

---

## Engine & Session Setup

Configured in `app/database.py`:

```python
engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

- `expire_on_commit=False` — allows post-commit attribute access without re-querying
- Dependency injection via `get_db()` in `app/dependencies.py` yields an `AsyncSession`

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
- DB: unique constraint on `(article_id, source, model)`.
- API: `POST /api/ai/articles/{article_id}/summarize?source=feed|full -> SummarizeResponse`.
- API: `ArticleResponse.summaries: dict[str, ArticleSummaryResponse]`.

### 3. Contracts
- `source=feed` summarizes `article.content`, falling back to `article.content_snippet`.
- `source=full` summarizes `article.full_content` only.
- Cache reuse requires matching `article_id`, `source`, `model`, and `content_hash`.
- Article list/detail responses should include summaries only for the current user's configured model.
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
summary = await generate_summary(client, model, article.title, content)
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
