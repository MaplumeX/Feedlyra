# Upgrade AI Chat: Context Enhancement & UX Improvements

## Goal

Upgrade the per-article AI chat feature with smarter context management and a polished conversation experience — making the chat feel more capable, reliable, and pleasant to use.

## What I already know

### Backend (current)
- `build_chat_messages()` truncates article content to 8000 chars (`MAX_CONTENT_CHARS`)
- Chat history includes last 20 messages (last 10 turns) — hardcoded
- `stream_chat()` uses `temperature=0.7`, `max_tokens=2000`
- System prompt: basic "answer based on article content" instruction
- No token counting / budget awareness before sending to LLM
- `ArticleChat` and `ChatMessage` models persist full history per article per user

### Frontend (current)
- `AIChatPanel` renders chat with `MarkdownContent` (marked + DOMPurify) for assistant messages
- Streaming via SSE with `streamChat()` utility
- Actions: copy, regenerate (re-sends last user message)
- Auto-resizing textarea input, scroll-to-bottom on new messages
- Empty state with 4 suggestion buttons
- No message editing, no delete, no stop-generation button
- All messages loaded at once (no pagination)

## Assumptions (temporary)

- Users typically chat 3–10 turns per article; occasionally 20+
- Most LLM providers have 128k+ context windows now; 8000 char truncation is overly conservative
- The article content is the most important context; history can be compressed
- Markdown rendering quality is a key UX differentiator for AI chat

## Decision (ADR-lite)

**Context**: Current chat uses raw 8000-char truncation for article content + hardcoded last 20 messages for history, wasting modern LLMs' 128k+ context windows while still losing coherence in long conversations.
**Decision**: Approach A — smart content injection + sliding window summarization.
- Article content: reuse `extract_content_for_summary()`, raise limit to ~20000 chars.
- Chat history: keep last 6 turns (12 messages) fully, compress older turns into a brief LLM-generated summary (lazy + cached).
**Consequences**: Better context quality for medium/long conversations; summarization adds one extra LLM call per chat (only when >8 turns, cached after first computation). Slightly more complex backend but no new dependencies.

### Message Edit — Server-side History Truncation
**Context**: When user edits message N, all messages after N must be discarded. Need a strategy for server-side cleanup.
**Decision**: Approach A — frontend trims local state + calls `DELETE /api/ai/chat/messages?after=<msg_id>` to delete server-side records. Next history load reflects the trimmed state.
**Consequences**: Simple, consistent state. Requires one new DELETE endpoint. History is not recoverable after edit (acceptable for chat).

## Open Questions

1. ~~Context window strategy: smart truncation vs. summarization of older history?~~ → Decision: Approach A
2. ~~Should we add a "stop generation" button during streaming?~~ → Yes, in MVP
3. ~~Should we add message editing (edit user message → re-submit)?~~ → Yes, in MVP
4. ~~Should we add message delete?~~ → Deferred (post-MVP)
5. ~~Markdown rendering: code syntax highlighting needed?~~ → Deferred (post-MVP)
6. ~~Stream interruption cleanup?~~ → Yes, in MVP

## Requirements (evolving)

### Context Enhancement
* Smarter article content injection — use the full smart paragraph extraction (already exists for summary) instead of raw truncation
* Smarter history management — compress or summarize older turns instead of hard cutoff at 20
* Token-budget-aware message construction — estimate tokens before sending, warn or adjust if approaching limits

### Conversation UX
* Stop generation button during streaming (abort controller + UI)
* Message edit (edit user message → discard all subsequent messages → re-submit from edit point)
* Streaming interruption cleanup (abort → remove empty/partial temp assistant message)

## Acceptance Criteria (evolving)

- [ ] Article content uses smart extraction instead of raw `[:8000]` truncation
- [ ] History management: keep last 6 turns full, older turns summarized (lazy + cached)
- [ ] Stop generation button appears during streaming, aborts SSE stream cleanly
- [ ] Aborted streams leave no orphan/partial messages in UI
- [ ] Message editing works (edit user msg → trim subsequent → re-submit)
- [ ] Code blocks in assistant responses have syntax highlighting

## Definition of Done

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* Message delete (single / clear all) — deferred to post-MVP
* Code syntax highlighting in markdown — deferred to post-MVP
* Multi-article cross-referencing chat
* RAG / vector search enhancement
* Function calling / tool use
* Conversation export
* Chat templates / preset prompts
* Mobile-specific adaptations

## Technical Notes

* `extract_content_for_summary()` in `app/services/article_summary.py` already does smart paragraph extraction — can reuse for chat
* `MarkdownContent` component uses `marked` + `DOMPurify` — need to add `highlight.js` or similar for syntax highlighting
* Frontend abort controller already exists in `sse.ts` — need to surface it as a stop button
* `ChatMessage` model has no `summary` field — history summaries need a storage strategy (new field on `ArticleChat` or separate lightweight table)
* Message edit on frontend: need to trim local state + also trim server-side history (or let server recompute on next chat request)

## Expansion Notes

### Future evolution
- History summarization lays groundwork for future searchable/cross-article chat if we ever go there
- Message edit pattern (trim + re-submit) is the same pattern delete would use

### Related scenarios
- Summary feature already uses `extract_content_for_summary()` — chat should reuse it rather than duplicating
- Regenerate button already exists — edit is a superset (change text + regenerate)

### Failure & edge cases
- Summary LLM call fails: fall back to truncated history (graceful degradation)
- User edits a message in the middle of a 15-turn conversation: all subsequent messages (user + assistant) get trimmed both in UI and server-side
- Stop generation Clicked immediately after send: need to handle case where no chunks arrived yet
- Two browser tabs open same chat: server-side message trimming on edit must be atomic
