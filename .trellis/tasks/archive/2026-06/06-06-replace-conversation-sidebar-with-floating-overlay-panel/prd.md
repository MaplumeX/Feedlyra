# Replace Conversation Sidebar with Floating Overlay Panel

## Goal

Remove the fixed-width conversation history panel (260px) from the main horizontal layout and replace it with a Popover-style floating overlay anchored to the AIChatPanel header, freeing permanent screen space for content.

## Requirements

- Remove ConversationSidebar from the main horizontal panel layout (no more 260px fixed panel)
- Add a history button in AIChatPanel header that opens a Popover with the conversation list
- Popover is anchored to the AIChatPanel top-left area
- Popover dismisses on: select a conversation, click outside, or Escape
- All existing ConversationSidebar functionality preserved (search, create, rename, delete)
- AIChatPanel occupies the full right-side space (no sibling panel)
- Layout localStorage migration: strip stale `conversation-sidebar` panel size from persisted layout

## Acceptance Criteria

- [ ] ConversationSidebar no longer occupies a fixed panel in the layout
- [ ] History button in AIChatPanel header opens a Popover with conversation list
- [ ] Selecting a conversation dismisses the Popover and loads it in AIChatPanel
- [ ] Click outside or Escape also dismisses the Popover
- [ ] All CRUD operations still work (create, rename, delete, search within Popover)
- [ ] No regression in article detail or other panels' available space
- [ ] Old layout localStorage data with `conversation-sidebar` key doesn't break layout

## Definition of Done

- Lint / typecheck green
- Manual verification of all conversation CRUD flows
- Layout persistence works after panel removal

## Technical Approach

1. **Home.tsx**: Remove the `CONVERSATION_SIDEBAR_PANEL_ID` Panel and its Separator from the layout. Chat panel becomes a single Panel instead of two.
2. **AIChatPanel.tsx**: Add a `History` icon button in the header. Wrap it with shadcn `Popover` + `PopoverContent` containing the conversation list.
3. **ConversationSidebar.tsx → ConversationListPopover.tsx**: Refactor the content (search + scrollable list) into a Popover-friendly component without the standalone sidebar wrapper. The header "AI CHAT" label is removed (redundant inside Popover).
4. **reader.ts store**: Remove `conversationPanelOpen` state if no longer needed; keep `activeConversationId`.
5. **Layout migration**: In `loadLayout()`, strip any `conversation-sidebar` key from the persisted layout object.

Key decisions:
- Use shadcn Popover (already available) for the floating panel
- Anchor point is the history button in AIChatPanel header
- Dismiss on select / click-outside / Escape (Popover default behavior)

## Decision (ADR-lite)

**Context**: The fixed 260px conversation sidebar wastes permanent screen space. Three overlay approaches were considered: Popover anchored to chat panel, Sheet sliding from right, and centered Dialog.
**Decision**: Popover anchored to AIChatPanel header button. Close on select + click-outside + Escape.
**Consequences**: Minimal layout change, natural trigger point, no new dependencies. Popover width constrained by viewport; very long conversation titles truncate.

## Out of Scope

- Redesigning AIChatPanel message view or input
- Changing conversation API or data model
- Keyboard shortcut for overlay toggling
- Empty-state redesign for when no conversations exist

## Technical Notes

- Files impacted: `Home.tsx`, `ConversationSidebar.tsx` (rename/refactor), `AIChatPanel.tsx`, `reader.ts`
- `react-resizable-panels` layout goes from 5 panels to 4 when chat is open
- shadcn Popover component uses Radix Popover primitive
- Layout localStorage key `"providence-layout"` needs migration to remove stale `conversation-sidebar` panel data
