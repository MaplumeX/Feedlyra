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
import { useUpdateFeed } from "@/api/hooks";
import { useTranslation } from "react-i18next";
import type { Feed } from "@/api/types";

interface FeedSettingsDialogProps {
  feed: Feed;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedSettingsDialog({ feed, open, onOpenChange }: FeedSettingsDialogProps) {
  const { t } = useTranslation("reader");
  const [title, setTitle] = useState(feed.title);
  const updateFeed = useUpdateFeed(feed.id);

  useEffect(() => {
    setTitle(feed.title);
  }, [feed.title]);

  function handleSave() {
    if (!title.trim() || title === feed.title) return;
    updateFeed.mutate({ title: title.trim() }, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
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
          {updateFeed.isError && (
            <p className="text-sm text-destructive">{updateFeed.error.message}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel", { ns: "common" })}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || title === feed.title || updateFeed.isPending}
          >
            {updateFeed.isPending ? t("saving", { ns: "common" }) : t("save", { ns: "common" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
