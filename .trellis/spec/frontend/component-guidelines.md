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

### Color Scheme Presets

Brand color is switchable between `indigo` / `amber` / `forest` presets. Each preset overrides only the brand-related CSS variables (`--primary`, `--ring`, `--chat-bubble-user`, `--prose-link`, `--prose-blockquote-border`); the grayscale base tokens stay inherited from `:root` / `.dark`.

```css
/* index.css — OUTSIDE @layer base */
.theme-indigo  { --primary: 239 84% 58%; --ring: 239 84% 58%; /* ... */ }
.dark.theme-indigo { --primary: 240 68% 65%; /* ... */ }
.theme-amber  { --primary: 28 90% 51%;  /* ... */ }
.theme-forest { --primary: 152 56% 36%; /* ... */ }
```

```ts
// hooks/useColorScheme.ts
function applySchemeClass(scheme: ColorScheme) {
  const root = document.documentElement;
  root.classList.remove(...COLOR_SCHEMES.map((s) => `theme-${s.value}`));
  root.classList.add(`theme-${scheme}`);
}
```

**Why outside `@layer base`**: the `.theme-*` selectors set CSS variables only — they have no utility classes referencing them at build time, so Tailwind's tree-shaker drops them if they sit inside `@layer base`. Placing them as plain top-level rules (the `index.css` comment says so explicitly) keeps them in the build. Each preset also needs a `.dark.theme-*` companion for dark mode.

**Key rules**:
- Persist the choice via `useColorScheme` → `localStorage` key `feedlyra-color-scheme` (declared in `lib/colorScheme.ts`). This is NOT part of Zustand — it is read/applied as a side effect, not as store state.
- Apply the `.theme-*` class on `<html>` (`document.documentElement`) so it composes with next-themes' `.dark` class (`<html class="dark theme-amber">`).
- Toggleable brand variables must each have a `.dark.theme-*` override, or dark mode silently falls back to the light preset hue.
- The presets list and storage key live in `lib/colorScheme.ts` (`COLOR_SCHEMES`, `COLOR_SCHEME_STORAGE_KEY`, `DEFAULT_COLOR_SCHEME`); UI labels use `labelKey` (e.g., `themeIndigo`) resolved through the `settings` namespace.

### Google Fonts Integration

When adding or changing Google Fonts:

1. Add `<link>` tags in `index.html` with `display=swap`
2. Define `--font-ui` and `--font-heading` CSS variables with full system fallback stack
3. Apply via `body { font-family: var(--font-ui) }` and headings in `index.css`
4. Add `fontFamily` entries in `tailwind.config.ts` for `font-ui` and `font-heading` utilities
5. When a reader font option is removed (e.g., Inter → Onest), ensure the font is also removed from the Google Fonts `<link>` if no longer needed, BUT keep it if any existing user preference could reference it

**Gotcha**: If a reader font option references a Google Font, that font MUST be in the Google Fonts link. Removing the font link breaks the option silently (falls back to system font). When replacing a font option, keep the old Google Fonts entry and add the new one.

### Sidebar Selected State

Selected items in the sidebar (and the conversation list) use **tonal layering only — never a colored side-stripe**. `border-l-2 border-primary` (or any `border-left`/`border-right` > 1px used as an accent) is forbidden by DESIGN.md's Flat-By-Default and Tonal-Layering rules; a left color stripe also makes the reader look like an enterprise admin panel.

```tsx
// Correct: denser background tint + medium weight, no stripe
<div className="rounded-md bg-sidebar-selected font-medium ...">

// Wrong: colored side-stripe as selection indicator
<div className="rounded-r-md border-l-2 border-primary bg-sidebar-selected ...">
```

**Why**: `bg-sidebar-selected` already differs from `hover:bg-sidebar-hover`; pairing it with `font-medium` is enough affordance. If selection needs to feel stronger, deepen the `--sidebar-selected` token by a half-step — do **not** introduce a stripe. Use `rounded-md` (not `rounded-r-md`) since there is no left border to keep flush against the container edge.

**Applies everywhere a selected state lives**: sidebar feed rows, conversation list rows, and any future list with a selected state. Same rule, same vocabulary.

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
  className="prose max-w-none dark:prose-invert [&_p]:mb-[var(--prose-p-spacing,1.25em)]"
  style={proseStyle}
