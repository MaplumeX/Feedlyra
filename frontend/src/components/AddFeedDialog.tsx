import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddFeed, useDiscoverFeeds, useCategories } from "@/api/hooks";
import { useTranslation } from "react-i18next";
import type { DiscoveredFeed } from "@/api/types";

interface AddFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UNCATEGORIZED = "__none__";

export function AddFeedDialog({ open, onOpenChange }: AddFeedDialogProps) {
  const { t } = useTranslation("reader");
  const [feedUrl, setFeedUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeed[]>([]);
  const [categoryId, setCategoryId] = useState<string>(UNCATEGORIZED);

  const addFeed = useAddFeed();
  const discoverFeeds = useDiscoverFeeds();
  const { data: categories = [] } = useCategories();

  function handleAddFeed() {
    if (!feedUrl.trim()) return;
    addFeed.mutate(
      { url: feedUrl.trim(), category_id: categoryId === UNCATEGORIZED ? null : categoryId },
      {
        onSuccess: () => {
          setFeedUrl("");
          setCategoryId(UNCATEGORIZED);
          onOpenChange(false);
        },
      },
    );
  }

  function handleDiscover() {
    if (!websiteUrl.trim()) return;
    discoverFeeds.mutate(websiteUrl.trim(), {
      onSuccess: (feeds) => {
        setDiscoveredFeeds(feeds);
      },
    });
  }

  function handleSelectDiscovered(url: string) {
    addFeed.mutate(
      { url, category_id: categoryId === UNCATEGORIZED ? null : categoryId },
      {
        onSuccess: () => {
          setWebsiteUrl("");
          setDiscoveredFeeds([]);
          setCategoryId(UNCATEGORIZED);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addFeed")}</DialogTitle>
          <DialogDescription>{t("addFeedDescription")}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="url">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">{t("feedUrl")}</TabsTrigger>
            <TabsTrigger value="discover">{t("discover")}</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/feed.xml"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFeed()}
              />
              <Button onClick={handleAddFeed} disabled={addFeed.isPending || !feedUrl.trim()}>
                {t("add", { ns: "common" })}
              </Button>
            </div>
            {addFeed.isError && (
              <p className="text-sm text-destructive">{addFeed.error.message}</p>
            )}
          </TabsContent>

          <TabsContent value="discover" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDiscover()}
              />
              <Button onClick={handleDiscover} disabled={discoverFeeds.isPending || !websiteUrl.trim()}>
                {t("find", { ns: "common" })}
              </Button>
            </div>

            {discoverFeeds.isError && (
              <p className="text-sm text-destructive">{discoverFeeds.error.message}</p>
            )}

            {discoveredFeeds.length > 0 && (
              <div className="space-y-2">
                {discoveredFeeds.map((f) => (
                  <button
                    key={f.url}
                    className="flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm hover:bg-accent"
                    onClick={() => handleSelectDiscovered(f.url)}
                    disabled={addFeed.isPending}
                  >
                    <span className="flex-1 truncate">{f.title || f.url}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-48">{f.url}</span>
                  </button>
                ))}
              </div>
            )}

            {discoveredFeeds.length === 0 && !discoverFeeds.isPending && websiteUrl && (
              <p className="text-sm text-muted-foreground">{t("noFeedsDiscovered")}</p>
            )}
          </TabsContent>
        </Tabs>

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
      </DialogContent>
    </Dialog>
  );
}
