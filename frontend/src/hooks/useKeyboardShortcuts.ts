import { useCallback } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useQueryClient } from "@tanstack/react-query";
import { useReaderStore } from "@/stores/reader";
import { useArticles, useToggleRead, useToggleStar, useMarkAllRead, queryKeys } from "@/api/hooks";

export function useKeyboardShortcuts() {
  const queryClient = useQueryClient();
  const { selectedArticleId, selectedFeedId, articleListFilter, sidebarCollapsed, set: setReader } = useReaderStore();

  const { data: articlesData } = useArticles({
    feed_id: selectedFeedId ?? undefined,
    read_status: articleListFilter === "unread" ? "unread" : undefined,
    starred: articleListFilter === "starred" ? true : undefined,
  });

  const toggleRead = useToggleRead();
  const toggleStar = useToggleStar();
  const markAllRead = useMarkAllRead();

  const articles = articlesData?.items ?? [];
  const currentIndex = articles.findIndex((a) => a.id === selectedArticleId);

  const selectNext = useCallback(() => {
    if (articles.length === 0) return;
    const nextIndex = currentIndex < articles.length - 1 ? currentIndex + 1 : currentIndex;
    const nextArticle = articles[nextIndex];
    if (nextArticle) {
      setReader({ selectedArticleId: nextArticle.id });
      if (!nextArticle.is_read) {
        toggleRead.mutate({ articleId: nextArticle.id, read: true });
      }
    }
  }, [articles, currentIndex, setReader, toggleRead]);

  const selectPrev = useCallback(() => {
    if (articles.length === 0) return;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    const prevArticle = articles[prevIndex];
    if (prevArticle) {
      setReader({ selectedArticleId: prevArticle.id });
    }
  }, [articles, currentIndex, setReader]);

  const toggleCurrentRead = useCallback(() => {
    if (!selectedArticleId) return;
    const article = articles[currentIndex];
    if (article) {
      toggleRead.mutate({ articleId: article.id, read: !article.is_read });
    }
  }, [selectedArticleId, articles, currentIndex, toggleRead]);

  const toggleCurrentStar = useCallback(() => {
    if (!selectedArticleId) return;
    const article = articles[currentIndex];
    if (article) {
      toggleStar.mutate({ articleId: article.id, starred: !article.is_starred });
    }
  }, [selectedArticleId, articles, currentIndex, toggleStar]);

  const refreshFeeds = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.feeds.list() });
    queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
  }, [queryClient]);

  const markAllAsRead = useCallback(() => {
    markAllRead.mutate({ feedId: selectedFeedId ?? undefined });
  }, [markAllRead, selectedFeedId]);

  const toggleSidebar = useCallback(() => {
    setReader({ sidebarCollapsed: !sidebarCollapsed });
  }, [sidebarCollapsed, setReader]);

  const openCommandPalette = useCallback(() => {
    setReader({ commandPaletteOpen: true });
  }, [setReader]);

  useHotkeys("j", selectNext, { scopes: ["reader"] });
  useHotkeys("k", selectPrev, { scopes: ["reader"] });
  useHotkeys("s", toggleCurrentStar, { scopes: ["reader"] });
  useHotkeys("m", toggleCurrentRead, { scopes: ["reader"] });
  useHotkeys("r", refreshFeeds, { scopes: ["reader"] });
  useHotkeys("1", () => setReader({ articleListFilter: "all", selectedArticleId: null }), { scopes: ["reader"] });
  useHotkeys("2", () => setReader({ articleListFilter: "unread", selectedArticleId: null }), { scopes: ["reader"] });
  useHotkeys("3", () => setReader({ articleListFilter: "starred", selectedArticleId: null }), { scopes: ["reader"] });
  useHotkeys("shift+s", toggleSidebar, { scopes: ["reader"] });
  useHotkeys("shift+a", markAllAsRead, { scopes: ["reader"] });
  useHotkeys("mod+k", openCommandPalette);
  useHotkeys("shift+c", () => setReader({ conversationPanelOpen: !useReaderStore.getState().conversationPanelOpen }), { scopes: ["reader"] });
}
