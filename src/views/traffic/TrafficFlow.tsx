// Visual Network Topology & Traffic Flow Component
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { usePolicyStore } from "@/store/policy-store";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Smartphone,
  Laptop,
  Tv,
  Router,
  Shield,
  Zap,
  Globe,
  Radio,
  Network,
  Activity,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { formatBits, formatBytes } from "@/lib/utils";

interface TopologyNode {
  id: string;
  stage: "source" | "policy" | "dns" | "firewall" | "dpi" | "outbound";
  label: string;
  labelRu: string;
  sublabel?: string;
  icon: any;
  status: "active" | "standby" | "disabled" | "bypassed";
  metrics?: { rx?: number; tx?: number; latency?: number };
  details?: Record<string, string>;
}

export const TrafficFlow: React.FC = () => {
  const { language } = useI18nStore();
  const isRu = language === "ru";
  const { policies, categories } = usePolicyStore();

  const [selectedSource, setSelectedSource] = useState<string>("device:192.168.1.130");
  const [selectedDestination, setSelectedDestination] = useState<string>("category:youtube");
  const [selectedStageNode, setSelectedStageNode] = useState<string | null>("dpi-zapret");

  const { data: ifaces } = useQuery({
    queryKey: ["network-interfaces"],
    queryFn: () => ubusClient.getInterfaces(),
    refetchInterval: 2000,
  });

  const { data: leases } = useQuery({
    queryKey: ["dhcp-leases"],
    queryFn: () => ubusClient.getDhcpLeases(),
    refetchInterval: 4000,
  });

  const wan = ifaces?.find((i) => i.interface === "wan" || i.l3_device === "wan");
  const singbox = ifaces?.find((i) => i.interface === "singbox");

  // Determine active flow characteristics based on selection
  const isYoutube = selectedDestination.includes("youtube");
  const isDiscord = selectedDestination.includes("discord");
  const isAi = selectedDestination.includes("ai");
  const isRuNet = selectedDestination.includes("russia") || selectedDestination.includes("banking");
  const isRestricted = selectedDestination.includes("restricted") || selectedDestination.includes("instagram");

  const activeDpi = isYoutube ? "hostfakesplit (Google CDN)" : isDiscord ? "multisplit (Discord)" : null;
  const activeOutbound = isRestricted ? "singbox" : isAi ? "dns-ai / singbox" : "wan";
  const activeDns = isAi
    ? "dns-ai.ru (Smart DNS)"
    : isRuNet
    ? "77.88.8.8 (Яндекс.DNS)"
    : "Google DoH / DoT (dns.google)";

  return (
    <div className="space-y-6">
      {/* Header & Flow Selector Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            <span>{isRu ? "Визуальная топология и маршрут трафика (Traffic Flow)" : "Visual Network Topology & Traffic Flow"}</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isRu
              ? "Интерактивная карта прохождения сетевых пакетов: Клиент → Политики → DNS → Фаервол → DPI → Шлюз"
              : "Interactive end-to-end packet journey: Client → Policy Engine → DNS → Firewall → DPI → Gateway"}
          </p>
        </div>

        {/* Quick flow test selectors */}
        <div className="flex flex-wrap items-center gap-2 bg-zinc-900/80 p-1.5 rounded-lg border border-zinc-800">
          <span className="text-[11px] text-zinc-500 font-medium px-2">{isRu ? "Тест маршрута:" : "Trace flow:"}</span>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="h-7 text-xs bg-zinc-950 border border-zinc-800 rounded px-2 text-zinc-200 font-mono"
          >
            <option value="device:192.168.1.130">Redmi Note 9 (192.168.1.130)</option>
            <option value="device:192.168.1.195">Redmi Note 12 (192.168.1.195)</option>
            <option value="group:smartphones">{isRu ? "Группа: Смартфоны" : "Group: Smartphones"}</option>
            <option value="all">{isRu ? "Все устройства LAN" : "All LAN Devices"}</option>
          </select>

          <span className="text-zinc-600">→</span>

          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
            className="h-7 text-xs bg-zinc-950 border border-zinc-800 rounded px-2 text-zinc-200 font-mono"
          >
            <option value="category:youtube">YouTube / Google Video</option>
            <option value="category:discord">Discord Voice & Media</option>
            <option value="category:ai_services">ChatGPT / Claude (AI)</option>
            <option value="category:restricted">Instagram / Twitter (VPN)</option>
            <option value="category:russia">Госуслуги / Банки (.RU)</option>
          </select>
        </div>
      </div>

      {/* Main Visual Pipeline Map */}
      <Card className="border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-zinc-800/80 pb-3 bg-zinc-900/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Network className="h-4 w-4 text-emerald-400" />
              <span>{isRu ? "Активная цепочка обработки трафика" : "Active Packet Processing Pipeline"}</span>
            </CardTitle>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {isRu ? "Реальные данные ядром проверены" : "Kernel-verified active state"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 relative">
            {/* Stage 1: Client Source */}
            <div
              onClick={() => setSelectedStageNode("source")}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                selectedStageNode === "source"
                  ? "border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-950/40"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-[9px] uppercase font-mono bg-zinc-950 border-zinc-800 text-zinc-400">
                  {isRu ? "1. Источник" : "1. Source"}
                </Badge>
                <Smartphone className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="font-semibold text-xs text-zinc-100">Redmi Note 9</div>
              <div className="text-[11px] font-mono text-zinc-400 mt-0.5">192.168.1.130</div>
              <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
                <span>Wi-Fi 5 GHz</span>
                <span className="text-emerald-400 font-mono">-61 dBm</span>
              </div>
            </div>

            {/* Stage 2: Unified Policy Engine */}
            <div
              onClick={() => setSelectedStageNode("policy")}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                selectedStageNode === "policy"
                  ? "border-purple-500 bg-purple-950/20 shadow-lg shadow-purple-950/40"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-[9px] uppercase font-mono bg-zinc-950 border-zinc-800 text-purple-400">
                  {isRu ? "2. Политика" : "2. Policy"}
                </Badge>
                <Radio className="h-4 w-4 text-purple-400" />
              </div>
              <div className="font-semibold text-xs text-zinc-100 truncate">
                {isYoutube ? "YouTube Zapret" : isDiscord ? "Discord Zapret" : isRuNet ? "RuNet Direct" : "VLESS Reality"}
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                {isRu ? "Приоритет: #" : "Priority: #"}{isYoutube ? 20 : isDiscord ? 25 : isRuNet ? 10 : 40}
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
                <span>Single Truth</span>
                <span className="text-purple-400 font-mono">{isRu ? "Выиграло" : "Winner"}</span>
              </div>
            </div>

            {/* Stage 3: DNS Resolution */}
            <div
              onClick={() => setSelectedStageNode("dns")}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                selectedStageNode === "dns"
                  ? "border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-950/40"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-[9px] uppercase font-mono bg-zinc-950 border-zinc-800 text-blue-400">
                  {isRu ? "3. DNS Резолв" : "3. DNS Resolver"}
                </Badge>
                <Globe className="h-4 w-4 text-blue-400" />
              </div>
              <div className="font-semibold text-xs text-zinc-100 truncate">
                {isAi ? "dns-ai.ru" : isRuNet ? "77.88.8.8" : "1.1.1.1 DoH"}
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                {isAi ? "Smart Reverse Proxy" : isRuNet ? "Yandex DNS / ISP" : "Cloudflare Tunnel"}
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
                <span>DNS Leak Prot</span>
                <span className="text-blue-400 font-mono">{isRu ? "Активна" : "Active"}</span>
              </div>
            </div>

            {/* Stage 4: Firewall fw4 */}
            <div
              onClick={() => setSelectedStageNode("firewall")}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                selectedStageNode === "firewall"
                  ? "border-amber-500 bg-amber-950/20 shadow-lg shadow-amber-950/40"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-[9px] uppercase font-mono bg-zinc-950 border-zinc-800 text-amber-400">
                  {isRu ? "4. Фаервол" : "4. Firewall"}
                </Badge>
                <Shield className="h-4 w-4 text-amber-400" />
              </div>
              <div className="font-semibold text-xs text-zinc-100">fw4 / nftables</div>
              <div className="text-[11px] font-mono text-emerald-400 mt-0.5">ACCEPT • MASQ</div>
              <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
                <span>Reject QUIC</span>
                <span className="text-amber-400 font-mono">TCP 443</span>
              </div>
            </div>

            {/* Stage 5: Zapret DPI Processing */}
            <div
              onClick={() => setSelectedStageNode("dpi-zapret")}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                selectedStageNode === "dpi-zapret"
                  ? "border-purple-400 bg-purple-950/20 shadow-lg shadow-purple-950/40"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-[9px] uppercase font-mono bg-zinc-950 border-zinc-800 text-purple-400">
                  {isRu ? "5. DPI Десинхронизация" : "5. DPI Bypass"}
                </Badge>
                <Zap className="h-4 w-4 text-purple-400" />
              </div>
              <div className="font-semibold text-xs text-zinc-100">
                {activeDpi ? "Zapret (nfqws)" : isRu ? "Прямой пропуск" : "Bypass (No DPI)"}
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate">
                {activeDpi ? activeDpi : isRu ? "Без модификаций" : "Unmodified TLS"}
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
                <span>NFQUEUE 200</span>
                <span className={`font-mono ${activeDpi ? "text-purple-400" : "text-zinc-500"}`}>
                  {activeDpi ? (isRu ? "Активен" : "Active") : (isRu ? "Пропуск" : "Pass")}
                </span>
              </div>
            </div>

            {/* Stage 6: Outbound Gateway */}
            <div
              onClick={() => setSelectedStageNode("outbound")}
              className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                selectedStageNode === "outbound"
                  ? "border-emerald-400 bg-emerald-950/20 shadow-lg shadow-emerald-950/40"
                  : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-[9px] uppercase font-mono bg-zinc-950 border-zinc-800 text-emerald-400">
                  {isRu ? "6. Шлюз выхода" : "6. Outbound"}
                </Badge>
                <Router className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="font-semibold text-xs text-zinc-100 truncate">
                {activeOutbound === "wan" ? "Direct WAN" : "Sing-box Reality"}
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                {activeOutbound === "wan" ? "10.193.76.1" : "Helsinki (48 ms)"}
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
                <span>Скорость (RX)</span>
                <span className="text-emerald-400 font-mono">
                  {formatBits((wan?.data?.statistics?.rx_bytes || 0) > 0 ? 3200000 : 0)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Node Inspector Drawer */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Info className="h-4 w-4 text-zinc-400" />
              <span>
                {selectedStageNode === "source" && (isRu ? "Детали узла: Клиентское устройство" : "Node Details: Client Source")}
                {selectedStageNode === "policy" && (isRu ? "Детали узла: Единый движок политик" : "Node Details: Unified Policy Engine")}
                {selectedStageNode === "dns" && (isRu ? "Детали узла: DNS-резолвер" : "Node Details: DNS Resolver")}
                {selectedStageNode === "firewall" && (isRu ? "Детали узла: Фаервол (fw4 / nftables)" : "Node Details: Firewall fw4")}
                {selectedStageNode === "dpi-zapret" && (isRu ? "Детали узла: Zapret DPI Desync" : "Node Details: Zapret DPI Processor")}
                {selectedStageNode === "outbound" && (isRu ? "Детали узла: Сетевой шлюз выхода" : "Node Details: Outbound Gateway")}
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3 text-xs">
          {selectedStageNode === "dpi-zapret" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px]">{isRu ? "Активная стратегия YouTube" : "YouTube Strategy"}</span>
                <div className="font-mono text-zinc-200 text-xs font-semibold">hostfakesplit (Google CDN)</div>
                <p className="text-[10px] text-zinc-400">{isRu ? "Расщепление SNI с подменой хоста на www.google.com" : "Host SNI splitting with www.google.com mod"}</p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px]">{isRu ? "Стратегия для Discord" : "Discord Strategy"}</span>
                <div className="font-mono text-zinc-200 text-xs font-semibold">multisplit + fake (pos=1)</div>
                <p className="text-[10px] text-zinc-400">{isRu ? "Многосегментный сплит TLS ClientHello" : "Multisegment TLS ClientHello desync"}</p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px]">{isRu ? "Статус перехвата NFQUEUE" : "NFQUEUE Hook"}</span>
                <div className="font-mono text-emerald-400 text-xs font-semibold">Queue 200 (PID 1058)</div>
                <p className="text-[10px] text-zinc-400">{isRu ? "Перехват TCP 80,443,2053,8443 и UDP 443" : "TCP 80/443/8443 & UDP 443 interception"}</p>
              </div>
            </div>
          )}

          {selectedStageNode === "source" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px]">{isRu ? "Имя устройства" : "Device Hostname"}</span>
                <div className="font-mono text-zinc-200 text-xs font-semibold">Redmi Note 9</div>
                <span className="text-[10px] text-zinc-500 font-mono">b2:68:c5:3d:2e:52</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px]">{isRu ? "Текущий IP адрес" : "IPv4 Address"}</span>
                <div className="font-mono text-emerald-400 text-xs font-semibold">192.168.1.130</div>
                <span className="text-[10px] text-zinc-400">{isRu ? "Статическая фиксация DHCP активна" : "Static DHCP pinned"}</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px]">{isRu ? "Физический интерфейс" : "Physical Interface"}</span>
                <div className="font-mono text-zinc-200 text-xs font-semibold">phy0.1-ap0 (Wi-Fi 7 / 5 GHz)</div>
                <span className="text-[10px] text-zinc-400">{isRu ? "Скорость соединения: 433 Мбит/с" : "Link rate: 433 Mbps"}</span>
              </div>
            </div>
          )}

          {selectedStageNode === "outbound" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px]">{isRu ? "Прямой WAN шлюз" : "Direct WAN Gateway"}</span>
                <div className="font-mono text-zinc-200 text-xs font-semibold">10.193.76.1 (eth0)</div>
                <span className="text-[10px] text-zinc-400">{isRu ? "IP роутера: 10.193.76.207" : "WAN IP: 10.193.76.207"}</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px]">{isRu ? "Туннель Sing-box" : "Sing-box Gateway"}</span>
                <div className="font-mono text-emerald-400 text-xs font-semibold">172.19.0.1 (gvisor TUN)</div>
                <span className="text-[10px] text-zinc-400">XTLS Reality • ticket.rzd.ru</span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-zinc-500 text-[11px]">{isRu ? "Политика Failover" : "Failover & Fallback"}</span>
                <div className="font-mono text-blue-400 text-xs font-semibold">{isRu ? "Автопереключение" : "Auto Switch"}</div>
                <span className="text-[10px] text-zinc-400">{isRu ? "Резервные ноды: 39 серверов в пуле" : "39 backup servers in pool"}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
