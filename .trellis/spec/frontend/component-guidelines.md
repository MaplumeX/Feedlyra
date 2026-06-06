# Component Guidelines

> How components are built in this project.

---

## Overview

All components are functional components using `export function` declarations. shadcn/ui for primitives, Tailwind CSS for styling. No CSS modules, no styled-components.

---

## Component Structure

```tsx
// Standard feature component
export function Sidebar() {
  const { t } = useTranslation("reader");
  const { data } = useFeeds();
  // ...

  return (
    <aside className="...">
      {/* ... */}
    </aside>
  );
}
```

- Named exports (not default exports) for most components
- `App.tsx` is the single exception: `export default function App()`
- Internal/helper components in the same file use `function` without export:

```tsx
function ArticleRow({ article, isSelected, onSelect }: {
  article: Article;
  isSelected: boolean;
  onSelect: () => void;
}) { /* ... */ }

function EmptyState() { /* ... */ }

export function ArticleList() {
  // uses ArticleRow and EmptyState internally
}
```

---

## Props Conventions

**Simple props** — inline object type in function signature:

```tsx
function ArticleRow({ article, isSelected, onSelect }: {
  article: Article;
  isSelected: boolean;
  onSelect: () => void;
})
```

**Complex props** — named interface above the component:

```tsx
interface AIChatPanelProps {
  articleId: string;
  articleTitle: string;
}

export function AIChatPanel({ articleId, articleTitle }: AIChatPanelProps)
```

**Dialog components** — follow shadcn pattern with `open`/`onOpenChange`:

```tsx
interface AddFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

---

## Styling Patterns

- **Tailwind utility classes** inline in JSX (no CSS modules, no styled-components)
- Theme via CSS custom properties in `index.css` (`:root` / `.dark`), mapped through `tailwind.config.ts`
- **Semantic CSS variables** for panel-specific styling (e.g., `--sidebar-bg`, `--article-hover`, `--chat-bubble-user`). See "Semantic CSS Variables Pattern" below.
- Dark mode via `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`
- ThemeProvider wraps app inside BrowserRouter (next-themes requires router context in SPA)
- ThemeToggle uses `useTheme()` with `mounted` state guard to prevent hydration mismatch
- shadcn/ui components for primitives (Button, Badge, DropdownMenu, etc.)
- Class merging: `cn()` from `src/lib/utils.ts` (combines `clsx` + `tailwind-merge`)
- shadcn/ui primitives use `class-variance-authority` (cva) for variant styling

### Semantic CSS Variables Pattern

For panel-specific or component-specific colors that differ from the global theme tokens, define semantic CSS variables with light+dark variants in `index.css` and map them in `tailwind.config.ts`:

```css
/* index.css */
:root {
  --sidebar-bg: 220 18% 96%;
  --sidebar-hover: 220 14% 93%;
  --article-hover: 220 14% 94%;
  --chat-bubble-user: 239 84% 58% / 0.08;
  --chat-bubble-ai: 220 14% 96%;
}
.dark {
  --sidebar-bg: 224 20% 5%;
  --sidebar-hover: 224 16% 14%;
  --article-hover: 224 16% 12%;
  --chat-bubble-user: 239 84% 67% / 0.12;
  --chat-bubble-ai: 224 16% 14%;
}
```

```ts
// tailwind.config.ts
colors: {
  sidebar: {
    bg: "hsl(var(--sidebar-bg))",
    hover: "hsl(var(--sidebar-hover))",
  },
  "article-hover": "hsl(var(--article-hover))",
  "chat-user": "hsl(var(--chat-bubble-user))",
  "chat-ai": "hsl(var(--chat-bubble-ai))",
}
```

**Why**: Global theme tokens (`--accent`, `--muted`) serve as shared defaults. Semantic variables let each panel (sidebar, article list, chat) have its own visual identity while remaining dark-mode compatible. This also makes future theme customization easier — changing `--sidebar-bg` only affects the sidebar.

**Key rules**:
- Every semantic variable MUST have both `:root` and `.dark` variants
- Use HSL values (same format as shadcn/ui theme tokens) for consistency
- Alpha transparency uses the `/ 0.X` suffix (e.g., `239 84% 58% / 0.08`)
- Map in `tailwind.config.ts` with `hsl()` wrapper so Tailwind utilities work (`bg-sidebar-bg`, `bg-chat-user`)

### Google Fonts Integration

When adding or changing Google Fonts:

1. Add `<link>` tags in `index.html` with `display=swap`
2. Define `--font-ui` and `--font-heading` CSS variables with full system fallback stack
3. Apply via `body { font-family: var(--font-ui) }` and headings in `index.css`
4. Add `fontFamily` entries in `tailwind.config.ts` for `font-ui` and `font-heading` utilities
5. When a reader font option is removed (e.g., Inter → Onest), ensure the font is also removed from the Google Fonts `<link>` if no longer needed, BUT keep it if any existing user preference could reference it

**Gotcha**: If a reader font option references a Google Font, that font MUST be in the Google Fonts link. Removing the font link breaks the option silently (falls back to system font). When replacing a font option, keep the old Google Fonts entry and add the new one.

### Sidebar Selected State with Left Border

When using a left-border indicator for selected items in the sidebar:

```tsx
// Wrong: rounded-md creates left-side rounding that conflicts with border-l-2
<div className="rounded-md border-l-2 border-primary bg-sidebar-selected">