>
```

**Why**: `prose-sm`/`prose`/`prose-lg` are discrete presets with fixed type scales. Inline style overrides are continuous and composable. CSS custom properties (e.g., `--prose-p-spacing`) can be consumed by Tailwind arbitrary variants (`[&_p]:mb-[var(--prose-p-spacing)]`) for elements not directly controllable via inline style.

**Key details**:
- Use `Record<string, string>` type (not `React.CSSProperties`) to avoid type errors on CSS custom properties
- Keep the `prose max-w-none dark:prose-invert` classes — they provide base spacing, color, and link styles. Do NOT add `prose-slate`: the `--tw-prose-*` tokens are fully overridden in `index.css` (see DESIGN.md's Blue-Undertone Rule), so `prose-slate` is dead weight and re-tints toward enterprise slate, which the palette refuses
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
- The AI chat panel supports two modes: **sidebar** (top-level Panel in Group) and **floating** (detached overlay via `createPortal`)
- `chatPanelMode` in Zustand store (`'sidebar' | 'floating'`) controls which mode is active; persisted via `partialize`
- Only renders when `conversationPanelOpen` is true AND `activeConversationId` is non-null
- **Sidebar mode**: renders as a Panel in the main Group (same as before) — when toggled off, the Panel is unmounted entirely, article-detail takes full width
- **Floating mode**: renders via `createPortal` with `position: fixed` — Panel/Separator are omitted from Group so article-detail expands; floating panel is non-modal (underlying content remains interactive)
- The conversation history list is in a Popover (anchored to History button in AIChatPanel header), NOT a separate panel
- Width persisted via `chatPanelWidth` in Zustand (included in `partialize`)
- `onResize` callback on the chat Panel updates `chatPanelWidth` in the store
- Floating panel position/size persisted via `floatingPanelPosition` and `floatingPanelSize` in Zustand (included in `partialize`)
- Mode toggle: PinOff/Pin icon button in AIChatPanel header switches between sidebar and floating
- Settings: "Default Chat Mode" option in GeneralSettingsTab (sidebar/floating)
- All chat open triggers (toolbar button, Shift+C, Command Palette) read `chatPanelMode` from store to respect user's configured default

**Runtime layout-key race**: The conditional `ai-chat` Panel unmount can crash the app mid-session when the Group's internal `ResizeObserver` reads a stale `ai-chat` layout key. Forwarded to its own section below (`Runtime layout-key race on conditional Panel unmount`), where the `key={groupKey}` remount convention is documented.

**Collapse behavior**: When `sidebarCollapsed` is true, the sidebar Panel collapses to 40px via `collapsible` + `collapsedSize={40}`. Controlled by Zustand store (`sidebarCollapsed`), toggled via Shift+S shortcut and Command Palette.

**Persistence**: Layout saved to localStorage via `onLayoutChanged` callback; restored via `defaultLayout` prop on mount.

**Stale layout migration**: When a conditionally rendered Panel is unmounted, `onLayoutChanged` saves a layout without that panel's ID. On next mount, the stale persisted entry (from a previous session) may conflict with `minSize`/`maxSize` constraints, causing the Panel to become undraggable. The `loadLayout()` function must strip stale panel IDs before returning:

```ts
function loadLayout(): Record<string, number> | undefined {
  const layout = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY));
  let migrated = false;
  // Strip IDs of panels that are conditionally rendered or have been removed
  for (const staleId of ["conversation-sidebar", "ai-chat"]) {
    if (layout[staleId]) {
      delete layout[staleId];
      migrated = true;
    }
  }
  if (migrated) localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  return layout;
}
```

**Why**: The stale entry removal in `loadLayout()` is a **mount-time localStorage guard only**. It does NOT prevent the runtime crash that happens *during a session* when a conditionally rendered Panel unmounts (see "Runtime layout-key race" below). Both mechanisms are required; neither alone suffices.

### Runtime layout-key race on conditional Panel unmount

When a conditionally rendered Panel (e.g. `ai-chat`) unmounts mid-session — closing the chat, or switching sidebar→floating mode — the `<Group>`'s internal mutable `layout` object keeps the `ai-chat` key for a short window while only N−1 panels remain registered. `loadLayout()` cannot help here because it only runs on Group mount, not on panel-set transitions inside a session.

**Crash path** (`react-resizable-panels@4.11.1`):
1. `jt({ prevLayout, ... })` recomputes layout on group-size change with `const u = { ...prevLayout }` — it copies ALL keys verbatim, including the just-unmounted `ai-chat`.
2. A `<Group>`-level `ResizeObserver` fires on container-size changes and feeds `jt`'s output into `U`.
3. `U({ layout, panelConstraints })` throws `Invalid ${t.length} panel layout: <pct...>` when layout value count ≠ registered panel count.

The throw propagates to `HomeErrorBoundary` → "Something went wrong". The same path intermittently breaks separator drag-resize. It is intermittent because it only triggers when the `ResizeObserver` fires inside the short inconsistency window after a panel-set change.

**Convention**: When a `<Group>` contains conditionally mounted `<Panel>`s, give it a `key` derived from the panel set, so React tears down the whole Group (and its ResizeObserver + mutable layout) on every transition and re-seeds from `defaultSize`/`defaultLayout`:

```tsx
// In Home.tsx
const showChatPanel = conversationPanelOpen && !!activeConversationId;
const isSidebarMode = chatPanelMode === "sidebar";
// Force react-resizable-panels to re-init its internal layout when the panel
// set changes, so no stale "ai-chat" key survives an unmount.
const groupKey = showChatPanel && isSidebarMode ? "with-chat" : "without-chat";

