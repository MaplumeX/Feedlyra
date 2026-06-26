# Design — AI 检索能力升级与设置项清理

## 范围

两块工作，同任务交付：

- **R1** 删除「自动检索相关文章」设置项（`User.ai_cross_article_search`），agent loop 工具恒启用。
- **R2** 新增结构化筛选工具 `list_articles`，与现有 `search_articles`（关键词检索）职责分离。

## 架构与数据流

### R2 工具契约

新增 `list_articles` 加入 `agent_tools.TOOLS`：

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `days` | int | 1 | 最近 N 天（相对时间，避免绝对日期/时区坑）|
| `feed_id` | string | 可选 | 指定订阅源；scope 仍受 `Feed.user_id = user_id` 约束 |
| `unread_only` | bool | false | 仅未读（LEFT JOIN `ReadStatus`，`read_at IS NULL`）|
| `limit` | int | 10 | 上限 30（防 context 爆炸）|

返回：`{id, title, published_at, feed_title, summary_snippet(200)}`，排序固定 `published_at DESC`。

### SQL 查询形态

复用 `retrieval.py` 已验证的 time-window 思路，但走纯结构化查询（无打分）：

```
select(Article, Feed.title)
  .join(Feed, Feed.id == Article.feed_id)
  .outerjoin(ReadStatus, (ReadStatus.article_id == Article.id) & (ReadStatus.user_id == user_id))
  .where(Feed.user_id == user_id)
  .where(coalesce(Article.published_at, Article.created_at) >= since)   # since = now - days
  [.where(Feed.id == feed_id)]          # 可选
  [.where(ReadStatus.read_at.is_(None)) # unread_only=True
      + 需要确保 LEFT JOIN 产出未读行；用 `ReadStatus.user_id IS NULL` 兜底避免已读同文多行问题]
  .order_by(coalesce(Article.published_at, Article.created_at).desc())
  .limit(limit)
```

**关键实现注意**：
- `published_at` 可空 → 用 `COALESCE(published_at, created_at)` 作 since 过滤和排序键，与 `retrieval.py` 一致，避免出现 None 导致排序错乱。
- `unread_only` 的 LEFT JOIN：一篇文章可能无 ReadStatus 行（未读）或有行（已读）。未读判定 = `ReadStatus.read_at IS NULL` 等价于「无对应行」。SQLAlchemy 写法：`outerjoin` 后 `where(ReadStatus.article_id.is_(None))`。这避免 article_summaries 那种多 model 累积导致重复行的同类坑——`ReadStatus` 主键是 `(user_id, article_id)`，每用户每文章至多一行，无重复风险。
- scope 必须以 `Feed.user_id = user_id` 约束，绝不信任模型传的 `feed_id` 裸值。

### 职责分离（工具选择引导）

系统提示更新为三分工具：

- `search_articles(query)` —— 用户给话题/关键词 → 关键词检索（7 天窗 top 5）。
- `list_articles(days/feed_id/unread_only/limit)` —— 时间/列表/筛选型问题（"今天有什么""最近3天未读的""XX 源的"）。
- `read_article(article_id)` —— 精读全文。

## R1 agent_loop 改动

- 删除 `_AGENT_SYSTEM_PROMPT_NO_TOOLS` 常量与 `_system_prompt(tools_enabled)` 函数，改为单一 `_AGENT_SYSTEM_PROMPT` 常量（with-tools 版本，已含三分工具描述）。
- `run_agent_chat`：`tools = TOOLS`（恒启用），删除 `getattr(user, "ai_cross_article_search", ...)` 门控。
- `_prepare_messages`：删除 `tools_enabled` 计算与传递，`messages` 头部直接用 `_AGENT_SYSTEM_PROMPT`。
- `_final_plain_round`（guard rail 触发时的无工具收尾轮）保持不动——它用 `stream_chat`（无 tools），是 rail 行为，与"工具恒启用"不冲突。

## R1 schema/router/model 改动

- `models/user.py`：删除 `ai_cross_article_search` 列定义。
- `schemas/ai.py`：`AIConfigUpdate.cross_article_search`、`AIConfigResponse.cross_article_search` 删除。
- `routers/ai.py`：`update_ai_config` 写入分支、`get_ai_config`/`get_ai_config` 返回字段删除（两处 dict）。
- migration 017：`op.drop_column("users", "ai_cross_article_search")`，`down_revision="016"`。

## R1 前端改动

- `api/types.ts`：`cross_article_search` 字段删。
- `api/hooks.ts`：`updateConfig` 的 `cross_article_search?` 删。
- `AISettingsTab.tsx`：删整个 Switch 块（含 Label/Description/checked/onCheckedChange）。
- i18n `en/zh-CN settings.json`：删 `crossArticleSearch` + `crossArticleSearchDescription` 两条。

## 兼容性 / 迁移

- migration 017 drop column：已部署实例的存量 `true` 值随列删除消失，无数据迁移需求（开关本身语义已失真，删除即正解）。
- 015 迁移历史保留（不动），链路 014→015→016→017。
- 前端旧版缓存：`AIConfigResponse` 少一个字段，Pydantic 仍可序列化；前端 hook type 同步删，无运行时风险。

## 测试调整

### 现有测试需改
- `test_agent_tools.py::TestToolSchema::test_two_tools_exposed` —— 断言由 `{search_articles, read_article}` 改为三分工具集。
- `test_agent_loop.py::TestSystemPrompt` —— `test_tools_enabled_mentions_search_tool` / `test_tools_disabled_does_not_mention_tools` 随 `_system_prompt` 简化重写：单一常量断言含三分工具名，删 no-tools 分支测试。
- `retrieval.py` 无逻辑改动，`test_retrieval.py` 不动。

### 新增测试
- `test_agent_tools.py` 扩展：
  - `_list_articles` 各参数组合的纯路由测试（missing/无效 feed_id UUID、limit 边界）。
  - schema 形状测试：`list_articles` 参数集与 required。
- 如需 DB 集成测试：参照现有 agent_tools 测试以纯路由/错误路径为主（现有测试也规避了 DB），保持一致。DB 行为靠静态审查 + 手测。

## 关键 trade-off

- `days` 相对天数而非绝对日期：模型传日期易错、时区坑多；相对天数贴合"今天/最近"语义。代价：无法表达"上周一到周三"这类绝对区间——留后续。
- 不纳入 `category_id/starred_only/author`：避免过度工程，`feed_id` + `unread_only` 已覆盖绝大多数列表型场景。
- 不引入 pgvector/embedding：本任务聚焦结构化方向，语义检索是后续可叠加层。

## 回滚

- 若 `list_articles` 出问题：从 `TOOLS` 移除即可降级（工具不存在模型自然不会调），不影响其它路径。
- migration 017 downgrade 重建列（默认 true），agent_loop 门控已删——回滚代码需同时回滚 agent_loop 改动。
