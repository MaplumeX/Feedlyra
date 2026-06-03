# Fix new articles banner false positive on initial load

## Goal

Prevent the "N new articles, click to view" banner from appearing on the very first data load when there's no React Query cache.

## What I already know

- `acknowledgedTotalRef` starts at `-1` sentinel
- `currentTotal` is `0` before data arrives (`data?.pages?.[0]?.total ?? 0`)
- First render: currentTotal=0, ref=-1 → sets ref to 0
- Data arrives: currentTotal=50, 50>0 → false banner "50 new articles"
- Bug only manifests on fresh page load (no React Query cache)
- With cached data the first render already has the real total, so no false positive

## Technical Approach

Add a `hasLoadedRef` boolean (initially `false`). In the detection `useEffect`, skip the comparison until `hasLoadedRef` is `true`. Set it to `true` on the first acknowledgment cycle (when `acknowledgedTotalRef.current === -1` and `currentTotal > 0`). This ensures the banner only appears for increases _after_ the initial data is shown.

## Acceptance Criteria

- [ ] Fresh page load does NOT show the new articles banner
- [ ] Background refetch detecting genuinely new articles still shows the banner
- [ ] Feed/filter switch still does not show a false banner
- [ ] Manual refresh / mark-all-read still does not show a false banner
- [ ] Clicking the banner still works correctly

## Out of Scope

- No changes to auto-refresh interval or refetch behavior
- No changes to i18n strings
- No new dependencies

## Technical Notes

- Single file: `frontend/src/components/ArticleList.tsx` lines 158-189
- Related: `frontend/src/api/hooks.ts` lines 250-263 (refetchInterval)
