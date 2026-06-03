# Fix feed subscription no feedback on add

## Goal

Fix the UX where adding a feed shows a disabled button with no visible progress, making users think nothing happened. The subscription succeeds on the backend but the UI appears frozen.

## What I already know

- `AddFeedDialog.tsx` uses `addFeed.mutate()` with `onSuccess`/`onError` callbacks — correct API, not a React Query v5 compat issue
- `useAddFeed` hook (hooks.ts:91-101) invalidates feeds/categories cache on success
- Backend `add_feed` (feeds.py:39-80) is **synchronous-blocking**: fetches RSS, parses, extracts full-text per article, discovers favicon, and generates AI summaries — all in one HTTP request cycle
- `HTTP_TIMEOUT = 30` in feed_fetcher.py — a single feed fetch has 30s timeout, plus N article extractions (each also 30s timeout) = potentially minutes
- Frontend has **no timeout** on `fetch()` in client.ts — request can pend indefinitely
- Button disabled state (`addFeed.isPending`) is the only visual feedback — no spinner, no progress text
- After commit 789aeb8, toast notifications exist in callbacks, but users report never seeing them

## Root cause analysis

Two issues compound:

1. **Backend blocks too long**: `fetch_and_store_feed` is awaited in the request handler. For feeds with many articles + AI summarization enabled, response time can be 30s-3min+. User sees a disabled button with nothing else happening.

2. **No loading indicator**: The "Add" button just becomes disabled — no spinner, no "Adding..." text. Combined with the long wait, users think it's broken and refresh the page (which shows the feed was actually added).

## Requirements

- Show a clear loading state while a feed is being added (spinner + disabled text change)
- Make the add-feed operation feel responsive even if the backend takes time
- Ensure success/error feedback is always visible to the user

## Acceptance Criteria

- [ ] "Add" button shows a spinner and text like "Adding..." while `addFeed.isPending`
- [ ] "Find" button in Discover tab shows a spinner while `discoverFeeds.isPending`
- [ ] Discovered feed item buttons show loading state while `addFeed.isPending`
- [ ] Toast notifications (success/warning/error) fire reliably after the operation completes
- [ ] Dialog closes on success with the existing `onOpenChange(false)` call
- [ ] No regression: feed is still added correctly, error cases still handled

## Definition of Done

- Lint / typecheck pass
- Manual smoke test: add a feed, observe spinner + toast + dialog close
- Manual smoke test: add an invalid URL, observe error toast

## Out of Scope

- Making `fetch_and_store_feed` async/background (separate task, much larger scope)
- Adding request timeout to frontend client
- Changing backend API response format or adding polling

## Technical Notes

- Files to modify: `frontend/src/components/AddFeedDialog.tsx`
- The `toast` from `sonner` is already imported and used
- `Button` component from `@/components/ui/button` supports children — can render `Loader2` spinner
- `Loader2` from `lucide-react` is the standard spinner icon used elsewhere in the project (e.g., SubscriptionsTab.tsx line 329-331)
- `useTranslation` is already in use — add spinner text keys to i18n locale files

## Technical Approach

Add `Loader2` spinner + text change to buttons in `AddFeedDialog.tsx` when their respective `isPending` state is true. Add i18n keys for loading-state labels. Purely a UI change — no backend or API changes needed.

### Buttons to update (AddFeedDialog.tsx)

1. **Add button** (URL tab, line 118): show `Loader2` + `t("adding")` when `addFeed.isPending`
2. **Find button** (Discover tab, line 135): show `Loader2` + `t("finding")` when `discoverFeeds.isPending`
3. **Discovered feed item buttons** (line 150-151): already `disabled={addFeed.isPending}`; show spinner inside button when loading

### i18n keys to add

- `reader.json`: `"adding": "Adding..."` / `"adding": "添加中..."`
- `reader.json`: `"finding": "Finding..."` / `"finding": "查找中..."`
- Uses the same `reader` namespace already in use in AddFeedDialog

### Pattern to follow

From `AISettingsTab.tsx:276`:
```tsx
{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
{t("label")}
```

### Files to modify

1. `frontend/src/components/AddFeedDialog.tsx` — spinner + text on Add/Find buttons
2. `frontend/src/i18n/locales/en/reader.json` — "adding", "finding" keys
3. `frontend/src/i18n/locales/zh-CN/reader.json` — "adding", "finding" keys