// Correct: use rounded-r-md to only round the right side
<div className="rounded-r-md border-l-2 border-primary bg-sidebar-selected">
```

**Why**: `border-l-2` + `rounded-md` creates a visible gap between the left border and the container edge. The left side should be flush against the container edge for the indicator to feel "attached". Use `rounded-r-md` (or `rounded-l-md`/`rounded-t-md`/etc.) when combining border indicators with rounding.

### Prose Content Typography Override

Article content uses `@tailwindcss/typography` `prose` classes. When user-adjustable typography is needed, override via inline styles on the prose container — do NOT swap prose size classes (`prose-sm`/`prose`/`prose-lg`):

```tsx
const proseStyle: Record<string, string> = {
  fontSize: `${readerSettings.fontSize}px`,
  fontFamily: getFontStack(readerSettings.fontFamily),
  lineHeight: `${readerSettings.lineHeight}`,
  letterSpacing: `${readerSettings.letterSpacing}em`,
  "--prose-p-spacing": `${readerSettings.paragraphSpacing}em`,
};

<article
  className="prose prose-slate max-w-none dark:prose-invert [&_p]:mb-[var(--prose-p-spacing,1.25em)]"
  style={proseStyle}
>
```

**Why**: `prose-sm`/`prose`/`prose-lg` are discrete presets with fixed type scales. Inline style overrides are continuous and composable. CSS custom properties (e.g., `--prose-p-spacing`) can be consumed by Tailwind arbitrary variants (`[&_p]:mb-[var(--prose-p-spacing)]`) for elements not directly controllable via inline style.

**Key details**:
- Use `Record<string, string>` type (not `React.CSSProperties`) to avoid type errors on CSS custom properties
- Keep the `prose prose-slate max-w-none dark:prose-invert` classes — they provide base spacing, color, and link styles
- Content width (`max-width`) is set separately from the prose container, typically on a parent wrapper

### Layout Convention: Three-Panel Resizable Layout

The main reader layout uses `react-resizable-panels` v4 (Group/Panel/Separator) with pixel-based width constraints.

**Why fixed widths**: Unconstrained resizable panels let users shrink panels below readable widths. Pixel constraints (`minSize`/`maxSize`) prevent this while still allowing layout customization.

```
Group (orientation="horizontal")
  ├── Panel#sidebar:        minSize=120, maxSize=280, defaultSize=192, collapsible, collapsedSize=40
  ├── Separator
  ├── Panel#article-list:   minSize=180, maxSize=400, defaultSize=280
  ├── Separator
  ├── Panel#article-detail: (flexible, takes remaining space)
  ├── Separator (conditional, only when chat panel is open)
  └── Panel#ai-chat:       minSize=280, maxSize=600, defaultSize=360 (conditional)
```

**Chat panel behavior**:
- The AI chat panel is a top-level Panel in the main Group, not nested inside article-detail
- Only renders when `conversationPanelOpen` is true AND `activeConversationId` is non-null
- When toggled off, the Panel is unmounted entirely (not collapsed) — article-detail takes full width
- The conversation history list is in a Popover (anchored to History button in AIChatPanel header), NOT a separate panel
- Width persisted via `chatPanelWidth` in Zustand (included in `partialize`)
- `onResize` callback on the chat Panel updates `chatPanelWidth` in the store

**Collapse behavior**: When `sidebarCollapsed` is true, the sidebar Panel collapses to 40px via `collapsible` + `collapsedSize={40}`. Controlled by Zustand store (`sidebarCollapsed`), toggled via Shift+S shortcut and Command Palette.

**Persistence**: Layout saved to localStorage via `onLayoutChanged` callback; restored via `defaultLayout` prop on mount.

> **Note**: `react-resizable-panels` v4 uses `Group`/`Panel`/`Separator` naming (not v3's `PanelGroup`/`Panel`/`PanelResizeHandle`). v4 supports pixel values directly for `minSize`/`maxSize`/`defaultSize`.

### ScrollArea in Fixed-Width Panels

Radix ScrollArea inserts an internal content wrapper with `display: table`. In fixed-width panels such as the sidebar, that wrapper can expand to the max-content width of long feed titles and make rows overflow horizontally.

The shared ScrollArea primitive must force that internal wrapper back to block layout:

```tsx
<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] [&>div]:!block">
  {children}
</ScrollAreaPrimitive.Viewport>
```

Rows inside fixed-width ScrollArea panels should also constrain every flex layer:

```tsx
<div className="flex w-full min-w-0 overflow-hidden">
  <span className="min-w-0 flex-1 truncate">Long text</span>
  <Badge className="shrink-0 truncate">123</Badge>
