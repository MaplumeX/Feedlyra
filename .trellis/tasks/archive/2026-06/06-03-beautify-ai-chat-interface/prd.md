# Beautify AI Chat Interface

## Goal

Redesign the AIChatPanel from a basic side-panel into a modern, ChatGPT/Claude-style conversation experience — polished visually, richer in interactions, and resizable for comfort.

## Requirements

- Modern conversation flow: avatars on messages, improved bubble styling, visual hierarchy
- Resizable panel width using react-resizable-panels (project already installed), with min/max constraints
- Streaming typing indicator: animated cursor/dots while assistant is streaming
- Multiline textarea input: Shift+Enter for newline, Enter to send
- Suggested prompts on empty state: fixed article-related templates (Summarize, Key Points, Explain Simply, Translate)
- Message hover actions: Copy (all messages) + Regenerate (assistant only — resend last user message, remove old assistant response first)
- Richer empty state with icon/illustration + prompt suggestions
- Improved markdown rendering within chat context (better code blocks, lists, links)
- Light + dark mode support for all new visuals

## Acceptance Criteria

- [ ] Chat panel uses react-resizable-panels for width, with min ~280px / max ~600px
- [ ] Messages show user/AI avatars (icon-based, e.g. Bot/Sparkles for AI, UserCircle for user)
- [ ] Streaming shows animated typing indicator (cursor blink or dot pulse)
- [ ] Input is multiline textarea with Enter=send, Shift+Enter=newline
- [ ] Empty state shows 4 suggested prompt cards, clicking one sends it
- [ ] Copy button appears on message hover, copies raw text to clipboard
- [ ] Regenerate button appears on assistant message hover, removes last assistant msg and re-sends prev user msg
- [ ] All visuals correct in light and dark mode

## Definition of Done

- Lint / typecheck / CI green
- Visual changes verified in both light and dark mode
- No backend/API changes required

## Technical Approach

- Restructure `AIChatPanel.tsx` with sub-components: `ChatMessage`, `ChatInput`, `EmptyState`, `SuggestedPrompts`
- Use `Panel` from react-resizable-panels in `ArticleDetail.tsx` to wrap the chat panel
- Add CSS variables/animations for typing indicator in `index.css`
- Regenerate: slice off last assistant message from local state, re-invoke `streamChat` with previous user message
- Suggested prompts: static array of 4 i18n strings, rendered as clickable cards in empty state
- Avatars: lucide-react icons (Bot/Sparkles for AI, User for user) in colored circles

## Decision (ADR-lite)

**Context**: Chat UI feels bare and needs modern polish to match user expectations from ChatGPT/Claude.
**Decision**: Full visual redesign with resizable panel, avatars, suggested prompts, message actions, multiline input, typing animation.
**Consequences**: Significant UI rewrite but no backend changes. Regenerate is client-side only (re-sends last user message). Panel resize needs integration with ArticleDetail layout.

## Out of Scope

- Backend/API changes
- Dynamic AI-generated suggested prompts
- Edit user messages
- File/image upload
- Conversation history management (list, delete conversations)

## Technical Notes

- Key files: `AIChatPanel.tsx`, `ArticleDetail.tsx`, `MarkdownContent.tsx`, `index.css`, `tailwind.config.ts`, `reader.ts` (store)
- UI library: shadcn/ui, Tailwind, lucide-react
- react-resizable-panels already in package.json
- CSS variables for chat colors: `--chat-bubble-user`, `--chat-bubble-ai`
- i18n: `reader.json` for chat strings
