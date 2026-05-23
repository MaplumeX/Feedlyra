# Add right-click context menu for feed items

## Goal

Allow users to right-click on a feed item in the sidebar to open a context menu with the same actions (Refresh, Delete) currently available via the three-dot dropdown button. Both interaction methods coexist.

## Requirements

* Add shadcn/ui ContextMenu component (`npx shadcn@latest add context-menu`)
* Wrap each feed item with ContextMenu — right-click opens menu at cursor position
* Menu items identical to current dropdown: Refresh and Delete
* Right-click does not trigger feed selection
* Existing three-dot dropdown button is preserved

## Acceptance Criteria

* [ ] Right-clicking a feed item opens a context menu at cursor position
* [ ] Context menu contains Refresh and Delete actions that work correctly
* [ ] Right-click does not trigger feed selection
* [ ] Three-dot dropdown button still works as before

## Definition of Done

* Lint / typecheck green
* No regressions in existing dropdown menu behavior

## Decision (ADR-lite)

**Context**: Whether to keep the existing three-dot DropdownMenu when adding right-click ContextMenu.
**Decision**: Coexist — both interaction methods available.
**Consequences**: More entry points for actions; no UX regression for users accustomed to the button; right-click is the faster path for power users.

## Out of Scope

* Adding new menu items beyond Refresh and Delete
* Context menu for virtual folders (All, Unread, Starred)

## Technical Approach

1. Run `npx shadcn@latest add context-menu` to scaffold `context-menu.tsx`
2. In `Sidebar.tsx`, wrap each feed `<div>` with `<ContextMenu>` + `<ContextMenuTrigger>`
3. Move menu items into a shared helper or duplicate minimally (Refresh + Delete) inside `<ContextMenuContent>`
4. Keep existing `<DropdownMenu>` as-is

## Technical Notes

* Key file: `frontend/src/components/Sidebar.tsx` (lines 132-181)
* New file: `frontend/src/components/ui/context-menu.tsx` (via shadcn CLI)
* Radix ContextMenu API mirrors DropdownMenu: Root, Trigger, Content, Item
