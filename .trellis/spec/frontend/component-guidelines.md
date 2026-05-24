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
- shadcn/ui components for primitives (Button, Badge, DropdownMenu, etc.)
- Class merging: `cn()` from `src/lib/utils.ts` (combines `clsx` + `tailwind-merge`)
- shadcn/ui primitives use `class-variance-authority` (cva) for variant styling

### Layout Convention: Three-Panel Resizable Layout

The main reader layout uses `react-resizable-panels` v4 (Group/Panel/Separator) with pixel-based width constraints.

**Why fixed widths**: Unconstrained resizable panels let users shrink panels below readable widths. Pixel constraints (`minSize`/`maxSize`) prevent this while still allowing layout customization.

```
Group (orientation="horizontal")
  ├── Panel#sidebar:        minSize=120, maxSize=280, defaultSize=192, collapsible, collapsedSize=40
  ├── Separator
  ├── Panel#article-list:   minSize=180, maxSize=400, defaultSize=280
  ├── Separator
  └── Panel#article-detail: (flexible, takes remaining space)
```

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

### Virtuoso Scroll-Based Detection Pattern

When using `react-virtuoso`'s `rangeChanged` callback for scroll-triggered logic (e.g., mark-as-read on scroll):

### Scroll Direction Gotcha

In Virtuoso, `startIndex` increasing means the user scrolled **down** (older items entering viewport from the top). This is counter-intuitive — you might expect "scrolling down" to show items lower in the list with decreasing indices.

```tsx
// Correct: startIndex increased → user scrolled down → older items scrolled past
if (range.startIndex > prevRange.startIndex) {
  // Items between prevRange.startIndex and range.startIndex have left the viewport top
}
```

### Required Guards

1. **isStable flag**: Virtuoso fires `rangeChanged` on mount and resize. Track a stability flag that becomes true only after the first user-driven scroll:
   ```tsx
   const isStableRef = useRef(false);
   // Set to true only on the second rangeChanged call (first is initialization)
   ```

2. **Debounce cleanup**: Always clean up debounce timers on unmount:
   ```tsx
   useEffect(() => {
     return () => {
       if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
     };
   }, []);
   ```

3. **Ref reset on data change**: When the underlying list changes (feed/filter switch), reset `prevRangeRef` and `isStableRef` — stale refs cause false scroll-direction detection:
   ```tsx
   useEffect(() => {
     prevRangeRef.current = null;
     isStableRef.current = false;
   }, [selectedFeedId, articleListFilter]);
   ```

4. **Map absolute indices in GroupedVirtuoso**: `GroupedVirtuoso`'s `rangeChanged` reports absolute indices that include group headers. For example, with `groupCounts=[3,2,4]`, index 0 is Group 0's header, index 1 is the first article. When iterating scrolled-past items, map the absolute index back to the article (skip header indices):
   ```tsx
   function getArticleByAbsoluteIndex(absoluteIndex: number): Article | undefined {
     let pos = absoluteIndex;
     for (const group of grouped) {
       if (pos === 0) return undefined; // this is a group header
       pos -= 1; // skip the header
       if (pos < group.articles.length) {
         return group.articles[pos];
       }
       pos -= group.articles.length;
     }
     return undefined;
   }
   ```

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
