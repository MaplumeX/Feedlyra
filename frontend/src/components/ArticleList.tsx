import { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { Star, CheckCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useArticles, useToggleRead, useToggleStar, useMarkAllRead } from "@/api/hooks";
import { useReaderStore } from "@/stores/reader";
import { cn } from "@/lib/utils";
import type { Article } from "@/api/types";

type FlatItem =
  | { type: "header"; label: string }
  | { type: "article"; article: Article };

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupByDate(articles: Article[]): { label: string; articles: Article[] }[] {
  const groups: Map<string, Article[]> = new Map();
  for (const article of articles) {
    const label = formatDate(article.published_at);
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
        {article.author && <span>by {article.author}</span>}
        {article.published_at && (
          <span>{new Date(article.published_at).toLocaleDateString()}</span>
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
  const { selectedFeedId, selectedArticleId, articleListFilter, set: setReader } = useReaderStore();

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

  const articles = data?.items ?? [];
  const hasUnread = articles.some((a) => !a.is_read);
  const grouped = groupByDate(articles);

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
            <TabsTrigger value="all" className="text-xs px-2">All</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs px-2">Unread</TabsTrigger>
            <TabsTrigger value="starred" className="text-xs px-2">Starred</TabsTrigger>
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
            Mark All Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <ArticleListSkeleton />
      ) : flatItems.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No articles
        </div>
      ) : (
        <Virtuoso
          className="flex-1"
          data={flatItems}
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
