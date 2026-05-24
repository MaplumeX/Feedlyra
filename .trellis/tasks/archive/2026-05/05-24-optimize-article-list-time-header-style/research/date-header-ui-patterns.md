# Research: Date Header UI Patterns in Article Lists

- **Query**: How popular RSS readers and content apps design their date group headers / time separators in article lists
- **Scope**: mixed (external design pattern research + internal code review)
- **Date**: 2026-05-24

## Current Implementation (Internal)

### Files Found

| File Path | Description |
|---|---|
| `frontend/src/components/ArticleList.tsx` | Main article list with date group headers (line 274) |

### Current Pattern

The existing implementation uses a **sticky full-width label with bottom border**:

```tsx
<div className="sticky top-0 z-10 bg-background pl-3 pr-0 py-1 text-xs font-medium text-muted-foreground border-b">
  {item.label}
</div>
```

Characteristics:
- `position: sticky; top: 0` - pins to viewport top on scroll
- `z-index: 10` - floats above article rows
- Full background color (`bg-background`) - opaque
- Left-aligned (`pl-3`), small text (`text-xs`), medium weight (`font-medium`)
- Muted color (`text-muted-foreground`)
- Bottom border (`border-b`) acts as a divider line
- No decorative elements (pill, line-through, etc.)

Date grouping logic (lines 19-43):
- "Today" / "Yesterday" for recent dates
- `toLocaleDateString(month: "short", day: "numeric")` for older dates
- FlatItem union type: `{ type: "header"; label: string } | { type: "article"; article: Article }`

---

## External Design Pattern Research

### 1. Slack -- Horizontal Line with Centered Date Label

**Pattern**: Two horizontal lines flanking a centered date text (the classic "divider with text in middle" pattern).

**Implementation from chat-ui-kit-react (chatscope/chat-ui-kit-react)**:

The `MessageSeparator` component uses CSS `::before` and `::after` pseudo-elements to create lines on either side of the text:

```scss
.#{$prefix}-message-separator {
  box-sizing: border-box;
  color: $message-separator-color;
  background-color: $message-separator-bg-color;
  font-size: $message-separator-font-size;  // 0.8em
  font-family: $message-separator-font-family;
  text-align: center;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: space-between;
  align-items: center;

  &::before,
  &::after {
    box-sizing: border-box;
    content: "";
    background-color: $message-separator-color;
    display: block;
    flex-grow: 1;
    height: 1px;
  }

  &:not(:empty)::before {
    margin: 0 1em 0 0;  // right margin on left line
  }

  &:not(:empty)::after {
    margin: 0 0 0 1em;  // left margin on right line
  }
}
```

**Visual Layout Sketch**:
```
──────────── Today ────────────
```

**Key characteristics**:
- Horizontal line on both sides of text (using flex + pseudo-elements)
- Text is centered between the lines
- Font size is smaller (0.8em)
- 1px height lines
- Equal spacing between lines and text (1em)
- No sticky behavior by default (static in message flow)
- Background matches page background

