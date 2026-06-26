# Implement — AI 检索能力升级与设置项清理

## 执行顺序

先做 R2（新增工具，新增功能可独立验证），再做 R1（删除设置项 + 工具恒启用），最后前端清理与迁移。这样每步可单独测试。

### 步骤 1：实现 `list_articles` 工具（R2）
- [ ] `agent_tools.py`：新增常量 `_LIST_DEFAULT_LIMIT=10`、`_LIST_MAX_LIMIT=30`、`_LIST_DEFAULT_DAYS=1`。
- [ ] 在 `TOOLS` 数组追加 `list_articles` schema（参数 `days/feed_id/unread_only/limit`，描述中文，action-oriented，与现有工具描述风格一致）。
- [ ] 实现 `_list_articles(args, *, user_id, db)`：按 design 的 SQL 形态查询，返回 `{id,title,published_at,feed_title,summary_snippet}`。
- [ ] `execute_tool` 分派新增 `list_articles` 分支：参数校验（days<1→1、limit<1→10/>30→30、feed_id UUID 解析失败→error content）。
- [ ] schema 形状测试：`test_agent_tools.py::TestToolSchema::test_two_tools_exposed` → 三工具集断言；新增 `list_articles` 参数 required 断言。

### 步骤 2：agent loop 工具恒启用 + 系统提示更新（R1 后端）
- [ ] `agent_loop.py`：删 `_AGENT_SYSTEM_PROMPT_NO_TOOLS` + `_system_prompt(tools_enabled)`，改为单一 `_AGENT_SYSTEM_PROMPT` 常量（含 search/list/read 三工具引导）。
- [ ] `run_agent_chat`：`tools = TOOLS`（删 `getattr(...ai_cross_article_search...)`）。
- [ ] `_prepare_messages`：删 `tools_enabled`，头部直接用 `_AGENT_SYSTEM_PROMPT`。
- [ ] `test_agent_loop.py::TestSystemPrompt` 重写：单一常量断言含三分工具名，删 no-tools 分支测试。

### 步骤 3：删除设置项后端字段/schema/router（R1 后端）
- [ ] `models/user.py`：删 `ai_cross_article_search` 列。
- [ ] `schemas/ai.py`：删 `AIConfigUpdate.cross_article_search` + `AIConfigResponse.cross_article_search`。
- [ ] `routers/ai.py`：删 `update_ai_config` 写入分支、两处返回 dict 的 `cross_article_search` 字段。
- [ ] 新增 `alembic/versions/017_drop_ai_cross_article_search.py`：`down_revision="016"`，`op.drop_column("users","ai_cross_article_search")`。

### 步骤 4：前端清理（R1 前端）
- [ ] `api/types.ts`：删 `cross_article_search` 字段。
- [ ] `api/hooks.ts`：删 `cross_article_search?`。
- [ ] `AISettingsTab.tsx`：删整个 Switch 块。
- [ ] i18n en/zh-CN `settings.json`：删 `crossArticleSearch` + `crossArticleSearchDescription`。

### 步骤 5：测试与验证
- [ ] `cd backend && uv run pytest` 全绿（含新增 list_articles 路由测试 + 调整后的 schema/prompt 测试）。
- [ ] 前端 `npm run build` + `lint` 绿。
- [ ] 静态审查：`rg "cross_article_search|crossArticleSearch|cross-article|ai_cross_article_search" backend frontend` 应无残留（migration 015 历史 + 注释除外，确认无功能残留）。

### 步骤 6：spec 沉淀
- [ ] 更新 `.trellis/spec/backend/index.md`「Cross-article chat as an agent loop」条目：删除 `ai_cross_article_search` 门控描述，补 `list_articles` 工具与职责分离契约。
- [ ] 更新 `.trellis/spec/backend/database-guidelines.md` 对应 Scenario（如有 agent-loop scenario 提到工具列表）。

## 验证命令

```bash
# 后端测试
cd backend && uv run pytest

# 前端
cd frontend && npm run build && npm run lint

# 残留检查
rg -n "cross_article_search|crossArticleSearch|cross-article|ai_cross_article_search" backend/ frontend/
```

## 风险点 / 回滚

- **agent_loop 测试重写**：`TestSystemPrompt` 有两个测试用例绑定 `tools_enabled` 形参；删函数后这两个用例必编译失败，是预期内的强制修改——别遗漏。
- **migration 017**：drop column 不可逆（除非 downgrade 重建）。生产前确认无其它代码读该字段（本任务已覆盖 backend 全部读点）。
- **`list_articles` 的 unread_only LEFT JOIN**：注意用 `ReadStatus.article_id.is_(None)` 表达「无对应行」，别写成 `read_at IS NULL` 在 inner join 语境（会丢未读文章）。design 已注明。
- 回滚：`list_articles` 出问题可单独从 `TOOLS` 移除降级；R1 删除面回滚需配合 migration 017 downgrade + 代码回滚。
