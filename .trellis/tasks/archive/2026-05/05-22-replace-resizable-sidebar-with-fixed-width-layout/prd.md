# Replace Resizable Sidebar with Fixed-Width Layout

## Goal

Remove `react-resizable-panels` entirely. Replace the three-panel resizable layout with a fixed-width sidebar + fixed-width article list + flex-remaining article detail layout.

## Requirements

* All three panels are fixed width (no drag handles anywhere)
* Sidebar: 256px (Tailwind `w-64`), collapsible via Shift+S / Cmd+K
* Article list: 360px (Tailwind `w-[360px]`), always visible
* Article detail: flex-1, takes remaining space
* Sidebar collapse/expand still works via keyboard shortcut and command palette
* When collapsed, a thin strip with expand button is visible
* Remove `react-resizable-panels` usage and the `resizable.tsx` shadcn wrapper (if no other consumers)
* Remove `sidebarCollapsed` floating-point sync logic from Home.tsx

## Acceptance Criteria

* [ ] Sidebar renders at 256px fixed width with no drag handle
* [ ] Article list renders at 360px fixed width with no drag handle
* [ ] Article detail takes remaining space
* [ ] Collapse/expand toggle (Shift+S, Cmd+K) still works
* [ ] When collapsed, visible affordance to re-expand sidebar
* [ ] Sidebar content fully visible, not truncated
* [ ] No `react-resizable-panels` imports remain in Home.tsx
* [ ] Lint / typecheck green

## Definition of Done

* Lint / typecheck green
* No dead code from removed resizable panel usage
* Manual visual verification

## Out of Scope

* Redesigning sidebar content structure
* Mobile/responsive layout

## Decision (ADR-lite)

**Context**: Resizable panels caused the sidebar to be too narrow and the drag handle was unwanted. User prefers a clean, fixed layout.
**Decision**: Remove `react-resizable-panels` entirely; use CSS flex layout with fixed widths.
**Consequences**: Simpler layout code, no drag affordance, users can't adjust column widths. If needed later, can add resizable back between article list and detail only.

## Technical Notes

* Key files: `Home.tsx` (layout rewrite), `Sidebar.tsx` (add collapsed affordance), `resizable.tsx` (remove if unused), `reader.ts` (keep `sidebarCollapsed` in store)
* `useKeyboardShortcuts.ts` line 86 toggles `sidebarCollapsed` — no change needed
* `CommandPalette.tsx` line 89 toggles `sidebarCollapsed` — no change needed
* Keep `react-resizable-panels` in package.json for now (removing deps is a separate concern)
