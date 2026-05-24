# fix: article list items not extending to right edge

## Goal

让文章列表中的条目内容延伸到右边界，消除为经典滚动条预留的右侧空白，与 sidebar 已采用的 overlay 滚动条方案保持一致。

## What I already know

* ArticleRow 使用 `px-3`（左右各 12px），右边有 12px padding — `ArticleList.tsx:62`
* 日期分组头也使用 `px-3` — `ArticleList.tsx:274`
* 筛选栏顶部也使用 `px-3` — `ArticleList.tsx:232`
* Virtuoso 使用原生 `overflow-y: auto`，无自定义滚动条样式
* 项目中无 `::-webkit-scrollbar`、`scrollbar-width`、`scrollbar-gutter`、`scrollbar-color` 样式
* Sidebar 已在 commit #68328c8 中切换为原生 overlay 滚动条方案
* 每行右侧有收藏星星按钮（`shrink-0`），标题为 `flex-1 truncate`

## Assumptions (temporary)

* macOS 默认使用 overlay 滚动条，不需要为滚动条预留空间
* 右侧 padding 保留少量间距（如 2px）用于视觉呼吸，但不为滚动条预留
* 星星按钮仍需保留在右侧

## Requirements

* `px-3` → `pl-3`：ArticleRow、日期头、筛选栏去掉右侧 padding
* 星星按钮自带 `p-0.5` 提供右侧呼吸空间，无需额外间距
* 与 sidebar 的 overlay 滚动条方案一致，不为滚动条预留布局空间

## Acceptance Criteria

* [ ] 文章列表条目延伸到右边界，无多余右侧空白
* [ ] 日期头和筛选栏与条目右侧对齐
* [ ] 不出现横向滚动条
* [ ] macOS overlay 滚动条正常工作

## Definition of Done (team quality bar)

* Lint / typecheck green
* 视觉验证通过

## Out of Scope (explicit)

* 改变星星按钮的位置或行为
* 修改 sidebar（已在 #68328c8 处理）
* 非 macOS 平台的滚动条样式适配

## Technical Notes

* 关键文件: `frontend/src/components/ArticleList.tsx`
* 参考: commit #68328c8 的 sidebar overlay scrollbar 改动
