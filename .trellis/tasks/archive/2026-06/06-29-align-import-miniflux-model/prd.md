# Align batch feed import with Miniflux model

## Goal

让 Feedlyra 的"批量导入 / 批量刷新订阅源"流程对齐 Miniflux 的解耦模型：导入只写库、抓取交给有界并发 worker pool + 批调度，消灭导入即"一窝蜂并发 + 无 per-host 限流 + 无生命周期管理 + 进度不可见"的问题，并让后台定时刷新从串行改为有界并发。

## Background

### 现状（confirmed facts，来自代码）

- `backend/app/routers/feeds.py`
  - `add_feed`（单条添加）：写库后 `asyncio.create_task(_bg_fetch())` fire-and-forget 抓取，引用未被持有（有 GC 风险）。
  - `import_opml`：解析 OPML → 去重 → 建 category → 批量 `db.add(feed)` → `db.commit()` → **对每个新 feed `asyncio.create_task(_bg_fetch())`**。导入 N 条即瞬间 N 个并发抓取，无上限、无 per-host 限流。
  - `refresh_all`（手动全部刷新）→ `refresh_all_feeds`（`services/feed_fetcher.py`）。
  - OPML 导入路径不接收 `auto_full_text / auto_translate` 等字段；`add_feed` 接收。两路径不一致。
  - 导入返回的是空壳 feed（title 来自 OPML、`site_url/icon/description` 在抓取后才回填），但响应类型 `list[FeedResponse]`，前端 `toast.success(count)` 后不再轮询进度。
- `backend/app/services/feed_fetcher.py`
  - `fetch_and_store_feed`：每次调用内部 `_fetch_feed_content` / `_fetch_and_extract_content` / `_discover_favicon` **各自 `async with httpx.AsyncClient(...)` 新建客户端**，无连接池复用、无并发上限。
  - `refresh_all_feeds(db, user_id)`：`for feed in feeds: await fetch_and_store_feed(...)` **纯串行**。
  - `refresh_all_due_feeds(db)`：定时任务调用的版本，同样串行。
  - 已有 `next_check_at` 列 + `_compute_next_check` 指数退避（错误数驱动，上限 24h）。已有 etag/last-modified 协商缓存与 304 处理。
- `backend/app/main.py`：`_periodic_feed_refresh` 每 `FEED_REFRESH_INTERVAL=300s` 串行调 `refresh_all_due_feeds(db)`；通过 `lifespan` 启动一个后台 task。无 worker pool。
- `backend/app/models/feed.py`：Feed 模型无 `disabled` 标志；错误数靠 `parsing_error_count` 退避但永不停止自动轮询。
- `backend/app/config.py`：无 worker pool / batch size / per-host 参数。
- 前端 `frontend/src/components/settings/SubscriptionsTab.tsx`：导入与"refresh-all"无进度反馈；feed 列表无 pending/error 状态区分。

### Miniflux 标杆设计（来自源码调研）

- OPML 导入只写库，不发 HTTP；新 feed `next_check_at` 默认 `now()` → 立即到期。
- 常驻 worker pool（`WORKER_POOL_SIZE` 默认 16）从 channel 取 job。
- `feedScheduler` 每 `POLLING_FREQUENCY` tick：`NewBatchBuilder()` 查 due feeds，带 `BATCH_SIZE`、`WithErrorLimit`、`WithLimitPerHost`、`WithoutDisabledFeeds`、`ORDER BY next_check_at ASC`，push 进 worker pool queue。
- `ScheduleNextCheck` 支持 round-robin 固定间隔 / entry-frequency 自适应；收到 429 读 `Retry-After`。
- 抓取幂等 + 调度幂等，进程重启下一轮重新拾取。

## Requirements

### 范围（已定）

完整对齐 Miniflux 模型，三块全做：

- **A. 导入解耦**：`add_feed` / `import_opml` 去掉 `asyncio.create_task(_bg_fetch)`，只写库；新 feed 标记为立即到期，由后台调度接管抓取。统一 OPML 导入与 `add_feed` 的入参（接收 `auto_full_text / auto_translate` 等）。
- **B. 有界并发 worker pool + 批调度**：替换现有串行 `_periodic_feed_refresh`；每轮 batch 查询带 batch size、per-host 限流、error limit、`ORDER BY next_check_at ASC`；常驻 worker pool 有界并发消费。
- **C. 共享 httpx client + 进度可见性**：app 级全局 `httpx.AsyncClient`（带连接上限），所有抓取/全文/favicon 复用，lifespan 退出关闭；Feed 增加 pending/error 状态区分，前端列表展示，并提供导入/刷新进度反馈。
- 引入 `Feed.disabled` 标志 + 错误上限停止自动轮询（对齐 Miniflux `POLLING_PARSING_ERROR_LIMIT`）。

### 触发时机（已定）

- 选项 1（严格对齐 Miniflux）：导入只写库，新 feed 显式设 `next_check_at=now()`（立即到期），由后台调度在下一轮 tick 拾取。单查询路径，最简单、最幂等，进程重启下一轮重拾无损。
- 定期 tick 从 `300s` 缩短到 **60s**，搭配 worker pool 有界并发，导入 200 条约 1-2 分钟抓完。

### 手动刷新接口语义（已定）

- `POST /api/feeds/{feed_id}/refresh`（单条）：保持同步，等 worker 处理完返回最新 `FeedResponse`；失败 502。
- `POST /api/feeds/refresh-all`（全部）：改为异步，把目标 feed `next_check_at=now()` 并即时 enqueue（或唤醒一次 tick），立即返回 `202 Accepted`；进度靠前端轮询 jobs/status。

