# Support docker compose deployment

## Goal

让 Feedlyra 支持通过 `docker compose up` 一键部署整套应用（backend + frontend + 数据库），无需手动安装 Python/Node 本地工具链即可运行。

## Background — Confirmed Facts (from codebase)

### 架构
- **后端** (`backend/`): FastAPI (Python ≥3.12)，依赖由 `uv` 管理（`pyproject.toml` + `uv.lock`）。使用 asyncpg + SQLAlchemy 异步连接 PostgreSQL。Alembic 管理迁移（17 个 version 文件）。进程内有一个 asyncio 定时任务 `_periodic_feed_refresh`（每 300s 刷新 RSS）。
- **前端** (`frontend/`): Vite + React 19 + TS。`npm run build` 产出 `frontend/dist/` 静态资源。
- **数据库**: PostgreSQL（默认 `postgresql+asyncpg://postgres:postgres@localhost:5432/feedlyra`）。
- 当前**无** Redis / Celery / 外部消息队列，无需引入。

### 前后端通信（关键约束）
- 前端通过 `import.meta.env.VITE_API_URL` 寻址后端，默认 `http://localhost:8000`（见 `frontend/src/api/client.ts`、`frontend/src/api/sse.ts`）。这是**构建时**常量，不是运行时变量。
- 后端通过 `settings.CORS_ORIGINS`（逗号分隔）配置允许的前端来源，默认 `http://localhost:5173`。
- 后端目前**未** `app.mount(StaticFiles, ...)` 挂载前端构建产物；uploads 通过 `ai.py` 中的专用路由提供（`settings.UPLOAD_DIR = ./uploads/chat_images`）。

### 环境变量（`backend/.env.example` + `backend/app/config.py`）
- `DATABASE_URL` — 进程内由 alembic `env.py` 通过 `config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)` 注入，容器侧只需提供 env。
- `SECRET_KEY`、`ACCESS_TOKEN_EXPIRE_MINUTES`、`REFRESH_TOKEN_EXPIRE_DAYS`、`CORS_ORIGINS`。
- `AI_DEFAULT_BASE_URL`、`AI_DEFAULT_API_KEY`、`AI_DEFAULT_MODEL`。
- `UPLOAD_DIR`（默认 `./uploads/chat_images`，启动时 `lifespan` 会 `mkdir -p`）。

### 当前部署状态
- 仓库内无任何 `Dockerfile` / `docker-compose.yml` / `.dockerignore`。
- `.gitignore` 忽略 `backend/.env`、`*.env.local`、`frontend/dist/`、`frontend/node_modules/`、`backend/.venv/`。

## Requirements (draft)

- R1: 提供 `docker compose up` 一键启动 backend + frontend + postgres，应用可用（注册/登录、订阅、刷新、AI 对话）。
- R2: 数据库迁移在应用启动前自动执行（alembic upgrade head），无需手动 step。
- R3: PostgreSQL 数据持久化（命名卷或绑定卷），容器删除后数据不丢。
- R4: `UPLOAD_DIR`（用户上传图片）持久化到宿主机卷。
- R5: 提供 `.env.example`（根级或 `compose`），敏感项（SECRET_KEY、AI_API_KEY、DB 密码）通过 env 注入，不写死镜像。
- R6: 提供 `.dockerignore` 排除 `node_modules` / `dist` / `.venv` / `__pycache__` / `.env` 等，保证构建上下文精简。
- R7: 文档说明如何使用（更新 README 或新增 `docs/deploy.md`）。

## Acceptance Criteria (draft)

- [ ] AC1: 干净环境执行 `docker compose up --build` 后，浏览器访问前端可正常加载、登录、使用主功能。
- [ ] AC2: `docker compose down` 后再 `up`，用户数据与上传图片仍在。
- [ ] AC3: 迁移失败或数据库未就绪时不会丢数据；有重试/依赖等待机制（如 depends_on healthcheck）。
- [ ] AC4: 无敏感信息硬编码进镜像。

## Decisions

- D1（部署目标）：**单套自托管形态** — 一个 `docker-compose.yml` 同时满足「本地 `docker compose up` 干净起栈」与「搬到 VPS `docker compose up -d` 自托管」。默认值可用、敏感项走 `.env` 注入、命名卷持久化、`restart: unless-stopped`。
- D2（前端交付策略）：**独立 nginx 容器 serve 静态资源 + 反代 `/api`**。前端构建时 `VITE_API_URL=""`（同源相对路径）；nginx 暴露宿主端口并把 `/api/*` 反代到 `backend:8000`，其余路径回退 `index.html`（SPA）。不改 backend 代码。
- D3（secrets 处理方式）：**根级 `.env` 文件 + compose `env_file:` 注入**。仓库提供 `.env.example`（含占位默认值），用户 `cp .env.example .env` 填写；`.env` 加入 `.gitignore`，`.dockerignore` 排除 `.env`。镜像构建时不引用 `.env`，保证无泄漏。
- 非 scope: TLS/HTTPS/域名绑定、CI 镜像推送、镜像仓库、多环境参数化、K8s（另开任务）。

## Open Questions (blocking)

（无 — 全部解决）

## Out of Scope (tentative)

- HTTPS / TLS 终止、域名绑定、反向代理（如 Traefik/Caddy）。
- CI/CD 镜像推送、镜像仓库、多环境（staging/prod）参数化。
- K8s manifests。
