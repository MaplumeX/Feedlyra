# AI 检索能力升级与设置项清理

## Goal

让 AI 的文章检索能力从"单一关键词 ILIKE 匹配"升级为"按问题类型选择合适检索策略"的结构化能力，同时清理已不再需要的"自动检索相关文章"设置项（该开关本质是在控制 agent loop 工具是否暴露，但产品定位上 AI 拥有检索工具是默认能力，不需要用户开关）。

## Background

当前实现（Session 68 落地）：
- `agent_tools.py` 暴露两个工具给 LLM：`search_articles(query)`（jieba 分词 + ILIKE 匹配标题/摘要，最近 7 天 top 5）和 `read_article(article_id)`（拉取全文 ≤8000 字符）。
- `agent_loop.py` 在 agent loop 里最多 8 轮工具调用，`User.ai_cross_article_search` 开关控制工具是否暴露给模型（默认 True）。
- `retrieval._tokenize` 用 jieba 精确模式分词，`_score_and_rank` 按 token 命中数 + 时序排序。

问题：
1. "看看今天有什么文章"这类**时间/列表/计数型**问题，关键词检索语义错位——用户没给关键词，模型只能瞎猜关键词，命中靠运气。这类问题本质是结构化查询（按 published_at 过滤 + 排序 + limit）。
2. 设置项"自动检索相关文章"语义已失真：实际功能是"AI 是否拥有检索工具"，这是默认能力，不该是开关。

## Confirmed Facts

### ① 设置项清理面（repo 可查）
- 后端字段：`User.ai_cross_article_search`（`backend/app/models/user.py:34`，migration 015 新增，Boolean default true）。
- 后端 schema：`AIConfigUpdate.cross_article_search`、`AIConfigResponse.cross_article_search`（`backend/app/schemas/ai.py:108,126`）。
- 后端 router：`update_ai_config` 写入、`get_ai_config` 返回（`backend/app/routers/ai.py:121-122,136,152`）。
- 后端 agent loop 门控：`agent_loop.py:154`（`_prepare_messages` 里 `tools_enabled`）、`agent_loop.py:342`（`run_agent_chat` 里 `tools = TOOLS if ... else []`）、`_system_prompt(tools_enabled)` 分支。
- 前端：`api/types.ts:97`、`api/hooks.ts:598`、`AISettingsTab.tsx:224-232`（Switch）、i18n `en/zh-CN settings.json` 的 `crossArticleSearch/Description`。
- migration 015 是加列迁移；删列需新增 migration 017（016 是 head）。

### ② 检索能力现状（repo 可查）
- `retrieval.py`：候选集 = 用户最近 N 天文章 LEFT JOIN 缓存 feed 摘要，jieba 分词后 ILIKE `%token%` 匹配 title+summary，按命中数 DESC + 时序 DESC 排序，limit 5。
- `agent_tools._search_articles`：固定 7 天窗 + limit 5，返回 `{id, title, summary_snippet(200)}`。
- `agent_tools._read_article`：返回全文 ≤8000 字符，并写一条 `is_auto=True` 的 `ConversationReference`。
- Article 可用字段：title / url / content / full_content / content_snippet / image_url / author / published_at / fetched_at / created_at / is_initial_fetch。
- Feed 可用字段：title / site_url / description / category_id / auto_full_text / auto_translate。
- 额外表：`ReadStatus`（user_id+article_id+read_at）、`StarredArticle`、`ArticleSummary`（article_id+source+model+summary）、`ArticleAIData`（翻译缓存）。

## Requirements

### R1 删除"自动检索相关文章"设置项
- 删除 `User.ai_cross_article_search` 字段（migration 017 drop column）。
- 删除 schema/router 里 `cross_article_search` 的读写。
- agent loop 工具恒启用：删除 `tools_enabled` 门控，`tools` 恒为 `TOOLS`，系统提示恒为 with-tools 版本。
- 顺手清理自身造成的孤儿代码：删除 `_system_prompt(tools_enabled)` 分支与 `_AGENT_SYSTEM_PROMPT_NO_TOOLS` 常量，简化为单一 `_AGENT_SYSTEM_PROMPT`。
- 系统提示措辞同步补上 `list_articles`（R2 新增工具）。
- 删除前端 type/hook/Switch/i18n 条目。
- 保留 migration 015 历史，新增 migration 017 删列。
- R1 不改 `search_articles` 的既有 7 天窗 / limit 5 / 返回字段。

### R2 检索能力升级（MVP 方向已定：结构化筛选工具）
- 新增 `list_articles` 工具，与现有 `search_articles`（关键词检索）职责分离：模型按问题类型选工具。
- 解决「看看今天有什么文章」「最近3天未读的」「XX 订阅源的文章」这类时间/列表/计数/筛选型问题——这类问题本质是结构化查询（谓词过滤 + 排序 + limit），而非关键词匹配。
- 不在本任务纳入语义检索（pgvector/embedding），留作后续可叠加层。

## Acceptance Criteria

- [ ] ① 设置项删除完成：前后端无 `cross_article_search` / `crossArticleSearch` 功能残留（`rg` 验证），migration 017 删列且链路合法（016→017），agent loop 工具恒启用（`tools = TOOLS`、无 `tools_enabled` 门控、无 no-tools 系统提示分支），前端设置页无该 Switch。
- [ ] ② `list_articles` 工具就绪：schema 含 `days/feed_id/unread_only/limit` 四参数，返回 `{id,title,published_at,feed_title,summary_snippet}`，按 `published_at DESC` 排序；纯路由/错误路径单元测试覆盖（未知工具、缺失/无效 feed_id UUID、limit 边界）；DB 查询受 `Feed.user_id` scope 约束；系统提示采用三分工具（search/list/read）引导模型按问题类型选工具。
- [ ] 后端测试全绿（`uv run pytest`）：现有 retrieval 测试不动、agent_tools/agent_loop 测试随改动同步更新。
- [ ] 前端 `npm run build` + `lint` 绿。
- [ ] spec 沉淀：`backend/index.md` 与 `database-guidelines.md` 同步更新 agent-loop 条目（删门控描述、补 `list_articles` 契约）。

## Out of Scope

- 暂不引入 pgvector / embedding 语义检索（待 brainstorm 确认是否纳入）。
- 不改动 agent loop 的 SSE 协议与历史持久化结构（migration 016 已稳定）。

## Open Questions

（无）—— R1 执行边界与 R2 参数集均已收敛。
