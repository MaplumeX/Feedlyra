# Design — Fix sidebar delete-feed UI freeze

## 设计目标

用一套统一原则修复两类"从 DismissableLayer overlay item 打开另一个 overlay"的卡死，并对齐底层依赖消除真根因。两个交付（侧边栏、设置页）共用同一模式，互不耦合。

## 架构与边界

```
frontend/src/components/Sidebar.tsx            (R1 + R2)  受影响
frontend/src/components/settings/SubscriptionsTab.tsx (R3)  受影响
frontend/package.json + package-lock.json     (R4)       受影响
frontend/src/api/hooks.ts (useDeleteFeed)     不改      onSuccess 保持在调用处改
```

不新增组件、不抽公共 hook。两处删除确认 Dialog/AlertDialog 各自受控、独立。

## 核心模式：overlay → overlay 安全切换

适用于任何"从 `ContextMenu`/`DropdownMenu` 的 `Item` 打开 `Dialog`/`AlertDialog`"的场景。

**规则**：
1. `Item` 用 `onSelect`，不用 `onClick`，不用 `stopPropagation`。
2. 在 `onSelect` 里用 `setTimeout(() => setState(id), 0)` 把目标 overlay 的挂载推迟到当前菜单 DismissableLayer 卸载之后，打破两套 DismissableLayer 生命周期交错。
3. 目标 overlay 用受控 `open` + `onOpenChange`，不在 trigger 里耦合状态。
4. 破坏性动作（删除）在 `AlertDialogAction` 上 `e.preventDefault()` + 在 mutation `onSuccess` 里手动关，复刻同页批量删除的成熟模式。

**为什么 `onSelect + setTimeout`**：Radix #1836/#3317 评论反复验证的标准 workaround。`onClick` 是原生 DOM 事件，抢在 Radix select/dismiss 调度之前同步切 state；`onSelect` 是 Radix 协调过的回调，`setTimeout(0)` 把目标 overlay 挂载推到菜单 cleanup 之后，避免 Dialog 把"body 已被 menu 设成 none"误记为 original 值。

**为什么 R4 必须叠加**：若双 `react-dismissable-layer` 实例（1.1.11 + 1.1.13）仍在，`onSelect + setTimeout` 能极大降低触发概率，但仍可能偶发残留 `pointer-events: none`。R4 用 npm `overrides` 把全树固定到 1.1.13，从源头消除跨实例状态隔离。

## 数据流

### 侧边栏删除（R1+R2）

```
右键 feed → ContextMenu 打开
  → 点删除 item → onSelect → setTimeout(0) → setDeleteFeedConfirmId(feed.id)
  → ContextMenu 按标准流程 unmount（恢复 body）
  → 下一帧 Dialog 挂载（其 DismissableLayer 读到干净的 body 原值）
  → 用户点确认 → handleDeleteFeed(feedId)
  → deleteFeed.mutate → onSuccess:
       setDeleteFeedConfirmId(null)
       if (selectedFeedId === feedId) setReader({ selectedFeedId:null, articleListFilter:"all", selectedArticleId:null })
       toast.success(feedDeleted)
```

### 设置页单删（R3）

```
feed 行 ... 菜单 → DropdownMenu 打开
  → 点删除 item → onSelect → setTimeout(0) → setDeleteFeedConfirmId(feed.id)
  → DropdownMenu 标准卸载
  → AlertDialog 挂载
  → 用户点 Action → e.preventDefault() → handleDeleteFeed(id)
  → deleteFeed.mutate → onSuccess: setDeleteFeedConfirmId(null) + toast
```

## R4 版本对齐策略

**目标版本**：`1.1.13`（`react-dialog` 已在用的版本）。

**机制**：`frontend/package.json` 增加：
```jsonc
"overrides": {
  "@radix-ui/react-dismissable-layer": "1.1.13"
}
```
npm overrides 强制整棵依赖树中所有 `@radix-ui/react-dismissable-layer` 解析到 1.1.13，即使 `react-menu`/`react-popover`/`react-select`/`react-toast` 的 dependencies 把它硬锁在 `"1.1.11"`（非 caret）。

**风险**：1.1.11 → 1.1.13 是纯 patch 升级，`react-dismissable-layer` API 无破坏性变化，`react-menu@2.1.16` 等用 1.1.11 验证过的包消费 1.1.13 兼容。风险面集中在"patch 升级是否引入行为细微变化"——可接受，且只影响 overlay 层，验收路径（删除确认）会直接覆盖。

**回滚**：删掉 `overrides` 字段 + `npm install` 即恢复双实例状态（但卡死会复现）。R4 与 R1/R2/R3 在同一 PR，任一阶段失败都可单独 revert 对应文件。

## i18n

- 复用 `deleteFeed` / `deleteFeedConfirm` / `cancel` / `delete`（common namespace）/ `feedDeleted`。已在两个 namespace 存在，不新增 key。
- 设置页 AlertDialog 的 Cancel/Action 文案与同页批量删除对齐复用（如 `cancelBulk` 已有则用，否则用 `cancel` common key）。

## 兼容性 / 回归

- 批量删除 AlertDialog（`SubscriptionsTab.tsx` 现有 `deleteDialogOpen` 那个）完全不动。
- 右键菜单其它项（刷新/设置/移动分类）保持现有 `onClick`（Out of Scope），仅删除项改 `onSelect`。
- `useDeleteFeed` hook 内 `onSuccess` 不动（只 invalidate queries），各调用处自行处理 UI 状态，与现有风格一致。

## tradeoffs

- **没选 `modal={false}`**：能给 DropdownMenu 从源头消除 pointer-events 冲突，但改变键盘焦点行为、影响面比 `onSelect+setTimeout` 大，且本任务主要路径是 ContextMenu（`modal={false}` 对 ContextMenu 帮助有限）。留作若 R4 后仍偶发的备选。
- **没选升级到最新 Radix 包**：超出本 bug 范围，无其它升级动机，回归面大。
- **没把右键菜单其它项也改成 `onSelect`**：Out of Scope，避免膨胀改动面；只改触发卡死的删除项。
