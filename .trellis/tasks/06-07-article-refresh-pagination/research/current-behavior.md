# Current article refresh and pagination behavior

## Scope inspected

- `frontend/src/components/ArticleList.tsx`
- `frontend/src/api/hooks.ts`
- `frontend/src/lib/articleList.ts`
- `frontend/src/lib/articleList.test.ts`
- `backend/app/routers/articles.py`
- `.trellis/spec/frontend/state-management.md`
- `.trellis/spec/frontend/hook-guidelines.md`

## Existing data flow

1. `useInfiniteArticles` stores one infinite query per feed/filter parameter object.
2. Active article queries refetch every two minutes.
3. `reconcileArticleAcknowledgements` treats unknown first-page IDs as new and automatically acknowledges newly appended history pages.
4. `ArticleList` hides every unacknowledged article while `newArticlesCount` is positive.
5. Clicking the banner acknowledges all cached IDs, clears the count, and scrolls Virtuoso to index zero.

## Findings

### Banner click does not reset pagination

The click handler leaves every loaded `pages` and `pageParams` entry in the infinite query. Scrolling to item zero changes only the viewport, not the pagination state. The list therefore still contains all previously loaded pages and `hasNextPage` is derived from the old last page.

The current filtered query should be reduced to:

- `pages: [latestFirstPage]`
- `pageParams: [initialPageParam]`

This makes the next `fetchNextPage` use the latest first page's `next_cursor`.

### Banner is unreachable when all old rows are hidden

The banner is rendered only in the branch where `articles.length > 0`. If the visible baseline is empty and a refetch adds hidden new articles, `articles.length` remains zero and the component renders only the empty state. The banner must be rendered independently of the non-empty list branch.

### Post-paint reconciliation can briefly expose new rows

The query data render happens before a normal `useEffect` updates `newArticlesCount`. On the first render after an automatic refetch, the old count can still be zero, so unknown rows are included once before the effect hides them. Reconciliation must finish in a layout effect so the corrective render occurs before browser paint.

### Appended history needs an acknowledgement render signal

When a banner is already visible and another history page is loaded, reconciliation adds that page's IDs to the acknowledgement set while the banner count can remain unchanged. Mutating only a ref plus setting the same count does not trigger another render, leaving the appended page hidden. The rendered acknowledgement snapshot must update whenever the set grows.

### Filter isolation is already structurally correct

`queryKeys.articles.infiniteList(params)` includes `feed_id`, `read_status`, and `starred`, so all/unread/starred caches are distinct. Component acknowledgement refs are reset on feed/filter changes. No shared server-data state is stored in Zustand.

### Cursor pagination supports first-page reset

The backend cursor encodes the last row's `published_at`, `created_at`, `id`, and response page number. The next-page query uses a stable keyset boundary, so after retaining the refreshed first page, its `next_cursor` is the correct starting point for rebuilding the remaining history pages.

## Recommended implementation

- Add a small pure helper that truncates an `InfiniteData`-shaped value to its first page while preserving object identity when no truncation is needed.
- Use the helper through `queryClient.setQueryData` for the exact current infinite-list query when the banner is clicked.
- Acknowledge the retained first page, clear the banner count, and scroll to index zero.
- Reconcile acknowledgement state in `useLayoutEffect` and publish a new read-only set snapshot whenever acknowledged IDs are added.
- Move banner rendering above the empty/list branch.
- Unit-test the truncation helper and retain the existing acknowledgement tests.
