# Design: AI summary language follows UI language

## Architecture & Boundaries

改动分三层，跨 backend 和 frontend：

1. **Backend model + migration** — `ArticleSummary` 增加 `lang` 列；唯一约束从 `(article_id, source, model)` 改为 `(article_id, source, model, lang)`。
2. **Backend service** — `generate_summary` 接受 `target_lang`，调整 `SUMMARY_SYSTEM_PROMPT` 用目标语言输出；新增 i18n 码 → 英文语言名映射。
3. **Backend routers** —
   - `POST /api/ai/articles/{id}/summarize` 增加 `lang` query 参数，传入 `generate_summary`，写入/命中 `ArticleSummary.lang`。
   - `GET /api/articles` / `GET /api/articles/{id}` 增加 `lang` query 参数，summary 查询按 `lang` 过滤，避免多语言行在 dict 中互相覆盖。
4. **Frontend** — `useSummarize` / `useArticle` / `useArticles` 透传当前 i18n 语言（`i18next.language`：`zh-CN` / `en`）。

不在范围：`summarize_chat_history`、翻译功能、新增 UI 语言、用户可配置摘要目标语言。

## Data Flow

### 生成摘要（写入路径）

```
ArticleDetail.tsx
  └─ summarize.mutate({ articleId, source, lang: i18n.language })
       └─ useSummarize → POST /api/ai/articles/{id}/summarize?source=...&lang=zh-CN
            └─ summarize_article(article_id, source, lang)
                 ├─ 校验 source
                 ├─ content_hash = hash(content)
                 ├─ select ArticleSummary where (article_id, source, model, lang)
                 │   └─ 命中且 content_hash 相同 → 直接返回缓存
                 ├─ generate_summary(client, model, title, content, target_lang=lang)
                 │     └─ SUMMARY_SYSTEM_PROMPT 含 "Output in {english_lang_name}."
                 └─ upsert ArticleSummary (含 lang)
```

### 读取摘要（展示路径）

```
ArticleDetail.tsx
  └─ useArticle(articleId)  // 透传 i18n.language
       └─ GET /api/articles/{id}?lang=zh-CN
            └─ get_article(article_id, lang)
                 ├─ select ArticleSummary where (article_id, model, lang)  -- 加 lang 过滤
                 └─ _apply_summaries → summaries[source]  (单语言，无覆盖)

ArticleList (Home)
  └─ useArticles(...)  // 透传 i18n.language
       └─ GET /api/articles?...&lang=zh-CN
            └─ list_articles(..., lang)
                 └─ select ArticleSummary where (article_id IN ..., model, lang)
```

## Contracts

### `SUMMARY_SYSTEM_PROMPT`（修改 `backend/app/services/llm.py`）

将末尾规则：
> `- Use the same language as the article body. If ambiguous, use the title's language.`

改为（参数化）：
> `- Output the summary in {target_lang}.` 

其中 `target_lang` 为英文语言名（见映射表）。其余规则不动。

### 语言映射（新增，`backend/app/services/llm.py` 内）

```python
SUMMARY_LANG_NAMES = {
    "zh-CN": "Chinese (Simplified)",
    "en": "English",
}

def _summary_lang_name(lang: str) -> str:
    return SUMMARY_LANG_NAMES.get(lang, "English")
```

- 前端传 i18n 原始码（`zh-CN` / `en`）。
- 未知值兜底为 `English`（与 i18n `fallbackLng: "en"` 一致）。

### `generate_summary` 签名（`backend/app/services/llm.py`）

```python
async def generate_summary(
    client: AsyncOpenAI, model: str, title: str, content: str, target_lang: str = "en"
) -> str:
```

- system prompt 用 `_summary_lang_name(target_lang)` 拼接。
- 原文章语言规则被覆盖删除。

### `summarize_article` 端点（`backend/app/routers/ai.py`）

```python
@router.post("/articles/{article_id}/summarize", response_model=SummarizeResponse)
async def summarize_article(
    article_id: UUID,
    source: str = Query(default=SUMMARY_SOURCE_FEED),
    lang: str = Query(default="en"),
    ...
):
```

- `lang` 校验：必须是 `SUMMARY_LANG_NAMES` 的 key，否则 400（拒绝未知语言，避免静默兜底）。
- 缓存查询条件加 `ArticleSummary.lang == lang`。
- `ArticleSummary` insert 时写入 `lang`。
- `SummarizeResponse` 不变（前端已有 summary/model/source/content_hash）。

### 文章接口（`backend/app/routers/articles.py`）

`GET /api/articles/{id}` 和 `GET /api/articles` 都增加：
```python
lang: str = Query(default="en")
```
两边 `select(ArticleSummary).where(...)` 都加 `ArticleSummary.lang == lang`。

- 默认 `en` 保持向后兼容（无 lang 调用方仍能拿到 en 缓存）。
- `ArticleSummaryResponse` 不变。

### Frontend（`frontend/src/api/hooks.ts` + `ArticleDetail.tsx`）

- `useSummarize` mutationFn 参数加 `lang: string`，拼进 query string。
- `useArticle(articleId, lang?)` / `useArticles(params, lang?)` 把 `lang` 加进 query string。
  - 调用方 `ArticleDetail.tsx` 已有 `i18n.language`，透传即可。
  - Home / 其他列表调用点需同步透传 `i18n.language`。
- `ArticleDetail.tsx` 的 `summarize.mutate` 三处调用加 `lang: i18n.language`。

## Model / Migration

`backend/app/models/ai.py` `ArticleSummary`：
```python
lang: Mapped[str] = mapped_column(String(10), nullable=False)
__table_args__ = (
    UniqueConstraint("article_id", "source", "model", "lang", name="uq_article_summaries_article_source_model_lang"),
)
```

新 migration `019_article_summary_lang.py`（down_revision = `"018_feed_disabled"`）：
- `op.add_column("article_summaries", sa.Column("lang", sa.String(10), nullable=False, server_default="en"))`
  - 旧行无 lang，给个默认 `en` 保持非空约束可加列。
- `op.drop_constraint("uq_article_summaries_article_source_model", ...)` → `op.create_unique_constraint("uq_article_summaries_article_source_model_lang", ..., ["article_id","source","model","lang"])`
- downgrade 反向操作。

## Compatibility

- 旧 `ArticleSummary` 行通过 `server_default="en"` 被视为英文摘要。
- 旧前端调用（不传 lang）→ 后端默认 `en`，行为不变。
- 老 `ArticleAIData.summary` / `summary_model`（遗留字段）不在本任务范围，不动。
- 翻译功能 `translate_default_lang` / `ArticleAIData.translation_lang` 语义完全独立，不受影响。

## Trade-offs

- **migration `server_default="en"`**：旧行被标记为英文，切换到中文 UI 时旧 en 摘要不命中，会重新生成中文摘要（一次性 token 消耗），符合 R4。
- **未传 lang 兜底 en**：保护向后兼容；但实际前端都会传，不会触发兜底。
- **未知 lang 直接 400**（而非兜底 English）：避免静默生成错误语言摘要。

## Rollback

- 单个 migration 双向可逆（drop constraint → drop column）。
- 代码改动按文件可 revert。
- 无数据丢失风险（旧摘要保留）。
