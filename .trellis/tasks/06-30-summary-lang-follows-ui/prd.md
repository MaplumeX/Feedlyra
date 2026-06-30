# AI summary language follows UI language

## Goal

让 AI 生成的文章摘要输出语言跟随当前用户界面（i18n）语言，而非跟随文章正文语言。

## Background

- 现状 `backend/app/services/llm.py` 的 `SUMMARY_SYSTEM_PROMPT` 指示 LLM「使用与文章正文相同的语言；若不明确则用标题语言」。
- 前端 i18n（`frontend/src/i18n/index.ts`）仅支持 `en` 与 `zh-CN` 两种界面语言，通过 `i18next-browser-languagedetector` 从 localStorage（key `i18nextLng`）+ navigator 检测。
- 摘要接口 `POST /api/ai/articles/{article_id}/summarize?source=...`（`backend/app/routers/ai.py` `summarize_article`），前端通过 `useSummarize`（`frontend/src/api/hooks.ts`）调用，调用点在 `frontend/src/components/ArticleDetail.tsx`。
- 摘要缓存：`ArticleSummary` 表按 `(article_id, source, model)` 唯一约束 + `content_hash` 比对（`backend/app/models/ai.py` 第 34/40/43 行）。表上无语言列。
- 对比：翻译功能已有 `translate_default_lang`（用户级默认目标语言，默认 "zh"）和 per-feed `translate_target_lang` 覆盖，存在 `ArticleAIData.translation_lang`。

## Requirements

- R1 摘要接口接受目标语言参数（来自前端 UI 语言）。
- R2 `generate_summary` 用目标语言指令 LLM 输出，覆盖原「跟随文章正文语言」的规则。语言值用英文语言名表达：`zh-CN`→`Chinese (Simplified)`、`en`→`English`，映射在后端 `SUMMARY_LANG_NAMES`。
- R3 前端 `useSummarize` / `ArticleDetail.tsx` 调用时自动透传当前 i18n 语言（`zh-CN` / `en`）。
- R4 缓存语义按语言隔离：给 `ArticleSummary` 增加 `lang` 列（migration），唯一约束改为 `(article_id, source, model, lang)`，缓存查询条件加入 `lang`。切换 UI 语言后命中对应语言缓存；切回原语言仍命中旧缓存（不重复消耗 token）。
- R5 文章读取路径（`GET /api/articles` / `GET /api/articles/{id}`）按 `lang` 过滤 summary 行，避免方案 A 下同 source 多语言行在 `summaries[source]` dict 中互相覆盖；前端 `useArticle` / `useArticles` 透传 UI 语言，并把 `lang` 纳入 queryKey。

## Acceptance Criteria

- [ ] UI 为中文时，生成/查看的摘要为中文。
- [ ] 同一篇文章在 UI 为英文时，摘要为英文。
- [ ] 切换 UI 语言后重新请求摘要，能拿到新语言的摘要（而非旧缓存）。
- [ ] 不影响翻译功能已有的语言语义。

## Out of Scope

- 新增 UI 语言（仍只 en / zh-CN）。
- 用户可配置摘要目标语言（摘要语言直接等于 UI 语言，不单独提供设置项）。
- chat 历史摘要（`summarize_chat_history`）：它是内部给 LLM 的对话压缩上下文，跟随对话语言语义更正确，不在用户感知范围。
