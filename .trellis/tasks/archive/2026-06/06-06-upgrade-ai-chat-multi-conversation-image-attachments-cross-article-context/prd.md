# Upgrade AI Chat: Multi-Conversation, Image Attachments, Cross-Article Context

## Goal

Upgrade the existing per-article AI chat into a full-featured conversation system: independent conversations with a sidebar list, image/attachment support in messages, and cross-article context via reference injection.

## Requirements

### 1. Multi-Conversation Management

- Conversations are **independent entities** — not bound to a specific article (1:1 article binding is removed)
- A **conversation sidebar** lists all conversations, sortable by last activity
- User can: create new conversation, rename, delete, switch between conversations
- When opening chat from an article detail page, the current article is **auto-referenced** (zero-friction entry)
- Conversations have a **title** — auto-generated from first user message, editable by user
- Existing per-article chat data should be **migrated** to the new conversation model

### 2. Image Attachments

- User can **paste images** from clipboard (Ctrl+V / Cmd+V)
- User can **upload images** via an attachment button (📎) in the input area
- **Drag-and-drop** images into the chat input
- Images are stored on **local filesystem** on the server, served via API endpoint
- Images are sent to the LLM as **vision content** (OpenAI vision message format)
- **Markdown rendering** of images in message bubbles

### 3. Cross-Article Context (References)

- When opening chat from an article page, the current article is **auto-injected** as a reference
- An **"Add article reference"** button allows searching and selecting additional articles to reference
- Referenced articles shown as **removable tags** above the input area
- Auto-referenced and manually-referenced articles are **equivalent** in LLM context — same format in system prompt
- Auto-referenced articles are tagged "当前" in UI for clarity, but can be removed by user
- Article content is injected into the LLM system prompt alongside existing article content logic

## Acceptance Criteria

- [ ] User can create a new standalone conversation from the sidebar
- [ ] User can switch between conversations in the sidebar
- [ ] User can rename and delete conversations
- [ ] Conversation title is auto-generated from first message
- [ ] Opening chat from an article page auto-references that article
- [ ] Existing per-article chat history is migrated to new conversation model
- [ ] User can paste, upload, and drag-drop images into chat
- [ ] Images are rendered inline in message bubbles
- [ ] AI processes image content and responds accordingly (vision-capable models)
- [ ] User can search and add article references via "add reference" button
- [ ] Referenced articles shown as removable tags above input
- [ ] Auto-referenced current article tagged "当前" but removable
- [ ] All referenced articles injected into LLM context equivalently
- [ ] Existing features preserved: streaming, edit, stop, regenerate, copy, markdown rendering, BYOK config

## Definition of Done

- Database migrations for all schema changes
- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Image files cleaned up on conversation deletion
- Old data migration script tested

## Out of Scope

- Conversation folders/groups
- Conversation templates/presets
- PDF/file attachments (only images for MVP)
- Image size/dimension limits (future iteration)
- Multi-article token budget management (future iteration)
- Conversation sharing/export
- Screenshot annotation tool

## Technical Approach

### Database Schema

- New `Conversation` model: `id`, `user_id`, `title`, `created_at`, `updated_at`
- New `ConversationReference` model: `id`, `conversation_id`, `article_id`, `is_auto`, `created_at`
- Modify `ChatMessage`: add `attachments` JSON column (for image metadata), change FK from `article_chats` to `conversations`
- Keep `ArticleChat` for backward compatibility / migration
- Migration: create conversations from existing article_chats, link messages, create references

### Backend Changes

- New router endpoints: CRUD for conversations, image upload/serve, reference management
- Update `llm.py`: `build_chat_messages` accepts references list (multiple articles), supports vision content format
- Image upload: multipart endpoint, save to configurable local directory, return URL
- Image serve: static file endpoint with auth check
- SSE streaming updated for new conversation model

### Frontend Changes

- New `ConversationSidebar` component: list, search, create, rename, delete
- Update `Home.tsx` layout: add sidebar panel for conversations
- Update `AIChatPanel`: accept `conversationId` instead of `articleId`, add reference tags UI, add image upload button
- Update `ChatInput`: paste/upload/drag-drop handlers, image preview before send
- Update `sse.ts` and `hooks.ts`: new conversation-based endpoints
- Update Zustand store: `activeConversationId`, `conversationPanelOpen`

### LLM Context Building

- System prompt: inject all referenced articles with their titles and content
- Each article uses `extract_content_for_summary` with shared token budget
- Vision messages: use OpenAI `image_url` content type for image attachments

## Decision (ADR-lite)

**Context**: How should conversations relate to articles?
**Decision**: Pure independent conversations with reference injection. Conversations are not bound to articles; article context is injected as references (auto on entry, manual on demand). All references are equivalent in LLM context.
**Consequences**: Maximum flexibility — one conversation can reference multiple articles, or none. Simpler mental model (one conversation type). Requires migration of existing per-article chats.

**Context**: How to store uploaded images?
**Decision**: Local filesystem with API serve endpoint.
**Consequences**: No new dependencies, consistent with current single-instance deployment. Future migration to S3 possible.

**Context**: How to add cross-article references?
**Decision**: Hybrid — auto-inject current article on entry, plus manual "add reference" button with search.
**Consequences**: Zero-friction entry (auto-inject) + full control (manual add, remove any reference). All references equivalent in LLM context.

## Technical Notes

- Key files: `AIChatPanel.tsx`, `Home.tsx`, `sse.ts`, `hooks.ts`, `reader.ts`, `llm.py`, `ai.py` (router), `ai.py` (models), `ai.py` (schemas), `article_summary.py`
- `ArticleChat` currently has implicit 1:1 with article via unique query `scalar_one_or_none`
- Migration path: `ArticleChat` → `Conversation` + `ConversationReference`
- OpenAI vision format: `{"type": "image_url", "image_url": {"url": "data:image/...;base64,..."}}`
- BYOK: users may need a vision-capable model; current config doesn't distinguish vision vs text models