</div>
```

**Why**: `truncate` only works when the flex item is allowed to shrink (`min-w-0`) and the row has a concrete width (`w-full`). The ScrollArea wrapper fix prevents the scroll viewport from using max-content width as that concrete width.

### ScrollArea Viewport Access for Reader Features

When a feature needs to measure, listen to, or scroll the article reader viewport (for example section highlighting or TOC jumps), extend the shared `ScrollArea` primitive with an optional viewport ref instead of replacing it with native `overflow-y-auto`.

```tsx
interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  viewportRef?: React.Ref<HTMLDivElement>;
}

<ScrollAreaPrimitive.Viewport
  ref={viewportRef}
  className="h-full w-full rounded-[inherit] [&>div]:!block"
>
  {children}
</ScrollAreaPrimitive.Viewport>
```

Feature components can then receive the real viewport element:

```tsx
const [scrollViewport, setScrollViewport] = useState<HTMLDivElement | null>(null);

<ScrollArea className="flex-1" viewportRef={setScrollViewport}>
  <article>{/* content */}</article>
</ScrollArea>
```

**Why**: Radix `ScrollArea` scrolls inside its viewport, not the root element. Exposing the viewport preserves the project-wide ScrollArea wrapper fix (`[&>div]:!block`), keeps scrollbar behavior consistent, and gives feature code the correct element for `scrollTo`, scroll listeners, and width measurement.

---

## Accessibility

- `sr-only` span for close button labels in Dialog
- Semantic `<article>` element in ArticleDetail
- `<time>` element with `dateTime` attribute
- `html[lang="en"]` in index.html
- `rel="noopener noreferrer"` on external links
- `title` attributes on icon-only buttons for tooltip text
- **Gap**: Many interactive elements use `<div onClick>` without ARIA roles — should use `<button>` or add appropriate ARIA attributes

---

## Common Mistakes

- **Unconstrained resizable panels** — `react-resizable-panels` without `minSize`/`maxSize` lets users shrink panels below readable widths. Always set pixel constraints that keep content readable (e.g., sidebar min 120px, article list min 180px).
- **Relying on `truncate` alone in ScrollArea sidebars** — long text can still expand the Radix internal wrapper or the flex row. Use `[&>div]:!block` on the shared ScrollArea viewport plus `w-full min-w-0 overflow-hidden` on rows and `min-w-0 flex-1 truncate` on text.
- **"Fixing" macOS overlay scrollbar layout differences** — macOS uses overlay scrollbars by default (no layout space). Custom `::-webkit-scrollbar` CSS forces Chrome into classic mode, which reserves a 6px layout gutter. This is expected behavior, not a bug. Do not remove custom scrollbar CSS or replace `<ScrollArea>` with native `overflow-y-auto` to "fix" this. (See: PR #16/#18 revert)
- **Using `position: sticky` inside plain `Virtuoso`** — plain `Virtuoso` wraps each item in an element with `position: absolute` + computed `top`, so CSS `position: sticky` on child content silently fails. For sticky group headers, use `GroupedVirtuoso` which applies sticky on its group wrapper element automatically.
- **Hardcoded Tailwind color classes for text/background** — classes like `text-green-600`, `bg-white`, `text-gray-500` use fixed hues that don't respond to dark mode. Always use semantic classes (`text-primary`, `text-muted-foreground`, `bg-background`, `bg-muted`, etc.) which map to CSS variables that flip in `.dark`.
- **Applying `animate-in` to all items in a list unconditionally** — `tailwindcss-animate`'s `animate-in` triggers on every DOM mount. When applied inside a `.map()` for all messages, historical messages also animate when the component mounts or a conversation is switched. This creates a distracting cascade effect. Only apply entrance animations to newly appended items (e.g., track the last rendered message count or use an `isNew` flag).

---

## Patterns

### External Image with onerror Fallback

When rendering external image URLs (favicons, avatars, etc.) that may be broken or slow:

```tsx
interface FeedIconProps {
  iconUrl: string | null;
  className?: string;
}

