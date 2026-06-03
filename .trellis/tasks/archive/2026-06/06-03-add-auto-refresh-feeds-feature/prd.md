# Add Auto-Refresh Feeds Feature

## Goal

Make new articles from the existing backend auto-refresh visible in the frontend automatically, with a lightweight "N new articles" prompt.

## Requirements

* Frontend polls for new articles at a reasonable interval (e.g. every 2 min) using React Query `refetchInterval`
* When new articles are detected (article count increased since last fetch), show a lightweight banner at the top of the article list: "N 篇新文章，点击查看"
* Clicking the banner scrolls to top and refreshes the list (standard `invalidateQueries` pattern)
* Existing manual refresh buttons continue to work as-is
* No backend changes needed — backend auto-refresh already works

## Acceptance Criteria

* [ ] Articles list auto-updates via `refetchInterval` without user interaction
* [ ] "N 篇新文章" banner appears when new articles are detected after a background refetch
* [ ] Clicking the banner refreshes the list and scrolls to top
* [ ] Banner disappears after user clicks it or after manual refresh
* [ ] Manual "Refresh All" and per-feed refresh still work normally
* [ ] Lint / typecheck / CI green

## Definition of Done

* Lint / typecheck / CI green
* Tested manually: banner appears when backend fetches new articles

## Technical Approach

**Frontend-only, zero backend changes.**

1. Add `refetchInterval: 2 * 60 * 1000` (2 min) to the articles query in `useInfiniteArticles` / `useArticles` hooks
2. Track previous article count vs current count; when current > previous, show banner
3. Banner component: a small fixed bar at the top of ArticleList saying "N 篇新文章，点击查看"
4. On click: call `invalidateQueries` for articles, scroll to top, hide banner

## Out of Scope

* Per-feed configurable refresh interval
* Global auto-refresh on/off toggle
* WebSocket / SSE real-time push
* Any backend changes
* "上次刷新时间" display

## Technical Notes

* Frontend hooks: `frontend/src/api/hooks.ts` — `useInfiniteArticles` (line ~240-260), `useArticles`
* Article list component: `frontend/src/components/ArticleList.tsx`
* React Query `refetchInterval` docs: https://tanstack.com/query/latest/docs/react/reference/useQuery
* Backend auto-refresh already runs every 5 min with 15 min check interval per feed
