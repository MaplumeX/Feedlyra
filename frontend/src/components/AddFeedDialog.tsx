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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAddFeed, useDiscoverFeeds } from "@/api/hooks";
import type { DiscoveredFeed } from "@/api/types";

interface AddFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFeedDialog({ open, onOpenChange }: AddFeedDialogProps) {
  const [feedUrl, setFeedUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeed[]>([]);

  const addFeed = useAddFeed();
  const discoverFeeds = useDiscoverFeeds();

  function handleAddFeed() {
    if (!feedUrl.trim()) return;
    addFeed.mutate(feedUrl.trim(), {
      onSuccess: () => {
        setFeedUrl("");
        onOpenChange(false);
      },
    });
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
    addFeed.mutate(url, {
      onSuccess: () => {
        setWebsiteUrl("");
        setDiscoveredFeeds([]);
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Feed</DialogTitle>
          <DialogDescription>Add an RSS/Atom feed by URL or discover feeds from a website.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="url">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">Feed URL</TabsTrigger>
            <TabsTrigger value="discover">Discover</TabsTrigger>
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
                Add
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
                Find
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
              <p className="text-sm text-muted-foreground">No feeds discovered.</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