<Group key={groupKey} orientation="horizontal" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
```

**Why a Group remount wins the race**: it does not try to beat the `ResizeObserver` (an imperative `setLayout()` cleanup would still leave an exposure window). It removes the precondition entirely — the new Group's layout is seeded only from `defaultSize` props and (if key count matches) `defaultLayout`, never from stale runtime keys. Even an immediate `ResizeObserver` callback operates on a fresh layout whose keys exactly match the registered panels.

**Cost (accepted)**: panels sharing the Group remount on chat open/close and sidebar↔floating switch, resetting their scroll position. Content is served from React Query cache so it re-renders quickly, but scroll returns to top. Pure separator drags (no toggle) do NOT change `groupKey`, so no remount — prior behavior and performance preserved.

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
- **Wrapping a single child in a horizontal `flex` without stretching it** — a `flex` row container gives its children `flex: 0 1 auto` by default (`flex-grow: 0`), so a single non-`flex-1`/non-`w-full` child sizes to its content and leaves the container's remaining width blank on the right. This is invisible when the child happens to be full-width (e.g., a `block` header bar above it visually masks the gap), then surfaces later when that sibling is removed. Symptom: a panel with a fixed width renders its body narrower than the panel, with a blank strip on the right. Fix: either drop the pointless `flex` on a single-child wrapper (let it be a plain block container so the `block`-flow child fills the width), or give the child `w-full`/`flex-1`. In `FloatingChatPanel` the content area holds exactly one `AIChatPanel`, so it is `min-h-0 flex-1` block, not `flex min-h-0 flex-1`.
- **"Fixing" macOS overlay scrollbar layout differences** — macOS uses overlay scrollbars by default (no layout space). Custom `::-webkit-scrollbar` CSS forces Chrome into classic mode, which reserves a 6px layout gutter. This is expected behavior, not a bug. Do not remove custom scrollbar CSS or replace `<ScrollArea>` with native `overflow-y-auto` to "fix" this. (See: PR #16/#18 revert)
- **Using `position: sticky` inside plain `Virtuoso`** — plain `Virtuoso` wraps each item in an element with `position: absolute` + computed `top`, so CSS `position: sticky` on child content silently fails. For sticky group headers, use `GroupedVirtuoso` which applies sticky on its group wrapper element automatically.
- **Hardcoded Tailwind color classes for text/background** — classes like `text-green-600`, `bg-white`, `text-gray-500` use fixed hues that don't respond to dark mode. Always use semantic classes (`text-primary`, `text-muted-foreground`, `bg-background`, `bg-muted`, etc.) which map to CSS variables that flip in `.dark`.
- **Applying `animate-in` to all items in a list unconditionally** — `tailwindcss-animate`'s `animate-in` triggers on every DOM mount. When applied inside a `.map()` for all messages, historical messages also animate when the component mounts or a conversation is switched. This creates a distracting cascade effect. Only apply entrance animations to newly appended items (e.g., track the last rendered message count or use an `isNew` flag). See "Chat Message Entrance Animation" pattern for the executable Set-based approach used by `AIChatPanel`.
- **Stale persisted layout entries for conditionally rendered Panels** — `onLayoutChanged` saves layouts without IDs of unmounted Panels. On remount, stale persisted pixel values may violate `minSize`/`maxSize` constraints and make the Panel undraggable. Always strip stale panel IDs in `loadLayout()` so the Panel initializes from its `defaultSize` prop. NOTE: this is the **mount-time/localStorage guard only**; an *in-session* unmount can still trip the Group `ResizeObserver` on a stale runtime key — that requires the `key={groupKey}` remount convention (see "Runtime layout-key race on conditional Panel unmount").
- **Async callbacks updating state after unmount** — Components with async operations (SSE streams, fetch, `setTimeout`) that call `setState` after the component unmounts will cause React errors. Without an ErrorBoundary, this crashes the entire app. Use a `mountedRef` guard in callbacks, and set it `false` before aborting in close handlers.
- **Including derived identity values (e.g., `articlesIdentity`) in cleanup effect deps** — When optimistic updates change item state (e.g., `is_read` toggle), any derived identity value changes too, triggering cleanup effects that clear dedup refs (`submittedIdsRef`) and pending queues. This breaks error rollback (the `onError` callback can no longer remove IDs from a cleared set) and loses pending IDs that haven't been flushed yet. Only include deps that represent true context switches (feed/filter changes), not data mutations within the same context.
- **Tabs / segmented control whose width should NOT track the flex container** — a `<Tabs>` placed in a flex header with `flex-1` plus a `<TabsList>` with `w-full grid-cols-3` makes the triggers expand/contract with the panel width (visible when the panel is drag-resized). To keep the tabs at their content width, drop `flex-1` from `Tabs` AND `w-full` from `TabsList`; `grid-cols-3` alone still equalizes the triggers at `max-content`. Critically, removing `flex-1` also kills the left-to-right push that previously squeezed the right-side action group to the edge — `shrink-0` on the right group only prevents shrinking, it does NOT auto-right-align. Always pair the change with `ml-auto` on the right-side sibling so it sticks to the right edge:

```tsx
// Wrong: tabs track panel width, and right actions float mid-row after fix
<Tabs className="min-w-0 flex-1">
  <TabsList className="grid h-7 w-full grid-cols-3">{/* ... */}</TabsList>
