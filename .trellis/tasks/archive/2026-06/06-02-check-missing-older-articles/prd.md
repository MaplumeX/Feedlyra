# Check Missing Older Articles

## Goal

Ensure the article list can display older articles instead of stopping at the backend's first paginated response.

## What I Already Know

- User reported that some older article entries appear not to be displayed.
- Backend `GET /api/articles` already supports pagination with `page` and `limit`.
- Backend default `limit` is 50, with a maximum of 200.
- Frontend `ArticleList` calls `useArticles(queryParams)` without `page` or `limit`, so it receives only the first page.
- `ArticleList` renders `data.items` in `GroupedVirtuoso` but does not load additional pages when the user scrolls.
- `ArticleListResponse` includes `total`, `page`, and `limit`, so the frontend can derive whether more pages exist.

## Assumptions

- Older articles exist in the database and are missing from the visible list because the frontend only renders page 1.
- The expected UX is to keep the existing virtualized article list and load older entries as the user scrolls down.
- Backend pagination behavior should remain unchanged unless implementation reveals an API defect.
- User confirmed the infinite-scroll loading approach.

## Requirements

- Article list must fetch additional pages when the user scrolls near or to the bottom.
- Loaded pages must be flattened into one list before grouping by date.
- Feed selection and list filter changes must reset pagination and load from the first page for the new query.
- Existing read/unread/starred filters must keep working with paginated loading.
- Existing scroll-to-mark-read behavior must continue to use the visible flattened list safely.
- Loading state should remain clear for initial load and background next-page load.

## Acceptance Criteria

- [ ] When total articles exceed the first backend page, scrolling down loads and shows older articles.
- [ ] Switching feed or filter does not retain stale articles from the previous query.
- [ ] The list does not duplicate articles across pages.
- [ ] Existing article selection, star toggle, read toggle, and mark-read-on-scroll behavior still work.
- [ ] Frontend type-check/build passes.

## Definition of Done

- Implementation follows frontend state/data-fetching conventions.
- Lint/type-check/build are run where available.
- Trellis check flow is completed.
- Spec update is considered and performed only if new durable conventions are discovered.

## Out of Scope

- Changing feed fetch retention policy.
- Reworking backend article ordering or storage.
- Adding a manual pagination UI unless infinite scroll is not viable.
- Changing keyboard shortcut behavior beyond avoiding regressions.

## Technical Notes

- Relevant frontend files:
  - `frontend/src/api/hooks.ts`
  - `frontend/src/components/ArticleList.tsx`
  - `frontend/src/api/types.ts`
- Relevant backend file:
  - `backend/app/routers/articles.py`
- `react-virtuoso` is already used for virtualized rendering and supports end-of-list callbacks.
