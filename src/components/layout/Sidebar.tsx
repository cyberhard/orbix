import React from "react";
import { Activity, Users, Terminal, Shield, Sliders, Network, Radio, FileCode2, Package, Save, Router, ChevronRight, X, Wand2, SlidersHorizontal, RotateCw, Baby } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18nStore } from "@/store/i18n-store";
import { usePolicyStore } from "@/store/policy-store";
import { useWizardStore } from "@/services/wizard/wizard-store";

interface SidebarProps {
  currentRoute: string;
  onSelectRoute: (route: string) => void;
  isOpen: boolean;
}

interface NavSection {
  title: string;
  items: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    highlight?: boolean;
  }>;
}

// Technical sections hidden in Simple mode (interface/firewall/diagnostics/services/software)
const EXPERT_ONLY = new Set(["interfaces", "firewall", "diagnostics", "services", "software"]);

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, onSelectRoute, isOpen }) => {
  const { t, lang } = useI18nStore();
  const { operatingMode } = usePolicyStore();
  const isRu = lang === "ru";

  // Target layout: 4 groups / 14 sections (Expert). Simple mode shows 9 by hiding the 5 technical ones.
  const sections: NavSection[] = [
    {
      title: t.nav.groupOverview,
      items: [
        { id: "overview", label: t.nav.dashboard, icon: <Activity className="h-4 w-4" /> },
        { id: "clients", label: t.nav.devicesMap, icon: <Users className="h-4 w-4" />, badge: "Map" },
      ],
    },
    {
      title: t.nav.groupTrafficBypass,
      items: [
        {
          id: "policies",
          label: operatingMode === "simple"
            ? (isRu ? "Правила и маршруты" : "Routing Rules")
            : t.nav.routingHub,
          icon: <SlidersHorizontal className="h-4 w-4" />,
          badge: operatingMode === "simple" ? "Smart" : "L1·L2·L3",
        },
        { id: "vpn", label: t.nav.vpnSubs, icon: <Shield className="h-4 w-4" />, badge: "Happ" },
        { id: "zapret", label: t.nav.zapretBuilder, icon: <Sliders className="h-4 w-4" /> },
        { id: "kid", label: isRu ? "Пульт для детей" : "Kids remote", icon: <Baby className="h-4 w-4" />, badge: "NEW" },
      ],
    },
    {
      title: t.nav.network,
      items: [
        { id: "interfaces", label: t.nav.interfacesVlans, icon: <Network className="h-4 w-4" /> },
        { id: "wireless", label: t.nav.wirelessRadios, icon: <Radio className="h-4 w-4" /> },
        { id: "dhcp", label: t.nav.dhcpDns, icon: <FileCode2 className="h-4 w-4" /> },
        { id: "firewall", label: t.nav.firewall, icon: <Shield className="h-4 w-4" /> },
      ],
    },
    {
      title: t.nav.system,
      items: [
        { id: "diagnostics", label: t.nav.diagnosticsLogs, icon: <Terminal className="h-4 w-4" /> },
        { id: "services", label: t.nav.servicesTasks, icon: <RotateCw className="h-4 w-4" /> },
        { id: "software", label: t.nav.softwarePackages, icon: <Package className="h-4 w-4" /> },
        { id: "settings", label: t.nav.settingsBackup, icon: <Save className="h-4 w-4" />, badge: "Safe" },
      ],
    },
  ];

  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: operatingMode === "simple"
        ? section.items.filter((item) => !EXPERT_ONLY.has(item.id))
        : section.items,
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => onSelectRoute(currentRoute)}
        aria-hidden="true"
      />

      {/* Sidebar Panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-64 border-r border-border bg-card text-card-foreground transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:z-0 select-none",
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Brand header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground border border-border shrink-0">
              <Router className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                ORBIX <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">25.12</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">OpenWrt Platform</span>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => onSelectRoute(currentRoute)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h4 className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </h4>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = currentRoute === item.id;
                  return (
                    <button
                      key={item.id}
                      data-route={item.id}
                      onClick={() => onSelectRoute(item.id)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-normal transition-colors select-none",
                        isActive
                          ? "bg-secondary text-secondary-foreground font-medium border border-border shadow-sm"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={cn(isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>

                      {item.badge ? (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[9px] font-mono",
                            isActive
                              ? "bg-background text-foreground border border-border"
                              : "bg-muted/80 text-muted-foreground border border-border/60 group-hover:text-foreground"
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : (
                        isActive && <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info & Quick Wizard */}
        <div className="border-t border-border p-3 bg-muted/20 space-y-2">
          <button
            onClick={() => useWizardStore.getState().openWizard()}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-md bg-card hover:bg-muted border border-border text-foreground text-xs font-medium transition-colors"
          >
            <Wand2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>{t.nav.setupWizard}</span>
          </button>
          <div className="flex items-center justify-between text-[11px] pt-0.5">
            <div className="flex flex-col">
              <span className="font-medium text-foreground">MediaTek Filogic</span>
              <span className="text-[10px] text-muted-foreground font-mono">aarch64 • 1GB RAM</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-muted-foreground font-mono">{t.common.online}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
