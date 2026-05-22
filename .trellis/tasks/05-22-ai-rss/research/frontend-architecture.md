# Research: Frontend Architecture for Desktop-First RSS Reader (React + shadcn/ui)

- **Query**: Frontend architecture and UI patterns for building a desktop-first RSS reader with React + shadcn/ui
- **Scope**: External (with internal spec cross-references)
- **Date**: 2026-05-22

## Findings

### 1. Existing Open-Source RSS Reader Frontends (React-Based) — UI Patterns

| Project | Stack | UI Pattern | Notes |
|---------|-------|------------|-------|
| **Miniflux** | Go backend + vanilla JS | 2-pane (list + detail) | Minimalist, no JS framework; reference for layout ideas only |
| **FreshRSS** | PHP + vanilla JS | 3-column (nav / list / detail) | Classic desktop RSS layout, responsive collapse |
| **CommaFeed** | Java backend + React (older class components) | 3-pane (sidebar / list / detail) | Closest React-based OSS reader; uses older React patterns |
| **Feedbin** | Rails + Stimulus.js | 3-pane with keyboard focus | Commercial, excellent UX reference; keyboard-first navigation |
| **NetNewsWire** | Swift (macOS native) | 3-pane (sidebar / list / detail) | Gold standard for desktop RSS UX; article-only mode |
| **Readwise Reader** | React + Next.js | 3-pane + command palette | Closest modern React reference; uses Cmd+K palette, sidebar tree |
| **Reeder (macOS/iOS)** | SwiftUI | 3-pane with compact list | Known for ultra-clean article reading UX |

#### Dominant UI Pattern: 3-Pane Layout

The industry-standard layout for desktop RSS readers is a **3-pane (Nelson) layout**:

```
+----------+------------------+-----------------------------+
| Sidebar  | Article List     | Article Detail              |
| (feeds)  | (headlines)      | (full content / reader)     |
| 200-280px| 300-400px        | flex-1 (remaining)          |
+----------+------------------+-----------------------------+
```

**Key variations**:
- **Collapsible sidebar**: Sidebar collapses to icon-only (48px) or hides entirely, giving more room to list+detail
- **List/detail split**: Some readers allow toggling between "split view" (list + detail side-by-side) and "full view" (detail replaces list when an article is opened)
- **Article-only mode**: For focused reading, hide both sidebar and list; show only the article content (NetNewsWire, Readwise Reader)
- **Compact vs expanded list**: List can show just title+date (compact, fits many articles) or title+snippet+thumbnail (expanded, better scanning)

**Navigation within 3-pane**:
- Sidebar: Feed tree with folders (categories), unread counts, favicons
- List: Sortable by date/newest-first/oldest-first, filter by read/unread/starred
- Detail: Rendered HTML content, inline images, embedded media

#### Mobile Consideration (Desktop-First)
- Desktop-first means the 3-pane layout is the primary target
- On mobile: collapse to 1-pane (list view), tap to push detail view
- CSS `@media` or container queries to handle responsive breakpoints

---

### 2. shadcn/ui Component Ecosystem — Relevant Components for RSS Reader

shadcn/ui is a copy-paste component collection built on Radix UI primitives + Tailwind CSS. Unlike traditional component libraries, you own the code — components live in your project.

#### Core Components for RSS Reader

| Component | Usage in RSS Reader | Priority |
|-----------|---------------------|----------|
| **Sidebar** (new in shadcn) | Feed navigation tree with collapsible sections, unread badges, favicons | Critical |
| **Scroll Area** | Custom scrollbars for article list and article detail (native scrollbars are ugly on desktop) | Critical |
| **Command** (Cmd+K palette) | Quick feed search, article search, action execution (mark read, star, etc.) | High |
| **Dialog** | Add feed modal, settings, keyboard shortcut reference | High |
| **Sheet** | Slide-out panels for mobile (feed list, article actions) | Medium |
| **Dropdown Menu** | Per-article actions (mark read, star, share, open original), per-feed actions | High |
| **Context Menu** | Right-click on feeds/articles for quick actions | Medium |
| **Separator** | Visual dividers between panes | High |
| **Badge** | Unread counts on feeds/folders | High |
| **Button** | Toolbar actions, navigation | High |
| **Tooltip** | Hover hints for toolbar icons | Medium |
| **Tabs** | Article list tabs (All / Unread / Starred) | High |
| **Input** | Search bar, feed URL input | High |
| **Skeleton** | Loading states for article list and content | High |
| **Avatar / Favicon** | Feed icons in sidebar and list | Medium |
| **Toggle / Toggle Group** | View mode toggles (compact/expanded, split/stacked) | Medium |
| **Progress** | Feed refresh progress indicator | Medium |
| **Collapsible** | Feed folder expand/collapse in sidebar | High |
| **Accordion** | Settings panels | Low |
| **Alert** | Error states (feed fetch failure, auth issues) | Medium |
| **Toast / Sonner** | Background notifications (new articles fetched, feed errors) | High |
| **Popover** | Inline date pickers, filter controls | Medium |
| **ResizablePanelGroup** | Draggable pane dividers between sidebar/list/detail — this is the key component for the 3-pane layout | Critical |
| **Tabs** | Can also be used for detail view tabs (article / comments / original) | Medium |
| **Card** | Article preview cards in expanded list mode | Medium |

