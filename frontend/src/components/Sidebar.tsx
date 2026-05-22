import { useState } from "react";
import {
  Rss,
  Plus,
  RefreshCw,
  Star,
  Clock,
  Trash2,
  ChevronDown,
  MoreHorizontal,
  Settings,
  PanelLeftClose,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AddFeedDialog } from "@/components/AddFeedDialog";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useFeeds, useDeleteFeed, useRefreshFeed, useStarredCount } from "@/api/hooks";
import { useReaderStore } from "@/stores/reader";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { t } = useTranslation("reader");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { selectedFeedId, articleListFilter, set: setReader } = useReaderStore();
  const { data: feeds = [] } = useFeeds();
  const deleteFeed = useDeleteFeed();
  const refreshFeed = useRefreshFeed();

  const totalUnread = feeds.reduce((sum, f) => sum + (f.unread_count ?? 0), 0);
  const totalStarred = useStarredCount();

  const virtualFolders = [
    {
      id: "__all__",
      label: t("allFeeds"),
      icon: <Rss className="h-4 w-4" />,
      count: totalUnread,
      filter: "all" as const,
    },
    {
      id: "__unread__",
      label: t("unread"),
      icon: <Clock className="h-4 w-4" />,
      count: totalUnread,
      filter: "unread" as const,
    },
    {
      id: "__starred__",
      label: t("starred"),
      icon: <Star className="h-4 w-4" />,
      count: totalStarred,
      filter: "starred" as const,
    },
  ];

  function selectVirtualFolder(filter: "all" | "unread" | "starred") {
    setReader({ selectedFeedId: null, articleListFilter: filter, selectedArticleId: null });
  }

  function selectFeed(feedId: string) {
    setReader({ selectedFeedId: feedId, articleListFilter: "all", selectedArticleId: null });
  }

  const isVirtualSelected = !selectedFeedId;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-semibold">{t("feeds")}</span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReader({ sidebarCollapsed: true })} title="Collapse sidebar (Shift+S)">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {virtualFolders.map((vf) => (
            <button
              key={vf.id}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                isVirtualSelected && articleListFilter === vf.filter && "bg-accent font-medium"
              )}
              onClick={() => selectVirtualFolder(vf.filter)}
            >
              {vf.icon}
              <span className="flex-1 text-left">{vf.label}</span>
              {vf.count > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 text-[10px]">
                  {vf.count}
                </Badge>
              )}
            </button>
          ))}

          <Separator className="my-2" />

          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent">
                <ChevronDown className="h-3 w-3" />
                {t("subscriptions")}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 space-y-0.5">
                {feeds.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    {t("noFeedsYet")}
                  </p>
                )}
                {feeds.map((feed) => (
                  <div
                    key={feed.id}
                    className={cn(
                      "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer",
                      selectedFeedId === feed.id && "bg-accent font-medium"
                    )}
                    onClick={() => selectFeed(feed.id)}
                  >
                    <Rss className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{feed.title}</span>
                    {(feed.unread_count ?? 0) > 0 && (
                      <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 text-[10px]">
                        {feed.unread_count}
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            refreshFeed.mutate(feed.id);
                          }}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {t("refresh", { ns: "common" })}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFeed.mutate(feed.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("delete", { ns: "common" })}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      <Separator />

      <div className="px-2 py-1.5">
        <button
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setReader({ settingsDialogOpen: true })}
        >
          <Settings className="h-4 w-4" />
          <span>{t("settings", { ns: "settings" })}</span>
        </button>
      </div>

      <AddFeedDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <SettingsDialog />
    </div>
  );
}
