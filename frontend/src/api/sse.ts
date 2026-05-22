const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function streamChat(
  articleId: string,
  message: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: Error) => void,
): Promise<AbortController> {
  const controller = new AbortController();
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}/api/ai/articles/${articleId}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });

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
          const parsed = JSON.parse(data);
          if (parsed.error) {
            onError(new Error(parsed.error));
            return controller;
          }
          if (parsed.content) {
            onChunk(parsed.content);
          }
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
        const parsed = JSON.parse(data);
        if (parsed.error) {
          onError(new Error(parsed.error));
          return controller;
        }
        if (parsed.content) {
          onChunk(parsed.content);
        }
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
