# 订阅源批量编辑

## Goal

在设置 → 订阅管理（SubscriptionsTab）的订阅源列表中，支持多选订阅源并对选中集合执行批量操作（移动到分类、删除），减少重复点击。

## User Value

订阅源数量较多时，逐条点开 DropdownMenu → 编辑/分类/删除成本高。批量操作能把"整理几十个源"从 N 次点击降到选中 + 一次操作。

## Background（来自代码勘察）

### 可编辑字段与现有端点

后端 `FeedUpdate` schema（`backend/app/schemas/feed.py`）可改字段：`title` / `category_id` / `auto_full_text` / `auto_translate` / `translate_target_lang`。本次只动 `category_id`（移动分类）和整行删除。

现有后端端点（`backend/app/routers/feeds.py`）：

- `PUT /api/feeds/{feed_id}` — 单条更新
- `DELETE /api/feeds/{feed_id}` — 单条删除
- **无批量端点**（本次新增）

### 前端现状

`frontend/src/components/settings/SubscriptionsTab.tsx`：

- 订阅源列表渲染于 `max-h-[280px]` 可滚动容器，每行：`FeedIcon` + title + category Badge + 行内 DropdownMenu（编辑 / 删除）
- 已用 hooks：`useFeeds` / `useCategories` / `useDeleteFeed` / `useUpdateFeed`
- 排序由 `FeedSortMenu` + `feedSort`（store 中的 `feedSort`）控制
- 单条删除用 `window.confirm` 确认
- `ui/` 目录下**无 checkbox、无 alert-dialog 组件**

分类（Category）是另一种实体（badge 形式，可重命名/删除），本次**不纳入**批量编辑对象。

## Requirements

### R1. 后端批量端点

- `POST /api/feeds/bulk/move` — body `{ feed_ids: UUID[] (min 1), category_id: UUID | null }`；校验 category 归属当前用户（复用单条更新校验）；`category_id=null` 表示移到未分类；单事务 `UPDATE feed SET category_id=... WHERE id IN (...) AND user_id=...`。
- `POST /api/feeds/bulk/delete` — body `{ feed_ids: UUID[] (min 1) }`；单事务 `DELETE FROM feed WHERE id IN (...) AND user_id=...`。
- 响应 schema（两端点共用结构）：`{ updated: UUID[], not_found: UUID[] }` / `{ deleted: UUID[], not_found: UUID[] }`。
- 输入校验：`feed_ids` 用 Pydantic `min_length=1`，空列表 → 422；不设上限；重复 id 由 `IN` 天然去重。
- category 不属于当前用户 → `404 Category not found`。

### R2. 前端"选择模式"切换

- 列表标题栏（`feedList` Label 与 `FeedSortMenu` 同行）右侧加"批量编辑"按钮（`ListChecks` 图标）。
- 点击进入选择模式：每行左侧出现 Checkbox（新增 `ui/checkbox.tsx`）；标题栏切换为"已选 N + 全选 + 取消"。
- 选择模式下工具栏出现动作按钮："移动到分类"、"删除"。
- 退出选择模式恢复原样，清空选中集合。非选择模式不显示 checkbox。
- 选中为空时动作按钮 disabled，不发请求。

### R3. 移动到分类动作

- 点"移动到分类" → `DropdownMenu` 弹出分类列表（来自 `useCategories`），列表顶部一项"未分类"（`category_id=null`）。
- 点某项 → 立即调用 `bulk/move`，toast 成功："已移动 N 个订阅源到 <分类名/未分类>"。
- 不新建 Dialog。

### R4. 批量删除动作

- 点"删除" → 新建 `ui/alert-dialog.tsx`（shadcn AlertDialog，基于 `@radix-ui/react-alert-dialog`）。
- 文案带数量：标题"删除 N 个订阅源？" / 描述"此操作无法撤销。" / 取消 + 删除按钮。
- 确认后调用 `bulk/delete`，toast 成功："已删除 N 个订阅源"。

### R5. 前端 hooks 与状态

- 新增 `useBulkMoveFeeds` / `useBulkDeleteFeeds`，成功后 invalidate `queryKeys.feeds.list()`、`queryKeys.articles.all`、`queryKeys.categories.list()`，并退出选择模式。
- `not_found` 仅 console.warn，不 toast。

### R6. i18n

- `frontend/src/i18n/locales/{en,zh-CN}/settings.json` 新增批量编辑相关 key（批量编辑 / 已选 N / 全选 / 取消 / 移动到分类 / 未分类 / 删除 N 个订阅源 / 描述 / 成功 toast）。

## Acceptance Criteria

- AC1：进入设置 → 订阅管理 → 点"批量编辑"按钮，列表每行出现 Checkbox，标题栏显示"已选 N + 全选 + 取消"。
- AC2：勾选若干订阅源后，"移动到分类"和"删除"按钮可用；未勾选时 disabled。
- AC3：点"全选"选中当前列表所有 feed；点"取消"退出选择模式，选中集合清空。
- AC4：选择模式下点"移动到分类" → 下拉列出所有分类 + "未分类"；选某分类后调用 `POST /api/feeds/bulk/move`，列表刷新，已选 feed 的 `category` 变更，toast 显示成功数。
- AC5：选择模式下点"删除" → AlertDialog 弹出含数量文案；确认后调用 `POST /api/feeds/bulk/delete`，列表刷新，已选 feed 消失，toast 显示成功数；取消则关闭对话框不删除。
- AC6：空 `feed_ids` 请求被前端 disable 拦截；若绕过前端直发，后端返回 422。
- AC7：`category_id` 指向不属于当前用户的分类，后端返回 404。
- AC8：`category_id=null` 成功将选中 feed 移到未分类。
- AC9：后端返回 `not_found` 时仅 console.warn，不向用户报错；`updated`/`deleted` 数量正确反映在 toast。
- AC10：`npm run lint` + `npm run build` 通过；后端 `uv run pytest` 不回归（现有单测无 feed router 覆盖，本次不新增后端集成测试，手动验证即可）。

## Out of Scope

- 批量修改 `title`、`auto_full_text`、`auto_translate`、`translate_target_lang`（留作后续）。
- 批量刷新订阅源。
- 对 Category 实体本身的批量操作。
- 后端集成测试（项目测试约定仅覆盖纯逻辑，见 backend spec）。