**Source**: [chatscope/chat-ui-kit-styles](https://github.com/chatscope/chat-ui-kit-styles) - `themes/default/components/_message-separator.scss`

---

### 2. Stream Chat (GetStream) -- Floating Pill Badge

**Pattern**: Centered pill/badge with rounded corners, optionally floating (sticky) at top of viewport.

**Implementation from stream-chat-react (GetStream/stream-chat-react)**:

Component (`DateSeparator.tsx`):
```tsx
<div className={clsx(
  'str-chat__date-separator',
  { 'str-chat__date-separator--floating': floating },
)}>
  <div className='str-chat__date-separator-date'>{formattedDate}</div>
</div>
```

Styles (`DateSeparator.scss`):
```scss
// In-flow date separator
.str-chat__date-separator {
  background: transparent;
  color: var(--str-chat__chat-text-system);
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: var(--str-chat__spacing-xs) 0;

  .str-chat__date-separator-date {
    display: flex;
    padding: var(--str-chat__spacing-xxs) var(--str-chat__spacing-sm);
    justify-content: center;
    align-items: center;
    color: var(--str-chat__chat-text-system);
    background-color: var(--str-chat__background-core-surface-subtle);
    border-radius: var(--str-chat__radius-max);  // Fully rounded (pill shape)
    font: var(--str-chat__font-metadata-emphasis);
  }
}

// Floating variant (sticky at top)
.str-chat__date-separator--floating {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
```

**Visual Layout Sketch**:
```
        ┌──────────┐
        │  Today    │   (pill/badge with rounded corners)
        └──────────┘
```

**Floating variant behavior**:
When the user scrolls past the in-flow date separator, a floating version appears at the top of the viewport. The hook (`useFloatingDateSeparator`) tracks which date separator is associated with the first visible message, and displays it as a floating overlay.

**Key characteristics**:
- Pill-shaped badge (border-radius: max / fully rounded)
- Subtle background color (slightly tinted, not transparent)
- Centered in the message flow
- Two modes: in-flow (static) and floating (sticky/absolute positioned)
- Floating variant uses `pointer-events: none` so it doesn't block clicks
- Small metadata-style typography
- No horizontal lines -- the pill badge floats in open space
- Floating variant: `position: absolute; top: 0; z-index: 1`

**Source**: [GetStream/stream-chat-react](https://github.com/GetStream/stream-chat-react) - `src/components/DateSeparator/` and `src/components/MessageList/FloatingDateSeparator.tsx`

---

### 3. GitHub (Primer) -- Timeline Break (Horizontal Divider Line)

**Pattern**: Full-width horizontal divider line used to separate timeline sections. No text label in the divider itself.

**Implementation from Primer React (primer/react)**:

Component (`Timeline.tsx`):
```tsx
const TimelineBreak = React.forwardRef<HTMLDivElement, TimelineBreakProps>(
  ({ className, ...props }, forwardRef) => {
    return <div {...props} className={clsx(className, classes.TimelineBreak)} ref={forwardRef} />
  }
)
```

Styles (`Timeline.module.css`):
```css
.TimelineBreak {
  position: relative;
  z-index: 1;
  height: 24px;            /* var(--base-size-24) */
  margin: 0;
  margin-bottom: -16px;     /* calc(-1 * var(--base-size-16)) */
  margin-left: 0;
  background-color: var(--bgColor-default);  /* matches page background */
  border: 0;
  border-top: 2px solid var(--borderColor-default);  /* thicker border */

  &:has(+ [data-condensed]) {
    margin-bottom: -12px;   /* tighter spacing when next item is condensed */
  }
}
```

**Visual Layout Sketch**:
```
────────────────────────────────  (2px thick line, full width, no text)
```

**Key characteristics**:
- No text label inside the break -- it is purely a visual separator
- 2px thick border-top line (thicker than typical 1px dividers)
- Full-width, no inset
- Background color matches page (opaque)
- Negative bottom margin to tighten spacing
- `z-index: 1` to sit above the timeline vertical line
- 24px total height with negative margin overlap
- Used in GitHub Issues/PR timelines, NOT in issue lists

**Note**: GitHub's issue list pages use a different approach -- they group issues by date with a section header like "Yesterday" or "Last week" rendered as a simple inline label above the grouped items. These are NOT sticky and use the standard GitHub list styling.

**Source**: [primer/react](https://github.com/primer/react) - `packages/react/src/Timeline/`

---

### 4. MUI (Material UI) -- ListSubheader (Sticky Inline Label)

**Pattern**: Left-aligned text label that optionally sticks to the top during scroll.

**Implementation from MUI (mui/material-ui)**:

Key styles:
```js
// ListSubheader root styles
{
  boxSizing: 'border-box',
  lineHeight: '48px',
  listStyle: 'none',
  color: palette.text.secondary,     // muted/secondary color
  fontFamily: theme.typography.fontFamily,
  fontWeight: theme.typography.fontWeightMedium,
  fontSize: theme.typography.pxToRem(14),  // 14px base
}

// Sticky variant
{
  position: 'sticky',
  top: 0,
  zIndex: 1,
  backgroundColor: palette.background.paper,  // opaque background
}
```

**Visual Layout Sketch**:
```
Today                         (left-aligned, muted color, 14px, medium weight)
─────────────────────────────
  Article 1
  Article 2
Yesterday
─────────────────────────────
  Article 3
```

**Key characteristics**:
- Left-aligned text, no centered treatment
- Medium font weight, secondary/muted text color
- 14px font size (larger than current project's 12px/text-xs)
- 48px line height
- Optional sticky behavior (`disableSticky` prop, default = false, meaning sticky IS the default)
- Opaque background that matches the paper surface
- No decorative lines or borders
- Optional `inset` prop for left indentation
- Optional `disableGutters` for removing horizontal padding
- Rendered as `<li>` element by default

**Source**: [mui/material-ui](https://github.com/mui/material-ui) - `packages/mui-material/src/ListSubheader/`

---

### 5. NetNewsWire -- No Date Group Headers (Feed-Based Grouping Only)

**Pattern**: NetNewsWire does NOT use date-based group headers in its article timeline. It groups by feed name when "Group by Feed" is enabled, otherwise articles are displayed in a flat chronological list with thin 1px separators between rows.

**Implementation findings**:
- `ArticleSorter.swift`: Supports sorting by date or grouping by feed name
- `TimelineTableRowView.swift`: 1px separator line at the bottom of each row
  - `separator!.heightAnchor.constraint(equalToConstant: 1)`
  - `separator!.layer?.backgroundColor = Assets.Colors.timelineSeparator.cgColor`
  - 20pt left inset, 4pt right inset
- No section headers for date groups exist in the codebase
- Feed section headers on iOS use `MainFeedCollectionHeaderReusableView` with title, disclosure indicator, and unread count

**Key characteristics**:
- Simple 1px line separators between articles
- No date group headers in the timeline
- Feed group headers include collapsible disclosure, unread count badge
- macOS uses `NSTableView` with standard row separators
- iOS uses `UICollectionView` with supplementary section header views

**Source**: [Ranchero-Software/NetNewsWire](https://github.com/Ranchero-Software/NetNewsWire) (10k+ stars)

---

### 6. Feedly -- Minimal Inline Date Label

**Pattern**: Feedly uses a subtle, lightweight date section header in its article list. Based on observed behavior and clone implementations:

- Small, muted text label for date groups (e.g., "Today", "Yesterday", "May 22")
- Appears above the first article of each date group
- No decorative lines or borders
- Left-aligned
- Does not use a pill/badge style
- The label is visually lightweight, almost blending with the article metadata below
- Typically not sticky (scrolls with content)

**Note**: Feedly's actual web app date grouping is minimal. The primary organization is by feed/source rather than date. Date headers appear only in "All" view when articles from multiple days are present.

---

### 7. Inoreader -- Date Group Headers with Divider Lines

**Pattern**: Inoreader uses date section headers with a subtle visual treatment:

- Date label (e.g., "Today", "Yesterday") appears as a section header
- Typically includes a subtle line or divider element
- The header has slightly more visual weight than Feedly's approach
- Articles are grouped under each date
- Some implementations show the date as a left-aligned header with a line underneath

---

### 8. Apple Design (iOS/macOS) -- Grouped List Section Headers

**Pattern**: Apple's HIG for Lists and Tables defines:

**iOS Grouped Style**:
- Section headers appear above groups of rows
- Headers use primary text color, standard font size (not enlarged)
- Rounded corner group containers visually separate sections
- Headers have padding/margin to separate from content
- Background is transparent for header area

**iOS Plain Style** (more relevant for article lists):
- Section headers are sticky by default (pin to top during scroll)
- Use `text-secondary` color (muted gray)
- Uppercase or capitalization varies by app
- Thin separator between sections
- Font size is typically 13-15px
- In Apple Podcasts, section headers like "Downloaded" or "Top Charts" use bold/medium weight

**iMessage / WhatsApp Date Bubbles**:
- Small pill/capsule shape containing the date
- Centered horizontally
- Light background color (e.g., light gray)
- Rounded corners (fully rounded, pill shape)
- Small font (11-12px)
- Positioned between message groups
- NOT sticky -- scrolls with content
- In WhatsApp: green-tinted or light-gray pill with white/gray text

**Visual Layout Sketch (iMessage/WhatsApp)**:
```
    ┌────────────────┐
    │  Today          │   (small centered pill, light background)
    └────────────────┘
  Message bubble 1
  Message bubble 2
    ┌────────────────┐
    │  Yesterday      │
    └────────────────┘
  Message bubble 3
```

---

## Design Pattern Taxonomy

Based on all findings, date group headers fall into these distinct visual categories:

### Pattern A: Line-Through Label (Slack style)
```
──────────── Today ────────────
```
- Horizontal lines on both sides of centered text
- CSS: flex + `::before`/`::after` pseudo-elements with `flex-grow: 1; height: 1px`
- Clean, minimal, visually balanced
- Text is centered
- No background on text element itself

### Pattern B: Floating Pill Badge (Stream Chat / WhatsApp style)
```
        ┌──────────┐
        │  Today    │
        └──────────┘
```
- Rounded pill/capsule shape
- Centered in the flow
- Subtle background color
- `border-radius: max` (fully rounded)
- Can have in-flow + floating (sticky) variant
- No decorative lines

### Pattern C: Sticky Inline Label (MUI / Current project style)
```
Today
─────────────────────────────
  Article 1
```
- Left-aligned text
- Optional sticky positioning
- Opaque background
- Optional bottom border
- Simple, no decorative elements
- Common in Material Design and list-based UIs

### Pattern D: Full-Width Divider (GitHub Timeline style)
```
────────────────────────────────
```
- No text label in the divider itself
- 1-2px thick line
- Used where section headers are handled separately or not needed
- Pure visual separator

### Pattern E: Minimal Inline Label (Feedly / Inoreader style)
```
Today
  Article 1
  Article 2
Yesterday
  Article 3
```
- Very lightweight text label
- No lines, borders, or decorative elements
- Minimal visual weight
- Muted color
- Blends with article metadata

---

## Sticky vs. Non-Sticky Behavior Comparison

| Product/App | Sticky? | Behavior |
|---|---|---|
| Current project (Accra) | Yes | `position: sticky; top: 0; z-index: 10` |
| Stream Chat (floating variant) | Yes | `position: absolute; top: 0; z-index: 1; pointer-events: none` |
| MUI ListSubheader | Yes (default) | `position: sticky; top: 0; z-index: 1` |
| Slack (chat-ui-kit) | No | Static position in message flow |
| WhatsApp/iMessage | No | Scrolls with content |
| Feedly | No | Scrolls with content |
| Apple iOS grouped list | No | Scrolls with content |
| Apple iOS plain list | Yes | `UITableView` section headers are sticky by default |

**Key insight**: Sticky behavior is common in list/article views (where continuous navigation matters) but less common in chat/messaging views (where chronological flow is more important).

---

## Typography & Spacing Summary

| Product | Font Size | Font Weight | Color | Line Height |
|---|---|---|---|---|
| Current project | 12px (text-xs) | medium (500) | muted-foreground | default |
| chat-ui-kit (Slack) | ~12.8px (0.8em) | normal | primary-dark | default |
| Stream Chat | metadata-emphasis | medium | chat-text-system | default |
| MUI ListSubheader | 14px | medium (500) | text.secondary | 48px |
| NetNewsWire | N/A (no date headers) | -- | -- | -- |
| WhatsApp | ~11-12px | medium | white/gray | ~24px pill |
| Apple list headers | 13-15px | medium/semibold | secondary | ~32-44px |

---

## CSS Implementation Recipes

### Line-Through Label (Slack pattern) in Tailwind CSS
```html
<div class="flex items-center gap-4 py-2">
  <div class="h-px flex-1 bg-border"></div>
  <span class="text-xs font-medium text-muted-foreground whitespace-nowrap">Today</span>
  <div class="h-px flex-1 bg-border"></div>
</div>
```

### Floating Pill Badge (WhatsApp/Stream Chat pattern) in Tailwind CSS
```html
<div class="flex justify-center py-2">
  <span class="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">Today</span>
</div>
```

### Floating Pill Badge with Sticky Variant in Tailwind CSS
```html
<!-- In-flow version -->
<div class="flex justify-center py-2">
  <span class="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">Today</span>
</div>

<!-- Floating/sticky version -->
<div class="sticky top-0 z-10 flex justify-center py-1 pointer-events-none bg-background/80 backdrop-blur-sm">
  <span class="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">Today</span>
</div>
```

### Enhanced Sticky Inline Label (refined version of current) in Tailwind CSS
```html
<div class="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider border-b">
  Today
</div>
```

---

## Caveats / Not Found

- **Feedly**: No open-source implementation found; findings based on clone repos and observed behavior. The actual web app may have evolved.
- **Inoreader**: No open-source implementation with date headers found; findings based on secondary descriptions.
- **Reeder**: No open-source implementation available; the app is closed-source iOS/macOS only. Could not verify actual date header design.
- **Apple News/Podcasts**: Apple's built-in apps are not open-source. Findings extrapolated from Apple HIG and general iOS design patterns.
- **GitHub Issues list**: The date separators ("Yesterday", "Last week") in GitHub's actual issue list are server-rendered and not part of Primer React. The Primer Timeline.Break component is for timeline views (PR events), not list views.
- **WhatsApp Web**: Could not access the actual chat interface (requires login). Findings based on well-documented design patterns and clone implementations.
- **Slack Web**: Could not access actual chat interface. Findings based on Stream Chat and chat-ui-kit implementations which closely mirror Slack's design.
