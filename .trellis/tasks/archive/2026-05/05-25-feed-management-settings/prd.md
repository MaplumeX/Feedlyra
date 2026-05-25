# 在设置中添加订阅源统一管理视图

## Goal

在设置 > 订阅源 Tab 中增加订阅源管理表格，统一查看和管理所有订阅源。

## Requirements

* 使用 shadcn/ui Table 展示所有订阅源
* 表格列：图标+标题 | URL | 分类 | 未读数 | 状态 | 操作
* 表格上方：搜索输入框（按标题过滤）+ "+ 添加订阅源"按钮
* 表格下方：保留现有 OPML 导入/导出功能
* 编辑操作复用 FeedSettingsDialog，删除需确认弹窗
* 纯前端改动，后端 API 已完备

## Acceptance Criteria

* [ ] 订阅源表格正确显示所有用户订阅源
* [ ] 搜索框可以按标题过滤订阅源
* [ ] "+ 添加订阅源"按钮打开 AddFeedDialog
* [ ] 可以编辑订阅源（打开 FeedSettingsDialog）
* [ ] 可以删除订阅源（确认弹窗后删除）
* [ ] 状态列显示解析错误警告和最后检查时间
* [ ] OPML 导入/导出功能保持可用
* [ ] 空列表状态、加载状态正确显示
* [ ] TypeScript 类型检查通过
* [ ] 现有功能无回归

## Definition of Done

* TypeScript 类型检查通过
* 现有功能无回归

## Technical Approach

* 重写 `SubscriptionsTab.tsx`，在 OPML 区域上方增加表格
* 表格使用 shadcn/ui Table 组件
* 复用 `useFeeds()`, `useUpdateFeed()`, `useDeleteFeed()`, `useCategories()` hooks
* 复用 `AddFeedDialog`, `FeedSettingsDialog` 组件
* 删除确认使用 shadcn/ui AlertDialog

## Decision (ADR-lite)

**Context**: 订阅源管理分散在 Sidebar 和多个 Dialog 中，用户需要一个集中管理视图
**Decision**: 在设置 > 订阅源 Tab 中以表格形式展示所有订阅源，支持搜索、添加、编辑、删除
**Consequences**: 设置 Dialog 宽度可能需要从 480px 增大以容纳表格；OPML 区域移到表格下方

## Out of Scope

* 批量操作（批量删除、批量移动分类）
* 订阅源拖拽排序

## Technical Notes

* SettingsDialog: `frontend/src/components/settings/SettingsDialog.tsx`
* SubscriptionsTab: `frontend/src/components/settings/SubscriptionsTab.tsx`
* Sidebar (参考实现): `frontend/src/components/Sidebar.tsx`
* FeedSettingsDialog (参考编辑逻辑): `frontend/src/components/FeedSettingsDialog.tsx`
* AddFeedDialog: `frontend/src/components/AddFeedDialog.tsx`
* API hooks: `frontend/src/api/hooks.ts`
* Types: `frontend/src/api/types.ts`