</Tabs>
<div className="flex shrink-0 items-center gap-1">{/* right actions */}</div>

// Correct: tabs fixed width, right actions pinned right via ml-auto
<Tabs className="min-w-0">
  <TabsList className="grid h-7 grid-cols-3">{/* ... */}</TabsList>
</Tabs>
<div className="ml-auto flex shrink-0 items-center gap-1">{/* right actions */}</div>
```

  **Why**: `flex-1` was doing double duty — sizing the tabs to remaining space AND acting as the left-side filler that pushes the right group to the edge. Removing it fixes the width symptom but reintroduces a layout gap on the right unless `ml-auto` (or an equivalent spacer) takes over the push job.

- **Putting `orientation` on `TabsList` instead of `Tabs`** — Radix's `orientation` prop ("horizontal" | "vertical") belongs to `Tabs.Root`, which sets arrow-key navigation direction for the whole tab group. shadcn's `TabsList` type does **not** accept `orientation` (only `loop`); passing it there is silently dropped or type-errors. Put `orientation="vertical"` on `<Tabs>` when the active tab list renders as a vertical column, so Up/Down arrows move focus instead of Left/Right. A single `Tabs.Root` has one `orientation` for all its lists; when the same `<Tabs>` renders both a desktop vertical list and a mobile horizontal list (responsive split-pane), the single orientation cannot be correct for both — accept the trade-off (mobile is touch-primary; shadcn's default list sets no orientation anyway, so behavior is unchanged from default).

---

## Patterns

### Multi-Tab Dialog with Stable Sizing (Split-Pane)

When a `Dialog` hosts multiple tabs whose content widths/heights differ (e.g. `SettingsDialog`), giving `DialogContent` a per-tab `max-w` and `overflow-y-auto` makes the dialog visibly jump in both width and height on every tab switch. Use a split-pane layout so the dialog frame is fixed and only the content area scrolls.

```tsx
<DialogContent className="sm:max-w-3xl max-h-[calc(100vh-4rem)] overflow-y-auto">
  <DialogHeader>...</DialogHeader>
  <Tabs orientation="vertical" className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
    {/* Desktop vertical list */}
    <TabsList className="hidden h-auto w-40 flex-col justify-start gap-1 sm:flex">
      <TabsTrigger value="general" className="justify-start">...</TabsTrigger>
    </TabsList>
    {/* Mobile horizontal fallback */}
    <TabsList className="flex w-full sm:hidden">
      <TabsTrigger value="general" className="flex-1">...</TabsTrigger>
    </TabsList>
    {/* Fixed-height scroll region — NOT the whole DialogContent */}
    <div className="mt-4 sm:mt-0 sm:ml-6 sm:min-w-0 sm:flex-1 sm:max-h-[60vh] sm:overflow-y-auto">
      <TabsContent value="general" className="mt-0">...</TabsContent>
    </div>
  </Tabs>
</DialogContent>
```

**Key rules**:
- `DialogContent` keeps a single fixed `max-w` (`sm:max-w-3xl`) for ALL tabs — never switch `max-w` per active tab. Keep `max-h-[calc(100vh-4rem)] overflow-y-auto` on `DialogContent` as a last-resort viewport guard (mobile body-scroll is locked by Radix Dialog, so the dialog itself must be the fold for very tall content).
- The scrollable region is a wrapper div around `TabsContent`s with `sm:max-h-[60vh] sm:overflow-y-auto`, NOT `DialogContent`. Header stays fixed above it. On mobile (`< sm`), drop `max-h`/`overflow` so the dialog grows naturally and `DialogContent` handles viewport overflow.
- Render two `TabsList`s (desktop `hidden sm:flex flex-col` + mobile `flex w-full sm:hidden`) for correct responsive layout. Radix supports multiple `TabsList` under one `Tabs`; triggers share the active value. `orientation` lives on `Tabs.Root` (see the "orientation on TabsList" gotcha above) and cannot differ per list — accept the single-orientation trade-off.
- Existing per-tab inner scroll containers (e.g. `max-h-[280px]` lists, `ScrollArea max-h-[400px]`) can coexist with the outer `60vh` region: inner = "list fits", outer = "tab content fits dialog". Double scroll is acceptable when they have distinct jobs; don't strip inner `max-h` unless testing shows a bad UX.
- Remove any `transition-[max-width]` — there is no width change to animate.

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

### Virtuoso Range Tracking for Scroll Detection

When scroll-triggered logic must account for every item that leaves a virtualized
`react-virtuoso` list (for example mark-as-read on scroll), use guarded
`rangeChanged` tracking.

**Why**: Virtuoso may unmount rows before asynchronous `IntersectionObserver`
notifications are delivered, so observer-only item-exit detection can silently skip
rows. `rangeChanged` provides the rendered start index and can enumerate every item
crossed by a multi-row jump. It must be guarded because range changes also occur during
initialization, resize, and data replacement.

#### Core Pattern

1. Store the previous rendered `startIndex` in a ref; the first callback only initializes the baseline.
2. Track the actual scroller's direction from `scrollTop`.
3. Track Virtuoso's `isScrolling` event and only process range changes while it is true.
4. Only process a strictly increasing start index during downward scrolling.
5. Enumerate every article index from the previous start (inclusive) to the new start (exclusive).
6. Reset the baseline, direction, pending queue, and dedup state on true context switches such as feed/filter changes.

```tsx
const scrollMarkReadRef = useRef(scrollMarkRead);
const scrollDirectionRef = useRef<"down" | "up" | null>(null);
const isScrollingRef = useRef(false);
const previousRangeStartRef = useRef<number | null>(null);
scrollMarkReadRef.current = scrollMarkRead;

