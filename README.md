# Feedlyra

A self-hosted RSS feed reader with integrated AI capabilities — summarize, translate, and chat with your articles using any OpenAI-compatible LLM.

[简体中文](./README.zh-CN.md)

## Features

### Feed Management
- Subscribe to RSS/Atom feeds by URL
- Auto-discover feed URLs from any website
- OPML import & export (with automatic category creation)
- Automatic periodic feed refresh (every 5 minutes)
- Conditional HTTP fetching with `ETag` / `If-Modified-Since`
- Exponential backoff on feed parsing errors
- Per-feed settings: title, category, auto full-text extraction
- Feed icon / favicon auto-discovery

### Article Reading
- Virtualized infinite-scrolling article list
- HTML sanitization with DOMPurify
- Full-text content extraction (trafilatura + readability-lxml)
- Image lightbox, auto-generated table of contents
- Read/unread tracking, star/favorite articles
- Scroll-based batch mark-as-read
- "New articles" banner on auto-refresh

### Reader Customization
- Font family (7 options including Chinese fonts), size, line height, spacing, content width
- All settings persisted to localStorage

### AI (Bring Your Own Key)
- Per-feature AI config (summarize, translate, chat — each with its own API key / URL / model)
- API keys encrypted at rest (Fernet)
- **AI Summarize** — concise (<100 words) paragraph summaries, cached by content hash
- **AI Translate** — translate title + content with XML-tag-structured prompts
- **AI Chat** — streaming SSE chat with article context, history summarization, message edit & regeneration, stop generation mid-stream
- Auto-summarize on article open

### UI / UX
- 3-panel resizable layout (sidebar → article list → article detail) + optional AI chat panel
- Sidebar virtual folders: All Feeds, Unread, Starred (with live counts)
- Command palette (`Ctrl`+`K` / `Cmd`+`K`)
- Keyboard shortcuts: `j`/`k` navigate, `s` star, `m` toggle read, `r` refresh, `1`/`2`/`3` filter, `Shift`+`S` sidebar, `Shift`+`A` mark all read
- Dark / light / system theme
- i18n: English + Simplified Chinese

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite 6, TanStack React Query 5, Zustand 5, shadcn/ui, Tailwind CSS 3, react-virtuoso, react-resizable-panels, i18next |
| Backend | Python 3.12+, FastAPI, SQLAlchemy 2 (async), asyncpg, Alembic, Pydantic 2, OpenAI Python SDK |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens), bcrypt |

## Quick Deployment (Docker Compose)

The fastest way to self-host Feedlyra — pulls prebuilt multi-arch images
(`linux/amd64`, `linux/arm64`) from GHCR, no build step needed:

```bash
cp .env.example .env          # then edit SECRET_KEY / POSTGRES_PASSWORD / AI_DEFAULT_API_KEY
docker compose up -d
```

The app will be available at `http://localhost:${FRONTEND_PORT:-7756}`.

Full guide (configuration, architecture, backups, troubleshooting, building
from source): see [`docs/deploy.md`](./docs/deploy.md).

## Getting Started (Local Development)

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL
- [uv](https://docs.astral.sh/uv/) (Python package manager)

### Backend Setup

```bash
cd backend

# Create and configure environment
cp .env.example .env
# Edit .env — see Configuration below

# Install dependencies
uv sync

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Production Build

```bash
cd frontend
npm run build    # Type-check + production build
npm run preview  # Preview production build
```

## Configuration

### Backend — Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/feedlyra` | PostgreSQL async connection string |
| `SECRET_KEY` | `change-me-to-a-random-secret-in-production` | JWT signing & Fernet key derivation (**must change in production**) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `AI_DEFAULT_BASE_URL` | `https://api.openai.com/v1` | Default OpenAI-compatible API base URL |
| `AI_DEFAULT_API_KEY` | *(empty)* | Server-wide fallback API key |
| `AI_DEFAULT_MODEL` | `gpt-4o-mini` | Default LLM model |

### Frontend — Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL |

## Project Structure

```
Feedlyra/
├── backend/
│   ├── alembic/           # Database migrations
│   ├── app/
│   │   ├── main.py        # FastAPI app (lifespan, periodic refresh)
│   │   ├── config.py      # Settings (env vars)
│   │   ├── database.py    # Async engine & session
│   │   ├── models/        # SQLAlchemy models
│   │   ├── routers/       # API endpoints (auth, feeds, articles, categories, ai)
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/      # Business logic (feed fetcher, LLM, auth, summary)
│   └── pyproject.toml
└── frontend/
    ├── src/
    │   ├── api/           # API client, React Query hooks, types
    │   ├── components/    # UI components (sidebar, article list/detail, AI chat, settings)
    │   ├── hooks/         # Keyboard shortcuts
    │   ├── i18n/          # i18next locales (en, zh-CN)
    │   ├── pages/         # Route pages (Home, Login, Register)
    │   └── stores/        # Zustand stores (auth, reader)
    └── package.json
```

## License

MIT
