# Hook Guidelines

> How hooks are used in this project.

---

## Overview

Two categories of hooks: **API data hooks** (TanStack Query, in `src/api/hooks.ts`) and **UI hooks** (in `src/hooks/`). SSE streaming uses a plain async function pattern, not a hook.

---

## API Data Hooks

Located in `src/api/hooks.ts`. Naming: `use` + domain entity + verb.

**Query hooks** (data fetching):

```tsx
export function useFeeds() {
  return useQuery({
    queryKey: queryKeys.feeds.list(),
    queryFn: async () => { /* ... */ },
  });
}
```

**Infinite query hooks** (paginated list fetching):

Use `useInfiniteQuery` for APIs that return `{ items, total, page, limit, next_cursor }` and are rendered as a single continuous list. Keep server pagination state inside React Query; do not mirror pages or fetched items in Zustand.

```tsx
export function useInfiniteArticles(params: ArticleListParams = {}) {
  const lang = useUiLang(); // "zh-CN" | "en" — in queryKey so a UI language switch refetches (see Summary Language Isolation)
  return useInfiniteQuery({
    queryKey: queryKeys.articles.infiniteList(params, lang),
    queryFn: ({ pageParam }) =>
      api.get<ArticleListResponse>(
        articleListPath({
          ...params,
          page: pageParam ? undefined : 1,
          cursor: pageParam ?? undefined,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}
```

Components should flatten `data.pages` locally before rendering. If duplicate rows are possible when data changes between page fetches, de-duplicate by stable entity ID during flattening.

Article read/star mutations intentionally keep already rendered rows in the current filtered list so the reading position does not jump. The mutation cache update must still:

- update `is_read` / `is_starred` on every cached representation
- adjust each filtered response's `total` by the membership delta
- update feed unread counts
- mark article queries stale with `refetchType: "none"` so a later filter switch/refetch rebuilds true membership without immediately disrupting the current list

### Scenario: Baseline-Based New-Article Banner

#### 1. Scope / Trigger

- Trigger: the reader must detect newly ingested articles without replacing the visible infinite-list snapshot before the user clicks the banner.
- Unknown IDs are not a valid signal because pagination and unread/starred membership changes also introduce previously unseen historical IDs.

#### 2. Signatures

- List response: `ArticleListResponse { items, total, page, limit, next_cursor, snapshot_at }`.
- Count API: `GET /api/articles/new-count?since=<timezone-aware ISO datetime>&feed_id=<uuid>&read_status=unread|read&starred=true`.
- Count response: `NewArticleCountResponse { count, initial_count, initial_fetch_pending }`.
- DB: `articles.is_initial_fetch: boolean not null default false`.
- Frontend: `useNewArticleCount(params, since)` polls the count API; `useRefreshInfiniteArticles(params)` explicitly fetches and installs a new first page.

#### 3. Contracts

- The infinite article query must not use interval, mount, reconnect, or window-focus refetches. Automatic detection updates only the count query, so current rows and scroll position remain unchanged.
- `count` includes every matching non-initial article with `created_at > since`; it is not limited by page size or publication date.
- `initial_count` contains first-fetch history. While `initial_fetch_pending` is true, poll every two seconds. After the whole initial-fetch batch finishes, refresh the first page automatically only when `count === 0`; regular new articles still require banner acknowledgement.
- Feed refresh mutations share one mutation key. Count polling pauses during refresh, and mutation success awaits feed and count invalidation so all refresh entry points expose the same pending state.
- Clicking the banner fetches a fresh first page and atomically replaces both `pages` and `pageParams`:

```tsx
queryClient.setQueryData<InfiniteData<ArticleListResponse, string | null>>(
  queryKeys.articles.infiniteList(params),
  {
    pages: [firstPage],
    pageParams: [null],
  },
);
```

- Defer the Virtuoso scroll reset to `useLayoutEffect` until the refreshed one-page data has committed. Keep the footer spacer because scroll-mark-read depends on it.

#### 4. Validation & Error Matrix

- Missing `since` -> FastAPI `422`.
- Timezone-naive `since` -> `400 Article baseline must include a timezone`.
- Invalid feed ID or malformed query value -> FastAPI `422`.
- Count or first-page request failure -> preserve the current list and scroll position; do not advance the baseline.
- Failed initial feed fetch -> mark the feed error and stop two-second pending polling.

#### 5. Good/Base/Bad Cases

- Good: 60 backdated articles are ingested after the baseline; the banner reports 60 and the visible list does not change.
- Base: no new articles exist; the count remains zero and the cached infinite list is untouched.
- Good: an OPML batch finishes initial fetches; its history appears after one automatic first-page refresh without a banner.
- Bad: treat every unknown first-page ID as new; removing one unread row can pull an old row into page one and create a false banner.

#### 6. Tests Required

- Backend: cursor round-trip preserves `snapshot_at`; naive cursor/baseline datetimes fail.
- Backend: count SQL uses `created_at`, all active filters, no publication ordering, and no page limit.
- Backend: initial-pending SQL includes `checked_at IS NULL`, ignores failed fetches, and respects `feed_id`.
- Frontend: replacing the first page resets `pages` and `pageParams` together.
- Frontend: scroll reset runs only after the one-page replacement commits.
- Integration/E2E: interval detection does not change rendered rows before banner click; refresh pending lasts through count refetch.

