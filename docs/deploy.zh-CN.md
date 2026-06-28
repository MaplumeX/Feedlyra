# 使用 Docker Compose 部署 Feedlyra

本指南介绍如何用一条命令通过 Docker Compose 部署 Feedlyra（backend +
frontend + PostgreSQL），适用于本地试用与 VPS 自托管。

## 前置要求

- Docker Engine（含 `docker compose` 插件）。按官方指引安装：<https://docs.docker.com/get-docker/>。
- 仓库中的两个文件：`docker-compose.yml` 和 `.env.example`。如果只想运行、不
  从源码构建，仅需这两个文件——预构建镜像会自动从 GHCR 拉取。
- 一个 OpenAI 兼容的 API Key，用于 AI 功能（摘要 / 翻译 / 对话）。没有也能启动，
  但调用 AI 功能时会返回配置错误。

## 快速开始（预构建镜像）

每次推送到 `main` 分支或打版本 tag 时，会自动构建并发布多架构镜像
（`linux/amd64`、`linux/arm64`）到 GitHub Container Registry：

- `ghcr.io/maplumex/feedlyra-backend:latest`
- `ghcr.io/maplumex/feedlyra-frontend:latest`

`docker-compose.yml` 默认引用这些镜像，所以最简部署无需 clone 仓库——只要这两个文件：

```bash
# 下载这两个文件（或从仓库复制）：
#   docker-compose.yml  和  .env.example

# 1. 从模板生成配置
cp .env.example .env

# 2. 编辑 .env —— 至少修改以下几项（见下方「配置」）：
#    - SECRET_KEY
#    - POSTGRES_PASSWORD
#    - AI_DEFAULT_API_KEY

# 3. 拉取镜像并启动（无构建步骤）
docker compose up -d

# 4. 查看后端启动日志（会先跑迁移）
docker compose logs -f backend
#    看到 "Uvicorn running on http://0.0.0.0:8000" 即代表就绪。

# 5. 打开应用
#    http://localhost:${FRONTEND_PORT}   （默认 7756）
```

注册一个账号，添加一个 RSS 订阅，刷新，发起一次 AI 对话，即可端到端验证。

## 从源码构建（可选）

如果要修改 Dockerfile 或运行未发布的本地改动，使用
`docker-compose.build.yml` overlay 从源码构建：

