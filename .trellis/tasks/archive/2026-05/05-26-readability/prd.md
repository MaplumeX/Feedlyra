# 支持用 Readability 提取网页正文

## Goal

在 Feedlyra 中集成 Readability 算法，从网页原始 HTML 提取高质量正文 HTML，替代现有 trafilatura 纯文本提取方案，并提供"获取全文"按钮支持按需提取。

## Requirements

* 集成 readability-lxml 提取网页正文 HTML（保留格式、图片、链接）
* 使用 httpx 替代 trafilatura.fetch_url 进行 HTTP 请求（支持代理配置）
* 改进 feed_fetcher.py 中的 fallback 提取逻辑（feed 无内容时用 readability-lxml 提取 HTML）
* 后端新增 API 端点：按需为指定文章提取全文内容
* 前端 ArticleDetail 中新增"获取全文"按钮，点击时调用后端提取 API
* 按钮在文章无内容时显示；提取完成后文章内容更新为 HTML

## Research References

* [`research/python-readability-libs.md`](research/python-readability-libs.md) — 详细对比 readability-lxml / readabilipy / trafilatura HTML 输出

## Research Notes

### 可行方案

**方案 A: readability-lxml + httpx** (已选定)

* 新增依赖 `readability-lxml`，用 httpx 抓取 HTML，传给 `Document(html, url=url).summary()` 获取 HTML 输出
* 与现有架构兼容：纯 Python + lxml（项目已有），sync 但快，配合 `run_in_executor()`

### 项目约束

* 后端 async FastAPI，提取库都是 sync，需用 `run_in_executor()`
* 已有依赖 lxml，readability-lxml 的依赖兼容
* 前端 DOMPurify 已能渲染 HTML，无需前端改动

## Acceptance Criteria

* [ ] 后端：`readability-lxml` 依赖已添加到 pyproject.toml
* [ ] 后端：feed_fetcher.py 的 fallback 提取改用 readability-lxml + httpx，输出 HTML
* [ ] 后端：新增 `POST /api/articles/{id}/extract` 端点，按需提取文章全文
* [ ] 前端：ArticleDetail 中文章无内容时显示"获取全文"按钮
* [ ] 前端：点击按钮后调用提取 API，完成后文章内容更新为 HTML 渲染
* [ ] 提取的 HTML 可在前端正确渲染（格式、图片、链接）

## Definition of Done

* Tests added/updated
* Lint / typecheck / CI green
* 前端能正确渲染 Readability 提取的 HTML 内容

## Out of Scope (explicit)

* 对所有文章自动全量提取（仅 fallback + 按需手动）
* trafilatura 移除（保留，不改动其现有调用）
* 提取策略切换/选择 UI

## Decision (ADR-lite)

**Context**: 需要从网页提取正文 HTML 替代现有 trafilatura 纯文本提取。readability-lxml 直接输出 HTML，API 简洁；trafilatura HTML 输出为实验性功能。
**Decision**: 方案 A — readability-lxml + httpx。新增 `readability-lxml` 依赖，用 httpx 抓取，`Document.summary()` 输出 HTML。
**Consequences**: 新增一个轻量依赖（lxml 已有）；trafilatura 保留不改动

## Technical Notes

* 关键文件：`backend/app/services/feed_fetcher.py`（现有提取逻辑）
* 现有 `_extract_full_text()` 在 `feed_fetcher.py:87-93`，使用 `trafilatura.fetch_url()` + 纯文本输出
* 前端 DOMPurify 已能渲染 HTML
* readability-lxml 用法：`Document(html, url=url).summary()` 返回 HTML 字符串
