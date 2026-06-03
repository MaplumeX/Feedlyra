# Make add-feed endpoint async background

## Goal

将 `POST /api/feeds` 从同步阻塞改为异步后台模式：先创建 feed 记录立即返回，然后在后台 task 中完成 RSS 抓取、全文提取、favicon 发现和 AI 摘要生成，彻底解决添加订阅源缓慢的问题。

## Requirements

* `add_feed` 端点先插入 Feed 记录，立即返回 201
* RSS 抓取、全文提取、favicon 发现、AI 摘要在后台 `asyncio.create_task` 中执行
* 后台 task 使用独立 db session（因为请求 session 会关闭）
* 背景抓取失败时正确标记 feed.parsing_error_count 和 parsing_error_message
* 前端 behavior 不变：addFeed mutation 成功后 invalidate feeds list，2 分钟 refetchInterval 自动拉取更新

## Acceptance Criteria

* [ ] `POST /api/feeds` 在 <1s 内返回（仅含 DB 写入延迟）
* [ ] Feed 记录创建后后台 task 完成抓取，feed.title / 文章正确填充
* [ ] 背景抓取失败时 feed.parsing_error_count 和 parsing_error_message 正确更新
* [ ] 前端 AddFeedDialog 添加后正常关闭，toast 提示成功
* [ ] OPML 导入行为不受影响

## Definition of Done

* Lint / typecheck green
* 手动验证添加订阅源响应速度
* 边界场景：添加一个无效 URL 的 feed，确认错误正确标记

## Technical Approach

复用 OPML 导入（`feeds.py:267-283`）已验证的 `asyncio.create_task` + 独立 session 模式：

1. `add_feed` 中创建 Feed 记录 → commit → refresh → 不再 `await fetch_and_store_feed`
2. 用 `asyncio.create_task` 启动后台 task，传入 feed.id
3. 后台 task 用 `async_session()` 创建独立 db session，重新加载 feed，执行 `fetch_and_store_feed`
4. 后台 task 的 error handling 和 OPML 一致：try/except + log warning
5. 返回 feed 时 parsing_error_message 为 None（因为还没抓取），返回 201

**关键改动文件**：`backend/app/routers/feeds.py`（仅 `add_feed` 函数）

**前端无需改动**：`useFeeds` 已有 2 分钟 refetchInterval，`useAddFeed` onSuccess 已 invalidate feeds list。

## Out of Scope

* 引入外部任务队列
* 修改前端 polling 机制
* 修改 refresh_feed / refresh_all 逻辑
* 修改前端 toast 逻辑（当前已区分 parsing_error_message 警告）

## Technical Notes

* OPML 导入后台模式参考：`feeds.py:267-283`
* 后台 task 必须用独立 session：`from app.database import async_session`
* 不再需要 `response.status_code = status.HTTP_202_ACCEPTED` 逻辑——因为 add_feed 返回时还没有抓取结果，永远是 201
