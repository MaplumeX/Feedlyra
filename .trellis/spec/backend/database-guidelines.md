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

## Common Mistakes

- **Not using mixins**: New models that manually declare `id`/`created_at`/`updated_at` instead of `UUIDMixin`/`TimestampMixin` create inconsistency. Use the mixins.
- **Missing `ondelete="CASCADE"`**: Without database-level cascade, orphaned records remain after parent deletion.
- **Using `expire_on_commit=True`**: The default causes lazy-load errors after commit in async context. Always use `expire_on_commit=False`.
