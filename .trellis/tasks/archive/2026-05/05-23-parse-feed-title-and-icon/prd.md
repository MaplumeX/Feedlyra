# 解析订阅源的标题和图标

## Goal

让 Feedlyra 在订阅源被首次抓取及后续刷新时，正确解析并持久化 feed 的标题和图标，并在前端侧边栏和文章列表中展示每个 feed 独有的图标，替代当前的通用 RSS 图标。

## What I already know

* feedparser 已暴露 `parsed.feed.get("icon")` 和 `parsed.feed.get("image")`，但当前代码完全忽略
* `site_url` 已存储，可作为 favicon 发现的基础 URL
* 当前标题只在字段为空时写入一次（`if not feed.title`），后续刷新不更新
* 数据库 `feeds` 表无 icon 相关字段
* API schema (`FeedResponse`) 和前端 `Feed` 类型均无 icon 字段
* 侧边栏所有 feed 使用同一个 `Rss` lucide 图标
* feed 发现功能 (`discover_feed_urls`) 已能提取 HTML 中 `<link>` 标签的 title

## Decisions

* 标题更新策略：保持现有行为，仅首次写入不更新
* icon_url 仅在字段为空时写入（与标题行为一致，首次获取后不再更新）
* 图标来源优先级：feed XML icon/image（优先）→ site_url 的 favicon（/favicon.ico 或 HTML `<link rel="icon">`）
* 图标存储方式：仅存 URL，前端直接引用原始 URL

## Requirements

* 解析 feedparser 提供的 icon/image 字段（优先）
* 若 feed 无图标，从 site_url 对应网站获取 favicon（/favicon.ico 或解析 HTML <link rel="icon">）
* 在 feeds 表添加 icon_url 列
* 在 API response 和前端类型中添加 icon_url
* 前端侧边栏用 feed 图标替代通用 RSS 图标
* 前端文章列表中的 feed 图标同步更新
* 标题保持现有行为（仅首次写入，不更新）

## Acceptance Criteria

* [ ] 添加 feed 后，侧边栏显示该 feed 的专属图标而非通用 RSS 图标
* [ ] 图标获取失败时 fallback 到通用图标
* [ ] 现有 feeds 的 icon_url 为 null 时不报错

## Definition of Done

* 数据库迁移脚本编写并通过
* 后端 API 返回 icon_url
* 前端正确展示图标
* Lint / typecheck 通过

## Out of Scope (explicit)

* 图标缓存/代理服务（前端直接引用原始 URL）
* 图标上传/自定义
* OPML 中导入/导出图标

## Technical Notes

* 关键文件：`backend/app/services/feed_fetcher.py`（解析逻辑）、`backend/app/models/feed.py`（数据模型）、`backend/app/schemas/feed.py`（API schema）、`frontend/src/components/Sidebar.tsx`（侧边栏）、`frontend/src/api/types.ts`（前端类型）
* feedparser 已暴露 icon 和 image 字段，可直接读取
* site_url 可用于 favicon 发现（`/favicon.ico` 或解析 HTML `<link rel="icon">`）
* Alembic 迁移需要手写，使用顺序数字 ID
