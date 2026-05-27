# Article Floating Table of Contents

## Goal

Add a floating table of contents (TOC) for article reading so users can quickly scan and jump between headings in long articles without leaving the current reader view.

## What I already know

* The user wants article TOC support using a floating-window style.
* The main impacted area is the frontend article reader.
* Article body rendering currently lives in `frontend/src/components/ArticleDetail.tsx`.
* The reader uses `ScrollArea` around the article content and supports original content, extracted full content, and translated content modes.
* Article body HTML is sanitized with DOMPurify and rendered via `dangerouslySetInnerHTML`.
* AI summary Markdown rendering is separate in `frontend/src/components/MarkdownContent.tsx`; this task should focus on the article body, not summaries.
* Existing UI uses shadcn/Radix primitives, Tailwind, lucide-react icons, and i18next locale files.
* Frontend spec index confirms React 19, strict TypeScript, shadcn/Radix, Zustand for UI state, React Query for server state, and no configured tests.

## Assumptions

* TOC should be generated client-side from headings already present in the displayed article HTML.
* TOC should update when switching between original, extracted full content, and translation views.
* TOC is a frontend-only feature unless research shows the backend needs to transform content.
* MVP can support headings `h1` through `h4`; deeper headings can be ignored or treated as level 4.
* TOC should be hidden or disabled when the displayed article content has too few headings to be useful.

## Open Questions

* None. User confirmed the final MVP scope on 2026-05-27.

## Requirements (evolving)

* Detect headings from the displayed article content after sanitization.
* Add stable anchor IDs to detected article headings without breaking sanitized content.
* Provide a right-side floating, collapsible TOC panel in the article reader UI.
* Let users click a TOC item to scroll to the corresponding heading inside the article scroll container.
* Highlight or otherwise indicate the current section while reading when feasible.
* Keep TOC behavior consistent across original, full-content, and translated content modes.
* Add English and Simplified Chinese locale strings for user-facing TOC labels.
* Avoid backend changes unless needed for reliable TOC extraction.
* The chosen floating-window pattern is a right-side floating panel, not a toolbar popover or floating circular button.
* The TOC panel should automatically avoid layout conflicts: show as a right-side floating panel when there is enough article-reader width, and collapse to a compact trigger when the AI chat panel is open or the article area is too narrow.
* The TOC should support current-section highlighting while scrolling, unless implementation proves the existing scroll container makes it unreliable.
* The collapsed floating TOC trigger should be draggable along the Y axis so users can move it away from reading content.

## Acceptance Criteria (evolving)

* [ ] Long articles with multiple headings show a right-side floating, collapsible TOC panel in the article reader.
* [ ] Clicking a TOC item scrolls the article content to the matching heading.
* [ ] The TOC updates when the reader switches between original, extracted full content, and translated content.
* [ ] Articles without headings or with too few headings do not show a misleading empty TOC.
* [ ] The TOC avoids overlapping the AI chat panel by collapsing or shifting to a compact trigger when chat is open.
* [ ] The TOC collapses to a compact trigger on narrow article-reader widths instead of covering the reading content.
* [ ] The collapsed TOC trigger can be dragged vertically within the article-reader area, with normal click-to-open behavior preserved.
* [ ] Current section indication works during scroll, or the chosen MVP explicitly excludes it.
* [ ] The feature works with both English and Simplified Chinese UI strings.
* [ ] `npm run lint` and `npm run build` pass for the frontend.

## Definition of Done

* Tests added/updated where appropriate; if no test harness exists, document the verification performed.
* Lint / typecheck / build pass.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Backend extraction of TOC metadata.
* Editing or normalizing article source content in the database.
* TOC for AI summary or chat messages.
* Persistent per-article TOC state unless explicitly chosen later.
* A full redesign of the article reader layout.
* User-authored TOC editing or custom labels.
* URL hash routing for heading anchors.

## Expansion Sweep

* Future evolution: TOC state could later become a persisted reading preference, and heading anchors could support sharing deep links.
* Related scenarios: Original, full-content, and translated article views must behave consistently; AI summary and chat Markdown remain out of scope.
* Failure and edge cases: Some RSS content may not include headings, may repeat heading text, or may contain malformed HTML; the feature should degrade by hiding the panel or generating unique stable IDs after sanitization.

## Technical Notes

* Existing files inspected:
  * `frontend/src/components/ArticleDetail.tsx`
  * `frontend/src/components/MarkdownContent.tsx`
  * `frontend/src/components/ReadingSettingsPopover.tsx`
  * `frontend/src/components/ui/popover.tsx`
  * `frontend/src/stores/reader.ts`
  * `frontend/src/i18n/locales/en/reader.json`
  * `frontend/src/i18n/locales/zh-CN/reader.json`
  * `frontend/package.json`
  * `.trellis/spec/frontend/index.md`
  * `frontend/src/components/AIChatPanel.tsx`
  * `frontend/src/pages/Home.tsx`
* Existing dependencies include `@radix-ui/react-popover`, `@radix-ui/react-scroll-area`, `lucide-react`, `dompurify`, and `marked`.
* A likely implementation path is a small article TOC helper/component plus integration inside `ArticleDetail.tsx`.
* `AIChatPanel` renders as a fixed-width right-side panel (`w-80`) inside `ArticleDetail`, so a floating TOC panel must avoid overlapping it when chat is open.
* The main layout uses `react-resizable-panels`; the article detail panel can become narrow depending on user layout choices.

## Decision (ADR-lite)

**Context**: The TOC needs to stay visible while reading long articles and avoid forcing users to open a menu repeatedly.

**Decision**: Use a right-side floating, collapsible panel for the MVP.

**Consequences**: The panel improves long-article navigation but must handle conflicts with the AI chat panel and narrow viewports carefully.

**Follow-up decision**: On narrow layouts or when the AI chat panel is open, automatically collapse the TOC to a compact trigger rather than covering the article or chat panel.

**Follow-up decision**: The collapsed TOC trigger supports Y-axis dragging as local UI state for the current reader session. Persisting the dragged position across reloads remains out of scope unless requested later.
