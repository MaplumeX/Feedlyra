# Implement — Fix sidebar delete-feed UI freeze

## 执行顺序

> 从根因对应面下手：先治依赖双实例（R4），再改两处 UI（R1/R2 一起，R3 一起）。R4 先做让后续 UI 改动的验证环境干净；R1/R2/R3 各自独立可验证。

### Step 1 — R4 对齐 dismissable-layer 单一版本

- [ ] 编辑 `frontend/package.json`，在顶层加：
  ```jsonc
  "overrides": {
    "@radix-ui/react-dismissable-layer": "1.1.13"
  }
  ```
  （放在 `"dependencies"` / `"devDependencies"` 同级。若已有 `overrides` 字段则合并进去。）
- [ ] 在 `frontend/` 下跑 `npm install` 更新 `package-lock.json`。
- [ ] 验证单实例：`npm explain @radix-ui/react-dismissable-layer` 应只剩 `1.1.13`，且 `node_modules/@radix-ui/react-dialog/node_modules/@radix-ui/react-dismissable-layer` 不再存在。
- [ ] 确认 `npm ls @radix-ui/react-dismissable-layer` 无 dedupe 警告。

**回滚点**：仅 `package.json` + `package-lock.json` 两文件改动，revert 即恢复双实例。

### Step 2 — R1 + R2 侧边栏删除（`Sidebar.tsx`）

- [ ] `renderFeedItem` 里删除项的 `ContextMenuItem`：
  - 把 `onClick={(e) => { e.stopPropagation(); setDeleteFeedConfirmId(feed.id); }}` 改为
    `onSelect={() => setTimeout(() => setDeleteFeedConfirmId(feed.id), 0)}`
  - 移除 `e.stopPropagation()`。
- [ ] `handleDeleteFeed` 的 `onSuccess`：
  ```ts
  onSuccess: () => {
    setDeleteFeedConfirmId(null);
    if (selectedFeedId === feedId) {
      setReader({
        selectedFeedId: null,
        articleListFilter: "all",
        selectedArticleId: null,
      });
    }
    toast.success(t("feedDeleted"));
  }
  ```
- [ ] 不动底部 `<Dialog open={deleteFeedConfirmId !== null} ...>` 的结构（受控写法已符合设计）。
- [ ] 不动右键菜单其它项（refresh/settings/moveToCategory）—— Out of Scope。

**验证**：手动在侧边栏右键 feed → 删除 → 确认 / 取消 / Esc / 点遮罩，均不卡死；删当前选中 feed 后文章列表回到"全部"视图；toast 出现。

### Step 3 — R3 设置页单删改 AlertDialog（`SubscriptionsTab.tsx`）

- [ ] 新增 state：`const [deleteFeedConfirmId, setDeleteFeedConfirmId] = useState<string | null>(null);`
- [ ] feed 行删除 `DropdownMenuItem`：
  - `onClick={() => handleDeleteFeed(feed)}` 改为
    `onSelect={() => setTimeout(() => setDeleteFeedConfirmId(feed.id), 0)}`
- [ ] `handleDeleteFeed` 改造（去掉 `window.confirm`）：
  ```ts
  function handleDeleteFeed(feedId: string) {
    deleteFeed.mutate(feedId, {
      onSuccess: () => {
        setDeleteFeedConfirmId(null);
        toast.success(t("feedDeleted"));
      },
    });
  }
  ```
  注意：原签名是 `handleDeleteFeed(feed: Feed)`，调用处（onSelect）已传 `feed.id`，签名改 `feedId: string`，调用方对齐。
- [ ] 文件底部（与现有批量删除 AlertDialog 并存，不动那个）新增一个独立 AlertDialog：
  - `open={deleteFeedConfirmId !== null}`
  - `onOpenChange={(open) => { if (!open) setDeleteFeedConfirmId(null); }}`
  - Title: `{t("deleteFeed")}`，Description: `{t("deleteFeedConfirm")}`
  - Cancel button: `{t("cancel", { ns: "common" })}`（与同页 cancel 用法对齐）
  - `AlertDialogAction`（destructive 样式，参考同页批量删除的 Action）：
    - `disabled={deleteFeed.isPending}`
    - `onClick={(e) => { e.preventDefault(); if (deleteFeedConfirmId) handleDeleteFeed(deleteFeedConfirmId); }}`
    - 文案: `{t("delete", { ns: "common" })}`
- [ ] 确认 `AlertDialog*` 已从 `@/components/ui/alert-dialog` import（文件顶部已有批量删除用的 import，复用）。
- [ ] 不动 `deleteDialogOpen` / `handleBulkDelete` 那套批量删除流程。

**验证**：设置页 feed 行 `...` → 删除 → 弹 AlertDialog（非原生 confirm）→ 确认删除成功 + toast + 干净关闭；取消 / Esc / 点遮罩不卡死；批量删除行为不变。

### Step 4 — 质量门

- [ ] `cd frontend && pnpm lint`（或 `npm run lint`，按 package.json 实际 script）
- [ ] type-check（`pnpm tsc --noEmit` 或项目实际命令）
- [ ] `npm explain @radix-ui/react-dismissable-layer` 再次确认单实例。
- [ ] 全链路手测：侧边栏删除（确认/取消各路径）、设置页单删（确认/取消各路径）、设置页批量删除回归。

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| R4 overrides 后某个 menu 包行为异常 | patch 升级、API 兼容；异常即 revert `package.json`+lockfile，R1/R3 的 `onSelect+setTimeout` 仍独立有效 |
| Step 2/3 `setTimeout(0)` 在某些浏览器仍偶发 | 先按设计落地；若验收偶发，备选 `DropdownMenu modal={false}`（design.md tradeoffs 已记） |
| 设置页 cancel/confirm 文案 key 与现有不一致 | 实现时对照同页批量删除 AlertDialog 用的 key；不一致则复用 `cancel`/`delete` common key |

## 跟进（不在本任务）

- 右键菜单其它项是否统一改 `onSelect`（Out of Scope，单独评估）。
- Radix 包是否整体升级到新 minor（无其它动机前不动）。
