import { useCallback, useEffect, useRef } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { Sidebar } from "@/components/Sidebar";
import { ArticleList } from "@/components/ArticleList";
import { ArticleDetail } from "@/components/ArticleDetail";
import { CommandPalette } from "@/components/CommandPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useReaderStore } from "@/stores/reader";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { PanelLeft } from "lucide-react";

const SIDEBAR_PANEL_ID = "sidebar";
const ARTICLE_LIST_PANEL_ID = "article-list";
const ARTICLE_DETAIL_PANEL_ID = "article-detail";
const LAYOUT_STORAGE_KEY = "providence-layout";

const DEFAULT_SIDEBAR_SIZE = 192;
const DEFAULT_ARTICLE_LIST_SIZE = 280;

function loadLayout(): Record<string, number> | undefined {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore corrupt data */ }
  return undefined;
}

function saveLayout(layout: Record<string, number>) {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

export function Home() {
  const { sidebarCollapsed, set: setReader } = useReaderStore();

  useKeyboardShortcuts();

  const sidebarPanelRef = usePanelRef();

  // Load persisted layout once on mount
  const defaultLayout = useRef(loadLayout()).current;

  // Sync sidebar collapse state from Zustand to Panel
  useEffect(() => {
    const panel = sidebarPanelRef.current;
    if (!panel) return;
    if (sidebarCollapsed && !panel.isCollapsed()) {
      panel.collapse();
    } else if (!sidebarCollapsed && panel.isCollapsed()) {
      panel.expand();
    }
  }, [sidebarCollapsed, sidebarPanelRef]);

  // Sync Panel collapse state to Zustand (e.g. user dragged to collapse)
  const onSidebarResize = useCallback(
    (_size: { asPercentage: number; inPixels: number }) => {
      const panel = sidebarPanelRef.current;
      if (!panel) return;
      const collapsed = panel.isCollapsed();
      if (collapsed !== useReaderStore.getState().sidebarCollapsed) {
        setReader({ sidebarCollapsed: collapsed });
      }
    },
    [setReader, sidebarPanelRef]
  );

  // Persist layout after drag ends
  const onLayoutChanged = useCallback((layout: Record<string, number>) => {
    saveLayout(layout);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <Group
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel
          id={SIDEBAR_PANEL_ID}
          minSize={120}
          maxSize={280}
          defaultSize={DEFAULT_SIDEBAR_SIZE}
          collapsible
          collapsedSize={40}
          onResize={onSidebarResize}
          panelRef={sidebarPanelRef}
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
        </Panel>

        <Separator
          className="relative w-px bg-border transition-colors hover:bg-primary/50 data-[separator=active]:bg-primary"
        >
          <div className="absolute inset-y-0 -left-2 -right-2" />
        </Separator>

        <Panel
          id={ARTICLE_LIST_PANEL_ID}
          minSize={180}
          maxSize={400}
          defaultSize={DEFAULT_ARTICLE_LIST_SIZE}
        >
          <ArticleList />
        </Panel>

        <Separator
          className="relative w-px bg-border transition-colors hover:bg-primary/50 data-[separator=active]:bg-primary"
        >
          <div className="absolute inset-y-0 -left-2 -right-2" />
        </Separator>

        <Panel id={ARTICLE_DETAIL_PANEL_ID}>
          <ArticleDetail />
        </Panel>
      </Group>

      <CommandPalette />
      <Toaster />
    </div>
  );
}
