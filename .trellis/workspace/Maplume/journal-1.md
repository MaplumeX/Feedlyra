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


## Session 22: Add feed management view to settings subscriptions tab

**Date**: 2026-05-25
**Task**: Add feed management view to settings subscriptions tab
**Branch**: `Feat/feed-management-settings-view`

### Summary

在设置页订阅标签页中增加统一管理视图：分类管理区域（Badge 横排 + 内联添加/重命名/删除）、扁平订阅源列表（FeedIcon + 标题 + 分类 Badge + DropdownMenu 编辑/删除）、复用 FeedSettingsDialog、动态扩宽对话框至 max-w-2xl、保留 OPML 导入导出、i18n 中英双语 14 个新 key

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9591ddc` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 23: AI摘要和Chat面板Markdown渲染

**Date**: 2026-05-26
**Task**: AI摘要和Chat面板Markdown渲染
**Branch**: `Feat/md-render`

### Summary

添加MarkdownContent通用组件（marked+DOMPurify+prose），AI摘要区域和Chat助手消息支持Markdown富文本渲染，更新组件规范spec

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d277811` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 24: Add Readability-lxml extraction for article full content

**Date**: 2026-05-26
**Task**: Add Readability-lxml extraction for article full content
**Branch**: `Feat/readability-web-extraction`

### Summary

Integrated readability-lxml + httpx to extract article content as HTML (replacing trafilatura plain-text fallback). Added POST /api/articles/{id}/extract endpoint and frontend '获取全文' button for on-demand extraction. Refactored articles router to share ArticleResponse building logic.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c24e72e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 25: Show full article button always in toolbar

**Date**: 2026-05-26
**Task**: Show full article button always in toolbar
**Branch**: `Feat/show-full-article-button-always`

### Summary

将'获取全文'按钮从文章无内容回退区移至工具栏，使其始终可见可点击，包括已有内容时也允许重新提取

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a432187` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 26: Full content toggle

**Date**: 2026-05-27
**Task**: Full content toggle
**Branch**: `Feat/provo-v1`

### Summary

Implemented a true article full-content toggle with persistent full_content storage, frontend original/full display switching, and documented the storage contract.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `445d821` | (see git log) |
| `d1b0bd8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 27: Article floating TOC

**Date**: 2026-05-27
**Task**: Article floating TOC
**Branch**: `Feat/floating-toc-for-articles`

### Summary

Added a floating article table of contents with responsive collapsed mode and draggable Y-position trigger; documented ScrollArea viewport ref usage.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `bb3d5bc` | (see git log) |
| `7c8ddd6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 28: Source-aware article summaries

**Date**: 2026-05-27
**Task**: Source-aware article summaries
**Branch**: `Feat/fulltext-summary-refresh`

### Summary

Implemented source-aware AI summary caching for feed and full article content, added migration and frontend selection logic, and documented the backend contract.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6b5c3da` | (see git log) |
| `c107216` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 29: Per-feature AI model config for translation, summary, and chat

**Date**: 2026-05-27
**Task**: Per-feature AI model config for translation, summary, and chat
**Branch**: `Feat/configurable-ai-models-per-feature`

### Summary

Added per-feature AI model, provider, and API key configuration for translation, summary, and chat features with fallback to global defaults. 13 files changed across backend (migration, model, schema, service, router) and frontend (types, hooks, component, i18n).

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `425b7ef` | (see git log) |
| `cbdf6d9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 30: Align reader top bars

**Date**: 2026-05-31
**Task**: Align reader top bars
**Branch**: `Feat/align-three-topbars`

### Summary

Aligned the sidebar, article list, and article detail top bars to a shared fixed height and border baseline.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `aafc95c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 31: 完善用户系统

**Date**: 2026-05-31
**Task**: 完善用户系统
**Branch**: `Feat/improve-user-system`

### Summary

新增账户设置基础版：后端账户资料、邮箱、密码更新接口；前端设置账户 tab；同步用户类型和 auth store；记录账户管理 API 契约。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `debf739` | (see git log) |
| `2bd50ef` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 32: Change article entry display layout

**Date**: 2026-06-01
**Task**: Change article entry display layout
**Branch**: `Feat/none`

### Summary

在文章条目标题上方添加 Feed 名行，标题下方添加 2 行 content_snippet 摘要，简化 meta 行为仅 author + date

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6bb4a42` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 33: Feed list sorting

**Date**: 2026-06-01
**Task**: Feed list sorting
**Branch**: `Feat/feed-list-sorting`

### Summary

Added persisted feed list sorting by name or date added with ascending and descending options across the reader sidebar and subscription settings.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8239d42` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 34: Article read toggle button

**Date**: 2026-06-01
**Task**: Article read toggle button
**Branch**: `Feat/article-read-toggle`

