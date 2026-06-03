import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  AIConfig,
  Article,
  ArticleListResponse,
  ArticleSummarySource,
  Category,
  ChatHistory,
  DiscoveredFeed,
  Feed,
  OPMLExportResponse,
  User,
} from "./types";

const queryKeys = {
  feeds: {
    all: ["feeds"] as const,
    list: () => [...queryKeys.feeds.all, "list"] as const,
  },
  categories: {
    all: ["categories"] as const,
    list: () => [...queryKeys.categories.all, "list"] as const,
  },
  articles: {
    all: ["articles"] as const,
    list: (params: ArticleListParams) => [...queryKeys.articles.all, params] as const,
    infiniteList: (params: ArticleListParams) =>
      [...queryKeys.articles.all, "infinite", params] as const,
    detail: (id: string) => [...queryKeys.articles.all, "detail", id] as const,
  },
  ai: {
    config: ["ai", "config"] as const,
  },
  auth: {
    me: ["auth", "me"] as const,
  },
} as const;

export { queryKeys };

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
      qc.invalidateQueries({ queryKey: queryKeys.categories.list() });
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

interface RefreshAllResponse {
  refreshed: number;
  failed: number;
}

export function useRefreshAllFeeds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<RefreshAllResponse>("/api/feeds/refresh-all", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}

export function useRefreshFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (feedId: string) => api.post<Feed>(`/api/feeds/${feedId}/refresh`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}

export function useUpdateFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ feedId, ...data }: { feedId: string; title: string; category_id?: string | null; auto_full_text?: boolean }) =>
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
      qc.invalidateQueries({ queryKey: queryKeys.categories.list() });
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

// --- Article hooks ---

interface ArticleListParams {
  feed_id?: string;
  read_status?: string;
  starred?: boolean;
  page?: number;
  limit?: number;
}

function articleListPath(params: ArticleListParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.feed_id) searchParams.set("feed_id", params.feed_id);
  if (params.read_status) searchParams.set("read_status", params.read_status);
  if (params.starred !== undefined) searchParams.set("starred", String(params.starred));
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));

  const qs = searchParams.toString();
  return `/api/articles${qs ? `?${qs}` : ""}`;
}

export function useArticles(params: ArticleListParams = {}) {
  return useQuery({
    queryKey: queryKeys.articles.list(params),
    queryFn: () => api.get<ArticleListResponse>(articleListPath(params)),
    staleTime: 2 * 60 * 1000,
  });
}

export function useInfiniteArticles(params: ArticleListParams = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.articles.infiniteList(params),
    queryFn: ({ pageParam }) =>
      api.get<ArticleListResponse>(articleListPath({ ...params, page: pageParam })),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loadedCount = lastPage.page * lastPage.limit;
      return loadedCount < lastPage.total ? lastPage.page + 1 : undefined;
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}

export function useArticle(articleId: string | null) {
  return useQuery({
    queryKey: queryKeys.articles.detail(articleId ?? ""),
    queryFn: () => api.get<Article>(`/api/articles/${articleId}`),
    enabled: !!articleId,
  });
}

export function useToggleRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ articleId, read }: { articleId: string; read: boolean }) =>
      api.put<Article>(`/api/articles/${articleId}/read`, { read }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
      qc.invalidateQueries({ queryKey: queryKeys.feeds.list() });
    },
  });
}

export function useToggleStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ articleId, starred }: { articleId: string; starred: boolean }) =>
      api.put<Article>(`/api/articles/${articleId}/star`, { starred }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
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
  return useMutation({
    mutationFn: ({ articleId, source }: { articleId: string; source: ArticleSummarySource }) =>
      api.post<SummarizeResponse>(`/api/ai/articles/${articleId}/summarize?source=${source}`, {}),
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

export function useChatHistory(articleId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.articles.all, "chat", articleId],
    queryFn: () => api.get<ChatHistory>(`/api/ai/articles/${articleId}/chat/history`),
    enabled: !!articleId,
  });
}

export function useExtractContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (articleId: string) =>
      api.post<Article>(`/api/articles/${articleId}/extract`, {}),
    onSuccess: (data, articleId) => {
      qc.setQueryData(queryKeys.articles.detail(articleId), data);
      qc.invalidateQueries({ queryKey: queryKeys.articles.detail(articleId) });
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}
