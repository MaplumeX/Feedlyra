import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_FEED_SORT, type FeedSortPreference } from "@/lib/feedSort";

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
  feedSort: FeedSortPreference;
  scrollMarkRead: boolean;
  autoSummarize: boolean;
  fullContentArticleIds: Record<string, true>;
  chatPanelOpen: boolean;
  commandPaletteOpen: boolean;
  settingsDialogOpen: boolean;
  set: (partial: Partial<ReaderState>) => void;
  setReaderSetting: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
  setArticleFullContentPreference: (articleId: string, enabled: boolean) => void;
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
      feedSort: { ...DEFAULT_FEED_SORT },
      scrollMarkRead: true,
      autoSummarize: false,
      fullContentArticleIds: {},
      chatPanelOpen: false,
      commandPaletteOpen: false,
      settingsDialogOpen: false,
      set: (partial) => set(partial),
      setReaderSetting: (key, value) =>
        set((state) => ({ readerSettings: { ...state.readerSettings, [key]: value } })),
      setArticleFullContentPreference: (articleId, enabled) =>
        set((state) => {
          const fullContentArticleIds = { ...state.fullContentArticleIds };
          if (enabled) {
            fullContentArticleIds[articleId] = true;
          } else {
            delete fullContentArticleIds[articleId];
          }
          return { fullContentArticleIds };
        }),
      resetReaderSettings: () => set({ readerSettings: { ...DEFAULT_READER_SETTINGS } }),
    }),
    {
      name: "feedlyra-reader",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        readerSettings: state.readerSettings,
        feedSort: state.feedSort,
        scrollMarkRead: state.scrollMarkRead,
        autoSummarize: state.autoSummarize,
        fullContentArticleIds: state.fullContentArticleIds,
      }),
    }
  )
);
