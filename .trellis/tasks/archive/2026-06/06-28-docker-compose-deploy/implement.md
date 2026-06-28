# Implementation Plan — docker-compose-deploy

## 执行顺序

每一步完成后用括号内命令自检。所有改动**不碰** backend/frontend 现有代码（零侵入）。

### Step 1 — `backend/.dockerignore` + `frontend/.dockerignore`
- `backend/.dockerignore`：排除 `.venv/`、`__pycache__/`、`*.pyc`、`*.egg-info/`、`.env`、`.env.local`、`tests/`、`uploads/`、`.pytest_cache/`。
- `frontend/.dockerignore`：排除 `node_modules/`、`dist/`、`.env`、`.env.local`、`*.log`。
- 自检：`cat backend/.dockerignore frontend/.dockerignore`

### Step 2 — `backend/Dockerfile`
- 基镜像 `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`。
- WORKDIR `/app`。
- 先 `COPY pyproject.toml uv.lock alembic.ini ./`，再 `COPY alembic ./alembic`、`COPY app ./app`（利用层缓存：源码变更不破坏依赖层）。
- `RUN uv sync --frozen --no-dev --no-install-project`。
- `EXPOSE 8000`。
- 自检：`docker build -t feedlyra-backend ./backend`（需先有 .env，但构建期不需要 env）。

### Step 3 — `backend/entrypoint.sh`
- bash 脚本：
  1. 循环最多 30 次尝试 `pg_isready`-like 探测（用 python 连 DATABASE_URL 或简单 TCP 探测 `db:5432`）— 实际上 depends_on healthcheck 已保证 db ready，entrypoint 内再加一层 alembic 重试即可。
  2. `uv run alembic upgrade head`（重试 5 次，每次 sleep 3）。
  3. `exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`。
- `chmod +x`（构建期 `RUN chmod +x entrypoint.sh`）。
- 自检：`bash -n backend/entrypoint.sh`（语法检查）。

### Step 4 — `frontend/nginx.conf`
- `server { listen 80; server_name _; root /usr/share/nginx/html; index index.html; }`
- `location /api/ { proxy_pass http://backend:8000; proxy_set_header Host/; buffering off; read_timeout 3600s; }`
- `location / { try_files $uri $uri/ /index.html; }`
- 自检：读一遍确认 `proxy_pass` 无尾斜杠。

### Step 5 — `frontend/Dockerfile`
- stage `build`：`node:20-alpine`，`npm ci`，`ENV VITE_API_URL=""`，`npm run build`。
- stage final：`nginx:alpine`，`COPY --from=build /app/dist /usr/share/nginx/html`，`COPY nginx.conf /etc/nginx/conf.d/default.conf`，`EXPOSE 80`。
- 自检：`docker build -t feedlyra-frontend ./frontend`（需 frontend 源码已就绪）。

### Step 6 — 根级 `.env.example`
- 变量：`POSTGRES_USER/PASSWORD/DB`、`DATABASE_URL`（引用前三者，host=db）、`SECRET_KEY`、`ACCESS_TOKEN_EXPIRE_MINUTES`、`REFRESH_TOKEN_EXPIRE_DAYS`、`CORS_ORIGINS=http://localhost:8080`、`UPLOAD_DIR=/app/uploads/chat_images`、`AI_DEFAULT_BASE_URL/API_KEY/MODEL`、`FRONTEND_PORT=8080`。
- 自检：`cp .env.example .env` 后 `docker compose config` 能解析无报错。

### Step 7 — `docker-compose.yml`
- services：`db` / `backend` / `frontend`；volumes：`feedlyra_pgdata` / `feedlyra_uploads`；networks：`feedlyra-net`（或默认）。
- `db`：postgres:16-alpine，env 显式 `${POSTGRES_*}`，healthcheck `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}`，卷挂 `/var/lib/postgresql/data`，`restart: unless-stopped`。
- `backend`：`build: ./backend`，`env_file: .env` + 显式 `environment:` 覆盖 `UPLOAD_DIR`，卷挂 `feedlyra_uploads:/app/uploads`，`depends_on.db.condition: service_healthy`，`restart: unless-stopped`，不映射宿主端口。
- `frontend`：`build: ./frontend`，`ports: ["${FRONTEND_PORT:-8080}:80"]`，`depends_on: [backend]`，`restart: unless-stopped`。
- 自检：`docker compose config` 校验语法 + 变量插值。

### Step 8 — `.gitignore`
- 确认根 `.env` 已被忽略（现有 `.gitignore` 有 `.env` 与 `*.env.local`，已覆盖根级 .env）。无需改动，仅核实。
- 自检：`git check-ignore .env`（cp .env.example .env 后应输出 `.env`）。

### Step 9 — `docs/deploy.md`
- 内容：前置（装 Docker）、`cp .env.example .env`、必改项（SECRET_KEY/POSTGRES_PASSWORD/AI key）、`docker compose up -d --build`、访问 `http://localhost:<FRONTEND_PORT>`、停止 `down`（数据保留）vs `down -v`（清空）、常见问题（端口冲突、迁移失败排查、查看日志）。
- 自检：读一遍 docs/deploy.md。

## 验证命令（最终）
```bash
# 1. 配置
cp .env.example .env
# 编辑 .env：改 SECRET_KEY、POSTGRES_PASSWORD、AI_DEFAULT_API_KEY

# 2. 构建并启动
docker compose up -d --build

# 3. 等待 backend 迁移 + 启动
docker compose logs -f backend   # 看到 "alembic upgrade head" 完成 + Uvicorn running

# 4. 访问
open http://localhost:8080       # 注册 → 登录 → 添加订阅 → AI 对话

# 5. 持久化验证
docker compose down
docker compose up -d             # 不 --build
# 再次登录：账号/订阅/上传图片仍在

# 6. 清理（可选）
docker compose down -v           # 同时删卷
```

## 风险点 / 回滚

| 风险 | 触发 | 缓解 |
|------|------|------|
| alembic 迁移在容器内失败 | db 未就绪 / 迁移本身有 bug | depends_on healthcheck + entrypoint 重试；失败时 `docker compose logs backend` 排查 |
| SSE 被 nginx 缓冲切断 | nginx 默认 buffering | nginx.conf 显式 `proxy_buffering off; proxy_read_timeout 3600s;` |
| 前端 VITE_API_URL 构建期未生效 | ENV 注入位置错误 | 在 `npm run build` 之前 `ENV VITE_API_URL=""`；构建后 `grep` dist 中是否含 localhost:8000 |
| 卷权限：backend 写 uploads 失败 | uv 镜像非 root 用户与卷 owner 不匹配 | MVP 用 root 运行；若失败则 entrypoint 内 `chown` 或镜像尾部 `USER root` |
| uv lock 与 pyproject 不同步 | lock 过期 | `--frozen` 会失败报错；提示 `uv lock` 后重试 |

## 回滚
- 全部新增文件位于仓库根 / `backend/` / `frontend/` / `docs/`，删除即恢复原状，无任何现有代码改动。
- 已运行的容器：`docker compose down -v` 清理。

## Follow-up（不在本任务）
- TLS/HTTPS（Caddy/Traefik 外层）
- CI 镜像构建推送
- 生产级 harden（非 root、resource limits、备份脚本）
