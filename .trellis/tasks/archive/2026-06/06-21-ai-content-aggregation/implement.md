# 实施计划 — AI 内容聚合(MVP:跨文章问答自动检索)

> 关联: `prd.md` / `design.md`
> 复杂任务:本文件 + PRD + design 三者齐备后方可 `task.py start`。

## 写代码前的强制阅读(spec)

实施前先读以下 spec 层约定(避免风格不一致返工):

- `.trellis/spec/backend/index.md` — backend 总约定(文件头 `from __future__ import annotations`、`Mapped[]` 风格、async-first、tests 规范、无 repository pattern、无 lint/CI)
- `.trellis/spec/backend/database-guidelines.md` — ORM/查询/迁移
- `.trellis/spec/backend/error-handling.md` — 异常策略(本任务自动检索异常须降级吞掉)
- `.trellis/spec/backend/directory-structure.md` — 新 `services/retrieval.py` 放置位置
- `.trellis/spec/frontend/` 下相关 — 仅涉及 `AISettingsTab.tsx`、`api/types.ts`、`api/hooks.ts`,改动极小

## 有序实施清单

### 阶段 A:后端检索服务(纯函数,可单测,先做)

1. **新建 `backend/app/services/retrieval.py`**
   - 文件头 `from __future__ import annotations`
   - 定义 `STOPWORDS`(中英常用约 15-20 词,如 {"的","了","是","在","the","a","of","and","to","is"} 等)
   - 实现 `_tokenize(query: str) -> list[str]`:`re.findall(r"[A-Za-z0-9]{2,}|[\u4e00-\u9fff]{2,}", query)` 后过滤停用词
   - 实现 `async def retrieve_relevant_articles(db, *, user_id, query, since=None, days=7, limit=5) -> list[Article]`:
     - 候选集 SQL(`Article JOIN Feed LEFT JOIN ArticleSummary` on `source='feed'`),where `Feed.user_id` + `COALESCE(published_at, created_at) >= since`
     - 拉到 Python 后用 `_tokenize` 结果做 `in hay` 计数,过滤 0 命中
     - 按 `(hits DESC, published_at DESC)` 排序取 top-K
     - `since` 默认 `now - timedelta(days=days)`
   - 返回 `list[Article]`(不分页)
2. **新建 `backend/tests/test_retrieval.py`**
   - 参照 `tests/test_automation.py` 风格:用 `Article` 实例做纯逻辑测试(可单测 tokenizing/scoring)
   - 覆盖:
     - 中英混合 query 的 token 化
     - 命中数排序(同 hits 看时间倒序)
     - 跨时间窗过滤(7 天边界:第 6 天命中、第 8 天排除)
     - `created_at` fallback(`published_at is None` 时用 `created_at`)
     - 空/无命中返回 `[]`
   - 运行:`cd backend && uv run pytest tests/test_retrieval.py -v`

### 阶段 B:User 字段 + 迁移

3. **`backend/app/models/user.py`**:加 `ai_cross_article_search` 字段(详见 design)
4. **`backend/alembic/versions/015_cross_article_search.py`**:`down_revision = "014"`,`upgrade` 加列(server_default="true", nullable=False),`downgrade` drop
5. **跑迁移**:`cd backend && alembic upgrade head`,确认表头出现新列
6. **回滚验证**(可选,确保可逆):`alembic downgrade -1 && alembic upgrade head`

### 阶段 C:Schema + Router Config

7. **`backend/app/schemas/ai.py`**:
   - `AIConfigUpdate`:加 `cross_article_search: bool | None = None`
   - `AIConfigResponse`:加 `cross_article_search: bool = True`
8. **`backend/app/routers/ai.py`**:
   - `update_ai_config`:加 `if body.cross_article_search is not None: user.ai_cross_article_search = body.cross_article_search`
   - `get_ai_config`:返回字典加 `"cross_article_search": user.ai_cross_article_search`

### 阶段 D:接入对话流

9. **`backend/app/routers/ai.py::_do_conversation_chat`**:在"Get all referenced articles"之前插入自动检索(见 design 模块 3 的代码片段)
   - import `retrieve_relevant_articles`、`timedelta`、`datetime` 已存在
   - 触发判定:`existing_refs_count == 0 and user.ai_cross_article_search`
   - `try/except` 包裹,失败只 `logger.exception`,不抛
   - 插入后 `await db.flush()` 让后续现有查询读到(保留 commit 给现有逻辑)
   - 命中 0 篇:不插入,正常走空 refs 分支

### 阶段 E:前端最小改动

10. **`frontend/src/api/types.ts`**:
    - `AIConfig` 接口加 `cross_article_search: boolean`
    - `AIConfigUpdate` 类型加 `cross_article_search?: boolean`
11. **`frontend/src/components/settings/AISettingsTab.tsx`**:加 `<Switch>` 绑定 `cross_article_search`,走现有 `updateAIConfig` mutation(参考同文件里 `translate_default_lang` 的处理方式)
12. **`frontend/src/i18n/`**(若 i18n 用了):
    - `en`/`zh-CN` 加 `crossArticleSearch` 标签文案("Auto-retrieve related articles" / "自动检索相关文章")

### 阶段 F:端到端验证

13. 前后端跑起来,按 PRD 验收标准 1/2/3 手测三场景
14. 回归:`cd backend && uv run pytest`(全量)
15. 前端类型/构建:`cd frontend && npm run build`(`tsc -b && vite build`)
16. 前端 lint:`cd frontend && npm run lint`

## 验证命令汇总

| 项 | 命令 | 期望 |
|---|---|---|
| 检索单测 | `cd backend && uv run pytest tests/test_retrieval.py -v` | 全过 |
| 后端全量测试 | `cd backend && uv run pytest` | 全过,无回归 |
| 迁移 | `cd backend && alembic upgrade head` | 成功 |
| 前端类型+构建 | `cd frontend && npm run build` | 成功 |
| 前端 lint | `cd frontend && npm run lint` | 无 error |

## 风险点 & 回滚点

| 风险 | 缓解 |
|---|---|
| 自动检索异常打断 chat | `try/except` 吞掉,只日志,降级走空 refs |
| `_do_conversation_chat` 改动影响现有 chat 流 | 仅在"refs 为空"分支插入,有 ref 用户路径不变;全量 pytest 验证 |
| 迁移在生产用户表加列锁表 | `server_default="true"` 让旧行立即可用;PG `ADD COLUMN ... DEFAULT` 自 PG 11 起不重写整表 |
| 检索召回 0 篇 → 退化单篇/无 ref chat | 检索函数返回空列表时,跳过插入,不影响主流程 |
| 自动加入的 ref 用户不想见 | 现有 chip UI 已标 `is_auto`;用户可手动 remove(现有 `useRemoveConversationReference`) |

回滚:`alembic downgrade -1` 移除字段;代码 revert 三处改动(retrieval.py 删除、router 还原、前端 types+tab 还原)。

## 实施前最后检查

- [ ] spec 已读
- [ ] `task.py start` 前,确认 `prd.md` / `design.md` / `implement.md` 三者已审阅
- [ ] 确认当前 git 分支干净(本任务规划产物外无其他改动)
- [ ] DB 可用(`alembic current` 能跑)
