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


## Session 64: Fix AI chat panel layout crash on toggle

**Date**: 2026-06-17
**Task**: Fix AI chat panel layout crash on toggle
**Branch**: `MaplumeX/lumeX/ai-chat-window-resize-bug`

### Summary

Diagnosed 'Invalid N panel layout' crash (HomeErrorBoundary) and resize failure as a react-resizable-panels@4.11.1 ResizeObserver race: after the conditional ai-chat Panel unmounts mid-session, the Group's internal layout object keeps a stale ai-chat key; jt() copies it through into U(), which throws when layout value count != registered panel count. Fixed with a single-line key={groupKey} on <Group> so the whole group remounts on every panel-set transition, re-seeding from defaultSize/defaultLayout. loadLayout() stale-entry stripping is mount-time only (doesn't help). Reset-scroll tradeoff on chat open/close accepted. tsc/eslint/vitest green; UI crash not browser-verified (no article data to trigger the flow). Spec updated with the runtime layout-key contract.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `47a4fb8` | (see git log) |
| `513313f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 65: Polish floating AI chat panel UI

**Date**: 2026-06-20
**Task**: Polish floating AI chat panel UI
**Branch**: `main`

### Summary

Merged the floating panel's stacked title bars by reusing AIChatPanel's header as the drag handle (props injected via cloneElement). Added hover edge/corner resize highlights, rounded-xl + focus-within shadow lift, and recalibrated default/min sizes (420x560 / 320x420). Fixed the entrance-animation bug so only newly appended messages animate, tightened message spacing, and gave the input a more tactile focus state. Fixed a floating-mode right-side blank strip (redundant horizontal flex wrapping a single non-flex-1 child). Updated specs for the merged-header drag model, the entrance-animation pattern, and the flex single-child width-collapse gotcha.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `841ef60` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 66: 修复登录/注册表单提交失败无错误提示

**Date**: 2026-06-21
**Task**: 修复登录/注册表单提交失败无错误提示
**Branch**: `main`

### Summary

LoginPage/RegisterPage 的 onSubmit 用 await api.* 但无 try/catch,失败抛出 unhandled promise rejection 导致用户看不到错误。修复:两页 onSubmit 包 try/catch + toast.error;新增 src/lib/auth-errors.ts 把后端 detail 映射到 i18n key(未知 detail 兜底 errors.unexpected);en/zh-CN auth.json 同步加 4 个 errors.* key;补 auth-errors.test.ts 单测。沉淀 spec:quality-guidelines 新增 Forbidden Pattern「未 catch 的 async form onSubmit」,并区分直接 await api.* (需 try/catch) vs React Query mutation (走 onError,无需 try/catch) 两种模式。验证: tsc/lint 0 errors, test 12 passed。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `57383ac` | (see git log) |
| `3bd45e2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

---

## Session: 2026-06-21 — AI 内容聚合(MVP:跨文章问答自动检索)

### Task
`.trellis/tasks/06-21-ai-content-aggregation`

### What
扩展 AI 能力从"单篇"到"跨文章":用户在新对话(无引用)提问时,后端自动从最近 7 天文章(title + 已缓存 feed 摘要)关键词检索 top-5,以 `is_auto=True` 写入 `ConversationReference`,复用现有 multi-article prompt。为 ②digest/③去重/④智能过滤预留检索服务接口。新增 `User.ai_cross_article_search` 开关(默认开,settab 可关)。

### Decisions (brainstorm)
- Q1 MVP=① 跨文章问答自动检索(复用 Conversation,为 ②③④ 铺地基)
- Q2 技术路线=关键词检索(零新依赖,不引 pgvector)
- Q3 范围=最近 7 天(时间窗收窄,`since` 入参为 ②digest 预留)
- Q4 触发=提问时自动 + 无引用时触发(复用现有 chat 流与 chip UI)
- Q5 开关=默认开 + 可关

### Changes
- backend: `services/retrieval.py`(新)+ `tests/test_retrieval.py`(新,19 单测)+ migration 015 + User 字段 + ai schema + ai router(config 读写 + `_do_conversation_chat` 接入)
- frontend: `api/types.ts` + `api/hooks.ts` + `AISettingsTab.tsx` switch + i18n(en/zh-CN)
- spec: `database-guidelines.md` 加 "Scenario: Cross-Article Auto-Retrieval Service";`backend/index.md` 加约定条目

### Check results (trellis-check sub-agent)
3 issues found & fixed:
1. **(阻塞验收3)** `update_ai_config` 未写入 `cross_article_search` → 开关此前关不掉。修复:补写入 + 返回字段。
2. **(设计偏离)** `article_summaries` 有 `(article_id,source,model)` 唯一约束,换 model 后同文多行 → outerjoin 产出多行 → 同文重复打分 + 重复 INSERT 撞 `conversation_references` 唯一约束 → IntegrityError 被 try/except 吞掉 → 整批 auto-ref 静默丢失。修复:候选集按 `Article.id` 去重再打分。
3. 死 import 清理(`tests/test_retrieval.py` 的 `pytest`、`retrieval.py` 的 `logging`/`logger`)。

### Status
[OK] 后端 60 passed、前端 build/lint 绿、迁移链合法(015 head)。alembic upgrade 未跑(环境无 PG,静态审查通过)。Ready to commit.
