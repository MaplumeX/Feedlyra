# Implement — Align batch feed import with Miniflux model

> 执行计划。需求见 `prd.md`，技术设计见 `design.md`。

## 执行顺序（每步独立可验证，每步后跑 `uv run pytest`）

### Step 1 — 数据层: `Feed.disabled` + 迁移
- [ ] `backend/app/models/feed.py` 加 `disabled: Mapped[bool]`（server_default false）。
- [ ] `backend/alembic/versions/018_feed_disabled.py` 新建（rev=018, down=017）。
- [ ] `backend/app/schemas/feed.py` `FeedResponse` 加 `disabled: bool = False`（`FeedWithUnread` 继承）。
- [ ] 验证：`uv run alembic upgrade head` 无错；手测迁移可回滚。
- **DDL rollback point**：`alembic downgrade -1`。

### Step 2 — 配置项
- [ ] `backend/app/config.py` `Settings` 加：`WORKER_POOL_SIZE: int = 8`、`FEED_REFRESH_INTERVAL: int = 60`、`BATCH_SIZE: int = 100`、`POLLING_LIMIT_PER_HOST: int = 3`、`POLLING_PARSING_ERROR_LIMIT: int = 3`。
- [ ] `main.py` 删除模块级 `FEED_REFRESH_INTERVAL = 300`，改用 `settings.FEED_REFRESH_INTERVAL`。

### Step 3 — 共享 httpx client
- [ ] 新建 `backend/app/services/http_client.py`：`init/close_http_client`、`get_http_client`。
- [ ] `feed_fetcher.py` 改 `_fetch_feed_content` / `_fetch_and_extract_content` / `_discover_favicon` 用 `get_http_client()`，删各自 `async with httpx.AsyncClient(...)`。
- [ ] `main.py` `lifespan` 加 `await init_http_client()` startup、`await close_http_client()` shutdown（包在 try/finally）。
- [ ] 验证：`uv run pytest` 全绿；手测单条手动 refresh 仍正常抓取。
- **rollback**：http_client 模块独立，回退 `feed_fetcher.py` 三个函数即可。

### Step 4 — batch builder（纯函数 + 单测）
- [ ] 新建 `backend/app/services/feed_batch.py`：`FeedRow` dataclass、`build_due_feed_query(...)`、`apply_per_host_limit(feeds, limit)`。
- [ ] 新建 `backend/tests/test_feed_batch.py`：
  - per-host 分桶（同 host 多条只取 N、limit<=0 不过滤、hostname 提取）。
  - ORDER BY next_check_at ASC / WithoutDisabledFeeds 条件正确性（断言生成的 SQL 片段）。
- [ ] 验证：`uv run pytest backend/tests/test_feed_batch.py` 绿。

### Step 5 — 进度计数器（纯逻辑 + 单测）
- [ ] `feed_worker.py` 定义 `JobProgressTracker`（in-memory、`reset/enqueue/on_start/on_done/on_fail/snapshot`、`last_updated_at`）。
- [ ] `backend/tests/test_feed_worker.py` 覆盖状态转换（enqueue→start→done、fail 计数、reset 重置、snapshot 字段）。
- [ ] 验证：`uv run pytest backend/tests/test_feed_worker.py` 绿。

### Step 6 — WorkerPool + FeedScheduler
- [ ] `feed_worker.py` 加 `Job` dataclass、`WorkerPool`（`asyncio.Queue` + N worker task + `push/shutdown/run_single`）、`FeedScheduler`（60s tick：查 batch → push；`wake_now()`）。
- [ ] worker 调 `fetch_and_store_feed`，调 tracker `on_start/on_done/on_fail`；`on_done` 不动 disabled/error（由 `fetch_and_store_feed` 内部已写库）。
- [ ] `refresh_all_due_feeds(db)` 重写为：调 batch + push（定时 tick 路径，`track=False`）。`refresh_all_feeds(db, user_id)` 重写为：查 user feeds → enqueue（manual 路径，`track=True`）。
- [ ] `main.py` `lifespan`：启动 `WorkerPool` + `FeedScheduler`（替代旧 `_periodic_feed_refresh`）；shutdown 时 `pool.shutdown()`。
- [ ] `_compute_next_check` 改造：接受 `retry_after: timedelta | None`，返回 `(next_check_at, should_disable)`；`fetch_and_store_feed` 处理 429（`Retry-After` 解析 → 秒 or HTTP-date，失败回退普通退避）。
- [ ] 验证：`uv run pytest` 全绿；手测：60s 内能自动抓取一个 due feed（看日志）。

