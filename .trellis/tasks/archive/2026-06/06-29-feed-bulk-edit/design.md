# Design — 订阅源批量编辑

## Architecture & Boundaries

跨层改动：后端新增 2 个批量端点 + 响应 schema；前端新增 2 个 UI 组件（checkbox / alert-dialog）、2 个 hooks、1 个状态（selectedIds + 选择模式开关）。

### Backend

**新增 schemas**（`backend/app/schemas/feed.py`）：

```python
class BulkFeedMoveRequest(BaseModel):
    feed_ids: list[UUID] = Field(min_length=1)
    category_id: UUID | None = None

class BulkFeedDeleteRequest(BaseModel):
    feed_ids: list[UUID] = Field(min_length=1)

class BulkFeedResult(BaseModel):
    updated: list[UUID] = []        # 移动端点用 updated；删除端点复用结构但字段名 deleted
    deleted: list[UUID] = []
    not_found: list[UUID] = []
```

为避免一个 schema 塞两个互斥字段，拆成两个 result schema 更干净：

```python
class BulkMoveResult(BaseModel):
    updated: list[UUID]
    not_found: list[UUID]

class BulkDeleteResult(BaseModel):
    deleted: list[UUID]
    not_found: list[UUID]
```

**新增 router 端点**（`backend/app/routers/feeds.py`）：

```python
@router.post("/bulk/move", response_model=BulkMoveResult)
async def bulk_move_feeds(body, db, user):
    # 1. 若 category_id 非 None，校验归属 → 404 Category not found
    # 2. SELECT id FROM feed WHERE id IN feed_ids AND user_id = user.id → found_ids
    # 3. not_found = set(feed_ids) - set(found_ids)
    # 4. UPDATE feed SET category_id = body.category_id WHERE id IN found_ids
    # 5. commit; return BulkMoveResult(updated=found_ids, not_found=not_found)
```

```python
@router.post("/bulk/delete", response_model=BulkDeleteResult)
async def bulk_delete_feeds(body, db, user):
    # 1. SELECT id FROM feed WHERE id IN feed_ids AND user_id = user.id → found_ids
    # 2. DELETE FROM feed WHERE id IN found_ids (注意：found_ids 已过滤 user_id，DELETE 仍带 user_id 保险)
    # 3. not_found = set(feed_ids) - set(found_ids)
    # 4. commit; return BulkDeleteResult(deleted=found_ids, not_found=not_found)
```

**路由顺序注意**：FastAPI 路径匹配 `/{feed_id}` 会吞掉 `/bulk/...` 吗？不会——`/bulk/move` 与 `/{feed_id}` 是同级不同字面量，FastAPI 按注册顺序静态段优先。但为避免歧义，把 `/bulk/*` 端点**注册在 `/{feed_id}` 之前**（在本文件中即移到 `update_feed` / `delete_feed` 之前）。这是真实风险点（FastAPI 中 `/{feed_id}` 若先注册且 `feed_id: UUID`，`bulk` 不是合法 UUID 会 422 而非路由到 bulk 端点——所以顺序必须正确）。

**事务**：两端点都在请求级 `AsyncSession` 单事务内完成 SELECT + UPDATE/DELETE，commit 一次。无后台任务。

**级联**：`Feed` 删除时 Article 的级联由 ORM/DB 已有关系定义处理（现有单条 `delete_feed` 已依赖该行为），批量删除走同一 `delete(Feed).where(...)` 模式，行为一致。

### Frontend

**新 UI 组件**：

1. `frontend/src/components/ui/checkbox.tsx` — shadcn 风格 checkbox（基于 `@radix-ui/react-checkbox`，需新增依赖）。或：用现有原语零依赖手写（div + lucide `Check`）。**决策**：项目 ui 目录已有多个 Radix 组件，沿用一致性，新增 `@radix-ui/react-checkbox` + 标准 shadcn checkbox 文件。需确认依赖是否已装（实施时 `pnpm add` / 看 lockfile）。
2. `frontend/src/components/ui/alert-dialog.tsx` — shadcn 风格 alert dialog（基于 `@radix-ui/react-alert-dialog`，新增依赖）。

