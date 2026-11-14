import React from "react";
import { useThemeStore } from "@/store/theme-store";
import { useAuthStore } from "@/store/auth-store";
import { useI18nStore } from "@/store/i18n-store";
import { usePolicyStore } from "@/store/policy-store";
import { ubusClient } from "@/lib/ubus-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Menu,
  Moon,
  Sun,
  Search,
  Power,
  LogOut,
  Languages,
  Sparkles,
  SlidersHorizontal,
  Wand2,
} from "lucide-react";
import { useWizardStore } from "@/services/wizard/wizard-store";

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenCommandPalette: () => void;
  currentRouteTitle: string;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  onOpenCommandPalette,
  currentRouteTitle,
}) => {
  const { theme, toggleTheme } = useThemeStore();
  const { logout } = useAuthStore();
  const { lang, toggleLang, t } = useI18nStore();
  const { operatingMode, setOperatingMode } = usePolicyStore();
  const [isRebooting, setIsRebooting] = React.useState(false);

  const handleReboot = async () => {
    if (confirm(lang === "ru" ? "Вы уверены, что хотите перезагрузить роутер? Связь будет временно прервана." : "Are you sure you want to reboot the router? SSH and Web UI will be temporarily unavailable.")) {
      setIsRebooting(true);
      try {
        await ubusClient.reboot();
      } catch {
        // expected when router drops connection
      }
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-3 sm:px-4 backdrop-blur-md">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 mr-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-8 w-8 shrink-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="hidden sm:inline text-xs text-zinc-400 font-bold font-mono tracking-wide">ORBIX</span>
          <span className="hidden sm:inline text-zinc-700 text-xs">/</span>
          <h2 className="text-xs font-medium tracking-tight text-zinc-100 truncate max-w-[120px] sm:max-w-none">
            {currentRouteTitle}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Router IP Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>192.168.1.1</span>
        </div>

        {/* Quick Search - Compact Icon on Mobile, Bar on Desktop */}
        <button
          onClick={onOpenCommandPalette}
          className="flex h-8 w-8 sm:w-48 md:w-56 items-center justify-center sm:justify-between rounded-md border border-zinc-800 bg-zinc-900/60 sm:px-2.5 text-xs text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 transition-colors"
          title={t.header.searchPlaceholder}
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <span className="hidden sm:inline text-[11px] text-zinc-400 truncate">
              {t.header.searchPlaceholder}
            </span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-zinc-800 border border-zinc-700/50 px-1 py-0.5 text-[9px] font-mono text-zinc-400">
            ⌘K
          </kbd>
        </button>

        {/* Wizard Quick Launch */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => useWizardStore.getState().openWizard()}
          className="h-8 px-2 sm:px-2.5 text-xs font-medium gap-1.5 border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
          title={lang === "ru" ? "Запустить пошаговый мастер настройки" : "Launch Setup Wizard"}
        >
          <Wand2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="hidden sm:inline text-[11px]">{t.nav.setupWizard}</span>
        </Button>

        {/* Operating Mode Switcher */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOperatingMode(operatingMode === "simple" ? "expert" : "simple")}
          className="h-8 px-2 sm:px-2.5 text-xs font-medium gap-1.5 border-zinc-800 bg-zinc-900/70 text-zinc-200 hover:bg-zinc-850 hover:text-zinc-100"
          title={operatingMode === "simple" ? "Переключиться в экспертный режим" : "Переключиться в простой режим"}
        >
          {operatingMode === "simple" ? (
            <>
              <Sparkles className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span className="hidden sm:inline text-[11px]">{t.common.simpleMode}</span>
            </>
          ) : (
            <>
              <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span className="hidden sm:inline text-[11px]">{t.common.expertMode}</span>
            </>
          )}
        </Button>

        {/* Language Switcher */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLang}
          className="h-8 px-2 sm:px-2.5 text-xs font-mono font-medium gap-1 sm:gap-1.5 border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
          title={lang === "ru" ? "Switch to English" : "Переключить на русский"}
        >
          <Languages className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span>{lang.toUpperCase()}</span>
        </Button>

        {/* Live Router Indicator */}
        <Badge
          variant="outline"
          className="hidden md:inline-flex items-center gap-1.5 text-[10px] bg-zinc-900 border-zinc-800 text-zinc-300"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>{t.common.liveRouter}</span>
        </Badge>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 shrink-0"
          title={theme === "dark" ? t.common.switchLight : t.common.switchDark}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Reboot */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleReboot}
          disabled={isRebooting}
          className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-zinc-900 shrink-0"
          title={t.common.reboot}
        >
          <Power className="h-4 w-4" />
        </Button>

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          className="h-8 w-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 shrink-0"
          title={t.common.logout}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};
