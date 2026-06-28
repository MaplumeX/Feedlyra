#!/usr/bin/env bash
set -euo pipefail

# Apply database migrations with retry (depends_on healthcheck already ensures db ready,
# but the first alembic connection can still transiently fail).
MAX_ATTEMPTS=5
for i in $(seq 1 "$MAX_ATTEMPTS"); do
    echo "[entrypoint] running alembic upgrade head (attempt ${i}/${MAX_ATTEMPTS})..."
    if uv run alembic upgrade head; then
        echo "[entrypoint] migrations applied successfully."
        break
    fi
    if [ "$i" -eq "$MAX_ATTEMPTS" ]; then
        echo "[entrypoint] alembic upgrade failed after ${MAX_ATTEMPTS} attempts, exiting." >&2
        exit 1
    fi
    echo "[entrypoint] alembic failed, retrying in 3s..." >&2
    sleep 3
done

echo "[entrypoint] starting uvicorn..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
