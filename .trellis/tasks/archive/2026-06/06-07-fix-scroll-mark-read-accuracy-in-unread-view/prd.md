# Fix Scroll Mark-Read Accuracy in Unread View

## Goal

Fix inaccurate scroll-based mark-as-read in the unread article list, where articles that should be marked as read are missed due to overly strict scroll-direction guards.

## What I already know

* Core mechanism: `IntersectionObserver` in `ArticleList.tsx` marks articles as read when they scroll out the top of the viewport
* Three bugs identified:
  1. **1-second window guard too strict** — `RECENT_DOWN_SCROLL_WINDOW_MS = 1000` means if a user pauses reading for >1s then continues scrolling down, articles leaving the top are NOT marked as read. This is the primary bug.
  2. **Cleanup of `submittedIdsRef` on `articlesIdentity` change** — optimistic updates change `is_read`, which changes `articlesIdentity`, which clears `submittedIdsRef`. Any pending debounce IDs are also cleared, and error rollback can't work because the set was already emptied.
  3. **`unreadArticleIds` reactivity** — derived from `articles` array; in `unread` filter mode, marked-read articles may vanish from the list before the observer fires, causing the `has(articleId)` check to fail.
* File: `frontend/src/components/ArticleList.tsx`
* Constants: `SCROLL_MARK_READ_DEBOUNCE_MS = 300`, `RECENT_DOWN_SCROLL_WINDOW_MS = 1000`

## Requirements

* Fix Bug 1: Remove or relax the 1-second down-scroll window guard so that articles scrolled past the top are reliably marked as read regardless of reading pauses
* Fix Bug 2: Don't clear `submittedIdsRef` and `pendingIdsRef` on mere `articlesIdentity` change — only clear on feed/filter/scroll-mark-toggle changes
* Preserve existing behavior: only mark on downward scroll, only when `scrollMarkRead` is enabled, debounce batch submission

## Acceptance Criteria

* [ ] Scrolling down with reading pauses (>1s) still marks articles as read
* [ ] Scrolling up never marks articles as read
* [ ] Toggle `scrollMarkRead` off stops marking; toggling on resumes
* [ ] Switching feeds/filters resets state correctly
* [ ] Error rollback for batch-read still works

## Definition of Done

* Lint / typecheck green
* Manual verification in browser

## Decision (ADR-lite)

**Context**: 1-second window guard causes missed mark-read when user pauses reading then continues scrolling down.
**Decision**: Remove the `RECENT_DOWN_SCROLL_WINDOW_MS` time guard; only check `scrollDirectionRef.current === "down"`. Also fix cleanup effect to not clear state on mere `articlesIdentity` change.
**Consequences**: Articles reliably marked as read when scrolled past top during downward scrolling; no behavior change for upward scrolling.

* Refactoring the IntersectionObserver approach itself
* Changing the debounce timing
* Backend changes

## Technical Notes

* `ArticleList.tsx` lines 330-368: `handleIntersection` callback
* `ArticleList.tsx` lines 433-445: cleanup effect on `articlesIdentity`
- `ArticleList.tsx` line 337: the problematic guard `performance.now() - lastDownScrollAtRef.current > RECENT_DOWN_SCROLL_WINDOW_MS`
