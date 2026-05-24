# 修复文章列表日期标题吸顶功能

## Goal

文章列表中按日期分组的标题（如"今天"、"昨天"）在滚动时未能吸顶固定，需要修复使其在滚动时正确粘附在视口顶部。

## Requirements

* 将 `Virtuoso` 替换为 `GroupedVirtuoso`，利用其内置 sticky group header
* 去掉 `FlatItem` 类型和 `flatItems` memo，直接使用 `grouped` 数据
* `groupCounts` 传入每组的文章数量数组
* `groupContent` 渲染日期标题（line-through label 样式）
* `rangeChanged` 中直接使用 GroupedVirtuoso 给出的 article 索引，从 `grouped` 中查找对应文章

## Acceptance Criteria

- [ ] 日期标题在滚动时正确吸顶
- [ ] 滚动标记已读功能不受影响
- [ ] 文章选择、筛选、标记已读等功能正常

## Definition of Done

* Lint / typecheck 通过
* 手动验证吸顶效果

## Out of Scope

* 日期分组逻辑变更
* UI 视觉变更

## Decision (ADR-lite)

**Context**: `Virtuoso` 的项目包装元素使用 `position: absolute`，导致内部 CSS `position: sticky` 无法生效。
**Decision**: 使用 `GroupedVirtuoso` 替换 `Virtuoso`，去掉 `FlatItem`/`flatItems`，直接用 `grouped` 数据。
**Consequences**: 代码更简洁（消除 flatItems 的索引映射复杂度），scroll-mark-read 逻辑需要用 article 索引从 grouped 中查找文章。

## Technical Notes

* 文件: `frontend/src/components/ArticleList.tsx`
* 从 `react-virtuoso` 导入 `GroupedVirtuoso`
* `groupCounts` 接受每组的文章数量数组（不含 header）
* `groupContent` 渲染组头，Virtuoso 自动添加 `position: sticky`
* `rangeChanged` 中需将 Virtuoso 给出的 article 索引映射回 `grouped` 中的文章
* 参考: research/virtuoso-sticky-items.md