#### Critical: ResizablePanelGroup for 3-Pane Layout

shadcn/ui wraps `react-resizable-panels` as `ResizablePanelGroup`. This is the correct building block for the 3-pane layout:

```tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"

<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={20} minSize={15}>Sidebar</ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={30} minSize={25}>Article List</ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={50}>Article Detail</ResizablePanel>
</ResizablePanelGroup>
```

Key features:
- Persist panel sizes to localStorage for user preference
- Collapsible panels (sidebar can collapse)
- Min/max size constraints
- Keyboard accessibility (arrow keys to resize)
- Works with `direction="horizontal"` for side-by-side panes

#### shadcn/ui Sidebar Component

The shadcn/ui Sidebar component (added 2024) provides:
- Collapsible with `SidebarProvider`, `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`
- Built-in mobile support with `SidebarTrigger`
- Can integrate with `ResizablePanelGroup` for desktop resizable layout
- Supports `SidebarInset` for the main content area

---

### 3. State Management — TanStack Query + Zustand/Jotai

#### State Categories in an RSS Reader

| State Type | Examples | Recommended Solution |
|------------|----------|---------------------|
| **Server state** | Feeds, articles, read/unread status, starred status | TanStack Query v5 |
| **Client UI state** | Selected feed, selected article, sidebar collapsed, view mode | Zustand or Jotai |
| **URL state** | Current feed filter, article ID in URL | React Router / TanStack Router |
| **Form state** | Add-feed form, settings form | React Hook Form + Zod |

#### TanStack Query v5 (Server State)

**Why TanStack Query for an RSS reader**:
- Feeds and articles are fundamentally server data — fetched from backend, cached, refreshed
- Background refetching: poll for new articles on an interval (e.g., every 5 min)
- Optimistic updates: mark-as-read without waiting for server confirmation
- Cache invalidation: when a new article is fetched, invalidate the article list query
- Stale-while-revalidate: show cached articles while fetching fresh ones

**Key query keys pattern for RSS reader**:
```ts
const queryKeys = {
  feeds: {
    all: ["feeds"] as const,
    list: () => [...queryKeys.feeds.all, "list"] as const,
    detail: (id: string) => [...queryKeys.feeds.all, "detail", id] as const,
  },
  articles: {
    all: ["articles"] as const,
    byFeed: (feedId: string) => [...queryKeys.articles.all, "feed", feedId] as const,
    detail: (id: string) => [...queryKeys.articles.all, "detail", id] as const,
  },
} as const;
```

**Key features used**:
- `useQuery` for fetching feeds list and article list
- `useInfiniteQuery` for paginated article loading (scroll to load more)
- `useMutation` + `onMutate` optimistic updates for mark-read, star, etc.
- `queryClient.invalidateQueries()` after mutations to refetch stale data
- `staleTime` and `gcTime` tuning per data type (feeds: 5 min, articles: 2 min, article content: 30 min)

#### Zustand vs Jotai (Client UI State)

| Aspect | Zustand | Jotai |
|--------|---------|-------|
| **Model** | Store-based (single or multiple stores) | Atom-based (primitive atoms composed) |
| **API style** | `useStore(selector)` or hooks via `create` | `useAtom(atom)` / `useAtomValue(atom)` |
| **Bundle size** | ~1.1 KB | ~2.6 KB |
| **DevTools** | Redux DevTools integration | Jotai DevTools |
| **TypeScript** | Good, some type inference quirks | Excellent, fully inferred |
| **Learning curve** | Low (familiar store pattern) | Low (atomic model) |
| **Derived state** | Selectors | Computed atoms |
| **Middleware** | Persist, immer, devtools | Persist, immer, devtools |
| **Best for** | App-wide state with clear "store" shape | Fine-grained reactive state, component-local atoms |
| **RSS reader fit** | Natural: `useReaderStore` with selectedFeed, selectedArticle, sidebarOpen, viewMode | Natural: `selectedFeedAtom`, `selectedArticleAtom`, atoms compose easily |