const handleRangeChanged = useCallback(({ startIndex }: { startIndex: number }) => {
  const previousStartIndex = previousRangeStartRef.current;
  previousRangeStartRef.current = startIndex;

  if (previousStartIndex === null) return;
  if (!scrollMarkReadRef.current) return;
  if (!isScrollingRef.current) return;
  if (scrollDirectionRef.current !== "down") return;
  if (startIndex <= previousStartIndex) return;

  for (let index = previousStartIndex; index < startIndex; index += 1) {
    const article = articlesRef.current[index];
    if (article && !article.is_read) {
      pendingIdsRef.current.add(article.id);
    }
  }
  // ... debounce + flush
}, []);

const handleScrollingChange = useCallback((isScrolling: boolean) => {
  isScrollingRef.current = isScrolling;
  if (!isScrolling) {
    scrollDirectionRef.current = null;
  }
}, []);

<Virtuoso
  isScrolling={handleScrollingChange}
  rangeChanged={handleRangeChanged}
  scrollerRef={setScrollerElement}
/>
```

#### Key Rules

1. **Never use an unguarded range callback**: Initialization, resize, and data replacement can all change the rendered range. Require active scrolling, downward direction, and an increasing start index.

2. **Advance the baseline on every callback**: Set `previousRangeStartRef` before returning from guards. This prevents a resize or data replacement from being treated as user-scrolled distance during the next real scroll.

3. **Use refs for changing data**: Keep the callback stable and read the latest article list, preference, direction, and mutation helpers from refs.

4. **No recent-scroll time window**: Virtuoso's `isScrolling` event already scopes callbacks to active scrolling. An additional elapsed-time threshold can miss users who pause to read and then continue.

5. **`scrollerRef` not `scrollRef`**: Virtuoso's `scrollerRef` returns the actual scrolling container used for direction tracking. It may return a `Window`; guard it before reading `scrollTop`.

6. **Footer spacer for last items**: Range tracking only advances when items can leave above the viewport. Always render a spacer div in `Virtuoso`'s `Footer` component with `height: calc(100vh - <header-height>px)` so the last items can scroll past the viewport.

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

### Opening a Dialog/AlertDialog from a ContextMenu/DropdownMenu Item

When a `ContextMenuItem` or `DropdownMenuItem` needs to open another portal/`DismissableLayer`-based overlay (`Dialog` / `AlertDialog`), do NOT use `onClick` + `stopPropagation`. Use Radix's standard `onSelect` callback and defer the target overlay's mount by one frame:

```tsx
<ContextMenuItem
  className="text-destructive"
  onSelect={() => setTimeout(() => setConfirmId(feed.id), 0)}
>
  <Trash2 className="mr-2 h-4 w-4" />
  {t("delete", { ns: "common" })}
</ContextMenuItem>
```

Then render a controlled overlay at the bottom of the component:

```tsx
<Dialog open={confirmId !== null} onOpenChange={(open) => { if (!open) setConfirmId(null); }}>
  <DialogContent>...</DialogContent>
