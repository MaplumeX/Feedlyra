import { ChevronLeft, ChevronRight, ListTree } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface ArticleTableOfContentsProps {
  items: TocItem[];
  scrollViewport: HTMLDivElement | null;
  articleElement: HTMLElement | null;
  forceCompact: boolean;
  reservedRight?: number;
}

const MIN_FLOATING_PANEL_WIDTH = 980;
const MIN_TOC_ITEMS = 2;
const DEFAULT_TRIGGER_TOP_OFFSET = 160;
const TRIGGER_VERTICAL_MARGIN = 20;
const DRAG_CLICK_THRESHOLD = 4;

interface DragState {
  pointerId: number;
  startClientY: number;
  startTop: number;
  moved: boolean;
}

export function createArticleContentWithAnchors(html: string): { html: string; items: TocItem[] } {
  const template = document.createElement("template");
  template.innerHTML = html;
  const headings = Array.from(template.content.querySelectorAll("h1, h2, h3, h4"));
  const slugCounts = new Map<string, number>();
  const items: TocItem[] = [];

  for (const heading of headings) {
    const text = heading.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!text) continue;

    const level = Number(heading.tagName.slice(1));
    const baseSlug = createHeadingSlug(text) || `section-${items.length + 1}`;
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;

    heading.setAttribute("id", id);
    heading.classList.add("scroll-mt-6");
    items.push({ id, text, level });
  }

  return { html: template.innerHTML, items };
}

function createHeadingSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function ArticleTableOfContents({
  items,
  scrollViewport,
  articleElement,
  forceCompact,
  reservedRight = 0,
}: ArticleTableOfContentsProps) {
  const { t } = useTranslation("reader");
  const [expanded, setExpanded] = useState(true);
  const [compactOpen, setCompactOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [triggerTop, setTriggerTop] = useState(DEFAULT_TRIGGER_TOP_OFFSET);
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef(false);

  const hasItems = items.length >= MIN_TOC_ITEMS;
  const hasMeasuredWidth = containerWidth > 0;
  const isCompact = forceCompact || (hasMeasuredWidth && containerWidth < MIN_FLOATING_PANEL_WIDTH);
  const visibleAsPanel = hasItems && expanded && !isCompact;
  const hasMeasuredHeight = containerHeight > 0;
  const triggerMaxTop = hasMeasuredHeight
    ? Math.max(TRIGGER_VERTICAL_MARGIN, containerHeight - 36 - TRIGGER_VERTICAL_MARGIN)
    : DEFAULT_TRIGGER_TOP_OFFSET;
  const clampedTriggerTop = hasMeasuredHeight
    ? Math.min(Math.max(triggerTop, TRIGGER_VERTICAL_MARGIN), triggerMaxTop)
    : triggerTop;

  useEffect(() => {
    if (!scrollViewport) {
      setContainerWidth(0);
      setContainerHeight(0);
      return;
    }

    const updateSize = () => {
      setContainerWidth(scrollViewport.clientWidth);
      setContainerHeight(scrollViewport.clientHeight);
    };
    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(scrollViewport);
    return () => resizeObserver.disconnect();
  }, [scrollViewport]);

  useEffect(() => {
    if (!hasMeasuredHeight) return;
    setTriggerTop((currentTop) => Math.min(Math.max(currentTop, TRIGGER_VERTICAL_MARGIN), triggerMaxTop));
  }, [hasMeasuredHeight, triggerMaxTop]);

  useEffect(() => {
    if (!items.some((item) => item.id === activeId)) {
      setActiveId(items[0]?.id ?? null);
    }
  }, [activeId, items]);

  useEffect(() => {
    if (!scrollViewport || !articleElement || items.length === 0) return;

    const updateActiveHeading = () => {
      const viewportTop = scrollViewport.getBoundingClientRect().top;
      let nextActiveId = items[0]?.id ?? null;

      for (const item of items) {
        const heading = articleElement.querySelector<HTMLElement>(`#${CSS.escape(item.id)}`);
        if (!heading) continue;

        const top = heading.getBoundingClientRect().top - viewportTop;
        if (top <= 96) {
          nextActiveId = item.id;
        } else {
          break;
        }
      }

      setActiveId(nextActiveId);
    };

    updateActiveHeading();
    scrollViewport.addEventListener("scroll", updateActiveHeading, { passive: true });
    window.addEventListener("resize", updateActiveHeading);
    return () => {
      scrollViewport.removeEventListener("scroll", updateActiveHeading);
      window.removeEventListener("resize", updateActiveHeading);
    };
  }, [articleElement, items, scrollViewport]);

  useEffect(() => {
    if (isCompact) {
      setExpanded(false);
    } else {
      setCompactOpen(false);
    }
  }, [isCompact]);

  const handleJump = useCallback((id: string) => {
    if (!articleElement || !scrollViewport) return;

    const heading = articleElement.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!heading) return;

    const viewportTop = scrollViewport.getBoundingClientRect().top;
    const headingTop = heading.getBoundingClientRect().top;
    scrollViewport.scrollTo({
      top: scrollViewport.scrollTop + headingTop - viewportTop - 24,
      behavior: "smooth",
    });
    setActiveId(id);
    setCompactOpen(false);
  }, [articleElement, scrollViewport]);

  const handleTriggerPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!scrollViewport || event.button !== 0) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startTop: clampedTriggerTop,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [clampedTriggerTop, scrollViewport]);

  const handleTriggerPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - dragState.startClientY;
    if (Math.abs(deltaY) > DRAG_CLICK_THRESHOLD) {
      dragState.moved = true;
    }
    if (!dragState.moved) return;

    const nextTop = Math.min(
      Math.max(dragState.startTop + deltaY, TRIGGER_VERTICAL_MARGIN),
      triggerMaxTop
    );
    setTriggerTop(nextTop);
  }, [triggerMaxTop]);

  const handleTriggerPointerEnd = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (dragState.moved) {
      suppressNextClickRef.current = true;
      setCompactOpen(false);
    }

    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleTriggerClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event.preventDefault();
      return;
    }

    if (!isCompact) {
      setExpanded(true);
    }
  }, [isCompact]);

  const list = useMemo(() => (
    <div className="max-h-[min(28rem,calc(100vh-10rem))] overflow-y-auto px-1 py-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            "flex w-full min-w-0 rounded-md px-2 py-1.5 text-left text-xs leading-snug transition-colors hover:bg-accent hover:text-accent-foreground",
            item.level === 3 && "pl-5",
            item.level >= 4 && "pl-8",
            activeId === item.id ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground"
          )}
          onClick={() => handleJump(item.id)}
        >
          <span className="min-w-0 flex-1 truncate">{item.text}</span>
        </button>
      ))}
    </div>
  ), [activeId, handleJump, items]);

  if (!hasItems) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute right-5 z-20 flex",
        visibleAsPanel ? "bottom-5 top-5 items-center" : "top-0 items-start"
      )}
      style={{ right: `${reservedRight + 20}px` }}
    >
      {visibleAsPanel ? (
        <aside
          className="pointer-events-auto flex max-h-full w-64 flex-col rounded-md border bg-background/95 shadow-lg backdrop-blur"
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <ListTree className="h-4 w-4 text-muted-foreground" />
            <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{t("tableOfContents")}</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={t("collapseToc")}
              aria-label={t("collapseToc")}
              onClick={() => setExpanded(false)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {list}
        </aside>
      ) : (
        <Popover open={isCompact ? compactOpen : false} onOpenChange={setCompactOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className={cn(
                "pointer-events-auto h-9 w-9 touch-none rounded-md border bg-background/95 shadow-lg backdrop-blur",
                "cursor-grab active:cursor-grabbing"
              )}
              style={{ marginTop: `${clampedTriggerTop}px` }}
              title={t("expandToc")}
              aria-label={t("expandToc")}
              onPointerDown={handleTriggerPointerDown}
              onPointerMove={handleTriggerPointerMove}
              onPointerUp={handleTriggerPointerEnd}
              onPointerCancel={handleTriggerPointerEnd}
              onLostPointerCapture={handleTriggerPointerEnd}
              onClick={handleTriggerClick}
            >
              {isCompact ? <ListTree className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </PopoverTrigger>
          {isCompact && (
            <PopoverContent side="left" align="center" className="pointer-events-auto w-64 p-0">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <ListTree className="h-4 w-4 text-muted-foreground" />
                <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{t("tableOfContents")}</h2>
              </div>
              {list}
            </PopoverContent>
          )}
        </Popover>
      )}
    </div>
  );
}
