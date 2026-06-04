import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle, type ItemProps } from "react-virtuoso";
import { Star, CheckCheck, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FeedIcon } from "@/components/FeedIcon";
import { useInfiniteArticles, useFeeds, useToggleRead, useToggleStar, useMarkAllRead, useBatchRead, useRefreshAllFeeds } from "@/api/hooks";
import { useReaderStore } from "@/stores/reader";
import { cn } from "@/lib/utils";
import type { Article } from "@/api/types";

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

// Module-level holder for the IntersectionObserver instance created in ArticleList.
// This allows the custom Virtuoso Item component to access the observer without prop drilling.
let articleListObserver: IntersectionObserver | null = null;

function ObservableItem({ children, item, ...props }: ItemProps<Article>) {
  const prevElRef = useRef<HTMLDivElement | null>(null);

  // Stable ref callback — article ID is read from data-article-id on the DOM element
  // (set via JSX prop below) so the ref callback doesn't depend on the item prop.
  // This avoids unobserve/reobserve churn on every item data update (e.g. is_read toggling).
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      if (prevElRef.current && prevElRef.current !== el) {
        articleListObserver?.unobserve(prevElRef.current);
      }

      if (el) {
        articleListObserver?.observe(el);
      }

      prevElRef.current = el;
    },
    []
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
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  const currentTotal = data?.pages?.[0]?.total ?? 0;

  // Mark acknowledged as stale on feed/filter change
  useEffect(() => {
    acknowledgedArticleIdsRef.current = new Set();
    hasLoadedRef.current = false;
    setNewArticlesCount(0);
  }, [selectedFeedId, articleListFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also reset on manual refresh / mark-all-read so these don't trigger a false banner
  useEffect(() => {
    if (refreshAll.isSuccess || markAllRead.isSuccess) {
      acknowledgedArticleIdsRef.current = new Set();
      hasLoadedRef.current = false;
      setNewArticlesCount(0);
    }
  }, [refreshAll.isSuccess, markAllRead.isSuccess]);

  // Detect new articles from background refetch: on first load, acknowledge all;
  // on subsequent refetches, find IDs not yet acknowledged.
  useEffect(() => {
    if (isLoading) return;

    const allIds: string[] = [];
    for (const page of data?.pages ?? []) {
      for (const article of page.items) {
        allIds.push(article.id);
      }
    }

    if (!hasLoadedRef.current) {
      // First load: acknowledge everything
      acknowledgedArticleIdsRef.current = new Set(allIds);
      hasLoadedRef.current = true;
      setNewArticlesCount(0);
    } else {
      // Subsequent refetch: find new IDs
      const acknowledged = acknowledgedArticleIdsRef.current;
      const newIds = allIds.filter((id) => !acknowledged.has(id));
      if (newIds.length > 0) {
        setNewArticlesCount(newIds.length);
        // Do NOT add newIds to acknowledged yet — that happens on banner click
      }
    }
  }, [currentTotal, isLoading, data]);

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
  const hasUnread = articles.some((a) => !a.is_read);

  const loadMoreArticles = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Scroll mark read state
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const articlesRef = useRef<readonly Article[]>(articles);
  const scrollMarkReadRef = useRef(scrollMarkRead);
  articlesRef.current = articles;
  scrollMarkReadRef.current = scrollMarkRead;
  const [scrollerElement, setScrollerElement] = useState<HTMLElement | null>(null);

  const flushPendingIds = useCallback(() => {
    const ids = Array.from(pendingIdsRef.current);
    pendingIdsRef.current.clear();
    debounceTimerRef.current = null;
    if (ids.length > 0) {
      batchRead.mutate({ articleIds: ids });
    }
  }, [batchRead]);

  const flushPendingIdsRef = useRef(flushPendingIds);
  flushPendingIdsRef.current = flushPendingIds;

  // IntersectionObserver callback: mark as read when article scrolls past the top
  // Uses refs for scrollMarkRead, articles, and flushPendingIds so the callback identity
  // stays stable — this prevents unnecessary observer recreation which would lose observed elements.
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (!scrollMarkReadRef.current) return;

      for (const entry of entries) {
        // Only trigger when article leaves viewport (was visible, now not)
        if (entry.isIntersecting) continue;

        // Only mark if scrolled out through the top (boundingClientRect.top above root top)
        const rootBounds = entry.rootBounds;
        if (!rootBounds) continue;
        if (entry.boundingClientRect.top >= rootBounds.top) continue;

        const articleId = (entry.target as HTMLElement).dataset.articleId;
        if (!articleId) continue;

        // Look up article to check if unread
        const article = articlesRef.current.find((a) => a.id === articleId);
        if (article && !article.is_read) {
          pendingIdsRef.current.add(articleId);
        }
      }

      if (pendingIdsRef.current.size > 0) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(flushPendingIdsRef.current, 300);
      }
    },
    []
  );

  // Create/recreate IntersectionObserver when the scroller element becomes available
  useEffect(() => {
    if (!scrollerElement) return;

    // Disconnect existing observer if any
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: scrollerElement,
      rootMargin: "-44px 0px 0px 0px",
      threshold: 0,
    });
    articleListObserver = observerRef.current;

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      articleListObserver = null;
    };
  }, [scrollerElement]);

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
            scrollerRef={(ref) => {
              if (ref && 'nodeType' in ref) {
                setScrollerElement(ref as HTMLElement);
              }
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