</Dialog>
```

**Why**: `ContextMenu` / `DropdownMenu` / `Dialog` / `AlertDialog` all build on `@radix-ui/react-dismissable-layer`, which records the body's `pointer-events` original value on open and restores it on close (module-level `originalBodyPointerEvents`). When one overlay opens from inside another's item:

- `onClick` fires as a native DOM event and flips Dialog state *before* the menu's own dismiss schedule runs. If two `react-dismissable-layer` instances exist in the tree (a known Radix #3317 hazard), the two DismissableLayer layers clobber each other's saved original value, restore `pointer-events: none`, and the whole page becomes visible but unclickable until reload.
- `onSelect` is the Radix-coordinated callback; `setTimeout(0)` defers the target overlay's mount until *after* the menu's DismissableLayer unmounts, so the new overlay reads a clean body value.

`stopPropagation` does NOT help — the conflict is in DismissableLayer lifecycle ordering, not event bubbling.

**Key rules**:
- This applies symmetrically to `DropdownMenuItem` → `AlertDialog` (e.g. per-row delete in settings) and `ContextMenuItem` → `Dialog` (e.g. sidebar right-click delete).
- `AlertDialogAction` (destructive) should `e.preventDefault()` and call the mutation in the handler; close the dialog manually in the mutation's `onSuccess` — mirrors the bulk-delete pattern on the same page.
- Target overlay must be controlled (`open` + `onOpenChange`), not triggered inline.

**Pre-requisite — single `react-dismissable-layer` instance**: the code-level `onSelect + setTimeout` workaround is necessary but not always sufficient. Even with correct `onSelect`, duplicate `react-dismissable-layer` versions in `node_modules` (one hoisted, one nested under `react-dialog`) can still leave `pointer-events: none` stuck. `frontend/package.json` pins it via npm `overrides`:
```jsonc
"overrides": { "@radix-ui/react-dismissable-layer": "1.1.13" }
```
Verify with `npm explain @radix-ui/react-dismissable-layer` — there must be exactly one instance. If a future Radix bump re-introduces duplicates, re-align via `overrides` before chasing code-level causes.

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
  <div className="max-w-[85%] rounded-lg bg-chat-user px-3 py-2 text-sm">
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
- User messages: `justify-end` + `max-w-[85%]` + `rounded-lg bg-chat-user` pill (DESIGN.md `chat-bubble-user: rounded: {lg}` = 6px)
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

### Chat Message Entrance Animation (only newly appended messages)

Entrance animations (`animate-in fade-in slide-in-from-bottom`) must only play for messages appended **during the current session**, not for history loaded from the server or when switching conversations (which would cascade-animate the whole list on every mount).

Track a `Set` of message ids that are "new" — populate it only at append sites, clear it at history-sync and conversation-reset sites:

```tsx
const [messages, setMessages] = useState<ChatMessage[]>([]);
// ids appended this session — only these animate on mount
const [newIds, setNewIds] = useState<Set<string>>(() => new Set());

// History from server → nothing animates
useEffect(() => {
  if (chatHistory?.messages) {
    setNewIds(new Set());
    setMessages(chatHistory.messages);
  }
}, [chatHistory]);

// Conversation switch → full reset
useEffect(() => {
  setMessages([]);
  setNewIds(new Set());
  // ... other per-conversation resets
}, [conversationId]);

// Every append site records the id as new
function appendUser(text: string) {
  const userMsg = { id: `temp-${Date.now()}`, /* ... */ };
  setMessages((prev) => [...prev, userMsg]);
  setNewIds((prev) => new Set(prev).add(userMsg.id));
}
```

Render with a conditional className so the animation class only attaches to new ids:

```tsx
{messages.map((msg) => (
  <div
    key={msg.id}
    className={cn("duration-300", newIds.has(msg.id) && "animate-in fade-in slide-in-from-bottom-2")}
  >
    <ChatMessageBubble msg={msg} /* ... */ />
  </div>
))}
```

**Why a Set of ids (not "last N")**: supports batch appends, survives re-orders/regenerate (the regenerated assistant gets a fresh id via the stream's `temp-assistant-*`), and naturally re-animates a genuinely new message after an edit-and-resend.

**Streaming updates are safe**: `onChunk` mutates the *content* of the last assistant message via its id, not its identity — React diffs in place and does NOT remount the node, so the CSS animation does not replay on each token.

**Gotcha**: do NOT track "already-rendered" ids in a ref in parallel with the `newIds` state — the state is the single source of truth for rendering. A parallel ref becomes dead code (only written, never read) once the Set-based render condition is in place.

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
- `bg-conversation-selected` + `font-medium` for active conversation (tonal layering; no side-stripe — see "Sidebar Selected State")
- `truncate` + `min-w-0 flex-1` for long titles
- Group hover pattern for action buttons (`opacity-0 group-hover:opacity-100`)
- Semantic CSS variables: `--conversation-bg`, `--conversation-hover`, `--conversation-selected` (light + dark variants)
- In-place rename: replace title text with an `<input>`, save on Enter/blur, cancel on Escape

> **Gotcha**: Radix Popover in uncontrolled mode (no `open` prop) will NOT close when internal content triggers a state change (e.g., clicking a list item). If you need the popover to close on selection, use controlled mode with `open`/`onOpenChange` and an explicit close callback.

### Floating Chat Panel

When `chatPanelMode` is `'floating'`, the chat panel renders as a detached overlay via `createPortal` with `position: fixed`. This allows users to chat while reading articles.

```tsx
// In Home.tsx — conditional rendering based on chatPanelMode
const isSidebarMode = chatPanelMode === "sidebar";

// Sidebar mode: Panel inside Group (existing behavior)
{isSidebarMode && showChatPanel && (
  <>
    <Separator ... />
    <Panel id={CHAT_PANEL_ID} ...>
      <AIChatPanel conversationId={activeConversationId!} />
    </Panel>
  </>
)}

