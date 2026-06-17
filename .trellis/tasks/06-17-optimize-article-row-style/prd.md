# 优化文章列表条目样式

## Goal

优化文章列表 `ArticleRow` 组件的展示样式：标题始终加粗、不再随已读/未读状态变化；移除行内收藏（Star）按钮。

## Requirements

- 文章标题始终保持加粗（`font-medium`），不再因 `article.is_read` 状态变化而切换字重。
  - 当前实现：容器 `div` 上有 `!article.is_read && "font-medium"`，未读时整行继承 medium、已读时回归 normal。
  - 调整后：标题 `<span>` 固定 `font-medium`，已读/未读不影响标题字重。
  - 未读指示点（左侧圆点）保持不变，仍作为未读状态视觉标识。
- 移除 `ArticleRow` 行内的收藏按钮（Star 按钮及其 `onClick` / `toggleStar` 逻辑）。
  - 收藏功能本身保留（侧边栏 / 文章详情等其他入口不变），仅删除列表行内入口。
  - 清理因移除按钮而变成孤儿的导入与变量：`Star`、`useToggleStar`。

## Acceptance Criteria

- [ ] 已读与未读文章标题粗细一致（均为 `font-medium`），切换已读状态时标题字重不再变化。
- [ ] 未读圆点指示仍正常显示（未读显示，已读不显示）。
- [ ] `ArticleRow` 行内不再渲染 Star 收藏按钮。
- [ ] 无孤儿导入 / 变量，lint 与 type-check 通过。

## Notes

- 仅改动 `frontend/src/components/ArticleList.tsx` 的 `ArticleRow` 组件。
- 轻量任务，PRD-only。
