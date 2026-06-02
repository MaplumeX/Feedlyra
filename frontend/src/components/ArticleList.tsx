import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
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
  if (!isLoadingMore) return null;

  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
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

      for (const page of data?.pages ?? []) {
        for (const article of page.items) {
          if (seen.has(article.id)) continue;
          seen.add(article.id);
          flattened.push(article);
        }
      }

      return flattened;
    },
    [data]
  );
  const hasUnread = articles.some((a) => !a.is_read);

  const loadMoreArticles = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Scroll mark read state
  const prevRangeRef = useRef<{ startIndex: number; endIndex: number } | null>(null);
  const isStableRef = useRef(false);
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset scroll tracking when feed/filter changes to avoid stale range
  useEffect(() => {
    isStableRef.current = false;
    prevRangeRef.current = null;
  }, [selectedFeedId, articleListFilter]);

  const flushPendingIds = useCallback(() => {
    const ids = Array.from(pendingIdsRef.current);
    pendingIdsRef.current.clear();
    debounceTimerRef.current = null;
    if (ids.length > 0) {
      batchRead.mutate({ articleIds: ids });
    }
  }, [batchRead]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const rangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (!scrollMarkRead) return;

      // Skip the initial range change to avoid marking on mount/resize
      if (!isStableRef.current) {
        isStableRef.current = true;
        prevRangeRef.current = range;
        return;
      }

      const prev = prevRangeRef.current;
      prevRangeRef.current = range;

      if (!prev) return;

      // Only trigger when scrolling down: startIndex increases
      // (items above the viewport have been scrolled past)
      if (range.startIndex <= prev.startIndex) return;

      // Collect unread article IDs that were scrolled past (between prev.startIndex and range.startIndex - 1)
      for (let i = prev.startIndex; i < range.startIndex; i++) {
        const article = articles[i];
        if (article && !article.is_read) {
          pendingIdsRef.current.add(article.id);
        }
      }

      if (pendingIdsRef.current.size > 0) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(flushPendingIds, 300);
      }
    },
    [scrollMarkRead, articles, flushPendingIds]
  );

  function selectArticle(article: Article) {
    setReader({ selectedArticleId: article.id });
    if (!article.is_read) {
      toggleRead.mutate({ articleId: article.id, read: true });
    }
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
        <Virtuoso
          className="flex-1"
          data={articles}
          rangeChanged={rangeChanged}
          endReached={loadMoreArticles}
          followOutput={articleListFilter === "unread" ? "smooth" : undefined}
          components={{
            Footer: () => <ArticleListFooter isLoadingMore={isFetchingNextPage} />,
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
      )}
    </div>
  );
}
