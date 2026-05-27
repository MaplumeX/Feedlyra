# 按内容来源区分 AI 摘要缓存

## Goal

让 AI 摘要跟文章当前内容来源绑定：Feed 原文视图展示基于 Feed 内容生成的摘要，全文视图展示基于提取全文生成的摘要。获取全文后，用户可以生成/查看全文摘要，而不会被获取全文前的旧摘要缓存挡住。

## What I already know

* 用户选择“推荐方案”：摘要按内容来源绑定，而不是只清空旧摘要或单纯强制刷新。
* 用户确认历史已有摘要统一迁移为 `feed` 来源；旧数据无法可靠判断是否基于全文。
* 文章有两种可切换内容来源：`content` 和 `full_content`。
* `Article.readable_content` 当前优先使用 `full_content or content or content_snippet`，会让摘要输入隐式变成“最佳可读内容”。
* 当前摘要接口只按 `article_id + model` 缓存；已有同模型摘要时直接返回旧摘要。
* 获取全文接口只写 `article.full_content`，不会触发摘要重算或清空摘要。
* 前端当前只有一个 `summary` / `summary_model` 展示位，摘要按钮不携带内容来源。

## Assumptions

* MVP 只支持两种摘要来源：`feed` 和 `full`。
* `feed` 摘要基于 `article.content`，缺失时回退 `content_snippet`。
* `full` 摘要只在 `article.full_content` 存在时可生成，基于 `article.full_content`。
* 获取全文只是增加可用内容来源，不应覆盖已有 Feed 摘要。
* 翻译和 AI 聊天暂不纳入本任务，保持现有行为。

## Requirements

* 后端摘要接口必须显式接收内容来源参数，例如 `source=feed|full`。
* 摘要缓存必须至少按 `article_id + model + source` 区分。
* 缓存还必须记录内容 hash；当同来源内容变化时，应重新生成摘要。
* 后端响应文章详情和列表时，要能返回不同来源的摘要数据，供前端按当前视图选择。
* 前端在 Feed 内容视图展示/生成 `feed` 摘要。
* 前端在全文视图展示/生成 `full` 摘要。
* 如果全文尚未提取，前端不应请求 `full` 摘要。
* 获取全文成功并切换到全文视图后，摘要区域应反映全文来源：没有全文摘要就显示可生成状态/点击摘要按钮生成，而不是继续误展示 Feed 摘要。
* 自动摘要只对当前可用的默认 Feed 内容执行，不自动消耗额外模型调用生成全文摘要。

## Acceptance Criteria

* [ ] 已有 Feed 摘要的文章，提取全文后切到全文视图，不再把 Feed 摘要当成全文摘要展示。
* [ ] 在全文视图点击 AI 摘要，会基于 `full_content` 生成并缓存全文摘要。
* [ ] 切回 Feed 内容视图后，展示 Feed 摘要；切回全文视图后，展示全文摘要。
* [ ] 同一模型、同一来源、同一内容 hash 的摘要请求命中缓存，不重复调用 LLM。
* [ ] 同一模型但不同来源的摘要互不覆盖。
* [ ] 文章详情和列表接口的类型与前端 TypeScript 类型一致。
* [ ] 后端迁移兼容已有 `article_ai_data.summary` 数据。

## Proposed Technical Design

* 新建 `article_summaries` 表，字段建议：
  * `id`
  * `article_id`
  * `source` (`feed` / `full`)
  * `content_hash`
  * `summary`
  * `model`
  * `created_at`
* 唯一约束建议：`article_id + source + model`。
* 保留 `article_ai_data` 用于现有翻译字段；历史 `summary` 数据统一迁移为 `article_summaries(source='feed')`，后续读取优先走新表。
* 后端增加内容来源解析 helper，避免继续用 `readable_content` 做摘要输入。
* 前端 `Article` 类型从单个 `summary` 扩展为按来源的摘要对象，组件按 `showFullContent` 选择当前摘要。

## Out of Scope

* 不改翻译缓存模型。
* 不改 AI 聊天上下文来源选择。
* 不做批量后台重新生成历史全文摘要。
* 不删除旧 `article_ai_data.summary` 字段，避免扩大迁移风险。

## Technical Notes

* 现有摘要缓存短路在 `backend/app/routers/ai.py`。
* 现有全文提取接口在 `backend/app/routers/articles.py`。
* 现有文章响应 schema 在 `backend/app/schemas/article.py`。
* 现有前端摘要触发和展示在 `frontend/src/components/ArticleDetail.tsx`。
* 现有前端 API hook 在 `frontend/src/api/hooks.ts`。

## Definition of Done

* 后端迁移、模型、schema、接口完成。
* 前端类型、hook、文章详情展示/生成逻辑完成。
* 针对核心来源选择和缓存命中逻辑补充测试，或至少通过可运行的 lint/typecheck 验证。
* 运行项目质量检查。
