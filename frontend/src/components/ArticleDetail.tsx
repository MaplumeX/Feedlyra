import DOMPurify from "dompurify";
import { toast } from "sonner";
import { ExternalLink, Star, BookOpen, Circle, Check, Sparkles, Languages, MessageSquare, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useArticle, useToggleRead, useToggleStar, useSummarize, useTranslate, useAIConfig, useExtractContent } from "@/api/hooks";
import { useReaderStore } from "@/stores/reader";
import { AIChatPanel } from "@/components/AIChatPanel";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ReadingSettingsPopover, getFontStack } from "@/components/ReadingSettingsPopover";
import { ArticleTableOfContents, createArticleContentWithAnchors } from "@/components/ArticleTableOfContents";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ArticleSummarySource } from "@/api/types";

function ArticleDetailSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-3/4" />
      <div className="flex gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Separator />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation("reader");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <BookOpen className="h-12 w-12" />
      <p className="text-sm">{t("selectArticle")}</p>
    </div>
  );
}

export function ArticleDetail() {
  const { t, i18n } = useTranslation("reader");
  const { selectedArticleId, chatPanelOpen, readerSettings, autoSummarize } = useReaderStore();
  const { data: article, isLoading } = useArticle(selectedArticleId);
  const toggleRead = useToggleRead();
  const toggleStar = useToggleStar();
  const summarize = useSummarize();
  const translateMut = useTranslate();
  const extractContent = useExtractContent();
  const { data: aiConfig } = useAIConfig();
  const { set: setReader } = useReaderStore();
  const [showTranslation, setShowTranslation] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");
  const [scrollViewport, setScrollViewport] = useState<HTMLDivElement | null>(null);
  const [articleElement, setArticleElement] = useState<HTMLElement | null>(null);
  const autoSummarizeTriggeredRef = useRef<string | null>(null);

  const setScrollViewportRef = useCallback((node: HTMLDivElement | null) => {
    setScrollViewport(node);
  }, []);

  const setArticleElementRef = useCallback((node: HTMLElement | null) => {
    setArticleElement(node);
  }, []);

  const proseStyle: Record<string, string> = useMemo(() => ({
    fontSize: `${readerSettings.fontSize}px`,
    fontFamily: getFontStack(readerSettings.fontFamily),
    lineHeight: String(readerSettings.lineHeight),
    letterSpacing: `${readerSettings.letterSpacing}em`,
    "--prose-p-spacing": `${readerSettings.paragraphSpacing}em`,
  }), [readerSettings]);

  const handleProseClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLImageElement) {
      setLightboxSrc(e.target.src);
      setLightboxAlt(e.target.alt ?? "");
    }
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxSrc(null);
  }, []);

  useEffect(() => {
    if (!lightboxSrc) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxSrc, closeLightbox]);

  // Reset translation view when switching articles
  useEffect(() => {
    setShowTranslation(false);
    setShowFullContent(false);
  }, [selectedArticleId]);

  // Auto-summarize uses feed content only; full-content summaries are generated on demand.
  useEffect(() => {
    if (!article || !autoSummarize || article.summaries?.feed) return;
    if (summarize.isPending) return;
    if (autoSummarizeTriggeredRef.current === article.id) return;
    const aiReady = aiConfig?.base_url && aiConfig?.has_api_key && aiConfig?.model;
    if (!aiReady) return;
    autoSummarizeTriggeredRef.current = article.id;
    summarize.mutate({ articleId: article.id, source: "feed" });
  }, [article, autoSummarize, aiConfig, summarize]);

  // Reset auto-summarize trigger ref when article changes
  useEffect(() => {
    autoSummarizeTriggeredRef.current = null;
  }, [selectedArticleId]);

  // Auto-switch to translation view after successful translation
  useEffect(() => {
    if (translateMut.isSuccess && article?.translated_content) {
      setShowTranslation(true);
      setShowFullContent(false);
    }
  }, [translateMut.isSuccess, article?.translated_content]);

  const hasTranslation = !!article?.translated_content;
  const hasFullContent = !!article?.full_content;
  const summarySource: ArticleSummarySource = showFullContent && hasFullContent ? "full" : "feed";
  const currentSummary = article?.summaries?.[summarySource] ?? null;
  const displayContent = !article
    ? null
    : showTranslation && hasTranslation
    ? article.translated_content
    : showFullContent && hasFullContent
    ? article.full_content
    : article.content;
  const displayTitle = article && showTranslation && hasTranslation
    ? (article.translated_title ?? article.title)
    : article?.title ?? "";

  const articleContent = useMemo(() => {
    if (!displayContent) {
      return { html: null, tocItems: [] };
    }

    const sanitized = DOMPurify.sanitize(displayContent, {
        ADD_TAGS: ["img", "figure", "figcaption", "video", "audio", "source", "iframe"],
        ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "loading", "src", "controls"],
      });
    const anchoredContent = createArticleContentWithAnchors(sanitized);
    return { html: anchoredContent.html, tocItems: anchoredContent.items };
  }, [displayContent]);

  if (!selectedArticleId) return <EmptyState />;
  if (isLoading) return <ArticleDetailSkeleton />;
  if (!article) return <EmptyState />;

  const sanitizedContent = articleContent.html;
  const tocItems = articleContent.tocItems;
  const readToggleLabel = article.is_read ? t("markAsUnread") : t("markAsRead");

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => toggleStar.mutate({ articleId: article.id, starred: !article.is_starred })}
        >
          <Star
            className={cn("h-4 w-4", article.is_starred && "fill-primary text-primary")}
          />
        </Button>
        <Button
          variant={article.is_read ? "ghost" : "secondary"}
          size="icon"
          className="h-8 w-8"
          disabled={toggleRead.isPending}
          title={readToggleLabel}
          aria-label={readToggleLabel}
          onClick={() => toggleRead.mutate({ articleId: article.id, read: !article.is_read })}
        >
          {article.is_read ? (
            <Circle className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4 text-primary" />
          )}
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={summarize.isPending}
          onClick={() => summarize.mutate({ articleId: article.id, source: summarySource })}
          title={t("aiSummarize")}
        >
          <Sparkles className={cn("h-4 w-4", summarize.isPending && "animate-spin")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={translateMut.isPending}
          onClick={() => {
            if (hasTranslation) {
              const nextShowTranslation = !showTranslation;
              setShowTranslation(nextShowTranslation);
              if (nextShowTranslation) setShowFullContent(false);
            } else {
              translateMut.mutate({ articleId: article.id });
            }
          }}
          title={hasTranslation ? (showTranslation ? t("showOriginal") : t("showTranslation")) : t("aiTranslate")}
        >
          <Languages className={cn("h-4 w-4", translateMut.isPending && "animate-spin")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setReader({ chatPanelOpen: !chatPanelOpen })}
          title={t("aiChat")}
        >
          <MessageSquare className={cn("h-4 w-4", chatPanelOpen && "text-primary")} />
        </Button>
        <Button
          variant={showFullContent ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          disabled={extractContent.isPending}
          onClick={() => {
            if (showFullContent) {
              setShowFullContent(false);
              return;
            }
            setShowTranslation(false);
            if (hasFullContent) {
              setShowFullContent(true);
              return;
            }
            extractContent.mutate(article.id, {
              onSuccess: (updatedArticle) => {
                if (updatedArticle.full_content) {
                  setShowFullContent(true);
                }
              },
              onError: () => toast.error(t("extractFailed")),
            });
          }}
          title={
            extractContent.isPending
              ? t("extractingContent")
              : showFullContent
              ? t("showFeedContent")
              : hasFullContent
              ? t("showFullContent")
              : t("extractFullContent")
          }
          aria-pressed={showFullContent}
        >
          <FileText
            className={cn(
              "h-4 w-4",
              extractContent.isPending && "animate-spin",
              showFullContent && !extractContent.isPending && "text-primary"
            )}
          />
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <ReadingSettingsPopover />
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1" viewportRef={setScrollViewportRef}>
          <article
            ref={setArticleElementRef}
            className="mx-auto px-6 py-8"
            style={{ maxWidth: `${readerSettings.contentWidth}px` }}
          >
            <h1 className="text-2xl font-bold leading-tight">{displayTitle}</h1>

            <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
              {article.feed_title && <span>{article.feed_title}</span>}
              {article.author && <span>{t("by", { author: article.author })}</span>}
              {article.published_at && (
                <time dateTime={article.published_at}>
                  {new Date(article.published_at).toLocaleDateString(i18n.language, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              )}
            </div>

            {hasTranslation && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={showTranslation ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setShowTranslation(false)}>
                  {t("original")}
                </Badge>
                <Badge
                  variant={showTranslation ? "outline" : "default"}
                  className="cursor-pointer text-xs"
                  onClick={() => {
                    setShowTranslation(true);
                    setShowFullContent(false);
                  }}
                >
                  {article.translation_lang?.toUpperCase() ?? t("translation")}
                </Badge>
              </div>
            )}

            <Separator className="my-4" />

            {summarize.isPending && !currentSummary && (
              <div className="mb-4 rounded-md border bg-muted/50 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                  {t("generatingSummary")}
                </div>
              </div>
            )}

            {currentSummary && (
              <div className="mb-4 rounded-md border bg-muted/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("aiSummary")}
                  {currentSummary.model && (
                    <span className="text-xs font-normal">({currentSummary.model})</span>
                  )}
                </div>
                <MarkdownContent content={currentSummary.summary} />
              </div>
            )}

            {sanitizedContent ? (
              <div
                className="prose prose-slate max-w-none dark:prose-invert [&_img]:mx-auto [&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_img]:cursor-zoom-in [&_p]:mb-[var(--prose-p-spacing,1.25em)]"
                style={proseStyle}
                onClick={handleProseClick}
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            ) : (
              <>
                {article.content_snippet ? (
                  <p className="text-sm text-muted-foreground">{article.content_snippet}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("noContent")}{" "}
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      {t("readOnOriginalSite")}
                    </a>
                  </p>
                )}
              </>
            )}
          </article>
        </ScrollArea>

        <ArticleTableOfContents
          items={tocItems}
          scrollViewport={scrollViewport}
          articleElement={articleElement}
          forceCompact={chatPanelOpen}
          reservedRight={chatPanelOpen ? 320 : 0}
        />

        {chatPanelOpen && selectedArticleId && (
          <AIChatPanel articleId={selectedArticleId} articleTitle={article.title} />
        )}
      </div>

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={closeLightbox}
        >
          <img
            src={lightboxSrc}
            alt={lightboxAlt}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
