# Implement Plan: AI summary language follows UI language

## Execution Checklist

### Backend — model + migration
- [ ] `backend/app/models/ai.py`：`ArticleSummary` 加 `lang: Mapped[str] = mapped_column(String(10), nullable=False)`；`UniqueConstraint` 改名为 `uq_article_summaries_article_source_model_lang`，列加 `lang`。
- [ ] 新建 `backend/alembic/versions/019_article_summary_lang.py`（down_revision=`"018_feed_disabled"`）：
  - upgrade: `add_column` + `server_default="en"`；`drop_constraint` 旧；`create_unique_constraint` 新。
  - downgrade: 反向。
  - 参考 `018_feed_disabled.py` 的结构风格。

### Backend — service 层
- [ ] `backend/app/services/llm.py`：
  - 新增 `SUMMARY_LANG_NAMES = {"zh-CN": "Chinese (Simplified)", "en": "English"}` 和 `_summary_lang_name(lang)`。
  - `SUMMARY_SYSTEM_PROMPT` 末尾规则改为 `- Output the summary in {target_lang}.`，用 `.format(target_lang=...)`。
  - `generate_summary` 签名加 `target_lang: str = "en"`，调用 prompt 时填入 `_summary_lang_name(target_lang)`。

### Backend — routers
- [ ] `backend/app/routers/ai.py` `summarize_article`：
  - 加 `lang: str = Query(default="en")`。
  - 校验 `lang in SUMMARY_LANG_NAMES`，否则 `HTTPException(400)`。
  - 缓存查询 `.where(..., ArticleSummary.lang == lang)`。
  - insert `ArticleSummary` 时设 `lang=lang`。
- [ ] `backend/app/routers/articles.py`：
  - `get_article` 加 `lang: str = Query(default="en")`；summary select 加 `ArticleSummary.lang == lang`。
  - `list_articles` 加 `lang: str = Query(default="en")`；summary select 加 `ArticleSummary.lang == lang`。

### Frontend
- [ ] `frontend/src/api/hooks.ts`：
  - `useSummarize` mutationFn 参数加 `lang: string`，拼进 `/summarize?source=...&lang=...`。
  - `useArticle(articleId, lang?)` 接受 lang，拼进 `/api/articles/{id}?lang=...`。
  - `useArticles(params, lang?)` 同理（确认其 query string 拼接方式后加 `&lang=...`）。
  - 调整对应 queryKey 是否需要含 lang：detail/list 缓存按语言隔离更正确（切语言应重新拉取），把 lang 纳入 queryKey。
- [ ] `frontend/src/components/ArticleDetail.tsx`：
  - `useArticle(selectedArticleId, i18n.language)`。
  - 三处 `summarize.mutate({...})` 加 `lang: i18n.language`。
- [ ] 其他调用 `useArticle` / `useArticles` 的位置（如 `Home.tsx`、可能的 CommandPalette 等）：透传 `i18n.language`。
- [ ] `frontend/src/api/types.ts`：`SummarizeResponse` 等类型无需改（后端响应不变）。

### Tests / Validation
- [ ] `backend/tests/test_article_summary.py`：补充 `generate_summary` 传入 `target_lang` 的单测（若 LLM 被 mock）。现有 extract_content 测试不动。
- [ ] 后端启动 + migration upgrade：`alembic upgrade head`。
- [ ] 前后端类型检查 + lint。

## Validation Commands

```bash
# Backend
cd backend && alembic upgrade head
cd backend && python -m pytest tests/test_article_summary.py -q
cd backend && ruff check app/   # 或项目实际 linter
cd backend && mypy app/          # 若有

# Frontend
cd frontend && tsc --noEmit
cd frontend && eslint src/       # 或项目实际
```

## Risky Points / Rollback

- **migration 加列**：`server_default="en"` 保证非空约束可加；rollback 为 drop column。
- **多语言行在 dict 覆盖**：list/detail 读取路径**必须**加 lang 过滤，否则方案 A 下同 source 多语言行会互相覆盖——这是本任务最易遗漏点，重点自查。
- **queryKey 是否含 lang**：若不含，切换 UI 语言后前端缓存仍返回旧语言摘要详情——把 lang 纳入 queryKey 触发重新拉取。
- **未知 lang 处理**：summarize 端点 400 拒绝；articles 端点不校验（兜底 en，避免列表页崩）。

## Review Gates

- [ ] design.md + implement.md 审阅通过后 `task.py start`。
- [ ] 实现后 run lint + typecheck + migration upgrade 全绿。
- [ ] 手测：中/英 UI 各生成一次摘要，切换不命中旧缓存。