// Floating mode: portal overlay, no Panel in Group
{!isSidebarMode && showChatPanel && (
  <FloatingChatPanel>
    <AIChatPanel conversationId={activeConversationId!} />
  </FloatingChatPanel>
)}
```

**Key details**:
- **Single shared header (no stacked title bars)**: floating mode reuses the `AIChatPanel`'s own header as the drag handle — `FloatingChatPanel` renders NO own title bar. Drag handler props are injected into the child via `React.cloneElement(children, { draggable: true, ...dragProps })`. `AIChatPanelProps extends FloatingChildProps` so it accepts `draggable` + `onHeaderPointerDown/Move/Up`. Sidebar mode omits these props, so the header behaves identically in both modes.
- **Drag handle = the whole header title area**; `cursor-grab` on hover, `active:cursor-grabbing` on press (no persistent grip icon — discoverability via cursor only, macOS-native feel).
- Header's internal buttons (History `PopoverTrigger`, Pin, Close) must add `onPointerDown={(e) => e.stopPropagation()}` so clicking them does not start a drag. `stopPropagation` on `pointerdown` only blocks the drag; `click` still fires normally.
- **Drag-vs-resize conflict on the header-overlapping top edge**: the header occupies the top ~44px, which covers the entire top 6px resize zone. Two guards make header always drag and never resize there: (1) `handleDragPointerDown` calls `e.stopPropagation()` so the container's resize `pointerdown` (attached via bubbling) never fires; (2) `getResizeEdge()` returns `null` when `e.target.closest("[data-floating-drag-handle]")`, so no resize highlight/cursor appears over the header. The header is marked `data-floating-drag-handle` only when `draggable`.
- Resize from all 4 edges and 4 corners via edge detection in `pointerdown` — 6px edge zone triggers resize instead of drag. A `ResizeEdgeOverlay` renders a 1px `bg-primary/30` highlight (→ `opacity-50` while actively resizing) on the hovered edge/corner; `pointer-events-none` so it never blocks edge detection.
- Shadow/border: `rounded-lg border bg-background shadow-lg` base, `focus-within:ring-1 focus-within:ring-primary/10` for focus feedback. Resting ceiling is `shadow-lg` (floating layer); `focus-within:shadow-2xl` is NOT used — the ring alone lifts the panel on focus. Note the global `* { transition-property: color, background-color, border-color, fill, stroke }` in `index.css` does NOT include `box-shadow`/`ring` — add `transition-shadow` explicitly when relying on these transitions.
- Min size: 320×420 (2-col suggestion grid + ≥260px message area after header+reference+input ≈160px). Default size `DEFAULT_FLOATING_SIZE = { width: 420, height: 560 }` (stored in `stores/reader.ts`, not the component). The min-size constants live inside `FloatingChatPanel.tsx` (`MIN_WIDTH`/`MIN_HEIGHT`).
- Position/size persisted via Zustand store (`floatingPanelPosition`, `floatingPanelSize`), included in `partialize`. Changing `DEFAULT_FLOATING_SIZE` only affects users who never customized — persist reads their stored value back; do NOT add a migrate unless forcing an upgrade.
- Window resize listener clamps position back into visible viewport
- Non-modal: no click-outside handler, no overlay backdrop — underlying content remains interactive

**Gotcha**: When switching from sidebar to floating mode (or vice versa), the `Panel` in the `Group` unmounts, and `onLayoutChanged` saves a layout without the `ai-chat` ID. When switching back to sidebar mode, the `loadLayout()` function strips stale entries so the Panel initializes from `defaultSize`. This is already handled by the existing stale layout migration logic.

> **Note**: `loadLayout()` only handles the mount-time/localStorage half of stale keys. The *runtime* half — a stale `ai-chat` layout key surviving an in-session unmount and tripping the Group's `ResizeObserver` → `Invalid N panel layout` crash — is handled by the `key={groupKey}` convention in "Runtime layout-key race on conditional Panel unmount" above. Both are required.

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

### Async Callback Unmount Guard (mountedRef)

Components with async callbacks (SSE streams, fetch, timers) must guard state updates after unmount to prevent React errors and white screens:

```tsx
const mountedRef = useRef(true);

useEffect(() => {
  mountedRef.current = true;
  return () => {
    mountedRef.current = false;
  };
}, []);

// In async callbacks:
const controller = await streamChat({
  onDone: () => {
    if (!mountedRef.current) return;
    setIsStreaming(false);
  },
  onError: (error) => {
    if (!mountedRef.current) return;
    setIsStreaming(false);
    setMessages((prev) => updateLastAssistant(prev, `Error: ${error.message}`));
  },
});

