import { useCallback, useEffect, useMemo, useRef } from "react";
import { Virtuoso } from "react-virtuoso";
import { Star, CheckCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18next from "i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useArticles, useToggleRead, useToggleStar, useMarkAllRead, useBatchRead } from "@/api/hooks";
import { useReaderStore } from "@/stores/reader";
import { cn } from "@/lib/utils";
import type { Article } from "@/api/types";

type FlatItem =
  | { type: "header"; label: string }
  | { type: "article"; article: Article };

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
  isSelected,
  onSelect,
}: {
  article: Article;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation("reader");
  const toggleStar = useToggleStar();

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 border-b px-3 py-2 transition-colors hover:bg-accent/50",
        isSelected && "bg-accent",
        !article.is_read && "font-medium"
      )}
      onClick={onSelect}
    >
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
      <div className="flex items-center gap-2 pl-4 text-xs text-muted-foreground">
        {article.feed_title && <span className="truncate">{article.feed_title}</span>}
        {article.author && <span>{t("by", { author: article.author })}</span>}
        {article.published_at && (
          <span>{new Date(article.published_at).toLocaleDateString(i18n.language)}</span>
        )}
      </div>
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
  const toggleRead = useToggleRead();
  const markAllRead = useMarkAllRead();
  const batchRead = useBatchRead();

  const articles = data?.items ?? [];
  const hasUnread = articles.some((a) => !a.is_read);
  const grouped = groupByDate(articles, i18n.language);

  const flatItems: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    for (const group of grouped) {
      items.push({ type: "header", label: group.label });
      for (const article of group.articles) {
        items.push({ type: "article", article });
      }
    }
    return items;
  }, [grouped]);

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
        const item = flatItems[i];
        if (item && item.type === "article" && !item.article.is_read) {
          pendingIdsRef.current.add(item.article.id);
        }
      }

      if (pendingIdsRef.current.size > 0) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(flushPendingIds, 300);
      }
    },
    [scrollMarkRead, flatItems, flushPendingIds]
  );

  function selectArticle(article: Article) {
    setReader({ selectedArticleId: article.id });
    if (!article.is_read) {
      toggleRead.mutate({ articleId: article.id, read: true });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2 flex items-center gap-2">
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
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 ml-auto text-xs"
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
      ) : flatItems.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t("noArticles")}
        </div>
      ) : (
        <Virtuoso
          className="flex-1"
          data={flatItems}
          rangeChanged={rangeChanged}
          followOutput={articleListFilter === "unread" ? "smooth" : undefined}
          itemContent={(_index, item) => {
            if (item.type === "header") {
              return (
                <div className="sticky top-0 z-10 bg-background px-3 py-1 text-xs font-medium text-muted-foreground border-b">
                  {item.label}
                </div>
              );
            }
            return (
              <ArticleRow
                article={item.article}
                isSelected={selectedArticleId === item.article.id}
                onSelect={() => selectArticle(item.article)}
              />
            );
          }}
        />
      )}
    </div>
  );
}
