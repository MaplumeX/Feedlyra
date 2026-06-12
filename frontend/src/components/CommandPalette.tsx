import { useCallback, useRef } from "react";
import {
  Rss,
  Clock,
  Star,
  CheckCheck,
  RefreshCw,
  PanelLeftClose,
  Settings,
  Sparkles,
  Languages,
  MessageSquare,
  Download,
  Upload,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useReaderStore } from "@/stores/reader";
import {
  useMarkAllRead,
  useSummarize,
  useTranslate,
  useExportOPML,
  useImportOPML,
  useRefreshAllFeeds,
  useIsFeedRefreshPending,
} from "@/api/hooks";

export function CommandPalette() {
  const { t } = useTranslation("reader");
  const { commandPaletteOpen, set: setReader, selectedArticleId, sidebarCollapsed, selectedFeedId } = useReaderStore();
  const markAllRead = useMarkAllRead();
  const refreshAll = useRefreshAllFeeds();
  const isFeedRefreshPending = useIsFeedRefreshPending();
  const summarize = useSummarize();
  const translateMut = useTranslate();
  const exportOPML = useExportOPML();
  const importOPML = useImportOPML();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setOpen = useCallback(
    (open: boolean) => setReader({ commandPaletteOpen: open }),
    [setReader]
  );

  const runAndClose = useCallback(
    (fn: () => void) => {
      setOpen(false);
      fn();
    },
    [setOpen]
  );

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const feeds = await importOPML.mutateAsync(file);
      toast.success(t("opmlImportSuccess", { ns: "settings", count: feeds.length }));
    } catch {
      toast.error(t("opmlImportFailed", { ns: "settings" }));
    }
  }, [importOPML, t]);

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setOpen}>
      <CommandInput placeholder={t("searchPlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("noResultsFound", { ns: "common" })}</CommandEmpty>

        <CommandGroup heading={t("navigation")}>
          <CommandItem onSelect={() => runAndClose(() => setReader({ selectedFeedId: null, articleListFilter: "all", selectedArticleId: null }))}>
            <Rss className="mr-2 h-4 w-4" />
            {t("allFeeds")}
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setReader({ selectedFeedId: null, articleListFilter: "unread", selectedArticleId: null }))}>
            <Clock className="mr-2 h-4 w-4" />
            {t("unread")}
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setReader({ selectedFeedId: null, articleListFilter: "starred", selectedArticleId: null }))}>
            <Star className="mr-2 h-4 w-4" />
            {t("starred")}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("actions")}>
          <CommandItem
            disabled={markAllRead.isPending}
            onSelect={() => runAndClose(() => markAllRead.mutate({ feedId: selectedFeedId ?? undefined }))}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            {t("markAllAsRead")}
          </CommandItem>
          <CommandItem
            disabled={isFeedRefreshPending}
            onSelect={() => runAndClose(() => refreshAll.mutate())}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("refreshFeeds")}
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setReader({ sidebarCollapsed: !sidebarCollapsed }))}>
            <PanelLeftClose className="mr-2 h-4 w-4" />
            {t("toggleSidebar")}
          </CommandItem>
          <CommandItem
            disabled={exportOPML.isPending}
            onSelect={() => runAndClose(async () => {
              try {
                const result = await exportOPML.mutateAsync();
                const blob = new Blob([result.xml], { type: "application/xml" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "feeds.opml";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success(t("opmlExportSuccess", { ns: "settings" }));
              } catch {
                toast.error(t("opmlExportFailed", { ns: "settings" }));
              }
            })}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("exportOPML")}
          </CommandItem>
          <CommandItem
            onSelect={() => runAndClose(() => fileInputRef.current?.click())}
          >
            <Upload className="mr-2 h-4 w-4" />
            {t("importOPML")}
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setReader({ settingsDialogOpen: true }))}>
            <Settings className="mr-2 h-4 w-4" />
            {t("aiSettings")}
          </CommandItem>
        </CommandGroup>

        {selectedArticleId && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("ai")}>
              <CommandItem
                disabled={summarize.isPending}
                onSelect={() => runAndClose(() => summarize.mutate({ articleId: selectedArticleId, source: "feed" }))}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {t("summarizeCurrentArticle")}
              </CommandItem>
              <CommandItem
                disabled={translateMut.isPending}
                onSelect={() => runAndClose(() => translateMut.mutate({ articleId: selectedArticleId }))}
              >
                <Languages className="mr-2 h-4 w-4" />
                {t("translateCurrentArticle")}
              </CommandItem>
              <CommandItem onSelect={() => runAndClose(() => {
                const state = useReaderStore.getState();
                setReader({ chatPanelOpen: true, chatPanelMode: state.chatPanelMode });
              })}>
                <MessageSquare className="mr-2 h-4 w-4" />
                {t("openAiChat")}
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
      <input ref={fileInputRef} type="file" accept=".opml,.xml" className="hidden" onChange={handleImportFile} />
    </CommandDialog>
  );
}