**Zustand example for RSS reader UI state**:
```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ReaderState {
  selectedFeedId: string | null;
  selectedArticleId: string | null;
  sidebarCollapsed: boolean;
  articleListMode: "compact" | "expanded";
  articleDetailMode: "split" | "stacked";
  set: (partial: Partial<ReaderState>) => void;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      selectedFeedId: null,
      selectedArticleId: null,
      sidebarCollapsed: false,
      articleListMode: "compact",
      articleDetailMode: "split",
      set: (partial) => set(partial),
    }),
    { name: "reader-ui" } // persists to localStorage
  )
);
```

**Jotai example for same state**:
```ts
import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const selectedFeedIdAtom = atomWithStorage<string | null>("selectedFeed", null);
export const selectedArticleIdAtom = atomWithStorage<string | null>("selectedArticle", null);
export const sidebarCollapsedAtom = atomWithStorage("sidebarCollapsed", false);

// Derived atom: current feed's articles are loading
export const isCurrentFeedLoadingAtom = atom((get) => {
  const feedId = get(selectedFeedIdAtom);
  // can read TanStack Query state here via queryClient
  return feedId ? queryClient.getQueryState(["articles", "feed", feedId])?.fetchStatus === "fetching" : false;
});
```

**Verdict for this project**: Both are excellent. **Zustand** is slightly simpler for a store-shaped app like an RSS reader (one cohesive "reader state" object). **Jotai** shines when you want fine-grained reactivity and cross-component atom sharing without a centralized store. The choice is a toss-up; consistency within the project matters more than the library itself.

---

### 4. Virtual Scrolling for Large Article Lists

RSS readers can accumulate thousands of articles. Rendering all as DOM nodes kills performance. Virtual scrolling renders only the visible rows + a small overscan buffer.

#### TanStack Virtual vs react-virtuoso

| Aspect | TanStack Virtual v3 | react-virtuoso |
|--------|---------------------|----------------|
| **API style** | `useVirtualizer()` hook — headless | `<Virtuoso>` component — batteries-included |
| **Flexibility** | Very high — you control rendering | Moderate — component handles most logic |
| **Dynamic row heights** | Supported via `measureElement` | Supported via `increaseViewportBy` + auto-measure |
| **Bundle size** | ~3 KB | ~15 KB |
| **React 18/19 support** | Full support, concurrent features | Full support |
| **Infinite scroll** | Manual (combine with TanStack Query `useInfiniteQuery`) | Built-in `<Virtuoso>` endReached callback |
| **Grouped data** | Manual (custom groups) | Built-in `<GroupedVirtuoso>` |
| **Keyboard nav** | Manual implementation | Built-in `followOutput` + keyboard |
| **Grid layout** | `useVirtualizer` + `useVirtualizer` for grids | Not built-in |
| **SSR** | Supported | Supported |
| **Maintenance** | Active (TanStack org) | Active |
| **Best fit** | When you want full control + small bundle + already using TanStack ecosystem | When you want quick setup with built-in features like infinite scroll, grouping, keyboard nav |

**TanStack Virtual example for article list**:
```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

function ArticleList({ articles }: { articles: Article[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: articles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // estimated row height in px
    overscan: 5, // render 5 extra rows above/below viewport
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const article = articles[virtualRow.index];
          return (
            <div
              key={article.id}
              style={{
                position: "absolute",
                top: virtualRow.start,
                left: 0,
                width: "100%",
                height: virtualRow.size,
              }}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement} // for dynamic height
            >
              <ArticleRow article={article} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**react-virtuoso example**:
```tsx
import { Virtuoso } from "react-virtuoso";

