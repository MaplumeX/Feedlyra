# Fix Feed Subscription Bugs

## Goal

修复添加订阅源流程中的 4 个 bug，提升用户体验和代码质量。

## Requirements

* Bug 1: `add_feed` 初始 fetch 失败时返回 HTTP 202 + `parsing_error_message`，前端显示 toast 警告
* Bug 2: `handleMoveFeed` 使用 `useUpdateFeed` hook 替代直接 `api.put()` 调用
* Bug 3: 添加 feed 成功显示 toast 成功通知，失败显示 toast 错误通知；202 也显示警告通知
* Bug 4: OPML 导入后异步后台 fetch 所有新建 feed，用户立即看到 feed 条目

## Decisions

### Bug 1: add_feed fetch 失败策略 — 方案 A: 返回 202 + 警告

feed 已创建但初始抓取失败时，返回 HTTP 202（Accepted）而非 201。响应体仍包含完整 Feed 对象（含 `parsing_error_message`）。前端收到 202 后 toast 警告"订阅成功，内容稍后加载"。feed 条目保留，后续定时刷新可修复。

**理由**：RSS feed URL 本身有效但暂时不可达很常见，不应阻止订阅。

### Bug 4: OPML 导入后异步批量 fetch — 方案 B

导入 API 快速返回创建的 feed 列表，然后使用 `asyncio.create_task` 在后台逐个调用 `fetch_and_store_feed()`。用户立即看到 feed 条目（可能标题为 URL），内容稍后填充。前端 invalidate queries 后 feed 列表自动更新。

**理由**：同步逐个 fetch 会使导入 API 阻塞数十秒易超时；完全依赖定时刷新则用户导入后看不到内容。

## Acceptance Criteria

* [ ] 添加无效/暂不可达 URL 的 feed 时，返回 202 并前端显示警告 toast
* [ ] 添加有效 URL 的 feed 时，返回 201 并前端显示成功 toast
* [ ] `handleMoveFeed` 有 loading 状态和错误处理，不再直接调用 `api.put()`
* [ ] OPML 导入后新建 feed 能异步获取到文章内容

## Definition of Done

* Lint / typecheck 通过
* 手动验证 4 个修复点均正常工作
* 无新增 console.error 无声失败

## Out of Scope

* 前端 URL 格式校验
* UNCATEGORIZED 哨兵值重复定义的 DRY 问题
* 数据库层唯一约束（race condition 防护）

## Technical Notes

* 后端: `backend/app/routers/feeds.py` (add_feed: lines 34-67, import_opml: lines 194-252)
* 后端: `backend/app/services/feed_fetcher.py` (fetch_and_store_feed)
* 前端: `frontend/src/components/AddFeedDialog.tsx`
* 前端: `frontend/src/components/Sidebar.tsx` (handleMoveFeed: lines 175-185)
* 前端: `frontend/src/api/hooks.ts` (useAddFeed: lines 90-100, useUpdateFeed: lines 141-151)
* 前端已有 sonner toast，使用模式：`import { toast } from "sonner"` → `toast.success()` / `toast.error()`
