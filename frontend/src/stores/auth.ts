import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/api/types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
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
