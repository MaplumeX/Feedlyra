# Fix: scroll mark-read should not invalidate article list query

## Goal

Scroll mark-read (batchRead) should use **optimistic UI** — marks as read silently on the frontend without triggering `invalidateQueries`. Articles stay visible in the unread list until the user manually refreshes or switches feeds. This eliminates both the "articles disappearing" and "false new-articles banner" problems at the root.

## Requirements

* `useBatchRead.onSuccess` must NOT call `invalidateQueries` on article queries — articles remain in the list as-is after scroll mark-read
* `useToggleRead.onSuccess` must NOT call `invalidateQueries` on article queries — clicking an article to mark read should not remove it from the list
* `useToggleStar.onSuccess` must NOT call `invalidateQueries` on article queries — toggling star should not cause a list refetch
* Feed list queries (`queryKeys.feeds.list()`) should still be invalidated (unread counts need updating)
* `useMarkAllRead.onSuccess` SHOULD keep `invalidateQueries` — this is an explicit bulk action, user expects the list to refresh
* `useRefreshAllFeeds` SHOULD keep its current behavior — manual refresh
* Background `refetchInterval` auto-refresh (2min) should still work — new articles detected via banner
* After scroll mark-read, the article row should visually update (dot disappears, font changes from bold to normal) without the article leaving the list

## Acceptance Criteria

* [ ] Scrolling to mark articles read: articles stay in the list, read indicator updates (dot disappears, font becomes normal)
* [ ] Clicking an article to mark it read: same — article stays, visual state updates
* [ ] Background auto-refresh still shows new-articles banner for genuinely new articles
* [ ] Manually acknowledging new articles (banner click) still works
* [ ] Feed sidebar unread counts still update correctly after marking read
* [ ] Mark-all-read still refreshes the list (explicit bulk action)

## Definition of Done

* Lint / typecheck / CI green
* Manual testing in unread view: scroll mark-read, click-to-read, auto-refresh, mark-all-read

## Technical Approach

1. Remove `invalidateQueries({ queryKey: queryKeys.articles.all })` from `useBatchRead`, `useToggleRead`, and `useToggleStar` in `hooks.ts`
2. Keep `invalidateQueries({ queryKey: queryKeys.feeds.list() })` in all three — feed unread counts need updating
3. For scroll mark-read: `unreadArticleIds` (ArticleList.tsx:286-289) is computed from `articles` data, which won't change without refetch. The IntersectionObserver already guards with `unreadArticleIdsRef` and `submittedIdsRef` — so no double-submission risk
4. For visual state: `ArticleRow` reads `article.is_read` directly. Since we're NOT refetching, the cached data still has `is_read: false`. We need **local optimistic update** — either via React Query's `setQueryData` to flip `is_read` on the cached article, or via a local state overlay in `ArticleList`

### Optimistic update strategy

Use React Query's `setQueryData` in the mutation's `onSuccess` to flip `is_read` (or `is_starred`) on the cached article entries. This updates the UI immediately without a network refetch, and the next `refetchInterval` cycle will naturally confirm the real data.

**For `useBatchRead`**: iterate all article query cache entries, flip `is_read: true` for matching IDs.

**For `useToggleRead`**: find the specific article in cache, flip `is_read`.

**For `useToggleStar`**: find the specific article in cache, flip `is_starred`.

## Out of Scope

* Changing `useMarkAllRead` behavior (explicit action, should still `invalidateQueries`)
* Changing `useRefreshAllFeeds` behavior
* Refactoring the acknowledged-article tracking mechanism
* Touching backend API

## Technical Notes

* Key files: `frontend/src/api/hooks.ts`, `frontend/src/components/ArticleList.tsx`
* `useBatchRead` — hooks.ts:308-318
* `useToggleRead` — hooks.ts:273-283
* `useToggleStar` — hooks.ts:285-293
* `useMarkAllRead` — hooks.ts:296-306
* Article query key structure: `queryKeys.articles.all`, `queryKeys.articles.infiniteList(params)`, `queryKeys.articles.detail(id)`
* React Query `setQueryData` can mutate cached data for infinite queries by iterating pages
