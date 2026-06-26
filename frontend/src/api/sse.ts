import { refreshTokenIfNeeded } from "./client";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** A tool-call lifecycle event surfaced from the agent loop over SSE. */
export interface ToolEvent {
  /** "start" when the agent begins调用 a tool, "end" when it finishes. */
  phase: "start" | "end";
  /** Tool function name, e.g. "search_articles" / "read_article". */
  name: string;
  /** On start: the parsed args (e.g. {query: "AI"}). Empty on end. */
  args?: Record<string, unknown>;
  /** On end: short human-facing summary, e.g. "找到 3 篇". */
  result_summary?: string;
}

export interface StreamChatParams {
  conversationId: string;
  message: string;
  images?: string[];
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
  /** Optional: surface tool-call progress so the UI can show
   * "正在搜索 X … 找到 N 篇". Default no-op for backward compat. */
  onToolEvent?: (event: ToolEvent) => void;
}

async function createChatFetch(
  conversationId: string,
  message: string,
  signal: AbortSignal,
  images?: string[],
): Promise<Response> {
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const body: Record<string, unknown> = { message };
  if (images && images.length > 0) {
    body.images = images;
  }

  let res = await fetch(`${API_BASE}/api/ai/conversations/${conversationId}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (res.status === 401) {
    const newToken = await refreshTokenIfNeeded();
    if (!newToken) throw new Error("Session expired");

    const retryHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${newToken}`,
    };
    res = await fetch(`${API_BASE}/api/ai/conversations/${conversationId}/chat`, {
      method: "POST",
      headers: retryHeaders,
      body: JSON.stringify(body),
      signal,
    });
  }

  return res;
}

export async function truncateChatMessages(
  conversationId: string,
  afterMessageId: string,
): Promise<void> {
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE}/api/ai/conversations/${conversationId}/chat/messages/truncate`;
  const reqBody = { after: afterMessageId };

  let res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(reqBody),
  });

  if (res.status === 401) {
    const newToken = await refreshTokenIfNeeded();
    if (!newToken) throw new Error("Session expired");

    res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
      },
      body: JSON.stringify(reqBody),
    });
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? "Failed to truncate messages");
  }
}

export async function streamChat({
  conversationId,
  message,
  images,
  onChunk,
  onDone,
  onError,
  onToolEvent,
}: StreamChatParams): Promise<AbortController> {
  const controller = new AbortController();

  // Dispatch one parsed SSE payload. Returns true if the stream should terminate
  // (on error or [DONE]); false to keep consuming.
  const handleParsed = (parsed: Record<string, unknown>): boolean => {
    if (parsed.error) {
      onError(new Error(String(parsed.error)));
      return true;
    }
    if (typeof parsed.content === "string") {
      onChunk(parsed.content);
    } else if (parsed.type === "tool_call_start" && typeof parsed.name === "string") {
      onToolEvent?.({
        phase: "start",
        name: parsed.name,
        args: (parsed.args as Record<string, unknown> | undefined) ?? {},
      });
    } else if (parsed.type === "tool_call_end" && typeof parsed.name === "string") {
      onToolEvent?.({
        phase: "end",
        name: parsed.name,
        result_summary:
          typeof parsed.result_summary === "string" ? parsed.result_summary : undefined,
      });
    }
    return false;
  };

  try {
    const res = await createChatFetch(conversationId, message, controller.signal, images);

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      onError(new Error(error.detail ?? "Request failed"));
      return controller;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError(new Error("No response body"));
      return controller;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          onDone();
          return controller;
        }

        try {
          if (handleParsed(JSON.parse(data))) return controller;
        } catch {
          // Ignore malformed JSON lines
        }
      }
    }

    // Process any remaining data in buffer after stream ends
    if (buffer.trim().startsWith("data: ")) {
      const data = buffer.trim().slice(6);
      if (data === "[DONE]") {
        onDone();
        return controller;
      }
      try {
        if (handleParsed(JSON.parse(data))) return controller;
      } catch {
        // Ignore malformed JSON
      }
    }

    onDone();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      onDone();
    } else {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return controller;
}
