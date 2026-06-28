# Design — docker-compose-deploy

## 1. 架构与边界

三个容器 + 两个命名卷，单一内网，仅 frontend 对外暴露端口。

```
                ┌─────────────────────────────────────────────┐
   宿主 :8080 ─▶│ frontend (nginx:alpine)                     │
                │   serve /usr/share/nginx/html (SPA)          │
                │   /api/*  → proxy_pass http://backend:8000  │
                └───────────────┬─────────────────────────────┘
                                │ (feedlyra-net)
                ┌───────────────▼─────────────────────────────┐
                │ backend (uv + python:3.12-slim)             │
                │   entrypoint: alembic upgrade head → uvicorn│
                │   /app/uploads/chat_images (卷)              │
                └───────────────┬─────────────────────────────┘
                                │ (feedlyra-net)
                ┌───────────────▼─────────────────────────────┐
                │ db (postgres:16-alpine)                     │
                │   /var/lib/postgresql/data (卷)              │
                └─────────────────────────────────────────────┘
```

- **网络**：自定义 bridge `feedlyra-net`；`db` 与 `backend` 不对外映射端口，仅内部容器互访。统一入口是 nginx，符合 D1 自托管形态。
- **卷**：
  - `feedlyra_pgdata` → `/var/lib/postgresql/data`（数据库持久化，R3/AC2）
  - `feedlyra_uploads` → `/app/uploads`（用户上传图片持久化，R4/AC2）
- **不暴露 backend 端口**：浏览器访问经 nginx 同源转发；管理员需要后台直连时再改 compose（注释样式提示）。

## 2. 数据流与契约

### 2.1 前端 → 后端（同源）
- 前端构建期注入 `VITE_API_URL=""`（空串，非 nullish），`client.ts` 中 `API_BASE = ""` → 所有 `fetch("/api/...")` 走同源相对路径。
- nginx 监听 80，`/api/` 反代到 `backend:8000`，其余路径 `try_files` 回退 `index.html`（SPA 路由）。
- 由于同源，浏览器视角无跨域 → `CORS_ORIGINS` 实际不生效，但保留默认值以兼容本地 dev 模式（vite 5173 直连 backend 8000）。

### 2.2 上传图片
- 后端 `ai.py` 通过 `/api/ai/images/{filename}` 路由用 `FileResponse` 读 `settings.UPLOAD_DIR` 下的文件。
- 容器内 `UPLOAD_DIR=/app/uploads/chat_images`，挂载在 `feedlyra_uploads` 卷的 `/app/uploads` 下，nginx 反代 `/api/` 覆盖该路径，无需额外静态挂载。

### 2.3 SSE（AI 对话流）
- `frontend/src/api/sse.ts` 走 `fetch` streaming，路径 `/api/ai/conversations/{id}/chat`。
- nginx `/api/` location 必须设置 `proxy_buffering off;` 与较长 `proxy_read_timeout`（默认 60s 会切断长流），否则 SSE 会被缓冲/超时。这是 nginx 反代 FastAPI SSE 的关键约束。

## 3. 关键设计：迁移执行策略（R2/AC3）

### 3.1 启动顺序
`db` healthcheck (`pg_isready`) → `backend` depends_on `condition: service_healthy` → entrypoint 跑 `alembic upgrade head` → 启动 `uvicorn`。

### 3.2 entrypoint 重试
即使 `db` healthy，alembic 首次连接偶发失败。entrypoint 用 shell 循环重试 alembic（最多 N 次，每次间隔）后再启动 uvicorn。失败则容器退出（→ `restart: unless-stopped` 重启，自愈）。

### 3.3 不引入 init 容器
单容器 entrypoint 即可，避免 compose 复杂度。

## 4. 镜像构建

