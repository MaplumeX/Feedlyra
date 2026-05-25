# Journal - Maplume (Part 1)

> AI development session journal
> Started: 2026-05-22

---



## Session 1: AI RSS Reader — full stack implementation

**Date**: 2026-05-22
**Task**: AI RSS Reader — full stack implementation
**Branch**: `Feat/ai-rss-reader`

### Summary

Implemented complete AI-enhanced RSS reader: backend (FastAPI + SQLAlchemy + Alembic, auth, feed mgmt, AI features with BYOK, SSE chat streaming, Fernet-encrypted API keys), frontend (React 3-pane reader, keyboard shortcuts, command palette, AI chat/summarize/translate), and spec updates capturing 7 key learnings (HotkeysProvider, Fernet SHA256, SSE DB sessions, OpenAI empty choices, API key hygiene, buffer flushing, Zustand partialize).

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `7ff59f6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Replace resizable sidebar with fixed-width layout

**Date**: 2026-05-22
**Task**: Replace resizable sidebar with fixed-width layout
**Branch**: `Feat/fix-sidebar-display`

### Summary

Replaced react-resizable-panels with CSS flex fixed-width layout (sidebar 256px, article list 360px, detail flex-1). Added collapse/expand affordance with PanelLeft/PanelLeftClose icons. Deleted dead resizable.tsx wrapper. Updated frontend component spec with layout convention.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d72b94a` | (see git log) |
| `c984a78` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Add i18n internationalization support

**Date**: 2026-05-22
**Task**: Add i18n internationalization support
**Branch**: `Feat/support-i18n`

### Summary

为 Feedlyra 前端添加 i18n 国际化支持：react-i18next + i18next + i18next-browser-languagedetector + zod-i18n-map，支持 zh-CN 和 en 两种语言，9 个组件硬编码字符串替换为 t() 调用，侧边栏语言切换器，日期格式化跟随 locale，Zod 验证消息国际化。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ce255be` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 4: Add settings dialog with language switch and AI configuration

**Date**: 2026-05-22
**Task**: Add settings dialog with language switch and AI configuration
**Branch**: `Feat/sidebar-settings-and-ai-config`

### Summary

Implemented a unified settings dialog (Dialog + Tabs) replacing sidebar language dropdown and standalone /settings/ai page. Sidebar bottom now has a Settings gear button opening a modal with General (language switch) and AI (API config + test connection) tabs. Removed /settings/ai route and AISettings.tsx page. Added settingsDialogOpen to Zustand store.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d5329d2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: Bootstrap spec guidelines

**Date**: 2026-05-23
**Task**: Bootstrap spec guidelines
**Branch**: `Feat/complete-bootstrap-task`

### Summary

Populated all .trellis/spec/ backend and frontend guideline files with real conventions from codebase analysis. Archived 00-bootstrap-guidelines task.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b7a83ac` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: fix: auto-refresh token on 401 response

**Date**: 2026-05-23
**Task**: fix: auto-refresh token on 401 response
**Branch**: `Feat/fix-invalid-token-after-backend-restart`

### Summary

添加前端 401 拦截器，自动使用 refreshToken 调用 /api/auth/refresh 刷新 token 并重试原请求；并发去重；refresh 失败时 toast 提示 + logout + 跳转登录页；SSE streaming 请求同样处理 401


## Session 7: Optimize content display UI

**Date**: 2026-05-23
**Task**: Optimize content display UI
**Branch**: `Feat/optimize-content-view`

### Summary

Install @tailwindcss/typography for prose styling, add image lightbox with zoom-in cursor and ESC/close dismissal, add three-level font size toggle (sm/md/lg) persisted to localStorage

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `309273e` | (see git log) |
| `d13ebab` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: feat: scroll mark read with batch API and settings toggle

**Date**: 2026-05-23
**Task**: feat: scroll mark read with batch API and settings toggle
**Branch**: `Feat/scroll-mark-read`

### Summary

