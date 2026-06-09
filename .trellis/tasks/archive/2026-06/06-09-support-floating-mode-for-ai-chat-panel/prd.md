# Support Floating Mode for AI Chat Panel

## Goal

Allow the AI chat panel to detach from the sidebar layout and float as a freely positionable overlay, so users can continue reading articles while chatting with AI.

## What I already know

* Chat panel is currently a full-height inline `Panel` inside `react-resizable-panels` `Group` in `Home.tsx`
* Panel state is managed in Zustand store (`reader.ts`): `chatPanelOpen`, `chatPanelWidth`, `conversationPanelOpen`, `activeConversationId`
* Opening flow: toolbar button / command palette → `chatPanelOpen: true` → `useEffect` creates conversation → sets `conversationPanelOpen: true`
* Close flow: X button or `Shift+C` → `conversationPanelOpen: false`
* `ArticleTableOfContents.tsx` has existing pointer-based drag repositioning pattern
* `ConversationSidebar.tsx` renders as a Popover inside AIChatPanel header
* Width is persisted via `chatPanelWidth` in Zustand with localStorage persistence

## Requirements

* Chat panel can operate in two modes: sidebar (current) and floating (new)
* In floating mode, chat panel is a non-modal draggable overlay — user can interact with content below
* Switching between modes preserves conversation content and state
* Toggle button in chat panel header to switch between sidebar/floating mode
* Settings page allows configuring the default mode (sidebar or floating)
* Floating panel position and size are persisted to localStorage and restored on next open
* Switching to floating mode removes the panel from the sidebar layout, expanding the article detail area
* Window resize clamps floating panel back into viewport
* `Shift+C` and command palette "Open AI Chat" respect the configured default mode

## Acceptance Criteria

* [ ] Chat panel can be toggled between sidebar and floating mode via header button
* [ ] Floating chat panel is freely draggable to any screen position
* [ ] Floating chat panel is resizable by dragging edges/corners
* [ ] Floating panel is non-modal — clicking outside the panel does not close it, and underlying content is interactive
* [ ] Switching to floating mode removes the panel from sidebar layout, expanding article detail area
* [ ] Floating panel position and size persisted to localStorage, restored on next open
* [ ] Window resize clamps floating panel position back into visible viewport
* [ ] Settings page has option to configure default chat panel mode (sidebar / floating)
* [ ] `Shift+C` toggles panel open/close respecting the current/default mode
* [ ] Command palette "Open AI Chat" uses the configured default mode

## Definition of Done

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope

* Multiple floating chat panel instances (single instance only for MVP)
* Snap-to-edge behavior for floating panel
* Minimized/collapsed floating panel state

## Technical Approach

**Store changes** (`reader.ts`):
* Add `chatPanelMode: 'sidebar' | 'floating'` (persisted)
* Add `floatingPanelPosition: { x: number, y: number }` (persisted)
* Add `floatingPanelSize: { width: number, height: number }` (persisted)

**Layout changes** (`Home.tsx`):
* When `chatPanelMode === 'sidebar'`: render as current `Panel` inside `Group`
* When `chatPanelMode === 'floating'`: render via `createPortal` with `position: fixed`, skip the `Panel`/`Separator` in `Group`

**Floating panel component** (new):
* Wrapper component with `position: fixed`, draggable header area, resize handles on edges/corners
* Reference `ArticleTableOfContents.tsx` drag pattern (pointer events)
* Window resize listener to clamp position into viewport

**Settings**:
* Add "Default Chat Mode" dropdown (sidebar / floating) in settings page

**Mode toggle**:
* Icon button in `AIChatPanel` header: `Pin` (sidebar) ↔ `PinOff` (floating) or similar

## Technical Notes

* Key files: `Home.tsx` (layout), `AIChatPanel.tsx` (component), `reader.ts` (store)
* Existing drag pattern in `ArticleTableOfContents.tsx` can be referenced
* `react-resizable-panels` Panel needs conditional rendering when in floating mode
* Floating mode renders via React portal with `position: fixed`
