# Feed Auto Full-Text Fetch

## Goal

Allow individual feeds to be configured for automatic full-text extraction on article open — when a user clicks an article belonging to an `auto_full_text` feed, full content is fetched automatically instead of requiring a manual button click.

## Requirements

* Add `auto_full_text` boolean field to Feed model (default false)
* Expose field in Feed CRUD API schemas
* Frontend: when an article from an `auto_full_text=True` feed is opened and has no `full_content`, automatically trigger extraction and switch to full content view
* Frontend: add a Switch toggle in the feed edit dialog for this setting

## Acceptance Criteria

* [ ] Feed model has `auto_full_text` boolean column, default false, migration created
* [ ] Feed CRUD API returns and accepts `auto_full_text` field
* [ ] ArticleDetail auto-triggers extract when: feed has `auto_full_text=True` AND article has no `full_content`
* [ ] Feed edit dialog has a Switch toggle for "auto full text"
* [ ] For feeds with `auto_full_text=False`, behavior is unchanged (manual extract button still works)

## Definition of Done

* Migration adds column to feeds table
* Backend API supports the field
* Frontend auto-extract + toggle UI
* Lint / typecheck green

## Technical Approach

Lazy extraction on article open, not batch during feed fetch. When ArticleDetail loads an article whose `feed.auto_full_text=True` and `article.full_content` is null, auto-call `extractContent.mutate()` and show full content on success.

Key changes:
1. `backend/app/models/feed.py` — add column
2. `backend/app/schemas/feed.py` — add to schemas
3. `backend/alembic/versions/` — new migration
4. `frontend/src/api/types.ts` — add field to Feed type
5. `frontend/src/components/ArticleDetail.tsx` — auto-extract logic
6. `frontend/src/components/FeedEditDialog.tsx` (or similar) — Switch toggle

## Out of Scope

* Batch retroactive full-text extraction for existing articles
* Replacing readability-lxml with trafilatura
* Changing the on-demand extract button behavior
