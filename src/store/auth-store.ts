import { create } from "zustand";
import { ubusClient } from "@/lib/ubus-client";

interface AuthState {
  isAuthenticated: boolean;
  username: string;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  if (typeof window !== "undefined") {
    window.addEventListener("ubus_auth_expired", () => {
      set({ isAuthenticated: false });
    });
  }

  return {
    isAuthenticated: ubusClient.isAuthenticated(),
    username: "root",
    isLoading: false,
    error: null,
    login: async (username, password) => {
      set({ isLoading: true, error: null });
      try {
        await ubusClient.login(username, password);
        set({ isAuthenticated: true, username, isLoading: false });
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Authentication failed";
        set({ error: message, isLoading: false, isAuthenticated: false });
        return false;
      }
    },
    logout: () => {
      ubusClient.logout();
      set({ isAuthenticated: false });
    },
    checkAuth: async () => {
      if (ubusClient.isAuthenticated()) {
        try {
          await ubusClient.getBoard();
          set({ isAuthenticated: true });
          return;
        } catch {
          // Session is expired or invalid
          ubusClient.logout();
        }
      }
      set({ isAuthenticated: false });
    },
  };
});
