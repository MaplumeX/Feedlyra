# Beautify AI Chat UI

## Goal

Redesign the AI chat interface to adopt the ChatGPT-style conversation layout — user messages right-aligned with colored background, AI messages left-aligned without bubble background — along with visual polish across all chat UI elements.

## What I already know

- Chat UI uses Tailwind CSS + shadcn/ui + CSS custom properties (dark mode supported)
- Main components: AIChatPanel, ConversationSidebar, ChatMessageBubble, ChatInput, ChatEmptyState
- Layout: react-resizable-panels, chat slides in as right-side panels
- Styling tokens exist: chat-user/chat-ai bubble colors, conversation-bg/hover/selected
- Current message layout: left-aligned for both user and AI, small avatar on left for both, different bg colors
- Fonts: Onest (UI), Space Grotesk (heading)
- Message types: user text+images, AI markdown+streaming indicator
- Hover actions: copy, edit, regenerate

## Assumptions (temporary)

- Purely visual/UI redesign — no new features or behavior changes
- Dark mode parity must be maintained
- Layout structure (resizable panels, sidebar + chat panel) remains the same

## Open Questions

(none remaining — direction confirmed)

## Requirements

### Layout change: ChatGPT-style message alignment
- User messages: right-aligned, rounded colored background pill, no avatar
- AI messages: left-aligned, no background bubble (plain text), small Bot avatar on left
- Wider vertical spacing between messages for breathing room

### Input area polish
- More refined textarea styling (larger rounded corners, subtle border/shadow)
- Send button with better visual weight

### Empty state improvement
- More visually engaging empty state (larger icon, better typography, suggestion cards with more polish)

### Conversation sidebar refinement
- Better visual hierarchy in conversation rows
- Subtle hover/active state improvements

### Animation & micro-interactions
- Smooth message appearance animation (fade-in or slide-up)
- Typing indicator: replace blinking cursor bar with animated dots (ChatGPT-style)

## Acceptance Criteria

- [ ] User messages are right-aligned with colored rounded background, no avatar
- [ ] AI messages are left-aligned without bubble background, with Bot avatar
- [ ] Message spacing is visually comfortable with good breathing room
- [ ] Input area looks polished with refined styling
- [ ] Empty state is visually engaging
- [ ] Typing indicator uses animated dots instead of blinking cursor
- [ ] Messages animate smoothly when appearing
- [ ] Both light and dark modes look correct
- [ ] All existing functionality preserved (copy, edit, regenerate, streaming, drag-drop)

## Definition of Done

* Lint / typecheck / CI green
* Both light and dark modes verified
* No functionality regression

## Out of Scope

* New features or behavior changes
* Backend changes
* Adding new UI component library
* Changing the panel layout structure
* Conversation sidebar complete redesign (minor polish only)

## Technical Approach

### Key layout change
- `ChatMessageBubble`: conditionally align user messages right with `justify-end`, AI messages left
- User bubble: add `ml-auto max-w-[85%]` to push right, remove `UserAvatar`, add colored pill background
- AI bubble: remove `bg-chat-ai` background, keep `AssistantAvatar` + plain text

### Typing indicator
- Replace single blinking bar with 3 bouncing dots (CSS animation `@keyframes`)
- Each dot staggered with `animation-delay`

### Message animation
- Add `animate-in fade-in slide-in-from-bottom-2` (using tailwindcss-animate) to each new message

### CSS changes
- Add new keyframe for bouncing dots in `index.css`
- Adjust `--chat-bubble-user` to a more opaque, ChatGPT-like color
- Remove or repurpose `--chat-bubble-ai` (no longer needed as background)

### Input area
- Increase border-radius, add subtle focus ring/shadow
- Style send button with primary color fill

## Decision (ADR-lite)

**Context**: Chat UI needs visual modernization; current layout uses symmetric left-aligned bubbles for both user and AI.
**Decision**: Adopt ChatGPT-style asymmetric layout — user right-aligned colored pill, AI left-aligned plain text with avatar.
**Consequences**: More conventional chat UX pattern users are familiar with; requires significant CSS/class changes to ChatMessageBubble; no schema/backend impact.

## Technical Notes

* Key files: AIChatPanel.tsx, ConversationSidebar.tsx, index.css, tailwind.config.ts
* Styling approach: Tailwind utilities + CSS vars (HSL) in index.css
* shadcn/ui components at src/components/ui/
* `tailwindcss-animate` plugin already installed — can use `animate-in` utilities
* MarkdownContent.tsx uses `prose` classes — must work without bg-chat-ai background
