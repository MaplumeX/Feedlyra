import {
  useInfiniteQuery,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "./client";
import {
  applyArticleTransitions,
  replaceInfiniteDataWithFirstPage,
  type ArticleTransition,
} from "@/lib/articleList";
import type {
  AIConfig,
  Article,
  ArticleListResponse,
  BulkMoveResult,
  BulkDeleteResult,
  NewArticleCountResponse,
  ArticleSummarySource,
  AutomationRule,
  Category,
  ChatHistory,
  Conversation,
  ConversationListResponse,
  ConversationReference,
  DiscoveredFeed,
  Feed,
  ImageUploadResult,
  JobStatus,
  OPMLExportResponse,
  User,
} from "./types";

const queryKeys = {
  feeds: {
    all: ["feeds"] as const,
    list: () => [...queryKeys.feeds.all, "list"] as const,
    jobs: {
      status: ["feeds", "jobs", "status"] as const,
    },
  },
  categories: {
    all: ["categories"] as const,
    list: () => [...queryKeys.categories.all, "list"] as const,
  },
  articles: {
    all: ["articles"] as const,
    list: (params: ArticleListParams, lang: string) =>
      [...queryKeys.articles.all, params, lang] as const,
    infiniteList: (params: ArticleListParams, lang: string) =>
      [...queryKeys.articles.all, "infinite", params, lang] as const,
    newCounts: () => [...queryKeys.articles.all, "new-count"] as const,
    newCount: (params: ArticleListParams, since: string) =>
      [...queryKeys.articles.newCounts(), params, since] as const,
    detail: (id: string, lang: string) =>
      [...queryKeys.articles.all, "detail", id, lang] as const,
  },
  ai: {
    config: ["ai", "config"] as const,
  },
  conversations: {
    all: ["conversations"] as const,
    list: (params?: ConversationListParams) => [...queryKeys.conversations.all, params] as const,
    detail: (id: string) => [...queryKeys.conversations.all, "detail", id] as const,
    references: (id: string) => [...queryKeys.conversations.all, id, "references"] as const,
    chat: (id: string) => [...queryKeys.conversations.all, id, "chat"] as const,
  },
  auth: {
    me: ["auth", "me"] as const,
  },
  automation: {
    all: ["automation"] as const,
    list: (params?: AutomationListParams) => [...queryKeys.automation.all, params] as const,
  },
} as const;

export { queryKeys };

/** The summary language follows the UI (i18n) language.
 * Normalized to a backend-supported code ("zh-CN" / "en"); any unknown value
 * falls back to "en" to match the backend default + i18next fallbackLng. */
function useUiLang(): string {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage === "zh-CN" || i18n.language === "zh-CN" ? "zh-CN" : "en";
}

const mutationKeys = {
  feeds: {
    refresh: ["feeds", "refresh"] as const,
  },
} as const;

// --- Auth hooks ---

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => api.get<User>("/api/auth/me"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { username: string }) => api.put<User>("/api/auth/me/profile", data),
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.auth.me, user);
    },
  });
}

export function useUpdateEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; current_password: string }) =>
      api.put<User>("/api/auth/me/email", data),
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.auth.me, user);
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.put<void>("/api/auth/me/password", data),
  });
}

// --- Feed hooks ---

export function useFeeds() {
  return useQuery({
    queryKey: queryKeys.feeds.list(),
    queryFn: () => api.get<Feed[]>("/api/feeds"),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}

export function useAddFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ url, category_id }: { url: string; category_id?: string | null }) =>
      api.post<Feed>("/api/feeds", { url, category_id: category_id ?? null }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.feeds.list() }),
        qc.invalidateQueries({ queryKey: queryKeys.categories.list() }),
        qc.invalidateQueries({ queryKey: queryKeys.articles.newCounts() }),
      ]);
    },
  });
}

