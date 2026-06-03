import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateFeed, useCategories } from "@/api/hooks";
import { useTranslation } from "react-i18next";
import type { Feed } from "@/api/types";
import { Switch } from "@/components/ui/switch";

interface FeedSettingsDialogProps {
  feed: Feed;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UNCATEGORIZED = "__none__";

export function FeedSettingsDialog({ feed, open, onOpenChange }: FeedSettingsDialogProps) {
  const { t } = useTranslation("reader");
  const [title, setTitle] = useState(feed.title);
  const [categoryId, setCategoryId] = useState<string>(feed.category_id ?? UNCATEGORIZED);
  const [autoFullText, setAutoFullText] = useState(feed.auto_full_text);
  const updateFeed = useUpdateFeed();
  const { data: categories = [] } = useCategories();

  useEffect(() => {
    setTitle(feed.title);
    setCategoryId(feed.category_id ?? UNCATEGORIZED);
    setAutoFullText(feed.auto_full_text);
  }, [feed.title, feed.category_id, feed.auto_full_text]);

  function handleSave() {
    const trimmedTitle = title.trim();
    const catId = categoryId === UNCATEGORIZED ? null : categoryId;
    if (!trimmedTitle) return;
    if (trimmedTitle === feed.title && catId === feed.category_id && autoFullText === feed.auto_full_text) return;
    updateFeed.mutate(
      { feedId: feed.id, title: trimmedTitle, category_id: catId, auto_full_text: autoFullText },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("feedSettings")}</DialogTitle>
          <DialogDescription>{t("feedSettingsDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-muted-foreground">{t("feedUrl")}</Label>
            <p className="mt-1 break-all text-sm">{feed.url}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">{t("feedSiteUrl")}</Label>
            <p className="mt-1 break-all text-sm">{feed.site_url ?? "N/A"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">{t("description", { ns: "common" })}</Label>
            <p className="mt-1 text-sm">{feed.description ?? "N/A"}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="feed-title">{t("feedTitle")}</Label>
          <Input
            id="feed-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("category")}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNCATEGORIZED}>{t("uncategorized")}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="auto-full-text">{t("autoFullText")}</Label>
          <Switch
            id="auto-full-text"
            checked={autoFullText}
            onCheckedChange={setAutoFullText}
          />
        </div>

        {updateFeed.isError && (
          <p className="text-sm text-destructive">{updateFeed.error.message}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || (title === feed.title && categoryId === (feed.category_id ?? UNCATEGORIZED) && autoFullText === feed.auto_full_text) || updateFeed.isPending}
          >
            {updateFeed.isPending ? t("saving", { ns: "common" }) : t("save", { ns: "common" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
