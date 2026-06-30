# Fix sidebar delete-feed UI freeze

## Goal

在侧边栏通过右键菜单删除一个订阅源后，整个界面卡死（可见但无法点击任何元素），必须刷新页面才能恢复。根除这个卡死，让删除操作能干净地完成。顺手把设置页单删订阅源的 `window.confirm` 统一成 Radix `AlertDialog`。

## Background / Root Cause

复现路径只有侧边栏右键菜单这一条（设置页里的删除用的是 `window.confirm`，不触发该问题）。

根因是两层叠加（已通过代码 + `npm explain` 双重验证，对应 Radix issue **#3317**）：

### 成因 A（真·根因，本仓库已实测命中）：两份 `react-dismissable-layer` 实例

`Dialog` / `AlertDialog` / `ContextMenu` / `DropdownMenu` 等都依赖底层 `@radix-ui/react-dismissable-layer`。该包用模块级变量 `originalBodyPointerEvents` 记录"打开 overlay 前 body 的 pointer-events 原值"，关闭时恢复。这个状态按"包实例"隔离。本仓库实测存在两份：

- `node_modules/@radix-ui/react-dismissable-layer` → **1.1.11**（给 ContextMenu / DropdownMenu / Popover / Select / Toast 用，经 `react-menu`；且这些包把 dismissable-layer 硬锁 `"1.1.11"` 非 caret）
- `node_modules/@radix-ui/react-dialog/node_modules/@radix-ui/react-dismissable-layer` → **1.1.13**（给 Dialog / AlertDialog 用）

跨实例从 menu overlay 切到 dialog overlay 时，两套 DismissableLayer 互相把"body 已被对方改成 `none` 的值"误记为 original，关闭后恢复成 `none`，body 永久 `pointer-events: none`，整页可见但不可点。这与代码里用 `onClick` 还是 `onSelect` 无关——即便写对 `onSelect`，双实例存在时仍可能残留。

### 成因 B（时序放大器）：`ContextMenuItem` 用 `onClick` + `stopPropagation` 而非 Radix 标准 `onSelect`

`ContextMenu` / `DropdownMenu` 的 `Item` 设计上由 `onSelect` 触发，菜单随后按自身状态机关闭。`onClick` 是原生 DOM 事件，会抢在 Radix select/dismiss 调度之前同步切 Dialog state，叠加上双实例，更容易撞上卡死。`stopPropagation` 无效，因为问题不在事件冒泡而在两套 DismissableLayer 生命周期交错。

### 二级诱因：删除成功后未清理失效的 `selectedFeedId`

`Sidebar.tsx` 的 `handleDeleteFeed` `onSuccess` 只 `setDeleteFeedConfirmId(null)` + toast，没动 `selectedFeedId`。被删 feed 仍被选中，重渲染时 ContextMenu trigger 围绕一个已不存在的 feed 重挂载，进一步触发 Radix portal 生命周期问题。

### 放大问题的代码位置

- `frontend/src/components/Sidebar.tsx` 的 `renderFeedItem`：删除项用 `ContextMenuItem` 的 `onClick` + `e.stopPropagation()` 打开确认 `Dialog`，底部挂 `<Dialog open={deleteFeedConfirmId !== null} ...>`。
- `frontend/src/components/settings/SubscriptionsTab.tsx:259` 的 `handleDeleteFeed` 用原生 `window.confirm`（无 overlay 嵌套，当前不卡，但交互不统一）。

## Requirements

### R1 — 用 Radix 标准方式从 ContextMenu 打开确认 Dialog，消除时序层冲突

侧边栏删除订阅源的确认项改用 `ContextMenuItem` 的 `onSelect`（Radix 标准回调）+ `setTimeout(() => setDeleteFeedConfirmId(feed.id), 0)` 把 Dialog 挂载推迟到菜单 DismissableLayer 卸载之后，而不是当前的 `onClick` + `stopPropagation`。

### R2 — 删除成功后清理失效的选中态

