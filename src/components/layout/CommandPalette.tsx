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
  /** Extra search aliases so old section names ("Логи", "PBR", "SSH") still resolve. */
  keywords?: string;
  action: () => void;
}

interface CommandPaletteProps {
  onSelectRoute: (route: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onSelectRoute, isOpen, onClose, onOpen }) => {
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
        if (isOpen === undefined) setInternalOpen((p) => !p);
        else if (!isOpen) onOpen?.();
        else onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpen, onClose]);

  const isRu = lang === "ru";
  // All actions target the new 14-section layout; old names remain searchable via `keywords`.
  const items: CommandItem[] = [
    // Обзор
    { id: "overview", title: t.nav.dashboard, category: t.nav.groupOverview, icon: <Activity className="h-4 w-4" />, keywords: "overview dashboard мониторинг статус bandwidth графики", action: () => onSelectRoute("overview") },
    { id: "traffic", title: `${t.nav.trafficTopology} + ${t.nav.connectedClients}`, category: t.nav.groupOverview, icon: <Network className="h-4 w-4" />, keywords: "traffic topology карта devices clients устройства топология", action: () => onSelectRoute("clients") },
    { id: "bandwidth", title: t.nav.realtimeGraphs, category: t.nav.groupOverview, icon: <Activity className="h-4 w-4" />, keywords: "bandwidth graphs скорость трафик", action: () => onSelectRoute("overview") },
    // Трафик и обход
    { id: "routing-tiers", title: `${t.nav.tierEngine} (L1·L2·L3)`, category: t.nav.groupTrafficBypass, icon: <Sliders className="h-4 w-4" />, keywords: "tiers уровни маршрутизации engine keen l1 l2 l3", action: () => onSelectRoute("policies?tab=tiers") },
    { id: "policies", title: t.nav.unifiedPolicies, category: t.nav.groupTrafficBypass, icon: <Sliders className="h-4 w-4" />, keywords: "policies политики правила routing", action: () => onSelectRoute("policies?tab=rules") },
    { id: "pbr", title: t.nav.policyRouting, category: t.nav.groupTrafficBypass, icon: <Network className="h-4 w-4" />, keywords: "pbr policy routing устройствa маршрутизация", action: () => onSelectRoute("policies?tab=pbr") },
    { id: "lists", title: t.nav.categoryFeeds, category: t.nav.groupTrafficBypass, icon: <Layers className="h-4 w-4" />, keywords: "lists categories feeds списки домены категории", action: () => onSelectRoute("policies?tab=lists") },
    { id: "vpn-awg", title: `AmneziaWG (AWG) - ${t.nav.vpnManager}`, category: t.nav.groupTrafficBypass, icon: <Shield className="h-4 w-4" />, keywords: "amneziawg awg wireguard vpn", action: () => onSelectRoute("vpn") },
    { id: "vpn-vless", title: `VLESS / Sing-box / Xray Reality - ${t.nav.vpnManager}`, category: t.nav.groupTrafficBypass, icon: <Globe className="h-4 w-4" />, keywords: "vless reality xray sing-box vpn узлы", action: () => onSelectRoute("vpn") },
    { id: "subscriptions", title: t.nav.subscriptions, category: t.nav.groupTrafficBypass, icon: <Globe className="h-4 w-4" />, keywords: "subscriptions happ подписки серверы", action: () => onSelectRoute("vpn?tab=subscriptions") },
    { id: "zapret", title: t.nav.zapretBuilder, category: t.nav.groupTrafficBypass, icon: <Sliders className="h-4 w-4" />, keywords: "zapret dpi nfqws strategy", action: () => onSelectRoute("zapret") },
    { id: "podkop", title: t.nav.podkopServices, category: t.nav.groupTrafficBypass, icon: <Layers className="h-4 w-4" />, keywords: "podkop сервисы byedpi", action: () => onSelectRoute("services?tab=podkop") },
    { id: "kid", title: isRu ? "Пульт для детей" : "Kids remote", category: t.nav.groupTrafficBypass, icon: <Shield className="h-4 w-4" />, keywords: "kid children родительский контроль bedtime", action: () => onSelectRoute("kid") },
    // Сеть
    { id: "interfaces", title: t.nav.interfacesVlans, category: t.nav.network, icon: <Network className="h-4 w-4" />, keywords: "interfaces vlans wan lan", action: () => onSelectRoute("interfaces") },
    { id: "wireless", title: t.nav.wirelessRadios, category: t.nav.network, icon: <Radio className="h-4 w-4" />, keywords: "wifi wireless ssid радиомодуль", action: () => onSelectRoute("wireless") },
    { id: "dhcp", title: `${t.nav.dhcpDns} / ${t.nav.dnsCenter}`, category: t.nav.network, icon: <Network className="h-4 w-4" />, keywords: "dhcp dns leases static апстримы rebind", action: () => onSelectRoute("dhcp") },
    { id: "dns", title: t.nav.dnsCenter, category: t.nav.network, icon: <Globe className="h-4 w-4" />, keywords: "dns upstreams leak защита утечки routing", action: () => onSelectRoute("dhcp?tab=dns") },
    { id: "firewall", title: t.nav.firewall, category: t.nav.network, icon: <Shield className="h-4 w-4" />, keywords: "firewall fw4 nftables порты", action: () => onSelectRoute("firewall") },
    // Система
    { id: "diagnostics", title: t.nav.diagnosticsLogs, category: t.nav.system, icon: <Terminal className="h-4 w-4" />, keywords: "diagnostics ping traceroute nslookup утилиты", action: () => onSelectRoute("diagnostics?tab=tools") },
    { id: "explain", title: t.nav.explainRoute, category: t.nav.system, icon: <Terminal className="h-4 w-4" />, keywords: "explain why route почему маршрут", action: () => onSelectRoute("diagnostics?tab=explain") },
    { id: "logs", title: t.nav.systemLogs, category: t.nav.system, icon: <Terminal className="h-4 w-4" />, keywords: "logs logread логи syslog", action: () => onSelectRoute("diagnostics?tab=logs") },
    { id: "services", title: t.nav.servicesTasks, category: t.nav.system, icon: <Cpu className="h-4 w-4" />, keywords: "services init автозапуск", action: () => onSelectRoute("services") },
    { id: "tasks", title: t.nav.scheduledTasks, category: t.nav.system, icon: <Cpu className="h-4 w-4" />, keywords: "tasks cron crontab планировщик", action: () => onSelectRoute("services?tab=cron") },
    { id: "software", title: t.nav.softwarePackages, category: t.nav.system, icon: <Package className="h-4 w-4" />, keywords: "software packages apk opkg пакеты", action: () => onSelectRoute("software") },
    { id: "general", title: t.nav.generalSettings, category: t.nav.system, icon: <Cpu className="h-4 w-4" />, keywords: "general settings timezone hostname язык режим", action: () => onSelectRoute("settings?tab=general") },
    { id: "admin", title: t.nav.adminSsh, category: t.nav.system, icon: <Key className="h-4 w-4" />, keywords: "admin ssh ключи пароль root dropbear", action: () => onSelectRoute("settings?tab=admin") },
    { id: "backup", title: t.nav.backupFlash, category: t.nav.system, icon: <Save className="h-4 w-4" />, keywords: "backup restore flash rollback бэкап откат", action: () => onSelectRoute("settings?tab=backup") },
    { id: "install", title: `${t.nav.installCatalog} (ImageBuilder & Devices)`, category: t.nav.system, icon: <Download className="h-4 w-4" />, keywords: "install firmware catalog прошивки устройства imagebuilder", action: () => onSelectRoute("settings?tab=install") },
    { id: "wizard", title: `${t.nav.setupWizard} (First-Run Wizard)`, category: t.nav.system, icon: <Wand2 className="h-4 w-4" />, keywords: "wizard master настройка", action: () => useWizardStore.getState().openWizard() },
  ];

  const filtered = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase()) ||
      (item.keywords || "").toLowerCase().includes(query.toLowerCase())
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
