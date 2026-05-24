# State Management

> How state is managed in this project.

---

## Overview

Two state systems with clear separation: **Zustand** for client/UI state, **TanStack React Query** for server/async state. No overlap between the two.

---

## State Categories

| Category | Tool | Location | Example |
|----------|------|----------|---------|
| Auth tokens + user | Zustand (persisted) | `src/stores/auth.ts` | `accessToken`, `user` |
| UI state (selections, panels) | Zustand (partially persisted) | `src/stores/reader.ts` | `selectedArticleId`, `sidebarCollapsed` |
| Server data (feeds, articles, AI) | React Query | `src/api/hooks.ts` | `useFeeds()`, `useArticles()` |
| Form state | react-hook-form | Component-local | Login form, AI settings |
| URL state | react-router v7 | Route params | (not currently used) |

---

## Zustand Stores

### Auth store (`src/stores/auth.ts`)

Fully persisted to localStorage (key: `"feedlyra-auth"`):

```tsx
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "feedlyra-auth" }
  )
);
```

Also writes `access_token` to `localStorage` directly for the API client to read.

### Reader store (`src/stores/reader.ts`)

Partially persisted — `sidebarCollapsed`, `fontSize`, `scrollMarkRead`, and `autoSummarize` survive reload:

```tsx
export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      selectedFeedId: null,
      selectedArticleId: null,
      sidebarCollapsed: false,
      fontSize: "md",
      scrollMarkRead: true,
      autoSummarize: false,
      chatPanelOpen: false,
      commandPaletteOpen: false,
      settingsDialogOpen: false,
      set: (partial) => set(partial),
    }),
    {
      name: "feedlyra-reader",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        fontSize: state.fontSize,
        scrollMarkRead: state.scrollMarkRead,
        autoSummarize: state.autoSummarize,
      }),
    }
  )
);
```

Uses a single generic `set` action instead of individual setters.

---

## Server State (React Query)

Configured in `App.tsx` with `staleTime: 2 * 60 * 1000` and `retry: 1`. Individual hooks may override `staleTime` (e.g., `useAIConfig` uses `5 * 60 * 1000`).

All API data flows through `useQuery`/`useMutation` hooks in `src/api/hooks.ts`. Never store server data in Zustand.

---

## When to Use Global State

| Use Zustand | Use React Query | Use component state |
|-------------|----------------|-------------------|
| Auth tokens | API responses | Form input values |
| UI toggles (panels, modals) | Any fetched/cached data | Hover/focus state |
| User preferences (sidebar collapsed, auto-summarize) | | Transient animation state |

---

## Common Mistakes

- **Duplicating server data in Zustand** — If it comes from an API, it belongs in React Query. Storing it in both places causes sync issues.
- **Persisting temporary UI state** — `selectedArticleId`, `chatPanelOpen`, etc. should NOT survive page reload. Use `partialize` to exclude them. See [[quality-guidelines]] for the pattern.
- **Using component state for cross-component data** — If two components need the same state, promote it to Zustand (UI state) or React Query (server state).