`handleDeleteFeed` 的 `onSuccess` 在 `setDeleteFeedConfirmId(null)` + toast 基础上，补上：若被删 feed 正是当前 `selectedFeedId`，则把文章列表切回"全部"视图（`selectedFeedId: null`、`articleListFilter: "all"`、`selectedArticleId: null`），避免选中态指向已不存在的 feed，也消除 ContextMenu trigger 围绕已删 feed 重挂载的二级诱因。

### R3 — 设置页单删改为 Radix AlertDialog（统一交互，不引入新层冲突）

`SubscriptionsTab.tsx` 的 `handleDeleteFeed` 改为受控 `AlertDialog`：新增 `deleteFeedConfirmId` state + 底部一个独立 `AlertDialog`（与同页批量删除 AlertDialog 并存，互不干扰）。单删触发点是 `DropdownMenuItem`（`SubscriptionsTab.tsx:536`），DropdownMenu 同样基于 `DismissableLayer`，因此 item 必须改用 `onSelect` + `setTimeout` 打开 AlertDialog，而不是照搬 `onClick`。复用 i18n key `deleteFeedConfirm`（已存在），不新增 key。

### R4 — 对齐 `react-dismissable-layer` 单一版本（治根因 A）

在 `frontend/package.json` 加 `overrides`，强制把 `@radix-ui/react-dismissable-layer` 固定到 `1.1.13`（dialog 已在用的版本，把 menu/popover/select/toast 的 1.1.11 提到 1.1.13，纯 patch 升级、API 兼容），跑 `npm install` 更新 lockfile，使整棵依赖树只剩一份实例。

## Acceptance Criteria

- [ ] 在侧边栏右键一个订阅源 → 选删除 → 在确认 Dialog 点确认后，界面不卡死，可正常点击侧边栏其它项、文章列表、设置等。
- [ ] 确认 Dialog 取消（点遮罩 / 点取消按钮 / Esc）同样不卡死。
- [ ] 被删的订阅源若正是当前选中项，删除后文章列表自动回到"全部"视图，不指向已失效 feed。
- [ ] 删除成功的 toast 仍然出现。
- [ ] 设置页单删订阅源：从 feed 行菜单选删除 → 弹出 AlertDialog（不再是浏览器原生 confirm）→ 确认后删除成功、toast 出现、菜单与 Dialog 都干净关闭、整页可交互。
- [ ] 设置页单删的取消（点遮罩 / 取消按钮 / Esc）不卡死。
- [ ] 设置页批量删除行为不变（回归无变化）。
- [ ] `npm explain @radix-ui/react-dismissable-layer` 显示只剩一份实例（1.1.13）。
- [ ] `pnpm lint` / type-check（或项目实际命令）通过。

## Out of Scope

- 右键菜单 / 设置页 feed 行内其它项（刷新、设置、移动分类、编辑）的行为。
- 后端删除接口逻辑。
- 批量删除 AlertDialog 的现有实现（已正常工作，仅作风格对照）。
- 升级 Radix 包到新 minor/大版本（R4 只做 patch 版对齐，不做 caret 区间外的升级）。

## Technical Notes

- 平台：Pi（sub-agent dispatch）。
- 受影响文件：`frontend/src/components/Sidebar.tsx`（R1+R2）；`frontend/src/components/settings/SubscriptionsTab.tsx`（R3）；`frontend/package.json` + `frontend/package-lock.json`（R4）。
- `frontend/src/api/hooks.ts` 的 `useDeleteFeed`：onSuccess 不在 hook 内改，保持在各调用处改，与现有风格一致。
- i18n：`deleteFeedConfirm` 文案键已存在于两个 namespace，AlertDialog 直接复用，不新增 key。
- 根因详情与标准写法出处见 `research/radix-overlay-to-overlay-transition.md`（Radix #3317 / #1836 / #1241 / #3645）。
- 验收以手动操作（卡死判定）+ `npm explain` 单实例核对 + lint/type-check 为准（无专门 e2e 覆盖该交互）。
