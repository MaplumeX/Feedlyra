# Article Read/Unread Toggle Button

## Goal

Make the article detail interface expose a clear control for toggling the selected article between read and unread, so users do not need to rely on keyboard shortcuts or infer the current unlabeled icon behavior.

## What I Already Know

* User asked for an article interface button to switch read/unread state.
* The backend already supports `PUT /api/articles/{article_id}/read` with `{ read: boolean }`.
* The frontend already has `useToggleRead()` and `Article.is_read`.
* `ArticleDetail` already renders a toolbar button wired to `useToggleRead`, but it uses a generic `RotateCcw` icon with no tooltip or accessible label and does not visually communicate the current read state.
* Existing i18n namespaces are `reader` with `en` and `zh-CN` locale files.
* Existing UI conventions use shadcn `Button`, lucide-react icons, and icon buttons in the article toolbar.

## Assumptions

* The desired location is the article detail toolbar, next to the existing star action.
* The feature should reuse the existing read-state API and React Query invalidation behavior.
* A clear icon button with tooltip/ARIA label is enough for this task; no backend or data model change is needed.
* The button should show a distinct visual state when the current article is unread, similar to the star button's active state.

## Open Questions

* None. User confirmed the default approach on 2026-06-01.

## Requirements

* Add or improve the article detail toolbar button so it clearly toggles the selected article's read/unread state.
* Place the control in the existing article detail toolbar near the star action.
* The button label/tooltip must reflect the next action:
  * unread article -> "Mark as read"
  * read article -> "Mark as unread"
* The button must use the existing `useToggleRead()` mutation and pass the inverted `article.is_read` value.
* The button must be disabled while the read toggle mutation is pending.
* The unread state must have a visible affordance in the toolbar.
* Add matching English and Simplified Chinese reader locale strings.
* Do not introduce new backend endpoints or schema changes.

## Acceptance Criteria

* [ ] On an unread article, the detail toolbar shows a control whose tooltip/ARIA label says "Mark as read" / "标为已读".
* [ ] On a read article, the detail toolbar shows a control whose tooltip/ARIA label says "Mark as unread" / "标为未读".
* [ ] Clicking the control calls the existing read toggle mutation with the correct target state.
* [ ] The button is disabled while the mutation is pending.
* [ ] Lint/type-check/build verification passes for the changed frontend code.

## Definition of Done

* Tests added/updated where the project has test coverage for this surface.
* Lint/type-check/build checks are green.
* No unrelated refactors or backend changes are included.
* Trellis quality and finish steps are followed.

## Out of Scope

* Changing automatic mark-as-read behavior when selecting or scrolling articles.
* Adding list-row read/unread buttons.
* Changing unread counts or feed aggregation logic.
* Adding new keyboard shortcuts.

## Technical Notes

* Likely files:
  * `frontend/src/components/ArticleDetail.tsx`
  * `frontend/src/i18n/locales/en/reader.json`
  * `frontend/src/i18n/locales/zh-CN/reader.json`
* Relevant existing hook: `frontend/src/api/hooks.ts` -> `useToggleRead`.
* No external research is needed; the implementation reuses existing local APIs and UI patterns.
