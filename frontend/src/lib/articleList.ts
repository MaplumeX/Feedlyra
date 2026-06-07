import type { Article, ArticleListResponse } from "@/api/types";

export interface ArticleListFilterParams {
  feed_id?: string;
  read_status?: string;
  starred?: boolean;
}

export interface ArticleTransition {
  before: Article;
  after: Article;
}

interface ArticleAcknowledgementState {
  acknowledgedIds: ReadonlySet<string>;
  initialized: boolean;
  previousPageCount: number;
}

interface ArticleAcknowledgementResult {
  acknowledgedIds: Set<string>;
  newArticleIds: string[];
  initialized: boolean;
  previousPageCount: number;
}

interface InfinitePageData<TPage, TPageParam> {
  pages: TPage[];
  pageParams: TPageParam[];
}

function articleMatchesFilter(article: Article, params: ArticleListFilterParams): boolean {
  if (params.feed_id && article.feed_id !== params.feed_id) return false;
  if (params.read_status === "unread" && article.is_read) return false;
  if (params.read_status === "read" && !article.is_read) return false;
  if (params.starred === true && !article.is_starred) return false;
  return true;
}

export function applyArticleTransitions(
  response: ArticleListResponse,
  params: ArticleListFilterParams,
  transitions: readonly ArticleTransition[],
): ArticleListResponse {
  if (transitions.length === 0) return response;

  const afterById = new Map(transitions.map(({ after }) => [after.id, after]));
  const totalDelta = transitions.reduce((delta, { before, after }) => {
    const matchedBefore = articleMatchesFilter(before, params);
    const matchesAfter = articleMatchesFilter(after, params);
    return delta + Number(matchesAfter) - Number(matchedBefore);
  }, 0);

  return {
    ...response,
    items: response.items.map((article) => afterById.get(article.id) ?? article),
    total: Math.max(0, response.total + totalDelta),
  };
}

export function retainFirstInfinitePage<TPage, TPageParam>(
  data: InfinitePageData<TPage, TPageParam>,
): InfinitePageData<TPage, TPageParam> {
  if (data.pages.length <= 1 && data.pageParams.length <= 1) return data;

  return {
    ...data,
    pages: data.pages.slice(0, 1),
    pageParams: data.pageParams.slice(0, 1),
  };
}

export function reconcileArticleAcknowledgements(
  pageArticleIds: readonly (readonly string[])[],
  state: ArticleAcknowledgementState,
): ArticleAcknowledgementResult {
  const acknowledgedIds = new Set(state.acknowledgedIds);

  if (!state.initialized) {
    for (const pageIds of pageArticleIds) {
      for (const id of pageIds) {
        acknowledgedIds.add(id);
      }
    }
    return {
      acknowledgedIds,
      newArticleIds: [],
      initialized: true,
      previousPageCount: pageArticleIds.length,
    };
  }

  if (pageArticleIds.length > state.previousPageCount) {
    for (const pageIds of pageArticleIds.slice(state.previousPageCount)) {
      for (const id of pageIds) {
        acknowledgedIds.add(id);
      }
    }
  }

  const firstPageIds = pageArticleIds[0] ?? [];
  const newArticleIds = firstPageIds.filter((id) => !acknowledgedIds.has(id));

  return {
    acknowledgedIds,
    newArticleIds,
    initialized: true,
    previousPageCount: pageArticleIds.length,
  };
}
