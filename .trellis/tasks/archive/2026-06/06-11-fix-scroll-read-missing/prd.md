# Fix Missing Scroll-to-Read Marks

## Goal

Identify and fix the bug that causes some articles to remain unread after the user scrolls past them in the article list.

## What I already know

* The current scroll-to-read behavior occasionally misses articles.
* Recent commits changed scroll mark-read accuracy and article-list pagination, so the regression may involve event timing, visibility tracking, or mutable list data.
* The working tree was clean when the investigation started.
* A controlled reproduction scrolled from article 0 through article 16, but the batch endpoint received only article 6 and article 13.
* Virtuoso unmounts rows above its rendered range before most asynchronous IntersectionObserver exit notifications are computed.

## Assumptions (temporary)

* The expected behavior is that every eligible unread article crossed during a downward user scroll is eventually marked read exactly once.

## Requirements (evolving)

* Trace the complete frontend flow from scroll/visibility detection through the mark-read mutation.
* Compare the current implementation with the recent scroll-read and pagination fixes.
* Eliminate the confirmed virtualization/observer lifecycle race rather than only reducing its frequency.
* Preserve manual read-state changes and existing pagination behavior.
* Do not mark articles during upward scrolling, initial render, resize, feed/filter changes, or non-scroll data replacement.
* Replace IntersectionObserver item-exit detection with guarded Virtuoso range tracking.
* Keep the existing debounce, batch mutation, submitted-ID deduplication, and mutation error rollback behavior.

## Acceptance Criteria (evolving)

* [x] A concrete root cause and reproducible sequence are documented.
* [x] Articles covered by that sequence are marked read after being scrolled past.
* [x] Existing scroll-to-read behavior remains unchanged for already working paths.
* [x] Focused regression coverage is added or updated.

## Definition of Done (team quality bar)

* Tests added or updated where appropriate.
* Frontend lint, type-check, and focused tests pass.
* Relevant technical notes are updated if the fix reveals a reusable rule.

## Out of Scope (explicit)

* Redesigning the article list or read-state UX.
* Unrelated pagination, refresh, or backend refactors.
* Adding new configuration options for scroll-to-read.

## Technical Notes

* Relevant recent commits: `e7c51e9`, `1ad140a`, `181a53b`.
* Primary affected file: `frontend/src/components/ArticleList.tsx`.
* The backend batch endpoint and React Query cache transitions correctly process every ID they receive.
* Research: [`research/current-behavior.md`](research/current-behavior.md).
* Verification on June 11, 2026:
  * Continuous 80px/80ms downward scrolling to 1600px submitted articles 0 through 16 exactly once.
  * A single direct jump to 1600px submitted articles 0 through 16.
  * Upward scrolling, viewport resize, and disabled scroll-mark-read produced no new batch request.
  * Frontend tests, lint, and production build passed; lint retained 10 pre-existing warnings.

## Technical Approach

Replace asynchronous DOM exit detection with guarded Virtuoso
`rangeChanged` tracking. Record the previous rendered start index and, only during an
active downward scroll, queue unread article IDs crossed by the new start index. Keep
the existing debounce, batch mutation, deduplication, context reset, and error rollback.

## Decision (ADR-lite)

**Context**: Virtualized rows can be unmounted before IntersectionObserver reports that
they left through the top, so observer-only detection cannot guarantee complete marking.

**Decision**: Use guarded Virtuoso `rangeChanged` tracking. The user confirmed this
approach on June 11, 2026.

**Consequences**: Guarded range tracking removes the lifecycle race but requires
updating the existing frontend guideline that currently rejects unguarded
`rangeChanged` usage.
