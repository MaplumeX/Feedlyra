# Design — Align batch feed import with Miniflux model

> 技术设计。需求与验收见 `prd.md`，执行计划见 `implement.md`。

## 架构总览

新增一个常驻后台 `FeedScheduler` + `WorkerPool`，从 `lifespan` 启动，替代现有 `_periodic_feed_refresh` 串行循环。导入/手动刷新不再 `asyncio.create_task` 抓取，而是写库 + 标记 due，由调度管线统一拾取。

```
┌─────────────────────────────────────────────────────────────┐
│  FastAPI app (lifespan)                                       │
│                                                               │
│   GlobalHttpClient (httpx.AsyncClient, shared)                │
│                                                               │
│   FeedScheduler ──tick(60s)──▶ batch_builder(query due feeds) │
│        │                       + per-host bucket + error limit│
│        │                       + WithoutDisabledFeeds         │
│        │                       ORDER BY next_check_at ASC      │
│        ▼                                                      │
│   WorkerPool (asyncio.Queue + N workers, bounded)             │
│        │                                                      │
│        ▼                                                      │
│   fetch_and_store_feed(feed_id)  ── 用 GlobalHttpClient        │
│        │                                                      │
│        ▼                                                      │
│   JobProgressTracker (in-memory counters)                     │
│        ▲                                                      │
│        │ GET /api/feeds/jobs/status                            │
│   前端 2s 轮询                                                  │
└─────────────────────────────────────────────────────────────┘
```

新增后端模块（`backend/app/services/`）：

- `http_client.py` — app 级全局 `httpx.AsyncClient` 单例 + lifespan 管线。
- `feed_worker.py` — `WorkerPool`、`JobProgressTracker`、`FeedScheduler`。
- `feed_batch.py` — batch builder（pure query 构造 + per-host 过滤逻辑，便于单测）。

## 模块边界与契约

### `http_client.py`

```python
# 全局单例 + 生命周期
_global_client: httpx.AsyncClient | None = None

def get_http_client() -> httpx.AsyncClient:
    """所有抓取/全文/favicon 必须走这个 client。lifespan 启动时 init。"""
    if _global_client is None: raise RuntimeError("http client not initialized")
    return _global_client

async def init_http_client() -> None: ...   # lifespan startup
async def close_http_client() -> None: ...  # lifespan shutdown
```

`httpx.AsyncClient(limits=httpx.Limits(max_connections=64, max_keepalive_connections=16), timeout=30, follow_redirects=True, headers={"User-Agent": USER_AGENT})`。`feed_fetcher.py` 内 `_fetch_feed_content` / `_fetch_and_extract_content` / `_discover_favicon` 全部改用 `get_http_client()`，删掉各自的 `async with httpx.AsyncClient(...)`。

### `feed_batch.py`

BatchBuilder 构造 due 查询并做 per-host 过滤，便于纯单元测试：

```python
def build_due_feed_query(*, batch_size, error_limit, limit_per_host):
    """返回 (sql, params)，条件：
       next_check_at <= now() AND disabled IS NOT true
       AND (error_limit == 0 OR parsing_error_count < error_limit)
       ORDER BY next_check_at ASC LIMIT batch_size"""

def apply_per_host_limit(feeds: list[FeedRow], limit_per_host: int) -> list[FeedRow]:
    """按 url 的 hostname 分桶，每 host 至多 limit_per_host 条。limit_per_host<=0 不过滤。"""
```

per-host 用 `urllib.parse.urlparse(url).hostname`。`FeedRow` 是轻量 dataclass `{feed_id, user_id, url, hostname}`，避免在 batch 阶段加载完整 ORM。

### `feed_worker.py`

