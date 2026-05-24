# Article list items show thumbnail when content has images

## Goal

在文章列表的条目右侧显示缩略图，让用户在浏览列表时就能看到文章的视觉预览，提升内容辨识度和浏览体验。

## What I already know

* 当前 `ArticleRow` 组件是纯文字布局（标题行 + 元数据行），没有任何图片展示
* 前后端数据模型均无图片字段（无 `thumbnail_url`、`image_url` 等）
* `feedparser` 解析 RSS 时可获取 `entry.media_thumbnail`、`entry.media_content`、`entry.enclosures` 等图片信息，但当前代码完全忽略
* `ArticleDetail` 组件通过 `dangerouslySetInnerHTML` 渲染文章内容时已经能展示内嵌图片
* 文章列表使用 `react-virtuoso` 做虚拟滚动

## Assumptions (temporary)

* 缩略图来源优先使用 RSS feed 提供的 media 字段，回退到从 HTML content 中提取首图
* 需要在后端新增数据库字段存储缩略图 URL
* 前端 ArticleRow 布局需要从纯纵向改为左文字 + 右缩略图的横向布局
* 无图片的文章保持当前纯文字布局

## Open Questions

* 缩略图尺寸与样式：正方形 56×56，`object-cover` 裁切，紧凑风格
* 是否需要为已有文章做回填（backfill thumbnails）→ 不做回填，只对新抓取的文章提取图片
* 缩略图加载失败时的 UI 表现 → 静默隐藏，回退到纯文字布局

## Requirements (evolving)

* 后端：从 RSS feed 条目中提取图片 URL 并存储到数据库
* 后端：新增 article 表字段 `image_url`
* 后端：API 响应中包含 `image_url` 字段
* 前端：Article 类型增加 `image_url` 字段
* 前端：ArticleRow 中当 `image_url` 存在时在右侧显示正方形缩略图（56×56，object-cover）

## Acceptance Criteria (evolving)

* [ ] 有图片的 RSS 条目在列表中右侧显示缩略图
* [ ] 无图片的条目保持当前纯文字布局
* [ ] 缩略图加载失败时静默隐藏，回退到纯文字布局

## Definition of Done (team quality bar)

* 数据库迁移脚本已创建并测试
* Lint / typecheck / CI green
* 前后端类型一致

## Out of Scope (explicit)

* 已有文章的缩略图回填
* 独立回填脚本
* 过滤 tracking pixel 等无效小图
* 详情页使用封面图
* 视频封面图、OG Image 提取、用户自定义封面

## Technical Notes

* 关键文件：
  - `backend/app/services/feed_fetcher.py` — RSS 解析，需添加图片提取逻辑
  - `backend/app/models/article.py` — SQLAlchemy 模型，需添加 `image_url` 列
  - `backend/app/schemas/article.py` — Pydantic schema，需添加 `image_url` 字段
  - `frontend/src/components/ArticleList.tsx` — ArticleRow 组件，需修改布局
  - `frontend/src/api/types.ts` — 前端 Article 类型，需添加 `image_url`
* feedparser 可用字段：`entry.media_thumbnail`、`entry.media_content`、`entry.enclosures`
