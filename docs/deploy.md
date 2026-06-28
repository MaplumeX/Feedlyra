# Deploying Feedlyra with Docker Compose

This guide covers the single-command Docker Compose deployment of Feedlyra
(backend + frontend + PostgreSQL). It targets both local trial runs and
self-hosting on a VPS.

## Prerequisites

- Docker Engine (with the `docker compose` plugin). Install via the official
  instructions for your platform: <https://docs.docker.com/get-docker/>.
- A working directory containing this repository (it has `docker-compose.yml`,
  `backend/Dockerfile`, `frontend/Dockerfile`, and the root `.env.example`).
- An OpenAI-compatible API key for the AI features (summarize / translate /
  chat). The app still runs without it, but AI features will return config
  errors when invoked.

## Quick start

```bash
# 1. Create your config from the template
cp .env.example .env

# 2. Edit .env — at minimum change these (see "Configuration" below):
#    - SECRET_KEY
#    - POSTGRES_PASSWORD
#    - AI_DEFAULT_API_KEY

# 3. Build and start everything
docker compose up -d --build

# 4. Watch the backend start (migrations run first)
docker compose logs -f backend
#    When you see "Uvicorn running on http://0.0.0.0:8000" the stack is ready.

# 5. Open the app
#    http://localhost:${FRONTEND_PORT}   (default 8080)
```

Register a new account, add an RSS subscription, refresh, and start an AI
conversation to verify the stack end-to-end.

## Configuration

All runtime configuration lives in the root `.env` file (see `.env.example`).
Docker Compose interpolates `${VAR}` values from it, and the backend service
injects the whole file via `env_file`. The image build never reads `.env`, so
no secret leaks into the image.

Must-change before production:

| Variable | Why |
|----------|-----|
| `SECRET_KEY` | Used to sign JWT tokens **and** to derive the Fernet key that encrypts user AI API keys at rest. Use a strong random string, e.g. `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`. |
| `POSTGRES_PASSWORD` | Database password. Pick a strong value. |
| `AI_DEFAULT_API_KEY` | Your OpenAI-compatible API key, otherwise AI features return a configuration error. |

Other variables (defaults in `.env.example`):

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` / `POSTGRES_DB` | Database user and database name. |
| `DATABASE_URL` | Composed automatically from the three values above using the `db` service hostname. Usually leave as-is. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | JWT token lifetimes. |
| `CORS_ORIGINS` | Comma-separated allowed origins. Same-origin via nginx, kept for local dev. |
| `UPLOAD_DIR` | Container path for uploaded chat images; mounted on the `feedlyra_uploads` volume. Override it in `docker-compose.yml` if changed. |
| `AI_DEFAULT_BASE_URL` / `AI_DEFAULT_MODEL` | OpenAI-compatible endpoint and default model. |
| `FRONTEND_PORT` | Host port mapped to nginx. |

> Per-user AI settings (override base URL / API key / model, and per-feature
> overrides) are stored in the database after first run and are encrypted at
> rest with Fernet (derived from `SECRET_KEY`). Never lose `SECRET_KEY` or
> those values become undecryptable.

## Architecture

```
host :8080 -> frontend (nginx:alpine)
                serve SPA, proxy /api/* -> backend:8000 (no buffering for SSE)
                                  |
                            backend (uv + python:3.12)
                                entrypoint: alembic upgrade head -> uvicorn
                                /app/uploads (volume)
                                  |
                            db (postgres:16-alpine)
                                /var/lib/postgresql/data (volume)
```

Only the `frontend` service exposes a host port. The `db` and `backend`
services live on the private `feedlyra-net` bridge network. Two named volumes
persist data across container removal.

## Stopping

```bash
# Stop and remove containers — data is PRESERVED in named volumes.
docker compose down

# Stop and also DELETE all volumes (database + uploads) — full reset.
docker compose down -v
```

## Persistence / backups

After `docker compose down` (without `-v`) all data is preserved:

- `feedlyra_pgdata` — PostgreSQL data directory.
- `feedlyra_uploads` — uploaded chat images.

Restart with `docker compose up -d` (no `--build` needed once images exist) and
your accounts, subscriptions, and uploads are still there.

Database backup (optional, not automated). Simpler one-liner dumping from the
running db container:

```bash
docker compose exec db pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > feedlyra-backup.sql
```

To restore: `docker compose exec -T db psql -U "${POSTGRES_USER}" "${POSTGRES_DB}" < feedlyra-backup.sql`.

Uploads backup: `docker run --rm -v feedlyra_uploads:/u -v "$PWD:/b" alpine tar czf /b/uploads-backup.tgz -C /u .`.

## Troubleshooting

### Port conflict on 8080

Another process holds `${FRONTEND_PORT}` (default 8080). Set a different port
in `.env`:

```bash
FRONTEND_PORT=8181
```

then `docker compose up -d`. (`nginx` listens on container port 80 always.)

### Migrations fail / backend keeps restarting

```bash
docker compose logs backend
```

Look for `running alembic upgrade head`. If db connection failed despite the
healthcheck, the entrypoint retries 5 times then exits; `restart:
unless-stopped` will keep retrying at the container level.

Check the db is healthy:

```bash
docker compose ps db
docker compose logs db
```

If a migration itself is broken (rare), `docker compose down -v` wipes the
database and you start fresh — only do this if you don't need the data.

### SSE / AI chat stream cuts off after ~60s

This is the nginx default `proxy_read_timeout`. Our `frontend/nginx.conf`
already sets `proxy_buffering off;` and `proxy_read_timeout 3600s;`. If you
still see truncation, regenerate the frontend image:

```bash
docker compose up -d --build frontend
```

### Feeling stuck — rebuild from scratch

⚠️ `down -v` deletes the database and all uploaded images. Back up first if the data matters.

```bash
docker compose down -v
docker compose up -d --build
```

### Viewing logs

```bash
docker compose logs -f           # all services
docker compose logs -f backend   # backend only
```

## Upgrading

```bash
git pull
docker compose up -d --build
```

Migrations run automatically on backend startup; database data and uploads
persist through upgrades.

## Out of scope

TLS/HTTPS termination, domain binding, CI image publishing, multi-environment
parameterization (staging/prod), Kubernetes, automated backups, resource
limits, and non-root hardening are intentionally not covered here.
