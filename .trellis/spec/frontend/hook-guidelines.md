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

Use `useInfiniteQuery` for APIs that return `{ items, total, page, limit }` and are rendered as a single continuous list. Keep server pagination state inside React Query; do not mirror pages or fetched items in Zustand.

```tsx
export function useInfiniteArticles(params: ArticleListParams = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.articles.infiniteList(params),
    queryFn: ({ pageParam }) =>
      api.get<ArticleListResponse>(articleListPath({ ...params, page: pageParam })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loadedCount = lastPage.page * lastPage.limit;
      return loadedCount < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });
}
```

Components should flatten `data.pages` locally before rendering. If duplicate rows are possible when data changes between page fetches, de-duplicate by stable entity ID during flattening.

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
