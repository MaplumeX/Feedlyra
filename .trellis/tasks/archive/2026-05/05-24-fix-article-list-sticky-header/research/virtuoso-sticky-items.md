# Research: Virtuoso Sticky Items

- **Query**: How does react-virtuoso handle sticky/group headers? What is the `stickyItems` prop? How to make certain items stick to the top of the scroll viewport? CSS requirements?
- **Scope**: mixed (external documentation + internal source code analysis)
- **Date**: 2026-05-24

## Findings

### 1. `stickyItems` Prop Does NOT Exist in react-virtuoso v4

The `stickyItems` prop does **not exist** in react-virtuoso v4.18.7 (the version used in this project). A search through:

- The TypeScript type definitions (`dist/index.d.ts`) -- no `stickyItems` prop on `VirtuosoProps`, `GroupedVirtuosoProps`, or any other component
- The minified source (`dist/index.mjs` and `dist/index.cjs`) -- zero occurrences of `stickyItem`
- The entire `node_modules/react-virtuoso/` directory -- zero matches

This prop may have been referenced in older blog posts or third-party tutorials, or confused with a similar prop from a different virtual list library (e.g., `react-window` has no such prop either). **It is not a real react-virtuoso API.**

### 2. The Correct Way: GroupedVirtuoso with Built-in Sticky Group Headers

react-virtuoso provides sticky group headers through the **`GroupedVirtuoso`** component, which automatically applies `position: sticky` to group header elements.

#### How GroupedVirtuoso Implements Sticky Headers (Source Code Analysis)

In the minified source (`dist/index.mjs`), group header items receive an inline style object `mr`:

```js
// Line 2453
mr = { overflowAnchor: "none", position: Je(), zIndex: 1 }
```

Where `Je()` is a feature-detection function that returns the correct sticky position value:

```js
// Lines 2347-2352
const Oe = "-webkit-sticky", Rn = "sticky";
Je = ro(() => {
  if (typeof document > "u") return Rn;
  const t = document.createElement("div");
  return t.style.position = Oe, t.style.position === Oe ? Oe : Rn;
});
```

So `Je()` returns either `"sticky"` or `"-webkit-sticky"` depending on browser support.

Group items in the Virtuoso (non-table) list are rendered with:

```jsx
F.type === "group" ? React.createElement(
  g,  // GroupComponent
  {
    "data-index": mt,
    "data-item-index": F.index,
    "data-known-size": F.size,
    key: q,
    style: mr  // { overflowAnchor: "none", position: "sticky" (or "-webkit-sticky"), zIndex: 1 }
  },
  v(F.index, m)  // groupContent(index, context)
) : /* regular item */
```

For the TableVirtuoso variant, group items receive style `En`:

```js
// Line 2773
En = { position: Je(), zIndex: 2, overflowAnchor: "none" }
```

And when rendering, an additional `top` offset is applied based on `fixedHeaderHeight`:

```jsx
style: {
  ...En,
  top: l  // l = fixedHeaderHeight
}
```

There is also a standalone sticky header style `Ir` used for the top item list:

```js
// Lines 2551-2556
Ir = {
  position: Je(),   // "sticky" or "-webkit-sticky"
  top: 0,
  width: "100%",
  zIndex: 1
}
```

#### GroupedVirtuoso Usage Pattern

```tsx
import { GroupedVirtuoso } from "react-virtuoso";

// groupCounts specifies how many items in each group
// e.g., [3, 5, 2] means 3 groups: group 0 has 3 items, group 1 has 5, group 2 has 2

<GroupedVirtuoso
  groupCounts={[3, 5, 2]}
  groupContent={(groupIndex) => (
    <div>Group {groupIndex}</div>
  )}
  itemContent={(index, groupIndex) => (
    <div>Item {index} in group {groupIndex}</div>
  )}
/>
```

**Key points**:
- `groupContent` renders the group header. Virtuoso automatically wraps it in a `<div>` with `position: sticky; top: 0; z-index: 1`.
- `groupCounts` defines the size of each group. This is **required** -- you must know the number of items per group upfront.
- Group headers get `position: sticky` automatically -- you do NOT need to add CSS `position: sticky` yourself.
- The group header wrapper element is a `<div>` by default, customizable via `components.Group`.

#### Custom Group Component

You can customize the group wrapper element via `components.Group`:

```tsx
<GroupedVirtuoso
  groupCounts={groupCounts}
  components={{
    Group: ({ children, style, ...props }) => (
      <div {...props} style={style} className="my-sticky-group-header">
        {children}
      </div>
    )
  }}
  groupContent={(groupIndex) => `Group ${groupIndex}`}
  itemContent={(index, groupIndex) => `Item ${index}`}
/>
```

