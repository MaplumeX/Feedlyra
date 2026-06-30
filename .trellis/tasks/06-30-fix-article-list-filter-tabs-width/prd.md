# Fix article list filter tabs width resizing with panel

## Goal

拖动文章列表宽度时，「全部 / 未读 / 星标」三个筛选 Tab 按钮的宽度也会随之变化。期望三个 Tab 按钮宽度固定，不受文章列表面板宽度影响。

## Background

`frontend/src/components/ArticleList.tsx` 的 header 中，`Tabs` 使用了 `min-w-0 flex-1` 撑满剩余宽度，`TabsList` 又使用 `grid h-7 w-full grid-cols-3` 把三个 TabTrigger 等分到整个宽度上。因此当用户拖拽文章列表与阅读区之间的分隔条改变文章列表宽度时，三个按钮的宽度也会跟着拉伸/压缩。

## Requirements

- 「全部 / 未读 / 星标」三个筛选按钮宽度固定，不随文章列表面板宽度变化
- 右侧操作按钮组（刷新全部、全部标记已读）保持原有行为（`shrink-0`）
- Tab 选中态、文字截断（`truncate`）、i18n 文案不受影响
- 不改动其他无关样式

## Acceptance Criteria

- [ ] 拖动文章列表宽度时，三个筛选 Tab 按钮宽度保持不变
- [ ] Tab 按钮与右侧操作按钮组在 header 中布局正常（左对齐跟随、右操作贴边）
- [ ] 切换 全部/未读/星标 仍工作正常
- [ ] lint 与 type-check 通过

## Notes

- 预期方案：去掉 `Tabs` 的 `flex-1` 与 `TabsList` 的 `w-full`，让 Tabs 收缩到内容宽度。右侧按钮组已有 `shrink-0`，会在 flex 容器中自然紧贴右侧。
- Lightweight task，PRD-only。
