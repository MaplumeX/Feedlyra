# Change Article Entry Display Layout

## Goal

在文章条目中显示内容摘要，并将 Feed 名移至标题上方，提升信息密度和可读性。

## Requirements

* 在标题下方显示 `content_snippet`，2 行截断（`line-clamp-2`）
* `content_snippet` 为空时不渲染摘要行，布局不跳动
* Feed 名 + Feed 图标移至标题上方（原 meta 行中移除）
* meta 行只保留作者和发布时间
* 摘要行与列表宽度自适应（列表面板 180–400px 可调）

## Acceptance Criteria

* [ ] 文章条目显示 2 行 `content_snippet` 摘要
* [ ] Feed 名（含图标）在标题上方
* [ ] 无 snippet 时摘要行不渲染，布局一致
* [ ] 缩略图仍正常显示
* [ ] 选中/hover/未读样式不受影响

## Definition of Done

* Lint / typecheck / CI green
* 无回归：文章选择、键盘导航、虚拟滚动

## Out of Scope

* 多密度/视图切换模式
* AI summary 展示
* reader store 新增配置项

## Technical Approach

修改 `ArticleRow` 组件（`ArticleList.tsx` 内联），调整 flex 布局顺序：
1. 顶部：feed icon + feed title
2. 中间：unread dot + title + star button
3. 摘要：`content_snippet`，`line-clamp-2 text-xs text-muted-foreground`
4. 底部：author + published date

## Technical Notes

* Key file: `frontend/src/components/ArticleList.tsx` (ArticleRow at lines 41-112)
* Article type: `frontend/src/api/types.ts`
* Reader store: `frontend/src/stores/reader.ts`
