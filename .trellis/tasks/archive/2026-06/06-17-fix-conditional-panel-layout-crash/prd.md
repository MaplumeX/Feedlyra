# Fix conditional panel layout crash on AI chat toggle

## Goal

Eliminate the intermittent "Something went wrong" (HomeErrorBoundary fallback) crash and the resize-drag failure that occur when toggling the AI chat panel. Both symptoms share a single root cause in `react-resizable-panels`.

## Problem

Two user-visible symptoms:

1. After opening the AI chat panel, the panel width **sometimes cannot be dragged to resize**.
2. After closing the AI chat panel, the app sometimes shows the error-boundary fallback: `Something went wrong` + a `Reload` button.

Console error (symptom 2):
```
Uncaught Error: Invalid 3 panel layout: 15.648%, 22.82%, 29.428%, 32.104%
    at U (react-resizable-panels…:736)
    at ResizeObserver.<anonymous> (react-resizable-panels…:1464)
The above error occurred in the <Group> component.
HomeErrorBoundary caught: Error: Invalid 3 panel layout: …
```

## Root Cause

In `frontend/src/pages/Home.tsx`, the layout `<Group>` renders 3 always-on panels (sidebar / article-list / article-detail) plus a 4th panel `id="ai-chat"` that is **conditionally mounted** (`showChatPanel && isSidebarMode`, lines 200-219).

The crash originates in `react-resizable-panels@4.11.1`:

- `U({ layout, panelConstraints })` (dist:736) throws `Invalid ${t.length} panel layout` when the number of layout values (`Object.values(layout)`) does not equal the number of registered panel constraints.
- `jt({ group, nextGroupSize, prevGroupSize, prevLayout })` (dist:1357) recomputes layout proportionally on group resize. It does `const u = { ...prevLayout }` — copying **all** keys verbatim, including any key for a panel that has just unmounted.
- A `<Group>`-level `ResizeObserver` (dist:1422) fires on container-size changes and feeds `jt`'s output into `U`.

So when `ai-chat` unmounts (close chat, or switch to floating mode), there is an inconsistency window where the active `layout` object still carries the `ai-chat` key, but only 3 panels remain registered. If the `ResizeObserver` fires inside that window, `jt` propagates 4 layout values to `U`, which has only 3 constraints → throw → propagates to `HomeErrorBoundary` → the "Something went wrong" screen. The same path causes the resize-drag failure symptom.

Why it is intermittent: only triggered when the `ResizeObserver` callback lands inside the short inconsistency window after a panel-set change — i.e. when group/container size happens to change concurrently with the toggle. The historical task `2026-06/06-06-fix-…` added a `mountedRef` guard and a localStorage `ai-chat` migration, neither of which addresses the in-session ResizeObserver race, so the symptom recurred.

## Requirements

- Toggling the AI chat panel open/close must never throw "Invalid N panel layout".
- Resizing any panel separator must remain functional at all times, including right after opening/closing the AI chat panel or switching between sidebar and floating modes.
- Closing the AI chat panel must never trigger the HomeErrorBoundary fallback.
- Layout persistence (panels + sidebar collapse + chatPanelWidth) must keep working across reloads.
- The persisted `ai-chat` entry stripping in `loadLayout()` must remain.

## Out of Scope

- The floating-mode `FloatingChatPanel` pointer-capture resize logic (separate panel, not the reported crash).
- Global (app-wide) ErrorBoundary — user previously chose Home-level only.
- Backend / API changes.

## Acceptance Criteria

- [ ] Open AI chat → resize chat panel separator → works.
- [ ] Close AI chat from sidebar mode → no "Something went wrong"; panels remain interactive.
- [ ] Rapid open/close of AI chat panel (esp. while resizing another panel) → no crash.
- [ ] Switch sidebar ↔ floating mode while chat is open → no crash; both modes resize correctly.
- [ ] Reload after resizing → persisted layout restored; no stale `ai-chat` key in localStorage triggers a crash on mount.
- [ ] `pnpm build` (tsc + vite) passes with no type errors.

## Technical Notes

- Key files: `frontend/src/pages/Home.tsx`, `frontend/src/components/AIChatPanel.tsx`, `frontend/src/stores/reader.ts` (chatPanelMode / chatPanelWidth / conversationPanelOpen).
- `react-resizable-panels` v4 API: `Group` / `Panel` / `Separator` / `usePanelRef`; no `order` prop in v4 (phanels are keyed by stable `id`).
- Library internals (v4.11.1) referenced above: `U` (validation, dist:736), `jt` (proportional resize, dist:1357), Group `ResizeObserver` (dist:1422).
- Design + execution approach is captured in `design.md` / `implement.md` after approach selection.