export function FeedIcon({ iconUrl, className }: FeedIconProps) {
  const [failed, setFailed] = useState(false);

  if (iconUrl && !failed) {
    return (
      <img
        src={iconUrl}
        alt=""
        className={cn("shrink-0 rounded-sm object-contain", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return <Rss className={cn("shrink-0 text-muted-foreground", className)} />;
}
```

**Why**: External URLs can 404 or be blocked by CORS. The `useState` + `onError` pattern switches to a fallback icon once, without repeated re-renders. The `className` prop allows different sizing contexts (sidebar vs article list).

### Virtuoso IntersectionObserver Pattern for Scroll Detection

When using `react-virtuoso` for scroll-triggered logic (e.g., mark-as-read on scroll), use `IntersectionObserver` instead of `rangeChanged` for accurate viewport boundary detection.

**Why**: `rangeChanged` is index-based — an article with only 1px visible in the viewport still counts as "in range". `IntersectionObserver` with the correct scroller root, `threshold`, and `rootMargin` only when needed provides pixel-accurate control over when items are considered "scrolled past".

#### Core Pattern

1. **Component-owned observer** via `useRef` — created when Virtuoso's scroll container is available (`scrollerRef`)
2. **Virtuoso `context` registration** — pass `registerElement` / `unregisterElement` into the custom `components.Item`; do not use a module-level observer holder
3. **Mounted element set** — keep mounted item elements in a ref-backed set and observe all of them when the observer becomes available, so rows rendered before observer creation are not missed
4. **Stable callback via refs** — `handleIntersection` uses refs (`scrollMarkReadRef`, unread IDs, `flushPendingIdsRef`) instead of direct dependencies, preventing observer recreation churn
5. **Custom Item component** — register on mount, unregister on unmount, article ID via `data-article-id` DOM attribute (not closure)
6. **Scroll direction guard** — only queue read marks during recent downward user scrolling

```tsx
interface ArticleListVirtuosoContext {
  registerArticleElement: (element: HTMLDivElement) => void;
  unregisterArticleElement: (element: HTMLDivElement) => void;
}

function ObservableItem({
  children,
  item,
  context,
  ...props
}: ItemProps<Article> & ContextProp<ArticleListVirtuosoContext>) {
  const prevElRef = useRef<HTMLDivElement | null>(null);

  // Stable ref callback — article ID read from data-article-id on the DOM element,
  // not from the item prop, to avoid unobserve/reobserve churn on data updates (e.g. is_read toggle)
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (prevElRef.current && prevElRef.current !== el) {
      context.unregisterArticleElement(prevElRef.current);
    }
    if (el) {
      context.registerArticleElement(el);
    }
    prevElRef.current = el;
  }, [context]);

  return (
    <div {...props} ref={ref} data-article-id={item.id}>
      {children}
    </div>
  );
}

// In ArticleList:
const scrollMarkReadRef = useRef(scrollMarkRead);
const unreadArticleIdsRef = useRef(unreadArticleIds);
const observedElementsRef = useRef<Set<HTMLDivElement>>(new Set());
const scrollDirectionRef = useRef<"down" | "up" | null>(null);
scrollMarkReadRef.current = scrollMarkRead;
unreadArticleIdsRef.current = unreadArticleIds;

const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
  if (!scrollMarkReadRef.current) return;
  if (scrollDirectionRef.current !== "down") return;
  for (const entry of entries) {
    if (entry.isIntersecting) continue; // Still visible
    if (!entry.rootBounds) continue;
    if (entry.boundingClientRect.bottom > entry.rootBounds.top) continue; // Not fully above top
    if (!(entry.target instanceof HTMLElement)) continue;
    const articleId = entry.target.dataset.articleId;
    if (!articleId) continue;
    if (unreadArticleIdsRef.current.has(articleId)) {
      pendingIdsRef.current.add(articleId);
    }
  }
  // ... debounce + flush
}, []);

const registerArticleElement = useCallback((element: HTMLDivElement) => {
  observedElementsRef.current.add(element);
  observerRef.current?.observe(element);
}, []);

const unregisterArticleElement = useCallback((element: HTMLDivElement) => {
  observedElementsRef.current.delete(element);
  observerRef.current?.unobserve(element);
}, []);

useEffect(() => {
  if (!scrollerElement) return;
  observerRef.current?.disconnect();
  observerRef.current = new IntersectionObserver(handleIntersection, {
    root: scrollerElement,
    threshold: 0,
  });
  for (const element of observedElementsRef.current) {
    observerRef.current.observe(element);
  }
  return () => { observerRef.current?.disconnect(); observerRef.current = null; };
}, [handleIntersection, scrollerElement]);
```

#### Key Rules

1. **Ref-based stable callback**: `handleIntersection` should be stable — use refs for values that change (`scrollMarkReadRef`, unread IDs, `flushPendingIdsRef`). If the callback depends on frequently changing values, `useEffect` recreates the observer, calling `disconnect()` which drops observed elements unless you re-observe the mounted element set.

2. **`data-article-id` on DOM, not in closure**: The ref callback in `ObservableItem` must not depend on `item`. Set the article ID via `data-article-id={item.id}` on the JSX element and read it from `entry.target.dataset.articleId` in the observer callback. Putting `item` in the ref callback's deps causes unobserve/reobserve churn on every data update (e.g., `is_read` toggling).

3. **`rootMargin` only for overlaying headers**: Do not blindly use `-44px`. If the toolbar/header is outside the Virtuoso scroller, the scroller root already starts below it and `rootMargin` should be omitted. Use a negative top margin only when a fixed/sticky header overlays the scroller's visible content.

4. **Scroll direction guard**: Only mark as read when recent user scroll direction is downward, `boundingClientRect.bottom <= rootBounds.top` (article fully left above the scroller), and `isIntersecting` is `false`. This prevents marking on upward scroll, mount, resize, or data replacement.

5. **`scrollerRef` not `scrollRef`**: Virtuoso's `scrollerRef` returns the actual scrolling container element (needed as the observer's `root`). It may return a `Window` object in some Virtuoso configurations — guard with `'nodeType' in ref` check.

6. **Footer spacer for last items**: The IntersectionObserver only marks items read when they scroll out **above** the viewport. Without extra scroll space at the bottom, the last items can never scroll high enough to exit the top. Always render a spacer div in `Virtuoso`'s `Footer` component with `height: calc(100vh - <header-height>px)` so the last items can scroll past the viewport. The spacer must render even when the loading skeleton is not showing — a `null` footer means no bottom scroll room.

```tsx
// Footer component — spacer is always present, loading skeleton is conditional
function ArticleListFooter({ isLoadingMore }: { isLoadingMore: boolean }) {
  return (
    <>
      {isLoadingMore && (
        <div className="space-y-2 p-3">
          {/* skeleton items */}
        </div>
      )}
      <div style={{ height: 'calc(100vh - 44px)' }} />
    </>
  );
}
```

**Why**: The footer spacer gives roughly one viewport of scroll room. Without this spacer, the last N articles (whose combined height < viewport height) can never be marked as read by scrolling.

### Virtuoso Component Reuse State Leak

When using `react-virtuoso`, component instances are **reused** when scrolling — the same `ArticleRow` instance may render item A, then item B. Any `useState` tracking per-item state (e.g., image load failure) will **persist across items** unless explicitly reset.

```tsx
// Wrong: imageFailed stays true when Virtuoso reuses this instance for a different article
const [imageFailed, setImageFailed] = useState(false);