Implemented scroll-to-mark-read: Virtuoso rangeChanged detects articles leaving viewport top, debounced batch-read API marks them read. Added backend PUT /api/articles/batch-read with user ownership validation, frontend useBatchRead hook, scrollMarkRead setting toggle (default on, persisted), and Virtuoso stability guards. Updated specs for batch API security and Virtuoso scroll patterns.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `dbd2892` | (see git log) |
| `3ea521c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: OPML import/export UI

**Date**: 2026-05-23
**Task**: OPML import/export UI
**Branch**: `Feat/opml-import-export`

### Summary

Added OPML import/export frontend UI: SubscriptionsTab in SettingsDialog, useExportOPML hook, CommandPalette commands, i18n (en+zh-CN). Backend already had the endpoints.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e586f56` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: Add feed settings dialog

**Date**: 2026-05-23
**Task**: Add feed settings dialog
**Branch**: `Feat/sidebar-show-feed-title-instead-of-url`

### Summary

为订阅源添加设置 dialog，支持编辑标题，只读展示 URL/site_url/description。新增 useUpdateFeed hook，Sidebar DropdownMenu 添加 Settings 菜单项。更新 hook-guidelines spec 记录跨实体 invalidation 规则。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0da50d6` | (see git log) |
| `e36435a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: Add right-click context menu for feed items

**Date**: 2026-05-23
**Task**: Add right-click context menu for feed items
**Branch**: `Feat/feed-dropdown-right-click`

### Summary

Added ContextMenu (shadcn/ui) to feed items in Sidebar, enabling right-click to open Refresh/Delete menu alongside the existing three-dot DropdownMenu button. Updated component-guidelines spec with dual-trigger context menu pattern.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `cf23e32` | (see git log) |
| `3120730` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 11: Resizable sidebar and article list panels

**Date**: 2026-05-23
**Task**: Resizable sidebar and article list panels
**Branch**: `Feat/draggable-sidebar-article-width`

### Summary

Replace fixed-width flex layout with react-resizable-panels v4. Sidebar: 120-280px (default 192px), collapsible at 40px. ArticleList: 180-400px (default 280px). Layout persisted to localStorage. Double-click separator resets defaults. Updated component-guidelines spec.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `35981d1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 13: Add feed category/folder support

**Date**: 2026-05-24
**Task**: Add feed category/folder support
**Branch**: `Feat/feed-category`

### Summary

Implemented single-level feed categories: backend Category model + CRUD API, feed.category_id FK with ON DELETE SET NULL, OPML nested outline import/export, frontend sidebar category grouping with uncategorized section, AddFeed/FeedSettings category selectors, i18n keys. Check found 6 issues (exclude_unset bug, XML escape, cache invalidation gaps) — all fixed. Updated quality specs.

## Session 13: Use native overlay scrollbar to fix layout misalignment

**Date**: 2026-05-23
**Task**: Use native overlay scrollbar to fix layout misalignment
**Branch**: `Feat/article-list-scrollbar-independent-area`

### Summary

Removed custom ::-webkit-scrollbar CSS and replaced Radix ScrollArea with overflow-y-auto in Sidebar and ArticleDetail. Native overlay scrollbars no longer reserve layout space, fixing the visual misalignment between headers and scrollable content.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4e65ed0` | (see git log) |
| `70ce731` | (see git log) |
| `08b5b1e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 14: Fix article list right-edge padding

**Date**: 2026-05-24
**Task**: Fix article list right-edge padding
**Branch**: `Feat/article-list-right-boundary-gap`

### Summary

Remove right-side px-3 padding from ArticleList rows, date headers, filter bar, and skeleton loader. Overlay scrollbar doesn't need layout space, so pr-0 lets items extend to the right edge.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5e8c430` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 15: Add article list thumbnail feature

**Date**: 2026-05-24
**Task**: Add article list thumbnail feature
**Branch**: `Feat/article-list-thumbnail`

### Summary

Added thumbnail display for articles with images in list view. Backend: new image_url column in articles table (alembic migration 005), image extraction from RSS feed entries (media_thumbnail > media_content > enclosures > HTML img), updated model/schema. Frontend: ArticleRow shows 56x56 square thumbnail on right when image_url exists, silent fallback to text-only on load failure, Virtuoso state reset on article change.

## Session 15b: Line-through label for article list date headers

**Date**: 2026-05-24
**Task**: Line-through label for article list date headers
**Branch**: `Feat/optimize-article-list-time-style`

