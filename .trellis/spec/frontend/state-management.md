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

Partially persisted — user preferences (`sidebarCollapsed`, `readerSettings`, `scrollMarkRead`, `autoSummarize`, `feedSort`, `fullContentArticleIds`, `chatPanelWidth`, `chatPanelMode`, `floatingPanelPosition`, `floatingPanelSize`) survive reload, temporary UI state does not:

```tsx
interface ReaderSettings {
  fontSize: number;        // 14–24px, default 16
  fontFamily: string;      // font option key, default "system"
  lineHeight: number;      // 1.4–2.2, default 1.75
  contentWidth: number;    // 640–960px, default 768
  letterSpacing: number;  // 0–0.1em, default 0
  paragraphSpacing: number; // 0.5–2em, default 1.25
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      selectedFeedId: null,
      selectedArticleId: null,
      articleListFilter: "all" as const,
      sidebarCollapsed: false,
      readerSettings: { ...DEFAULT_READER_SETTINGS },
      feedSort: { ...DEFAULT_FEED_SORT },
      scrollMarkRead: true,
      autoSummarize: false,
      fullContentArticleIds: {},
      chatPanelOpen: false,
      chatPanelWidth: 360,
      commandPaletteOpen: false,
      settingsDialogOpen: false,
      set: (partial) => set(partial),
    }),
    {
      name: "feedlyra-reader",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        readerSettings: state.readerSettings,
        feedSort: state.feedSort,
        scrollMarkRead: state.scrollMarkRead,
        autoSummarize: state.autoSummarize,
        fullContentArticleIds: state.fullContentArticleIds,
        chatPanelWidth: state.chatPanelWidth,
      }),
    }
  )
);
```

Uses a generic `set` action for simple updates, plus specific typed actions (`setReaderSetting`, `setArticleFullContentPreference`, `resetReaderSettings`) for complex nested state.

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
| User preferences (sidebar collapsed, reader settings, auto-summarize, feed sort) | | Transient animation state |

---

## Common Mistakes

- **Duplicating server data in Zustand** — If it comes from an API, it belongs in React Query. Storing it in both places causes sync issues.
- **Persisting temporary UI state** — `selectedArticleId`, `chatPanelOpen`, etc. should NOT survive page reload. Use `partialize` to exclude them. See [[quality-guidelines]] for the pattern.
- **Using component state for cross-component data** — If two components need the same state, promote it to Zustand (UI state) or React Query (server state).