#### 7. Wrong vs Correct

#### Wrong

```tsx
const newIds = firstPage.items.filter((item) => !acknowledgedIds.has(item.id));
```

#### Correct

```tsx
const { data: summary } = useNewArticleCount(params, firstPage.snapshot_at);
const newArticlesCount = summary?.count ?? 0;
```

**Mutation hooks** (data modification):

```tsx
export function useAddFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: FeedCreate) => { /* ... */ },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feeds.all });
    },
  });
}
```

---

## Query Key Factory

Co-located in `src/api/hooks.ts`:

```tsx
const queryKeys = {
  feeds: {
    all: ["feeds"] as const,
    list: () => [...queryKeys.feeds.all, "list"] as const,
    jobs: { status: ["feeds", "jobs", "status"] as const }, // import / refresh-all batch progress
  },
  categories:  { all: ["categories"] as const, list: () => [...queryKeys.categories.all, "list"] as const },
  articles: {
    all: ["articles"] as const,
    list: (params, lang) => [...queryKeys.articles.all, params, lang] as const,
    infiniteList: (params, lang) => [...queryKeys.articles.all, "infinite", params, lang] as const,
    newCounts: () => [...queryKeys.articles.all, "new-count"] as const,
    newCount: (params, since) => [...queryKeys.articles.newCounts(), params, since] as const,
    detail: (id, lang) => [...queryKeys.articles.all, "detail", id, lang] as const,
  },
  ai:           { config: ["ai", "config"] as const },
  conversations: {
    all: ["conversations"] as const,
    list: (params?) => [...queryKeys.conversations.all, params] as const,
    detail: (id) => [...queryKeys.conversations.all, "detail", id] as const,
    references: (id) => [...queryKeys.conversations.all, id, "references"] as const,
    chat: (id) => [...queryKeys.conversations.all, id, "chat"] as const,
  },
  auth:         { me: ["auth", "me"] as const },
  automation:   { all: ["automation"] as const, list: (params?) => [...queryKeys.automation.all, params] as const },
} as const;
```

All query keys use `as const` for type safety and are used in both `useQuery` and `queryClient.invalidateQueries`. The factory is exported (`export { queryKeys }`) so non-hook code (e.g. `Home.tsx` prefetch/swap helpers) can reference the same keys.

---

## UI Hooks

Located in `src/hooks/`:

- `useKeyboardShortcuts.ts` — scoped `react-hotkeys-hook` bindings (composition of API hooks + store access + `useCallback`-memoized handlers).
- `useColorScheme.ts` — **side-effect only, not a data hook**: reads `localStorage["feedlyra-color-scheme"]` and toggles a `.theme-*` class on `<html>`. See [[component-guidelines]] "Color Scheme Presets".

Pattern: composition of API hooks + store access + `useCallback` for handler memoization:

```tsx
export function useKeyboardShortcuts() {
  const { data: feeds } = useFeeds();
  const toggleSidebar = useReaderStore((s) => s.toggleSidebar);
  // Uses react-hotkeys-hook with scoped hotkeys
  useHotkeys("shift+s", () => toggleSidebar(), { scopes: ["reader"] });
}
```

---

## SSE Streaming Pattern

`src/api/sse.ts` — NOT a hook. A plain async function returning an `AbortController`:

```tsx
export async function streamChat({
  onChunk, onDone, onError, signal
}: StreamChatParams): Promise<AbortController> {
  // fetch + ReadableStreamReader loop
  // Buffer flush after stream end (see quality-guidelines)
}
```

Consumed in components with `useRef<AbortController | null>`:

```tsx
const abortRef = useRef<AbortController | null>(null);

const handleSend = async () => {
  abortRef.current = await streamChat({ onChunk, onDone, onError, signal });
};
```

---

## Naming Conventions

- API data hooks: `use<Entity><Verb>` — `useFeeds`, `useAddFeed`, `useDeleteFeed`, `useArticles`, `useToggleRead`, `useSummarize`, `useChatHistory`
- UI hooks: `use<Feature>` — `useKeyboardShortcuts`
- Query key factory: `queryKeys.<entity>.<subkey>` with `as const`

---

## Common Mistakes