```python
class JobProgressTracker:
    total: int; pending: int; running: int; done: int; failed: int
    last_updated_at: datetime
    # enqueue(feed_ids) → total += N, pending += N（重置一次表示新一轮）
    # on_start(feed_id), on_done(feed_id), on_fail(feed_id)
    def snapshot(self) -> dict: ...   # GET /api/feeds/jobs/status 返回这个

class WorkerPool:
    queue: asyncio.Queue[Job]
    workers: list[asyncio.Task]
    # 常驻 N 个 worker，从 queue 取 Job 调 fetch_and_store_feed
    # Job: {feed_id, user_id, kind: "due"|"manual"}

class FeedScheduler:
    # 每 60s tick：batch_builder.build → pool.push(jobs)
    # wake_now(): 手动刷新调用，立即触发一次 tick（不等到下次 tick）
```

- `JobProgressTracker` 是单例（in-memory）。导入/refresh-all enqueue 时把目标 feed 计入 pending，新一轮开始前 `reset(total)`。
- 进度计数器**仅跟踪 enqueue 来的批次**；由于 due 定时轮询全局扫，定时 tick 不计入进度（避免空闲时进度非零），只跟踪手动触发的批次（导入 + refresh-all + 手动 enqueue 的单条 refresh 也计入）。即：`enqueue(job, track=True)`，定时 tick 用 `track=False`。

### `fetch_and_store_feed` 改动

签名保持 `async def fetch_and_store_feed(feed: Feed, db: AsyncSession) -> None`。内部：
- `_fetch_feed_content` 用 `get_http_client()`。
- `_compute_next_check` 改造：增加 `last_429_retry_after` 入参，429 时 `now + retry_after`（覆盖正常/退避）。返回 `(next_check_at, should_disable: bool)`；`should_disable = feed.parsing_error_count >= PARSING_ERROR_LIMIT`。
- 429 处理：`_fetch_feed_content` 返回 status_code，`fetch_and_store_feed` 在 `status_code == 429` 时读 `Retry-After` 头（秒数 or HTTP date），调 `_compute_next_check(retry_after=...)`，`parsing_error_count += 1`，写 `parsing_error_message="HTTP 429"`，设 `disabled = should_disable`，commit，return。
- 手动 refresh 入口（`/{feed_id}/refresh`）成功后 `feed.disabled = False; feed.parsing_error_count = 0`。

## 数据迁移

新增 Alembic `018_feed_disabled.py`：

```python
def upgrade():
    op.add_column("feeds", sa.Column("disabled", sa.Boolean(), server_default="false", nullable=False))
def downgrade():
    op.drop_column("feeds", "disabled")
```

`models/feed.py` 加 `disabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)`。

## API 变更

| 端点 | 改动 |
|---|---|
| `POST /api/feeds` | 删 `asyncio.create_task`；`feed.next_check_at = datetime.now(timezone.utc)`（单条靠 60s tick 拾取，无批次进度）；commit 后返回。 |
| `POST /api/feeds/import/opml` | 删 `asyncio.create_task` 循环；新 feed `next_check_at=now()+DEFAULT_CHECK_INTERVAL`（避免与 tick 重叠，见下「inflight 去重」）；接收 `auto_full_text/auto_translate/translate_target_lang`（通过 multipart 表单字段或 JSON body，见下）；commit 后 `tracker.reset(total)` + enqueue manual jobs(track=True) → 立即 return。 |
| `POST /api/feeds/{feed_id}/refresh` | 同步等 worker；用 `await asyncio.Future` 等 worker 处理完该 feed（worker pool 提供 `run_single(feed_id)` 同步接口）；成功 reset disabled/error；失败 502。 |
| `POST /api/feeds/refresh-all` | 目标 feed `next_check_at=now()+DEFAULT_CHECK_INTERVAL`；enqueue 全部并 `reset_progress(total)`；立即返回 `202 Accepted {total}`。 |
| `GET /api/feeds/jobs/status`（新增） | 返回 `JobProgressTracker.snapshot()`。 |
| `FeedResponse` | 新增 `disabled: bool` 字段。 |
| `FeedWithUnread` | 同上。 |

OPML 导入入参：现在是 `UploadFile`（multipart）。`auto_full_text/auto_translate/translate_target_lang` 通过 multipart 表单字段携带（`Form(...)`），保持单文件上传。`add_feed` 已是 JSON body 不变。

## 前端改动

