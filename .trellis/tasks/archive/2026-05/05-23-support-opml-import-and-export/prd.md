# Support OPML Import and Export

## Goal

为 Feedlyra 添加 OPML 导入导出的完整前端 UI，使用户可以在 RSS 阅读器之间迁移订阅。

## What I already know

* 后端已完整实现 OPML 导入 (`POST /api/feeds/import/opml`) 和导出 (`GET /api/feeds/export/opml`)
* 后端 OPML 是扁平结构（无分类嵌套），`generate_opml()` 和 `parse_opml()` 在 `feed_fetcher.py`
* 前端有 `useImportOPML` hook（`api/hooks.ts`），但未接入任何 UI 组件
* 前端无导出 hook
* 当前 Feed 模型是扁平的，无分类/文件夹/分组
* 现有 UI 入口点：`AddFeedDialog`（添加订阅）、`SettingsDialog`（设置）、`CommandPalette`（命令面板）、`Sidebar`（侧边栏）
* 项目支持 i18n（en + zh-CN）

## Assumptions (temporary)

* MVP 不涉及分类/文件夹支持（OPML 的 `<outline>` 嵌套暂忽略）
* 重复 feed 由后端静默跳过（已实现：`feeds.py:177` 检查 existing_urls）

## Open Questions

（无剩余阻塞问题）

## Decision (ADR-lite)

**Context**: OPML 导入导出需要一个用户可发现的 UI 入口。
**Decision**: 在 SettingsDialog 中新增"订阅管理"tab，集中放置导入/导出操作。
**Consequences**: 与现有设置页 tab 模式一致，用户容易找到；不在 Sidebar 或 AddFeedDialog 中增加复杂度。

## Requirements

* 在 SettingsDialog 中新增"订阅管理"tab（Subscriptions / Feeds）
* Tab 内包含 OPML 导出按钮（点击即下载 .opml 文件）
* Tab 内包含 OPML 导入区域（文件上传）
* 前端添加 OPML 导出 hook
* 前端接入已有 OPML 导入 hook 到 UI
* 导入后 feed 列表自动刷新
* 导入导出操作有明确的成功/失败反馈（toast）
* i18n 支持（en + zh-CN）
* CommandPalette 中添加导入/导出命令

## Acceptance Criteria (evolving)

* [ ] 用户可以通过 UI 导出 OPML 文件并下载
* [ ] 用户可以通过 UI 上传 OPML 文件并导入订阅
* [ ] SettingsDialog 新增"订阅管理"tab 包含导入导出操作
* [ ] 导入后 feed 列表自动刷新
* [ ] 导入导出操作有明确的成功/失败反馈（toast）
* [ ] CommandPalette 支持导入/导出命令
* [ ] i18n 支持（en + zh-CN）

## Definition of Done

* Lint / typecheck 通过
* i18n 键值完整
* 功能在浏览器中可验证

## Out of Scope (explicit)

* 分类/文件夹（category/folder）支持 — 当前 Feed 模型是扁平的，OPML 嵌套 outline 暂忽略
* 导出包含阅读状态（已读/星标）

## Technical Notes

* 后端端点：`POST /api/feeds/import/opml`（UploadFile），`GET /api/feeds/export/opml`（返回 `{ xml: str }`）
* 后端 OPML 生成/解析：`backend/app/services/feed_fetcher.py:278`（`generate_opml`, `parse_opml`）
* 前端导入 hook：`frontend/src/api/hooks.ts:70`（`useImportOPML`）
* 前端 API client 已支持 upload：`api/client.ts` 中的 `api.upload()`
* 设置对话框：`frontend/src/components/settings/SettingsDialog.tsx`（tab 弹窗）
* 命令面板：`frontend/src/components/CommandPalette.tsx`