// Correct: reset per-item state when the item identity changes
const [imageFailed, setImageFailed] = useState(false);
useEffect(() => {
  setImageFailed(false);
}, [article.id]);
```

**Why**: Virtualized lists recycle DOM and React component instances for performance. Without the `useEffect` reset, a failed image on article A causes article B (rendered by the same instance) to also hide its thumbnail.

---

### Dual-Trigger Context Menu on List Items

When list items need a context menu, provide both right-click (`ContextMenu`) and a visible button (`DropdownMenu`) so touch-screen and power users each have an entry point:

```tsx
<ContextMenu>
  <ContextMenuTrigger asChild>
    <div className="group ..." onClick={() => selectFeed(feed.id)}>
      {/* item content */}

      {/* Visible three-dot button (appears on hover) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
            onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* same menu items */}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </ContextMenuTrigger>
  <ContextMenuContent>
    {/* same menu items as DropdownMenu */}
  </ContextMenuContent>
</ContextMenu>
```

**Why**: `ContextMenuTrigger asChild` makes the existing `<div>` the trigger without adding extra DOM nodes. React `onClick` only fires on left-click, so right-click opens the context menu without also selecting the item. The `key` prop must be on the outermost `<ContextMenu>` (the list root element), not on inner children.

### Line-Through Label (Section Separator)

For section headers in scrollable lists (e.g., date group headers in article lists), use the Slack-style line-through label: centered text flanked by two horizontal lines.

When using `react-virtuoso`, **must use `GroupedVirtuoso`** (not plain `Virtuoso`) for sticky headers to work — see gotcha below.

```tsx
// In GroupedVirtuoso groupContent callback
<GroupedVirtuoso
  groupCounts={grouped.map(g => g.articles.length)}
  groupContent={(groupIndex) => {
    const group = grouped[groupIndex];
    if (!group) return null;
    return (
      <div className="flex items-center gap-4 bg-background px-3 py-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm font-semibold text-secondary-foreground whitespace-nowrap">
          {group.label}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }}
  itemContent={(index, groupIndex) => {
    const article = grouped[groupIndex]?.articles[index];
    // render article row...
  }}
/>
```

**Key details**:
- `flex items-center gap-4` — horizontal layout with 16px gap between lines and text
- Two `h-px flex-1 bg-border` divs — 1px lines that grow to fill available space
- `whitespace-nowrap` on text — prevents label wrapping in narrow panels
- `bg-background` — opaque background hides content behind the pinned header
- `px-3` symmetric padding matches article row left-alignment
- **No manual `sticky top-0 z-10`** — `GroupedVirtuoso` applies `position: sticky` on the group wrapper element automatically

> **Gotcha**: Do NOT add `sticky top-0` CSS to header content inside `GroupedVirtuoso.groupContent`. The sticky behavior comes from the wrapper element that Virtuoso creates, not from CSS on the inner content. Adding it has no effect (and in plain `Virtuoso`, it silently fails because Virtuoso uses `position: absolute` on item wrappers, which prevents `position: sticky` from working on children).

### Auto-Trigger Mutation with Dedup Guard

When a mutation should fire automatically on data load (e.g., auto-summarize when opening an article), use a `useRef` guard to prevent re-triggering:

```tsx
const triggeredRef = useRef<string | null>(null);

useEffect(() => {
  if (!article || !autoSummarize || article.summary) return;
  if (mutation.isPending) return;
  if (triggeredRef.current === article.id) return;
  // Additional precondition checks (e.g., AI config ready)
  const ready = aiConfig?.base_url && aiConfig?.has_api_key && aiConfig?.model;
  if (!ready) return;
  triggeredRef.current = article.id;
  mutation.mutate(article.id);
}, [article, autoSummarize, aiConfig, mutation]);

// Reset guard when target entity changes
useEffect(() => {
  triggeredRef.current = null;
}, [selectedArticleId]);
```

**Why**: React effects can re-fire due to dependency changes. Without the `useRef` guard, switching tabs or config changes could trigger duplicate API calls. The guard records which entity was already triggered, and the separate reset effect clears it on entity change so a different entity can still trigger.

**Key rules**:
- Check `mutation.isPending` before mutating — prevents concurrent calls
- Use `useRef` (not `useState`) for the guard — avoids causing re-renders that re-trigger the effect
- Reset the ref in a separate `useEffect` keyed on the entity identifier
- **On mutation error, reset the guard ref and show user feedback** — otherwise a failed mutation blocks retries for the same entity, and the user has no idea what happened:

```tsx
const autoTranslateTriggeredRef = useRef<string | null>(null);

useEffect(() => {
  if (!article || !feed?.auto_translate || article.translated_content) return;
  if (translateMut.isPending) return;
  if (autoTranslateTriggeredRef.current === article.id) return;
  autoTranslateTriggeredRef.current = article.id;
  translateMut.mutate({ articleId: article.id, targetLang: effectiveLang });
}, [article, feed, translateMut]);

// Reset on failure so the user can retry (e.g., fix API key and reopen)
useEffect(() => {
  if (translateMut.isError && autoTranslateTriggeredRef.current === selectedArticleId) {
    autoTranslateTriggeredRef.current = null;
  }
}, [translateMut.isError]);
```

- Silently skip (return early) when preconditions aren't met — don't show errors for expected states
- **Do show errors (toast) when an auto-triggered mutation fails** — auto-triggered means the user didn't click, so they need explicit feedback

### Placeholder UI with Same Container Style

When showing a loading state for content that will appear in a styled container, use the **exact same container** with placeholder content instead of a generic skeleton:

```tsx
// Loading placeholder — same container as the result
{isLoading && !data && (
  <div className="mb-4 rounded-md border bg-muted/50 p-4">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="h-3.5 w-3.5 animate-spin" />
      {t("generatingLabel")}
    </div>
  </div>
)}

// Result — same container
{data && (
  <div className="mb-4 rounded-md border bg-muted/50 p-4">
    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {t("resultLabel")}
    </div>
    <p className="text-sm whitespace-pre-wrap">{data}</p>
  </div>
)}
```

**Why**: Using the same container class ensures no layout shift when loading transitions to loaded. The user sees the summary box appear once and then fill in, rather than seeing a skeleton disappear and a differently-styled box appear.

The theme toggle cycles through `light → dark → system` using `next-themes`:

```tsx
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const THEME_CYCLE = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function cycle_theme() {
    const current = theme ?? "system";
    const currentIdx = THEME_CYCLE.indexOf(current as typeof THEME_CYCLE[number]);
    const nextIdx = (currentIdx + 1) % THEME_CYCLE.length;
    setTheme(THEME_CYCLE[nextIdx] ?? "system");
  }

  if (!mounted) {
    return <Button variant="ghost" size="icon" className="h-7 w-7" disabled><Sun className="h-4 w-4" /></Button>;
  }

  const icon = theme === "dark" ? <Moon className="h-4 w-4" />
    : theme === "light" ? <Sun className="h-4 w-4" />
    : <Monitor className="h-4 w-4" />;

  const label = theme === "dark" ? "Dark mode"
    : theme === "light" ? "Light mode"
    : "System theme";

  return <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cycle_theme} title={label}>{icon}</Button>;
}
```

**Key details**:
- `mounted` guard is mandatory — `useTheme()` returns `undefined` before mount; rendering icon based on `theme` before mount causes hydration mismatch
- Disabled placeholder before mount prevents layout shift
- `title` attribute on icon-only button (accessibility convention)
- Icons: Sun (light), Moon (dark), Monitor (system) — standard convention
- Labels should use i18n (`useTranslation("reader")` with keys `lightMode`/`darkMode`/`systemTheme`)

### Markdown Content Rendering

For rendering markdown text (AI summaries, chat messages, etc.), use the shared `MarkdownContent` component:

```tsx
import { MarkdownContent } from "@/components/MarkdownContent";

