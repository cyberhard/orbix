import { create } from "zustand";
import { translations, Language } from "@/i18n/translations";

interface I18nState {
  lang: Language;
  language: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: typeof translations.ru;
}

export const useI18nStore = create<I18nState>((set, get) => {
  const savedLang = (localStorage.getItem("openwrt_lang") as Language) || "ru";

  return {
    lang: savedLang,
    language: savedLang,
    t: (translations[savedLang] || translations.ru) as typeof translations.ru,
    setLang: (lang: Language) => {
      localStorage.setItem("openwrt_lang", lang);
      set({ lang, language: lang, t: translations[lang] as typeof translations.ru });
    },
    toggleLang: () => {
      const next: Language = get().lang === "ru" ? "en" : "ru";
      localStorage.setItem("openwrt_lang", next);
      set({ lang: next, language: next, t: translations[next] as typeof translations.ru });
    },
  };
});