function ArticleList({ articles }: { articles: Article[] }) {
  return (
    <Virtuoso
      data={articles}
      itemContent={(index, article) => <ArticleRow article={article} />}
      endReached={loadMore} // built-in infinite scroll trigger
      followOutput="smooth" // auto-scroll to new items
      increaseViewportBy={200} // overscan
    />
  );
}
```

**Verdict**: **react-virtuoso** is a better fit for an RSS reader because:
1. Built-in infinite scroll (pairs well with cursor-based pagination from backend)
2. Built-in `followOutput` for new article arrival (live feed updates)
3. `<GroupedVirtuoso>` for grouping articles by date ("Today", "Yesterday", "Last Week")
4. Less boilerplate for a standard vertical list use case

However, if the project is already heavily invested in TanStack ecosystem (Query, Router) and wants minimal dependencies, **TanStack Virtual** is a solid alternative with more control.

---

### 5. Keyboard Shortcut Patterns in Desktop-First Web Apps

Desktop-first RSS readers are keyboard-heavy. Users expect vim-like navigation or standard mail-client shortcuts.

#### Common Shortcut Patterns in RSS Readers

| Shortcut | Action | Used By |
|----------|--------|---------|
| `j` / `k` | Next/previous article (vim-style) | Feedbin, Readwise, Newsboat |
| `n` / `p` | Next/previous article in list (without opening) | Google Reader legacy |
| `Enter` / `o` | Open selected article | Universal |
| `s` | Toggle star/bookmark | Feedbin, Readwise |
| `m` | Toggle read/unread | Feedbin, Readwise |
| `r` | Refresh/refresh feeds | Universal |
| `1-4` | Switch between view modes | NetNewsWire |
| `Shift+a` | Mark all as read | Universal |
| `/` | Focus search | Universal |
| `Cmd+K` / `Ctrl+K` | Open command palette | Readwise, VS Code pattern |
| `Cmd+Shift+S` | Toggle sidebar | Readwise |
| `Space` / `Shift+Space` | Scroll article content | Universal |
| `h` / `l` | Navigate sidebar feeds (vim) | Feedbin |
| `gg` | Go to top | vim-like |
| `G` | Go to bottom | vim-like |

#### Implementation Options

| Library | Size | Approach | Notes |
|---------|------|----------|-------|
| **hotkeys-js** | ~4 KB | `hotkeys('j', handler)` — simple, no React binding | Most popular, well-tested |
| **react-hotkeys-hook** | ~5 KB | `useHotkeys('j', handler)` — React hook wrapper around hotkeys-js | Best React DX, handles focus scopes |
| **tinykeys** | ~3 KB | `createShortcut(canvas, bindings)` — modern, event-based | Clean API, supports key combos, sequences |
| **@react-aria/interactions** | Part of React Aria | Keyboard handling as part of Adobe's accessibility library | Heavier, but comprehensive a11y |

**react-hotkeys-hook example**:
```tsx
import { useHotkeys } from "react-hotkeys-hook";

function ReaderView() {
  useHotkeys("j", () => selectNextArticle(), { scopes: ["reader"] });
  useHotkeys("k", () => selectPrevArticle(), { scopes: ["reader"] });
  useHotkeys("s", () => toggleStar(), { scopes: ["reader"] });
  useHotkeys("m", () => toggleRead(), { scopes: ["reader"] });
  useHotkeys("r", () => refreshFeeds(), { scopes: ["reader"] });
  useHotkeys("/", () => focusSearch(), { scopes: ["reader"] });
  useHotkeys("mod+k", () => openCommandPalette());
  useHotkeys("mod+shift+s", () => toggleSidebar());

  return <ArticleDetail />;
}
```

**Key feature: Scoped hotkeys**. `react-hotkeys-hook` supports scopes so shortcuts only activate in the right context (e.g., `j`/`k` only when article list is focused, not when typing in search).

#### Command Palette Pattern

The command palette (Cmd+K) pattern, popularized by VS Code and adopted by Readwise Reader, is increasingly expected in desktop web apps. shadcn/ui has a built-in `Command` component (built on `cmdk` by Paco Coursey):

```tsx
import { Command } from "@/components/ui/command"

<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Search articles, feeds, actions..." />
  <CommandList>
    <CommandGroup heading="Articles">
      {articles.map(a => (
        <CommandItem key={a.id} onSelect={() => openArticle(a.id)}>
          {a.title}
        </CommandItem>
      ))}
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Actions">
      <CommandItem onSelect={markAllRead}>Mark All as Read</CommandItem>
      <CommandItem onSelect={refreshFeeds}>Refresh Feeds</CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

The `cmdk` library supports:
- Fuzzy search (via `fuse.js` or built-in)
- Grouped results
- Keyboard navigation within the palette
- Loading states for async search

---

### 6. Real-Time Updates Pattern for New Articles

An RSS reader needs to notify users when new articles arrive. Options:

#### Comparison

