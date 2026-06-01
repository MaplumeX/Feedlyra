# Optimize Unread Article Indicator

## Goal

Improve the visual clarity and usability of unread article indicators in the article list, so users can quickly distinguish read from unread articles at a glance.

## What I Already Know

* Current unread indicators: a small 2x2px blue dot (`bg-primary rounded-full`) + `font-medium` on the article row
* Read/unread toggle button in ArticleDetail uses Check (unread state) / Circle outline (read state) icons
* Sidebar shows unread count badges per feed and total
- Auto-mark-read on article selection and on scroll (debounced)
- Keyboard shortcuts: `m` to toggle, `j` auto-marks read, `shift+a` mark all read
- Backend uses ReadStatus join table; `is_read` computed per-request; `unread_count` per feed

## Assumptions (temporary)

* The user feels the current indicators are not prominent enough or lack clarity
* Backend/data layer does not need changes — this is a frontend visual/UX change
* The overall read/unread mechanics (auto-mark, toggle, batch) are not in scope

## Open Questions

* (resolved through Q&A — see requirements above)

## Requirements

* Unread dot occupies its own column (left gutter), not inline next to the title
* Unread dot vertically centered with the title line
* All other content rows (feed title, snippet, author) respect the gutter width (left padding)
* Read articles reserve the dot column space to avoid layout shift when toggling read/unread

## Acceptance Criteria (evolving)

* [ ] Unread articles show a dot in a dedicated left gutter column
* [ ] Dot is vertically centered with the title text
* [ ] Switching between read/unread does not cause title or content to shift horizontally
* [ ] Existing read/unread toggle functionality continues to work

## Definition of Done

* Lint / typecheck / CI green
* No regression in read/unread toggle, auto-mark, batch-mark functionality

## Out of Scope (explicit)

* Backend read/unread logic changes
- Adding new read/unread features (e.g. read-later, snooze)
* Changes to sidebar unread count badges

## Technical Notes

* Key file: `frontend/src/components/ArticleList.tsx` — `ArticleRow` component (lines 58-117)
* Current layout: `items-start gap-2` between dot and title in the same flex row
* New layout: outer flex row with dot column + content column; dot uses `items-center` on the title line
* Read articles: dot column renders as invisible placeholder (same width) to prevent layout shift
* Uses Tailwind utility classes inline (no separate CSS files)
* Primary color via `bg-primary` Tailwind theme variable

## Technical Approach

Restructure `ArticleRow` inner layout:
- Change the `flex items-start gap-2` wrapper (line 78) into a two-column layout
- Left column: fixed-width gutter holding the dot (or empty space)
- Right column: all content (feed title, title+star, snippet, author)
- Dot vertically centered with title via `items-center` on the title-row flex container
