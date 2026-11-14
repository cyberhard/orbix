import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Shield,
  Radio,
  Network,
  Cpu,
  Layers,
  Search,
  Zap,
  Globe,
  Sliders,
  Terminal,
  Package,
  Key,
  Save,
  Download,
  Wand2,
} from "lucide-react";
import { useI18nStore } from "@/store/i18n-store";
import { useWizardStore } from "@/services/wizard/wizard-store";

interface CommandItem {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  onSelectRoute: (route: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onSelectRoute, isOpen, onClose }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (onClose && !val) onClose();
    setInternalOpen(val);
  };
  const [query, setQuery] = useState("");
  const { t, lang } = useI18nStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const items: CommandItem[] = [
    // Status
    { id: "overview", title: t.nav.overview, category: t.nav.statusMonitoring, icon: <Activity className="h-4 w-4" />, action: () => onSelectRoute("overview") },
    { id: "traffic", title: t.nav.trafficTopology, category: t.nav.statusMonitoring, icon: <Activity className="h-4 w-4 text-cyan-400" />, action: () => onSelectRoute("traffic") },
    { id: "explain", title: t.nav.explainRoute, category: t.nav.statusMonitoring, icon: <Activity className="h-4 w-4 text-indigo-400" />, action: () => onSelectRoute("explain") },
    { id: "bandwidth", title: t.nav.realtimeGraphs, category: t.nav.statusMonitoring, icon: <Activity className="h-4 w-4" />, action: () => onSelectRoute("bandwidth") },
    { id: "clients", title: t.nav.connectedClients, category: t.nav.statusMonitoring, icon: <Network className="h-4 w-4" />, action: () => onSelectRoute("clients") },
    { id: "logs", title: t.nav.systemLogs, category: t.nav.statusMonitoring, icon: <Terminal className="h-4 w-4" />, action: () => onSelectRoute("logs") },
    // Policies & Lists
    { id: "policies", title: t.nav.unifiedPolicies, category: t.nav.policyControl, icon: <Sliders className="h-4 w-4 text-amber-400" />, action: () => onSelectRoute("policies") },
    { id: "lists", title: t.nav.categoryFeeds, category: t.nav.policyControl, icon: <Layers className="h-4 w-4 text-emerald-400" />, action: () => onSelectRoute("lists") },
    { id: "dns", title: t.nav.dnsCenter, category: t.nav.policyControl, icon: <Globe className="h-4 w-4 text-blue-400" />, action: () => onSelectRoute("dns") },
    // Circumvention & VPN
    { id: "vpn-awg", title: `AmneziaWG (AWG) - ${t.nav.vpnManager}`, category: t.nav.circumventionVpn, icon: <Shield className="h-4 w-4" />, action: () => onSelectRoute("vpn") },
    { id: "subscriptions", title: t.nav.subscriptions, category: t.nav.circumventionVpn, icon: <Globe className="h-4 w-4" />, action: () => onSelectRoute("subscriptions") },
    { id: "vpn-vless", title: `VLESS / Sing-box / Xray Reality - ${t.nav.vpnManager}`, category: t.nav.circumventionVpn, icon: <Globe className="h-4 w-4" />, action: () => onSelectRoute("vpn") },
    { id: "vpn-hysteria", title: `Hysteria 2 - ${t.nav.vpnManager}`, category: t.nav.circumventionVpn, icon: <Zap className="h-4 w-4" />, action: () => onSelectRoute("vpn") },
    { id: "zapret", title: t.nav.zapretBuilder, category: t.nav.circumventionVpn, icon: <Sliders className="h-4 w-4" />, action: () => onSelectRoute("zapret") },
    { id: "podkop", title: t.nav.podkopServices, category: t.nav.circumventionVpn, icon: <Layers className="h-4 w-4" />, action: () => onSelectRoute("podkop") },
    { id: "pbr", title: t.nav.policyRouting, category: t.nav.circumventionVpn, icon: <Network className="h-4 w-4" />, action: () => onSelectRoute("pbr") },
    // Network
    { id: "interfaces", title: t.nav.interfacesVlans, category: t.nav.network, icon: <Network className="h-4 w-4" />, action: () => onSelectRoute("interfaces") },
    { id: "wireless", title: t.nav.wirelessRadios, category: t.nav.network, icon: <Radio className="h-4 w-4" />, action: () => onSelectRoute("wireless") },
    { id: "dhcp", title: t.nav.dhcpDns, category: t.nav.network, icon: <Network className="h-4 w-4" />, action: () => onSelectRoute("dhcp") },
    { id: "firewall", title: t.nav.firewall, category: t.nav.network, icon: <Shield className="h-4 w-4" />, action: () => onSelectRoute("firewall") },
    { id: "diagnostics", title: t.nav.diagnostics, category: t.nav.network, icon: <Terminal className="h-4 w-4" />, action: () => onSelectRoute("diagnostics") },
    // System
    { id: "general", title: t.nav.generalSettings, category: t.nav.system, icon: <Cpu className="h-4 w-4" />, action: () => onSelectRoute("general") },
    { id: "admin", title: t.nav.adminSsh, category: t.nav.system, icon: <Key className="h-4 w-4" />, action: () => onSelectRoute("admin") },
    { id: "software", title: t.nav.softwarePackages, category: t.nav.system, icon: <Package className="h-4 w-4" />, action: () => onSelectRoute("software") },
    { id: "services", title: t.nav.startupServices, category: t.nav.system, icon: <Cpu className="h-4 w-4" />, action: () => onSelectRoute("services") },
    { id: "backup", title: t.nav.backupFlash, category: t.nav.system, icon: <Save className="h-4 w-4" />, action: () => onSelectRoute("backup") },
    { id: "install", title: `${t.nav.installCatalog} (ImageBuilder & Devices)`, category: t.nav.system, icon: <Download className="h-4 w-4 text-emerald-400" />, action: () => onSelectRoute("install") },
    { id: "wizard", title: `${t.nav.setupWizard} (First-Run Wizard)`, category: t.nav.system, icon: <Wand2 className="h-4 w-4 text-amber-400" />, action: () => useWizardStore.getState().openWizard() },
  ];

  const filtered = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border border-border/80 shadow-2xl">
        <div className="flex items-center px-4 border-b border-border/60">
          <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === "ru" ? "Введите команду или название раздела... (например, zapret, pbr, vpn)" : "Type a command or jump to page... (e.g. zapret, pbr, vpn)"}
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-12 bg-transparent"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-mono">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {lang === "ru" ? "Ничего не найдено." : "No matching commands or pages found."}
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  item.action();
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-lg text-left text-xs hover:bg-accent/60 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground group-hover:text-primary transition-colors">
                    {item.icon}
                  </span>
                  <div>
                    <div className="font-medium text-foreground">{item.title}</div>
                    <div className="text-[10px] text-muted-foreground">{item.category}</div>
                  </div>
                </div>
                <kbd className="text-[10px] text-muted-foreground group-hover:text-foreground">{t.common.jump}</kbd>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
