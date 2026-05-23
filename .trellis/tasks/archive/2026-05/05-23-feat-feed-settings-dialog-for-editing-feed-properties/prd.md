# feat: feed settings dialog

## Goal

为侧边栏的每个订阅源添加设置 dialog，让用户可以编辑订阅源属性（如标题），为未来的更多设置项做准备。

## What I already know

* 后端已有 `PUT /api/feeds/{feed_id}` 接口，接受 `FeedUpdate(title: str | None)`
* 前端没有 `useUpdateFeed` mutation hook
* 侧边栏每个 feed 已有 DropdownMenu（Refresh、Delete 两个选项）
* 现有 dialog 模式：shadcn/ui Dialog（Radix），受控组件，open/onOpenChange
* Feed 属性：id, title, url, site_url, icon_url, description, parsing_error_count, parsing_error_message, checked_at, created_at, unread_count
- 后端 FeedUpdate schema 目前只支持更新 title

## Assumptions (temporary)

* MVP 只支持编辑 title，其他字段后续扩展
* dialog 从 DropdownMenu 中触发（新增 "Settings" 菜单项）
* 复用现有 shadcn/ui Dialog 组件

## Open Questions

(none — all resolved)

## Requirements (evolving)

* 侧边栏 feed 的 DropdownMenu（三点菜单）新增 "Settings" 选项（在 Refresh 和 Delete 之间）
* 点击后打开 Feed Settings Dialog
* Dialog 中只读展示 feed URL、site_url、description（上方）
* Dialog 中可编辑 feed title（下方输入框）
* 保存时调用 PUT /api/feeds/{feed_id} 更新标题
* 新增前端 useUpdateFeed mutation hook
* Dialog 设计需为未来添加更多设置项留出扩展空间（简洁表单布局，只读信息在上、可编辑字段在下，可逐步添加新字段）

## Acceptance Criteria (evolving)

* [ ] 侧边栏 feed 三点菜单中出现 "Settings" 选项（Refresh 和 Delete 之间）
* [ ] 点击 Settings 打开 Dialog，上方显示只读信息（URL、site_url、description），下方显示 title 输入框
* [ ] 修改标题并保存后，侧边栏标题同步更新
* [ ] 保存后 dialog 关闭，feed 列表刷新
* [ ] 空标题或未修改时保存按钮禁用

## Definition of Done

* Lint / typecheck 通过
* 功能可手动验证
* 代码风格与现有 dialog 组件一致

## Out of Scope (explicit)

* 编辑 URL / site_url / icon_url 等可编辑字段（后续扩展）
* 批量编辑多个 feed
* feed 排序/分类管理
* 后端 schema 扩展（MVP 不动后端，只复用现有 FeedUpdate）

## Technical Notes

* 后端路由：`PUT /api/feeds/{feed_id}`，body: `FeedUpdate(title: str | None)`
* 后端 schema：`backend/app/schemas/feed.py` — FeedUpdate 只有 title
* 前端 API client：`frontend/src/api/client.ts` — 已有 `api.put` 方法
* 前端 hooks：`frontend/src/api/hooks.ts` — 需新增 `useUpdateFeed`
* Dialog 组件：`frontend/src/components/ui/dialog.tsx`
* 参考 dialog：`AddFeedDialog.tsx`, `SettingsDialog.tsx`
* Sidebar：`frontend/src/components/Sidebar.tsx`

## Decision (ADR-lite)

**Context**: 需要为订阅源添加设置 dialog，决定布局和触发方式
**Decision**: 简洁表单布局（只读信息在上、title 输入框在下），通过现有 DropdownMenu 三点菜单触发
**Consequences**: 布局方向自然支持未来向下追加可编辑字段；MVP 不动后端 schema
