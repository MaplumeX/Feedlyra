import DOMPurify from "dompurify";
import { ExternalLink, Star, BookOpen, RotateCcw, Sparkles, Languages, MessageSquare, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useArticle, useToggleRead, useToggleStar, useSummarize, useTranslate } from "@/api/hooks";
import { useReaderStore } from "@/stores/reader";
import { AIChatPanel } from "@/components/AIChatPanel";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";

const FONT_SIZE_CYCLE: Array<"sm" | "md" | "lg"> = ["sm", "md", "lg"];

const FONT_SIZE_CLASS: Record<"sm" | "md" | "lg", string> = {
  sm: "prose-sm",
  md: "prose",
  lg: "prose-lg",
};

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
  const { selectedArticleId, chatPanelOpen, fontSize } = useReaderStore();
  const { data: article, isLoading } = useArticle(selectedArticleId);
  const toggleRead = useToggleRead();
  const toggleStar = useToggleStar();
  const summarize = useSummarize();
  const translateMut = useTranslate();
  const { set: setReader } = useReaderStore();
  const [showTranslation, setShowTranslation] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");

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

  const cycleFontSize = useCallback(() => {
    const idx = FONT_SIZE_CYCLE.indexOf(fontSize);
    const next = FONT_SIZE_CYCLE[(idx + 1) % FONT_SIZE_CYCLE.length];
    setReader({ fontSize: next });
  }, [fontSize, setReader]);

  // Reset translation view when switching articles
  useEffect(() => {
    setShowTranslation(false);
  }, [selectedArticleId]);

  // Auto-switch to translation view after successful translation
  useEffect(() => {
    if (translateMut.isSuccess && article?.translated_content) {
      setShowTranslation(true);
    }
  }, [translateMut.isSuccess, article?.translated_content]);

  if (!selectedArticleId) return <EmptyState />;
  if (isLoading) return <ArticleDetailSkeleton />;
  if (!article) return <EmptyState />;

  const hasTranslation = !!article.translated_content;
  const displayContent = showTranslation && hasTranslation
    ? article.translated_content
    : article.content;
  const displayTitle = showTranslation && hasTranslation
    ? (article.translated_title ?? article.title)
    : article.title;

  const sanitizedContent = displayContent
    ? DOMPurify.sanitize(displayContent, {
        ADD_TAGS: ["img", "figure", "figcaption", "video", "audio", "source", "iframe"],
        ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "loading", "src", "controls"],
      })
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
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
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => toggleRead.mutate({ articleId: article.id, read: !article.is_read })}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={summarize.isPending}
          onClick={() => summarize.mutate(article.id)}
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
              setShowTranslation(!showTranslation);
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
        <Separator orientation="vertical" className="h-5" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={cycleFontSize}
          title={t("fontSize")}
        >
          <Type className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {fontSize === "sm" ? t("fontSizeSmall") : fontSize === "lg" ? t("fontSizeLarge") : t("fontSizeMedium")}
        </span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1">
          <article className="mx-auto max-w-3xl px-6 py-8">
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
                <Badge variant={showTranslation ? "outline" : "default"} className="cursor-pointer text-xs" onClick={() => setShowTranslation(true)}>
                  {article.translation_lang?.toUpperCase() ?? t("translation")}
                </Badge>
              </div>
            )}

            <Separator className="my-4" />

            {article.summary && (
              <div className="mb-4 rounded-md border bg-muted/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("aiSummary")}
                  {article.summary_model && (
                    <span className="text-xs font-normal">({article.summary_model})</span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{article.summary}</p>
              </div>
            )}

            {sanitizedContent ? (
              <div
                className={cn(
                  "prose prose-slate max-w-none dark:prose-invert",
                  FONT_SIZE_CLASS[fontSize],
                  "[&_img]:mx-auto [&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_img]:cursor-zoom-in"
                )}
                onClick={handleProseClick}
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            ) : article.content_snippet ? (
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
          </article>
        </ScrollArea>

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