// In close/dismiss handlers, set mountedRef before abort:
const handleClose = () => {
  mountedRef.current = false;
  if (abortRef.current) {
    abortRef.current.abort();
  }
  setReader({ conversationPanelOpen: false });
};
```

**Why**: When a component unmounts (e.g., closing the chat panel), in-flight async operations may still resolve. Calling `setState` on an unmounted component causes a React error. Without an ErrorBoundary, this crashes the entire app (white screen). The `mountedRef` pattern prevents this; setting it `false` in `handleClose` before `abort()` ensures that abort-triggered callbacks also bail out.

### Automation Rule Editor

The rule editor (`RuleEditorDialog.tsx`) builds a rule from local component state, not react-hook-form, because the conditions/actions array shape does not map cleanly to a flat form schema. Pattern:

```tsx
const [conditions, setConditions] = useState<AutomationCondition[]>([emptyCondition()]);
const [actionToggles, setActionToggles] = useState<Record<string, boolean>>({});
const [translateLang, setTranslateLang] = useState("zh");
```

**Key details**:
- Actions are modeled as a **toggle map** (`actionToggles: Record<string, boolean>`) keyed by action type, built up to `AutomationAction[]` only on save. `auto_translate` carries `params: { translate_target_lang }`.
- A rule with `delete` plus any other action raises a conflict (`hasConflict = hasDelete && otherActionsCount > 0`). The backend treats any rule with a `delete` action as a delete-only rule and ignores its other actions (see backend `database-guidelines.md` "Scenario: Automation Rules Engine"). The UI **blocks Save** when `hasConflict` is true (mirrors the `noActionsSelected` disabled-save precedent) and shows a `text-warning` helper text + `AlertTriangle`; the list-row variant shows a `text-warning` hint. This is error prevention, not just a warning — surface the conflict but don't let the user save an ambiguous rule.
- Conditions render as a dynamic list; the first row's logic selector is hidden (backend ignores the first condition's `logic`). `LOGIC_OPTIONS` render as `AND`/`OR` via `opt.toUpperCase()` — these are universal tokens, kept literal, not i18n keys.
- On open, an `useEffect` hydrates local state from `rule` (edit) or resets to defaults (create, honoring `defaultScope`/`defaultScopeId` props).
- Save is disabled when `isPending || !name.trim() || noActionsSelected || hasConflict`; `onSuccess` closes the dialog. The conflict/violation color is the `--warning` semantic token (non-destructive conflict), NOT `destructive` (which is reserved for delete confirmations) or hardcoded amber (which collides with the Amber theme hue). See DESIGN.md "The Warning Rule".

### Automation Rule List

`settings/AutomationTab.tsx` renders rules grouped by scope (global / category / feed). Pattern details:

- Optimistic toggle via `useToggleAutomationRule`, which cancels in-flight queries and patches `enabled` across every cached `queryKeys.automation.all` query (not a single key) — see [[hook-guidelines]].
- Action badges use fixed Tailwind palettes keyed by action type (`ACTION_COLORS: Record<string, string>`). These are decorative categorization chips, not theme-critical text — dark variants are hand-paired (`bg-blue-100 ... dark:bg-blue-900/30`). Do NOT migrate these to semantic variables unless you also handle both modes; the hardcoded pairs are intentional.
- `conditionSummary()` builds a human-readable preview `"field contains value"` joined by AND/OR i18n tokens, truncating `value` past 20 chars.

### Conversation List Popover

`ConversationSidebar.tsx` exports `ConversationListPopover`, rendered inside a controlled Radix Popover (see "Conversation Popover" above). Row pattern details:

- Inline rename: replace the title `<span>` with an `<input>`, focus+select on mount, save on Enter/blur, cancel on Escape. The active/renaming row keeps the same `bg-conversation-selected` tonal treatment (no side-stripe).
- Dual-trigger menu (right-click `ContextMenu` + hover `DropdownMenu` with identical items) — same pattern as the feed sidebar row.
- Delete confirmation uses a local `Dialog` (not `window.confirm`) so it matches the app's dialog styling. `deleteConversation.mutate(id, { onSuccess })` closes both the confirm dialog.
- `formatRelativeTime()` renders `last_message_at` as `now`/`Nm`/`Nh`/`Nd`/locale date.

### Floating Chat Panel Drag & Resize

`FloatingChatPanel.tsx` is a `createPortal` overlay with pointer-event-driven drag + 8-edge resize. Pattern details:

- Drag and resize share the same pointer-capture technique: store start state in a ref (`dragStateRef` / `resizeStateRef`) on `pointerdown`, mutate on `pointermove`, persist to the Zustand store on `pointerup`. Use `setPointerCapture`/`releasePointerCapture` so moves continue outside the element.
- Edge detection in `getResizeEdge()` uses a 6px threshold on `getBoundingClientRect()`; corners win over edges (`top-left` before `top`). It MUST bail out (`return null`) when the pointer target is inside `[data-floating-drag-handle]` — see the "Single shared header" notes in the "Floating Chat Panel" section above, otherwise the top edge resize zone and the drag-handle header overlap and both gestures start at once.
- Min size 320×420. Default size `420×560` (defined as `DEFAULT_FLOATING_SIZE` in `stores/reader.ts`). Position is clamped to the viewport on both drag and window resize.
- Persist only on pointer-up (`persistPosition`/`persistSize`), not on every move — avoid thrashing the store and localStorage.
- Default position computed once on first mount when the stored position is the `{0,0}` sentinel.