export function useDeleteFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedId: string) => api.delete(`/api/feeds/${feedId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
      qc.invalidateQueries({ queryKey: queryKeys.categories.list() });
    },
  });
}

export function useBulkMoveFeeds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ feedIds, categoryId }: { feedIds: string[]; categoryId: string | null }) =>
      api.post<BulkMoveResult>("/api/feeds/bulk/move", {
        feed_ids: feedIds,
        category_id: categoryId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
      qc.invalidateQueries({ queryKey: queryKeys.categories.list() });
    },
  });
}

export function useBulkDeleteFeeds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedIds: string[]) =>
      api.post<BulkDeleteResult>("/api/feeds/bulk/delete", { feed_ids: feedIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
      qc.invalidateQueries({ queryKey: queryKeys.categories.list() });
    },
  });
}

interface RefreshAllFeedsResponse {
  total: number;
}

export function useRefreshAllFeeds() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.feeds.refresh,
    // Backend returns 202 Accepted { total: N } after enqueuing the user's
    // feeds into the worker pool. The actual fetch happens asynchronously;
    // poll `useFeedJobStatus` for progress.
    mutationFn: () => api.post<RefreshAllFeedsResponse>("/api/feeds/refresh-all", {}),
    onMutate: () =>
      qc.cancelQueries({ queryKey: queryKeys.articles.newCounts() }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.feeds.list() }),
        qc.invalidateQueries({ queryKey: queryKeys.articles.newCounts() }),
      ]);
    },
  });
}

export function useFeedJobStatus(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.feeds.jobs.status,
    queryFn: () => api.get<JobStatus>("/api/feeds/jobs/status"),
    enabled,
    refetchInterval: enabled ? 2_000 : false,
    // Keep the snapshot fresh while polling; never refetch on focus/mount when idle.
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
}

export function useRefreshFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.feeds.refresh,
    mutationFn: (feedId: string) => api.post<Feed>(`/api/feeds/${feedId}/refresh`, {}),
    onMutate: () =>
      qc.cancelQueries({ queryKey: queryKeys.articles.newCounts() }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.feeds.list() }),
        qc.invalidateQueries({ queryKey: queryKeys.articles.newCounts() }),
      ]);
    },
  });
}

export function useIsFeedRefreshPending() {
  return useIsMutating({ mutationKey: mutationKeys.feeds.refresh }) > 0;
}

export function useUpdateFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ feedId, ...data }: {
      feedId: string;
      title?: string;
      category_id?: string | null;
      auto_full_text?: boolean;
      auto_translate?: boolean;
      translate_target_lang?: string | null;
    }) =>
      api.put(`/api/feeds/${feedId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
      qc.invalidateQueries({ queryKey: queryKeys.categories.list() });
    },
  });
}

export function useDiscoverFeeds() {
  return useMutation({
    mutationFn: (url: string) => api.post<DiscoveredFeed[]>("/api/feeds/discover", { url }),
  });
}

export function useImportOPML() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.upload<Feed[]>("/api/feeds/import/opml", file),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.feeds.list() }),
        qc.invalidateQueries({ queryKey: queryKeys.categories.list() }),
        qc.invalidateQueries({ queryKey: queryKeys.articles.newCounts() }),
      ]);
    },
  });
}

export function useExportOPML() {
  return useMutation({
    mutationFn: () => api.get<OPMLExportResponse>("/api/feeds/export/opml"),
  });
}

// --- Category hooks ---

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: () => api.get<Category[]>("/api/categories"),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => api.post<Category>("/api/categories", { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.list() });
    },
  });
}

