import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Download,
  Loader2,
  Upload,
  Search,
  Plus,
  AlertTriangle,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FeedIcon } from "@/components/FeedIcon";
import { FeedSettingsDialog } from "@/components/FeedSettingsDialog";
import { AddFeedDialog } from "@/components/AddFeedDialog";
import {
  useFeeds,
  useDeleteFeed,
  useUpdateFeed,
  useImportOPML,
  useExportOPML,
  useCategories,
} from "@/api/hooks";
import type { Feed } from "@/api/types";

const UNCATEGORIZED = "__none__";

function relativeTime(dateStr: string | null): { value: number; unit: "justNow" | "min" | "hr" | "day" | "long" } | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return { value: 0, unit: "justNow" };
  if (diffMin < 60) return { value: diffMin, unit: "min" };
  if (diffHr < 24) return { value: diffHr, unit: "hr" };
  if (diffDay < 7) return { value: diffDay, unit: "day" };
  return { value: 0, unit: "long" };
}

function formatRelativeTime(rt: ReturnType<typeof relativeTime>, dateStr: string | null, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!rt) return "";
  switch (rt.unit) {
    case "justNow": return t("justNow");
    case "min": return t("minutesAgo", { count: rt.value });
    case "hr": return t("hoursAgo", { count: rt.value });
    case "day": return t("daysAgo", { count: rt.value });
    case "long": {
      if (!dateStr) return "";
      return new Date(dateStr).toLocaleDateString();
    }
  }
}

function FeedTableRow({
  feed,
  categories,
  onEdit,
}: {
  feed: Feed;
  categories: { id: string; title: string }[];
  onEdit: (feed: Feed) => void;
}) {
  const { t } = useTranslation("settings");
  const updateFeed = useUpdateFeed(feed.id);
  const deleteFeed = useDeleteFeed();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const categoryId = feed.category_id ?? UNCATEGORIZED;

  function handleCategoryChange(newCatId: string) {
    const newCategoryId = newCatId === UNCATEGORIZED ? null : newCatId;
    if (newCategoryId === (feed.category_id ?? null)) return;
    updateFeed.mutate({ title: feed.title, category_id: newCategoryId });
  }

  function handleDelete() {
    deleteFeed.mutate(feed.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        toast.success(t("feedDeleted"));
      },
      onError: () => {
        toast.error(t("feedDeleteFailed"));
      },
    });
  }

  const hasErrors = feed.parsing_error_count > 0;

  return (
    <>
      <TableRow>
        {/* Feed */}
        <TableCell>
          <div className="flex items-center gap-2 min-w-0">
            <FeedIcon iconUrl={feed.icon_url} className="h-5 w-5" />
            <span className="truncate font-medium">{feed.title}</span>
          </div>
        </TableCell>

        {/* URL */}
        <TableCell>
          <span className="block max-w-[180px] truncate font-mono text-xs text-muted-foreground" title={feed.url}>
            {feed.url}
          </span>
        </TableCell>

        {/* Category */}
        <TableCell>
          <Select
            value={categoryId}
            onValueChange={handleCategoryChange}
            disabled={updateFeed.isPending}
          >
            <SelectTrigger className="h-7 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNCATEGORIZED}>{t("uncategorized", { ns: "reader" })}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>

        {/* Unread */}
        <TableCell className="text-center">
          <Badge variant={feed.unread_count ? "default" : "secondary"} className="text-xs">
            {feed.unread_count ?? 0}
          </Badge>
        </TableCell>

        {/* Status */}
        <TableCell>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {hasErrors && (
              <span title={feed.parsing_error_message ?? t("parsingErrors", { count: feed.parsing_error_count })}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
              </span>
            )}
            <span title={feed.checked_at ?? undefined}>
              {feed.checked_at
                ? formatRelativeTime(relativeTime(feed.checked_at), feed.checked_at, t)
                : t("never")}
            </span>
          </div>
        </TableCell>

        {/* Actions */}
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={t("feedSettings", { ns: "reader" })}
              onClick={() => onEdit(feed)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              title={t("delete", { ns: "common" })}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("deleteFeedTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteFeedDescription", { title: feed.title })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("cancel", { ns: "common" })}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteFeed.isPending}
            >
              {deleteFeed.isPending
                ? t("deleting", { ns: "common" })
                : t("delete", { ns: "common" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FeedTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function SubscriptionsTab() {
  const { t } = useTranslation("settings");
  const importOPML = useImportOPML();
  const exportOPML = useExportOPML();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);

  const { data: feeds = [], isLoading } = useFeeds();
  const { data: categories = [] } = useCategories();

  const filteredFeeds = search
    ? feeds.filter((f) => f.title.toLowerCase().includes(search.toLowerCase()))
    : feeds;

  // --- OPML handlers ---

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

  return (
    <div className="space-y-6">
      {/* Search + Add Feed */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchFeeds")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setAddDialogOpen(true)} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          {t("addFeed")}
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <FeedTableSkeleton />
      ) : filteredFeeds.length === 0 && !search ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">{t("noFeedsSubscribed")}</p>
        </div>
      ) : filteredFeeds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">{t("noResultsFound", { ns: "common" })}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">{t("feed")}</TableHead>
              <TableHead>{t("url")}</TableHead>
              <TableHead className="w-[140px]">{t("category", { ns: "reader" })}</TableHead>
              <TableHead className="w-[70px] text-center">{t("unread")}</TableHead>
              <TableHead className="w-[140px]">{t("status")}</TableHead>
              <TableHead className="w-[80px]">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFeeds.map((feed) => (
              <FeedTableRow
                key={feed.id}
                feed={feed}
                categories={categories}
                onEdit={setEditingFeed}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <Separator />

      {/* OPML Section */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t("opmlExport")}</Label>
          <p className="text-sm text-muted-foreground">{t("opmlExportDescription")}</p>
          <Button onClick={handleExport} disabled={exportOPML.isPending}>
            {exportOPML.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {t("opmlExportButton")}
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>{t("opmlImport")}</Label>
          <p className="text-sm text-muted-foreground">{t("opmlImportDescription")}</p>
          <div
            className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
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
            <input
              ref={fileInputRef}
              type="file"
              accept=".opml,.xml"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AddFeedDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      {editingFeed && (
        <FeedSettingsDialog
          feed={editingFeed}
          open={editingFeed !== null}
          onOpenChange={(open) => {
            if (!open) setEditingFeed(null);
          }}
        />
      )}
    </div>
  );
}
