# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.0.3] - 2026-07-01

### Added

- **Summary**: AI summary output language now follows the UI language setting.

### Changed

- **Settings**: replace `window.confirm` with a Radix `AlertDialog` for category
  deletion.

### Fixed

- **Reader**: stop the UI from freezing after deleting a feed from the sidebar.
- **Feeds**: keep the article-list filter tabs at a fixed width so they no
  longer wrap or shift in narrow layouts.
- **Feeds**: don't flag non-conformant feeds when their entries are recovered
  (`#98`).

## [v1.0.2] - 2026-06-30

### Added

- **Feeds**: batch edit subscriptions — bulk move to category and bulk delete
  (`#96`).
- **Import**: align batch import with the Miniflux decoupled model (`#97`).

### Fixed

- **Import**: flush newly created categories before assigning them to imported
  feeds so associations are not lost.
- **DB**: enable connection-pool pre-ping / recycling to stop reusing stale
  asyncpg connections.
- **Reader**: make the mark-all-read button icon-only to prevent overflow /
  clipping in narrow lists.
- **Settings**: make the subscriptions feed list scrollable when there are many
  feeds.

### Docs

- Provide copy-pastable quick-deploy commands; mark `AI_DEFAULT_API_KEY` as
  optional.

## [v1.0.1] - 2026-06-29

### Fixed

- **OPML parsing**: use an XML parser to correctly parse OPML outlines that
  were silently dropped by the previous regex-based parser.
- **AI summarize / fetch**: set a browser-like `User-Agent` on outgoing LLM /
  feed requests to bypass Cloudflare WAF blocks that returned 403 to the
  default Python client.
- **Reader UI**: close P2/P3 consistency gaps flagged by the impeccable
  critique re-run and polish the Home screen typography / spacing.

### Changed

- **CI**: only build and publish Docker images on `v*` version tags instead of
  every push to `main`.

## [v1.0.0] - 2026-06-28

First stable release.

### Added

- **Feed management**: subscribe to RSS/Atom feeds by URL, auto-discovery from any
  website, OPML import & export with automatic category creation, periodic refresh
  every 5 minutes, conditional HTTP fetching with `ETag` / `If-Modified-Since`,
  exponential backoff on parse errors, per-feed settings (title, category, auto
  full-text extraction), feed icon / favicon auto-discovery.
- **Article reading**: virtualized infinite-scroll article list, HTML sanitization
  with DOMPurify, full-text content extraction (trafilatura + readability-lxml),
  image lightbox, auto-generated table of contents, read/unread tracking,
  star/favorite, scroll-based batch mark-as-read, "new articles" banner.
- **Reader customization**: font family (7 options incl. Chinese fonts), font size,
  line height, spacing, content width — all persisted to localStorage.
- **AI capabilities (bring-your-own-key)**: per-feature AI config (summarize /
  translate / chat, each with its own API key / URL / model), API keys encrypted
  at rest with Fernet, AI summarize (cached by content hash), AI translate
  (XML-tag-structured prompts), streaming SSE AI chat with article context,
  history summarization, message edit & regeneration, stop generation mid-stream,
  auto-summarize on article open.
- **UI / UX**: 3-panel resizable layout + optional AI chat panel, sidebar virtual
  folders (All / Unread / Starred with live counts), command palette
  (`Ctrl`+`K` / `Cmd`+`K`), keyboard shortcuts, dark / light / system theme,
  i18n (English + Simplified Chinese).
- **Deployment**: one-command Docker Compose deployment (backend + frontend +
  PostgreSQL), prebuilt multi-arch (`linux/amd64`, `linux/arm64`) images
  published to GHCR, backend `/health` endpoint and healthcheck, default host
  port `7756`, automated Alembic migrations on startup.
