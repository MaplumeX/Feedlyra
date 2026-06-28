# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