### Summary

将文章列表日期分组标题从 sticky inline label 改为 Slack 风格 Line-Through Label（居中文本+两侧水平线），保留 sticky 吸顶行为。同步更新 component-guidelines.md 添加该模式。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e9bf18e` | (see git log) |
| `9bbc41d` | (see git log) |
| `db87132` | (see git log) |
| `6f35ab4` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 16: Revert PR #16 and #18 scrollbar changes

**Date**: 2026-05-24
**Task**: Revert PR #16 and #18 scrollbar changes
**Branch**: `Feat/bordeaux-pr-16-18-summary`

### Summary

Reverted PR #16 and #18: restored custom ::-webkit-scrollbar CSS, Firefox scrollbar-width/color rules, Radix ScrollArea in Sidebar and ArticleDetail, and right-side px-3 padding in ArticleList. Added macOS overlay scrollbar gotcha to component-guidelines.md.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `32028c6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 17: Fix article list date header sticky behavior

**Date**: 2026-05-24
**Task**: Fix article list date header sticky behavior
**Branch**: `Feat/fix-article-date-sticky-header`

### Summary

Replace plain Virtuoso with GroupedVirtuoso for built-in sticky group headers. CSS position: sticky silently fails inside Virtuoso because item wrappers use position: absolute. Updated scroll-mark-read index mapping to handle GroupedVirtuoso absolute indices.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f31c791` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 18: Optimize date header visibility

**Date**: 2026-05-24
**Task**: Optimize date header visibility
**Branch**: `Feat/optimize-article-list-date-header`

### Summary

Increased article list date header visibility: text-xs/font-medium/muted-foreground → text-sm/font-semibold/secondary-foreground. Updated component-guidelines spec.

## Session 19: Dark mode support with three-state theme toggle

**Date**: 2026-05-24
**Task**: Dark mode support with three-state theme toggle
**Branch**: `Feat/night-mode`

### Summary

Added dark mode support: next-themes integration, ThemeProvider + ThemeToggle (light/dark/system cycle), FOUC prevention script, hardcoded color audit fix (text-green-600→text-primary), i18n theme labels (en/zh-CN), component spec updated with dark mode patterns.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `855c047` | (see git log) |
| `97f407b` | (see git log) |
| `465ae31` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 20: Add refresh all feeds button to article list header

**Date**: 2026-05-24
**Task**: Add refresh all feeds button to article list header
**Branch**: `Feat/article-list-header-refresh-button`

### Summary

Added POST /api/feeds/refresh-all backend endpoint + useRefreshAllFeeds() frontend hook + RefreshCw button in ArticleList header with loading state and i18n

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5b6144d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 20b: feat: auto AI summary with setting toggle and placeholder UI

**Date**: 2026-05-24
**Task**: feat: auto AI summary with setting toggle and placeholder UI
**Branch**: `Feat/auto-ai-summary`

### Summary

Implemented auto-generate AI summary feature: settings toggle (persisted), auto-trigger mutation with dedup guard, placeholder UI matching summary container style, i18n en/zh-CN. Updated frontend specs with two new patterns (Auto-Trigger Mutation with Dedup Guard, Placeholder UI with Same Container Style) and state-management partialize config.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4056c59` | (see git log) |
| `a7ae43a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 21: 阅读体验排版自定义

**Date**: 2026-05-24
**Task**: 阅读体验排版自定义
**Branch**: `Feat/reader-typography-settings`

### Summary

实现文章阅读视图 6 项排版参数可调（字号/字体/行高/内容宽度/字间距/段落间距），工具栏 popover 实时预览，Zustand persist 持久化，更新前端 spec

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f82f55e` | (see git log) |
| `fbbcaf1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 22: 添加订阅源管理表格到设置页面

**Date**: 2026-05-25
**Task**: 添加订阅源管理表格到设置页面
**Branch**: `feat/unified-feed-management`

### Summary

在设置 > 订阅管理 Tab 中添加了订阅源管理表格，支持搜索、添加、编辑分类、删除订阅源，显示健康状态和最后检查时间。纯前端改动，7个文件。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `40ab125` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
