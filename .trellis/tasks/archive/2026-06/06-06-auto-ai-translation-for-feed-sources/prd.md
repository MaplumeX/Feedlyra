# Auto AI Translation for Feed Sources

## Goal

Allow users to configure per-feed automatic AI translation, so that articles from a subscribed source are automatically translated when first opened, and the translated content is shown by default — eliminating the need to manually click the translate button for each article.

## What I already know

* Translation already exists as a per-article, on-demand feature triggered by the Languages button in ArticleDetail
* Backend: `translate_article()` in `llm.py` uses `AsyncOpenAI`, accepts `target_lang`, outputs `(translated_title, translated_content)` with XML-tag structured prompt
* Backend: `POST /api/ai/articles/{id}/translate` endpoint with caching in `ArticleAIData` (stored as `translated_title`, `translated_content`, `translation_lang`, `translation_model`, `translation_created_at`)
* Backend: `TranslateRequest` defaults `target_lang` to "zh", no stored user preference for translation language
* Feed model has only `auto_full_text` as a per-feed toggle — no translation-related per-feed settings exist
* `FeedSettingsDialog` currently edits: title, category, auto_full_text
* AI config is BYOK with per-feature overrides (translate/summary/chat)
* i18n supports en and zh-CN for UI only — no article content language detection

## Requirements

* Add per-feed auto-translate toggle (`auto_translate: bool`, default false)
* Add per-feed target language override (`translate_target_lang: str | null`, default null)
* Add global user default translation language preference (`translate_default_lang: str`, default "zh")
* Target language resolution: per-feed override → global user default → "zh"
* Auto-translation triggered on first article open (lazy), not during feed fetch
* When auto-translate is enabled and article is first opened, automatically call translate API and switch to showing translated content
* Reuse existing `translate_article()` function and `ArticleAIData` caching
* Auto-translate configuration UI in FeedSettingsDialog only
- Global default language in AISettingsTab

## Acceptance Criteria

* [ ] User can enable/disable auto-translate per feed in FeedSettingsDialog
* [ ] User can set target language override per feed in FeedSettingsDialog
* [ ] User can set global default translation language in AISettingsTab
* [ ] When opening an article from an auto-translate feed for the first time, translation is triggered automatically
* [ ] After auto-translation completes, article detail automatically switches to showing translated content
* [ ] Translated content is cached — reopening the same article shows translation instantly
* [ ] User can switch back to original content via the Languages button
* [ ] Existing manual translate functionality still works independently
* [ ] Target language resolution follows: per-feed override → global default → "zh"

## Definition of Done

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* i18n strings added for new UI elements

## Decision (ADR-lite)

**Context**: Multiple valid approaches for trigger timing, target language config, UI placement, and display behavior.

**Decision**:
- **Trigger timing**: Lazy — on first article open, not during feed fetch. Saves API cost; only translates articles users actually read.
- **Target language**: Global default + per-feed override. Most users translate all feeds to one language; overrides for edge cases.
- **UI placement**: FeedSettingsDialog only for auto-translate toggle + per-feed lang override. Global default in AISettingsTab.
- **Display**: Auto-switch to translated content after translation completes. Original available via Languages button.

**Consequences**: Slight latency on first open of an auto-translate article (translation in progress); no batch translation of historical articles; no source language auto-detection.

## Out of Scope

* Auto-detection of article source language
* Batch translation of existing/historical articles
* Multiple target languages per feed
* Auto-translate toggle in AddFeedDialog
* Batch enable/disable across multiple feeds
* Translation indicator in article list view

## Technical Notes

### Backend changes
* `backend/app/models/feed.py` — add `auto_translate: bool` and `translate_target_lang: str | null` fields to Feed model
* `backend/app/models/user.py` — add `translate_default_lang: str` field to User model (default "zh")
* `backend/alembic/versions/` — new migration for feed + user columns
* `backend/app/routers/feeds.py` — update feed update schema to accept `auto_translate` and `translate_target_lang`
* `backend/app/routers/ai.py` — update `PUT /api/ai/config` to accept `translate_default_lang`; add endpoint or logic for resolving effective target language
* `backend/app/services/llm.py` — `translate_article()` already supports `target_lang`, no changes needed

### Frontend changes
* `frontend/src/components/FeedSettingsDialog.tsx` — add auto-translate switch + target language dropdown
* `frontend/src/components/settings/AISettingsTab.tsx` — add global default translation language input
* `frontend/src/components/ArticleDetail.tsx` — on open, check if feed has auto_translate enabled; if so and no translation cached, auto-trigger translate and switch to translation view
* `frontend/src/api/types.ts` — add `auto_translate`, `translate_target_lang` to Feed interface; `translate_default_lang` to AIConfig
* `frontend/src/api/hooks.ts` — update useUpdateFeed, useUpdateAIConfig hooks
