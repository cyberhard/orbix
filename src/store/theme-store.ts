import { create } from "zustand";

interface ThemeState {
  theme: "dark" | "light";
  toggleTheme: () => void;
  setTheme: (theme: "dark" | "light") => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const saved = localStorage.getItem("openwrt_theme") as "dark" | "light" | null;
  const initialTheme = saved || "dark";
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(initialTheme);
  }

  return {
    theme: initialTheme,
    toggleTheme: () => {
      set((state) => {
        const next = state.theme === "dark" ? "light" : "dark";
        localStorage.setItem("openwrt_theme", next);
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(next);
        return { theme: next };
      });
    },
    setTheme: (theme) => {
      localStorage.setItem("openwrt_theme", theme);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(theme);
      set({ theme });
    },
  };
});
