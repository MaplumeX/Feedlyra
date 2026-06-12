import { describe, expect, it } from "vitest";
import type { Article, ArticleListResponse } from "@/api/types";
import {
  applyArticleTransitions,
  getUnreadArticleIdsInRange,
  replaceInfiniteDataWithFirstPage,
  resetArticleListScrollPosition,
} from "@/lib/articleList";

function article(id: string, overrides: Partial<Article> = {}): Article {
  return {
    id,
    feed_id: "feed-1",
    title: id,
    url: `https://example.com/${id}`,
    content: null,
    full_content: null,
    content_snippet: null,
    image_url: null,
    author: null,
    published_at: "2026-06-06T00:00:00Z",
    fetched_at: "2026-06-06T00:00:00Z",
    is_read: false,
    is_starred: false,
    feed_title: "Feed",
    summary: null,
    summary_model: null,
    summaries: {},
    translated_title: null,
    translated_content: null,
    translation_lang: null,
    ...overrides,
  };
}

function response(items: Article[], total = items.length): ArticleListResponse {
  return {
    items,
    total,
    page: 1,
    limit: 50,
    next_cursor: null,
    snapshot_at: "2026-06-11T00:00:00Z",
  };
}

describe("replaceInfiniteDataWithFirstPage", () => {
  it("rebuilds pagination from the refreshed first page", () => {
    const firstPage = response([article("new"), article("a")]);

    expect(replaceInfiniteDataWithFirstPage(firstPage, null)).toEqual({
      pages: [firstPage],
      pageParams: [null],
    });
  });
});

describe("resetArticleListScrollPosition", () => {
  it("resets both the actual scroller and the virtual list to the first item", () => {
    const scroller = { scrollTop: 2400 };
    const locations: unknown[] = [];
    const virtualList = {
      scrollToIndex(location: unknown) {
        locations.push(location);
      },
    };

    resetArticleListScrollPosition(scroller, virtualList);

    expect(scroller.scrollTop).toBe(0);
    expect(locations).toEqual([
      {
        index: 0,
        align: "start",
        behavior: "auto",
      },
    ]);
  });
});

describe("getUnreadArticleIdsInRange", () => {
  it("returns every unread article crossed by a multi-row range jump", () => {
    const articles = Array.from({ length: 18 }, (_, index) =>
      article(`article-${index}`, { is_read: index === 4 }),
    );

    expect(getUnreadArticleIdsInRange(articles, 0, 17)).toEqual(
      Array.from({ length: 17 }, (_, index) => `article-${index}`).filter(
        (id) => id !== "article-4",
      ),
    );
  });

  it("clamps range boundaries and ignores an empty or reversed range", () => {
    const articles = [article("a"), article("b")];

    expect(getUnreadArticleIdsInRange(articles, -2, 1)).toEqual(["a"]);
    expect(getUnreadArticleIdsInRange(articles, 2, 1)).toEqual([]);
    expect(getUnreadArticleIdsInRange(articles, 0, 10)).toEqual(["a", "b"]);
  });
});

describe("applyArticleTransitions", () => {
  it("keeps an already rendered row while decrementing the unread total", () => {
    const before = article("a");
    const after = { ...before, is_read: true };

    const updated = applyArticleTransitions(
      response([before], 100),
      { read_status: "unread" },
      [{ before, after }],
    );

    expect(updated.items).toEqual([after]);
    expect(updated.total).toBe(99);
  });

  it("updates a starred count even when the changed article is not in the cached page", () => {
    const before = article("a");
    const after = { ...before, is_starred: true };

    const updated = applyArticleTransitions(
      response([article("other", { is_starred: true })], 7),
      { starred: true },
      [{ before, after }],
    );

    expect(updated.items).toHaveLength(1);
    expect(updated.total).toBe(8);
  });

  it("does not change a feed-scoped total for an article from another feed", () => {
    const before = article("a", { feed_id: "feed-2" });
    const after = { ...before, is_read: true };

    const updated = applyArticleTransitions(
      response([], 3),
      { feed_id: "feed-1", read_status: "unread" },
      [{ before, after }],
    );

    expect(updated.total).toBe(3);
  });
});
