# Scroll Mark-Read Investigation

## Reproduction

The frontend was run against a local mock API with 50 unread articles in the first page.
The Virtuoso scroller was advanced by 80 pixels every 80 milliseconds until
`scrollTop` reached 1600.

At the end of the scroll:

* The first mounted row was `article-17`, so articles `0` through `16` had passed above
  the rendered range.
* The mock `/api/articles/batch-read` endpoint received only:
  * `article-6`
  * `article-13`

The request and cache-update path worked for the IDs it received. The missing IDs were
never queued by the frontend.

## Root Cause

`ArticleList` relies exclusively on `IntersectionObserver` entries for mounted
Virtuoso item elements. Virtuoso virtualizes the list and removes rows above its
rendered range in chunks. Intersection observation delivery is asynchronous, so most
rows are unmounted and explicitly `unobserve()`d before a non-intersecting entry is
computed for them.

The result is timing-dependent: only the last row from some render chunks remains
mounted long enough to produce an observer entry. This matches the reproduced
`article-6`, `article-13` pattern.

The backend batch endpoint, mutation, and React Query cache transition logic are not
the source of this missed-mark path.

## Relevant Library Behavior

* `react-virtuoso@4.18.7` exposes `rangeChanged`, which reports the current rendered
  item range after scrolling.
* `increaseViewportBy` and `minOverscanItemCount` retain more offscreen rows, but they
  only reduce the race. A sufficiently large scroll jump can still remove multiple
  rows before their observer exits are delivered.
* The Intersection Observer specification schedules notifications asynchronously.
  Observation only applies while a target remains registered.

## Feasible Approaches

### A. Use Virtuoso range changes as the scroll-past signal (recommended)

Track the previous rendered start index. During an active downward scroll, queue every
unread article between the previous and current start indexes.

Pros:

* Enumerates every crossed article, including multi-row scroll jumps.
* Removes the lifecycle race between virtualization and DOM observation.
* Allows deletion of the observer registration machinery.

Cons:

* Requires revising the existing project guideline that rejects unguarded
  `rangeChanged` handling.
* Must retain guards for initialization, resize, data replacement, and upward scroll.

### B. Add top overscan

Keep rows mounted above the viewport using `increaseViewportBy` or
`minOverscanItemCount`.

Pros:

* Very small code change.

Cons:

* Mitigates rather than eliminates the race.
* The required buffer depends on scroll speed and row height.
* Keeps extra DOM mounted.

### C. Keep IntersectionObserver and add a range fallback

Use observer exits normally and range changes only for rows the observer missed.

Pros:

* Preserves the current mechanism for the common path.

Cons:

* Maintains two competing sources of truth.
* Adds more state and deduplication complexity than approach A.

## Sources

* `frontend/src/components/ArticleList.tsx`
* React Virtuoso Context7 documentation for `rangeChanged`, `increaseViewportBy`,
  `minOverscanItemCount`, and `itemsRendered`
* Intersection Observer specification sections for queued notifications and
  `unobserve()`
