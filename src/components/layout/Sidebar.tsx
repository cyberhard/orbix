import React from "react";
import {
  Activity,
  LineChart,
  Users,
  Terminal,
  Shield,
  Sliders,
  Layers,
  Network,
  Radio,
  FileCode2,
  Cpu,
  Key,
  Package,
  RotateCw,
  Calendar,
  Save,
  Router,
  ChevronRight,
  Globe,
  X,
  Workflow,
  HelpCircle,
  Sparkles,
  SlidersHorizontal,
  BookmarkCheck,
  Server,
  Download,
  Wand2,
} from "lucide-react";
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

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, onSelectRoute, isOpen }) => {
  const { t, lang } = useI18nStore();
  const { operatingMode } = usePolicyStore();

  const sections: NavSection[] = operatingMode === "simple"
    ? [
        {
          title: lang === "ru" ? "Управление сетью" : "Network Control",
          items: [
            { id: "overview", label: t.nav.overview, icon: <Activity className="h-4 w-4" /> },
            {
              id: "policies",
              label: lang === "ru" ? "Правила и маршруты" : "Routing Rules",
              icon: <Sparkles className="h-4 w-4 text-amber-400" />,
              badge: "Smart",
              highlight: true,
            },
            {
              id: "traffic",
              label: t.nav.trafficTopology,
              icon: <Workflow className="h-4 w-4 text-cyan-400" />,
              badge: "Flow",
            },
            {
              id: "explain",
              label: t.nav.explainRoute,
              icon: <HelpCircle className="h-4 w-4 text-indigo-400" />,
            },
            {
              id: "vpn",
              label: lang === "ru" ? "VPN и Подписки" : "VPN & Services",
              icon: <Shield className="h-4 w-4 text-emerald-400" />,
              badge: "Failover",
            },
            { id: "clients", label: t.nav.connectedClients, icon: <Users className="h-4 w-4" /> },
            { id: "wireless", label: t.nav.wirelessRadios, icon: <Radio className="h-4 w-4" /> },
          ],
        },
        {
          title: lang === "ru" ? "Диагностика и Система" : "Diagnostics & System",
          items: [
            { id: "diagnostics", label: t.nav.diagnostics, icon: <Terminal className="h-4 w-4" /> },
            { id: "bandwidth", label: t.nav.realtimeGraphs, icon: <LineChart className="h-4 w-4" /> },
            { id: "general", label: t.nav.generalSettings, icon: <Cpu className="h-4 w-4" /> },
            { id: "install", label: t.nav.installCatalog, icon: <Download className="h-4 w-4 text-emerald-400" />, badge: "Catalog" },
          ],
        },
      ]
    : [
        {
          title: t.nav.statusMonitoring,
          items: [
            { id: "overview", label: t.nav.overview, icon: <Activity className="h-4 w-4" /> },
            {
              id: "traffic",
              label: t.nav.trafficTopology,
              icon: <Workflow className="h-4 w-4 text-cyan-400" />,
              badge: "Flow",
              highlight: true,
            },
            {
              id: "explain",
              label: t.nav.explainRoute,
              icon: <HelpCircle className="h-4 w-4 text-indigo-400" />,
              badge: "Why?",
            },
            { id: "bandwidth", label: t.nav.realtimeGraphs, icon: <LineChart className="h-4 w-4" /> },
            { id: "clients", label: t.nav.connectedClients, icon: <Users className="h-4 w-4" /> },
            { id: "logs", label: t.nav.systemLogs, icon: <Terminal className="h-4 w-4" /> },
          ],
        },
        {
          title: t.nav.policyControl,
          items: [
            {
              id: "policies",
              label: t.nav.unifiedPolicies,
              icon: <SlidersHorizontal className="h-4 w-4 text-amber-400" />,
              badge: "Engine",
              highlight: true,
            },
            {
              id: "lists",
              label: t.nav.categoryFeeds,
              icon: <BookmarkCheck className="h-4 w-4 text-emerald-400" />,
              badge: "Feeds",
            },
            {
              id: "dns",
              label: t.nav.dnsCenter,
              icon: <Server className="h-4 w-4 text-blue-400" />,
              badge: "Smart",
            },
            { id: "pbr", label: t.nav.policyRouting, icon: <Network className="h-4 w-4" />, badge: "PBR" },
            { id: "zapret", label: t.nav.zapretBuilder, icon: <Sliders className="h-4 w-4" /> },
            { id: "podkop", label: t.nav.podkopServices, icon: <Layers className="h-4 w-4" /> },
          ],
        },
        {
          title: t.nav.circumventionVpn,
          items: [
            { id: "vpn", label: t.nav.vpnManager, icon: <Shield className="h-4 w-4" />, badge: "Groups" },
            { id: "subscriptions", label: t.nav.subscriptions, icon: <Globe className="h-4 w-4" />, badge: "Happ" },
          ],
        },
        {
          title: t.nav.network,
          items: [
            { id: "interfaces", label: t.nav.interfacesVlans, icon: <Network className="h-4 w-4" /> },
            { id: "wireless", label: t.nav.wirelessRadios, icon: <Radio className="h-4 w-4" /> },
            { id: "dhcp", label: t.nav.dhcpDns, icon: <FileCode2 className="h-4 w-4" /> },
            { id: "firewall", label: t.nav.firewall, icon: <Shield className="h-4 w-4" /> },
            { id: "diagnostics", label: t.nav.diagnostics, icon: <Terminal className="h-4 w-4" /> },
          ],
        },
        {
          title: t.nav.system,
          items: [
            { id: "general", label: t.nav.generalSettings, icon: <Cpu className="h-4 w-4" /> },
            { id: "admin", label: t.nav.adminSsh, icon: <Key className="h-4 w-4" /> },
            { id: "software", label: t.nav.softwarePackages, icon: <Package className="h-4 w-4" /> },
            { id: "services", label: t.nav.startupServices, icon: <RotateCw className="h-4 w-4" /> },
            { id: "tasks", label: t.nav.scheduledTasks, icon: <Calendar className="h-4 w-4" /> },
            { id: "backup", label: t.nav.backupFlash, icon: <Save className="h-4 w-4" /> },
            { id: "install", label: t.nav.installCatalog, icon: <Download className="h-4 w-4 text-emerald-400" />, badge: "Catalog" },
          ],
        },
      ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => onSelectRoute(currentRoute)}
        aria-hidden="true"
      />

      {/* Sidebar Panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-64 border-r border-zinc-800/80 bg-zinc-950 transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:z-0 select-none",
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Brand header */}
        <div className="flex h-14 items-center justify-between border-b border-zinc-800/80 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-zinc-200 border border-zinc-800 shrink-0">
              <Router className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-1.5">
                OpenWrt <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">25.12</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Modern Admin UI</span>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => onSelectRoute(currentRoute)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h4 className="px-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
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
                          ? "bg-zinc-900 text-zinc-100 font-medium border border-zinc-800 shadow-sm"
                          : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={cn(isActive ? "text-zinc-100" : "text-zinc-500 group-hover:text-zinc-300")}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>

                      {item.badge ? (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.2 text-[9px] font-mono",
                            isActive
                              ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                              : "bg-zinc-900/80 text-zinc-500 border border-zinc-800/60 group-hover:text-zinc-400"
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : (
                        isActive && <ChevronRight className="h-3 w-3 text-zinc-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info & Quick Wizard */}
        <div className="border-t border-zinc-800/80 p-3 bg-zinc-950 space-y-2.5">
          <button
            onClick={() => useWizardStore.getState().openWizard()}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-md bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition-all shadow-sm"
          >
            <Wand2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>{t.nav.setupWizard}</span>
          </button>
          <div className="flex items-center justify-between text-[11px] pt-0.5">
            <div className="flex flex-col">
              <span className="font-medium text-zinc-300">MediaTek Filogic</span>
              <span className="text-[10px] text-zinc-500">aarch64 • 1GB RAM</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-zinc-400 font-mono">{t.common.online}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