- `types.ts` → `Feed` 加 `disabled: boolean`；新增 `JobStatus { total, pending, running, done, failed, last_updated_at }`。
- `hooks.ts` → `useImportOPML` onSuccess 后 `invalidate` 保持；新增 `useFeedJobStatus`（`enabled` 受触发态控制，2s 轮询，`done+failed==total && total>0` 时 `enabled=false`）。新增 `useRefreshAllFeeds` 返回 202。
- `SubscriptionsTab.tsx` → feed 列表项加 pending/error/disabled 徽标（`checked_at == null` → pending；`parsing_error_message` → error；`disabled` → disabled）。导入/refresh-all 触发后开轮询，顶部显示 `done/total` 进度；完成时 `toast.success` + invalidate feeds。
- i18n key（`settings` namespace）补充：`feedStatusPending/error/disabled`、`importProgress“{{done}}/{{total}}”`。

## 跨层数据流

```
导入 → DB(feeds.next_check_at=now)
       → JobProgressTracker.reset(total=N)
       → 前端开始轮询 jobs/status
60s tick → batch_builder → WorkerPool.push → worker
       → fetch_and_store_feed (global httpx)
       → progress.on_start/on_done|on_fail
       → 前端轮询读 snapshot
手动 refresh_{feed,all} → 同上路径（manual enqueue, track=True）
单条 refresh → WorkerPool.run_single(feed_id) 阻塞等结果 → FastAPI 返回 FeedResponse
```

## 兼容性与回滚

- `disabled` 列有 `server_default false`，旧数据无影响。
- 导入解耦后，旧 `import_opml` 调用方（前端）行为变化：导入返回时空壳 feed，前端原本 `toast.success(count)`——现在仍 `toast.success(count)` + 开始轮询进度。无破坏性。
- 429 Retry-After 解析失败时回退到普通错误退避（`parsing_error_count + 1`）。
- 回滚点：每个模块独立，可分步上线（见 `implement.md` checkpoint）。模块新增失败不影响现有路径（未接入前 `add_feed` 仍走旧 create_task）。

## 操作性考量

- worker pool 关闭：`lifespan` 退出时 `pool.shutdown()`（cancel workers + `aclose()` client）。当前请求中的 job 进程退出即丢，下一轮 due 查询幂等恢复。
- 共享 client 超时：保持 30s；`max_connections=64` 够 8 worker + 全文/favicon 抓取并发。
- 日志：scheduler 每轮记录 batch size / skipped-per-host / enqueued 数；worker 记录每个 feed 成功/失败 + 耗时。

## 关键权衡

1. **导入即时性 vs 简单性**：选 60s tick 延迟换单路径幂等（Q2）。
2. **进度可见性 in-memory vs 持久**：in-memory 简单，重启归零可接受（Q4）。
3. **per-host per-bucket vs 全局 worker**：per-host 在 batch 层过滤而非锁，简单不阻塞 worker，但跨 batch 不严格（同 host 可能两轮连续被选）——可接受，Miniflux 也是 per-batch 限流。
4. **手动单条 refresh 同步阻塞 worker**：占用一个 worker 槽，但单条 feed 抓取<30s，可接受。
5. **manual 批次 vs due-tick 重叠**（实现修正）：import / refresh-all 既 enqueue manual jobs(track=True) 又需避免 60s tick 重复抓取同一 feed（articles 无 (feed_id, url) unique 约束，跨 session 重复抓取会写重复行）。采取两条措施：①manual 批次把 `next_check_at` 设为 `now()+DEFAULT_CHECK_INTERVAL`（而非 now），让 tick 在处理窗口内不选中这批；worker 抓取后 `fetch_and_store_feed` 覆盖 next_check_at。②WorkerPool 维护 in-flight feed_id 集合，`_process` 取出 job 时若发现该 feed 已在执行中则跳过（带 `result_future` 的 run_single job 报 错让路由 502，供前端重试）。add_feed 单条不 enqueue，设 `next_check_at=now` 靠 tick；若用户立即手动 refresh 与 tick 撞车，run_single 会被 inflight 去重→502 重试，边缘可接受。