<MarkdownContent content={article.summary} />
<MarkdownContent content={msg.content} className="prose-xs" />
```

**Implementation**: `marked` parses markdown → DOMPurify sanitizes HTML → `dangerouslySetInnerHTML` renders in prose container. `useMemo` caches the parse result.

**Why marked (not react-markdown)**: Zero dependencies (1 package vs 85), consistent with the project's existing HTML rendering pattern (DOMPurify + prose + dangerouslySetInnerHTML for article content), and lighter for the small text volumes in summaries/chat.

**Key details**:
- `marked` v18+ includes TypeScript types — do NOT install `@types/marked` (it's for v4/v5)
- Always sanitize with DOMPurify before rendering — marked does not sanitize HTML by default
- Use `prose prose-sm` for small text areas (summaries, chat); use `prose` without size modifier for article-sized content
- The component returns `null` for empty/falsy content — callers need not guard

> **Gotcha**: `marked.parse()` returns `string | Promise<string>`. For synchronous usage, cast with `as string` or configure `marked.use({ async: false })`.

---

### Vite SPA Dark Mode FOUC Prevention

`next-themes` auto-injects a FOUC prevention script only for Next.js SSR. In Vite SPA, add an inline script in `index.html` before `<div id="root">`:

```html
<script>
  (function() {
    var stored = localStorage.getItem('theme');
    var theme = stored || 'system';
    var dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  })()
