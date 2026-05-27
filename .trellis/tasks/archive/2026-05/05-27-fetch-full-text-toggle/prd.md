# Fetch Full Text Toggle Button

## Goal

Make the article detail toolbar's "Extract Full Content" action behave as a toggle-style control instead of a one-way action button, so users can clearly switch between the original feed content and the extracted full-content view after extraction succeeds.

## What I Already Know

* The user wants the "获取全文" button to exist as a toggle button.
* The user chose a true toggle: users must be able to switch back to original feed content after full content is fetched.
* The feature is already always visible in the article toolbar.
* `frontend/src/components/ArticleDetail.tsx` currently renders the extract action as an icon-only ghost button with a `FileText` icon.
* `frontend/src/api/hooks.ts` exposes `useExtractContent()`, which posts to `/api/articles/{articleId}/extract` and invalidates the article detail and list queries.
* `backend/app/routers/articles.py` already implements `POST /api/articles/{article_id}/extract`; it fetches the article URL, extracts readable content, stores it into `article.content`, and returns the updated article.
* `backend/app/models/article.py` currently stores one content field (`content`) and one snippet field (`content_snippet`).
* `backend/app/services/feed_fetcher.py` writes parsed feed entry content into `Article.content`; if an entry has no content, it may already auto-extract content from the article URL as a fallback.
* No frontend test framework is configured; verification will rely on lint/build and manual browser checks if the app runs locally.

## Assumptions

* The MVP should avoid backend schema or API changes unless frontend inspection proves there is no reliable way to represent both original and extracted content.
* The toggle should follow existing toolbar conventions: icon button, tooltip/title text from `reader` i18n files, and active state styling similar to existing active toolbar controls.
* Extraction failure should continue to show the existing localized failure toast.

## Open Questions

* None.

## Requirements

* Convert the "Extract Full Content" toolbar control into a toggle-style button.
* The button should visibly indicate when the full-content mode is active.
* If full content has not been extracted yet, activating the toggle should trigger extraction.
* Preserve the original feed content in a separate value so users can switch back after full content has been extracted.
* Preserve the extracted full content in a separate value so users can re-enter full-content mode without re-fetching the remote article.
* After full content is available, toggling on should show extracted full content and toggling off should show the original feed content.
* Each time an article is opened or the page is refreshed, the default display mode should be original feed content, even if extracted full content already exists.
* While extraction is pending, the control should remain disabled or show the existing pending visual state to prevent duplicate extraction requests.
* Keep copy localized in both `en` and `zh-CN` reader locale files.
* Preserve the existing extraction error toast behavior.

## Acceptance Criteria

* [ ] In article detail, the "获取全文" toolbar control is presented as a toggle-style control with an active state.
* [ ] Clicking it before extraction starts the existing extraction mutation.
* [ ] After extraction succeeds, the control indicates full-content mode is active and extracted full content is shown.
* [ ] Clicking it again returns to the original feed content without losing the extracted full content.
* [ ] Once full content has been extracted, toggling back on shows the cached full content instead of making another extraction request.
* [ ] Reopening an article or refreshing the page defaults back to original feed content.
* [ ] The button remains protected against repeated clicks while extraction is pending.
* [ ] English and Simplified Chinese toolbar titles/text are updated where needed.
* [ ] Backend and frontend type/build checks pass for the touched layers.

## Definition of Done

* Requirements above are implemented.
* Relevant frontend code follows project conventions for React Query, Zustand/UI state separation, shadcn/ui components, Tailwind styling, and i18n.
* Lint/build checks pass for the changed frontend.
* Any backend changes, if needed, follow the backend async/error-handling conventions.
* No unrelated refactors or metadata churn.

## Out of Scope

* Replacing the extraction library or changing readability extraction quality.
* Adding a new article content history system beyond what is needed for the confirmed toggle behavior.
* Redesigning the full article toolbar.
* Adding a test framework where none exists today.

## Technical Notes

* Likely frontend files:
  * `frontend/src/components/ArticleDetail.tsx`
  * `frontend/src/api/hooks.ts` if mutation/cache behavior needs adjustment
  * `frontend/src/i18n/locales/en/reader.json`
  * `frontend/src/i18n/locales/zh-CN/reader.json`
* Potential backend files because original and extracted content must both be preserved:
  * `backend/app/routers/articles.py`
  * `backend/app/models/article.py`
  * `backend/app/schemas/article.py`
  * Alembic migration under `backend/alembic/versions/`
* Relevant specs:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/backend/index.md` only if backend persistence changes are required
* Current backend extraction overwrites `article.content`, so a true toggle between original feed content and extracted full content requires a data model/API decision.
* Recommended data model direction: keep `Article.content` as the original feed content for compatibility, add a nullable extracted/full-content field for manually fetched full content, and expose it through `ArticleResponse`.
* For articles where RSS had no content and the fetcher already auto-extracted content as a fallback, that existing content remains the "original" content for this task unless a future migration separates fallback extraction from feed content.

## Decision (ADR-lite)

**Context**: The existing extraction flow replaces `article.content`, which prevents users from returning to the original feed content after extraction.

**Decision**: The feature should be a true content toggle: clicking "获取全文" fetches and displays extracted full content, and users can toggle back to the original feed content afterward.

**Consequences**: Implementation likely needs to preserve both the original feed content and the extracted full content. This may require backend schema/API changes instead of a frontend-only active-state change.

**Display default**: The article detail view should default to original feed content whenever an article is opened or the page is refreshed. Full-content mode is entered only by toggling the toolbar control on during the current view session.

## Complexity

Moderate. The UI toggle itself is straightforward, but true original/full-content switching likely requires backend persistence and frontend display-state changes.
