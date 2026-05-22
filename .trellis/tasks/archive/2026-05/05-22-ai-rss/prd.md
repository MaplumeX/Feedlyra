# AI加持的RSS阅读器 — Feedlyra

## Goal

构建一款AI增强的RSS阅读器，核心差异化在于AI能力——智能摘要、多语言翻译、AI对话/问答，帮助用户高效消费多语言信源。前端采用 TypeScript + React + shadcn/ui 技术栈。

## Requirements

### 核心功能
* RSS源管理：手动添加URL + OPML导入/导出
* 文章阅读：3栏桌面布局，虚拟滚动，键盘导航
* AI智能摘要：文章入库时异步后台生成摘要，结果缓存到DB
* AI多语言翻译：一键翻译，按需触发+持久缓存
* AI对话/问答：针对单篇文章全文注入context进行对话，SSE流式响应
* 收藏/稍后阅读 + 已读/未读状态
* 用户认证：注册/登录 + JWT，云端数据 + 多设备同步

### 技术栈
* 前端：TypeScript + React + shadcn/ui + Tailwind CSS
* 后端：Python + FastAPI
* 数据库：PostgreSQL（pg_trgm全文搜索）
* AI：OpenAI兼容API + BYOK模式

## Research References

* [`research/ai-llm-integration.md`](research/ai-llm-integration.md) — LLM API选型、摘要/翻译/对话实现模式、SSE流式、成本估算
* [`research/rss-parsing.md`](research/rss-parsing.md) — feedparser + httpx异步模式、trafilatura全文提取、Miniflux架构参考
* [`research/frontend-architecture.md`](research/frontend-architecture.md) — 3栏布局、shadcn/ui组件、状态管理、虚拟滚动、快捷键、SSE推送

## Research Notes

### AI/LLM集成

* 摘要：后台异步任务（文章入库触发），用轻量模型(GPT-4o-mini/Claude Haiku)，结果持久化到article_ai_data表
* 翻译：按需触发，持久缓存(按article_id+lang+model)，DeepSeek中文翻译优势明显
* 对话：单文章全文注入context（无需向量DB），SSE流式输出，聊天历史存chat_messages表
* LLM Provider抽象层：支持OpenAI/Anthropic/Ollama，用户可自带API Key(BYOK)
* 流式响应：SSE是行业标配，FastAPI StreamingResponse原生支持

### RSS解析

* feedparser 6.0.12：唯一成熟Python RSS解析库，需httpx异步抓取+feedparser解析content的组合模式
* trafilatura 2.0.0：学术评测最优全文提取库，同样需httpx异步+同步提取
* 定时抓取：MVP用FastAPI lifespan内asyncio周期任务，后续可升级arq(Redis异步队列)
* 错误处理：参考Miniflux的ParsingErrorCount+指数退避模式
* HTTP缓存：ETag/Last-Modified避免重复下载

### 前端架构

* 布局：3栏(ResizablePanelGroup)，侧边栏可折叠，支持article-only阅读模式
* 状态管理：TanStack Query v5(服务端状态) + Zustand(客户端UI状态)
* 虚拟滚动：react-virtuoso(内置无限滚动、日期分组、followOutput新文章追踪)
* 快捷键：react-hotkeys-hook + shadcn/ui Command(Cmd+K命令面板)
* 实时更新：MVP用TanStack Query轮询，后续升级SSE推送

### Feasible approaches here

**Approach A: OpenAI兼容API + BYOK** (Recommended)
* 只实现OpenAI兼容API（使用openai Python SDK），用户配置base_url+api_key+model
* 自动兼容：OpenAI、Ollama、DeepSeek、Groq、Together AI等所有OpenAI兼容Provider
* 服务端零边际AI成本，一个实现覆盖所有Provider
* 用户无需感知"Provider"概念，只需填endpoint和key

**Approach B: 多Provider抽象层 + BYOK**
* 为OpenAI/Anthropic/Ollama分别实现Provider接口
* 灵活但实现复杂度3x，Anthropic用独立SDK(claude-sdk)
* 仅在需要Anthropic特有功能(如200K context)时有优势

## Acceptance Criteria

* [ ] 用户可以添加和管理RSS订阅源（手动添加URL + OPML导入/导出）
* [ ] 用户可以阅读RSS文章内容（3栏布局，虚拟滚动）
* [ ] AI智能摘要可用——文章入库后自动生成摘要，列表/详情可查看
* [ ] AI翻译可用——外文文章可一键翻译，结果缓存
* [ ] AI对话可用——SSE流式对话，针对文章内容追问
* [ ] 用户可注册/登录（JWT），数据云端存储
* [ ] 文章收藏/稍后阅读可用
* [ ] 已读/未读状态跟踪，多设备同步
* [ ] 键盘快捷键可用（j/k导航, s收藏, m已读切换, Cmd+K命令面板）
* [ ] 界面使用 shadcn/ui 组件风格一致

## Definition of Done

* 后端API有单元测试覆盖核心逻辑
* 前端组件有单元测试覆盖核心逻辑
* TypeScript 类型检查通过
* Python type hints + mypy检查通过
* Lint 无错误
* 核心用户流程可走通

## Out of Scope (explicit)

* AI分类/推荐（二期功能，数据模型预留标签和阅读行为记录）
* RSS源搜索发现/自动发现
* 浏览器扩展一键订阅
* 移动端适配
* 社交分享
* 多文章跨Feed RAG问答（二期，需pgvector）

## Technical Approach

### 后端架构
* **框架**: FastAPI + SQLAlchemy 2.0 (async) + Alembic迁移
* **RSS**: httpx(async抓取) + feedparser(解析) + trafilatura(全文提取)
* **AI**: OpenAI兼容API(openai SDK)，BYOK模式，用户配置base_url+api_key+model即可切换任意兼容Provider
* **认证**: JWT (access + refresh token)，bcrypt密码哈希
* **任务调度**: FastAPI lifespan内asyncio周期任务(MVP)
* **API风格**: RESTful，SSE用于AI对话流式输出
* **数据库**: PostgreSQL，SQLAlchemy 2.0 async engine

### 前端架构
* **构建**: Vite
* **路由**: React Router v7
* **布局**: shadcn/ui ResizablePanelGroup 3栏布局
* **状态**: TanStack Query v5(服务端) + Zustand(客户端UI)
* **虚拟滚动**: react-virtuoso
* **快捷键**: react-hotkeys-hook + shadcn/ui Command
* **表单**: React Hook Form + Zod
* **实时更新**: MVP轮询，后续SSE

### 数据库核心表
* users, feeds, articles, article_ai_data, article_chats, chat_messages
* read_status, starred_articles

## Decision (ADR-lite)

**Context**: 需要决定AI功能的服务模式和Provider支持范围
**Decision**: 采用OpenAI兼容API + BYOK模式，用户配置base_url+api_key+model
**Consequences**: 一个实现覆盖OpenAI/Ollama/DeepSeek/Groq等所有兼容Provider；服务端零边际AI成本；用户需自行配置endpoint；无法使用Anthropic Claude SDK特有功能(如200K context)，但Claude可通过OpenAI兼容网关接入

## Technical Notes

* 全新项目，无遗留代码约束
* shadcn/ui 基于 Radix UI + Tailwind CSS
* feedparser/trafilatura均为同步库，FastAPI中需httpx异步抓取+同步解析
* AI对话场景单文章全文注入context即可，无需向量DB
* 参考 Follow(follow-is/follow) 的AI Actions模式
* OpenAI兼容API覆盖OpenAI/Ollama/DeepSeek/Groq/Together AI等，用户配置base_url+api_key+model
