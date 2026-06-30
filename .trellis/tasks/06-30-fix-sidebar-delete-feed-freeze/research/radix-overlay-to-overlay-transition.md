# Radix overlay→overlay 切换卡死：根因与标准写法

研究范围：从 Radix `ContextMenu` / `DropdownMenu` 的 `Item`（基于 `DismissableLayer`）打开另一个基于 portal/`DismissableLayer` 的 overlay（`Dialog` / `AlertDialog`）时的标准写法，以及"整页可见但点不动（body 残留 `pointer-events: none`）"的根因。

研究方法：读取项目实际源码 + 抓取 Radix GitHub issue 原文与评论（#3317, #1241, #1836, #818, #3645）+ 检查本仓库 `node_modules` 里 `react-dismissable-layer` 的实际安装情况。

---

## 1. 根因机制（两个独立成因，必须同时理解）

### 1.1 成因 A（更深、且本仓库命中）：多个 `react-dismissable-layer` 实例版本不一致

`Dialog` / `AlertDialog` / `ContextMenu` / `DropdownMenu` / `Popover` / `Select` 这些 overlay 全都依赖底层包 `@radix-ui/react-dismissable-layer`。该包内部用一个模块级变量 `originalBodyPointerEvents` 记录"打开 overlay 之前 body 的 pointer-events 原值"，在 overlay 关闭时恢复成这个原值（[源码](https://github.com/radix-ui/primitives/blob/main/packages/react/dismissable-layer/src/DismissableLayer.tsx)）。**这个状态是按"包实例"隔离的**：如果打包后存在两份不同版本的 `react-dismissable-layer`，它们各自维护一份 `originalBodyPointerEvents`，互不可见 —— 于是两层 overlay 的卸载/恢复顺序一旦交叉，就会把"已被另一层改成 `none` 的值"当成"原始值"记住，关闭后恢复成 `none`，body 永久 `pointer-events: none`。

这正是 Radix issue **#3317「Opening a Dialog programmatically from a Dropdown Menu item freezes the UI」** 的核心，也是 @markuslewin / @lpatino10 / @iord-eduardgabriel 在评论里反复验证的：用 `npm explain @radix-ui/react-dismissable-layer` 看到两份不同版本，对齐后卡死消失。维护者 @chaance 最后把该 issue redirect 到统一跟踪 issue **#3645**。

**本仓库实测命中该情况**（`frontend` 下，截至研究时）：

| 包 | 实际版本 | 其依赖的 `react-dismissable-layer` |
| --- | --- | --- |
| `@radix-ui/react-dialog` | 1.1.17 | 1.1.13（独立嵌套在 `react-dialog/node_modules/` 下） |
| `@radix-ui/react-alert-dialog` | 1.1.17 | 经由顶层 `react-dialog@1.1.17` 间接拿到 1.1.13 |
| `@radix-ui/react-context-menu` | 2.2.16 → `react-menu` | 1.1.11（顶层 hoisted 版本） |
| `@radix-ui/react-dropdown-menu` | 2.1.16 → `react-menu` | 1.1.11（顶层 hoisted 版本） |
| 顶层 `react-dismissable-layer` | 1.1.11 | — |

即 `frontend/node_modules` 里实际存在 **两份** `react-dismissable-layer`：
- `node_modules/@radix-ui/react-dismissable-layer` → 1.1.11（给 ContextMenu / DropdownMenu / Popover / Select / Toast 用）
- `node_modules/@radix-ui/react-dialog/node_modules/@radix-ui/react-dismissable-layer` → 1.1.13（给 Dialog / AlertDialog 用）

`package.json` 里声明的 `^1.1.15`（dialog）与 `^2.2.16`（context-menu）等 caret 区间允许 resolver 拉到这种"主版本相同、dismissable-layer 子依赖错位"的组合。**因此：从侧边栏右键菜单（menu 用 1.1.11）打开删除确认 Dialog（用 1.1.13）时，跨了两份 DismissableLayer 实例，命中 #3317 的精确触发条件。** 这与代码里用的是 `onClick` 还是 `onSelect` 无关 —— 即便写对 `onSelect`，只要双实例存在，仍可能残留 `pointer-events: none`。

> PRD 的 Root Cause 段落把锅全放在 `onClick + stopPropagation` 上是不完整的。`onClick` 是放大时序问题的"加速器"（见 1.2），但持久卡死的"必要条件"是 DismissableLayer 双实例。两者都应修。

### 1.2 成因 B（时序放大器）：`ContextMenuItem` 上用 `onClick` 而非 Radix 标准 `onSelect`

Radix 的 `ContextMenu.Item` / `DropdownMenu.Item` 设计上是"被选中时触发 `onSelect`，菜单自身的关闭流程（unmount + 恢复 body 状态）随后/并行进行"。`onClick` 是原生 DOM 事件，会在 Radix 内部的 select/dismiss 调度之前就同步触发了状态切换，于是：

1. `onClick` 同步 `setDeleteFeedConfirmId(feed.id)` → rerender 把 Dialog 挂上（其 DismissableLayer 立刻读取"当前 body pointer-events"作为 original 值，而此刻 menu 还没卸载、body 可能已是 `none`）。
2. 菜单随后开始 unmount，它的 DismissableLayer 在 cleanup 里把 body 恢复成"它以为的原始值"——但那个值已被 Dialog 改写，于是恢复成 `none`。
3. Dialog 关闭时又把 body 恢复成它当初记下的 `none`。
4. 结果：body 永久 `none`，整页可见但不可点。

`e.stopPropagation()` 不能阻止这一切，因为问题不在事件冒泡，而在两套 DismissableLayer 的生命周期交错。`onSelect` 是 Radix 官方回调，与菜单内部状态机协调过，时序上更可控；若再配合 `e.preventDefault()`（阻止菜单自动关闭）或 `setTimeout(..., 0)`（把 Dialog 挂载推迟到 menu cleanup 之后），就能彻底打破时序耦合。

参考 issue：
- **#3317** OP 明确指出根因可能是 [`originalBodyPointerEvents`](https://github.com/radix-ui/primitives/blob/dae8ef4920b45f736e2574abf23676efab103645/packages/react/dismissable-layer/src/DismissableLayer.tsx#L116) 被两套 DismissableLayer 改写。
- **#1836** 评论区给出 `onSelect={(e) => e.preventDefault()}` 与 `modal={false}` 两种官方式 workaround。
- **#1241**（Urgent / Priority 标签）历史性追踪 body pointer-events 残留问题，多次随版本复现。

---

## 2. 官方/社区推荐写法（带出处，区分两种组合）

### 2.0 前提：先对齐 `react-dismissable-layer` 实例（根因 A 的标准修法）

这是 Radix 维护者与多名用户在 #3317 评论区一致给的"真正修法"，优先于任何代码层 workaround：

1. `npm explain @radix-ui/react-dismissable-layer`（或 `pnpm why`）确认是否多份。
2. 升级所有消费该包的 Radix 包到彼此对齐的版本（评论 #lpatino10 / #iord-eduardgabriel 的清单）：
   ```
   @radix-ui/react-alert-dialog -> ^1.1.15
   @radix-ui/react-dialog        -> ^1.1.15
   @radix-ui/react-popover       -> ^1.1.15
   @radix-ui/react-dropdown-menu -> 最新
   @radix-ui/react-context-menu  -> 最新
   ```
3. 若升级后仍因 bundler 各自打包出两份实例（Vite `optimizeDeps` 问题），用 **#dsrominiyi** 给的 Vite 配置：
   ```ts
   // vite.config.ts
   optimizeDeps: {
     exclude: [
       "@radix-ui/react-dialog",
       "@radix-ui/react-dropdown-menu",
       "@radix-ui/react-context-menu",
       "@radix-ui/react-popover",
       "@radix-ui/react-select",
     ],
   },
   ```
4. 或在 pnpm 里用 `overrides` 强制单一版本（#brunouber）：
   ```jsonc
   // package.json
   "pnpm": {
     "overrides": {
       "@radix-ui/react-dismissable-layer": "1.1.13"
     }
   }
   ```

> 本任务受 Scope 限制（只改 `Sidebar.tsx` + `SubscriptionsTab.tsx`，不动 deps / 配置）。但**必须把这条记给工程 owner**：若只改代码层、不动双实例，卡死可能仍偶发；R1/R2 完成后建议追加一个"对齐 DismissableLayer 版本"的小改动。下文代码层方案在双实例存在时也能显著降低触发概率，且是 Radix 标准写法，无论根因 A 是否单独修都应落地。

### 2.1 ContextMenu → Dialog（对应 `Sidebar.tsx` 删除项，R1）

**不要**用 `onClick` + `stopPropagation`。改用 `onSelect`，并二选一时序处理：

**方案 B1（推荐，最贴近本任务现状）：`onSelect` + `setTimeout` 延迟挂 Dialog**

让菜单先走完自己的关闭流程（unmount DismissableLayer、恢复 body），下一帧再挂 Dialog，避免两层 DismissableLayer 同时活着。

```tsx
<ContextMenuItem
  className="text-destructive"
  onSelect={(e) => {
    // 不 preventDefault：让 ContextMenu 按标准流程关闭
    // 推迟到下一帧，等菜单 DismissableLayer 卸载完毕再挂 Dialog，
    // 避免 Dialog 把"body 已被 menu 设成 none"误记为 original 值
    setTimeout(() => setDeleteFeedConfirmId(feed.id), 0);
  }}
>
  <Trash2 className="mr-2 h-4 w-4" />
  {t("delete", { ns: "common" })}
</ContextMenuItem>
```

**方案 B2（shadcn 社区另一通用写法）：用 `DialogTrigger asChild` 包 `ContextMenuItem` + `onSelect preventDefault`**

`preventDefault` 阻止菜单自动关闭，由 Dialog 自己接管焦点/层。缺点：菜单不再自动消失（需要后续手动关闭），且把 Dialog 的 trigger 跟 menu item 耦合在一起，对"删除前需要 confirmedId 来渲染 Dialog footer 按钮"这种受控 Dialog 略别扭。本任务的删除确认 Dialog 是受控、按 id 渲染的，**B1 更合适**。

```tsx
// 参考写法，非本任务首选
<Dialog>
  <DialogTrigger asChild>
    {/* 注意：这里 ContextMenuItem 不再带 onClick */}
    <ContextMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
      <Trash2 className="mr-2 h-4 w-4" />
      {t("delete", { ns: "common" })}
    </ContextMenuItem>
  </DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog>
```

出处：Radix #1836 评论 @luneShaoGM、@soulbliss；shadcn/ui issue #386 评论引用的 codesandbox `r9sq1q`；Radix 维护者 @benoitgrelard 在 #1836 称其为"correct way to handle composition of Dialog and DropdownMenu"。

### 2.2 DropdownMenu → AlertDialog（对应 `SubscriptionsTab.tsx` 单删，R3）

DropdownMenu 与 ContextMenu 同源于 `react-menu`，问题与解法完全一致。shadcn 社区针对 DropdownMenu 还多一个高赞选项：在 `DropdownMenu.Root` 上设 `modal={false}`（#Kynno、#brunofilho1）。

> `modal={false}` 让菜单不往 body 加 `pointer-events: none`、不抢焦点锁，从源头消除"两层 DismissableLayer 互相改写 body pointer-events"的冲突。代价：菜单不再模态（右键外部不会被拦截）。对设置页 feed 行内的小 `...` 菜单，这点通常是可接受的；但它会改变键盘焦点行为，需要权衡。本任务 PRD 要求"批量删除行为不变"，且单删与批量删共用同一渲染上下文 —— 给单个 DropdownMenu 加 `modal={false}` 影响面小，可作为候选；但**更稳妥、改动面更小的是 `onSelect + setTimeout`**（与 R1 对称，风险最低）。

**推荐写法（R3）：`onSelect` + `setTimeout`**

```tsx
<DropdownMenuItem
  className="text-destructive"
  onSelect={(e) => {
    // 不要用 onClick：DropdownMenu 同样基于 DismissableLayer，
    // onClick 会在菜单 select 流程之前同步触发，撞上与 R1 同类的层冲突
    setTimeout(() => setDeleteFeedConfirmId(feed.id), 0);
  }}
>
  <Trash2 className="mr-2 h-3.5 w-3.5" />
  {t("deleteFeed")}
</DropdownMenuItem>
```

外层挂一个独立的受控 `AlertDialog`（与同页批量删除那个并存，不要复用）：

```tsx
<AlertDialog
  open={deleteFeedConfirmId !== null}
  onOpenChange={(open) => { if (!open) setDeleteFeedConfirmId(null); }}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{t("deleteFeed")}</AlertDialogTitle>
      <AlertDialogDescription>{t("deleteFeedConfirm")}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{t("cancelBulk")}</AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        disabled={deleteFeed.isPending}
        onClick={(e) => {
          e.preventDefault(); // 阻止 AlertDialog 默认关闭，等 mutate 成功后再关
          if (deleteFeedConfirmId) handleDeleteFeed(deleteFeedConfirmId);
        }}
      >
        {t("confirmDelete")}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

`AlertDialogAction` 上 `e.preventDefault()` + 在 `onSuccess` 里手动关，复刻同页批量删除的成熟模式（见 `SubscriptionsTab.tsx` 现有 `bulkDelete` 分支）。

出处：#1836（`onSelect` + `preventDefault`）、#818（维护者 @benoitgrelard 的组合 codesandbox）、shadcn/ui #386（社区 TS + 受控写法，@magoz 的 `DropdownActions` 例）。

### 2.3 可选加强：受控菜单 + 关 Dialog 时同步关菜单

shadcn #386 里 @magoz 给的 TS 例（`dropdownOpen` + `hasOpenDialog` 双 state + `modal={false}` + 把焦点 ref 还给 trigger）是"完美派"写法，能保证 Esc / 点遮罩 / 关 Dialog 后焦点与菜单状态都干净。本任务手动验收为准、无 a11y 强制要求，**若验收发现取消 Dialog 后菜单残留焦点异常再考虑引入**，否则 `onSelect + setTimeout` 已足够。

---

## 3. AlertDialog 是否比 Dialog 在此场景"更安全"？

不本质更安全。`AlertDialog` 在 Radix 内部就是 `react-dialog` 的封装（同一份 DismissableLayer、同一个 portal 机制）。它和 `Dialog` 的差异仅在于：
- `AlertDialog` 默认不响应"点外部遮罩关闭"、不响应 Esc 直接关闭（必须用 `Cancel`/`Action` 触发），降低了"半开半关竞态"的概率。
- 语义上适合"确认/破坏性操作"。

但因为层管理代码与 `Dialog` 共享，**版本双实例问题（根因 A）对两者一视同仁**。对"DropdownMenu → AlertDialog"组合，仍必须用 `onSelect`（非 `onClick`）+ 必要时序处理；无需为 AlertDialog 额外特殊处理。所以 R3 用 AlertDialog 是正确选择（统一交互、语义合适），但别指望它"自动"绕过层冲突。

---

## 4. 对本任务的实现建议（落到代码）

### 4.1 `Sidebar.tsx`（R1 + R2）

R1 — 删除 `ContextMenuItem`：

- 把 `onClick={(e) => { e.stopPropagation(); setDeleteFeedConfirmId(feed.id); }}` 改为：
  ```tsx
  onSelect={() => setTimeout(() => setDeleteFeedConfirmId(feed.id), 0)}
  ```
- 移除 `e.stopPropagation()`（无意义且掩盖问题）。
- 其余 refresh / settings / move 子项可暂保持 `onClick`（PRD Out of Scope），但**建议顺手把同类 `onClick + stopPropagation` 统一看一眼**——研究阶段只做建议，不动它们。

R2 — `handleDeleteFeed` 的 `onSuccess` 补清理：

```tsx
function handleDeleteFeed(feedId: string) {
  deleteFeed.mutate(feedId, {
    onSuccess: () => {
      setDeleteFeedConfirmId(null);
      // 若删的正是当前选中 feed，回退到"全部"视图，避免选中态指向已失效 feed
      // —— 这同时避免 ContextMenu trigger 围绕已不存在的 feed 重挂载触发 portal 生命周期问题
      if (selectedFeedId === feedId) {
        setReader({
          selectedFeedId: null,
          articleListFilter: "all",
          selectedArticleId: null,
        });
      }
      toast.success(t("feedDeleted"));
    },
  });
}
```

注：`setDeleteFeedConfirmId` / `selectedFeedId` / `setReader` 在 `Sidebar` 闭包里都已可访问，无需新增依赖。R2 既是 PRD 要求，也直接削弱了"被删 feed 仍被选中 → trigger 重挂载"这个二级卡死诱因。

### 4.2 `SubscriptionsTab.tsx`（R3）

- 新增 `const [deleteFeedConfirmId, setDeleteFeedConfirmId] = useState<string | null>(null);`
- feed 行的 `DropdownMenuItem`（删除项）`onClick={() => handleDeleteFeed(feed)}` 改为 `onSelect={() => setTimeout(() => setDeleteFeedConfirmId(feed.id), 0)}`，并把 `handleDeleteFeed` 内的 `window.confirm` 分支删掉（改为受控 AlertDialog 触发）。
- `handleDeleteFeed` 改为直接 `deleteFeed.mutate(feedId, { onSuccess: () => { setDeleteFeedConfirmId(null); toast.success(t("feedDeleted")); } })`。
- 文件底部新增一个独立 `AlertDialog`（见 2.2 代码），`open={deleteFeedConfirmId !== null}`，与既有批量删除 AlertDialog 并存。
- 复用 i18n key `deleteFeedConfirm`（PRD 已确认存在），不新增 key。
- 批量删除那个 `AlertDialog` + `setDeleteDialogOpen` 完全不动（Out of Scope）。

### 4.3 验收对照

- R1/R3 的 `onSelect + setTimeout` 是 Radix #1836/#3317 评论里反复验证的标准 workaround，单独使用即可消除绝大多数时序型卡死。
- 但**若验收仍偶发卡死**，几乎必是根因 A（双 `react-dismissable-layer` 实例，已在本仓库实测命中）。届时追加：升级 `context-menu`/`dropdown-menu` 到与 `dialog@1.1.17` 对齐的版本，或加 pnpm `overrides` / Vite `optimizeDeps.exclude`。这条建议需另开任务（超出当前 Scope），但实现者应知晓。

---

## 5. 关键参考链接

- Radix #3317 — Opening a Dialog programmatically from a Dropdown Menu item freezes the UI（本 bug 几乎逐字复刻，body 残留 pointer-events: none）— https://github.com/radix-ui/primitives/issues/3317
- Radix #3645 — 维护者把 #3317 等统一跟踪到这里 — https://github.com/radix-ui/primitives/issues/3645
- Radix #1241 — [Dialog] body pointer-events: none remains after closing（Urgent，长期追踪）— https://github.com/radix-ui/primitives/issues/1241
- Radix #1836 — Dialog.Trigger does not work if trigger is Dropdown.Item（`onSelect preventDefault` / `modal={false}` 的官方式 workaround 出处）— https://github.com/radix-ui/primitives/issues/1836
- Radix #818 — [DropdownMenu][Menu] Allow dialog composition（维护者 @benoitgrelard 给出推荐组合 codesandbox）— https://github.com/radix-ui/primitives/issues/818
- shadcn/ui #386 — 社区 TS + shadcn 受控 DropdownMenu→Dialog 写法（@magoz）— https://github.com/shadcn-ui/ui/issues/386
- DismissableLayer `originalBodyPointerEvents` 源码 — https://github.com/radix-ui/primitives/blob/main/packages/react/dismissable-layer/src/DismissableLayer.tsx
- Radix ContextMenu 文档（`onSelect` / `modal`）— https://www.radix-ui.com/primitives/docs/components/context-menu
- shadcn AlertDialog 文档（R3 复用文案/组合）— https://ui.shadcn.com/docs/components/alert-dialog

---

## 6. 一句话结论

卡死 = "双 `react-dismissable-layer` 实例（本仓库已实测命中 1.1.11 + 1.1.13）" × "`onClick` 抢在 Radix select 流程前同步切 state 时序"。代码层用 **`onSelect` + `setTimeout(..., 0)`**（ContextMenu→Dialog 与 DropdownMenu→AlertDialog 对称处理）是 Radix 官方/社区一致推荐且与 R1/R3 改动面最小的标准写法；R2 补 selectedFeedId 清理消除二级诱因；若验收仍偶发，再升级/对齐 dismissable-layer 版本。本研究未修改任何 `src/` 代码。
