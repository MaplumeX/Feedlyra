# Remove ArticleSummary Generation from fetch_and_store_feed

## Goal

Remove the automatic ArticleSummary generation that runs inside `fetch_and_store_feed()`, so that feed fetching and summarization are decoupled. Summaries will only be generated on-demand via the existing `/api/ai/articles/{id}/summarize` endpoint.

## What I already know

- The auto-summarization block lives at `backend/app/services/feed_fetcher.py` lines 354–397
- It runs after new articles are stored, iterating each article and calling `generate_summary()`
- On-demand summarization via `POST /api/ai/articles/{article_id}/summarize` in `backend/app/routers/ai.py` works independently
- ArticleSummary model, `article_summary.py` service, and all AI router endpoints are still needed

## Requirements

- Delete the auto-summarization block (lines 354–397) from `fetch_and_store_feed()`
- Do NOT touch the on-demand summarize endpoint or any other ArticleSummary infrastructure

## Acceptance Criteria

- [ ] `fetch_and_store_feed()` no longer calls `generate_summary` or creates `ArticleSummary` objects
- [ ] On-demand `/api/ai/articles/{id}/summarize` still works unchanged
- [ ] No unused imports left behind in `feed_fetcher.py`
- [ ] Lint / type-check pass

## Definition of Done

- Code change made
- Lint / type-check green
- Manual verification that on-demand summarize still works

## Out of Scope

- Removing ArticleSummary model or service
- Changing the on-demand summarize flow
- Adding any new summarization trigger mechanism
