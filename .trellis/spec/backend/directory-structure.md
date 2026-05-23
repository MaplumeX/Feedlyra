# Directory Structure

> How backend code is organized in this project.

---

## Overview

Backend is a FastAPI async application following a four-layer architecture: routers → services → models + schemas. There is no repository/DAO layer; routers and services both query the database directly via SQLAlchemy.

---

## Directory Layout

```
backend/
├── pyproject.toml          # Project metadata + dependencies (uv-managed)
├── uv.lock                 # Lockfile for uv package manager
├── alembic.ini             # Alembic DB migration config
├── .env / .env.example     # Environment-based config
├── alembic/
│   ├── env.py              # Async Alembic migration runner
│   └── versions/
│       ├── 001_initial_schema.py
│       └── 002_user_ai_config.py
└── app/
    ├── __init__.py
    ├── main.py             # FastAPI app factory, lifespan, CORS, router includes
    ├── config.py           # Pydantic Settings class
    ├── database.py         # SQLAlchemy async engine + session factory
    ├── dependencies.py     # FastAPI Depends: get_db, get_current_user
    ├── models/
    │   ├── __init__.py     # Re-exports all model classes
    │   ├── base.py         # DeclarativeBase, TimestampMixin, UUIDMixin
    │   ├── user.py         # User model
    │   ├── feed.py         # Feed model
    │   ├── article.py      # Article, ReadStatus, StarredArticle models
    │   └── ai.py           # ArticleAIData, ArticleChat, ChatMessage models
    ├── schemas/
    │   ├── __init__.py
    │   ├── auth.py         # RegisterRequest, LoginRequest, TokenResponse
    │   ├── user.py         # UserResponse
    │   ├── feed.py         # FeedCreate, FeedUpdate, FeedResponse
    │   ├── article.py      # ArticleResponse, ArticleListResponse
    │   └── ai.py           # AI config, summary, translation, chat schemas
    ├── routers/
    │   ├── __init__.py
    │   ├── auth.py         # /api/auth/*
    │   ├── feeds.py        # /api/feeds/*
    │   ├── articles.py     # /api/articles/*
    │   └── ai.py           # /api/ai/*
    └── services/
        ├── __init__.py
        ├── auth.py         # JWT + bcrypt password handling
        ├── feed_fetcher.py # RSS fetch, parse, OPML, periodic refresh
        └── llm.py          # OpenAI client, summary, translation, chat streaming
```

---

## Module Organization

New features follow this pattern:

1. **Model** in `app/models/<domain>.py` — SQLAlchemy ORM class with `Mapped[]` annotations
2. **Schema** in `app/schemas/<domain>.py` — Pydantic BaseModel classes for request/response
3. **Router** in `app/routers/<domain>.py` — `APIRouter(prefix="/api/<resource>")` with route handlers
4. **Service** in `app/services/<domain>.py` — Business logic (auth, external API calls, background tasks)

Not all features need a service file. Simple CRUD can live entirely in the router. Only extract a service when there's reusable logic or complex orchestration (e.g., `feed_fetcher.py` for RSS parsing, `llm.py` for OpenAI integration).

---

## Naming Conventions

- **Files**: snake_case, one module per domain (`feed.py`, `feed_fetcher.py`, `article.py`)
- **Models**: PascalCase class names, plural table names (`users`, `feeds`, `articles`), compound/snake_case for junction tables (`read_status`, `starred_articles`, `article_ai_data`)
- **Schemas**: PascalCase with suffixes — `*Request`, `*Response`, `*Create`, `*Update`
- **Routers**: snake_case file matching the resource name, `router = APIRouter(prefix="/api/<resource>")`

---

## Examples

- Simple CRUD domain: `app/routers/feeds.py` + `app/models/feed.py` + `app/schemas/feed.py`
- Domain with service: `app/routers/ai.py` uses `app/services/llm.py` for OpenAI calls
- Shared utilities: `app/dependencies.py` for DI (`get_db`, `get_current_user`), `app/models/base.py` for reusable mixins
