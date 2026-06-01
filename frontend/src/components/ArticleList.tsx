import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GroupedVirtuoso } from "react-virtuoso";
import { Star, CheckCheck, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FeedIcon } from "@/components/FeedIcon";
import { useArticles, useFeeds, useToggleRead, useToggleStar, useMarkAllRead, useBatchRead, useRefreshAllFeeds } from "@/api/hooks";
import { useReaderStore } from "@/stores/reader";
import { cn } from "@/lib/utils";
import type { Article } from "@/api/types";

function formatDate(dateStr: string | null, lng: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return i18next.t("common:today");
  if (diffDays === 1) return i18next.t("common:yesterday");
  return date.toLocaleDateString(lng, { month: "short", day: "numeric" });
}

function groupByDate(articles: Article[], lng: string): { label: string; articles: Article[] }[] {
  const groups: Map<string, Article[]> = new Map();
  for (const article of articles) {
    const label = formatDate(article.published_at, lng);
    const existing = groups.get(label);
    if (existing) {
      existing.push(article);
    } else {
      groups.set(label, [article]);
    }
  }
  return Array.from(groups.entries()).map(([label, arts]) => ({ label, articles: arts }));
}

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
        "flex cursor-pointer flex-row border-b px-3 py-2 transition-colors hover:bg-accent/50",
        isSelected && "bg-accent",
        !article.is_read && "font-medium"
      )}
      onClick={onSelect}
    >
      <div className={cn("flex flex-col gap-0.5", showImage ? "flex-1 min-w-0" : "w-full")}>
        {article.feed_title && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FeedIcon iconUrl={feedIconUrl} className="h-3 w-3" />
            <span className="min-w-0 flex-1 truncate">{article.feed_title}</span>
          </div>
        )}
        <div className="flex items-start gap-2">
          {!article.is_read && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
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
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {article.content_snippet}
          </span>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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

export function ArticleList() {
  const { t, i18n } = useTranslation("reader");
  const { selectedFeedId, selectedArticleId, articleListFilter, scrollMarkRead, set: setReader } = useReaderStore();

  const queryParams = useMemo(() => {
    const params: { feed_id?: string; read_status?: string; starred?: boolean } = {};
    if (selectedFeedId) params.feed_id = selectedFeedId;
    if (articleListFilter === "unread") params.read_status = "unread";
    if (articleListFilter === "starred") params.starred = true;
    return params;
  }, [selectedFeedId, articleListFilter]);

  const { data, isLoading } = useArticles(queryParams);
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

  const articles = data?.items ?? [];
  const hasUnread = articles.some((a) => !a.is_read);
  const grouped = groupByDate(articles, i18n.language);
  const groupCounts = useMemo(() => grouped.map(g => g.articles.length), [grouped]);

  /** Map a GroupedVirtuoso absolute item index (includes group headers) to the corresponding article.
   *  Returns undefined if the index points to a group header or is out of range. */
  function getArticleByAbsoluteIndex(absoluteIndex: number): Article | undefined {
    let pos = absoluteIndex;
    for (const group of grouped) {
      // pos 0 within this group segment = header
      if (pos === 0) return undefined; // this is a group header
      pos -= 1; // skip the header
      if (pos < group.articles.length) {
        return group.articles[pos];
      }
      pos -= group.articles.length;
    }
    return undefined;
  }

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
        const article = getArticleByAbsoluteIndex(i);
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
    [scrollMarkRead, grouped, flushPendingIds]
  );

  function selectArticle(article: Article) {
    setReader({ selectedArticleId: article.id });
    if (!article.is_read) {
      toggleRead.mutate({ articleId: article.id, read: true });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <Tabs
          value={articleListFilter}
          onValueChange={(v) =>
            setReader({ articleListFilter: v as "all" | "unread" | "starred", selectedArticleId: null })
          }
        >
          <TabsList className="h-8">
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
      ) : grouped.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t("noArticles")}
        </div>
      ) : (
        <GroupedVirtuoso
          className="flex-1"
          groupCounts={groupCounts}
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
          rangeChanged={rangeChanged}
          followOutput={articleListFilter === "unread" ? "smooth" : undefined}
          itemContent={(index, groupIndex) => {
            const article = grouped[groupIndex]?.articles[index];
            if (!article) return null;
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