export function useUpdateCategory(categoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => api.put<Category>(`/api/categories/${categoryId}`, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.list() });
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) => api.delete(`/api/categories/${categoryId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.list() });
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
    },
  });
}

function articleListParamsFromQueryKey(queryKey: readonly unknown[]): ArticleListParams | null {
  const rawParams = queryKey[1] === "infinite" ? queryKey[2] : queryKey[1];
  if (!rawParams || typeof rawParams !== "object" || Array.isArray(rawParams)) return null;

  const params = rawParams as Record<string, unknown>;
  return {
    feed_id: typeof params.feed_id === "string" ? params.feed_id : undefined,
    read_status: typeof params.read_status === "string" ? params.read_status : undefined,
    starred: typeof params.starred === "boolean" ? params.starred : undefined,
    page: typeof params.page === "number" ? params.page : undefined,
    limit: typeof params.limit === "number" ? params.limit : undefined,
    cursor: typeof params.cursor === "string" ? params.cursor : undefined,
  };
}

function findCachedArticle(
  qc: ReturnType<typeof useQueryClient>,
  articleId: string,
): Article | null {
  const queries = qc.getQueryCache().findAll({ queryKey: queryKeys.articles.all });
  for (const query of queries) {
    const data: unknown = query.state.data;
    if (!data || typeof data !== "object") continue;

    if ("pages" in data && Array.isArray(data.pages)) {
      for (const page of data.pages) {
        if (!page || typeof page !== "object" || !("items" in page) || !Array.isArray(page.items)) {
          continue;
        }
        const found = page.items.find(
          (item: unknown): item is Article =>
            !!item && typeof item === "object" && "id" in item && item.id === articleId,
        );
        if (found) return found;
      }
      continue;
    }

    if ("items" in data && Array.isArray(data.items)) {
      const found = data.items.find(
        (item: unknown): item is Article =>
          !!item && typeof item === "object" && "id" in item && item.id === articleId,
      );
      if (found) return found;
      continue;
    }

    if ("id" in data && data.id === articleId) {
      return data as Article;
    }
  }
  return null;
}

function applyArticleTransitionsToCache(
  qc: ReturnType<typeof useQueryClient>,
  transitions: readonly ArticleTransition[],
) {
  if (transitions.length === 0) return;

  const afterById = new Map(transitions.map(({ after }) => [after.id, after]));
  const queries = qc.getQueryCache().findAll({ queryKey: queryKeys.articles.all });
  for (const query of queries) {
    const params = articleListParamsFromQueryKey(query.queryKey);
    qc.setQueryData(query.queryKey, (old: unknown) => {
      if (!old || typeof old !== "object") return old;

      if ("pages" in old && Array.isArray(old.pages) && params) {
        return {
          ...old,
          pages: old.pages.map((page) => {
            if (!page || typeof page !== "object" || !("items" in page)) return page;
            return applyArticleTransitions(page as ArticleListResponse, params, transitions);
          }),
        };
      }

      if ("items" in old && params) {
        return applyArticleTransitions(old as ArticleListResponse, params, transitions);
      }

      if ("id" in old && typeof old.id === "string") {
        return afterById.get(old.id) ?? old;
      }

      return old;
    });
  }

  void qc.invalidateQueries({
    queryKey: queryKeys.articles.all,
    refetchType: "none",
  });
}

function applyUnreadTransitionsToFeeds(
  qc: ReturnType<typeof useQueryClient>,
  transitions: readonly ArticleTransition[],
) {
  const unreadDeltaByFeed = new Map<string, number>();
  for (const { before, after } of transitions) {
    const delta = Number(!after.is_read) - Number(!before.is_read);
    if (delta === 0) continue;
    unreadDeltaByFeed.set(after.feed_id, (unreadDeltaByFeed.get(after.feed_id) ?? 0) + delta);
  }
  if (unreadDeltaByFeed.size === 0) return;

  qc.setQueryData<Feed[]>(queryKeys.feeds.list(), (old) =>
    old?.map((feed) => ({
      ...feed,
      unread_count: Math.max(
        0,
        (feed.unread_count ?? 0) + (unreadDeltaByFeed.get(feed.id) ?? 0),
      ),
    })),
  );
}

// --- Article hooks ---

export interface ArticleListParams {
  feed_id?: string;
  read_status?: string;
  starred?: boolean;
  page?: number;
  limit?: number;
  cursor?: string;
}

function articleListSearchParams(params: ArticleListParams, lang?: string): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (params.feed_id) searchParams.set("feed_id", params.feed_id);
  if (params.read_status) searchParams.set("read_status", params.read_status);
  if (params.starred !== undefined) searchParams.set("starred", String(params.starred));
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.cursor) searchParams.set("cursor", params.cursor);
  if (lang) searchParams.set("lang", lang);
  return searchParams;
}

function articleListPath(params: ArticleListParams = {}, lang?: string) {
  const searchParams = articleListSearchParams(params, lang);
  const qs = searchParams.toString();
  return `/api/articles${qs ? `?${qs}` : ""}`;
}

function newArticleCountPath(params: ArticleListParams, since: string) {
  const searchParams = articleListSearchParams({
    feed_id: params.feed_id,
    read_status: params.read_status,
    starred: params.starred,
  });
  searchParams.set("since", since);
  return `/api/articles/new-count?${searchParams.toString()}`;
}

export function useArticles(params: ArticleListParams = {}) {
  const lang = useUiLang();
  return useQuery({
    queryKey: queryKeys.articles.list(params, lang),
    queryFn: () => api.get<ArticleListResponse>(articleListPath(params, lang)),
    staleTime: 2 * 60 * 1000,
  });
}

export function useInfiniteArticles(params: ArticleListParams = {}) {
  const lang = useUiLang();
  return useInfiniteQuery({
    queryKey: queryKeys.articles.infiniteList(params, lang),
    queryFn: ({ pageParam }) =>
      api.get<ArticleListResponse>(
        articleListPath(
          {
            ...params,
            page: pageParam ? undefined : 1,
            cursor: pageParam ?? undefined,
          },
          lang,
        ),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
}

export function useNewArticleCount(
  params: ArticleListParams,
  since: string | null,
) {
  const isFeedRefreshPending = useIsFeedRefreshPending();

  return useQuery({
    queryKey: queryKeys.articles.newCount(params, since ?? ""),
    queryFn: () =>
      api.get<NewArticleCountResponse>(newArticleCountPath(params, since ?? "")),
    enabled: since !== null,
    staleTime: 0,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      if (isFeedRefreshPending) return false;
      return query.state.data?.initial_fetch_pending ? 2_000 : 2 * 60 * 1000;
    },
  });
}

export function useRefreshInfiniteArticles(params: ArticleListParams) {
  const qc = useQueryClient();
  const lang = useUiLang();
  const queryKey = queryKeys.articles.infiniteList(params, lang);

  return useMutation({
    mutationFn: () =>
      api.get<ArticleListResponse>(
        articleListPath(
          {
            ...params,
            page: 1,
            cursor: undefined,
          },
          lang,
        ),
      ),
    onSuccess: (firstPage) => {
      qc.setQueryData<InfiniteData<ArticleListResponse, string | null>>(
        queryKey,
        replaceInfiniteDataWithFirstPage(firstPage, null),
      );
    },
  });
}

export function useArticle(articleId: string | null) {
  const lang = useUiLang();
  return useQuery({
    queryKey: queryKeys.articles.detail(articleId ?? "", lang),
    queryFn: () =>
      api.get<Article>(`/api/articles/${articleId}?lang=${encodeURIComponent(lang)}`),
    enabled: !!articleId,
  });
}

export function useToggleRead() {
  const qc = useQueryClient();
  const lang = useUiLang();
  return useMutation({
    mutationFn: ({ articleId, read }: { articleId: string; read: boolean }) =>
      api.put<Article>(`/api/articles/${articleId}/read?lang=${encodeURIComponent(lang)}`, { read }),
    onSuccess: (after: Article, { articleId }: { articleId: string; read: boolean }) => {
      const before = findCachedArticle(qc, articleId);
      const transitions = before ? [{ before, after }] : [];
      applyArticleTransitionsToCache(qc, transitions);
      applyUnreadTransitionsToFeeds(qc, transitions);
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
    },
  });
}

export function useToggleStar() {
  const qc = useQueryClient();
  const lang = useUiLang();
  return useMutation({
    mutationFn: ({ articleId, starred }: { articleId: string; starred: boolean }) =>
      api.put<Article>(`/api/articles/${articleId}/star?lang=${encodeURIComponent(lang)}`, { starred }),
    onSuccess: (after: Article, { articleId }: { articleId: string; starred: boolean }) => {
      const before = findCachedArticle(qc, articleId);
      applyArticleTransitionsToCache(qc, before ? [{ before, after }] : []);
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ feedId }: { feedId?: string }) =>
      api.put<{ marked_count: number }>("/api/articles/mark-all-read", { feed_id: feedId ?? null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
    },
  });
}

export function useBatchRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ articleIds }: { articleIds: string[] }) =>
      api.put<{ marked_count: number }>("/api/articles/batch-read", { article_ids: articleIds }),
    onSuccess: (_data: { marked_count: number }, { articleIds }: { articleIds: string[] }) => {
      const transitions = articleIds.flatMap((articleId) => {
        const before = findCachedArticle(qc, articleId);
        return before && !before.is_read
          ? [{ before, after: { ...before, is_read: true } }]
          : [];
      });
      applyArticleTransitionsToCache(qc, transitions);
      applyUnreadTransitionsToFeeds(qc, transitions);
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
    },
  });
}

export function useStarredCount() {
  const { data } = useArticles({ starred: true, limit: 1 });
  return data?.total ?? 0;
}

// --- AI hooks ---

export function useAIConfig() {
  return useQuery({
    queryKey: queryKeys.ai.config,
    queryFn: () => api.get<AIConfig>("/api/ai/config"),
    staleTime: 5 * 60 * 1000,
  });
}

export interface UpdateAIConfigPayload {
  base_url?: string | null;
  api_key?: string | null;
  model?: string | null;
  translate_default_lang?: string;
  translate?: {
    enabled?: boolean;
    base_url?: string | null;
    api_key?: string | null;
    model?: string | null;
  } | null;
  summary?: {
    enabled?: boolean;
    base_url?: string | null;
    api_key?: string | null;
    model?: string | null;
  } | null;
  chat?: {
    enabled?: boolean;
    base_url?: string | null;
    api_key?: string | null;
    model?: string | null;
  } | null;
}

export function useUpdateAIConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateAIConfigPayload) =>
      api.put<AIConfig>("/api/ai/config", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ai.config });
    },
  });
}

interface SummarizeResponse {
  summary: string;
  model: string;
  source: ArticleSummarySource;
  content_hash: string;
}

export function useSummarize() {
  const qc = useQueryClient();
  const lang = useUiLang();
  return useMutation({
    mutationFn: ({ articleId, source }: { articleId: string; source: ArticleSummarySource }) =>
      api.post<SummarizeResponse>(`/api/ai/articles/${articleId}/summarize?source=${source}&lang=${encodeURIComponent(lang)}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}

