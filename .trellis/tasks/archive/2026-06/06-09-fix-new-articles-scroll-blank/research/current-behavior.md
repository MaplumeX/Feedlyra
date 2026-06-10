# Current Behavior and Root Cause

## Scope Inspected

- `frontend/src/components/ArticleList.tsx`
- `frontend/src/lib/articleList.ts`
- `frontend/src/lib/articleList.test.ts`
- `.trellis/spec/frontend/hook-guidelines.md`
- `.trellis/spec/frontend/component-guidelines.md`
- Commits `1ad140a`, `89aa965`, `3844771`
- React Virtuoso `scrollToIndex` documentation

## Current Click Sequence

`handleNewArticlesClick` currently performs these operations in one event handler:

1. Add the refreshed first-page article IDs to the acknowledgement set.
2. Publish the acknowledgement snapshot to React state.
3. Trim the current infinite query from all loaded pages to its first page.
4. Clear the new-article count.
5. Immediately call `virtuosoRef.current?.scrollToIndex(0)`.

The state and React Query cache updates are not committed to the rendered
`Virtuoso` synchronously at step 5. The imperative scroll command therefore
targets the old, long data set.

## Root Cause

The June 7 pagination fix correctly trims `pages` and `pageParams`, but it
couples that data replacement with an imperative scroll at the wrong time.

When the render commits:

- the visible list can shrink from several loaded pages to one page;
- Virtuoso still has the previous deep scroll offset/anchor;
- the earlier `scrollToIndex(0)` has already run against the pre-trim list;
- the stale offset is clamped against the new shorter content.

`ArticleListFooter` always adds `calc(100vh - 44px)` of bottom space so the last
article can be scrolled above the viewport for scroll-mark-read. A stale offset
at the end of the shortened list therefore lands inside this spacer, making the
article panel look blank.

This explains both reported symptoms:

- the scrollbar jumps to the bottom;
- the panel is blank even though the first page remains in React Query.

## Library Guidance

React Virtuoso exposes `scrollToIndex` as an imperative command and supports an
explicit `{ index, align, behavior }` location. The command should run after the
new data has been rendered when it depends on a data replacement.

For this case, the reliable sequence is:

1. mark a pending "reset to top" intent;
2. acknowledge the first page and trim the infinite query;
3. let React commit the one-page article array to Virtuoso;
4. in a layout-phase effect, reset the actual scroller and issue
   `scrollToIndex({ index: 0, align: "start", behavior: "auto" })`;
5. clear the pending intent.

Running in the layout phase prevents a frame of bottom-spacer blank content
from being painted.

## Constraints

- Keep the full-height footer spacer because scroll-mark-read relies on it.
- Continue trimming `pages` and `pageParams` together.
- Do not refetch solely for the banner click; the latest first page is already
  cached.
- Preserve feed/filter query isolation.
- Avoid smooth scrolling for this reset because the data set changes at the
  same time.

## Test Implications

Pure helper tests already cover pagination trimming, but they cannot catch the
imperative scroll ordering. Add focused coverage for the pending-reset state or
component-level click behavior, and manually verify with multiple loaded pages:

1. scroll deep into history;
2. receive a new-article banner;
3. click the banner;
4. confirm the latest article is visible at the top with no blank frame;
5. scroll down and confirm pagination resumes from the refreshed first page.
