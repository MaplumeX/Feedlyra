import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: { id: string; email: string; username: string } | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: { id: string; email: string; username: string }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (access, refresh) => {
        localStorage.setItem("access_token", access);
        set({ accessToken: access, refreshToken: refresh });
      },
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem("access_token");
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    { name: "feedlyra-auth" }
  )
);
