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

export type ChatPanelMode = "sidebar" | "floating";

export interface FloatingPanelPosition {
  x: number;
  y: number;
}

export interface FloatingPanelSize {
  width: number;
  height: number;
}

export const DEFAULT_FLOATING_POSITION: FloatingPanelPosition = { x: 0, y: 0 };
export const DEFAULT_FLOATING_SIZE: FloatingPanelSize = { width: 380, height: 500 };

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
  chatPanelWidth: number;
  chatPanelMode: ChatPanelMode;
  floatingPanelPosition: FloatingPanelPosition;
  floatingPanelSize: FloatingPanelSize;
  conversationPanelOpen: boolean;
  activeConversationId: string | null;
  commandPaletteOpen: boolean;
  settingsDialogOpen: boolean;
  settingsDialogTab?: string;
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
      chatPanelWidth: 360,
      chatPanelMode: "sidebar",
      floatingPanelPosition: { ...DEFAULT_FLOATING_POSITION },
      floatingPanelSize: { ...DEFAULT_FLOATING_SIZE },
      conversationPanelOpen: false,
      activeConversationId: null,
      commandPaletteOpen: false,
      settingsDialogOpen: false,
      settingsDialogTab: undefined,
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
        chatPanelWidth: state.chatPanelWidth,
        chatPanelMode: state.chatPanelMode,
        floatingPanelPosition: state.floatingPanelPosition,
        floatingPanelSize: state.floatingPanelSize,
      }),
    }
  )
);
