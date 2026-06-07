import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type ContextProp, type VirtuosoHandle, type ItemProps } from "react-virtuoso";
import { Star, CheckCheck, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FeedIcon } from "@/components/FeedIcon";
import { useInfiniteArticles, useFeeds, useToggleRead, useToggleStar, useMarkAllRead, useBatchRead, useRefreshAllFeeds } from "@/api/hooks";
import { useReaderStore } from "@/stores/reader";
import { cn } from "@/lib/utils";
import { reconcileArticleAcknowledgements } from "@/lib/articleList";
import type { Article } from "@/api/types";

const SCROLL_MARK_READ_DEBOUNCE_MS = 300;

function ArticleRow({
  article,
  feedIconUrl,
  isSelected,
  onSelect,
}: {
  article: Article;
  feedIconUrl: string | null;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation("reader");
  const toggleStar = useToggleStar();
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = article.image_url && !imageFailed;

  // Reset image error state when article changes (Virtuoso reuses component instances)
  useEffect(() => {
    setImageFailed(false);
  }, [article.id]);

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-row border-b px-3 py-2 transition-colors duration-100 hover:bg-article-hover/70",
        isSelected && "bg-article-hover",
        !article.is_read && "font-medium"
      )}
      onClick={onSelect}
    >
      <div className={cn("flex flex-col gap-0.5", showImage ? "flex-1 min-w-0" : "w-full")}>
        {article.feed_title && (
          <div className="flex items-center gap-1.5 pl-4 text-xs text-muted-foreground">
            <FeedIcon iconUrl={feedIconUrl} className="h-3 w-3" />
            <span className="min-w-0 flex-1 truncate">{article.feed_title}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 shrink-0", !article.is_read && "rounded-full bg-primary")} />
          <span className="flex-1 truncate text-sm">{article.title}</span>
          <button
            className="shrink-0 p-0.5 hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              toggleStar.mutate({ articleId: article.id, starred: !article.is_starred });
            }}
          >
            <Star
              className={cn("h-3.5 w-3.5", article.is_starred && "fill-primary text-primary")}
            />
          </button>
        </div>
        {article.content_snippet && (
          <span className="line-clamp-2 pl-4 text-xs text-muted-foreground">
            {article.content_snippet}
          </span>
        )}
        <div className="flex items-center gap-2 pl-4 text-xs text-muted-foreground">
          {article.author && <span>{t("by", { author: article.author })}</span>}
          {article.published_at && (
            <span>{new Date(article.published_at).toLocaleDateString(i18n.language)}</span>
          )}
        </div>
      </div>
      {showImage && (
        <img
          src={article.image_url ?? undefined}
          alt=""
          className="ml-2 h-14 w-14 shrink-0 rounded object-cover"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}

interface ArticleListVirtuosoContext {
  registerArticleElement: (element: HTMLDivElement) => void;
  unregisterArticleElement: (element: HTMLDivElement) => void;
}

function isHTMLElement(ref: HTMLElement | Window | null): ref is HTMLElement {
  return ref !== null && "nodeType" in ref;
}

function ObservableItem({
  children,
  item,
  context,
  ...props
}: ItemProps<Article> & ContextProp<ArticleListVirtuosoContext>) {
  const prevElRef = useRef<HTMLDivElement | null>(null);

  // Article ID is read from data-article-id by the observer so Virtuoso can reuse
  // DOM nodes without forcing observe/unobserve churn on every item data update.
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      if (prevElRef.current && prevElRef.current !== el) {
        context.unregisterArticleElement(prevElRef.current);
      }

      if (el) {
        context.registerArticleElement(el);
      }

      prevElRef.current = el;
    },
    [context]
  );

  return (
    <div {...props} ref={ref} data-article-id={item.id}>
      {children}
    </div>
  );
}

function ArticleListSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function ArticleListFooter({ isLoadingMore }: { isLoadingMore: boolean }) {
  return (
    <>
      {isLoadingMore && (
        <div className="space-y-2 p-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 'calc(100vh - 44px)' }} />
    </>
  );
}

function NewArticlesBanner({ count, onClick }: { count: number; onClick: () => void }) {
  const { t } = useTranslation("reader");
  return (
    <button
      className="flex w-full items-center justify-center gap-1.5 border-b bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
      onClick={onClick}
    >
      {t("newArticles", { count })}
    </button>
  );
}

export function ArticleList() {
  const { t } = useTranslation("reader");
  const { selectedFeedId, selectedArticleId, articleListFilter, scrollMarkRead, set: setReader } = useReaderStore();

  const queryParams = useMemo(() => {
    const params: { feed_id?: string; read_status?: string; starred?: boolean } = {};
    if (selectedFeedId) params.feed_id = selectedFeedId;
    if (articleListFilter === "unread") params.read_status = "unread";
    if (articleListFilter === "starred") params.starred = true;
    return params;
  }, [selectedFeedId, articleListFilter]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteArticles(queryParams);
  const { data: feeds = [] } = useFeeds();
  const toggleRead = useToggleRead();
  const markAllRead = useMarkAllRead();
  const batchRead = useBatchRead();
  const refreshAll = useRefreshAllFeeds();
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // New articles detection
  // acknowledgedArticleIds tracks the set of article IDs the user has "seen".
  // When refetchInterval brings in new articles, we hide them from the rendered
  // list and show a banner instead. Only after the user clicks the banner do we
  // acknowledge the new IDs and render them.
  const acknowledgedArticleIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedRef = useRef(false);
  const previousPageCountRef = useRef(0);
  const [newArticlesCount, setNewArticlesCount] = useState(0);

  // Mark acknowledged as stale on feed/filter change
  useEffect(() => {
    acknowledgedArticleIdsRef.current = new Set();
    hasLoadedRef.current = false;
    previousPageCountRef.current = 0;
    setNewArticlesCount(0);
  }, [selectedFeedId, articleListFilter]);

  // Only unknown IDs from the first page are new. IDs from appended history
  // pages are acknowledged automatically so infinite scrolling never raises the banner.
  useEffect(() => {
    if (isLoading) return;

    const pageArticleIds = (data?.pages ?? []).map((page) =>
      page.items.map((article) => article.id),
    );
    const result = reconcileArticleAcknowledgements(pageArticleIds, {
      acknowledgedIds: acknowledgedArticleIdsRef.current,
      initialized: hasLoadedRef.current,
      previousPageCount: previousPageCountRef.current,
    });

    acknowledgedArticleIdsRef.current = result.acknowledgedIds;
    hasLoadedRef.current = result.initialized;
    previousPageCountRef.current = result.previousPageCount;
    setNewArticlesCount(result.newArticleIds.length);
  }, [isLoading, data]);

  const feedIconMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const feed of feeds) {
      map.set(feed.id, feed.icon_url);
    }
    return map;
  }, [feeds]);

  const articles = useMemo(
    () => {
      const seen = new Set<string>();
      const flattened: Article[] = [];
      const acknowledged = acknowledgedArticleIdsRef.current;

      for (const page of data?.pages ?? []) {
        for (const article of page.items) {
          if (seen.has(article.id)) continue;
          seen.add(article.id);
          // Hide articles not yet acknowledged (shown via banner instead)
          if (newArticlesCount > 0 && !acknowledged.has(article.id)) continue;
          flattened.push(article);
        }
      }

      return flattened;
    },
    [data, newArticlesCount]
  );
  const hasUnread = selectedFeedId
    ? (feeds.find((feed) => feed.id === selectedFeedId)?.unread_count ?? 0) > 0
    : feeds.some((feed) => (feed.unread_count ?? 0) > 0);
  const unreadArticleIds = useMemo(
    () => new Set(articles.filter((article) => !article.is_read).map((article) => article.id)),
    [articles]
  );

  const loadMoreArticles = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Scroll mark read state
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const submittedIdsRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedElementsRef = useRef<Set<HTMLDivElement>>(new Set());
  const unreadArticleIdsRef = useRef(unreadArticleIds);
  const scrollMarkReadRef = useRef(scrollMarkRead);
  const scrollDirectionRef = useRef<"down" | "up" | null>(null);
  const lastScrollTopRef = useRef(0);
  unreadArticleIdsRef.current = unreadArticleIds;
  scrollMarkReadRef.current = scrollMarkRead;
  const [scrollerElement, setScrollerElement] = useState<HTMLElement | null>(null);

  const flushPendingIds = useCallback(() => {
    const ids = Array.from(pendingIdsRef.current);
    pendingIdsRef.current.clear();
    debounceTimerRef.current = null;
    if (!scrollMarkReadRef.current || ids.length === 0) {
      return;
    }

    for (const id of ids) {
      submittedIdsRef.current.add(id);
    }

    batchRead.mutate(
      { articleIds: ids },
      {
        onError: () => {
          for (const id of ids) {
            submittedIdsRef.current.delete(id);
          }
        },
      }
    );
  }, [batchRead]);

  const flushPendingIdsRef = useRef(flushPendingIds);
  flushPendingIdsRef.current = flushPendingIds;

  // IntersectionObserver callback: mark as read when article scrolls past the top
  // Uses refs for scrollMarkRead, unread IDs, and flushPendingIds so the callback identity
  // stays stable — this prevents unnecessary observer recreation which would lose observed elements.
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (!scrollMarkReadRef.current) return;
      if (scrollDirectionRef.current !== "down") return;

      for (const entry of entries) {
        // Only trigger when article leaves viewport (was visible, now not)
        if (entry.isIntersecting) continue;

        // Only mark if the article has fully left through the top of the scroller.
        const rootBounds = entry.rootBounds;
        if (!rootBounds) continue;
        if (entry.boundingClientRect.bottom > rootBounds.top) continue;
        if (!(entry.target instanceof HTMLElement)) continue;

        const articleId = entry.target.dataset.articleId;
        if (!articleId) continue;
        if (submittedIdsRef.current.has(articleId)) continue;
        if (unreadArticleIdsRef.current.has(articleId)) {
          pendingIdsRef.current.add(articleId);
        }
      }

      if (pendingIdsRef.current.size > 0) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(
          flushPendingIdsRef.current,
          SCROLL_MARK_READ_DEBOUNCE_MS
        );
      }
    },
    []
  );

  const registerArticleElement = useCallback((element: HTMLDivElement) => {
    observedElementsRef.current.add(element);
    observerRef.current?.observe(element);
  }, []);

  const unregisterArticleElement = useCallback((element: HTMLDivElement) => {
    observedElementsRef.current.delete(element);
    observerRef.current?.unobserve(element);
  }, []);

  const virtuosoContext = useMemo<ArticleListVirtuosoContext>(
    () => ({
      registerArticleElement,
      unregisterArticleElement,
    }),
    [registerArticleElement, unregisterArticleElement]
  );

  useEffect(() => {
    if (!scrollerElement) return;

    const scroller = scrollerElement;
    lastScrollTopRef.current = scroller.scrollTop;

    function handleScroll() {
      const scrollTop = scroller.scrollTop;
      if (scrollTop > lastScrollTopRef.current) {
        scrollDirectionRef.current = "down";
      } else if (scrollTop < lastScrollTopRef.current) {
        scrollDirectionRef.current = "up";
      }
      lastScrollTopRef.current = scrollTop;
    }

    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", handleScroll);
    };
  }, [scrollerElement]);

  // Create/recreate IntersectionObserver when the scroller element becomes available
  useEffect(() => {
    if (!scrollerElement) return;

    // Disconnect existing observer if any
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: scrollerElement,
      threshold: 0,
    });

    for (const element of observedElementsRef.current) {
      observerRef.current.observe(element);
    }

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [handleIntersection, scrollerElement]);

  useEffect(() => {
    pendingIdsRef.current.clear();
    submittedIdsRef.current.clear();
    scrollDirectionRef.current = null;
    if (scrollerElement) {
      lastScrollTopRef.current = scrollerElement.scrollTop;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [articleListFilter, scrollerElement, selectedFeedId]);

  useEffect(() => {
    if (scrollMarkRead) return;

    pendingIdsRef.current.clear();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [scrollMarkRead]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  function selectArticle(article: Article) {
    setReader({ selectedArticleId: article.id });
    if (!article.is_read) {
      toggleRead.mutate({ articleId: article.id, read: true });
    }
  }

  function handleNewArticlesClick() {
    // Acknowledge all article IDs currently in data so they render
    for (const page of data?.pages ?? []) {
      for (const article of page.items) {
        acknowledgedArticleIdsRef.current.add(article.id);
      }
    }
    setNewArticlesCount(0);
    virtuosoRef.current?.scrollToIndex(0);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 items-center gap-2 border-b px-3">
        <Tabs
          value={articleListFilter}
          onValueChange={(v) =>
            setReader({ articleListFilter: v as "all" | "unread" | "starred", selectedArticleId: null })
          }
        >
          <TabsList className="h-7">
            <TabsTrigger value="all" className="text-xs px-2">{t("all")}</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs px-2">{t("unread")}</TabsTrigger>
            <TabsTrigger value="starred" className="text-xs px-2">{t("starred")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-auto"
          disabled={refreshAll.isPending}
          onClick={() => refreshAll.mutate()}
          title={t("refreshAll")}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshAll.isPending && "animate-spin")} />
        </Button>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate({ feedId: selectedFeedId ?? undefined })}
          >
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            {t("markAllRead")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <ArticleListSkeleton />
      ) : articles.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t("noArticles")}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {newArticlesCount > 0 && (
            <NewArticlesBanner count={newArticlesCount} onClick={handleNewArticlesClick} />
          )}
          <Virtuoso
            ref={virtuosoRef}
            className="flex-1"
            data={articles}
            context={virtuosoContext}
            scrollerRef={(ref) => {
              setScrollerElement(isHTMLElement(ref) ? ref : null);
            }}
            endReached={loadMoreArticles}
            followOutput={articleListFilter === "unread" ? "smooth" : undefined}
            components={{
              Footer: () => <ArticleListFooter isLoadingMore={isFetchingNextPage} />,
              Item: ObservableItem,
            }}
            itemContent={(_, article) => {
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
        </div>
      )}
    </div>
  );
}
