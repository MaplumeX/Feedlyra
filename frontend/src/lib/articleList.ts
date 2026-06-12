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

interface InfinitePageData<TPage, TPageParam> {
  pages: TPage[];
  pageParams: TPageParam[];
}

interface ScrollContainer {
  scrollTop: number;
}

interface VirtualArticleList {
  scrollToIndex(location: {
    index: number;
    align: "start";
    behavior: "auto";
  }): void;
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

export function replaceInfiniteDataWithFirstPage<TPage, TPageParam>(
  firstPage: TPage,
  firstPageParam: TPageParam,
): InfinitePageData<TPage, TPageParam> {
  return {
    pages: [firstPage],
    pageParams: [firstPageParam],
  };
}

export function resetArticleListScrollPosition(
  scroller: ScrollContainer | null,
  virtualList: VirtualArticleList | null,
): void {
  if (scroller) {
    scroller.scrollTop = 0;
  }
  virtualList?.scrollToIndex({
    index: 0,
    align: "start",
    behavior: "auto",
  });
}
