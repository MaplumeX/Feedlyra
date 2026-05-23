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

### Layout Convention: Three-Panel Fixed Layout

The main reader layout uses a **fixed-width CSS flex** three-panel structure — NOT `react-resizable-panels`.

**Why**: Resizable panels caused the sidebar to render too narrow and the drag handle was unwanted. Fixed widths ensure consistent content display.

```
div.flex.h-full
  ├── Sidebar wrapper:   w-64 (256px), shrink-0, collapsible (sidebarCollapsed state)
  ├── Article list:      w-[360px], shrink-0, border-r border-border
  └── Article detail:    flex-1 min-w-0
```

**Collapse behavior**: When `sidebarCollapsed` is true, the sidebar wrapper shrinks to 40px and shows a `PanelLeft` icon button to re-expand. Controlled by Zustand store (`sidebarCollapsed`), toggled via Shift+S shortcut and Command Palette.

> **Warning**: Do not re-introduce `react-resizable-panels` for the sidebar. The resizable pattern is inappropriate when panel content (feed list, article titles) needs a predictable minimum width to remain readable.

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

- **Using resizable panels for fixed-content sidebars** — `react-resizable-panels` lets users shrink panels below readable widths. Use fixed-width CSS flex layout instead.
- **Relying on `truncate` alone in ScrollArea sidebars** — long text can still expand the Radix internal wrapper or the flex row. Use `[&>div]:!block` on the shared ScrollArea viewport plus `w-full min-w-0 overflow-hidden` on rows and `min-w-0 flex-1 truncate` on text.
