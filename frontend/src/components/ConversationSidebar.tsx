import { useState, useRef, useEffect } from "react";
import { Plus, MessageSquareText, Trash2, Pencil, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useUpdateConversation,
} from "@/api/hooks";
import { useReaderStore } from "@/stores/reader";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/api/types";

function ConversationRow({
  conversation,
  isActive,
  onSelect,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation("reader");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conversation.title ?? "");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const updateConversation = useUpdateConversation();
  const deleteConversation = useDeleteConversation();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== conversation.title) {
      updateConversation.mutate(
        { conversationId: conversation.id, title: trimmed },
        { onSuccess: () => setRenaming(false) },
      );
    } else {
      setRenaming(false);
    }
  };

  const handleDelete = () => {
    deleteConversation.mutate(conversation.id, {
      onSuccess: () => setDeleteConfirmOpen(false),
    });
  };

  const menuItems = (
    <>
      <DropdownMenuItem
        onClick={(e) => {
          e.stopPropagation();
          setRenaming(true);
          setRenameValue(conversation.title ?? "");
        }}
      >
        <Pencil className="mr-2 h-4 w-4" />
        {t("renameConversation")}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          setDeleteConfirmOpen(true);
        }}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {t("deleteConversation")}
      </DropdownMenuItem>
    </>
  );

  if (renaming) {
    return (
      <div className="flex w-full items-center gap-1 rounded-r-md border-l-2 border-primary bg-conversation-selected px-2 py-1.5">
        <input
          ref={renameInputRef}
          className="h-6 min-w-0 flex-1 rounded border bg-background px-2 text-sm text-foreground"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") setRenaming(false);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  const timeLabel = conversation.last_message_at
    ? formatRelativeTime(conversation.last_message_at)
    : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group flex w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-r-md px-2 py-1.5 text-sm transition-colors duration-100 hover:bg-conversation-hover",
            isActive && "bg-conversation-selected font-medium border-l-2 border-primary"
          )}
          onClick={onSelect}
        >
          <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="min-w-0 truncate text-sm">
              {conversation.title || t("newConversation")}
            </div>
            {conversation.last_message_preview && (
              <div className="min-w-0 truncate text-xs text-muted-foreground">
                {conversation.last_message_preview}
              </div>
            )}
          </div>
          {timeLabel && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {timeLabel}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {menuItems}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            setRenaming(true);
            setRenameValue(conversation.title ?? "");
          }}
        >
          <Pencil className="mr-2 h-4 w-4" />
          {t("renameConversation")}
        </ContextMenuItem>
        <ContextMenuItem
          className="text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirmOpen(true);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("deleteConversation")}
        </ContextMenuItem>
      </ContextMenuContent>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteConversation")}</DialogTitle>
            <DialogDescription>{t("deleteConversationConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              {t("cancel", { ns: "common" })}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConversation.isPending}
            >
              {t("delete", { ns: "common" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContextMenu>
  );
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(iso).toLocaleDateString();
}

export function ConversationListPopover({ onSelect }: { onSelect?: () => void }) {
  const { t } = useTranslation("reader");
  const { activeConversationId, set: setReader } = useReaderStore();
  const { data: conversationsData, isLoading } = useConversations({ limit: 100 });
  const createConversation = useCreateConversation();
  const [searchValue, setSearchValue] = useState("");

  const conversations = conversationsData?.items ?? [];
  const filtered = searchValue.trim()
    ? conversations.filter((c: Conversation) =>
        (c.title ?? "").toLowerCase().includes(searchValue.toLowerCase())
      )
    : conversations;

  const handleCreate = () => {
    createConversation.mutate(undefined, {
      onSuccess: (conv) => {
        setReader({ activeConversationId: conv.id, conversationPanelOpen: true });
        onSelect?.();
      },
    });
  };

  const handleSelect = (convId: string) => {
    setReader({ activeConversationId: convId, conversationPanelOpen: true });
    onSelect?.();
  };

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
          {t("conversations")}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleCreate}
          title={t("newConversation")}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-2 py-1.5">
        <Input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={t("searchConversations")}
          className="h-7 text-xs rounded-lg"
        />
      </div>

      <ScrollArea className="min-w-0" style={{ maxHeight: "360px" }}>
        <div className="min-w-0 space-y-0.5 p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              {t("noConversations")}
            </p>
          ) : (
            filtered.map((conv: Conversation) => (
              <ConversationRow
                key={conv.id}
                conversation={conv}
                isActive={activeConversationId === conv.id}
                onSelect={() => handleSelect(conv.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
