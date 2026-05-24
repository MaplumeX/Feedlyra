# feat: AI摘要自动生成功能

## Goal

用户点进文章后自动生成AI摘要，无需手动点击摘要按钮。设置中提供开关控制此行为，生成过程中显示占位UI让用户知晓摘要正在生成。

## What I already know

* **现有AI摘要功能**: `POST /api/ai/articles/:id/summarize` 已存在，ArticleDetail 工具栏有手动"AI Summarize"按钮
* **摘要展示**: ArticleDetail 已有摘要展示区 (line 231-242)，当 `article.summary` 存在时显示在 muted box 中
* **设置页**: SettingsDialog 有三个 tab (General / AI Settings / Subscriptions)，GeneralSettingsTab 已有 Switch 组件用于 scrollMarkRead
* **状态管理**: Zustand reader store + persist 中间件，scrollMarkRead 已作为持久化设置存在
* **异步占位模式**: Skeleton 用于初始加载，Loader2 + animate-spin 用于 mutation 状态
* **UI组件**: Switch (Radix UI)、Skeleton、Loader2 均已有现成组件
* **i18n**: 支持 en 和 zh-CN 两种语言

## Assumptions (temporary)

* 已有摘要的文章不会重复生成（后端应已有此逻辑）
* 自动摘要仅在 AI 配置完整（base_url + api_key + model）时触发
* 生成失败时不阻断文章阅读体验

## Resolved Decisions

* **触发时机**: 仅首次生成 — 文章无 summary 时自动触发，已有摘要直接展示
* **AI未配置**: 静默跳过，不生成摘要也不提示
* **占位UI**: 与现有摘要框同款样式（rounded-md border bg-muted/50），Sparkles 图标旋转 + 固定占位文本"正在生成摘要..."

## Open Questions

* (无)

## Requirements (evolving)

* 在设置中添加"自动生成AI摘要"开关（默认关闭）
* 点进文章后，若开关开启，自动调用摘要 API
* 生成过程中显示占位UI
* 生成完成后替换占位UI为摘要内容
* 开关状态持久化到 localStorage

## Acceptance Criteria (evolving)

* [ ] 设置中可切换"自动生成AI摘要"开关
* [ ] 开关开启时，进入文章自动触发摘要生成
* [ ] 开关关闭时，行为与当前一致（仅手动按钮触发）
* [ ] 生成过程中显示与摘要框同款样式的占位UI（Sparkles旋转 + 固定占位文本）
* [ ] 生成完成后摘要正常显示
* [ ] 开关状态刷新页面后保持
* [ ] AI 未配置时静默跳过，不报错不提示

## Definition of Done

* Lint / typecheck 通过
* 中英文 i18n 已更新
* 无破坏现有手动摘要功能

## Out of Scope (explicit)

* (暂无)

## Technical Notes

* 相关文件: `ArticleDetail.tsx`, `GeneralSettingsTab.tsx` / `AISettingsTab.tsx`, `stores/reader.ts`, `api/hooks.ts`
* Switch 组件模式参考 `GeneralSettingsTab.tsx` 中 scrollMarkRead 的实现
* Zustand persist 需添加 `autoSummarize` 到 persistKeys
