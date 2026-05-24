import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ReaderSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  contentWidth: number;
  letterSpacing: number;
  paragraphSpacing: number;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 16,
  fontFamily: "system",
  lineHeight: 1.75,
  contentWidth: 768,
  letterSpacing: 0,
  paragraphSpacing: 1.25,
};

interface ReaderState {
  selectedFeedId: string | null;
  selectedArticleId: string | null;
  articleListFilter: "all" | "unread" | "starred";
  sidebarCollapsed: boolean;
  readerSettings: ReaderSettings;
  scrollMarkRead: boolean;
  chatPanelOpen: boolean;
  commandPaletteOpen: boolean;
  settingsDialogOpen: boolean;
  set: (partial: Partial<ReaderState>) => void;
  setReaderSetting: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
  resetReaderSettings: () => void;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      selectedFeedId: null,
      selectedArticleId: null,
      articleListFilter: "all",
      sidebarCollapsed: false,
      readerSettings: { ...DEFAULT_READER_SETTINGS },
      scrollMarkRead: true,
      chatPanelOpen: false,
      commandPaletteOpen: false,
      settingsDialogOpen: false,
      set: (partial) => set(partial),
      setReaderSetting: (key, value) =>
        set((state) => ({ readerSettings: { ...state.readerSettings, [key]: value } })),
      resetReaderSettings: () => set({ readerSettings: { ...DEFAULT_READER_SETTINGS } }),
    }),
    {
      name: "feedlyra-reader",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        readerSettings: state.readerSettings,
        scrollMarkRead: state.scrollMarkRead,
      }),
    }
  )
);