**Important**: If you provide a custom `Group` component, Virtuoso passes the sticky `style` prop to it. You must apply the `style` prop to your wrapper element for sticky behavior to work.

### 3. Alternative: Plain Virtuoso with Manual `position: sticky`

If you use the plain `Virtuoso` component (as the current project does), you can make certain items sticky by adding `position: sticky` CSS yourself in the `itemContent` callback. This is exactly what the current ArticleList does.

#### Current Project Implementation (ArticleList.tsx, line 291)

```tsx
<Virtuoso
  data={flatItems}
  itemContent={(_index, item) => {
    if (item.type === "header") {
      return (
        <div className="sticky top-0 z-10 flex items-center gap-4 bg-background px-3 py-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {item.label}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      );
    }
    return <ArticleRow article={item.article} ... />;
  }}
/>
```

**CSS Requirements for manual sticky in Virtuoso**:
- `position: sticky` (or `sticky top-0` in Tailwind) -- makes the element stick at the top of the scroll container
- `top: 0` -- the offset from the viewport top where it sticks
- `z-index` (e.g., `z-10`) -- ensures the sticky item renders above other scrolling items
- Opaque background (`bg-background`) -- prevents content behind the sticky header from showing through
- The sticky element must be a direct child of the Virtuoso item wrapper (`<div>`), which is itself inside the Virtuoso scroll container

### 4. Why Manual `position: sticky` May Not Work Correctly in Virtuoso

There is a **critical architectural issue** with using CSS `position: sticky` inside a virtualized list like Virtuoso.

Virtuoso uses **absolute positioning** for its items. Each item wrapper receives `position: absolute` and is positioned using `top` offsets calculated by Virtuoso's measurement engine. Looking at the source:

```js
// The Virtuoso list container uses this style:
tn = (t, e, n = 0) => ({
  ...He(t),     // { height: "100%", ... }
  position: e ? "relative" : "absolute",
  top: e ? -n : 0
})
```

Items inside are absolutely positioned with computed `top` values. **CSS `position: sticky` does NOT work inside a container that uses `position: relative` with absolutely positioned children** -- sticky positioning requires the element to be in the normal document flow within a scrolling container.

However, Virtuoso's **GroupedVirtuoso** handles this differently. When it renders group items, it applies the sticky style to the **item wrapper element itself** (the outer `<div>` that Virtuoso creates), not to inner content. The wrapper div sits inside Virtuoso's internal list container which has `overflow: auto`, and the sticky positioning works because Virtuoso manages the group items with special handling -- they are placed in the scroll flow correctly.

In contrast, when using plain `Virtuoso` with manual `sticky` CSS on inner content, the sticky behavior is unreliable because:
- The Virtuoso item wrapper `<div>` has `position: absolute` with a calculated `top`
- A child element with `position: sticky` inside an absolutely positioned parent does not stick relative to the scroll container -- it has no scrolling ancestor in its containing block chain

**This is the likely root cause of sticky header issues in the current ArticleList.**

### 5. Solutions Summary

| Approach | Component | Sticky Mechanism | Reliability |
|---|---|---|---|
| GroupedVirtuoso with `groupCounts` + `groupContent` | `GroupedVirtuoso` | Built-in: Virtuoso applies `position: sticky` to the group wrapper element | Reliable -- Virtuoso manages the sticky behavior internally |
| Plain Virtuoso with manual `position: sticky` | `Virtuoso` | CSS only: `sticky top-0` on inner content | Unreliable -- sticky inside absolute-positioned container does not work correctly |
| `topItemCount` prop | `Virtuoso` | Pins N items to the top (always visible, not scrolling) | Not the same as sticky -- items are fixed at top permanently, not sticky during scroll |
| `components.TopItemList` | `Virtuoso` | Custom component for top item list area | Not sticky behavior -- separate rendering area at top |

### 6. Migrating from Plain Virtuoso to GroupedVirtuoso

To get working sticky group headers, the current ArticleList would need to switch from `Virtuoso` to `GroupedVirtuoso`:

```tsx
// Current approach (unreliable sticky):
<Virtuoso
  data={flatItems}
  itemContent={(_index, item) => {
    if (item.type === "header") {
      return <div className="sticky top-0 ...">...</div>;
    }
    return <ArticleRow ... />;
  }}
/>

// Correct approach with GroupedVirtuoso:
const groupCounts = grouped.map(g => g.articles.length);

<GroupedVirtuoso
  groupCounts={groupCounts}
  groupContent={(groupIndex) => (
    <div className="flex items-center gap-4 bg-background px-3 py-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {grouped[groupIndex].label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )}
  itemContent={(index, groupIndex) => {
    const article = grouped[groupIndex].articles[index];
    return (
      <ArticleRow
        article={article}
        feedIconUrl={feedIconMap.get(article.feed_id) ?? null}
        isSelected={selectedArticleId === article.id}
        onSelect={() => selectArticle(article)}
      />
    );
  }}
/>
```

