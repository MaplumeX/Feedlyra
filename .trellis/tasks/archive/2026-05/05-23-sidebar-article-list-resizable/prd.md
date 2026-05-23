# sidebar-article-list-resizable

## Goal

让侧边栏和文章条目栏支持拖动调整宽度，并设置最小/最大宽度约束，提升用户对布局的控制力。

## What I already know

* 框架: React 19 + TypeScript + Tailwind CSS v3
* 当前布局: Home.tsx 中三栏水平 flex 布局
  - Sidebar: 固定 192px（展开）/ 40px（折叠），shrink-0
  - ArticleList: 固定 280px，shrink-0
  - ArticleDetail: flex-1 min-w-0
* 可选第四栏: AIChatPanel 320px，在 ArticleDetail 内部
* `react-resizable-panels` 已在 package.json 中但完全未使用
* 状态管理: Zustand + persist 中间件（sidebarCollapsed 已持久化）
* 侧边栏有折叠模式（sidebarCollapsed）

## Assumptions (temporary)

* 使用已有的 react-resizable-panels 库实现
* 面板宽度需要持久化到 localStorage（刷新后恢复）
* 折叠状态的 sidebar 不参与拖动
* ArticleDetail 保持 flex-1 自适应，不需要拖动

## Open Questions

(none remaining)

## Requirements (evolving)

* 侧边栏和文章列表栏之间添加可拖动的分隔线
* 拖动时实时调整面板宽度
* 宽度约束: Sidebar 120~280px, ArticleList 180~400px（默认值: 192px / 280px）
* 面板宽度持久化（刷新页面后恢复）
* 折叠状态 Sidebar 不参与拖动，使用固定 40px
* 双击分隔线重置对应面板为默认宽度

## Acceptance Criteria (evolving)

* [ ] 用户可通过拖动分隔线调整 Sidebar 和 ArticleList 宽度
* [ ] Sidebar 宽度约束 120~280px，ArticleList 宽度约束 180~400px
* [ ] 面板宽度在页面刷新后保持
* [ ] 折叠状态下 Sidebar 固定 40px，不可拖动
* [ ] 拖动时有视觉反馈（光标变化、分隔线高亮）
* [ ] 双击分隔线重置面板为默认宽度（192px / 280px）

## Definition of Done

* Lint / typecheck 通过
* 手动验证拖动功能和宽度约束
* 无布局错乱或溢出

## Out of Scope (explicit)

* ArticleDetail 面板宽度调整
* AIChatPanel 宽度调整

## Technical Notes

* 关键文件: `frontend/src/pages/Home.tsx`（布局入口）
* 可用库: `react-resizable-panels` v4.11.1（已安装未使用）
* Sidebar 折叠状态: `frontend/src/stores/reader.ts` sidebarCollapsed
