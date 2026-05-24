# 优化文章列表时间标题样式

## Goal

将文章列表日期分组标题改为 Slack 风格的 Line-Through Label：居中文本 + 两侧水平线，提升视觉层次感。

## Requirements

* 采用 Line-Through Label（Slack 风格）：日期文本居中，两侧水平线延伸至边缘
* 保持 sticky 行为（滚动时标题吸顶）
* 适配中英文日期文本宽度
* 使用 shadcn/ui 主题变量（bg-border, text-muted-foreground 等）

## Acceptance Criteria

* [ ] 日期标题显示为居中文本 + 两侧水平线样式
* [ ] sticky 吸顶行为正常，滚动时当前日期标题保持可见
* [ ] 中英文（"今天"/"Today"）均显示正常
* [ ] 窄面板下水平线正确收缩，文本不换行
* [ ] 深色/浅色模式下主题色正确

## Definition of Done

* Lint / typecheck 通过
* 手动验证样式效果（浅色 + 深色模式）

## Out of Scope

* 日期分组逻辑变更
* 文章行样式变更
* Floating pill badge 或其他样式方案

## Technical Approach

修改 `ArticleList.tsx:272-277` 的 header 渲染 div，替换为 flex 布局：
- 外层 div: `sticky top-0 z-10 flex items-center gap-4 bg-background py-2 px-3`
- 左线: `h-px flex-1 bg-border`
- 文本: `text-xs font-medium text-muted-foreground whitespace-nowrap`
- 右线: `h-px flex-1 bg-border`

## Decision (ADR-lite)

**Context**: 当前 sticky inline label 样式过于朴素，缺乏视觉层次
**Decision**: 采用 Slack 风格 Line-Through Label（方案 A）
**Consequences**: 视觉上更清晰优雅；需要处理 sticky 时的背景遮盖

## Research References

* [`research/date-header-ui-patterns.md`](research/date-header-ui-patterns.md) — 5 种日期标题 UI 模式对比 + Tailwind 实现配方

## Technical Notes

* 主要文件：`frontend/src/components/ArticleList.tsx`（header 渲染在 272-277 行）
* 主题变量定义在：`frontend/src/index.css`
* shadcn/ui 主题变量：`--border`, `--muted-foreground`, `--background` 可直接使用
