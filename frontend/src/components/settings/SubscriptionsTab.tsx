import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download, ListChecks, Loader2, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useFeeds,
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useDeleteFeed,
  useBulkMoveFeeds,
  useBulkDeleteFeeds,
  useImportOPML,
  useExportOPML,
  useRefreshAllFeeds,
  useFeedJobStatus,
  queryKeys,
} from "@/api/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { FeedIcon } from "@/components/FeedIcon";
import { FeedSortMenu } from "@/components/FeedSortMenu";
import { FeedSettingsDialog } from "@/components/FeedSettingsDialog";
import type { Feed, Category } from "@/api/types";
import { sortFeeds } from "@/lib/feedSort";
import { useReaderStore } from "@/stores/reader";

export function SubscriptionsTab() {
  const { t } = useTranslation("settings");
  const { data: feeds = [], isLoading: feedsLoading } = useFeeds();
  const { data: categories = [] } = useCategories();
  const { feedSort, set: setReader } = useReaderStore();
  const createCategory = useCreateCategory();
  const deleteFeed = useDeleteFeed();
  const deleteCategory = useDeleteCategory();
  const importOPML = useImportOPML();
  const exportOPML = useExportOPML();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const sortedFeeds = useMemo(() => sortFeeds(feeds, feedSort), [feeds, feedSort]);

  // Category editing state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryTitle, setEditingCategoryTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");

  const updateCategory = useUpdateCategory(editingCategoryId ?? "");

  // Feed editing state
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);
  const [feedDialogOpen, setFeedDialogOpen] = useState(false);
  const [deleteFeedConfirmId, setDeleteFeedConfirmId] = useState<string | null>(null);

  // Bulk edit state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const bulkMove = useBulkMoveFeeds();
  const bulkDelete = useBulkDeleteFeeds();

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function toggleFeedSelected(feedId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(feedId);
      else next.delete(feedId);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(sortedFeeds.map((f) => f.id)));
  }

  async function handleBulkMove(categoryId: string | null) {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const categoryName =
      categoryId === null
        ? t("uncategorized")
        : categories.find((c) => c.id === categoryId)?.title ?? t("uncategorized");
    try {
      const result = await bulkMove.mutateAsync({ feedIds: ids, categoryId });
      if (result.not_found.length) console.warn("Bulk move not_found ids:", result.not_found);
      toast.success(t("bulkMoved", { count: result.updated.length, category: categoryName }));
      exitSelectMode();
    } catch {
      toast.error(t("bulkMoved", { count: 0, category: categoryName }));
    }
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    try {
      const result = await bulkDelete.mutateAsync(ids);
      if (result.not_found.length) console.warn("Bulk delete not_found ids:", result.not_found);
      toast.success(t("bulkDeleted", { count: result.deleted.length }));
      exitSelectMode();
      setDeleteDialogOpen(false);
    } catch {
      toast.error(t("bulkDeleted", { count: 0 }));
    }
  }

  // Job-progress polling: starts after OPML import or refresh-all, stops once
  // the worker pool batch finishes (done + failed == total && total > 0).
  const [isPollingJobs, setIsPollingJobs] = useState(false);
  const refreshAll = useRefreshAllFeeds();
  const jobStatus = useFeedJobStatus(isPollingJobs);
  const jobData = jobStatus.data;
  const jobTotal = jobData?.total ?? 0;
  const jobDone = jobData?.done ?? 0;
  const jobFailed = jobData?.failed ?? 0;

  useEffect(() => {
    if (!isPollingJobs) return;
    if (jobTotal > 0 && jobDone + jobFailed >= jobTotal) {
      setIsPollingJobs(false);
      if (jobFailed > 0) {
        toast.success(t("importDoneWithErrors", { failed: jobFailed }));
      } else {
        toast.success(t("importDone"));
      }
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
    }
  }, [isPollingJobs, jobTotal, jobDone, jobFailed, qc, t]);

  const handleExport = async () => {
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
      toast.success(t("opmlExportSuccess"));
    } catch {
      toast.error(t("opmlExportFailed"));
    }
  };

  const handleImport = async (file: File) => {
    if (!file.name.endsWith(".opml") && !file.name.endsWith(".xml")) {
      toast.error(t("opmlInvalidFile"));
      return;
    }
    try {
      const result = await importOPML.mutateAsync(file);
      toast.success(t("opmlImportSuccess", { count: result.length }));
      // New feeds are enqueued into the worker pool; start polling for
      // progress — unless nothing new was created (all duplicates), in which
      // case the batch is empty and polling would never reach completion.
      if (result.length > 0) {
        setIsPollingJobs(true);
      }
    } catch {
      toast.error(t("opmlImportFailed"));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImport(file);
  };

  // Category handlers
  function handleAddCategory() {
    const trimmed = newCategoryTitle.trim();
    if (!trimmed) return;
    createCategory.mutate(trimmed, {
      onSuccess: () => {
        setNewCategoryTitle("");
        setAddingCategory(false);
      },
    });
  }

  function handleStartRenameCategory(cat: Category) {
    setEditingCategoryId(cat.id);
    setEditingCategoryTitle(cat.title);
  }

  function handleRenameCategory(cat: Category) {
    const trimmed = editingCategoryTitle.trim();
    if (!trimmed || trimmed === cat.title) {
      setEditingCategoryId(null);
      return;
    }
    if (renaming) return;
    setRenaming(true);
    updateCategory.mutate(trimmed, {
      onSuccess: () => {
        setEditingCategoryId(null);
      },
      onError: () => {
        toast.error(t("categoryName", { ns: "reader" }));
      },
      onSettled: () => {
        setRenaming(false);
      },
    });
  }

  function handleDeleteCategory(cat: Category) {
    if (!window.confirm(t("deleteCategoryConfirm"))) return;
    deleteCategory.mutate(cat.id, {
      onSuccess: () => toast.success(t("categoryDeleted")),
    });
  }

  // Feed handlers
  function handleEditFeed(feed: Feed) {
    setEditingFeed(feed);
    setFeedDialogOpen(true);
  }

  function handleDeleteFeed(feedId: string) {
    deleteFeed.mutate(feedId, {
      onSuccess: () => {
        setDeleteFeedConfirmId(null);
        toast.success(t("feedDeleted"));
      },
    });
  }

  function handleRefreshAll() {
    refreshAll.mutate(undefined, {
      onSuccess: (data) => {
        // Backend returns 202 { total: N }; only start polling if a batch
        // was actually enqueued (total > 0). With zero feeds the tracker
        // stays all-zero, and polling would never satisfy the completion
        // condition.
        if (data.total > 0) {
          setIsPollingJobs(true);
        }
        toast.success(t("refreshAllStarted"));
      },
      onError: () => {
        toast.error(t("refreshAllFailed"));
      },
    });
  }

  function feedStatusBadge(feed: Feed) {
    // Priority: disabled > error > pending. Mutually exclusive — one badge at a time.
    if (feed.disabled) {
      return (
        <Badge variant="secondary" className="shrink-0 text-xs text-muted-foreground">
          {t("feedStatusDisabled")}
        </Badge>
      );
    }
    if (feed.parsing_error_message) {
      return (
        <Badge variant="destructive" className="shrink-0 text-xs">
          {t("feedStatusError")}
        </Badge>
      );
    }
    if (feed.checked_at == null) {
      return (
        <Badge variant="outline" className="shrink-0 gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("feedStatusPending")}
        </Badge>
      );
    }
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Category management area */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("categories")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) =>
            editingCategoryId === cat.id ? (
              <Input
                key={cat.id}
                value={editingCategoryTitle}
                onChange={(e) => setEditingCategoryTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameCategory(cat);
                  if (e.key === "Escape") setEditingCategoryId(null);
                }}
                onBlur={() => handleRenameCategory(cat)}
                disabled={renaming}
                className="h-7 w-28 text-xs"
                autoFocus
              />
            ) : (
              <Badge key={cat.id} variant="secondary" className="group gap-1 pr-1">
                <span
                  className="cursor-default"
                  onDoubleClick={() => handleStartRenameCategory(cat)}
                >
                  {cat.title}
                </span>
                <button
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-destructive/20 group-hover:opacity-100"
                  onClick={() => handleDeleteCategory(cat)}
                  title={t("deleteCategory")}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          )}
          {addingCategory ? (
            <Input
              value={newCategoryTitle}
              onChange={(e) => setNewCategoryTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCategory();
                if (e.key === "Escape") {
                  setAddingCategory(false);
                  setNewCategoryTitle("");
                }
              }}
              onBlur={() => {
                if (newCategoryTitle.trim()) handleAddCategory();
                else {
                  setAddingCategory(false);
                  setNewCategoryTitle("");
                }
              }}
              placeholder={t("categoryPlaceholder")}
              className="h-7 w-28 text-xs"
              autoFocus
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => setAddingCategory(true)}
            >
              <Plus className="h-3 w-3" />
              {t("addCategory")}
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Feed list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{t("feedList")}</Label>
            {selectMode && (
              <span className="text-xs text-muted-foreground">
                {t("selectedCount", { count: selectedIds.size })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {selectMode ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={selectAll}
                  disabled={sortedFeeds.length === 0}
                >
                  {t("selectAll")}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={selectedIds.size === 0 || bulkMove.isPending}
                    >
                      {t("moveToCategory")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkMove(null)}>
                      {t("uncategorized")}
                    </DropdownMenuItem>
                    {categories.length > 0 && <DropdownMenuSeparator />}
                    {categories.map((cat) => (
                      <DropdownMenuItem key={cat.id} onClick={() => handleBulkMove(cat.id)}>
                        {cat.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive"
                  disabled={selectedIds.size === 0 || bulkDelete.isPending}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {t("deleteFeed")}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exitSelectMode}>
                  {t("cancelBulk")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-muted-foreground"
                  onClick={() => setSelectMode(true)}
                  disabled={feeds.length === 0}
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  {t("bulkEdit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-muted-foreground"
                  onClick={handleRefreshAll}
                  disabled={refreshAll.isPending}
                  title={t("refreshAll")}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshAll.isPending ? "animate-spin" : ""}`} />
                  {t("refreshAll")}
                </Button>
                <FeedSortMenu
                  value={feedSort}
                  onChange={(nextSort) => setReader({ feedSort: nextSort })}
                  labelNamespace="settings"
                  buttonClassName="h-7 w-7"
                />
              </>
            )}
          </div>
        </div>
        {isPollingJobs && jobTotal > 0 && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="min-w-0 flex-1 truncate">
              {t("importProgress", { done: jobDone + jobFailed, total: jobTotal })}
              {jobFailed > 0 ? ` · ${t("importProgressFailed", { failed: jobFailed })}` : ""}
            </span>
          </div>
        )}
        {feedsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : feeds.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("noFeeds")}</p>
        ) : (
          <div className="max-h-[280px] overflow-y-auto rounded-md">
            <div className="space-y-1">
              {sortedFeeds.map((feed) => (
                <div
                  key={feed.id}
                  className="group flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  {selectMode && (
                    <Checkbox
                      checked={selectedIds.has(feed.id)}
                      onCheckedChange={(checked) => toggleFeedSelected(feed.id, checked === true)}
                      className="shrink-0"
                    />
                  )}
                  <FeedIcon iconUrl={feed.icon_url} className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate text-sm">{feed.title}</span>
                  {feedStatusBadge(feed)}
                  <Badge variant="outline" className="shrink-0 truncate text-xs">
                    {feed.category_name ?? t("uncategorized")}
                  </Badge>
                  {!selectMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditFeed(feed)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          {t("editFeed")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => setTimeout(() => setDeleteFeedConfirmId(feed.id), 0)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          {t("deleteFeed")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* OPML import/export */}
      <div className="space-y-2">
        <Label>{t("opmlExport")}</Label>
        <p className="text-sm text-muted-foreground">{t("opmlExportDescription")}</p>
        <Button onClick={handleExport} disabled={exportOPML.isPending}>
          {exportOPML.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {t("opmlExportButton")}
        </Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>{t("opmlImport")}</Label>
        <p className="text-sm text-muted-foreground">{t("opmlImportDescription")}</p>
        <div
          className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {importOPML.isPending ? (
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            {importOPML.isPending ? t("opmlImporting") : t("opmlDropOrClick")}
          </p>
          <input ref={fileInputRef} type="file" accept=".opml,.xml" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Nested FeedSettingsDialog */}
      {editingFeed && (
        <FeedSettingsDialog
          feed={editingFeed}
          open={feedDialogOpen}
          onOpenChange={(open) => {
            setFeedDialogOpen(open);
            if (!open) setEditingFeed(null);
          }}
        />
      )}

      {/* Bulk delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteBulkTitle", { count: selectedIds.size })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("deleteBulkDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDelete.isPending}>
              {t("cancelBulk")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDelete.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
            >
              {bulkDelete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single feed delete confirmation */}
      <AlertDialog
        open={deleteFeedConfirmId !== null}
        onOpenChange={(open) => { if (!open) setDeleteFeedConfirmId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteFeed")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteFeedConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFeed.isPending}>
              {t("cancel", { ns: "common" })}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteFeed.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteFeedConfirmId) handleDeleteFeed(deleteFeedConfirmId);
              }}
            >
              {deleteFeed.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("delete", { ns: "common" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
