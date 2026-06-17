# Design — Conditional panel layout crash fix (Approach A: Group remount)

## Decision

Use **Approach A**: give the layout `<Group>` a `key` that changes whenever the set of child `<Panel>`s changes, so `react-resizable-panels` discards its stale mutable layout object on every panel-set transition and re-initializes from `defaultSize` / `defaultLayout`.

User-selected tradeoff (confirmed): the shared panels (sidebar / article-list / article-detail) will remount on chat toggle / mode switch, which resets their scroll position. Content is served from React Query cache so it re-renders quickly, but scroll returns to top. Accepted.

## Why Approach A is robust

The crash is a **race**: after `ai-chat` unmounts, the `<Group>`'s internal mutable `layout` object still holds the `ai-chat` key while only 3 panel constraints remain registered. If the Group-level `ResizeObserver` (dist:1422) fires inside that window, `jt` (dist:1357) does `const u = { ...prevLayout }` — copying the stale `ai-chat` key through — and feeds 4 layout values into `U` (dist:736), which has only 3 constraints → throws.

Approach A does **not** try to win the race (that is Approach B's imperative `setLayout()` cleanup, which still has an exposure window and is fragile). Instead it removes the precondition entirely: when the panel set changes, React tears down the whole `<Group>` (and its `ResizeObserver` + mutable layout) and mounts a new one. The new Group's layout is seeded only from panel `defaultSize` props and (if length matches) `defaultLayout` — never from a stale runtime key. Even if the new `ResizeObserver` fires immediately, it operates on a fresh layout object whose keys exactly match the registered panels. No stale key can survive.

## Implementation

Single change in `frontend/src/pages/Home.tsx`.

Derive a stable key from the presence of the chat sidebar panel, and pass it to `<Group>`:

```tsx
const showChatPanel = conversationPanelOpen && !!activeConversationId;
const isSidebarMode = chatPanelMode === "sidebar";
// Force react-resizable-panels to re-init its internal layout when the panel
// set changes, so no stale "ai-chat" key survives an unmount.
const groupKey = showChatPanel && isSidebarMode ? "with-chat" : "without-chat";
```

```tsx
<Group
  key={groupKey}            // <-- added
  orientation="horizontal"
  defaultLayout={defaultLayout}
  onLayoutChanged={onLayoutChanged}
>
```

No other code changes required. The existing pieces already cooperate:

- `chatPanelWidth` (Zustand, persisted in `reader.ts` partialize) is passed as the chat `<Panel defaultSize>` → survives Group remounts as the authoritative chat width.
- `loadLayout()` already strips stale `ai-chat` / `conversation-sidebar` keys from the persisted `providence-layout` → safe as a `defaultLayout` source.
- On each remount, `onLayoutChanged` re-persists the freshly-computed layout, so switching `with-chat` → `without-chat` self-cleans the stored `ai-chat` entry instead of leaving it to linger.

## Scope of remount

| Trigger | groupKey transition | Remounted | Kept (React Query cache) |
|---|---|---|---|
| Open chat (sidebar) | `without-chat` → `with-chat` | sidebar, article-list, article-detail, new chat panel | content/messaging |
| Close chat (sidebar) | `with-chat` → `without-chat` | sidebar, article-list, article-detail | content/messaging |
| Sidebar → floating (chat open) | `with-chat` → `without-chat` (chat moves to `FloatingChatPanel` portal) | sidebar, article-list, article-detail | content/messaging |
| Floating → sidebar (chat open) | `without-chat` → `with-chat` | sidebar, article-list, article-detail, chat panel | content/messaging |
| Resize a separator (no toggle) | unchanged | none | none |

Pure resize (no toggle) does not change `groupKey`, so no remount — preserves the prior behavior and performance.

## Data flow

```
ReaderStore (chatPanelMode, conversationPanelOpen, activeConversationId)
        │
        ├─► groupKey  ──► <Group key=groupKey>  (re-init lib mutable layout on change)
        │
        ├─► showChatPanel && isSidebarMode  ──► 4th <Panel id="ai-chat" defaultSize={chatPanelWidth}>
        │
        └─► showChatPanel && !isSidebarMode ──► <FloatingChatPanel> (portal, unaffected)

localStorage "providence-layout" ──► loadLayout() (strips stale ai-chat) ──► <Group defaultLayout>
<Group onLayoutChanged> ──► saveLayout() ──► localStorage "providence-layout"
```

## Rollout / Rollback

- **Rollout**: single-line additive change (`key` prop + one derived const). No schema, migration, API, or dependency change. Ships in a normal frontend build.
- **Rollback**: remove the `key` prop and the `groupKey` const. Reverts to prior (buggy) behavior with no side effects — the change is purely additive and does not touch persisted state shape.

## Alternatives considered

- **Approach B — imperative `groupRef.setLayout()` cleanup in a `useEffect` on panel-set change.** Keeps panels mounted (no scroll reset). Rejected: depends on effect-vs-ResizeObserver ordering; the inconsistency window still exists and a stray RO callback before the effect runs still throws. More complex and less robust than A.
- **Approach C — keep `ai-chat` always mounted, collapse to 0 instead of unmount.** Avoids the toggle race but leaves an invisible separator handle in the layout and complicates the sidebar↔floating interaction. Rejected by complexity/risk.
- **Guard `U`'s throw**: not viable — library internals, can't patch from app code.

## Out of scope

- `FloatingChatPanel` pointer-capture resize logic (separate path; not the reported crash).
- App-wide ErrorBoundary (user chose Home-level only previously).
- Removing the existing `mountedRef` guard in `AIChatPanel` or the `loadLayout()` migration strips — leave as-is (harmless, still useful).
