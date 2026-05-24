# Add Refresh Button to Article List Header

## Goal

在文章列表 header 中添加刷新按钮，让用户一键触发后端刷新所有订阅源 RSS，获取最新文章。

## Requirements

- 在文章列表 header 添加刷新按钮（Lucide `RefreshCw` 图标）
- 点击后调用后端 `POST /api/feeds/refresh-all`，真正拉取所有 feeds 的 RSS
- 后端新增 API：强制刷新所有 feeds（忽略 `next_check_at`，复用 `fetch_and_store_feed` 逻辑）
- 前端新增 hook：`useRefreshAllFeeds()`，调用 API + 成功后失效 React Query 缓存
- 刷新期间按钮显示 loading 状态（旋转图标），禁止重复点击
- 刷新完成后自动更新文章列表和侧边栏

## Acceptance Criteria

- [ ] header 中可见刷新按钮，位于 Tabs 右侧
- [ ] 点击触发后端全量 RSS 拉取
- [ ] 刷新期间按钮显示 loading，禁止重复触发
- [ ] 刷新完成后文章列表和侧边栏自动更新
- [ ] 后端 `POST /api/feeds/refresh-all` 正常工作

## Definition of Done

- Lint / typecheck 通过
- 功能可用

## Decision (ADR-lite)

**Context**: 用户需要一键刷新所有订阅源。现有全局"刷新"只是客户端缓存失效，不拉新文章；per-feed 刷新需逐个操作。
**Decision**: 方案 1 — 新增后端 `POST /api/feeds/refresh-all` API，前端调用后失效缓存，真正拉取所有 RSS。
**Consequences**: 订阅源多时后端耗时较长，需后台任务异步处理；前端只需等 API 返回即可。

## Out of Scope

- 单个 feed 的刷新进度追踪
- 刷新失败的重试 UI
- 快捷键绑定（已有 `r` 做缓存刷新，暂不覆盖）

## Technical Approach

### 后端

1. `feeds.py` 新增路由 `POST /api/feeds/refresh-all`
2. 调用 `refresh_all_due_feeds` 的变体：忽略 `next_check_at`，遍历所有 feeds 调用 `fetch_and_store_feed`
3. 返回刷新结果摘要（成功/失败数）

### 前端

1. `api/hooks.ts` 新增 `useRefreshAllFeeds()` hook
2. `ArticleList.tsx` header 区域添加 RefreshCw 按钮，使用 mutation 的 `isPending` 控制 loading
3. 成功回调：失效 `queryKeys.feeds.list()` + `queryKeys.articles.all`

## Technical Notes

- `ArticleList.tsx:251-276` — header 区域
- `api/hooks.ts` — `useRefreshFeed()` 现有 hook（参考模式）
- `backend/app/routers/feeds.py` — 现有 feed 路由
- `backend/app/services/feed_fetcher.py` — `refresh_all_due_feeds()` 可复用逻辑
- `CommandPalette.tsx:55-58` — 现有缓存失效参考