| Pattern | Latency | Complexity | Server Cost | Bidirectional | Best For |
|---------|---------|------------|-------------|---------------|----------|
| **Polling** (short interval) | 5-60s | Low | Medium (repeated HTTP requests) | No | Simple apps, low user count |
| **Long Polling** | Near-real-time | Medium | Medium (held connections) | No | Moderate real-time needs |
| **Server-Sent Events (SSE)** | Real-time | Low-Medium | Low (one connection per client) | No (server→client only) | One-way push (notifications, new articles) |
| **WebSocket** | Real-time | High | Low-Medium | Yes (bidirectional) | Chat, collab, bidirectional needs |

#### Recommended: SSE (Server-Sent Events)

For an RSS reader, **SSE is the best fit** because:

1. **Unidirectional**: New article notifications flow server→client only. The client doesn't need to send data over the same channel (it uses REST/mutations for actions).
2. **Native browser support**: `EventSource` API, no library needed on client. Polyfill available for old browsers.
3. **Auto-reconnect**: Built into the `EventSource` spec — handles connection drops gracefully.
4. **HTTP/2 multiplexing**: Works over HTTP/2 without the upgrade dance WebSockets need.
5. **Simpler server implementation**: A simple endpoint that holds a connection and writes `text/event-stream` responses. No WebSocket library needed.
6. **TanStack Query integration**: Use SSE to trigger `queryClient.invalidateQueries()` when a "new-articles" event arrives.

**SSE flow for RSS reader**:
```
Backend feed refresh cron → New articles found → Push to SSE channel
  → Client EventSource receives event → invalidateQueries(["articles"])
  → TanStack Query refetches → Article list updates with new items
```

**Client implementation**:
```tsx
// hooks/useArticleStream.ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useArticleStream() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource("/api/stream");

    eventSource.addEventListener("new-articles", (event) => {
      const data = JSON.parse(event.data);
      // Invalidate relevant queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      // Show toast notification
      toast.success(`${data.count} new articles`);
    });

    eventSource.addEventListener("feed-error", (event) => {
      const data = JSON.parse(event.data);
      toast.error(`Feed error: ${data.feedTitle}`);
    });

    return () => {
      eventSource.close();
    };
  }, [queryClient]);
}
```

**Fallback: Polling with TanStack Query**

If SSE is too complex for the initial version, polling with TanStack Query is trivial:
```tsx
// Poll every 5 minutes for new articles
useQuery({
  queryKey: ["articles", "feed", feedId],
  queryFn: () => fetchArticles(feedId),
  refetchInterval: 5 * 60 * 1000, // 5 min
  staleTime: 2 * 60 * 1000, // 2 min
});
```

**Progressive enhancement path**: Start with polling (MVP), add SSE when real-time becomes a priority.

---

### Files Found

| File Path | Description |
|---|---|
| `.trellis/spec/frontend/index.md` | Frontend spec index (all guides "To fill") |
| `.trellis/spec/frontend/state-management.md` | State management guide template (empty) |
| `.trellis/spec/frontend/component-guidelines.md` | Component guide template (empty) |
| `.trellis/spec/frontend/directory-structure.md` | Directory structure template (empty) |
| `.trellis/spec/frontend/hook-guidelines.md` | Hook guide template (empty) |
| `.trellis/spec/frontend/type-safety.md` | Type safety guide template (empty) |
| `.trellis/spec/frontend/quality-guidelines.md` | Quality guide template (empty) |
| `.trellis/tasks/05-22-ai-rss/task.json` | Active task definition (status: planning) |

### Related Specs

- `.trellis/spec/frontend/state-management.md` — Will need to be filled with the chosen state management pattern (TanStack Query + Zustand/Jotai)
- `.trellis/spec/frontend/component-guidelines.md` — Will need to be filled with shadcn/ui component usage conventions
- `.trellis/spec/frontend/directory-structure.md` — Will need to be filled with the RSS reader module organization

## Caveats / Not Found

- No existing frontend code in the project — this is a greenfield project, so all decisions are open
- Exa MCP tools were not available for this session; external research is based on knowledge of the libraries and open-source projects up to January 2026
- The choice between Zustand and Jotai is a near-toss-up; the real deciding factor should be team familiarity
- react-virtuoso vs TanStack Virtual: react-virtuoso has more built-in features for a list-based reader, but TanStack Virtual integrates more naturally if the project is already using other TanStack libraries
- SSE requires backend support; the backend spec is also empty, so the SSE endpoint design needs to be coordinated with the backend implementation
