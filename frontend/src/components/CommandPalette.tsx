import { useCallback } from "react";
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
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { queryKeys, useMarkAllRead, useSummarize, useTranslate } from "@/api/hooks";

export function CommandPalette() {
  const { commandPaletteOpen, set: setReader, selectedArticleId, sidebarCollapsed, selectedFeedId } = useReaderStore();
  const queryClient = useQueryClient();
  const markAllRead = useMarkAllRead();
  const summarize = useSummarize();
  const translateMut = useTranslate();

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

  const refreshFeeds = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.feeds.list() });
    queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
  }, [queryClient]);

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setOpen}>
      <CommandInput placeholder="Search articles, feeds, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runAndClose(() => setReader({ selectedFeedId: null, articleListFilter: "all", selectedArticleId: null }))}>
            <Rss className="mr-2 h-4 w-4" />
            All Feeds
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setReader({ selectedFeedId: null, articleListFilter: "unread", selectedArticleId: null }))}>
            <Clock className="mr-2 h-4 w-4" />
            Unread
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setReader({ selectedFeedId: null, articleListFilter: "starred", selectedArticleId: null }))}>
            <Star className="mr-2 h-4 w-4" />
            Starred
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            disabled={markAllRead.isPending}
            onSelect={() => runAndClose(() => markAllRead.mutate({ feedId: selectedFeedId ?? undefined }))}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark All as Read
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(refreshFeeds)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Feeds
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setReader({ sidebarCollapsed: !sidebarCollapsed }))}>
            <PanelLeftClose className="mr-2 h-4 w-4" />
            Toggle Sidebar
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(() => setReader({ chatPanelOpen: true }))}>
            <Settings className="mr-2 h-4 w-4" />
            AI Settings
          </CommandItem>
        </CommandGroup>

        {selectedArticleId && (
          <>
            <CommandSeparator />
            <CommandGroup heading="AI">
              <CommandItem
                disabled={summarize.isPending}
                onSelect={() => runAndClose(() => summarize.mutate(selectedArticleId))}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Summarize Current Article
              </CommandItem>
              <CommandItem
                disabled={translateMut.isPending}
                onSelect={() => runAndClose(() => translateMut.mutate({ articleId: selectedArticleId }))}
              >
                <Languages className="mr-2 h-4 w-4" />
                Translate Current Article
              </CommandItem>
              <CommandItem onSelect={() => runAndClose(() => setReader({ chatPanelOpen: true }))}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Open AI Chat
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
