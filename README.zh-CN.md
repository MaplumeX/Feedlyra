# Feedlyra

一个自带 AI 能力的自托管 RSS 阅读器 —— 使用任意 OpenAI 兼容的大语言模型来摘要、翻译和对话你的文章。

[English](./README.md)

## 功能特性

### 订阅源管理
- 通过 URL 订阅 RSS/Atom 订阅源
- 从任意网站自动发现订阅源 URL
- OPML 导入与导出（自动创建分类）
- 自动定时刷新订阅源（每 5 分钟）
- 使用 `ETag` / `If-Modified-Since` 的条件 HTTP 请求
- 订阅源解析失败时指数退避
- 单独订阅源设置：标题、分类、自动全文提取
- 订阅源图标 / 网站图标自动发现

### 文章阅读
- 虚拟化无限滚动文章列表
- 使用 DOMPurify 进行 HTML 净化
- 全文内容提取（trafilatura + readability-lxml）
- 图片灯箱、自动生成目录
- 已读/未读追踪，收藏/星标文章
- 基于滚动的批量标记已读
- 自动刷新时的"新文章"提示条

### 阅读器自定义
- 字体（7 种含中文字体）、字号、行高、间距、内容宽度
- 所有设置持久化到 localStorage

### AI 功能（自带 API Key）
- 按功能独立配置 AI（摘要、翻译、对话均可设置独立的 API Key / URL / 模型）
- API Key 静态加密存储（Fernet）
- **AI 摘要** — 生成精简段落摘要（<100 字），按内容哈希缓存
- **AI 翻译** — 使用 XML 标签结构化提示翻译标题与正文
- **AI 对话** — 流式 SSE 对话，带文章上下文，历史摘要，消息编辑与重新生成，中途停止生成
- 打开文章时自动摘要

### UI / UX
- 三栏可调整宽度布局（侧边栏 → 文章列表 → 文章详情）+ 可选 AI 对话面板
- 侧边栏虚拟文件夹：全部订阅、未读、星标（实时计数）
- 命令面板（`Ctrl`+`K` / `Cmd`+`K`）
- 键盘快捷键：`j`/`k` 导航，`s` 星标，`m` 切换已读，`r` 刷新，`1`/`2`/`3` 筛选，`Shift`+`S` 侧边栏，`Shift`+`A` 全部标记已读
- 深色 / 浅色 / 跟随系统主题
- 国际化：英语 + 简体中文

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端 | React 19, TypeScript, Vite 6, TanStack React Query 5, Zustand 5, shadcn/ui, Tailwind CSS 3, react-virtuoso, react-resizable-panels, i18next |
| 后端 | Python 3.12+, FastAPI, SQLAlchemy 2 (async), asyncpg, Alembic, Pydantic 2, OpenAI Python SDK |
| 数据库 | PostgreSQL |
| 认证 | JWT（access + refresh token），bcrypt |

## 快速开始

### 前置要求
- Python 3.12+
- Node.js 20+
- PostgreSQL
- [uv](https://docs.astral.sh/uv/)（Python 包管理器）

### 后端设置

```bash
cd backend

# 创建并配置环境变量
cp .env.example .env
# 编辑 .env — 详见下方配置说明

# 安装依赖
uv sync

# 运行数据库迁移
alembic upgrade head

# 启动服务器
uvicorn app.main:app --reload
```

### 前端设置

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

应用将在 `http://localhost:5173` 可用。

### 生产构建

```bash
cd frontend
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览生产构建
```

## 配置

### 后端 — 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/feedlyra` | PostgreSQL 异步连接字符串 |
| `SECRET_KEY` | `change-me-to-a-random-secret-in-production` | JWT 签名与 Fernet 密钥派生（**生产环境必须修改**） |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Access token 有效期（分钟） |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token 有效期（天） |
| `CORS_ORIGINS` | `http://localhost:5173` | 逗号分隔的允许来源 |
| `AI_DEFAULT_BASE_URL` | `https://api.openai.com/v1` | 默认 OpenAI 兼容 API 基础 URL |
| `AI_DEFAULT_API_KEY` | *（空）* | 服务器级默认 API Key |
| `AI_DEFAULT_MODEL` | `gpt-4o-mini` | 默认 LLM 模型 |

### 前端 — 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `VITE_API_URL` | `http://localhost:8000` | 后端 API 基础 URL |

## 项目结构

```
Feedlyra/
├── backend/
│   ├── alembic/           # 数据库迁移
│   ├── app/
│   │   ├── main.py        # FastAPI 应用（生命周期，定时刷新）
│   │   ├── config.py      # 配置（环境变量）
│   │   ├── database.py    # 异步引擎与会话
│   │   ├── models/        # SQLAlchemy 模型
│   │   ├── routers/       # API 端点（auth, feeds, articles, categories, ai）
│   │   ├── schemas/       # Pydantic 模式
│   │   └── services/      # 业务逻辑（订阅源获取, LLM, 认证, 摘要）
│   └── pyproject.toml
└── frontend/
    ├── src/
    │   ├── api/           # API 客户端，React Query hooks，类型
    │   ├── components/    # UI 组件（侧边栏, 文章列表/详情, AI 对话, 设置）
    │   ├── hooks/         # 键盘快捷键
    │   ├── i18n/          # i18next 语言包（en, zh-CN）
    │   ├── pages/         # 路由页面（首页, 登录, 注册）
    │   └── stores/        # Zustand 状态（auth, reader）
    └── package.json
```

## 许可证

MIT
