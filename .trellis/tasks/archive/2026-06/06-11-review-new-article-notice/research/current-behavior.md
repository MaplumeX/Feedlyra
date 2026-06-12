# New Article Banner Review

## Scope

* `frontend/src/components/ArticleList.tsx`
* `frontend/src/lib/articleList.ts`
* `frontend/src/lib/articleList.test.ts`
* `frontend/src/api/hooks.ts`
* `frontend/src/api/types.ts`
* `backend/app/routers/articles.py`
* `backend/app/routers/feeds.py`
* `backend/app/services/feed_fetcher.py`
* Recent fixes `1ad140a` and `181a53b`

## Confirmed Findings

### 1. Refetch changes the visible list before the banner is clicked

The refreshed React Query pages replace the old pages immediately. The component
only filters unknown IDs from the refreshed data; it does not retain the
previously visible snapshot.

Example with a page size of three:

* Before: `[a, b, c]`
* Refetched first page: `[new, a, b]`
* Banner count: `1`
* Visible before click: `[a, b]`

The old row `c` disappears before acknowledgement. With multiple pages, the
same displacement happens at the tail of the loaded page chain.

Relevant code:

* `ArticleList.tsx:238-255` reconciles the replacement query data.
* `ArticleList.tsx:266-283` renders only from the replacement pages.

### 2. Filter membership changes create false "new article" banners

`reconcileArticleAcknowledgements` defines every unknown first-page ID as new.
That is not equivalent to a newly fetched article.

In the unread filter:

1. The initial first page is acknowledged.
2. The user reads one row.
3. The cache intentionally keeps that row until a later refetch.
4. The two-minute refetch removes the read row and pulls an older unread row
   into the first page.
5. That older row was never loaded, so it is reported as a new article.

The same issue applies to un-starring rows in the starred filter and other
operations that change filtered-list membership.

Relevant code:

* `articleList.ts:127-128` treats unknown first-page IDs as new.
* `hooks.ts:397-412` refetches the active infinite query every two minutes.
* `hooks.ts:336-339` leaves mutation-updated article queries stale, so a later
  active refetch rebuilds filtered membership.

### 3. Banner count and hidden row count can disagree

The banner count includes only unknown IDs from page one, but rendering hides
every unacknowledged ID from every cached page whenever the count is positive.

If page one contains one new ID and an existing later page is rebuilt with an
unknown historical ID, the banner says `1` while both IDs are hidden. This can
shrink the list substantially or leave a sparse/blank viewport.

Relevant code:

* `articleList.ts:119-128` only acknowledges newly appended page indexes and
  only reports first-page unknown IDs.
* `ArticleList.tsx:271-277` hides unacknowledged IDs across all pages.

### 4. The count is capped by the first page and can miss fetched articles

The detector cannot count more than the first-page limit (50 by default). If 60
new top-sorted articles arrive, the banner reports 50; the remaining 10 appear
later through pagination without being included in the message.

Additionally, the backend sorts primarily by `published_at`, while newly
fetched articles are identified by a newer `fetched_at`/`created_at`. A newly
ingested but backdated RSS item can land below page one and never trigger the
banner. If its page is loaded, it can be auto-acknowledged as history.

Relevant code:

* `backend/app/routers/articles.py:199-200` sets the page limit.
* `backend/app/routers/articles.py:242-246` sorts by publication time first.
* `backend/app/services/feed_fetcher.py:333-343` records fetch/create time.
* `articleList.ts:119-128` ignores unknown IDs outside page one.

### 5. Manual refresh finishes visually before article refetch finishes

`useRefreshAllFeeds.onSuccess` starts two invalidations but does not return or
await their promises. TanStack Query therefore marks the mutation complete and
`refreshAll.isPending` becomes false before the refreshed article query has
completed. The spinner stops first; the new-article banner can appear later,
and the button can be clicked again during that gap.

The backend also commits each feed independently during refresh-all, so an
interval refetch that overlaps the operation can observe and report a partial
batch while the refresh spinner is still active.

Relevant code:

* `frontend/src/api/hooks.ts:140-147`
* `frontend/src/components/ArticleList.tsx:534-542`
* `backend/app/services/feed_fetcher.py:366-385`

TanStack Query v5 documentation states that the invalidation promise must be
returned/awaited to keep the mutation pending until refetch completion.

### 6. Initial articles from a newly added/imported feed have delayed and odd banner timing

Adding or importing feeds starts article fetching in an unobserved background
task. The frontend invalidates feeds/categories immediately, but there is no
article invalidation when the background task completes.

If the user opens the new feed before that task completes, the empty result
becomes the acknowledgement baseline. Up to two minutes later, the first
article poll can present the feed's initial history as "new articles" behind a
banner instead of loading the new subscription normally.

Relevant code:

* `backend/app/routers/feeds.py:61-83`
* `backend/app/routers/feeds.py:276-292`
* `frontend/src/api/hooks.ts:111-120`
* `frontend/src/api/hooks.ts:188-196`

## Test Gaps

Only pure helper behavior is covered. There are no component/integration tests
for:

* preserving the visible list before acknowledgement;
* unread/starred membership shifts;
* multiple loaded pages with unknown replacement IDs;
* more new articles than one page;
* refresh mutation and invalidation timing;
* add/import background-fetch completion;
* the full banner click and Virtuoso sequence.

The existing frontend test command could not run in this workspace because
dependencies are not installed (`vitest: command not found`). The pure helper
scenarios above were reproduced with equivalent JavaScript state transitions.

## Root Cause

The feature tracks an ever-growing set of IDs seen in the current component,
but it has no authoritative "newly fetched since baseline" marker and no
separate snapshot for the list that must remain visible before acknowledgement.
ID novelty in a paginated, filtered cache is therefore used for three different
meanings that are not equivalent:

* newly fetched article;
* previously unseen historical article;
* row newly entering a filter after membership changes.

