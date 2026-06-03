import { useState, useRef, useEffect, useMemo } from "react";
import {
  Rss,
  Plus,
  RefreshCw,
  Star,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Settings,
  PanelLeftClose,
  FolderOpen,
  FolderPlus,
  Pencil,
  User,
  LogOut,
  Mail,
  KeyRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AddFeedDialog } from "@/components/AddFeedDialog";
import { FeedSettingsDialog } from "@/components/FeedSettingsDialog";
import { FeedIcon } from "@/components/FeedIcon";
import { FeedSortMenu } from "@/components/FeedSortMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { EditUsernameDialog } from "@/components/settings/EditUsernameDialog";
import { EditEmailDialog } from "@/components/settings/EditEmailDialog";
import { EditPasswordDialog } from "@/components/settings/EditPasswordDialog";
import {
  useFeeds,
  useDeleteFeed,
  useRefreshFeed,
  useStarredCount,
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useUpdateFeed,
  useCurrentUser,
} from "@/api/hooks";
import { toast } from "sonner";
import type { Feed, Category } from "@/api/types";
import { useReaderStore } from "@/stores/reader";
import { useAuthStore } from "@/stores/auth";
import { sortFeeds } from "@/lib/feedSort";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { t } = useTranslation("reader");
  const navigate = useNavigate();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [feedSettingsFeed, setFeedSettingsFeed] = useState<Feed | null>(null);
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editUsernameOpen, setEditUsernameOpen] = useState(false);
  const [editEmailOpen, setEditEmailOpen] = useState(false);
  const [editPasswordOpen, setEditPasswordOpen] = useState(false);

  const renameInputRef = useRef<HTMLInputElement>(null);

  const { selectedFeedId, articleListFilter, feedSort, set: setReader } = useReaderStore();
  const { data: feeds = [] } = useFeeds();
  const { data: categories = [] } = useCategories();
  const deleteFeed = useDeleteFeed();
  const refreshFeed = useRefreshFeed();
  const updateFeed = useUpdateFeed();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const updateCategory = useUpdateCategory(renamingCategoryId ?? "");
  const authUser = useAuthStore((state) => state.user);
  const authLogout = useAuthStore((state) => state.logout);
  const { data: currentUser } = useCurrentUser();
  const user = currentUser ?? authUser;

  const totalUnread = feeds.reduce((sum, f) => sum + (f.unread_count ?? 0), 0);
  const totalStarred = useStarredCount();
  const sortedFeeds = useMemo(() => sortFeeds(feeds, feedSort), [feeds, feedSort]);

  useEffect(() => {
    if (renamingCategoryId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingCategoryId]);

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

  function handleRenameSubmit() {
    if (!renamingCategoryId || !renameValue.trim()) return;
    updateCategory.mutate(renameValue.trim(), {
      onSuccess: () => {
        setRenamingCategoryId(null);
        setRenameValue("");
      },
    });
  }

  function handleCreateCategory() {
    if (!newCategoryTitle.trim()) return;
    createCategory.mutate(newCategoryTitle.trim(), {
      onSuccess: () => {
        setNewCategoryTitle("");
        setCreateDialogOpen(false);
      },
    });
  }

  function handleDeleteCategory(categoryId: string) {
    deleteCategory.mutate(categoryId, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  }

  function startRename(category: Category) {
    setRenamingCategoryId(category.id);
    setRenameValue(category.title);
  }

  function handleMoveFeed(feedId: string, categoryId: string | null) {
    const feed = feeds.find((f) => f.id === feedId);
    if (!feed) return;
    updateFeed.mutate(
      { feedId, title: feed.title, category_id: categoryId },
      { onError: () => toast.error(t("moveFeedFailed")) },
    );
  }

  const uncategorizedFeeds = sortedFeeds.filter((f) => f.category_id === null);

  function renderFeedItem(feed: Feed) {
    return (
      <ContextMenu key={feed.id}>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "group flex w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-r-md px-2 py-1.5 text-sm transition-colors duration-100 hover:bg-sidebar-hover",
              selectedFeedId === feed.id && "bg-sidebar-selected font-medium border-l-2 border-primary"
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
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    {t("moveToCategory")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveFeed(feed.id, null);
                      }}
                    >
                      {t("uncategorized")}
                    </DropdownMenuItem>
                    {categories.map((cat) => (
                      <DropdownMenuItem
                        key={cat.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveFeed(feed.id, cat.id);
                        }}
                      >
                        {cat.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
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
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FolderOpen className="mr-2 h-4 w-4" />
              {t("moveToCategory")}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveFeed(feed.id, null);
                }}
              >
                {t("uncategorized")}
              </ContextMenuItem>
              {categories.map((cat) => (
                <ContextMenuItem
                  key={cat.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveFeed(feed.id, cat.id);
                  }}
                >
                  {cat.title}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
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
    );
  }

  function renderCategoryGroup(category: Category) {
    const categoryFeeds = sortedFeeds.filter((f) => f.category_id === category.id);
    const isRenaming = renamingCategoryId === category.id;

    return (
      <Collapsible key={category.id} defaultOpen>
        <div className="flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-sidebar-hover group/cat">
          <CollapsibleTrigger asChild>
            <button className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
              <ChevronDown className="h-3 w-3 shrink-0 transition-transform duration-200 [[data-state=closed]>&]:-rotate-90" />
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  className="h-5 min-w-0 flex-1 rounded border bg-background px-1 text-xs text-foreground"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit();
                    if (e.key === "Escape") {
                      setRenamingCategoryId(null);
                      setRenameValue("");
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="min-w-0 truncate">{category.title}</span>
              )}
            </button>
          </CollapsibleTrigger>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover/cat:opacity-100 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  startRename(category);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t("renameCategory")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirmId(category.id);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deleteCategory")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CollapsibleContent>
          <div className="mt-0.5 space-y-0.5">
            {categoryFeeds.length === 0 && (
              <p className="px-6 py-1 text-xs text-muted-foreground">{t("noFeedsYet")}</p>
            )}
            {categoryFeeds.map((feed) => renderFeedItem(feed))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-sidebar-bg">
      <div className="flex h-11 min-w-0 items-center justify-between gap-2 border-b px-3">
        <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">{t("feeds")}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReader({ sidebarCollapsed: true })} title="Collapse sidebar (Shift+S)">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
          <FeedSortMenu
            value={feedSort}
            onChange={(nextSort) => setReader({ feedSort: nextSort })}
            labelNamespace="reader"
            buttonClassName="h-7 w-7"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreateDialogOpen(true)} title={t("createCategory")}>
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddDialogOpen(true)} title={t("addFeed")}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-w-0 flex-1">
        <div className="min-w-0 space-y-1 p-2">
          {virtualFolders.map((vf) => (
            <button
              key={vf.id}
              className={cn(
                "flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-sm transition-colors duration-100 hover:bg-sidebar-hover",
                isVirtualSelected && articleListFilter === vf.filter && "bg-sidebar-selected font-medium"
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

          {/* Category groups */}
          {categories.map((category) => renderCategoryGroup(category))}

          {/* Uncategorized group */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <button className="flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-sidebar-hover">
                <ChevronDown className="h-3 w-3 shrink-0 transition-transform duration-200 [[data-state=closed]>&]:-rotate-90" />
                <span className="min-w-0 truncate">{t("uncategorized")}</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-0.5 space-y-0.5">
                {uncategorizedFeeds.length === 0 && (
                  <p className="px-6 py-1 text-xs text-muted-foreground">{t("noFeedsYet")}</p>
                )}
                {uncategorizedFeeds.map((feed) => renderFeedItem(feed))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      <Separator />

      <div className="flex items-center gap-1 px-2 py-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-1 min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-100 hover:bg-sidebar-hover hover:text-foreground">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {user?.username?.charAt(0).toUpperCase() ?? <User className="h-3.5 w-3.5" />}
              </div>
              <span className="min-w-0 truncate">{user?.username ?? ""}</span>
              <ChevronUp className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem onClick={() => setEditUsernameOpen(true)}>
              <User className="mr-2 h-4 w-4" />
              {t("editUsername", { ns: "settings" })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditEmailOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              {t("editEmail", { ns: "settings" })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditPasswordOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" />
              {t("editPassword", { ns: "settings" })}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                authLogout();
                navigate("/login");
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("logout", { ns: "settings" })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors duration-100 hover:bg-sidebar-hover hover:text-foreground"
          onClick={() => setReader({ settingsDialogOpen: true })}
          title={t("settings", { ns: "settings" })}
        >
          <Settings className="h-4 w-4" />
        </button>
        <ThemeToggle />
      </div>

      <AddFeedDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <SettingsDialog />
      <EditUsernameDialog open={editUsernameOpen} onOpenChange={setEditUsernameOpen} />
      <EditEmailDialog open={editEmailOpen} onOpenChange={setEditEmailOpen} />
      <EditPasswordDialog open={editPasswordOpen} onOpenChange={setEditPasswordOpen} />
      {feedSettingsFeed && (
        <FeedSettingsDialog
          feed={feedSettingsFeed}
          open={feedSettingsFeed !== null}
          onOpenChange={(open) => { if (!open) setFeedSettingsFeed(null); }}
        />
      )}

      {/* Create Category Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("createCategory")}</DialogTitle>
            <DialogDescription>{t("categoryName")}</DialogDescription>
          </DialogHeader>
          <Input
            value={newCategoryTitle}
            onChange={(e) => setNewCategoryTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
            placeholder={t("categoryName")}
          />
          {createCategory.isError && (
            <p className="text-sm text-destructive">{createCategory.error.message}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t("cancel", { ns: "common" })}
            </Button>
            <Button onClick={handleCreateCategory} disabled={!newCategoryTitle.trim() || createCategory.isPending}>
              {t("add", { ns: "common" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirm Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteCategory")}</DialogTitle>
            <DialogDescription>{t("deleteCategoryConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {t("cancel", { ns: "common" })}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeleteCategory(deleteConfirmId)}
              disabled={deleteCategory.isPending}
            >
              {t("delete", { ns: "common" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