interface TranslateResponse {
  translated_title: string;
  translated_content: string;
  model: string;
  lang: string;
}

export function useTranslate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ articleId, targetLang }: { articleId: string; targetLang?: string }) =>
      api.post<TranslateResponse>(`/api/ai/articles/${articleId}/translate`, {
        target_lang: targetLang ?? "zh",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}

export function useChatHistory(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.conversations.chat(conversationId ?? ""),
    queryFn: () => api.get<ChatHistory>(`/api/ai/conversations/${conversationId}/chat/history`),
    enabled: !!conversationId,
  });
}

export function useExtractContent() {
  const qc = useQueryClient();
  const lang = useUiLang();
  return useMutation({
    mutationFn: (articleId: string) =>
      api.post<Article>(`/api/articles/${articleId}/extract?lang=${encodeURIComponent(lang)}`, {}),
    onSuccess: (data, articleId) => {
      qc.setQueryData(queryKeys.articles.detail(articleId, lang), data);
      qc.invalidateQueries({ queryKey: queryKeys.articles.detail(articleId, lang) });
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}

// --- Conversation hooks ---

interface ConversationListParams {
  page?: number;
  limit?: number;
}

export function useConversations(params: ConversationListParams = {}) {
  return useQuery({
    queryKey: queryKeys.conversations.list(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set("page", String(params.page));
      if (params.limit) searchParams.set("limit", String(params.limit));
      const qs = searchParams.toString();
      return api.get<ConversationListResponse>(`/api/ai/conversations${qs ? `?${qs}` : ""}`);
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(id ?? ""),
    queryFn: () => api.get<Conversation>(`/api/ai/conversations/${id}`),
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: { article_id?: string }) =>
      api.post<Conversation>("/api/ai/conversations", data ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, ...data }: { conversationId: string; title?: string }) =>
      api.put<Conversation>(`/api/ai/conversations/${conversationId}`, data),
    onSuccess: (_data, { conversationId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      api.delete(`/api/ai/conversations/${conversationId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useConversationReferences(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.conversations.references(conversationId ?? ""),
    queryFn: () => api.get<ConversationReference[]>(`/api/ai/conversations/${conversationId}/references`),
    enabled: !!conversationId,
  });
}

export function useAddConversationReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, articleId }: { conversationId: string; articleId: string }) =>
      api.post<ConversationReference>(`/api/ai/conversations/${conversationId}/references`, { article_id: articleId }),
    onSuccess: (_data, { conversationId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.references(conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useRemoveConversationReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, referenceId }: { conversationId: string; referenceId: string }) =>
      api.delete(`/api/ai/conversations/${conversationId}/references/${referenceId}`),
    onSuccess: (_data, { conversationId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.references(conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });
}

export function useUploadConversationImage() {
  return useMutation({
    mutationFn: ({ conversationId, file }: { conversationId: string; file: File }) =>
      api.upload<ImageUploadResult>(`/api/ai/conversations/${conversationId}/images`, file),
  });
}

// --- Automation hooks ---

interface AutomationListParams {
  scope?: "global" | "category" | "feed";
  scope_id?: string;
}

function automationListPath(params?: AutomationListParams) {
  if (!params) return "/api/automation-rules";
  const searchParams = new URLSearchParams();
  if (params.scope) searchParams.set("scope", params.scope);
  if (params.scope_id) searchParams.set("scope_id", params.scope_id);
  const qs = searchParams.toString();
  return `/api/automation-rules${qs ? `?${qs}` : ""}`;
}

export function useAutomationRules(params?: AutomationListParams) {
  return useQuery({
    queryKey: queryKeys.automation.list(params),
    queryFn: () => api.get<AutomationRule[]>(automationListPath(params)),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      scope: "global" | "category" | "feed";
      scope_id?: string | null;
      conditions: AutomationRule["conditions"];
      actions: AutomationRule["actions"];
      enabled?: boolean;
      priority?: number;
    }) => api.post<AutomationRule>("/api/automation-rules", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.automation.all });
    },
  });
}

export function useUpdateAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, ...data }: {
      ruleId: string;
      name?: string;
      enabled?: boolean;
      scope?: "global" | "category" | "feed";
      scope_id?: string | null;
      conditions?: AutomationRule["conditions"];
      actions?: AutomationRule["actions"];
      priority?: number;
    }) => api.put<AutomationRule>(`/api/automation-rules/${ruleId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.automation.all });
    },
  });
}

export function useDeleteAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => api.delete(`/api/automation-rules/${ruleId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.automation.all });
    },
  });
}

export function useToggleAutomationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) =>
      api.put<AutomationRule>(`/api/automation-rules/${ruleId}`, { enabled }),
    onMutate: async ({ ruleId, enabled }) => {
      await qc.cancelQueries({ queryKey: queryKeys.automation.all });
      const queries = qc.getQueryCache().findAll({ queryKey: queryKeys.automation.all });
      for (const query of queries) {
        qc.setQueryData<AutomationRule[]>(query.queryKey, (old) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((rule) =>
            rule.id === ruleId ? { ...rule, enabled } : rule,
          );
        });
      }
      return { ruleId, enabled };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        qc.invalidateQueries({ queryKey: queryKeys.automation.all });
      }
    },
  });
}

export type { AutomationListParams };
