import type { Feed } from "@/api/types";

export type FeedSortField = "title" | "created_at";
export type FeedSortDirection = "asc" | "desc";

export interface FeedSortPreference {
  field: FeedSortField;
  direction: FeedSortDirection;
}

export const DEFAULT_FEED_SORT: FeedSortPreference = {
  field: "title",
  direction: "asc",
};

const titleCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function isFeedSortField(value: string): value is FeedSortField {
  return value === "title" || value === "created_at";
}

export function isFeedSortDirection(value: string): value is FeedSortDirection {
  return value === "asc" || value === "desc";
}

export function sortFeeds(feeds: readonly Feed[], sort: FeedSortPreference): Feed[] {
  return [...feeds].sort((a, b) => compareFeeds(a, b, sort));
}

function compareFeeds(a: Feed, b: Feed, sort: FeedSortPreference): number {
  const primary = sort.field === "title" ? compareTitles(a, b) : compareCreatedAt(a, b);
  if (primary !== 0) {
    return sort.direction === "asc" ? primary : -primary;
  }

  const fallback = compareTitles(a, b);
  if (fallback !== 0) return fallback;

  return titleCollator.compare(a.id, b.id);
}

function compareTitles(a: Feed, b: Feed): number {
  return titleCollator.compare(a.title, b.title);
}

function compareCreatedAt(a: Feed, b: Feed): number {
  const aTime = parseSortableTime(a.created_at);
  const bTime = parseSortableTime(b.created_at);
  return aTime - bTime;
}

function parseSortableTime(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