</script>
```

**Why**: Without this script, the page renders with light CSS variables first, then flashes to dark when next-themes applies the `.dark` class after React mounts. The inline script reads the same `localStorage` key (`"theme"`) that next-themes uses and applies the class synchronously before first paint.

### ChatGPT-Style Message Alignment

Chat messages use asymmetric alignment: user messages right-aligned with colored background, AI messages left-aligned without background:

```tsx
// User message — right-aligned pill, no avatar
<div className="flex justify-end">
  <div className="max-w-[85%] rounded-2xl bg-chat-user px-3 py-2 text-sm">
    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
  </div>
</div>

// AI message — left-aligned, avatar, no background bubble
<div className="flex gap-2.5">
  <AssistantAvatar />
  <div className="min-w-0 flex-1 text-sm">
    <MarkdownContent content={msg.content} />
  </div>
</div>
```

**Key details**:
- User messages: `justify-end` + `max-w-[85%]` + `rounded-2xl bg-chat-user` pill
- AI messages: `AssistantAvatar` on left + `flex-1`, no background bubble — `MarkdownContent` renders directly with `prose` styling
- `--chat-bubble-user` opacity is higher than typical panel backgrounds (0.12 light, 0.18 dark) because the rounded pill has less visual area than a full-width bubble
- `--chat-bubble-ai` is unused as background (AI has no bubble); it may be repurposed or removed later
- Edit mode for user messages must also be right-aligned to match the layout

### Chat Typing Indicator (Bouncing Dots)

The typing indicator uses 3 staggered bouncing dots instead of a blinking cursor:

```tsx
function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-foreground/50"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
```

CSS keyframe in `index.css`:

```css
@keyframes chat-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}
.chat-typing-dot {
  animation: chat-bounce 1.4s ease-in-out infinite;
}
```

**Key details**:
- Staggered `animationDelay` (0ms, 150ms, 300ms) creates a wave effect
- `bg-foreground/50` ensures visibility in both light and dark modes
- The `chat-typing-dot` class is defined in `index.css`, not as a Tailwind utility

### Chat Message Hover Actions

For inline actions that appear on message hover (copy, regenerate, etc.), use a group-hover pattern with `opacity-0 group-hover:opacity-100` transition:

```tsx
<div className="group relative">
  {/* Message content */}
  <div className="...">
    <MarkdownContent content={msg.content} />
  </div>
  {/* Hover actions — absolutely positioned */}
  <div className="absolute -top-3 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
    <Button variant="ghost" size="icon" className="h-6 w-6" title={t("copyMessage")} onClick={handleCopy}>
      <Copy className="h-3 w-3" />
    </Button>
  </div>
</div>
```

**Key details**:
- `group` on the outer container, `group-hover:opacity-100` on the action bar
- `transition-opacity` for smooth fade-in
- Always include `title` attribute on icon-only buttons (accessibility)
- For copy feedback: track `copied` state with `setTimeout`, clean up on unmount via `useRef`

### Chat Regenerate Pattern

Regenerate (re-send last user message) is a client-only operation — no new API endpoint needed:

```tsx
function handleRegenerate(assistantMsgId: string) {
  if (isStreaming) return;
  const assistantIdx = messages.findIndex(m => m.id === assistantMsgId);
  if (assistantIdx <= 0) return;
  const prevUserMsg = messages[assistantIdx - 1];
  if (prevUserMsg?.role !== "user") return;
  // Remove the assistant message from local state
  const updated = messages.filter(m => m.id !== assistantMsgId);
  setMessages(updated);
  // Re-send the previous user message via streamChat
  // (same flow as a normal send, minus adding a new user message)
}
```

**Why**: Regenerate simply trims the last assistant response and re-triggers the SSE stream with the same user input. This avoids backend changes and keeps the chat history consistent — the server's last message gets overwritten on the next sync.

**Gotcha**: Always guard with `if (isStreaming) return` even if the UI already hides the button during streaming — prevents race conditions from rapid clicks or programmatic triggers.

### Conversation Popover

The conversation list is rendered inside a Radix Popover (anchored to a History button in the AIChatPanel header), not as a fixed sidebar panel:

```tsx
<Popover open={convoPopoverOpen} onOpenChange={setConvoPopoverOpen}>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon" className="h-7 w-7">
      <History className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent side="left" align="start" className="w-80 p-0">
    <ConversationListPopover onSelect={() => setConvoPopoverOpen(false)} />
  </PopoverContent>