**新增 hooks**（`frontend/src/api/hooks.ts`，紧邻现有 `useDeleteFeed`/`useUpdateFeed`）：

```ts
export function useBulkMoveFeeds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ feedIds, categoryId }: { feedIds: string[]; categoryId: string | null }) =>
      api.post<BulkFeedResult>("/api/feeds/bulk/move", { feed_ids: feedIds, category_id: categoryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
      qc.invalidateQueries({ queryKey: queryKeys.categories.list() });
    },
  });
}

export function useBulkDeleteFeeds() { /* 同理 → /api/feeds/bulk/delete, body { feed_ids } */ }
```

新增 `BulkFeedResult` type 到 `frontend/src/api/types.ts`。

**SubscriptionsTab 状态扩展**：

```ts
const [selectMode, setSelectMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
```

- 进入选择模式：`setSelectMode(true)`；退出：`setSelectMode(false); setSelectedIds(new Set())`。
- 行内 Checkbox 仅 `selectMode` 时渲染，`checked`/`onCheckedChange` 读写 `selectedIds`。
- 标题栏工具区条件渲染：非选择模式显示"批量编辑"按钮；选择模式显示"已选 N / 全选 / 取消"+ 动作按钮。
- 动作成功后（`onSuccess`/`onError` 的 `onSettled` 或调用处）：退出选择模式。实现上在调用 mutation 的 `mutateAsync().then(() => 退出)` 里处理，而非放进 hook（hook 不应感知 UI 状态）。

## Data Flow & Contracts

```
用户勾选 → selectedIds → 点"移动到分类" → DropdownMenu 选分类
  → useBulkMoveFeeds.mutate({ feedIds, categoryId })
  → POST /api/feeds/bulk/move
  → 后端事务：校验 category → UPDATE → commit
  → { updated, not_found }
  → onSuccess invalidate feeds/articles/categories
  → SubscriptionsTab 退出选择模式
  → toast("已移动 N 个...")

删除同理，多一层 AlertDialog 确认。
```

API 请求/响应字段名对齐：前端用 camelCase（`feedIds`/`categoryId`），后端期望 snake_case（`feed_ids`/`category_id`）。需确认 `api` client 是否自动转 snake_case——查看 `frontend/src/api/client.ts`。若不自动转，前端 body 直接写字段名为 snake_case（与现有 `useAddFeed`、`useUpdateFeed` 一致——它们传 `category_id` 给后端，说明 client 不转，调用方手写 snake_case）。**沿用现有约定：hook mutationFn 参数用 camelCase，POST body 字段名写 snake_case**。

## Compatibility & Migration

- 纯新增端点 + 组件，不改现有端点契约，无 DB migration。
- 新增 npm 依赖（`@radix-ui/react-checkbox` + `@radix-ui/react-alert-dialog`），需更新 `frontend/package.json` + lockfile。
- i18n 新增 key，不影响现有 key。

## Trade-offs

| 决策 | 取舍 |
|------|------|
| 后端批量端点 vs 前端循环单条 | 选端点：正确性+性能优；代价是多写 ~40 行后端 |
| 选择模式切换 vs 常驻 checkbox | 选切换：默认零噪音；代价是多一个模式状态 |
| DropdownMenu 即选即触发 vs Dialog | 选下拉：操作链最短；代价是无"看清再确认" |
| AlertDialog vs window.confirm | 选 AlertDialog：视觉精致；代价是新依赖 + 组件 |
| 不设 feed_ids 上限 | 自托管规模有限；若未来 SaaS 化需补上限 |

## Rollback

- 后端端点纯新增，回滚只需删除新增路由函数 + schema。
- 前端回滚：还原 SubscriptionsTab、删除新增 ui 组件、移除 hooks/types/i18n key、`pnpm remove` 两个 radix 包。
