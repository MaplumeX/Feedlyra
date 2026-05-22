import { useRef, useEffect } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Sidebar } from "@/components/Sidebar";
import { ArticleList } from "@/components/ArticleList";
import { ArticleDetail } from "@/components/ArticleDetail";
import { CommandPalette } from "@/components/CommandPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useReaderStore } from "@/stores/reader";
import { Toaster } from "@/components/ui/sonner";

export function Home() {
  const sidebarPanelRef = useRef<PanelImperativeHandle>(null);
  const { sidebarCollapsed, set: setReader } = useReaderStore();

  useKeyboardShortcuts();

  // Sync keyboard-triggered sidebar collapse/expand
  useEffect(() => {
    const panel = sidebarPanelRef.current;
    if (!panel) return;
    if (sidebarCollapsed && !panel.isCollapsed()) {
      panel.collapse();
    } else if (!sidebarCollapsed && panel.isCollapsed()) {
      panel.expand();
    }
  }, [sidebarCollapsed]);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel
          panelRef={sidebarPanelRef}
          defaultSize={18}
          minSize={12}
          maxSize={30}
          collapsible
          collapsedSize={0}
          onResize={(panelSize) => {
            const collapsed = panelSize.asPercentage === 0;
            if (collapsed !== sidebarCollapsed) {
              setReader({ sidebarCollapsed: collapsed });
            }
          }}
        >
          <Sidebar />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={28} minSize={20} maxSize={40}>
          <ArticleList />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={54} minSize={30}>
          <ArticleDetail />
        </ResizablePanel>
      </ResizablePanelGroup>

      <CommandPalette />
      <Toaster />
    </div>
  );
}
