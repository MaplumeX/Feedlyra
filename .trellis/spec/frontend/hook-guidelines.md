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
  return useInfiniteQuery({
    queryKey: queryKeys.articles.infiniteList(params),
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

### New-Article Banner with Infinite Queries

When an automatic refetch updates the first page, keep unknown article IDs hidden until the user acknowledges the new-article banner.

- Reconcile the acknowledgement baseline in `useLayoutEffect`, not `useEffect`. Visibility derived in a normal effect updates after browser paint, so new rows can briefly appear and disturb the virtual list before the banner hides them.
- If acknowledged IDs live in a ref, publish a read-only state snapshot whenever the set grows. Updating only the ref and setting an unchanged banner count does not re-render; this can leave a newly appended history page hidden while a banner is already visible.
- Reset the acknowledgement refs and rendered snapshot before establishing the baseline for a different feed/filter. The reset and reconciliation effects must use the same pre-paint phase and execute in that order.
- Clicking the banner must reset the exact current infinite-query cache to its latest first page:

```tsx
queryClient.setQueryData<InfiniteData<ArticleListResponse, string | null>>(
  queryKeys.articles.infiniteList(params),
  (current) => current
    ? {
        ...current,
        pages: current.pages.slice(0, 1),
        pageParams: current.pageParams.slice(0, 1),
      }
    : current,
);
```

Always trim `pages` and `pageParams` together. Keeping old `pageParams` or old history pages means `hasNextPage` and the next `fetchNextPage` can continue from the previous last page instead of rebuilding from the refreshed first page's `next_cursor`.

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
  },
  articles: {
    all: ["articles"] as const,
    list: (params: ArticleListParams) => [...queryKeys.articles.all, params] as const,
    detail: (id: string) => [...queryKeys.articles.all, "detail", id] as const,
  },
  ai: {
    config: ["ai", "config"] as const,
  },
} as const;
```

All query keys use `as const` for type safety and are used in both `useQuery` and `queryClient.invalidateQueries`.

---

## UI Hooks

Located in `src/hooks/`. Currently only `useKeyboardShortcuts.ts`.

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
- **Mutation hooks with dynamic IDs** — When a mutation hook needs to operate on different entities by ID (e.g. `useUpdateFeed`), pass the ID as part of `mutate()` payload — NOT as a hook creation parameter. This allows one hook instance to serve multiple entities. Hook signature: `useUpdateFeed()` → `mutate({ feedId, ...data })`. Do NOT use `useUpdateFeed(feedId)` which requires a separate hook instance per entity.
- **Deriving values from query data before it arrives** — When using `data?.pages?.[0]?.total ?? 0` or similar, the fallback (`0`) fires on the first render before data loads. If a `useEffect` compares this value against a ref, the "0 → realTotal" jump looks like a real increase. Guard with `isLoading` (skip the effect while loading) or use a `hasLoadedRef` boolean to only start comparing after the first real data arrives.
- **Refetching active article queries after inline mutations** — Mutations that change a property the user is currently viewing (e.g., `is_read`/`is_starred` in the article list) should not immediately refetch active article queries; it causes rows to disappear from filtered views and can falsely trigger the "new articles" banner. Use `applyArticleTransitionsToCache` to update fields and totals, then invalidate with `refetchType: "none"`. Reserve immediate refetches for explicit bulk actions like `markAllRead` or structural changes like adding/deleting feeds.
- **Using offset pagination for mutable filtered infinite lists** — Read/star mutations change membership in `read_status=unread` and `starred=true` while the user is paging. A later offset request then skips the row that shifted across the page boundary. Use the backend's opaque `next_cursor`; never derive the next article page from `page * limit < total`.
- **Treating every unknown loaded ID as a new article** — Infinite scrolling deliberately loads unknown historical IDs. New-article detection must compare unknown IDs from the first page only, while automatically acknowledging IDs from appended history pages.
- **Resetting only the virtual scroll position when acknowledging new articles** — `scrollToIndex(0)` does not reset React Query pagination. Trim the current query's `pages` and `pageParams` to one entry before continuing from the refreshed first page.
