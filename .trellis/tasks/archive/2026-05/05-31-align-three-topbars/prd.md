# Align Three Area Top Bars

## Goal

Align the top bars of the three main reader areas so the sidebar, article list, and article detail toolbars share the same visual height and border baseline.

## What I Already Know

- The user wants the top bars of three areas aligned.
- The main layout has three resizable panels in `frontend/src/pages/Home.tsx`.
- The visible top bars are in:
  - `frontend/src/components/Sidebar.tsx`
  - `frontend/src/components/ArticleList.tsx`
  - `frontend/src/components/ArticleDetail.tsx`
- Current toolbar heights are driven by independent padding and button sizes, which can produce slight vertical mismatch.

## Assumptions

- "Three areas" means the main sidebar, article list, and article detail areas.
- The desired behavior is visual alignment without changing reader functionality or panel sizing behavior.

## Requirements

- Give the three main top bars a consistent fixed height.
- Preserve existing actions and layout behavior.
- Avoid introducing new visual wrappers or unrelated redesign.
- Keep the change scoped to frontend layout/styling.

## Acceptance Criteria

- [ ] Sidebar top bar, article list top bar, and article detail top bar share the same height.
- [ ] Their bottom borders align horizontally across the three panels.
- [ ] Existing toolbar buttons remain visible and clickable.
- [ ] Frontend lint/type checks pass.

## Definition of Done

- Lint / typecheck pass for the frontend.
- Visual alignment is verified in the running app where feasible.
- No unrelated files are changed.

## Out of Scope

- Redesigning the reader layout.
- Changing toolbar actions.
- Changing AI chat panel layout unless required by the main three-area alignment.

## Technical Notes

- Frontend stack: React + TypeScript + Vite + Tailwind.
- Relevant spec index: `.trellis/spec/frontend/index.md`.
