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
  auto_translate: boolean;
  translate_target_lang: string | null;
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
  next_cursor: string | null;
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
  translate_default_lang: string;
  translate: FeatureAIConfig;
  summary: FeatureAIConfig;
  chat: FeatureAIConfig;
}

export interface ImageAttachment {
  type: "image";
  url: string;
  filename: string;
  mime_type: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: ImageAttachment[] | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  references_count: number;
}

export interface ConversationListResponse {
  items: Conversation[];
  total: number;
}

export interface ConversationReference {
  id: string;
  article_id: string;
  article_title: string;
  is_auto: boolean;
  created_at: string;
}

export interface ImageUploadResult {
  url: string;
  filename: string;
  mime_type: string;
  size: number;
}

export interface OPMLExportResponse {
  xml: string;
}

export interface ChatHistory {
  chat_id: string;
  messages: ChatMessage[];
}

export interface AutomationCondition {
  field: "title" | "author" | "url" | "content";
  operator: "contains" | "not_contains" | "matches_regex";
  value: string;
  logic: "and" | "or";
}

export interface AutomationAction {
  type: "mark_read" | "star" | "delete" | "auto_translate" | "auto_extract";
  params?: Record<string, string>;
}

export interface AutomationRule {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  scope: "global" | "category" | "feed";
  scope_id: string | null;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  priority: number;
  created_at: string;
  updated_at: string;
}

