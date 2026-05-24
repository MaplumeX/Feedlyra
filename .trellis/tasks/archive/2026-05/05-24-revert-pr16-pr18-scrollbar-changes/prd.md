# Revert PR #16 and #18 Scrollbar Changes

## Goal

撤销 PR #16 和 #18 的所有代码改动，恢复自定义滚动条样式和右侧 padding。这两个 PR 是因不熟悉 macOS 系统对滚动条有特殊设置（默认 overlay 模式）而做出的误改。

## What I already know

- PR #16 (commit 68328c8): 移除 `::-webkit-scrollbar` 和 Firefox `scrollbar-width`/`scrollbar-color` CSS；将 Sidebar 和 ArticleDetail 的 Radix `<ScrollArea>` 替换为原生 `<div className="overflow-y-auto">`；更新组件 spec
- PR #18 (commit 1f9acff): 将 ArticleList 中多处 `px-3` 改为 `pl-3 pr-0`
- 两个 PR 的修改已合入 main，当前分支包含这些改动
- macOS 默认使用 overlay scrollbar，不占用布局空间，所以 PR #16 认为自定义滚动条导致经典模式（占用 6-10px）引发错位——但用户认为这是误判

## Requirements

- 恢复 `frontend/src/index.css` 中被删除的自定义滚动条 CSS（`::-webkit-scrollbar` 和 Firefox `scrollbar-width`/`scrollbar-color`）
- 恢复 `frontend/src/components/Sidebar.tsx` 中使用 Radix `<ScrollArea>` 的代码
- 恢复 `frontend/src/components/ArticleDetail.tsx` 中使用 Radix `<ScrollArea>` 的代码
- 恢复 `frontend/src/components/ArticleList.tsx` 中 `pl-3 pr-0` 回 `px-3`
- 恢复 `.trellis/spec/frontend/component-guidelines.md` 中 ScrollArea 相关的文档

## Acceptance Criteria

- [ ] index.css 中自定义滚动条样式完整恢复
- [ ] Sidebar 和 ArticleDetail 使用 `<ScrollArea>` 组件
- [ ] ArticleList 中所有 `pl-3 pr-0` 恢复为 `px-3`
- [ ] component-guidelines.md 恢复为 PR #16 之前的内容
- [ ] 应用可正常构建和运行

## Definition of Done

- Lint / typecheck 通过
- 应用可正常运行

## Out of Scope

- 不修改 trellis 任务归档文件（.trellis/tasks/archive/）中的历史记录
- 不修改 journal 文件
- 不修改其他 PR 的改动

## Decision (ADR-lite)

**Context**: macOS 默认 overlay scrollbar 不占布局空间，恢复自定义滚动条会在 macOS 上导致经典模式（占用 6px 右侧空间）。用户确认这是误改，直接恢复。
**Decision**: 纯 revert，不加条件 CSS 或平台检测。布局差异可接受或后续单独处理。
**Consequences**: macOS 上滚动条会占用布局空间，但这是自定义滚动条的正常行为。

## Technical Notes

- 需要恢复的文件和具体改动：
  - `frontend/src/index.css`: 恢复 21 行被删的滚动条 CSS
  - `frontend/src/components/Sidebar.tsx`: 恢复 `ScrollArea` import，`<div className="min-w-0 flex-1 overflow-y-auto">` → `<ScrollArea className="min-w-0 flex-1">`
  - `frontend/src/components/ArticleDetail.tsx`: 恢复 `ScrollArea` import，`<div className="flex-1 overflow-y-auto">` → `<ScrollArea className="flex-1">`
  - `frontend/src/components/ArticleList.tsx`: 4 处 `pl-3 pr-0` → `px-3`
  - `.trellis/spec/frontend/component-guidelines.md`: 恢复 ScrollArea 相关文档段落
