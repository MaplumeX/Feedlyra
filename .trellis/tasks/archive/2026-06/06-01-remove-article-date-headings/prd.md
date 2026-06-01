# Remove Article List Date Headings

## Goal

Remove the date group headings from the article list so the list reads as a continuous stream of articles without day separators.

## What I Already Know

- The user asked to remove the article list date headings.
- The article list UI is implemented in `frontend/src/components/ArticleList.tsx`.
- The current list uses `GroupedVirtuoso` with `groupContent` to render date headings from `published_at`.
- Each article row also renders its own published date in the metadata line; this task targets the list date headings only.
- The frontend uses React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui primitives, Zustand, and React Query.

## Assumptions

- Remove only the date group header rows, not the per-article date metadata inside each article row.
- Preserve the current article ordering, filtering, selection, read/star actions, refresh, mark-all-read, and scroll-to-mark-read behavior.
- Keep the virtualized list implementation efficient and compatible with `react-virtuoso`.

## Requirements

- The article list must no longer display date separator headings such as today, yesterday, or month/day labels.
- Article rows must remain visually and behaviorally unchanged except for the removed separator rows.
- Empty and loading states must remain unchanged.
- Scroll-based mark-as-read must still mark unread articles that were scrolled past.

## Acceptance Criteria

- [ ] Article list renders as a continuous list without date heading rows.
- [ ] Per-article published dates remain visible in article row metadata.
- [ ] Selecting, starring, read toggling, refresh, and mark-all-read behavior still work.
- [ ] `npm run build` succeeds for the frontend.

## Definition of Done

- Frontend implementation updated.
- Relevant Trellis frontend guidelines loaded before coding.
- Quality check completed with lint/type/build command as appropriate.
- Spec update reviewed; update spec only if this reveals a reusable convention.

## Out of Scope

- Backend API changes.
- Article sorting changes.
- Removing per-article dates from article rows or article detail.
- Redesigning the article list layout beyond the date heading removal.

## Technical Notes

- Relevant component: `frontend/src/components/ArticleList.tsx`.
- Relevant spec entry: `.trellis/spec/frontend/index.md`.
- Relevant frontend guidelines: component, type-safety, and quality guidelines.
- No external research is needed because the implementation path is local and straightforward.
