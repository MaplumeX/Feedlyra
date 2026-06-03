export interface User {
  id: string;
  email: string;
  username: string;
}

export interface Feed {
  id: string;
  title: string;
  url: string;
  site_url: string | null;
  icon_url: string | null;
  description: string | null;
  parsing_error_count: number;
  parsing_error_message: string | null;
  checked_at: string | null;
  created_at: string;
  unread_count?: number;
  category_id: string | null;
  category_name: string | null;
  auto_full_text: boolean;
}

export interface Category {
  id: string;
  title: string;
  created_at: string;
  feed_count?: number;
}

export interface Article {
  id: string;
  feed_id: string;
  title: string;
  url: string;
  content: string | null;
  full_content: string | null;
  content_snippet: string | null;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
  fetched_at: string;
  is_read: boolean;
  is_starred: boolean;
  feed_title: string | null;
  summary: string | null;
  summary_model: string | null;
  summaries: Partial<Record<ArticleSummarySource, ArticleSummary>>;
  translated_title: string | null;
  translated_content: string | null;
  translation_lang: string | null;
}

export type ArticleSummarySource = "feed" | "full";

export interface ArticleSummary {
  summary: string;
  model: string;
  content_hash: string;
  created_at: string;
}

export interface ArticleListResponse {
  items: Article[];
  total: number;
  page: number;
  limit: number;
}

export interface DiscoveredFeed {
  title: string | null;
  url: string;
}

export interface FeatureAIConfig {
  enabled: boolean;
  base_url: string | null;
  model: string | null;
  has_api_key: boolean;
}

export interface AIConfig {
  base_url: string | null;
  model: string | null;
  has_api_key: boolean;
  translate: FeatureAIConfig;
  summary: FeatureAIConfig;
  chat: FeatureAIConfig;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface OPMLExportResponse {
  xml: string;
}

export interface ChatHistory {
  chat_id: string;
  messages: ChatMessage[];
}
