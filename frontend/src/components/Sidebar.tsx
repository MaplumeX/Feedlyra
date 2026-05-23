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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AddFeedDialog } from "@/components/AddFeedDialog";
import { FeedSettingsDialog } from "@/components/FeedSettingsDialog";
import { FeedIcon } from "@/components/FeedIcon";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useFeeds, useDeleteFeed, useRefreshFeed, useStarredCount } from "@/api/hooks";
import type { Feed } from "@/api/types";
import { useReaderStore } from "@/stores/reader";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { t } = useTranslation("reader");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [feedSettingsFeed, setFeedSettingsFeed] = useState<Feed | null>(null);
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
      icon: <Rss className="h-4 w-4 shrink-0" />,
      count: totalUnread,
      filter: "all" as const,
    },
    {
      id: "__unread__",
      label: t("unread"),
      icon: <Clock className="h-4 w-4 shrink-0" />,
      count: totalUnread,
      filter: "unread" as const,
    },
    {
      id: "__starred__",
      label: t("starred"),
      icon: <Star className="h-4 w-4 shrink-0" />,
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
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-2">
        <span className="min-w-0 truncate text-sm font-semibold">{t("feeds")}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReader({ sidebarCollapsed: true })} title="Collapse sidebar (Shift+S)">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="min-w-0 space-y-1 p-2">
          {virtualFolders.map((vf) => (
            <button
              key={vf.id}
              className={cn(
                "flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                isVirtualSelected && articleListFilter === vf.filter && "bg-accent font-medium"
              )}
              onClick={() => selectVirtualFolder(vf.filter)}
            >
              {vf.icon}
              <span className="min-w-0 flex-1 truncate text-left">{vf.label}</span>
              {vf.count > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 max-w-14 shrink-0 justify-center truncate px-1 text-[10px]">
                  {vf.count}
                </Badge>
              )}
            </button>
          ))}

          <Separator className="my-2" />

          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <button className="flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent">
                <ChevronDown className="h-3 w-3 shrink-0" />
                <span className="min-w-0 truncate">{t("subscriptions")}</span>
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
                  <ContextMenu key={feed.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        className={cn(
                          "group flex w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                          selectedFeedId === feed.id && "bg-accent font-medium"
                        )}
                        onClick={() => selectFeed(feed.id)}
                      >
                        <FeedIcon iconUrl={feed.icon_url} className="h-3.5 w-3.5" />
                        <span className="min-w-0 flex-1 truncate">{feed.title}</span>
                        {(feed.unread_count ?? 0) > 0 && (
                          <Badge variant="secondary" className="h-5 min-w-5 max-w-14 shrink-0 justify-center truncate px-1 text-[10px]">
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setFeedSettingsFeed(feed);
                              }}
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              {t("feedSettings")}
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
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          refreshFeed.mutate(feed.id);
                        }}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {t("refresh", { ns: "common" })}
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setFeedSettingsFeed(feed);
                        }}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        {t("feedSettings")}
                      </ContextMenuItem>
                      <ContextMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFeed.mutate(feed.id);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("delete", { ns: "common" })}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <Separator />

      <div className="px-2 py-1.5">
        <button
          className="flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setReader({ settingsDialogOpen: true })}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">{t("settings", { ns: "settings" })}</span>
        </button>
      </div>

      <AddFeedDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <SettingsDialog />
      {feedSettingsFeed && (
        <FeedSettingsDialog
          feed={feedSettingsFeed}
          open={feedSettingsFeed !== null}
          onOpenChange={(open) => { if (!open) setFeedSettingsFeed(null); }}
        />
      )}
    </div>
  );
}
