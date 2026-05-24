# 统一使用原生 overlay 滚动条

## Goal

移除所有自定义滚动条实现（CSS `::-webkit-scrollbar` + Radix `<ScrollArea>`），统一使用原生 overlay 滚动条，消除滚动条占据独立布局空间导致的视觉不对齐问题。

## Requirements

* 移除 `frontend/src/index.css` 中的 `::-webkit-scrollbar` 相关样式规则（第 61-80 行区域）
* 移除 Firefox 的 `scrollbar-width: thin` 和 `scrollbar-color` 全局规则
* 侧边栏：将 Radix `<ScrollArea>` 替换为 `<div className="overflow-y-auto">`，移除 ScrollArea 导入
* 文章详情：将 Radix `<ScrollArea>` 替换为 `<div className="overflow-y-auto">`，移除 ScrollArea 导入
* 三处滚动区域统一使用原生滚动条

## Acceptance Criteria

* [ ] 文章列表滚动条不占据独立布局宽度（tab 栏与内容区域宽度一致）
* [ ] 侧边栏滚动条不占据独立布局宽度（标题栏与内容区域宽度一致）
* [ ] 文章详情滚动条不占据独立布局宽度
* [ ] macOS 上滚动条恢复原生 overlay 行为（悬浮显示，不占空间）
* [ ] AIChatPanel 的 `overflow-y-auto` 先例保持不变

## Definition of Done

* 页面无样式回归，滚动行为正常
* Lint / typecheck 通过
* Radix ScrollArea 无残留引用（除 ui 组件本身保留）

## Technical Approach

1. 删除 `index.css` 中 `::-webkit-scrollbar` 全部规则（~20 行）
2. `Sidebar.tsx`：`<ScrollArea>` → `<div className="overflow-y-auto">`，删除 ScrollArea import
3. `ArticleDetail.tsx`：`<ScrollArea>` → `<div className="overflow-y-auto">`，删除 ScrollArea import
4. `ui/scroll-area.tsx` 保留不动（其他 shadcn 组件可能间接依赖，如 dropdown）

## Decision (ADR-lite)

**Context**: 项目中存在两种滚动条实现 — 原生 scrollbar（被自定义 CSS 强制 classic 模式）和 Radix ScrollArea（自定义渲染，占 10px 布局空间），两者都导致滚动条与内容区域视觉不对齐。

**Decision**: 全部移除自定义滚动条，使用原生 overlay 滚动条。AIChatPanel 已有 `overflow-y-auto` 先例。

**Consequences**: Windows 上原生滚动条样式不可控但属系统原生行为；Radix ScrollArea 组件文件保留以备 shadcn 其他组件间接使用。

## Out of Scope

* 不替换为其他自定义滚动条方案
* 不调整 Windows/Linux 滚动条行为
* 不删除 `ui/scroll-area.tsx` 组件文件

## Technical Notes

* 影响文件：`index.css`、`Sidebar.tsx`、`ArticleDetail.tsx`
* 根因：自定义 scrollbar 样式 + Radix ScrollArea 都占布局空间
* AIChatPanel 已使用 `overflow-y-auto`（第 128 行），证明原生滚动在该项目中可行
