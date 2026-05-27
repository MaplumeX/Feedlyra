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
