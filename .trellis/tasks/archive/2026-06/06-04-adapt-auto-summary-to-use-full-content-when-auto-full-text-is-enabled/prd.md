# Adapt Auto-Summary to Use Full Content When auto_full_text Is Enabled

## Goal

When a feed has `auto_full_text=True` and the user has `autoSummarize=True`, the auto-generated AI summary should be based on the full article content (after extraction) rather than the truncated RSS feed content, producing higher-quality summaries.

## What I already know

* `auto_full_text` is a per-feed boolean setting (Feed model, default False)
* `autoSummarize` is a per-user reader setting (localStorage, default False)
* Currently both features run in parallel independently when opening an article:
  - Auto-extract fetches `article.full_content` via readability-lxml
  - Auto-summarize hardcodes `source: "feed"` using `article.content`
* The summarize endpoint supports both `source=feed` and `source=full`
* `ArticleSummary` has a unique constraint on `(article_id, source, model)` — feed and full summaries are stored independently
* Frontend `summarySource` dynamically selects "full" vs "feed" based on `showFullContent && hasFullContent`
- After auto-extract completes, `showFullContent` is set to true, but no full summary is triggered

## Assumptions (temporary)

* The user wants auto-summarize to wait for full-text extraction (when applicable) before generating a summary
* Existing feed-source summaries should remain available/cached
* This only affects the auto-trigger path, not manual summarize clicks

## Open Questions

(none — all resolved)

## Decisions

* **Cached summary strategy**: Keep both feed and full summaries. When an article already has a feed-source summary but no full-source summary, auto-generate the full-source summary. Both are stored independently via the `(article_id, source, model)` unique constraint. Display depends on current view mode.
* **Full-content priority scope**: Only when `auto_full_text=True` for the feed. Other feeds continue using `source=feed` for auto-summarize. Minimal change, clear condition.
* **Extraction failure handling**: Silently fall back to `source=feed` summary. No toast/notification — matches current behavior and avoids UX noise.

## Requirements (evolving)

* When `auto_full_text=True` and `autoSummarize=True`, auto-summarize should use full content as source
* The full-text extraction must complete before the summary generation starts
* If full-text extraction fails, fall back to feed-content summary (graceful degradation)

## Acceptance Criteria (evolving)

* [ ] Opening an article from an auto_full_text feed with autoSummarize on generates a full-source summary
* [ ] Full-text extraction completes before summary generation begins
* [ ] If extraction fails, feed-source summary is generated as fallback
* [ ] Existing feed-source summaries are preserved (not deleted)
* [ ] Manual summarize button still works independently

## Definition of Done

* Lint / typecheck green
* Manual testing verified
* No regression in non-auto-full-text feeds

## Out of Scope (explicit)

* Changing manual summarize behavior
* Changing the summary generation algorithm or prompt
* Backend-side auto-summarize (remains frontend-triggered)

## Technical Notes

* Key files:
  - `frontend/src/components/ArticleDetail.tsx` — auto-extract useEffect (lines 141-157), auto-summarize useEffect (lines 126-134), summarySource logic (line 175)
  - `backend/app/routers/ai.py` — summarize endpoint (lines 158-237)
  - `backend/app/services/article_summary.py` — get_summary_content (lines 98-101)
  - `backend/app/models/ai.py` — ArticleSummary model (lines 31-45)