### Summary

Added a clear article detail toolbar control for toggling read and unread state with localized labels.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ec1c08b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 35: Optimize unread article indicator

**Date**: 2026-06-01
**Task**: Optimize unread article indicator
**Branch**: `Feat/optimize-unread-article-indicator`

### Summary

Refactored ArticleRow layout: dot in dedicated gutter column, always-rendered span prevents layout shift, items-center for proper vertical centering, pl-4 on non-title rows for gutter alignment.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `3c00bbd` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 36: Remove article list date headings

**Date**: 2026-06-02
**Task**: Remove article list date headings
**Branch**: `Feat/article-date-headings`

### Summary

Removed date group headings from the article list while keeping per-article published dates; frontend build passed, lint is blocked by missing ESLint 9 flat config.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `cd34830` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 37: Remember original content display state

**Date**: 2026-06-02
**Task**: Remember original content display state
**Branch**: `Feat/remember-original-status`

### Summary

Implemented per-article local memory for full/original content display, documented the existing frontend ESLint 9 config gap, and recorded the Trellis task requirements.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `1887bfc` | (see git log) |
| `028ad6b` | (see git log) |
| `da23c52` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 38: Fix missing older articles

**Date**: 2026-06-02
**Task**: Fix missing older articles
**Branch**: `Feat/show-old-articles`

### Summary

Fixed article list pagination so scrolling loads older articles beyond the first backend page; added frontend hook guidance for infinite queries.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4d280ed` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 39: Redesign UI with Sharp Modern aesthetic

**Date**: 2026-06-02
**Task**: Redesign UI with Sharp Modern aesthetic
**Branch**: `Feat/frontend-design-styling`

### Summary

Comprehensive visual redesign of Feedlyra from default shadcn/ui slate theme to Sharp Modern style (Linear/Raycast inspired). New CSS variable palette (cool gray-blue, indigo primary), Google Fonts (Onest + Space Grotesk), 9 semantic variables for future extensibility, prose typography adaptation, full-site component updates (Sidebar, ArticleList, ArticleDetail, AIChatPanel, auth pages, settings), restrained <200ms animations.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6889fea` | (see git log) |
| `0fae293` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 40: Fix feed subscription bugs

**Date**: 2026-06-03
**Task**: Fix feed subscription bugs
**Branch**: `Feat/fix-add-feed-bugs`

### Summary

Fix 4 bugs in feed subscription flow: (1) add_feed returns 202 instead of silently passing on fetch failure, (2) handleMoveFeed uses useUpdateFeed hook instead of direct api.put, (3) add toast notifications for feed add success/warning/error, (4) OPML import triggers background async fetch per feed. Updated specs for 202 partial success pattern, dynamic mutation hook IDs, and background async session pattern.

## Session 40: Add per-feed auto full-text extraction

**Date**: 2026-06-03
**Task**: Add per-feed auto full-text extraction
**Branch**: `Fix/indianapolis`

### Summary

Added auto_full_text boolean field to Feed model. When enabled, opening an article automatically triggers readability-lxml full-text extraction instead of requiring a manual button click. Includes migration 009, backend schema/router updates, frontend auto-extract effect in ArticleDetail, and Switch toggle in FeedSettingsDialog.

## Session 40: Move account controls from settings to sidebar user menu

**Date**: 2026-06-03
**Task**: Move account controls from settings to sidebar user menu
**Branch**: `Feat/relocate-account-system`

### Summary

Refactored account system: replaced Settings Account tab with Sidebar user menu (DropdownMenu + sub Dialogs). Created EditUsernameDialog, EditEmailDialog, EditPasswordDialog from AccountSettingsTab. Removed Account tab from SettingsDialog.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `da69c4e` | (see git log) |
| `acbd2c1` | (see git log) |
| `3fded12` | (see git log) |
| `ea24f15` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 41: Add auto-refresh feeds feature

**Date**: 2026-06-03
**Task**: Add auto-refresh feeds feature
**Branch**: `Feat/auto-refresh-feeds`

### Summary

