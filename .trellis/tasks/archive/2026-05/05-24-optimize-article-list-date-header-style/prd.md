# 优化文章列表日期标题样式

## Goal

提升 ArticleList 日期标题（line-through label）的文字可见度，使其更显眼。

## Requirements

* 字号从 `text-xs`(12px) 提升到 `text-sm`(14px)
* 字重从 `font-medium`(500) 提升到 `font-semibold`(600)
* 颜色从 `text-muted-foreground` 加深到 `text-secondary-foreground`
* 分隔线保持 `h-px bg-border` 不变（与加粗文字视觉上已平衡）

## Acceptance Criteria

* [ ] 日期标题字号 14px、字重 600、颜色使用 `text-secondary-foreground`
* [ ] 亮色/暗色主题下日期标题均比之前更显眼
* [ ] 更新 `component-guidelines.md` 中的 line-through label pattern 文档
* [ ] Lint / typecheck green

## Definition of Done

* Lint / typecheck green
* 视觉验证（亮色 + 暗色主题）
* Spec 文档更新

## Out of Scope

* 日期分组逻辑（formatDate / groupByDate）
* GroupedVirtuoso 的 sticky 行为
* 文章行本身的样式
* 分隔线样式调整

## Technical Notes

* 关键文件：`frontend/src/components/ArticleList.tsx`（groupContent 回调，约 288-299 行）
* 主题色定义：`frontend/src/index.css`
  * `--secondary-foreground`: 222.2 47.4% 11.2% (light) / 210 40% 98% (dark)
  * `--muted-foreground`: 215.4 16.3% 46.9% (light) / 215 20.2% 65.1% (dark)
* Spec：`.trellis/spec/frontend/component-guidelines.md`（line-through label pattern, 299-337 行）
