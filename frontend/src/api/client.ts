import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

let refreshPromise: Promise<string | null> | null = null;

async function refreshTokenIfNeeded(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      toast.error("登录已过期，请重新登录");
      window.location.href = "/login";
      return null;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) throw new Error("Refresh failed");

      const data = (await res.json()) as {
        access_token: string;
        refresh_token: string;
      };
      setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } catch {
      logout();
      toast.error("登录已过期，请重新登录");
      window.location.href = "/login";
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  _isRetry?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options._isRetry) {
    const newToken = await refreshTokenIfNeeded();
    if (!newToken) throw new Error("Session expired");

    const retryHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: `Bearer ${newToken}`,
    };
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers: retryHeaders,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? "Request failed");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export { refreshTokenIfNeeded };

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: async <T>(path: string, file: File): Promise<T> => {
    const token = localStorage.getItem("access_token");
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const formData = new FormData();
    formData.append("file", file);

    let res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (res.status === 401) {
      const newToken = await refreshTokenIfNeeded();
      if (!newToken) throw new Error("Session expired");

      const retryHeaders: Record<string, string> = {
        Authorization: `Bearer ${newToken}`,
      };
      res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: retryHeaders,
        body: formData,
      });
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail ?? "Request failed");
    }
    return res.json() as Promise<T>;
  },
};
