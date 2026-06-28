# syntax=docker/dockerfile:1

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Install dependencies first (layer cache: source changes don't break deps layer)
COPY pyproject.toml uv.lock alembic.ini ./
COPY alembic ./alembic
COPY app ./app

RUN uv sync --frozen --no-dev --no-install-project

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
