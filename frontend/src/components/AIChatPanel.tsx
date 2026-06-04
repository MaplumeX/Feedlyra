import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, Bot, User, Copy, Check, RefreshCw, MessageSquareText, Square, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatHistory } from "@/api/hooks";
import { streamChat, truncateChatMessages } from "@/api/sse";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useReaderStore } from "@/stores/reader";
import type { ChatMessage } from "@/api/types";
import { cn } from "@/lib/utils";

interface AIChatPanelProps {
  articleId: string;
  articleTitle: string;
}

function updateLastAssistant(messages: ChatMessage[], content: string): ChatMessage[] {
  const updated = [...messages];
  const lastIdx = updated.length - 1;
  const last = lastIdx >= 0 ? updated[lastIdx] : undefined;
  if (last && last.role === "assistant") {
    updated[lastIdx] = {
      id: last.id,
      role: last.role,
      content: content,
      created_at: last.created_at,
    };
  }
  return updated;
}

// --- Sub-components ---

function UserAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-chat-user">
      <User className="h-4 w-4 text-primary" />
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
      <Bot className="h-4 w-4 text-primary" />
    </div>
  );
}

function TypingIndicator() {
  return (
    <span className="chat-cursor-blink inline-block h-4 w-0.5 bg-foreground/70" />
  );
}

const SUGGESTION_KEYS = [
  "suggestSummarize",
  "suggestKeyPoints",
  "suggestExplainSimply",
  "suggestTranslate",
] as const;

function ChatEmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  const { t } = useTranslation("reader");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <MessageSquareText className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{t("chatEmptyTitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("chatEmptySubtitle")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
        {SUGGESTION_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className="rounded-md border bg-background px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => onSuggestionClick(t(key))}
          >
            {t(key)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatMessageBubble({
  msg,
  isStreaming,
  editingMsgId,
  onCopy,
  onRegenerate,
  onEdit,
}: {
  msg: ChatMessage;
  isStreaming: boolean;
  editingMsgId: string | null;
  onCopy: (text: string) => void;
  onRegenerate: (msg: ChatMessage) => void;
  onEdit: (msgId: string, newText: string) => void;
}) {
  const { t } = useTranslation("reader");
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editText, setEditText] = useState("");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAssistant = msg.role === "assistant";
  const isEditing = editingMsgId === msg.id;
  const canEdit = msg.role === "user" && !msg.id.startsWith("temp-");

  // Auto-resize textarea when editing
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [isEditing, editText]);

  // Initialize edit text when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditText(msg.content);
    }
  }, [isEditing, msg.content]);

  const handleCopy = () => {
    onCopy(msg.content);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const confirmEdit = () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    onEdit(msg.id, trimmed);
  };

  const cancelEdit = () => {
    // Reset by setting editingMsgId to null is handled by parent
    onEdit("", "");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      confirmEdit();
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
  };

  if (isEditing) {
    return (
      <div className="flex gap-2.5">
        <UserAvatar />
        <div className="min-w-0 flex-1">
          <div className="rounded-lg bg-chat-user px-3 py-2">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={1}
              className="w-full resize-none rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="mt-1 flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={confirmEdit}
            >
              {t("confirmEdit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={cancelEdit}
            >
              {t("cancelEdit")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group flex gap-2.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isAssistant ? <AssistantAvatar /> : <UserAvatar />}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            isAssistant ? "bg-chat-ai" : "bg-chat-user"
          )}
        >
          {isAssistant ? (
            <div className="relative">
              <MarkdownContent content={msg.content} />
              {isStreaming && <TypingIndicator />}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          )}
        </div>
        {hovered && !isStreaming && msg.content && (
          <div className="mt-1 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
              title={copied ? t("copied") : t("copyMessage")}
            >
              {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onEdit(msg.id, "")}
                title={t("editMessage")}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            {isAssistant && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onRegenerate(msg)}
                title={t("regenerate")}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatInput({
  onSend,
  isStreaming,
  onStop,
}: {
  onSend: (text: string) => void;
  isStreaming: boolean;
  onStop: () => void;
}) {
  const { t } = useTranslation("reader");
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t p-3">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("askAboutArticle")}
        disabled={isStreaming}
        rows={1}
        className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      {isStreaming ? (
        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onStop}
          title={t("stopGeneration")}
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleSend}
          disabled={!input.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// --- Main component ---

export function AIChatPanel({ articleId, articleTitle }: AIChatPanelProps) {
  const { t } = useTranslation("reader");
  const { data: chatHistory, isLoading } = useChatHistory(articleId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const { set: setReader } = useReaderStore();

  // Sync server history into local state
  useEffect(() => {
    if (chatHistory?.messages) {
      setMessages(chatHistory.messages);
    }
  }, [chatHistory]);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [messages]);

  const doStream = useCallback(
    async (text: string) => {
      setIsStreaming(true);

      const assistantMsg: ChatMessage = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const controller = await streamChat(
        articleId,
        text,
        (chunk) => {
          setMessages((prev) => {
            const last = prev.length > 0 ? prev[prev.length - 1] : undefined;
            if (last && last.role === "assistant") {
              return updateLastAssistant(prev, last.content + chunk);
            }
            return prev;
          });
        },
        () => {
          setIsStreaming(false);
        },
        (error) => {
          setIsStreaming(false);
          setMessages((prev) => {
            const last = prev.length > 0 ? prev[prev.length - 1] : undefined;
            if (last && last.role === "assistant") {
              return updateLastAssistant(prev, `Error: ${error.message}`);
            }
            return prev;
          });
        },
      );
      abortRef.current = controller;
    },
    [articleId],
  );

  const handleSend = useCallback(
    (text: string) => {
      if (isStreaming) return;
      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      doStream(text);
    },
    [doStream, isStreaming],
  );

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const handleRegenerate = useCallback(
    (assistantMsg: ChatMessage) => {
      // Prevent regenerate while streaming
      if (isStreaming) return;

      // Find the user message right before this assistant message
      const idx = messages.indexOf(assistantMsg);
      if (idx < 1) return;
      const prevMsg = messages[idx - 1];
      if (!prevMsg || prevMsg.role !== "user") return;

      // Remove the assistant message and re-send
      const userText = prevMsg.content;
      setMessages((prev) => prev.slice(0, idx));
      doStream(userText);
    },
    [doStream, isStreaming, messages],
  );

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    // Clean up the last assistant message if it's empty
    setMessages((prev) => {
      const last = prev.length > 0 ? prev[prev.length - 1] : undefined;
      if (last && last.role === "assistant" && !last.content.trim()) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    setIsStreaming(false);
  }, []);

  const handleEdit = useCallback(
    (msgId: string, newText: string) => {
      // Cancel edit: empty msgId signals cancel
      if (!msgId) {
        setEditingMsgId(null);
        return;
      }

      // Enter edit mode: empty newText signals "start editing"
      if (!newText) {
        setEditingMsgId(msgId);
        return;
      }

      // Confirm edit: truncate messages after the edited one, then re-submit
      if (isStreaming) return;

      const msgIdx = messages.findIndex((m) => m.id === msgId);
      if (msgIdx < 0) return;

      // Keep messages before the edited one (the anchor itself is deleted server-side)
      const truncatedMessages = messages.slice(0, msgIdx);

      // Add the new user message so it appears in the UI before the response streams in
      const editedUserMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: newText,
        created_at: new Date().toISOString(),
      };
      setMessages([...truncatedMessages, editedUserMsg]);
      setEditingMsgId(null);

      // Truncate server-side history (delete anchor and all messages after it).
      // Must await so the new chat request sees the trimmed history.
      truncateChatMessages(articleId, msgId)
        .then(() => {
          doStream(newText);
        })
        .catch(() => {
          // Server truncation failed — still try to send the message
          // because the server re-reads history on each request
          doStream(newText);
        });
    },
    [doStream, isStreaming, messages, articleId],
  );

  const handleClose = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setReader({ chatPanelOpen: false });
  };

  const setScrollViewport = useCallback((node: HTMLDivElement | null) => {
    scrollViewportRef.current = node;
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <h3 className="flex-1 truncate text-sm font-medium">{t("aiChat")}</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="px-3 pb-1.5 text-xs text-muted-foreground truncate" title={articleTitle}>
        {articleTitle}
      </div>

      {/* Messages or empty state */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : messages.length === 0 ? (
        <ChatEmptyState onSuggestionClick={handleSend} />
      ) : (
        <ScrollArea className="flex-1" viewportRef={setScrollViewport}>
          <div className="space-y-4 px-3 py-3">
            {messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                msg={msg}
                isStreaming={isStreaming && msg === messages[messages.length - 1] && msg.role === "assistant"}
                editingMsgId={editingMsgId}
                onCopy={handleCopy}
                onRegenerate={handleRegenerate}
                onEdit={handleEdit}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} isStreaming={isStreaming} onStop={handleStop} />
    </div>
  );
}
