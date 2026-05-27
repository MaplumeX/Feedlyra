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
- AI article operations should use the richest available content via `Article.readable_content`: `full_content`, then `content`, then `content_snippet`, then empty string.

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
