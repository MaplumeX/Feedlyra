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

### Scrollable Areas — Use Native `overflow-y-auto`

All scrollable regions in the app use native browser scrolling via `overflow-y-auto`, not Radix `<ScrollArea>` or custom `::-webkit-scrollbar` CSS.

```tsx
// Scrollable panel content
<div className="flex-1 overflow-y-auto">
  {items.map(...)}
</div>
```

**Why native scrolling**: macOS uses overlay scrollbars by default — they float over content without taking layout space. Both Radix `<ScrollArea>` and custom `::-webkit-scrollbar` CSS force the browser into classic scrollbar mode, which reserves a layout gutter (6–10px). This causes the scrollable content area to be narrower than adjacent fixed-width headers/toolbars, creating visible misalignment.

> **Warning**: Never add `::-webkit-scrollbar { width: ... }` or `scrollbar-width` / `scrollbar-color` rules in global CSS. These properties force Chrome/Electron to switch from overlay to classic scrollbar mode, making the scrollbar occupy layout space.

The `ui/scroll-area.tsx` component file is preserved for potential shadcn component dependencies (e.g., dropdown menus), but should not be used for main scrollable panels.

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
- **Custom scrollbar CSS forcing classic mode** — `::-webkit-scrollbar { width: Npx }` or `scrollbar-width` / `scrollbar-color` in global CSS forces Chrome/Electron from overlay to classic scrollbar mode, reserving layout space and misaligning headers with content. Use native `overflow-y-auto` instead — see "Scrollable Areas" section.
- **Relying on `truncate` alone in fixed-width panels** — long text can still expand flex rows. Use `w-full min-w-0 overflow-hidden` on rows and `min-w-0 flex-1 truncate` on text.

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

4. **Skip header items**: Virtuoso flat lists often mix header rows with data rows. Only process items of the expected `type`:
   ```tsx
   const articlesInRange = flatItems
     .slice(start, end + 1)
     .filter((item) => item.type === "article");
   ```

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
