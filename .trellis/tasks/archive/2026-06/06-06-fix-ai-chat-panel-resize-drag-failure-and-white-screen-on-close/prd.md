# Fix AI chat panel resize drag failure and white screen on close

## Goal

Fix two bugs: (1) AI chat panel sometimes cannot be dragged to resize, (2) closing AI chat panel sometimes causes white screen.

## Requirements

* Chat panel should always be draggable to resize within min/max constraints
* Closing chat panel should never cause white screen
* Layout persistence must remain functional

## Acceptance Criteria

* [ ] Chat panel can be dragged to resize after open/close/reopen cycles
* [ ] Closing chat panel never causes white screen
* [ ] Layout persistence works correctly across sessions

## Technical Approach

### Bug 1: Panel resize drag failure

**Root cause**: When chat panel is conditionally unmounted, `onLayoutChanged` saves a layout map without the `"ai-chat"` key. On remount, `defaultLayout` from localStorage may contain stale/incomplete values that conflict with Panel constraints. Also, `defaultLayout = useRef(loadLayout()).current` only reads once on mount.

**Fix**:
- Strip stale `"ai-chat"` entries from persisted layout on load (similar to existing `"conversation-sidebar"` migration)
- Ensure Panel always initializes with `defaultSize={chatPanelWidth}` regardless of stale `defaultLayout`

### Bug 2: White screen on close

**Root cause**: No ErrorBoundary in the app. When chat panel unmounts during layout recalculation, any React error crashes the entire tree. Additionally, streaming abort callbacks (`onDone`/`onError`) may fire after component unmount, causing React state-update-on-unmounted-component errors.

**Fix**:
- Add ErrorBoundary wrapping the `<Home />` component (user preference: Home-level only)
- In `AIChatPanel`, use a `mountedRef` to guard streaming callbacks against post-unmount state updates
- In `handleClose`, ensure abort + state cleanup happen synchronously before unmount

### ErrorBoundary placement

Decision: Wrap only `<Home />` in `App.tsx`, with a simple fallback UI showing "Something went wrong" + reload button.

## Out of Scope

* Global ErrorBoundary (user chose Home-level only)
* Other potential crash sources outside the chat panel flow

## Technical Notes

* Key files: `Home.tsx`, `AIChatPanel.tsx`, `App.tsx`, `reader.ts`
* `react-resizable-panels` v4 API: numeric = pixels, string = percentage
* `onLayoutChanged` callback receives `Layout` type: `{ [panelId: string]: number }`
