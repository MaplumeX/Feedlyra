# Add bottom spacer to enable scroll-mark-read for last items

## Goal

Allow the last few articles in the feed list to be scrolled above the viewport so the IntersectionObserver can mark them as read — currently they get stuck at the bottom with no room to scroll further.

## What I already know

* `ArticleList.tsx` uses `react-virtuoso` `<Virtuoso>` with `IntersectionObserver`
* Observer only marks articles read when they scroll out through the **top** of the viewport (line 299: `boundingClientRect.top >= rootBounds.top` skip)
* `ArticleListFooter` returns `null` when not loading more — no bottom padding
* Scroll container has no `padding-bottom`, so last items can never scroll past the top
* Observer `rootMargin` is `"-44px 0px 0px 0px"` (header offset only)

## Assumptions (temporary)

* Adding a spacer div equal to the viewport height minus header height in `ArticleListFooter` will solve the problem
* No other components or logic need to change

## Open Questions

* (none — approach is straightforward)

## Requirements (evolving)

* Add a spacer element at the bottom of the Virtuoso list so the last articles can scroll above the viewport

## Acceptance Criteria (evolving)

* [ ] User can scroll the last article completely above the viewport
* [ ] IntersectionObserver correctly marks the last articles as read when they scroll out the top
* [ ] No visual regression (no unwanted scroll bouncing or layout shifts)

## Definition of Done (team quality bar)

* Lint / typecheck green
* Manual verification in browser

## Out of Scope (explicit)

* Changing the IntersectionObserver detection logic (bottom-exit detection)
* Changing the mark-as-read API or debounce behavior

## Technical Notes

* Key file: `frontend/src/components/ArticleList.tsx`
* `ArticleListFooter` component: lines 136-149
* Virtuoso `<Footer>` prop: line 427
* Observer root: Virtuoso scroller element
