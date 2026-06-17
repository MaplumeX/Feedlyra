# Implement — Conditional panel layout crash fix

## Context order

jsonl manifests → `prd.md` → `design.md` (this file).

## Approach

Single-file change: `frontend/src/pages/Home.tsx`. Approach A (Group remount via `key`). See `design.md`.

## Ordered checklist

1. Edit `frontend/src/pages/Home.tsx`:
   - After computing `showChatPanel` and `isSidebarMode` (currently around lines 138-139), derive:
     ```tsx
     const groupKey = showChatPanel && isSidebarMode ? "with-chat" : "without-chat";
     ```
   - Add `key={groupKey}` to the `<Group orientation="horizontal" ...>` element (currently around line 143).
2. No other file changes.

## Validation commands

Run from `frontend/`:

```bash
pnpm lint      # eslint . — expect clean
pnpm build     # tsc -b && vite build — expect no type/build errors
pnpm test      # vitest run — expect green
```

## Manual verification (golden + edge)

After `pnpm dev` (sidebar mode default):

- [ ] Open AI chat (from article detail) → drag the chat-panel separator to resize → width changes smoothly, no crash.
- [ ] Close AI chat → no "Something went wrong"; sidebar/list/detail remain interactive.
- [ ] Rapid open/close of AI chat (esp. while actively dragging another separator) → no crash.
- [ ] Toggle sidebar ↔ floating mode (pin/unpin in chat header) with chat open → no crash; floating panel resizes via its own edges; back to sidebar resizes via separator.
- [ ] Resize browser window while chat is open → clamps correctly, no crash.
- [ ] Reload after resizing → persisted layout restored; no stale `ai-chat` key crash on mount (check `localStorage` `providence-layout`).
- [ ] Confirm sidebar collapse (Shift+S) still works after toggling chat.

## Review gates

- Reviewer should confirm the diff is exactly: one derived `groupKey` const + one `key` prop on `<Group>` — nothing else (no incidental cleanup, no stray edits).
- Reviewer should confirm no other `<Group key>` exists / no duplicate-key collisions.

## Rollback point

Revert the single commit (remove `groupKey` const + `key` prop). No DB / persisted-state migration was introduced, so rollback is clean and leaves no residue.
