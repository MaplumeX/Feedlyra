import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, Bot, Copy, Check, RefreshCw, MessageSquareText, Square, Pencil, Paperclip, XCircle, History, Pin, PinOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ConversationListPopover } from "@/components/ConversationSidebar";
import {
  useChatHistory,
  useConversationReferences,
  useRemoveConversationReference,
  useConversation,
} from "@/api/hooks";
import { streamChat, truncateChatMessages } from "@/api/sse";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useReaderStore } from "@/stores/reader";
import { type FloatingChildProps } from "@/components/FloatingChatPanel";
import type { ChatMessage, ImageAttachment, ConversationReference } from "@/api/types";
import { cn } from "@/lib/utils";

interface AIChatPanelProps extends FloatingChildProps {
  conversationId: string;
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
      attachments: last.attachments,
      created_at: last.created_at,
    };
  }
  return updated;
}

// --- Sub-components ---

function AssistantAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
      <Bot className="h-4 w-4 text-primary" />
    </div>
  );
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-foreground/50" />
      <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-foreground/50" style={{ animationDelay: "150ms" }} />
      <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-foreground/50" style={{ animationDelay: "300ms" }} />
    </span>
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
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <MessageSquareText className="h-8 w-8 text-primary" />
      </div>
      <div className="text-center">
        <p className="text-base font-medium">{t("chatEmptyTitle")}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{t("chatEmptySubtitle")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 w-full max-w-xs">
        {SUGGESTION_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className="rounded-lg border bg-background px-3 py-2.5 text-left text-xs text-foreground transition-all hover:shadow-sm hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground"
            onClick={() => onSuggestionClick(t(key))}
          >
            {t(key)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReferenceTag({
  reference,
  onRemove,
}: {
  reference: ConversationReference;
  onRemove: (refId: string) => void;
}) {
  const { t } = useTranslation("reader");
  return (
    <Badge variant="secondary" className="gap-1 text-xs pr-1 max-w-[200px]">
      <span className="truncate">{reference.article_title}</span>
      {reference.is_auto && (
        <span className="text-[10px] text-primary font-medium shrink-0">
          {t("currentArticle")}
        </span>
      )}
      <button
        type="button"
        className="shrink-0 rounded-full p-0.5 hover:bg-muted-foreground/20"
        onClick={() => onRemove(reference.id)}
        title={t("removeReference")}
      >
        <XCircle className="h-3 w-3" />
      </button>
    </Badge>
  );
}

function ImagePreview({
  images,
  onRemoveImage,
}: {
  images: File[];
  onRemoveImage: (index: number) => void;
}) {
  if (images.length === 0) return null;
  return (
    <div className="flex gap-2 px-3 pt-2">
      {images.map((img, idx) => {
        const objectUrl = URL.createObjectURL(img);
        return (
          <div key={`${img.name}-${img.size}-${idx}`} className="group relative h-14 w-14 shrink-0">
            <img
              src={objectUrl}
              alt={img.name}
              className="h-14 w-14 rounded-md border object-cover"
              onLoad={() => URL.revokeObjectURL(objectUrl)}
            />
            <button
              type="button"
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemoveImage(idx)}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function MessageAttachments({ attachments }: { attachments: ImageAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {attachments.map((att, idx) => {
        // Server returns relative URLs like /api/ai/images/xxx — prefix with API base
        const src = att.url.startsWith("/") ? `${API_BASE}${att.url}` : att.url;
        return (
          <img
            key={idx}
            src={src}
            alt={att.filename}
            className="max-h-48 max-w-full rounded-md border object-contain"
          />
        );
      })}
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
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div className="rounded-2xl bg-chat-user px-3 py-2">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={1}
              className="w-full resize-none rounded-xl border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="mt-1 flex gap-1 justify-end">
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
      className={cn(
        "group flex gap-2.5",
        isAssistant ? "" : "justify-end"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isAssistant && <AssistantAvatar />}
      <div className={cn("min-w-0", isAssistant ? "flex-1" : "max-w-[85%]")}>
        <div
          className={cn(
            "text-sm",
            isAssistant ? "" : "rounded-2xl bg-chat-user px-3 py-2"
          )}
        >
          {isAssistant ? (
            <div className="relative">
              <MarkdownContent content={msg.content} />
              {isStreaming && <TypingIndicator />}
            </div>
          ) : (
            <>
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              <MessageAttachments attachments={msg.attachments ?? []} />
            </>
          )}
        </div>
        {hovered && !isStreaming && msg.content && (
          <div className={cn("mt-1 flex gap-1", isAssistant ? "" : "justify-end")}>
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
  pendingImages,
  onAddImages,
  onRemoveImage,
}: {
  onSend: (text: string, images: File[]) => void;
  isStreaming: boolean;
  onStop: () => void;
  pendingImages: File[];
  onAddImages: (files: File[]) => void;
  onRemoveImage: (index: number) => void;
}) {
  const { t } = useTranslation("reader");
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // Paste handler for images
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const handlePaste = (e: ClipboardEvent) => {
      const files: File[] = [];
      if (e.clipboardData) {
        for (const item of e.clipboardData.items) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      }
      if (files.length > 0) {
        onAddImages(files);
      }
    };

    el.addEventListener("paste", handlePaste);
    return () => el.removeEventListener("paste", handlePaste);
  }, [onAddImages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if ((!trimmed && pendingImages.length === 0) || isStreaming) return;
    onSend(trimmed, pendingImages);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i]!.type.startsWith("image/")) {
        imageFiles.push(files[i]!);
      }
    }
    if (imageFiles.length > 0) {
      onAddImages(imageFiles);
    }
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files: File[] = [];
    if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i]!;
        if (file.type.startsWith("image/")) {
          files.push(file);
        }
      }
    }
    if (files.length > 0) {
      onAddImages(files);
    }
  };

  return (
    <div
      className={cn(
        "border-t p-3",
        isDragOver && "bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="mb-2 flex items-center justify-center rounded-md border-2 border-dashed border-primary/40 py-3 text-xs text-primary">
          {t("dropImage")}
        </div>
      )}
      <ImagePreview images={pendingImages} onRemoveImage={onRemoveImage} />
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chatPlaceholder")}
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming}
          title={t("uploadImage")}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
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
            variant="default"
            className="h-8 w-8 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() && pendingImages.length === 0}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// --- Main component ---

export function AIChatPanel({
  conversationId,
  draggable,
  onHeaderPointerDown,
  onHeaderPointerMove,
  onHeaderPointerUp,
}: AIChatPanelProps) {
  const { t } = useTranslation("reader");
  const { data: chatHistory, isLoading } = useChatHistory(conversationId);
  const { data: conversation } = useConversation(conversationId);
  const { data: references } = useConversationReferences(conversationId);
  const removeReference = useRemoveConversationReference();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  // Message ids that were appended during this session — only these animate on mount.
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const { set: setReader } = useReaderStore();
  const chatPanelMode = useReaderStore((s) => s.chatPanelMode);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Sync server history into local state. Historical messages never animate;
  // clear the new-id set so only newly appended messages animate on mount.
  useEffect(() => {
    if (chatHistory?.messages) {
      setNewIds(new Set());
      setMessages(chatHistory.messages);
    }
  }, [chatHistory]);

  // Reset state when conversation changes
  useEffect(() => {
    setMessages([]);
    setPendingImages([]);
    setEditingMsgId(null);
    setNewIds(new Set());
  }, [conversationId]);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [messages]);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const doStream = useCallback(
    async (text: string, images?: File[]) => {
      setIsStreaming(true);

      // Convert images to base64 for the API
      let base64Images: string[] | undefined;
      if (images && images.length > 0) {
        base64Images = await Promise.all(images.map(fileToBase64));
      }

      const assistantMsg: ChatMessage = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        attachments: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      const assistantId = assistantMsg.id;
      setNewIds((prev) => {
        const next = new Set(prev);
        next.add(assistantId);
        return next;
      });

      const controller = await streamChat({
        conversationId,
        message: text,
        images: base64Images,
        onChunk: (chunk) => {
          setMessages((prev) => {
            const last = prev.length > 0 ? prev[prev.length - 1] : undefined;
            if (last && last.role === "assistant") {
              return updateLastAssistant(prev, last.content + chunk);
            }
            return prev;
          });
        },
        onDone: () => {
          if (!mountedRef.current) return;
          setIsStreaming(false);
        },
        onError: (error) => {
          if (!mountedRef.current) return;
          setIsStreaming(false);
          setMessages((prev) => {
            const last = prev.length > 0 ? prev[prev.length - 1] : undefined;
            if (last && last.role === "assistant") {
              return updateLastAssistant(prev, `Error: ${error.message}`);
            }
            return prev;
          });
        },
      });
      abortRef.current = controller;
    },
    [conversationId],
  );

  const handleSend = useCallback(
    (text: string, images: File[]) => {
      if (isStreaming) return;

      // Build attachments for the user message preview
      const imageAttachments: ImageAttachment[] | null = images.length > 0
        ? images.map((img) => ({
            type: "image" as const,
            url: URL.createObjectURL(img),
            filename: img.name,
            mime_type: img.type,
            size: img.size,
          }))
        : null;

      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: text,
        attachments: imageAttachments,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      const userId = userMsg.id;
      setNewIds((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
      setPendingImages([]);
      doStream(text, images.length > 0 ? images : undefined);
    },
    [doStream, isStreaming],
  );

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const handleRegenerate = useCallback(
    (assistantMsg: ChatMessage) => {
      if (isStreaming) return;

      const idx = messages.indexOf(assistantMsg);
      if (idx < 1) return;
      const prevMsg = messages[idx - 1];
      if (!prevMsg || prevMsg.role !== "user") return;

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
      if (!msgId) {
        setEditingMsgId(null);
        return;
      }

      if (!newText) {
        setEditingMsgId(msgId);
        return;
      }

      if (isStreaming) return;

      const msgIdx = messages.findIndex((m) => m.id === msgId);
      if (msgIdx < 0) return;

      const truncatedMessages = messages.slice(0, msgIdx);

      const editedUserMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: newText,
        attachments: null,
        created_at: new Date().toISOString(),
      };
      setMessages([...truncatedMessages, editedUserMsg]);
      setNewIds((prev) => {
        const next = new Set(prev);
        next.add(editedUserMsg.id);
        return next;
      });
      setEditingMsgId(null);

      truncateChatMessages(conversationId, msgId)
        .then(() => {
          doStream(newText);
        })
        .catch(() => {
          doStream(newText);
        });
    },
    [doStream, isStreaming, messages, conversationId],
  );

  const handleClose = () => {
    mountedRef.current = false;
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setReader({ conversationPanelOpen: false });
  };

  const handleToggleMode = () => {
    setReader({ chatPanelMode: chatPanelMode === "sidebar" ? "floating" : "sidebar" });
  };

  const setScrollViewport = useCallback((node: HTMLDivElement | null) => {
    scrollViewportRef.current = node;
  }, []);

  const handleRemoveReference = useCallback(
    (referenceId: string) => {
      removeReference.mutate({ conversationId, referenceId });
    },
    [conversationId, removeReference],
  );

  const handleAddImages = useCallback((files: File[]) => {
    setPendingImages((prev) => [...prev, ...files]);
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const convTitle = conversation?.title || t("newConversation");

  const [convoPopoverOpen, setConvoPopoverOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        data-floating-drag-handle={draggable ? "" : undefined}
        className={cn(
          "flex items-center gap-2 border-b px-3 py-2",
          draggable && "cursor-grab select-none active:cursor-grabbing",
        )}
        onPointerDown={draggable ? onHeaderPointerDown : undefined}
        onPointerMove={draggable ? onHeaderPointerMove : undefined}
        onPointerUp={draggable ? onHeaderPointerUp : undefined}
      >
        <Popover open={convoPopoverOpen} onOpenChange={setConvoPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              title={t("conversations")}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <History className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="left" align="start" className="w-80 p-0">
            <ConversationListPopover onSelect={() => setConvoPopoverOpen(false)} />
          </PopoverContent>
        </Popover>
        <h3 className="flex-1 truncate text-sm font-medium">{convTitle}</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleToggleMode}
          title={chatPanelMode === "sidebar" ? t("switchToFloating") : t("switchToSidebar")}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {chatPanelMode === "sidebar" ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleClose}
          title={t("closeChat")}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Reference tags */}
      {references && references.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b px-3 py-1.5">
          {references.map((ref) => (
            <ReferenceTag
              key={ref.id}
              reference={ref}
              onRemove={handleRemoveReference}
            />
          ))}
        </div>
      )}

      {/* Messages or empty state */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : messages.length === 0 ? (
        <ChatEmptyState onSuggestionClick={(text) => handleSend(text, [])} />
      ) : (
        <ScrollArea className="flex-1" viewportRef={setScrollViewport}>
          <div className="space-y-4 px-4 py-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "duration-300",
                  newIds.has(msg.id) &&
                    "animate-in fade-in slide-in-from-bottom-2",
                )}
              >
                <ChatMessageBubble
                  msg={msg}
                  isStreaming={isStreaming && msg === messages[messages.length - 1] && msg.role === "assistant"}
                  editingMsgId={editingMsgId}
                  onCopy={handleCopy}
                  onRegenerate={handleRegenerate}
                  onEdit={handleEdit}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isStreaming={isStreaming}
        onStop={handleStop}
        pendingImages={pendingImages}
        onAddImages={handleAddImages}
        onRemoveImage={handleRemoveImage}
      />
    </div>
  );
}
