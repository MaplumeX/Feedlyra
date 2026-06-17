# Journal - Maplume (Part 2)

> Continuation from `journal-1.md` (archived at ~2000 lines)
> Started: 2026-06-07

---



## Session 56: 修复新文章提示与分页联动

**Date**: 2026-06-07
**Task**: 修复新文章提示与分页联动
**Branch**: `MaplumeX/krakow`

### Summary

检查并修复文章自动刷新、新文章提示、全部/未读筛选与无限分页联动；点击提示后重置到最新第一页，修复空列表提示、绘制时序和追加历史页确认状态，并补充测试与前端规范。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6e63fb2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 57: Add floating mode for AI chat panel

**Date**: 2026-06-09
**Task**: Add floating mode for AI chat panel
**Branch**: `MaplumeX/ai-chat-floating-mode`

### Summary

Implemented floating mode for the AI chat panel: detachable overlay with drag/resize, non-modal interaction, mode toggle in header, default mode setting, position/size persistence, viewport clamping, Shift+C and command palette respect configured mode.

## Session 57: 修复新文章提示后列表跳底空白

**Date**: 2026-06-09
**Task**: 修复新文章提示后列表跳底空白
**Branch**: `MaplumeX/copenhagen-v2`

### Summary

修复新文章提示点击后分页裁剪与 Virtuoso 滚动的提交时序，确保列表在最新第一页渲染后再定位顶部；补充回归测试和前端规范。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `025c35e` | (see git log) |
| `da9bebf` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 58: Add RSS automation rules feature

**Date**: 2026-06-10
**Task**: Add RSS automation rules feature
**Branch**: `MaplumeX/rss-automation-rules`

### Summary

Implemented RSS automation rules: multi-condition AND/OR matching, 5 actions (mark_read, star, delete, auto_translate, auto_extract), 3-tier scope (global/category/feed). Backend: model, migration, CRUD API, rule execution service integrated into feed_fetcher. Frontend: AutomationTab, condition builder RuleEditorDialog, Sidebar Zap button, FeedSettingsDialog quick view. 19 tests, tsc/eslint clean.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c20bb51` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 59: Fix missing scroll read marks

**Date**: 2026-06-11
**Task**: Fix missing scroll read marks
**Branch**: `MaplumeX/oslo`

### Summary

Replaced observer-only virtual-row exit detection with guarded Virtuoso range tracking, added regression coverage, verified continuous and jump scrolling, and documented the virtualization lifecycle constraint.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4bce780` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 60: Fix new article notification flow

**Date**: 2026-06-12
**Task**: Fix new article notification flow
**Branch**: `MaplumeX/amman`

### Summary

Replaced ID-based detection with snapshot/count APIs, stabilized refresh and initial-feed timing, added migration/tests, and updated Trellis specs.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ea5a088` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 61: Remove sidebar feed item more-menu dropdown

**Date**: 2026-06-17
**Task**: Remove sidebar feed item more-menu dropdown
**Branch**: `MaplumeX/lumeX/sidebar-subscription-no-more-menu`

### Summary

Removed the three-dot more-menu dropdown from individual feed subscription items in the sidebar (renderFeedItem in Sidebar.tsx). Refresh / settings / move-to-category / delete remain accessible via the feed item right-click context menu. Cleaned up now-unused DropdownMenuSub imports. Category-group more-menu left untouched per scope. tsc and lint both green.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `cb69a2a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 62: i18n support for RSS automation feature

**Date**: 2026-06-17
**Task**: i18n support for RSS automation feature
**Branch**: `MaplumeX/automation-i18n-fix`

### Summary

RSS automation feature (#82) shipped ~50 hardcoded English strings with // TODO: i18n markers. Wired them into existing react-i18next: added automation.* keys to en/zh-CN settings locales, replaced markers with t() in RuleEditorDialog/AutomationTab/FeedSettingsDialog/Sidebar/SettingsDialog. Settings-context components use useTranslation('settings'); reader-default components cross-ref via { ns: 'settings' }. Stored field values and proper nouns (language names, AND/OR) left literal. Added 'Don't commit hardcoded strings' forbidden-pattern to frontend quality-guidelines spec with the #82 incident as rationale.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `313ba85` | (see git log) |
| `fb3d6b6` | (see git log) |
| `6726910` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 63: 优化文章列表条目样式：标题始终加粗并移除行内收藏按钮

**Date**: 2026-06-17
**Task**: 优化文章列表条目样式：标题始终加粗并移除行内收藏按钮
**Branch**: `MaplumeX/article-list-item-style`

### Summary

ArticleRow 标题改为固定 font-medium，不再随已读/未读状态变化字重；删除行内 Star 收藏按钮及 toggleStar/Star/useToggleStar 孤儿导入。收藏功能在文章详情与键盘快捷键中保留。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e1659db` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