Added frontend auto-refresh via React Query refetchInterval (2min), NewArticlesBanner component with sentinel value pattern to prevent false positives on feed/filter switch and manual refresh.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `79183f8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 42: Add loading spinners to AddFeedDialog

**Date**: 2026-06-03
**Task**: Add loading spinners to AddFeedDialog
**Branch**: `Feat/fix-add-feed-ui-freeze`

### Summary

Fixed the UX where adding a feed showed only a disabled button with no progress feedback. Added Loader2 spinner + text change (Adding.../Finding...) to Add/Find buttons when isPending, and inline spinner to discovered feed items. Added i18n keys for en and zh-CN.

## Session 42: Fix new articles banner false positive on initial page load

**Date**: 2026-06-03
**Task**: Fix new articles banner false positive on initial page load
**Branch**: `MaplumeX/fix-new-articles-banner`

### Summary

Fixed the new-articles banner appearing on first page load by adding hasLoadedRef + isLoading guard to skip the 0→realTotal jump. Updated hook-guidelines spec with the fallback-value-before-data-arrives gotcha.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `dfc2193` | (see git log) |
| `9bf9337` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 43: Beautify AI chat interface

**Date**: 2026-06-03
**Task**: Beautify AI chat interface
**Branch**: `Feat/beautify-ai-chat-ui`

### Summary

Modern redesign of AIChatPanel: resizable panel, message avatars, typing indicator, multiline input, suggested prompts, copy/regenerate actions, dark mode support. Updated code-spec with four-panel layout and chat patterns.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9dfa0dc` | (see git log) |
| `74b51b0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 43: Make add-feed endpoint async background

**Date**: 2026-06-03
**Task**: Make add-feed endpoint async background
**Branch**: `MaplumeX/fix-slow-feed-subscription`

### Summary

Converted add_feed endpoint from synchronous blocking (await fetch_and_store_feed) to async background pattern using asyncio.create_task with independent db session. Endpoint now returns 201 immediately after creating feed record, matching the pattern already used by OPML import.

## Session 43: Separate AI chat into independent layout column

**Date**: 2026-06-03
**Task**: Separate AI chat into independent layout column
**Branch**: `MaplumeX/ai-chat-separate-tab`

### Summary

Moved AI chat panel from nested sub-panel inside ArticleDetail to a top-level 4th column in the Home layout. Opening chat no longer compresses article reading area. Chat auto-closes on article deselect, stays open on article switch.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2619161` | (see git log) |
| `f0aa76a` | (see git log) |
| `29bd79e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 44: Remove ArticleSummary generation from fetch_and_store_feed

**Date**: 2026-06-03
**Task**: Remove ArticleSummary generation from fetch_and_store_feed
**Branch**: `MaplumeX/remove-article-summary-from-fetch-feed`

### Summary

Deleted the auto-summarization block (lines 354-397) from fetch_and_store_feed(), decoupling feed fetching from ArticleSummary generation. On-demand summarization via /api/ai/articles/{id}/summarize remains intact.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9e191fa` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 45: Improve scroll mark-as-read accuracy with IntersectionObserver

**Date**: 2026-06-04
**Task**: Improve scroll mark-as-read accuracy with IntersectionObserver
**Branch**: `MaplumeX/fix-scroll-read-boundary`

### Summary

Replaced Virtuoso rangeChanged with IntersectionObserver for scroll mark-as-read. Uses rootMargin -44px to offset header, threshold:0 for pixel-accurate boundary detection. Custom ObservableItem component manages observe/unobserve lifecycle. Ref-based stable callback prevents observer recreation churn.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `944b121` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 46: Add bottom spacer for scroll-mark-read on last items

**Date**: 2026-06-04
**Task**: Add bottom spacer for scroll-mark-read on last items
**Branch**: `MaplumeX/scroll-mark-last-items`

### Summary

Added a calc(100vh - 44px) spacer div in ArticleListFooter so the last articles can scroll above the viewport and be marked as read by the IntersectionObserver. Also updated component-guidelines spec with the footer spacer gotcha.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e62e495` | (see git log) |
| `8a90631` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 47: Optimize LLM Summary Generation

**Date**: 2026-06-04
**Task**: Optimize LLM Summary Generation
**Branch**: `MaplumeX/optimize-llm-summary-gen`

### Summary

Replace simple content[:8000] truncation with smart paragraph extraction: preserve first/last paragraphs, extract first sentences from middle paragraphs, fallback to simple truncation when no paragraph structure. Fixed separator overhead budget bug. Added 13 unit tests. Updated spec with gotcha and convention.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2e3766c` | (see git log) |
| `c48ec10` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 48: Adapt auto-summarize to use full content when auto_full_text is enabled

**Date**: 2026-06-04
**Task**: Adapt auto-summarize to use full content when auto_full_text is enabled
**Branch**: `MaplumeX/auto-summary-fulltext-fetch`

### Summary

Modified ArticleDetail.tsx auto-summarize useEffect to coordinate with auto-extract when feedAutoFullText is true: waits for full-text extraction to complete, then generates source=full summary; falls back to source=feed on extraction failure. Non-auto-full-text feeds unaffected.

## Session 48: Upgrade AI Chat: Smart Context + Message Edit + Stop Generation

**Date**: 2026-06-04
**Task**: Upgrade AI Chat: Smart Context + Message Edit + Stop Generation
**Branch**: `MaplumeX/upgrade-ai-chat`

### Summary