</Popover>
```

**Key details**:
- Must use **controlled mode** (`open` + `onOpenChange`) — uncontrolled Radix Popover does NOT close when a selection is made inside it, only on click-outside/Escape. Pass an `onSelect` callback to close the popover programmatically on conversation select or create.
- `side="left"` anchors the popover towards the article detail area
- `w-80` (320px) matches the old sidebar default width
- `ConversationListPopover` component contains search input + ScrollArea list, no standalone wrapper div
- `border-l-2 border-primary` + `bg-conversation-selected` for active conversation (same as before)
- `truncate` + `min-w-0 flex-1` for long titles
- Group hover pattern for action buttons (`opacity-0 group-hover:opacity-100`)
- Semantic CSS variables: `--conversation-bg`, `--conversation-hover`, `--conversation-selected` (light + dark variants)
- In-place rename: replace title text with an `<input>`, save on Enter/blur, cancel on Escape

> **Gotcha**: Radix Popover in uncontrolled mode (no `open` prop) will NOT close when internal content triggers a state change (e.g., clicking a list item). If you need the popover to close on selection, use controlled mode with `open`/`onOpenChange` and an explicit close callback.

### Image Upload & Paste in Chat Input

The chat input supports three image attachment methods: paste, file picker, and drag-and-drop. Image previews shown above the input area as removable thumbnails:

```tsx
const [pendingImages, setPendingImages] = useState<File[]>([]);

// Paste handler
const handlePaste = useCallback((e: React.ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  const imageFiles: File[] = [];
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) imageFiles.push(file);
    }
  }
  if (imageFiles.length) setPendingImages((prev) => [...prev, ...imageFiles]);
}, []);

// Drag-and-drop
const handleDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  const imageFiles = [...e.dataTransfer.files].filter((f) =>
    f.type.startsWith("image/")
  );
  if (imageFiles.length) setPendingImages((prev) => [...prev, ...imageFiles]);
}, []);

// Image preview with Blob URL memory management
function ImagePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);
  return (
    <div className="group relative">
      <img src={objectUrl} alt={file.name}
        className="h-16 w-16 rounded object-cover"
        onLoad={() => URL.revokeObjectURL(objectUrl)}  // Prevent memory leak
      />
      <button onClick={onRemove} className="absolute -top-1 -right-1 ...">x</button>
    </div>
  );
}
```

**Key details**:
- Blob URLs created via `URL.createObjectURL` must be revoked on image load (`onLoad` callback) to prevent memory leaks
- File picker via hidden `<input type="file" accept="image/*">` triggered by attachment button click
- On send: convert images to base64 via `FileReader` → `FileReader.readAsDataURL(file)` → include in API request body as `images` array
- Accepted types: JPEG, PNG, GIF, WebP. Max 10MB per image (backend validates).

### Article Reference Tags

Referenced articles displayed as removable tags above the chat input. Auto-referenced current article distinguished with a "当前" badge:

```tsx
{references?.map((ref) => (
  <Badge key={ref.id} variant="secondary" className="gap-1">
    <FileText className="h-3 w-3" />
    <span className="max-w-[120px] truncate">{ref.article_title}</span>
    {ref.is_auto && (
      <span className="text-xs text-muted-foreground">({t("currentArticle")})</span>
    )}
    <button onClick={() => removeReference({ conversationId, referenceId: ref.id })}>
      <X className="h-3 w-3" />
    </button>
  </Badge>
))}
{references?.length === 0 && (
  <Button variant="ghost" size="sm" onClick={openArticleSearch}>
    <BookOpen className="mr-1 h-3 w-3" />{t("addReference")}
  </Button>
)}
```

**Key details**:
- Auto and manual references are equivalent in LLM context — `is_auto` is UI-only metadata
- All references can be removed by the user, including auto-referenced ones
- "Add reference" button opens a search/popover to find and add articles

### Message Image Rendering

Chat messages with image attachments render images inline:

```tsx
function MessageAttachments({ attachments }: { attachments: ImageAttachment[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((att, i) => (
        <img
          key={i}
          src={att.url.startsWith("/") ? `${API_BASE}${att.url}` : att.url}
          alt={att.filename}
          className="max-h-64 max-w-full rounded cursor-pointer"
          onClick={() => window.open(imgSrc, "_blank")}
        />
      ))}
    </div>
  );
}
```

**Key details**:
- Relative server paths (e.g., `/api/ai/images/xxx`) must be prefixed with `API_BASE` since frontend and backend run on different ports in development
- Blob URLs and data URLs are used as-is (already fully qualified)
- Click to open in new tab for full-size viewing