- **Using `useQuery` for mutations** — Always use `useMutation` for POST/PUT/DELETE. `useQuery` is for GET only and auto-refetches.
- **Forgetting to invalidate queries after mutations** — Without `qc.invalidateQueries()`, the UI shows stale data after create/update/delete.
- **Not using the query key factory** — Hard-coded query keys break when the factory changes. Always use `queryKeys.*`.
- **Missing cross-entity invalidation** — When a mutation changes data referenced by another entity's queries, invalidate both. Example: updating a feed's title changes `feed_title` in article list responses, so `useUpdateFeed` must invalidate both `queryKeys.feeds.list()` and `queryKeys.articles.all`.
- **Conversation mutations must invalidate the full `conversations.all` tree** — `useCreateConversation`/`useUpdateConversation`/`useDeleteConversation`/`useAddConversationReference`/`useRemoveConversationReference` all invalidate `queryKeys.conversations.all` (plus the specific `detail`/`references` keys they touch). The conversation list query is parameterized (`list(params)`), so invalidating the umbrella `all` key is the only way to refresh every filtered list variant. Do not narrowly invalidate just `list()`.
- **Optimistic automation toggle must patch EVERY cached automation query** — `useToggleAutomationRule` does `qc.getQueryCache().findAll({ queryKey: queryKeys.automation.all })` and `setQueryData` on each, because the list is parameterized (`list(params?)`). Patching only one cached key leaves other scope-filtered lists stale. Roll back with `invalidateQueries` on `onError`.
- **Mutation hooks with dynamic IDs** — When a mutation hook needs to operate on different entities by ID (e.g. `useUpdateFeed`), pass the ID as part of `mutate()` payload — NOT as a hook creation parameter. This allows one hook instance to serve multiple entities. Hook signature: `useUpdateFeed()` → `mutate({ feedId, ...data })`. Do NOT use `useUpdateFeed(feedId)` which requires a separate hook instance per entity.
- **Deriving values from query data before it arrives** — When using `data?.pages?.[0]?.total ?? 0` or similar, the fallback (`0`) fires on the first render before data loads. If a `useEffect` compares this value against a ref, the "0 → realTotal" jump looks like a real increase. Guard with `isLoading` (skip the effect while loading) or use a `hasLoadedRef` boolean to only start comparing after the first real data arrives.
- **Refetching active article queries after inline mutations** — Mutations that change a property the user is currently viewing (e.g., `is_read`/`is_starred` in the article list) should not immediately refetch active article queries; it causes rows to disappear from filtered views and can falsely trigger the "new articles" banner. Use `applyArticleTransitionsToCache` (from `src/lib/articleList.ts`) to update fields and totals, then invalidate with `refetchType: "none"`. Reserve immediate refetches for explicit bulk actions like `markAllRead` or structural changes like adding/deleting feeds.
- **Using offset pagination for mutable filtered infinite lists** — Read/star mutations change membership in `read_status=unread` and `starred=true` while the user is paging. A later offset request then skips the row that shifted across the page boundary. Use the backend's opaque `next_cursor`; never derive the next article page from `page * limit < total`.
- **Treating every unknown loaded ID as a new article** — Infinite scrolling deliberately loads unknown historical IDs. New-article detection must compare unknown IDs from the first page only, while automatically acknowledging IDs from appended history pages.
- **Resetting only the virtual scroll position when acknowledging new articles** — `scrollToIndex(0)` does not reset React Query pagination. Trim the current query's `pages` and `pageParams` to one entry before continuing from the refreshed first page.
- **Scrolling Virtuoso before a pagination reset commits** — An imperative `scrollToIndex(0)` issued in the same click handler as `setQueryData` still targets the old long list. Defer the final scroller and virtual-index reset to a layout effect that observes the one-page data; otherwise the stale offset can land in the full-height footer spacer and render as an empty list.

---

## Complete Hook Inventory

`src/api/hooks.ts` exports (naming: `use` + entity + verb). Verify with `grep -nE "^export (async )?function use" src/api/hooks.ts` — this list is a snapshot, not authoritative:

- **Auth/User**: `useCurrentUser`, `useUpdateProfile`, `useUpdateEmail`, `useUpdatePassword`.
- **Feeds**: `useFeeds`, `useDiscoverFeeds`, `useAddFeed`, `useUpdateFeed`, `useDeleteFeed`, `useBulkMoveFeeds`, `useBulkDeleteFeeds`, `useRefreshFeed`, `useRefreshAllFeeds`, `useIsFeedRefreshPending`, `useFeedJobStatus`, `useImportOPML`, `useExportOPML`.
- **Categories**: `useCategories`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`.
- **Articles**: `useArticles`, `useInfiniteArticles`, `useArticle`, `useToggleRead`, `useToggleStar`, `useMarkAllRead`, `useBatchRead`, `useStarredCount`, `useNewArticleCount`, `useRefreshInfiniteArticles`, `useExtractContent`.
- **AI**: `useAIConfig`, `useUpdateAIConfig`, `useSummarize`, `useTranslate`, `useChatHistory`, `useUploadConversationImage`. (The SSE chat stream is NOT a hook — `streamChat` is a plain async function in `src/api/sse.ts`.)
- **Conversations**: `useConversations`, `useConversation`, `useCreateConversation`, `useUpdateConversation`, `useDeleteConversation`, `useConversationReferences`, `useAddConversationReference`, `useRemoveConversationReference`.
- **Automation**: `useAutomationRules`, `useCreateAutomationRule`, `useUpdateAutomationRule`, `useDeleteAutomationRule`, `useToggleAutomationRule`.

UI hooks in `src/hooks/`: `useKeyboardShortcuts` (react-hotkeys-hook, scoped to `"reader"`), `useColorScheme` (side-effect only, not a data hook).
