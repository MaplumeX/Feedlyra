# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend quality standards derived from implementing AI features (PR3/PR4) and debugging keyboard shortcuts, SSE streaming, and state persistence.

---

## Forbidden Patterns

### Don't: Use react-hotkeys-hook scoped shortcuts without HotkeysProvider

```tsx
// Bad — ALL scoped shortcuts silently fail, no error thrown
function App() {
  return <RouterProvider router={router} />
}

// In some component:
useHotkeys("j", selectNext, { scopes: ["reader"] });
```

**Why**: `react-hotkeys-hook` with scopes requires `<HotkeysProvider>` at the app root. Without it, `activeScopes` defaults to `[]`, making every scoped `useHotkeys` call a no-op. There is NO console warning — shortcuts just silently don't work.

**Instead**:
```tsx
import { HotkeysProvider } from "react-hotkeys-hook";

function App() {
  return (
    <HotkeysProvider initiallyActiveScopes={["reader"]}>
      <RouterProvider router={router} />
    </HotkeysProvider>
  );
}
```

### Don't: Virtuoso rangeChanged without stability guard

```tsx
// Bad — fires on mount, resize, and data changes, not just user scroll
<Virtuoso rangeChanged={(range) => {
  markArticlesRead(range);
}} />
```

**Why**: Virtuoso emits `rangeChanged` on initialization, window resize, and data replacement — not only on user scroll. Without an `isStable` guard, these non-user events trigger false positives (e.g., marking articles read on page load).

**Instead**: Use an `isStableRef` that becomes true after the first rangeChanged, and reset it when the data source changes (feed/filter switch).

### Don't: Forget debounce cleanup in scroll handlers

```tsx
// Bad — timer fires after component unmount
const timer = setTimeout(flushPending, 300);
// no cleanup
```

**Why**: Scroll-triggered debounced operations (mark-as-read, analytics) can fire after the component unmounts, causing state updates on unmounted components.

**Instead**: Always return a cleanup function from `useEffect` that clears the timer.

---

## Required Patterns

### SSE Buffer Flushing After Stream End

When consuming SSE streams via `fetch` + `ReadableStreamReader`, the read loop MUST process remaining buffer data after the `while` loop exits.

```typescript
// After the while(true) read loop:
if (buffer.trim().startsWith("data: ")) {
  const data = buffer.trim().slice(6);
  if (data === "[DONE]") {
    onDone();
    return controller;
  }
  // parse and handle remaining data...
}
onDone();
```

**Why**: If the last SSE chunk doesn't end with `\n`, the `buffer.split("\n")` leaves residual data in `buffer` after the loop. Without flushing, the last message is silently lost.

---

### Zustand Persist Partialize for Temporary UI State

When using `zustand/middleware/persist`, use `partialize` to exclude temporary UI state from localStorage.

```typescript
export const useReaderStore = create(
  persist(
    (set) => ({
      selectedArticleId: null as string | null,
      chatPanelOpen: false,
      commandPaletteOpen: false,
      // ...
    }),
    {
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => !["commandPaletteOpen", "chatPanelOpen", "selectedArticleId"].includes(key)
          )
        ),
    }
  )
);
```

**Why**: Temporary UI state (panel open/closed, selected article, palette open) should not survive page reloads — it creates stale references (article ID that no longer exists, panel that was open in a different context). Only persist user preferences (theme, sidebar width, etc.).

---

## Testing Requirements

- Keyboard shortcut tests must verify `<HotkeysProvider>` is mounted
- SSE streaming tests must verify buffer flush behavior with incomplete final chunks
- Zustand store tests must verify `partialize` excludes temporary state

---

## Code Review Checklist

- [ ] `<HotkeysProvider initiallyActiveScopes={["reader"]}>` wraps the app root
- [ ] SSE client handles buffer residual data after stream end
- [ ] Zustand persist `partialize` excludes temporary UI state
- [ ] API key forms allow empty strings (optional fields: `z.string().or(z.literal(""))`)
- [ ] New resource type mutations invalidate ALL related query keys (e.g., adding categories means `useDeleteFeed`, `useImportOPML` must also invalidate `categories.list`)
