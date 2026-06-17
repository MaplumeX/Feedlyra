# Remove feed item more menu from sidebar

## Goal

移除侧边栏订阅条目上的「更多」三点下拉菜单按钮，使条目更简洁。右键上下文菜单保留，所有操作（刷新、设置、移动到分类、删除）仍可通过右键访问。

## Requirements

- 在 `frontend/src/components/Sidebar.tsx` 的 `renderFeedItem` 中，移除订阅条目上的 `MoreHorizontal` 三点按钮及其包裹的 `DropdownMenu`（刷新 / 设置 / 移动到分类 / 删除）。
- 保留同一组件内的 `ContextMenu`（右键菜单），其功能与被移除的下拉菜单一致，功能不应丢失。
- 分类分组（`renderCategoryGroup`）上的三点菜单不在本次改动范围内，保持不变。
- 不改动其它无关代码、样式或导入结构（除非因移除代码产生孤儿导入需要清理）。

## Acceptance Criteria

- [ ] 侧边栏订阅条目 hover 时不再显示三点「更多」按钮。
- [ ] 右键订阅条目仍可弹出上下文菜单，包含刷新、设置、移动到分类、删除。
- [ ] 条目的点击选中、未读徽标等行为不受影响。
- [ ] 移除后未引入未使用的导入（如 `MoreHorizontal` 仅在此处使用则相应清理）。

## Notes

- 仅涉及前端单一组件的小改动，PRD-only 规划。
