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
│       ├── 002_user_ai_config.py
│       ├── 003_feed_icon_url.py
│       ├── 004_categories.py
│       ├── 005_article_image_url.py
│       ├── 006_article_full_content.py
│       ├── 007_article_summaries.py
│       ├── 008_per_feature_ai_config.py
│       ├── 009_feed_auto_full_text.py
│       ├── 010_article_chat_history_summary.py
│       ├── 011_auto_translate_fields.py
│       ├── 012_conversations_and_references.py
│       ├── 013_automation_rules.py
│       └── 014_article_initial_fetch.py
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
    │   ├── category.py     # Category model
    │   ├── article.py      # Article, ReadStatus, StarredArticle models
    │   ├── automation.py   # AutomationRule model (conditions/actions JSON, scope, priority)
    │   └── ai.py           # ArticleAIData, ArticleSummary, ArticleChat, ChatMessage, Conversation, ConversationReference models
    ├── schemas/
    │   ├── __init__.py
    │   ├── auth.py         # RegisterRequest, LoginRequest, TokenResponse
    │   ├── user.py         # UserResponse, UserProfileUpdate, UserEmailUpdate, UserPasswordUpdate
    │   ├── feed.py         # FeedCreate, FeedUpdate, FeedResponse
    │   ├── category.py     # CategoryCreate, CategoryUpdate, CategoryResponse
    │   ├── article.py      # ArticleResponse, ArticleListResponse
    │   ├── automation.py   # ConditionSchema, ActionSchema, AutomationRuleCreate/Update/Response
    │   └── ai.py           # AI config, summary, translation, chat schemas
    ├── routers/
    │   ├── __init__.py
    │   ├── auth.py         # /api/auth/*
    │   ├── feeds.py        # /api/feeds/*
    │   ├── categories.py   # /api/categories/*
    │   ├── articles.py     # /api/articles/*
    │   ├── ai.py           # /api/ai/*
    │   └── automation.py   # /api/automation-rules/*
    └── services/
        ├── __init__.py
        ├── auth.py              # JWT + bcrypt password handling
        ├── feed_fetcher.py      # RSS fetch, parse, OPML, periodic refresh, automation integration
        ├── article_summary.py   # Summary content selection, content hash, extract_content_for_summary
        ├── automation.py        # Rule engine: condition matching, scope resolution, action application
        └── llm.py               # OpenAI client, summary, translation, chat streaming, conversation references
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
