import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useChatHistory } from "@/api/hooks";
import { streamChat } from "@/api/sse";
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

export function AIChatPanel({ articleId, articleTitle }: AIChatPanelProps) {
  const { t } = useTranslation("reader");
  const { data: chatHistory, isLoading } = useChatHistory(articleId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { set: setReader } = useReaderStore();

  // Sync server history into local state
  useEffect(() => {
    if (chatHistory?.messages) {
      setMessages(chatHistory.messages);
    }
  }, [chatHistory]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
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
      trimmed,
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
  }, [articleId, input, isStreaming]);

  const handleClose = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setReader({ chatPanelOpen: false });
  };

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background">
      <div className="flex items-center gap-2 px-3 py-2">
        <h3 className="flex-1 truncate text-sm font-medium">{t("aiChat")}</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="px-3 pb-2 text-xs text-muted-foreground truncate" title={articleTitle}>
        {articleTitle}
      </div>
      <Separator />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">
            {t("askQuestions")}
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "rounded-md px-3 py-2 text-sm",
                msg.role === "user"
                  ? "bg-primary/10 ml-4"
                  : "bg-muted mr-4"
              )}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>
          ))
        )}
      </div>

      <Separator />
      <div className="flex items-center gap-2 p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t("askAboutArticle")}
          className="h-8 text-sm"
          disabled={isStreaming}
        />
        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
