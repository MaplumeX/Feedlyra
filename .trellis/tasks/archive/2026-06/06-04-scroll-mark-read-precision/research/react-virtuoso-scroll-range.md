# React Virtuoso Scroll Range Research

## Sources

* Context7 library `/petyosi/react-virtuoso`, query `rangeChanged itemsRendered Virtuoso callback`.
* `react-virtuoso@4.18.7` package metadata from npm.
* `react-virtuoso@4.18.7` `dist/index.d.ts` extracted under `.context/react-virtuoso-4.18.7/`.

## Relevant API

* `rangeChanged?: (range: ListRange) => void`
  * `ListRange` has `startIndex` and `endIndex`.
  * Package types describe these as the first and last visible item indexes.
  * Context7 notes that docs/examples use it to track the visible range; some docs caution that overscan/increased viewport can affect rendered range. This app does not currently pass `overscan` or `increaseViewportBy`.
* `itemsRendered?: (items: ListItem<Data>[]) => void`
  * Provides rendered item records with `index`, `offset`, `size`, and optional `data`.
* `isScrolling?: (isScrolling: boolean) => void`
  * Only reports scrolling state, not direction.
* `scrollerRef?: (ref: HTMLElement | null | Window) => any`
  * Existing code already uses this to capture the scroller element.

## Fit For This Task

`rangeChanged` can avoid the current race where item refs run before the observer exists, but the project frontend quality guide explicitly warns against using it directly for scroll-triggered read marking because it also fires on mount, resize, and data replacement.

Chosen implementation:

* Keep `IntersectionObserver` as the pixel-level viewport boundary mechanism.
* Use Virtuoso `context` to pass a row registration callback into the custom `Item`, avoiding the current module-level observer holder.
* Keep a set of mounted item elements so rows that rendered before the observer exists can be observed once the scroller root is ready.
* Track scroll direction from the captured scroller element's `scrollTop`; only observer exits caused by downward scrolling should queue read marks.
* Reset pending/submitted/observed state when feed/filter/data identity changes so query invalidation or list refreshes do not create false positives.
* Keep the existing debounce/batch-read behavior.

## Trade-Offs

* The implementation still depends on DOM observation, but the observer lifecycle is owned by component refs instead of a module-level singleton.
* The scroll-direction guard prevents most non-scroll false positives; if future layout changes programmatically alter `scrollTop`, they should be reviewed against this behavior.
* `rangeChanged` remains a possible future fallback only if the quality guideline is intentionally revised with robust guards.