### 进度可见性实现（已定）

- 选项 2：后端 worker pool 维护 in-memory 进度计数器 `{total, pending, running, done, failed, last_updated_at}`，新增 `GET /api/feeds/jobs/status` 轻量端点。
- 前端 2s 轮询，`done + failed == total` 时停止；导入/refresh-all 触发后开始轮询。
- Feed 列表基于 `checked_at is None`（pending）、`parsing_error_message`（error）区分状态，前端展示 pending/error 徽标。
- 进程重启状态丢失可接受（due 查询幂等恢复，进度条归零）。

### 调度作用域（已定）

- 全局 batch + 全局 worker pool，跨所有 user。对齐 Miniflux。手动 `refresh-all` / `refresh_feed` 走带 `user_id` 过滤的入队路径；定时 `refresh_all_due_feeds` 全局扫。

### 调度策略（已定）

- 固定间隔（保留现有 `_compute_next_check`：成功 → 15min，失败 → 指数退避上限 24h）。
- 补充：收到 HTTP 429 读 `Retry-After` 退避；错误数 >= 上限（默认 3，对齐 `POLLING_PARSING_ERROR_LIMIT`）设 `disabled=true` 停止自动轮诨，需手动 refresh 重置。

### 验收与测试策略（已定）

- 选项 1：手动验收为主 + 针对性单元测试。贴合 spec「trusted unit tests cover pure logic that has no DB/HTTP coupling」「无 linting/CI，靠 `uv run pytest` + 手动验证」。
- 新增单元测试覆盖：①`_compute_next_check`（含 429 `Retry-After` 退避、错误超限 → disabled）②batch builder 的 per-host 限流分桶与 `ORDER BY next_check_at ASC` ③in-memory 进度计数器状态转换。
- worker pool 并发行为用手动验收（导入 50+ 条混合源观察日志/进度）。

## Acceptance Criteria

### A. 导入解耦
- [ ] `POST /api/feeds/import/opml` 与 `POST /api/feeds` 写库后不再 `asyncio.create_task` 抓取；新 feed 设 `next_check_at=now()`；接口同步返回创建结果（不等待抓取）。
- [ ] OPML 导入与 `add_feed` 入参一致（OPML 接收 `auto_full_text / auto_translate / translate_target_lang`，可在请求中携带或用默认值）。
- [ ] OPML 导入不再因 `category.id`（pending）触发隐式 autoflush。
- [ ] 进程重启后，导入但未抓取的 feed 会在下一轮 tick 被 due 查询幂等拾取。

### B. 有界并发 worker pool + 批调度
- [ ] `lifespan` 启动常驻 worker pool（`WORKER_POOL_SIZE` 默认 8），从 queue 取 job 调 `fetch_and_store_feed`。
- [ ] 定时 tick 改为 60s，每轮查询带 `BATCH_SIZE`、`WithErrorLimit`、`WithLimitPerHost`、`WithoutDisabledFeeds`、`ORDER BY next_check_at ASC`。
- [ ] 同一 host 每轮不超过 `POLLING_LIMIT_PER_HOST` 条（默认如 3）。
- [ ] `refresh_all_due_feeds` 与 `refresh_all_feeds` 不再串行循环，统一走 worker pool。
- [ ] 所有 httpx 抓取/全文/favicon 复用 app 级全局 `httpx.AsyncClient`，lifespan 退出 `aclose()`。
- [ ] 收到 429 读 `Retry-After` 退避；错误数 >= `POLLING_PARSING_ERROR_LIMIT`（默认 3）设 `Feed.disabled=true`，自动调度不再拾取。
- [ ] `Feed.disabled` 列通过 Alembic 迁移添加；`disabled` feed 在手动 `refresh` 成功后重置。

### C. 共享 httpx client + 进度可见性
- [ ] 新增 `GET /api/feeds/jobs/status` 返回 `{total, pending, running, done, failed, last_updated_at}`，无活跃任务时返回全零。
- [ ] 前端导入/refresh-all 后以 ~2s 轮询 jobs/status，`done+failed==total` 时停止。
- [ ] feed 列表区分 pending（`checked_at is None`）/ error（`parsing_error_message`）/ ok，前端展示徽标。

### 接口语义
- [ ] `POST /api/feeds/{feed_id}/refresh` 保持同步，等 worker 处理完返回最新 `FeedResponse`；失败 502。
- [ ] `POST /api/feeds/refresh-all` 改为异步：把目标 feed 标 due 并 enqueue/唤醒 tick，立即返回 `202 Accepted`。

### 测试
- [ ] 单元测试覆盖：`_compute_next_check`（429 Retry-After / 错误超限 disabled）、batch builder（per-host 分桶 + ORDER BY）、进度计数器状态转换。
- [ ] `uv run pytest` 全绿。
- [ ] 手动验收：导入 50+ 条混合源，观察日志中 worker 有界并发、per-host 限流、~1-2 分钟抓完、进度端点计数正确、错误 feed 显示 error 徽标。

## Open Questions

（已有决策均已收敛；无阻塞性 open question）

## Out of Scope

- `entry_frequency` 自适应调度（需新增加权发文统计与冷启动回退，第一版收益有限）。
- RSS feed TTL / `Cache-Control max-age` / `Expires` 驱动的逐 feed 调度间隔（现有固定间隔足够）。
- 跨进程持久化的 job 队列（如外接 Redis/Celery）；in-memory worker pool + due 查询幂等恢复已满足单实例自托管。
- 多租户 per-user worker 隔离 / 配额。
- feed 重写 / 抓取规则系统（Miniflux rewrite rules 等）。
