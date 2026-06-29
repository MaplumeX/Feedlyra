# Implement — 订阅源批量编辑

## Ordered Checklist

### Phase A — Backend（后端先行，给前端可调端点）

1. **[schema]** `backend/app/schemas/feed.py` 新增：
   - `BulkFeedMoveRequest(feed_ids: list[UUID]=Field(min_length=1), category_id: UUID|None=None)`
   - `BulkFeedDeleteRequest(feed_ids: list[UUID]=Field(min_length=1))`
   - `BulkMoveResult(updated: list[UUID], not_found: list[UUID])`
   - `BulkDeleteResult(deleted: list[UUID], not_found: list[UUID])`
2. **[router]** `backend/app/routers/feeds.py` 在 `update_feed`（`PUT /{feed_id}`）定义**之前**插入：
   - `POST /bulk/move` → 校验 category 归属 → `SELECT id FROM feed WHERE id IN(...) AND user_id=...` → `UPDATE feed SET category_id=...` → commit → `BulkMoveResult`
   - `POST /bulk/delete` → `SELECT id` → `DELETE FROM feed WHERE id IN found_ids AND user_id=...` → commit → `BulkDeleteResult`
   - 路由顺序关键：`/{feed_id}` 若先注册，`/bulk/move` 会被当作 `feed_id` 解析 UUID 失败返回 422。
3. **[验证]** 启动后端，curl 两端点手测：
   - `POST /api/feeds/bulk/move` body `{"feed_ids":["<uuid>"], "category_id":null}` → 200 `{updated:[...], not_found:[]}`
   - `POST /api/feeds/bulk/delete` body `{"feed_ids":["<uuid>"]}` → 200
   - 空 `feed_ids:[]` → 422

### Phase B — Frontend 依赖与基础组件

4. **[deps]** `cd frontend && pnpm add @radix-ui/react-checkbox @radix-ui/react-alert-dialog`（更新 package.json + lockfile）。
5. **[ui]** 新建 `frontend/src/components/ui/checkbox.tsx`（标准 shadcn checkbox）。
6. **[ui]** 新建 `frontend/src/components/ui/alert-dialog.tsx`（标准 shadcn alert-dialog 全套导出：Root/Trigger/Portal/Overlay/Content/Title/Description/Action/Cancel）。
7. **[types]** `frontend/src/api/types.ts` 新增：
   ```ts
   export interface BulkMoveResult { updated: string[]; not_found: string[]; }
   export interface BulkDeleteResult { deleted: string[]; not_found: string[]; }
   ```

### Phase C — Frontend hooks

8. **[hooks]** `frontend/src/api/hooks.ts` 在 `useDeleteFeed` 附近新增 `useBulkMoveFeeds` 和 `useBulkDeleteFeeds`：
   - `mutationFn` body 字段名 snake_case（`feed_ids`/`category_id`），与 `useAddFeed`/`useUpdateFeed` 一致。
   - `onSuccess` invalidate `queryKeys.feeds.list()`、`queryKeys.articles.all`、`queryKeys.categories.list()`。
   - 不在 hook 内退出选择模式（UI 状态由调用方管）。

### Phase D — i18n

9. **[i18n]** `frontend/src/i18n/locales/en/settings.json` + `zh-CN/settings.json` 新增 key：
   - `bulkEdit`, `selectedCount`（"已选 {{count}}" / "Selected: {{count}}"）, `selectAll`, `cancelBulk`, `moveToCategory`, `uncategorized`（若已有则复用）, `deleteBulkTitle`（"删除 {{count}} 个订阅源？"）, `deleteBulkDescription`("此操作无法撤销。"), `bulkMoved`("已移动 {{count}} 个订阅源到 {{category}}"), `bulkDeleted`("已删除 {{count}} 个订阅源"), `confirmDelete`（删除按钮）。

### Phase E — SubscriptionsTab 集成

10. **[state]** `SubscriptionsTab.tsx` 新增 `selectMode: boolean` + `selectedIds: Set<string>`。
11. **[header]** 列表标题栏右侧条件渲染：
    - 非选择模式：`FeedSortMenu` 旁加"批量编辑"按钮（`ListChecks` 图标）→ `setSelectMode(true)`
    - 选择模式：显示"已选 N"+"全选"+"取消"+ 动作按钮"移动到分类"、"删除"（selectedIds 为空时 disabled）
12. **[row]** feed 行渲染：`selectMode` 时在 `FeedIcon` 前插入 `Checkbox`，`checked={selectedIds.has(feed.id)}`，`onCheckedChange` 增删 `selectedIds`。
13. **[move action]** "移动到分类"按钮触发 `DropdownMenu`：`categories.map` + 顶部"未分类"项（`category_id=null`）；选中 → `mutateAsync({feedIds:[...selectedIds], categoryId})` → `.then(() => 退出选择模式)` → toast `bulkMoved`。`not_found` 非空时 `console.warn`。
14. **[delete action]** "删除"按钮打开 `AlertDialog`（open state local），内容用 `deleteBulkTitle`/`deleteBulkDescription`；Action 按钮 confirm → `mutateAsync({feedIds:[...selectedIds]})` → `.then(() => 退出)` → toast `bulkDeleted`。取消按钮关闭不删。
15. **[exit helper]** `exitSelectMode()` = `setSelectMode(false); setSelectedIds(new Set())`，所有动作成功 + "取消"按钮复用。

## Validation Commands

```bash
# Backend
cd backend && uv run pytest                    # 现有单测不回归
cd backend && uv run uvicorn app.main:app      # 手测两端点

# Frontend
cd frontend && pnpm install                    # 装新依赖
cd frontend && pnpm run lint                   # AC10
cd frontend && pnpm run build                  # AC10
cd frontend && pnpm run test                   # 若有相关单测
```

## Risky Files / Rollback Points

| 文件 | 风险 | 回滚 |
|------|------|------|
| `backend/app/routers/feeds.py` | 路由顺序错误导致 `/bulk/*` 被 `/{feed_id}` 吞 | 把 bulk 端点移到 `/{feed_id}` 端点之前；删 bulk 函数即回滚 |
| `backend/app/schemas/feed.py` | 低 | 删新增 schema 类 |
| `frontend/src/api/hooks.ts` | 低 | 删新增 hook |
| `frontend/src/components/settings/SubscriptionsTab.tsx` | 状态/渲染分支多，易引入回归 | 谨慎条件渲染；回滚还原文件 |
| `frontend/src/components/ui/{checkbox,alert-dialog}.tsx` | 新文件，低危 | 删除文件 |
| `frontend/package.json` + lockfile | 依赖变更 | `git checkout` 还原 |

## Follow-up Checks before `task.py start`

- [ ] prd.md 已收敛（无重复事实、无未解决临时段落）
- [ ] design.md / implement.md 存在
- [ ] `implement.jsonl` / `check.jsonl` 含至少一条真实条目
- [ ] 用户已 review 规划文件