### Step 7 — 接入导入解耦（A：导入只写库）
- [ ] `feeds.py` `add_feed`：删 `_bg_fetch` + `asyncio.create_task`；`feed.next_check_at = now()`；commit 后 return。
- [ ] `feeds.py` `import_opml`：删 `_bg_fetch` 循环；新 feed `next_check_at=now()`；通过 `Form(...)` 接收 `auto_full_text / auto_translate / translate_target_lang`（默认值对齐 `FeedCreate`）；commit 后 `tracker.reset(total=len(created))` → 立即 return。
- [ ] OPML 入参 schema：新增 `OPMLImportParams(BaseModel)` 或直接用 `Form` 参数（保持 multipart 文件上传）。修掉 category `.id` 隐式 autoflush：先 `db.flush()` 取 category id 再建 feeds，或 commit 后再读 id。
- [ ] 验证：手测导入 50+ 条 → 进度端点 `/api/feeds/jobs/status` 在 60s 内 `running/done` 开始变化；~1-2 分钟抓完。

### Step 8 — 手动刷新接口语义
- [ ] `refresh-all` 路由改为：标 due → `refresh_all_feeds(...)` enqueue → `tracker.reset(total=N)` → return `Response(status_code=202, content={"total": N})`。
- [ ] `refresh_feed` 路由改为：`await worker_pool.run_single(feed_id)` 阻塞等结果；成功后 `feed.disabled=False; parsing_error_count=0`；失败 raise 502。
- [ ] 验证：手测单条 immediate refresh 返回最新 FeedResponse（含 site_url/icon）；refresh-all 立即返回 202 且进度开始走。

### Step 9 — `GET /api/feeds/jobs/status`
- [ ] `feeds.py` 新增路由：返回 `tracker.snapshot()`（无活跃任务全零 + `last_updated_at`）。
- [ ] 验证：手测 `curl /api/feeds/jobs/status` 返回结构正确。

### Step 10 — 前端
- [ ] `types.ts`：`Feed` 加 `disabled`；新增 `JobStatus`。
- [ ] `hooks.ts`：`useFeedJobStatus(enabled)`（2s 轮询，`done+failed==total && total>0` 停）；`useRefreshAllFeeds`（返回 202 + 启动轮询）；`useImportOPML` onSuccess 启动轮询。
- [ ] `SubscriptionsTab.tsx`：feed 列表项加 pending/error/disabled 徽标；导入区/顶部显示 `{{done}}/{{total}}` 进度条；完成 toast。
- [ ] `i18n`（`settings` ns）：补 `feedStatusPending/error/disabled`、`importProgress`。
- [ ] 验证：手测导入 → 进度轮询 → 完成停轮询 → feeds 列表空壳渐变为有标题/icon；错误 feed 显示 error 徽标。

### Step 11 — 全量验证 + spec 更新
- [ ] `uv run pytest` 全绿。
- [ ] 完整手验 AC（见 `prd.md`），含导入 50+ 混合源、单条 refresh、refresh-all、重启恢复。
- [ ] trellis-check 走一遍；把"http client / worker pool 约定"沉淀到 `.trellis/spec/backend/`（若 spec 有合适落点，否则记 journal）。

## 验证命令

```bash
cd backend
uv run alembic upgrade head
uv run pytest
# 手动：
uv run uvicorn app.main:app --reload
# 另一终端导入 OPML → 观察 GET /api/feeds/jobs/status 与日志
```

## 风险与回滚点

| 风险 | 缓解 |
|---|---|
| WorkerPool 启动失败导致抓取停摆 | lifespan 中 try/except + log；启动失败时退化为不发 worker（导入仍写库 due，下次启动恢复）。 |
| 共享 client 连接耗尽 | `max_connections=64` > `WORKER_POOL_SIZE=8`；全文抓取串行在单个 feed 内。 |
| 单条 refresh 同步阻塞 worker 死锁 | `run_single` 用独立 `asyncio.Future`，worker 处理完 set_result；不走 queue 的 N 槽占用语义。 |
| 429 Retry-After 解析 | 失败回退普通退避（parsing_error_count+1）。 |
| 进度端点进程重启归零 | 文档化"重置可接受"，due 幂等恢复。 |

## Review gate

Step 1-6（基础设施 + 单测）完成后做一次内部自检（确认 `uv run pytest` 绿、手验 due tick 能抓取）；Step 7-10（接入 + 前端）完成后请用户 review 三份文档与实现，再 `task.py start` 进入 Phase 2 实际写码（当前仍在 planning，本计划是 sub-agent 执行的蓝图）。

## Sub-agent 上下文清单

`implement.jsonl` / `check.jsonl` 见同目录文件，curated spec/research 条目（非代码路径）。
