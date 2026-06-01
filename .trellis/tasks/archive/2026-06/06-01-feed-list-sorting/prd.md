# 订阅源列表支持排序

## Goal

让用户可以控制订阅源列表的显示顺序，便于按名称或添加时间快速整理和浏览订阅源，并支持升序/降序切换。

## What I already know

* 用户希望“订阅源列表支持排序”。
* `GET /api/feeds` 当前在后端按 `Feed.title` 升序返回。
* 主阅读器侧边栏 `frontend/src/components/Sidebar.tsx` 使用 `useFeeds()` 数据渲染分类内订阅源和未分类订阅源。
* 设置里的订阅管理列表 `frontend/src/components/settings/SubscriptionsTab.tsx` 也直接使用 `useFeeds()` 数据。
* `Feed` 前端类型已有 `title`、`created_at`、`category_id`、`category_name`，足够支持名称和添加时间排序。
* `frontend/src/stores/reader.ts` 已用 zustand persist 保存阅读器偏好，适合保存本地排序偏好。
* 用户明确不需要未读数排序。
* 用户明确排序需要支持升序和降序。

## Assumptions (temporary)

* MVP 优先做可切换排序方式，而不是拖拽自定义顺序。
* 排序偏好先保存在本地 reader store，不新增后端 schema 或用户偏好 API。
* 排序应用于侧边栏分类内订阅源、未分类订阅源，以及设置页订阅源列表。
* 分类本身继续沿用现有后端标题排序；本任务只排序订阅源。

## Open Questions

* None.

## Requirements (evolving)

* 订阅源列表提供排序入口，用户可以选择排序方式。
* 排序方式覆盖名称和添加时间。
* 每种排序字段都支持升序和降序。
* 用户选择的排序方式在刷新页面后保持。
* 侧边栏分类内订阅源和未分类订阅源按相同规则排序。
* 设置页订阅管理列表使用同一套排序规则，避免不同位置顺序不一致。
* 空列表、加载中、编辑、删除、移动分类等现有行为不受影响。

## Acceptance Criteria (evolving)

* [ ] 侧边栏有清晰的排序控件，支持切换订阅源排序方式。
* [ ] 设置页订阅源列表有清晰的排序控件，或复用同一全局排序偏好。
* [ ] 选择“名称”时订阅源按标题排序，大小写不导致明显异常。
* [ ] 选择“添加时间”时订阅源按 `created_at` 排序，时间相同则按名称稳定排序。
* [ ] 名称排序和添加时间排序都可以切换升序/降序。
* [ ] 排序偏好刷新后仍保留。
* [ ] Lint / typecheck 通过。

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* 拖拽自定义顺序。
* 后端排序参数或数据库排序字段。
* 分类本身的排序。
* OPML 导入/导出的顺序语义变更。

## Technical Notes

* Likely frontend files:
  * `frontend/src/components/Sidebar.tsx`
  * `frontend/src/components/settings/SubscriptionsTab.tsx`
  * `frontend/src/stores/reader.ts`
  * `frontend/src/i18n/locales/en/reader.json`
  * `frontend/src/i18n/locales/zh-CN/reader.json`
  * `frontend/src/i18n/locales/en/settings.json`
  * `frontend/src/i18n/locales/zh-CN/settings.json`
* Existing UI primitives include `DropdownMenu` and `Select`; `lucide-react` includes sorting/filtering icons already used elsewhere.
* Backend `backend/app/routers/feeds.py` already orders feeds by title, but frontend sorting is still needed for user-selectable modes.