Upgraded AI chat with smart paragraph extraction (20k chars) replacing raw 8k truncation; sliding window history summarization (keep last 6 turns, lazy-summarize older when >8 turns); stop generation button with stream cleanup; message edit (truncate+re-submit with proper async ordering); message truncation PUT endpoint; ArticleChat.history_summary column + migration; spec updates for database guidelines and cross-layer guide.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c6886b9` | (see git log) |
| `a3e407a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 49: Fix scroll mark-read precision

**Date**: 2026-06-04
**Task**: Fix scroll mark-read precision
**Branch**: `MaplumeX/san-diego-v1`

### Summary

Improved article-list scroll mark-as-read precision by making IntersectionObserver registration component-owned, adding downward-scroll guards, removing the incorrect scroller root offset, and updating frontend specs.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b8bc190` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 50: Fix scroll mark-read optimistic updates

**Date**: 2026-06-06
**Task**: Fix scroll mark-read optimistic updates
**Branch**: `MaplumeX/scroll-mark-read-and-new-article-display`

### Summary

Replace invalidateQueries with setQueryData-based optimistic updates in useToggleRead, useToggleStar, and useBatchRead. Prevents articles from disappearing in unread view after scroll mark-read and stops false new-articles banner triggers.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d39bc46` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 51: Add per-feed auto AI translation with target language config

**Date**: 2026-06-06
**Task**: Add per-feed auto AI translation with target language config
**Branch**: `MaplumeX/feed-auto-ai-translate`

### Summary

Implemented auto-translate feature: per-feed auto_translate toggle + translate_target_lang, global translate_default_lang, lazy translate on first article open, auto-switch to translated content. Also updated spec with auto-trigger error reset pattern and schema-field-in-constructor gotcha.

## Session 51: Upgrade AI Chat: Multi-Conversation, Image Attachments, Cross-Article Context

**Date**: 2026-06-06
**Task**: Upgrade AI Chat: Multi-Conversation, Image Attachments, Cross-Article Context
**Branch**: `MaplumeX/upgrade-ai-chat-v2`

### Summary

Upgraded AI chat from per-article binding to independent conversations with Conversation/ConversationReference models, conversation sidebar UI, image upload/paste/drag-drop with OpenAI vision format, and cross-article context via reference injection with budget-aware multi-article content truncation. Included database migration from article_chats, backend CRUD APIs, frontend components, i18n, and spec updates.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `3f8eefc` | (see git log) |
| `736c04e` | (see git log) |
| `3e45432` | (see git log) |
| `61e2d4b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 52: Beautify AI Chat UI

**Date**: 2026-06-06
**Task**: Beautify AI Chat UI
**Branch**: `MaplumeX/beautify-ai-chat-ui`

### Summary

Redesigned AI chat interface to ChatGPT-style layout: user messages right-aligned with colored pill background, AI messages left-aligned without bubble + Bot avatar. Replaced blinking cursor with 3 bouncing dots, added message fade-in animation, polished input area and empty state. Updated component spec with new patterns and pitfalls.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5432b62` | (see git log) |
| `cefb8df` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 53: Replace conversation sidebar with floating popover

**Date**: 2026-06-06
**Task**: Replace conversation sidebar with floating popover
**Branch**: `MaplumeX/session-history-compression`

### Summary

Removed fixed 260px conversation sidebar panel from the main layout and replaced it with a Radix Popover overlay anchored to a History button in AIChatPanel header. Popover dismisses on select/click-outside/Escape. All CRUD (search, create, rename, delete) preserved. Layout localStorage migration strips stale sidebar data.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `04be619` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 54: Fix AI chat panel drag failure and white screen on close

**Date**: 2026-06-06
**Task**: Fix AI chat panel drag failure and white screen on close
**Branch**: `MaplumeX/fix-ai-panel-drag-and-white-screen`

### Summary

Fixed two bugs: (1) Strip stale ai-chat layout entries in loadLayout() so conditionally rendered panels always initialize from defaultSize instead of stale persisted values causing undraggable panels. (2) Add mountedRef guard in AIChatPanel to prevent post-unmount state updates from async streaming callbacks, and add HomeErrorBoundary in App.tsx to catch render errors that cause white screen. Updated frontend component-guidelines spec with stale layout migration pattern and async callback unmount guard pattern.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8caa0b4` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 55: Fix article list pagination and filter state

**Date**: 2026-06-06
**Task**: Fix article list pagination and filter state
**Branch**: `MaplumeX/davao`

### Summary

Replaced mutable filtered article offset paging with opaque cursor pagination, fixed new-article detection to ignore appended history pages, synchronized read/star totals while preserving visible rows, based mark-all-read visibility on feed unread counts, and added frontend/backend regression tests plus specs.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e78a057` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
