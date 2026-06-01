import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download, Loader2, MoreHorizontal, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  useImportOPML,
  useExportOPML,
} from "@/api/hooks";
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

  function handleDeleteFeed(feed: Feed) {
    if (!window.confirm(t("deleteFeedConfirm"))) return;
    deleteFeed.mutate(feed.id, {
      onSuccess: () => toast.success(t("feedDeleted")),
    });
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
          <Label className="text-sm font-medium">{t("feedList")}</Label>
          <FeedSortMenu
            value={feedSort}
            onChange={(nextSort) => setReader({ feedSort: nextSort })}
            labelNamespace="settings"
            buttonClassName="h-7 w-7"
          />
        </div>
        {feedsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : feeds.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("noFeeds")}</p>
        ) : (
          <ScrollArea className="max-h-[280px]">
            <div className="space-y-1">
              {sortedFeeds.map((feed) => (
                <div
                  key={feed.id}
                  className="group flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <FeedIcon iconUrl={feed.icon_url} className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate text-sm">{feed.title}</span>
                  <Badge variant="outline" className="shrink-0 truncate text-xs">
                    {feed.category_name ?? t("uncategorized")}
                  </Badge>
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
                        onClick={() => handleDeleteFeed(feed)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        {t("deleteFeed")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </ScrollArea>
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
    </div>
  );
}