### 4.1 backend/Dockerfile（多阶段，基于 uv 官方镜像）
```
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
COPY pyproject.toml uv.lock alembic.ini ./
COPY alembic ./alembic
COPY app ./app
RUN uv sync --frozen --no-dev --no-install-project
EXPOSE 8000
# entrypoint 见 implement.md
```
- `--no-install-project`：只装依赖不装项目本体；`app/` 直接位于 `/app`，`uv run` 时 cwd 在 sys.path，`app.main:app` 可导入。
- 不 `COPY .env`、不 `COPY uploads/`、不 `COPY tests/`（由 .dockerignore 保证）。
- 运行非 root：uv 镜像默认 `uv` 用户；若需可显式 `USER uv`，但要注意卷写权限。MVP 用 root + 卷权限放宽，后续 harden。

### 4.2 frontend/Dockerfile（多阶段 node 构建 → nginx）
```
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_API_URL=""
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```
- `VITE_API_URL=""` 作为构建期 ENV 注入；不依赖 `.env` 文件（构建上下文里也无）。

### 4.3 nginx.conf
- `location /api/ { proxy_pass http://backend:8000; }`（无尾斜杠，保留 `/api` 前缀）
- SSE 关键：`proxy_buffering off; proxy_read_timeout 3600s;`
- 其余：`try_files $uri $uri/ /index.html;`

## 5. 配置与 secrets（D3）

### 5.1 根级 `.env.example`
集中所有变量 + 可工作的占位默认值。用户 `cp .env.example .env` 即可起栈；生产改强密码与真实 AI key。

### 5.2 compose 读取方式
- compose 自动读取同目录 `.env` 做变量插值（`${VAR}`）。
- 容器运行时 env 用 `env_file: .env` 注入 backend（pydantic-settings 已配置 `env_file: ".env"`，但 compose env_file 更直接）。
- db 只需 `POSTGRES_USER/PASSWORD/DB` 三个，用 `environment:` 显式 `${VAR}` 映射，避免把 AI key 等无关变量灌进 db 容器。
- `.dockerignore` 排除 `.env`，构建期不读 → 无 secret 进镜像（AC4）。

### 5.3 `DATABASE_URL` 内置主机名
`.env.example` 中 `DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}`，主机名 `db` 即 compose 服务名，容器内自动解析。

## 6. 持久化与重启
- `restart: unless-stopped`：所有服务（D1 自托管形态）。
- 命名卷：`docker compose down`（不加 `-v`）数据不丢；`down -v` 才清空（文档说明）。

## 7. 文件清单（交付物）

仓库根 / 各子目录新增：
1. `docker-compose.yml` — 编排三服务 + 两卷 + 网络。
2. `backend/Dockerfile` — uv 多阶段。
3. `backend/.dockerignore` — 排除 `.venv/ __pycache__/ .env tests/ uploads/ *.egg-info/`。
4. `backend/entrypoint.sh` — wait-for-db + alembic upgrade + uvicorn。
5. `frontend/Dockerfile` — node 构建 + nginx serve。
6. `frontend/nginx.conf` — SPA + /api 反代（含 SSE 超时）。
7. `frontend/.dockerignore` — 排除 `node_modules/ dist/ .env*`。
8. `.env.example` — 根级，全变量占位。
9. `docs/deploy.md` — 部署使用文档。

## 8. Trade-offs 记录

| 选择 | 替代 | 决定理由 |
|------|------|----------|
| nginx 独立容器 | backend StaticFiles 挂载 | 不改 backend 代码；nginx 静态服务更稳；SSE 反代可控；将来加 TLS 顺滑 |
| entrypoint 跑迁移 | init 容器 | 单容器简单；compose 无额外服务 |
| 命名卷 | bind mount | 跨主机迁移友好、权限简单；自托管形态标准 |
| env_file | environment 全量插值 | 减少重复；pydantic-settings 已兼容 env_file |
| `--no-install-project` | 装项目为包 | 减少构建步骤；app 源码直接在 /app 可导入 |

## 9. 操作与回滚
- **回滚**：删除新增文件即可，无 backend/frontend 代码改动（零侵入）。
- **升级现有部署**：`git pull && docker compose up -d --build`。
- **数据备份**：`docker run --rm -v feedlyra_pgdata:/d -v $PWD:/b postgres:16-alpine pg_dump ...`（文档提示，不在 scope 内自动化）。
