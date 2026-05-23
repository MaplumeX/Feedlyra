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