```bash
cp .env.example .env
# 如上编辑 .env
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

两个服务的其余配置完全一致（网络、数据卷、环境变量、端口都相同），这个 overlay
只是把 `image:` 引用换成本地 `build:` 上下文。

## 配置

所有运行时配置位于根目录的 `.env` 文件（参见 `.env.example`）。Docker Compose
从中插值 `${VAR}`，backend 服务通过 `env_file` 注入整套文件。镜像构建过程不读取
`.env`，不会泄露密钥。

生产环境前必须修改：

| 变量 | 说明 |
|------|------|
| `SECRET_KEY` | 用于签发 JWT token，**同时**派生 Fernet 密钥加密用户 AI API Key。用强随机串，例如 `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`。 |
| `POSTGRES_PASSWORD` | 数据库密码，设一个强值。 |
| `AI_DEFAULT_API_KEY` | OpenAI 兼容 API Key，否则 AI 功能返回配置错误。 |

其他变量（默认值见 `.env.example`）：

| 变量 | 说明 |
|------|------|
| `POSTGRES_USER` / `POSTGRES_DB` | 数据库用户名与库名。 |
| `DATABASE_URL` | 由上面三项按 `db` 服务主机名自动拼接，通常保持不变。 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | JWT token 有效期。 |
| `CORS_ORIGINS` | 逗号分隔的允许来源。通过 nginx 同源，保留用于本地开发。 |
| `UPLOAD_DIR` | 上传聊天图片的容器路径，挂载在 `feedlyra_uploads` 数据卷上。如修改需同步 `docker-compose.yml`。 |
| `AI_DEFAULT_BASE_URL` / `AI_DEFAULT_MODEL` | OpenAI 兼容端点与默认模型。 |
| `FRONTEND_PORT` | 映射到 nginx 的主机端口。 |

> 运行后用户级的 AI 配置（覆盖 base URL / API key / 模型，以及按功能覆盖）保存在
> 数据库中，用 Fernet 静态加密（密钥由 `SECRET_KEY` 派生）。切勿丢失
> `SECRET_KEY`，否则这些值将无法解密。

## 架构

```
host :7756 -> frontend (nginx:alpine)
                提供 SPA，反向代理 /api/* -> backend:8000（SSE 不缓冲）
                                  |
                            backend (uv + python:3.12)
                                entrypoint: alembic upgrade head -> uvicorn
                                /app/uploads (数据卷)
                                /health 健康检查
                                  |
                            db (postgres:16-alpine)
                                /var/lib/postgresql/data (数据卷)
```

只有 `frontend` 服务暴露主机端口；`db` 和 `backend` 位于私有 `feedlyra-net`
桥接网络。两个命名数据卷持久化数据。

`backend` 暴露 `/health` 端点；`docker-compose.yml` 用它做健康检查，`frontend`
通过 `depends_on: backend.condition: service_healthy` 等后端就绪后再启动，避免
首访问就吃到 502。

## 停止

```bash
# 停止并移除容器——命名数据卷里的数据「保留」。
docker compose down

# 停止并「删除所有数据卷」（数据库 + 上传文件）——完全重置。
docker compose down -v
```

## 持久化 / 备份

执行 `docker compose down`（不带 `-v`）后所有数据保留：

- `feedlyra_pgdata` —— PostgreSQL 数据目录。
- `feedlyra_uploads` —— 上传的聊天图片。

用 `docker compose up -d`（镜像已存在则无需 `--build`）重启，账号、订阅、上传文件都还在。

数据库备份（可选、未自动化）。从运行中的 db 容器一条命令导出：

```bash
docker compose exec db pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > feedlyra-backup.sql
```

恢复：`docker compose exec -T db psql -U "${POSTGRES_USER}" "${POSTGRES_DB}" < feedlyra-backup.sql`。

上传文件备份：`docker run --rm -v feedlyra_uploads:/u -v "$PWD:/b" alpine tar czf /b/uploads-backup.tgz -C /u .`。

## 故障排查

### 7756 端口冲突

其他进程占用 `${FRONTEND_PORT}`（默认 7756）。在 `.env` 中设一个不同的端口：

```bash
FRONTEND_PORT=8181
```

然后 `docker compose up -d`。（nginx 始终监听容器内部 80 端口。）

### 迁移失败 / backend 不断重启

```bash
docker compose logs backend
```

查找 `running alembic upgrade head`。即使有健康检查，db 连接仍可能瞬时失败，
entrypoint 会重试 5 次后退出；`restart: unless-stopped` 会在容器层面持续重试。

检查 db 是否健康：

```bash
docker compose ps db
docker compose logs db
```

如果是迁移本身坏了（罕见），`docker compose down -v` 清空数据库从头来——仅在不
需要数据时这样做。

### SSE / AI 对话流在约 60 秒后被截断

这是 nginx 默认的 `proxy_read_timeout`。`frontend/nginx.conf` 已设置
`proxy_buffering off;` 和 `proxy_read_timeout 3600s;`。如果仍被截断，重新构建
frontend 镜像：

```bash
docker compose up -d --build frontend
```

（从源码构建时，或 `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build frontend`。）

### 卡住了——从零重建

⚠️ `down -v` 会删除数据库和所有上传图片，请先备份。

```bash
docker compose down -v
docker compose up -d
```

### 查看日志

```bash
docker compose logs -f           # 所有服务
docker compose logs -f backend   # 仅后端
```

## 升级

```bash
docker compose pull              # 拉取最新镜像
docker compose up -d             # 用新镜像重建容器
```

迁移会在后端启动时自动执行；数据库数据与上传文件在升级过程中保留。

## 不在范围内

TLS/HTTPS 终结、域名绑定、staging/prod 多环境参数化、Kubernetes、自动备份、资源
限制、非 root 用户加固等，有意不在本指南范围内。