**Important migration notes**:
- `GroupedVirtuoso` uses `groupCounts` (array of item counts per group) instead of a flat `data` array
- `itemContent` callback signature changes: `(index, groupIndex, data, context)` instead of `(index, data, context)`
- `groupContent` callback: `(groupIndex, context)` -- renders only the group header content
- `rangeChanged` callback still works but indices are different (group items are included in the range)
- The `data` prop is NOT available on GroupedVirtuoso in the same way -- you must use `groupCounts` + callbacks
- Scroll mark read logic would need adjustment since item indices now differ from flat article indices

### 7. GroupedVirtuoso Props (from type definitions)

Key props from `GroupedVirtuosoProps`:

```typescript
interface GroupedVirtuosoProps<Data, Context> extends Omit<VirtuosoProps<Data, Context>, 'itemContent' | 'totalCount'> {
  groupCounts?: number[];       // items per group (also defines number of groups)
  groupContent?: GroupContent<Context>;  // (groupIndex, context) => ReactNode
  itemContent?: GroupItemContent<Data, Context>;  // (index, groupIndex, data, context) => ReactNode
  firstItemIndex?: number;      // for inverse infinite scrolling
}
```

All standard `VirtuosoProps` are inherited except `itemContent` and `totalCount`.

### Files Found

| File Path | Description |
|---|---|
| `frontend/src/components/ArticleList.tsx` | Current implementation using plain Virtuoso with manual `sticky` CSS |
| `frontend/node_modules/react-virtuoso/dist/index.d.ts` | Type definitions -- no `stickyItems` prop exists |
| `frontend/node_modules/react-virtuoso/dist/index.mjs` | Minified source -- confirms GroupedVirtuoso applies `position: sticky` internally |

### Code Patterns

1. **Virtuoso list container style** (`index.mjs:2547-2550`): Uses `position: absolute` for the scroll container, which breaks manual CSS sticky on child elements.

2. **GroupedVirtuoso group header style** (`index.mjs:2453`): `mr = { overflowAnchor: "none", position: Je(), zIndex: 1 }` where `Je()` returns `"sticky"` or `"-webkit-sticky"`.

3. **Sticky position feature detection** (`index.mjs:2347-2352`): Tests `-webkit-sticky` first, falls back to `sticky`.

4. **GroupedVirtuoso group rendering** (`index.mjs:2503-2513`): Group items receive the `mr` style object on their wrapper element, making them sticky automatically.

5. **TableVirtuoso group rendering** (`index.mjs:2786-2799`): Group items receive `En = { position: Je(), zIndex: 2, overflowAnchor: "none" }` plus `top: fixedHeaderHeight`.

6. **Current ArticleList** (`ArticleList.tsx:291`): Uses manual `sticky top-0 z-10` CSS on inner content div inside a plain Virtuoso -- this is unreliable because Virtuoso's item wrappers use absolute positioning.

### Related Specs

- `.trellis/spec/frontend/component-guidelines.md` -- Contains "Line-Through Label" pattern and Virtuoso scroll patterns
- `.trellis/tasks/archive/2026-05/05-24-optimize-article-list-time-header-style/research/date-header-ui-patterns.md` -- Previous research on date header UI patterns

## Caveats / Not Found

- **`stickyItems` prop does NOT exist** in react-virtuoso v4. It may appear in outdated blog posts or be confused with APIs from other libraries.
- **react-virtuoso v4 documentation website** (virtuoso.dev) could not be accessed programmatically. Findings are based on source code analysis of the installed package.
- **`GroupedVirtuoso` does NOT support the `data` prop** in the same way as `Virtuoso`. It uses `groupCounts` to define structure. If articles are loaded asynchronously, `groupCounts` must be recalculated when data changes.
- **`rangeChanged` behavior differs** in GroupedVirtuoso because group items are included in the item indices. The scroll-mark-read logic would need index translation.
- The `followOutput` prop is inherited by `GroupedVirtuosoProps` and should work the same way.
- **`components.Group` customization**: If you supply a custom Group component, you must spread the `style` prop (which contains `position: sticky`) for sticky behavior to work. Dropping the `style` prop will break sticky behavior.
