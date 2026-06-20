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

### Don't: Commit hardcoded user-facing strings

```tsx
// Bad — ships English to all locales, leaves a TODO that never gets resolved
<DialogTitle>Edit Rule</DialogTitle> {/* TODO: i18n */}
const FIELD_LABELS = { title: "Title", author: "Author" }; // TODO: i18n
```

**Why**: The project is i18n-first (`react-i18next`, `en`/`zh-CN` locales under `src/i18n/locales/`). A hardcoded English string is visible to every user regardless of locale, and a `// TODO: i18n` marker almost never gets a follow-up commit — the RSS automation feature (#82) shipped ~50 of them and they survived a merge. Reverting a merged feature just to retranslate is costly; i18n is cheapest done in the same PR that adds the UI.

**Instead**: Wire the string in the PR that introduces the UI, not later.
```tsx
const { t } = useTranslation("settings");          // settings-context components
<DialogTitle>{t("automation.editRuleTitle")}</DialogTitle>

// In a component whose default namespace is NOT the target one,
// pass the namespace explicitly — do NOT switch the component's existing useTranslation:
const { t } = useTranslation("reader");             // reader-context component
<Button title={t("automation.tooltip", { ns: "settings" })} />
```

Rules:
- Add keys to BOTH `en` and `zh-CN` locale files in the same PR; the key sets must match.
- Pick a namespace by where the UI lives (`settings` for Settings-dialog content; `reader` for reader surface).
- Proper nouns and universal tokens stay literal: language names (`LANGUAGES` labels), `LOGIC_OPTIONS` rendered as `AND`/`OR` via `opt.toUpperCase()`. Interpolate dynamic values with `{{name}}`.
- Never leave a `// TODO: i18n` in a merged PR. If you genuinely must defer, block the merge — do not ship the marker.

### Don't: Use Virtuoso rangeChanged Without Scroll Guards

```tsx
// Bad — fires on mount, resize, and data changes, not just user scroll
<Virtuoso rangeChanged={(range) => {
  markArticlesRead(range);
}} />
```

**Why**: Virtuoso emits `rangeChanged` on initialization, window resize, and data replacement — not only on user scroll. Without active-scrolling, direction, and increasing-index guards, these non-user events trigger false positives.

**Instead**: Track the previous start index, Virtuoso's `isScrolling` event, and the actual scroller direction. Only collect the full crossed index range during an active downward scroll. See [[component-guidelines]] for the guarded range-tracking pattern.

### Don't: Forget debounce cleanup in scroll handlers

```tsx
// Bad — timer fires after component unmount
const timer = setTimeout(flushPending, 300);
// no cleanup
```

**Why**: Scroll-triggered debounced operations (mark-as-read, analytics) can fire after the component unmounts, causing state updates on unmounted components.

**Instead**: Always return a cleanup function from `useEffect` that clears the timer.

### Don't: Leave a direct `async` form `onSubmit` without try/catch

```tsx
// Bad — api failure throws, handleSubmit doesn't catch it, user sees nothing
const onSubmit = async (data: LoginForm) => {
  const tokens = await api.post("/api/auth/login", data); // throws on 4xx
  setTokens(tokens.access_token, tokens.refresh_token);
  navigate("/");
};
```

**Why**: `api/client.ts` throws `new Error(error.detail)` on non-2xx responses. `react-hook-form`'s `handleSubmit` does NOT catch errors thrown by the async submitter — the promise rejects unhandled. The login/register pages shipped this way: a wrong password silently re-rendered the form with no feedback (page appeared to just refresh). `isSubmitting` only resets cleanly when `onSubmit` settles through the form's lifecycle; an unhandled rejection leaves the user with no visible error path.

**Instead**: Wrap direct `api.*` calls in `try/catch` and surface the error via `toast.error` (sonner). Map known backend `detail` strings to i18n keys; fall back to a generic message for unknown details so raw English never leaks to non-`en` locales.

```tsx
const onSubmit = async (data: LoginForm) => {
  try {
    const tokens = await api.post<{ access_token: string; refresh_token: string }>("/api/auth/login", data);
    setTokens(tokens.access_token, tokens.refresh_token);
    navigate("/");
  } catch (error) {
    toast.error(t(resolveAuthError(error)));
  }
};
// resolveAuthError maps backend detail -> auth.json i18n key, defaulting to errors.unexpected
```

**Contrast — React Query mutations need NO try/catch**: forms that submit via `useMutation(...).mutate(payload, { onError })` must use the mutation's `onError: (error) => toast.error(error.message)` callback instead, because `mutate` does not throw. See `EditEmailDialog` / `EditPasswordDialog` / `EditUsernameDialog` for the canonical mutation pattern. Only `await api.*` call sites need the try/catch wrapper — do not copy it onto mutation-based forms.

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
- Virtualized-list side effects must test a multi-row range jump and negative paths
  such as upward scrolling or disabled behavior. When the bug depends on row lifecycle,
  also verify once against the real virtualizer rather than only a mocked callback.

## Known Quality Gate Gaps

None currently. ESLint flat config (`eslint.config.js`) is in place; use `npm run lint` and `npm run build` for verification.

---

## Code Review Checklist

- [ ] `<HotkeysProvider initiallyActiveScopes={["reader"]}>` wraps the app root
- [ ] SSE client handles buffer residual data after stream end
- [ ] Zustand persist `partialize` excludes temporary UI state
- [ ] API key forms allow empty strings (optional fields: `z.string().or(z.literal(""))`)
- [ ] New resource type mutations invalidate ALL related query keys (e.g., adding categories means `useDeleteFeed`, `useImportOPML` must also invalidate `categories.list`)
- [ ] No hardcoded user-facing strings and no `// TODO: i18n` markers — every visible label goes through `t()`, keys added to both `en` and `zh-CN`
- [ ] Any form `onSubmit` that `await api.*` directly is wrapped in `try/catch` + `toast.error`; mutation-based forms route errors via `useMutation` `onError`, not try/catch
