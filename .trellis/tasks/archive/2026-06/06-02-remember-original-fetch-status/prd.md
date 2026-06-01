# Remember Original Fetch Status

## Goal

When a reader fetches and switches to the extracted original/full article content, the app should remember that display choice for the article instead of resetting back to feed content whenever the user leaves and returns.

## What I already know

* User request: "获取原文的状态能记住" (remember the original-content state).
* Existing backend endpoint `POST /api/articles/{article_id}/extract` fetches original/full content and persists it in `articles.full_content`.
* Existing frontend hook `useExtractContent()` updates the article detail query cache and invalidates article queries after extraction.
* Existing `ArticleDetail` component keeps `showFullContent` in local component state.
* Existing `ArticleDetail` effect resets both `showTranslation` and `showFullContent` whenever `selectedArticleId` changes, so the UI forgets the full-content view state.
* Existing reader state uses Zustand in `frontend/src/stores/reader.ts` for UI preferences and temporary reader state.

## Assumptions

* "原文" refers to the existing full/original article content action labeled "获取全文" / "显示全文", not the external-link action that opens the source website.
* The state to remember is whether each article should display full content after full content has been fetched.
* Remembering this choice can be client-side UI state; no backend schema or API change is needed.

## Requirements

* Remember, per article, whether the reader is currently set to display full/original content.
* Restore the remembered full-content display state when returning to an article that already has `full_content`.
* When the user switches off full content for an article, remember that choice for that article.
* Keep translation mutually exclusive with full-content display, matching current behavior.
* Do not change the backend extraction behavior or article response shape.
* Use local frontend state for this MVP; do not add backend persistence or cross-device sync.

## Acceptance Criteria

* [ ] If a user extracts full content for article A and the extraction succeeds, article A switches to full-content display and that choice is recorded.
* [ ] If the user opens article B and then returns to article A, article A still displays full content when `full_content` exists.
* [ ] If the user toggles article A back to feed content, leaves, and returns, article A stays on feed content.
* [ ] Translation view still turns off full-content view for the current article.
* [ ] Lint/type-check for the frontend passes.

## Definition of Done

* Tests added/updated where the project supports them.
* Lint / typecheck green for touched code.
* Docs/notes updated if behavior changes require it.
* Rollback is straightforward because the change is isolated to frontend UI state.

## Out of Scope

* Persisting the display choice to the backend across devices.
* Adding a global default to always prefer full content.
* Changing extraction quality, retry logic, or failure handling.
* Renaming existing "全文/原文" UI labels.

## Technical Approach

Use existing frontend UI state patterns. Add a per-article map in the reader store for full-content display preferences, restore `showFullContent` from that map when the selected article changes and article data is available, and update the map whenever the user toggles full-content display or a successful extraction switches the view on.

## Decision (ADR-lite)

**Context**: `full_content` is already server data, but the current display mode is transient component state and gets reset on article changes.

**Decision**: Store only the UI display preference per article in the existing Zustand reader store. Keep server content in React Query and the backend model.

**Consequences**: The implementation stays small and follows the existing state split. The remembered state is local to the current browser session/storage and is not shared across devices.

**User confirmation**: Option 1 confirmed on 2026-06-02: remember the state locally per article.

## Technical Notes

* Relevant frontend files:
  * `frontend/src/components/ArticleDetail.tsx`
  * `frontend/src/stores/reader.ts`
  * `frontend/src/api/hooks.ts`
* Relevant existing backend files inspected:
  * `backend/app/routers/articles.py`
  * `backend/app/services/feed_fetcher.py`
* Relevant guidelines:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/hook-guidelines.md`
