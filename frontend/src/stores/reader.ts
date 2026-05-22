import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ReaderState {
  selectedFeedId: string | null;
  selectedArticleId: string | null;
  articleListFilter: "all" | "unread" | "starred";
  sidebarCollapsed: boolean;
  chatPanelOpen: boolean;
  commandPaletteOpen: boolean;
  settingsDialogOpen: boolean;
  set: (partial: Partial<ReaderState>) => void;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      selectedFeedId: null,
      selectedArticleId: null,
      articleListFilter: "all",
      sidebarCollapsed: false,
      chatPanelOpen: false,
      commandPaletteOpen: false,
      settingsDialogOpen: false,
      set: (partial) => set(partial),
    }),
    { name: "feedlyra-reader", partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }) }
  )
);
