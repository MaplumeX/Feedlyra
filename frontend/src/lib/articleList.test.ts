import { describe, expect, it } from "vitest";
import type { Article, ArticleListResponse } from "@/api/types";
import {
  applyArticleTransitions,
  reconcileArticleAcknowledgements,
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
  return { items, total, page: 1, limit: 50, next_cursor: null };
}

describe("reconcileArticleAcknowledgements", () => {
  it("acknowledges initial and appended history pages without reporting them as new", () => {
    const initial = reconcileArticleAcknowledgements([["a", "b"]], {
      acknowledgedIds: new Set(),
      initialized: false,
      previousPageCount: 0,
    });

    const appended = reconcileArticleAcknowledgements([["a", "b"], ["c", "d"]], initial);

    expect(appended.newArticleIds).toEqual([]);
    expect(appended.acknowledgedIds).toEqual(new Set(["a", "b", "c", "d"]));
  });

  it("reports only unknown IDs from the first page after a refresh", () => {
    const result = reconcileArticleAcknowledgements([["new", "a"], ["b", "c"]], {
      acknowledgedIds: new Set(["a", "b", "c"]),
      initialized: true,
      previousPageCount: 2,
    });

    expect(result.newArticleIds).toEqual(["new"]);
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
