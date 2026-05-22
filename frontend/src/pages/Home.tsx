import { Sidebar } from "@/components/Sidebar";
import { ArticleList } from "@/components/ArticleList";
import { ArticleDetail } from "@/components/ArticleDetail";
import { CommandPalette } from "@/components/CommandPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useReaderStore } from "@/stores/reader";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";

export function Home() {
  const { sidebarCollapsed, set: setReader } = useReaderStore();

  useKeyboardShortcuts();

  return (
    <div className="h-screen w-screen overflow-hidden">
      <div className="flex h-full">
        {/* Sidebar */}
        <div
          className="shrink-0 border-r border-border transition-all duration-200 overflow-hidden"
          style={{ width: sidebarCollapsed ? 40 : 192 }}
        >
          {sidebarCollapsed ? (
            <div className="flex h-full flex-col items-center pt-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setReader({ sidebarCollapsed: false })}
                title="Expand sidebar (Shift+S)"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Sidebar />
          )}
        </div>

        {/* Article list */}
        <div className="w-[280px] shrink-0 border-r border-border">
          <ArticleList />
        </div>

        {/* Article detail */}
        <div className="flex-1 min-w-0">
          <ArticleDetail />
        </div>
      </div>

      <CommandPalette />
      <Toaster />
    </div>
  );
}
