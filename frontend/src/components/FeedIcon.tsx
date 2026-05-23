import { useState } from "react";
import { Rss } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedIconProps {
  iconUrl: string | null;
  className?: string;
}

export function FeedIcon({ iconUrl, className }: FeedIconProps) {
  const [failed, setFailed] = useState(false);

  if (iconUrl && !failed) {
    return (
      <img
        src={iconUrl}
        alt=""
        className={cn("shrink-0 rounded-sm object-contain", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return <Rss className={cn("shrink-0 text-muted-foreground", className)} />;
}
