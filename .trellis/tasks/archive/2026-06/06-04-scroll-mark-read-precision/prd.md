# Fix Scroll Mark Read Precision

## Goal

Make "mark as read on scroll" precise and predictable in the article list. An unread article should be marked read only after the user scrolls down past it, not because of observer setup timing, list refreshes, or an incorrect viewport offset.

## What I Already Know

* The user observed that current scroll-based read marking is not very precise.
* The feature is controlled by `scrollMarkRead` in `frontend/src/stores/reader.ts` and defaults to enabled.
* The current implementation is in `frontend/src/components/ArticleList.tsx`.
* It uses a module-level `IntersectionObserver` and observes Virtuoso item DOM nodes through `ObservableItem`.
* Read changes are batched through `useBatchRead` in `frontend/src/api/hooks.ts`, which invalidates article and feed queries on success.
* `react-virtuoso` is the list virtualization library.

## Requirements

* Keep the existing setting behavior: when `scrollMarkRead` is off, scrolling must not mark articles as read.
* Mark unread articles as read when the user scrolls down far enough that the article has actually passed above the article-list viewport.
* Avoid marking articles because initial item refs ran before the observer existed.
* Avoid marking articles because query invalidation, list refresh, item recycling, or filter changes changed DOM positions.
* Preserve existing explicit read behavior: selecting an unread article still marks it read immediately.
* Preserve batching so scrolling through many items does not issue one request per row.

## Acceptance Criteria

* [x] Initial visible rows are tracked consistently after the list mounts.
* [x] A row is not marked read while it is still in the visible article-list viewport.
* [x] Scrolling downward past unread rows batches those row IDs into `/api/articles/batch-read`.
* [x] Scrolling upward, filter changes, background refetches, and disabled `scrollMarkRead` do not create false read marks.
* [x] `npm run lint` passes for the frontend.
* [x] `npm run build` passes for the frontend.

## Research References

* [`research/react-virtuoso-scroll-range.md`](research/react-virtuoso-scroll-range.md) — `rangeChanged` exists, but the project quality guide warns against using it for scroll-triggered read marking; keep `IntersectionObserver` and fix its lifecycle instead.

## Technical Approach

Replace the module-level `IntersectionObserver` holder with component-owned observation:

* Capture scroll direction from the existing Virtuoso `scrollerRef`.
* Pass row registration through Virtuoso `context` to the custom `Item` component instead of using a module-level observer variable.
* Keep a set of mounted item elements and observe them when the scroller-root observer becomes available, fixing the initial-ref race.
* Use an `IntersectionObserver` with the actual Virtuoso scroller as root and no toolbar-offset `rootMargin`.
* Queue read marks only when an unread row exits above the scroller during downward user scrolling.
* Reset pending/submitted/observed tracking when feed, filter, or rendered article identity changes.
* Keep the existing debounced `batch-read` mutation.

## Decision (ADR-lite)

**Context**: The current DOM observer can miss initial rows because item refs can run before the observer exists, and its `rootMargin` does not match the Virtuoso scroller boundary.

**Decision**: Keep pixel-level `IntersectionObserver` detection, but make registration component-owned and guarded by scroll direction.

**Consequences**: This removes observer/ref timing bugs and incorrect top offset handling while staying aligned with the frontend quality guide. The implementation must reset observer-related state on list identity changes and avoid marking rows from non-scroll layout changes.

## Definition of Done

* Tests added or updated where practical; if no frontend test harness exists, validate through lint/build and code-level review.
* TypeScript and lint checks are green.
* No unrelated refactors or metadata churn.
* Trellis finish steps are followed after implementation.

## Out of Scope

* Changing the backend read-status API.
* Redesigning article row visuals or read/unread styling.
* Changing the explicit click-to-read behavior.
* Adding a new user-facing setting beyond the existing scroll toggle.

## Technical Notes

* Current observer creation happens in a `useEffect` after the scroller element is known. Item ref callbacks can run before `articleListObserver` is assigned, so initially rendered items may never be observed until they remount.
* Current observer uses `rootMargin: "-44px 0px 0px 0px"`. The toolbar is outside the Virtuoso scroller, so shrinking the observer root by 44px can treat rows as out of view while they are still visible near the top of the list.
* The implementation should prefer a state-driven or Virtuoso-provided visibility/range signal over a module-level observer if the local API supports it.
* Relevant files inspected:
  * `frontend/src/components/ArticleList.tsx`
  * `frontend/src/api/hooks.ts`
  * `frontend/src/stores/reader.ts`
  * `frontend/package.json`
* Browser smoke verification was attempted against `http://127.0.0.1:5173/`, but the in-app Browser backend reported no available browser instances. Frontend lint and build passed.
