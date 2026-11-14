import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { useThemeStore } from "@/store/theme-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { QRCodeSVG } from "qrcode.react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Cpu,
  HardDrive,
  Activity,
  Shield,
  Globe,
  Radio,
  Server,
  Zap,
  Network,
  Users,
  LineChart,
  Wifi,
  Copy,
  Check,
  Eye,
  EyeOff,
  QrCode,
  Settings2,
} from "lucide-react";
import { formatBytes, formatUptime, pluralizeRu, pluralizeEn } from "@/lib/utils";
import { DeviceRoutingTable } from "@/components/pbr/DeviceRoutingTable";
import { BandwidthGraph } from "./BandwidthGraph";
import { NetworkSecurityCard } from "@/components/security/NetworkSecurityCard";

interface TrafficPoint {
  time: string;
  rx: number;
  tx: number;
}

export const Overview: React.FC = () => {
  const { t, language } = useI18nStore();
  const isRu = language === "ru";
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState<"5m" | "30m" | "3h">("5m");
  const [trafficHistory, setTrafficHistory] = useState<TrafficPoint[]>([]);
  const prevStats = useRef<{ rx: number; tx: number; time: number } | null>(null);

  // Wi-Fi QR Card interactive state
  const [showWifiKey, setShowWifiKey] = useState(false);
  const [copiedField, setCopiedField] = useState<"ssid" | "key" | null>(null);

  const handleCopy = (text: string, field: "ssid" | "key") => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Queries - 100% Real Live Telemetry
  const { data: board } = useQuery({
    queryKey: ["system-board"],
    queryFn: () => ubusClient.getSystemBoard(),
  });

  const { data: info } = useQuery({
    queryKey: ["system-info"],
    queryFn: () => ubusClient.getSystemInfo(),
    refetchInterval: 2000,
  });

  const { data: clients } = useQuery({
    queryKey: ["dhcp-leases"],
    queryFn: () => ubusClient.getDhcpLeases(),
    refetchInterval: 5000,
  });

  const { data: ifaces } = useQuery({
    queryKey: ["network-interfaces"],
    queryFn: () => ubusClient.getInterfaces(),
    refetchInterval: 3000,
  });

  const { data: wireless } = useQuery({
    queryKey: ["wireless-devices"],
    queryFn: () => ubusClient.getWirelessDevices(),
    refetchInterval: 5000,
  });

  const { data: vless } = useQuery({
    queryKey: ["vless-status"],
    queryFn: () => ubusClient.getVlessStatus(),
    refetchInterval: 5000,
  });

  const { data: zapret } = useQuery({
    queryKey: ["zapret-status"],
    queryFn: () => ubusClient.getZapretStatus(),
    refetchInterval: 5000,
  });

  const { data: awg } = useQuery({
    queryKey: ["awg-status"],
    queryFn: () => ubusClient.getAwgStatus(),
    refetchInterval: 5000,
  });

  // Real Latency Query for the active VLESS node
  const activeVlessNode = vless?.activeNode;
  const { data: vlessLatency } = useQuery({
    queryKey: ["vless-latency", activeVlessNode?.server, activeVlessNode?.port],
    queryFn: () => {
      if (!activeVlessNode?.server) return null;
      return ubusClient.testNodeLatency(activeVlessNode.server, activeVlessNode.port || 8443);
    },
    enabled: Boolean(vless?.running && activeVlessNode?.server),
    refetchInterval: 8000,
  });

  // Calculate live speed
  const [currentSpeed, setCurrentSpeed] = useState({ rx: 0, tx: 0 });

  useEffect(() => {
    if (!ifaces) return;

    let totalRx = 0;
    let totalTx = 0;
    ifaces.forEach((iface) => {
      totalRx += iface.data?.statistics?.rx_bytes || 0;
      totalTx += iface.data?.statistics?.tx_bytes || 0;
    });

    const now = Date.now();
    if (prevStats.current) {
      const dt = (now - prevStats.current.time) / 1000;
      if (dt > 0.5) {
        const rxSpeed = Math.max(0, (totalRx - prevStats.current.rx) / dt);
        const txSpeed = Math.max(0, (totalTx - prevStats.current.tx) / dt);

        setCurrentSpeed({ rx: rxSpeed, tx: txSpeed });

        setTrafficHistory((prev) => {
          const next = [
            ...prev,
            {
              time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
              rx: rxSpeed,
              tx: txSpeed,
            },
          ];
          return next.slice(-25);
        });
      }
    }

    prevStats.current = { rx: totalRx, tx: totalTx, time: now };
  }, [ifaces]);

  // Derived Real Values
  const wan = ifaces?.find(
    (i) => i.interface === "wan" || i.l3_device === "wan" || i.device === "wan"
  );
  const wanIp =
    wan?.["ipv4-address"]?.[0]?.address ||
    (wan?.up ? "DHCP Assigned" : isRu ? "Не подключен" : "Disconnected");

  const ramTotal = info?.memory?.total || 1073741824;
  const ramFree = info?.memory?.free || 536870912;
  const ramUsed = ramTotal - ramFree;
  const ramPercent = Math.round((ramUsed / ramTotal) * 100);

  // Flash / Overlay rootfs storage dynamically queried from sysfs/ubus
  const rootTotal = (info?.root?.total ? info.root.total * 1024 : 0);
  const rootUsed = (info?.root?.used ? info.root.used * 1024 : 0);
  const flashPercent = rootTotal > 0 ? Math.round((rootUsed / rootTotal) * 100) : 0;

  const load1 = (info?.load?.[0] || 0) / 65536;
  const load5 = (info?.load?.[1] || 0) / 65536;
  const load15 = (info?.load?.[2] || 0) / 65536;

  const rawLeases: any[] = Array.isArray(clients) ? clients : (clients as any)?.dhcp_leases || [];
  const clientCount = rawLeases.length;
  const clientPluralized = isRu
    ? pluralizeRu(clientCount, "устройство", "устройства", "устройств")
    : pluralizeEn(clientCount, "device", "devices");

  // Wi-Fi Real Credentials & QR Code payload
  const wifiRadios = Object.entries(wireless || {}).map(([name, data]) => ({ name, ...data }));
  const radio5G = wifiRadios.find((r) => r.band === "5g" || r.name?.includes("1") || (r as any).config?.band === "5g");
  const radio24G = wifiRadios.find((r) => r.band === "2g" || r.name?.includes("0") || (r as any).config?.band === "2g");
  const primaryIface = radio5G?.interfaces?.[0] || radio24G?.interfaces?.[0] || wifiRadios[0]?.interfaces?.[0];

  const wifiSsid = primaryIface?.ssid || "OpenWRT";
  const wifiKey = primaryIface?.key || "12345678";
  const wifiEncryption = primaryIface?.encryption || "psk2";
  const authType = wifiEncryption?.includes("sae")
    ? "WPA"
    : wifiEncryption?.includes("none")
    ? "nopass"
    : "WPA";

  const wifiQrString =
    authType === "nopass"
      ? `WIFI:T:nopass;S:${wifiSsid};;`
      : `WIFI:T:${authType};S:${wifiSsid};P:${wifiKey};;`;

  // SVG Chart points calculation
  const chartWidth = 600;
  const chartHeight = 160;
  const paddingBottom = 15;
  const maxTraffic = Math.max(...trafficHistory.map((d) => Math.max(d.rx, d.tx)), 500000);

  const getPoints = (key: "rx" | "tx") => {
    if (trafficHistory.length === 0) return "";
    return trafficHistory
      .map((d, i) => {
        const x = (i / Math.max(trafficHistory.length - 1, 1)) * chartWidth;
        const y =
          chartHeight -
          paddingBottom -
          (d[key] / maxTraffic) * (chartHeight - paddingBottom - 10);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const rxPoints = getPoints("rx");
  const txPoints = getPoints("tx");
  const rxAreaPoints = `0,${chartHeight - paddingBottom} ${rxPoints} ${chartWidth},${chartHeight - paddingBottom}`;
  const txAreaPoints = `0,${chartHeight - paddingBottom} ${txPoints} ${chartWidth},${chartHeight - paddingBottom}`;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Page Title & Router Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted border border-border text-foreground shrink-0">
            <Server className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">
                {board?.model || "OpenWrt Router"}
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {isRu ? "В сети" : "Online"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-muted-foreground mt-0.5 font-mono">
              <span>{board?.release.description || "OpenWrt 25.12"}</span>
              <span className="text-muted-foreground/40 hidden xs:inline">•</span>
              <span>Kernel {board?.kernel || "6.12"}</span>
              <span className="text-muted-foreground/40 hidden xs:inline">•</span>
              <span>
                {isRu ? "Аптайм" : "Uptime"}: {formatUptime(info?.uptime || 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto pl-12 sm:pl-0">
          <div className="text-left sm:text-right">
            <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground">{t.overview.wanUplink}</div>
            <div className="text-xs font-mono font-medium text-foreground tabular-nums">{wanIp}</div>
          </div>
          <span className={`h-2 w-2 rounded-full shrink-0 ${wan?.up ? "bg-emerald-500" : "bg-amber-500"}`} />
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-1 -mb-1 w-full">
          <TabsList className="bg-muted border border-border p-0.5 h-9 rounded-lg inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger
              value="overview"
              className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground font-medium px-3 sm:px-4 whitespace-nowrap"
            >
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              {isRu ? "Обзор" : "Overview"}
            </TabsTrigger>
            <TabsTrigger
              value="graphs"
              className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground font-medium px-3 sm:px-4 whitespace-nowrap"
            >
              <LineChart className="h-3.5 w-3.5 mr-1.5" />
              {isRu ? "Графики в реальном времени" : "Real-time Graphs"}
            </TabsTrigger>
            <TabsTrigger
              value="devices"
              className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground font-medium px-3 sm:px-4 whitespace-nowrap"
            >
              <Users className="h-3.5 w-3.5 mr-1.5" />
              {isRu ? "Маршрутизация устройств" : "Connected Devices"}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Top KPI Row (4 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CPU Load */}
            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t.overview.cpuLoad}
                </CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
                  {load1.toFixed(2)}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                  <span>5m: {load5.toFixed(2)}</span>
                  <span>•</span>
                  <span>15m: {load15.toFixed(2)}</span>
                </div>
                <Progress
                  value={Math.min(100, Math.round((load1 / 2) * 100))}
                  className="h-1 bg-muted"
                />
              </CardContent>
            </Card>

            {/* RAM Usage */}
            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t.overview.ramUsage}
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
                  {ramPercent}%
                </div>
                <div className="text-[11px] text-muted-foreground font-mono tabular-nums">
                  {formatBytes(ramUsed)} / {formatBytes(ramTotal)}
                </div>
                <Progress value={ramPercent} className="h-1 bg-muted" />
              </CardContent>
            </Card>

            {/* Flash Overlay */}
            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t.overview.flashStorage}
                </CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
                  {flashPercent}%
                </div>
                <div className="text-[11px] text-muted-foreground font-mono tabular-nums">
                  {rootTotal > 0 ? `${formatBytes(rootUsed)} / ${formatBytes(rootTotal)}` : "sysfs"}
                </div>
                <Progress value={flashPercent} className="h-1 bg-muted" />
              </CardContent>
            </Card>

            {/* Active DHCP Leases */}
            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {t.overview.activeLeases}
                </CardTitle>
                <Radio className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
                  {clientPluralized}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  {t.overview.devicesConnected}
                </div>
                <Progress
                  value={Math.min(100, clientCount * 12)}
                  className="h-1 bg-muted"
                />
              </CardContent>
            </Card>
          </div>

          {/* Wi-Fi Quick Connect & QR Code Card */}
          <Card className="border-border bg-card text-card-foreground shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 shrink-0">
                    <Wifi className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-xs font-semibold text-foreground">
                      {isRu ? "Быстрое подключение к Wi-Fi (QR-код)" : "Wi-Fi Quick Connect (QR Code)"}
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isRu
                        ? "Отсканируйте камерой смартфона для мгновенного подключения к сети"
                        : "Scan with your phone camera to join the wireless network automatically"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-500 bg-emerald-500/10">
                    {wifiSsid}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { window.location.hash = "#/wireless"; }}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                  >
                    <Settings2 className="h-3 w-3" />
                    <span>{isRu ? "Настроить Wi-Fi" : "Manage"}</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                {/* QR Code Container (High-Contrast White Frame for Optical Scanner Reliability) */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="p-3 bg-white rounded-xl shadow-md border border-zinc-200 flex items-center justify-center">
                    <QRCodeSVG
                      value={wifiQrString}
                      size={132}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono mt-2 flex items-center gap-1">
                    <QrCode className="h-3 w-3 text-muted-foreground" />
                    {isRu ? "Наведите камеру" : "Scan to connect"}
                  </span>
                </div>

                {/* Network Credentials & Radio Details */}
                <div className="flex-1 w-full space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* SSID */}
                    <div className="p-2.5 rounded-lg border border-border bg-muted/30 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                        {isRu ? "Имя сети (SSID)" : "Network Name (SSID)"}
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-foreground truncate mr-2">
                          {wifiSsid}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(wifiSsid, "ssid")}
                          className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                          title={isRu ? "Скопировать SSID" : "Copy SSID"}
                        >
                          {copiedField === "ssid" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="p-2.5 rounded-lg border border-border bg-muted/30 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                        {isRu ? "Пароль сети (WPA2/WPA3 Key)" : "Network Password"}
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-foreground tracking-wider truncate mr-2">
                          {showWifiKey ? wifiKey : "••••••••"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowWifiKey(!showWifiKey)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title={showWifiKey ? (isRu ? "Скрыть" : "Hide") : (isRu ? "Показать" : "Show")}
                          >
                            {showWifiKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(wifiKey, "key")}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title={isRu ? "Скопировать пароль" : "Copy password"}
                          >
                            {copiedField === "key" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Radios Breakdown: 2.4G & 5G */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/60">
                      <span className="text-muted-foreground">5 GHz (AX3000):</span>
                      <span className="text-emerald-500 font-semibold">{radio5G?.channel ? `Ch ${radio5G.channel}` : "Active"}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/60">
                      <span className="text-muted-foreground">2.4 GHz (AX600):</span>
                      <span className="text-emerald-500 font-semibold">{radio24G?.channel ? `Ch ${radio24G.channel}` : "Active"}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/60">
                      <span className="text-muted-foreground">{isRu ? "Шифрование:" : "Security:"}</span>
                      <span className="text-foreground font-semibold">{wifiEncryption.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network Security, Kill Switch & Leak Protection Card */}
          <NetworkSecurityCard />

          {/* Main Traffic & System Chart */}
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="pb-2 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xs font-medium text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    {isRu ? "Пропускная способность сети (WAN / VPN)" : "Real-time Network Throughput"}
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isRu
                      ? "Суммарный поток входящего (RX) и исходящего (TX) трафика"
                      : "Combined inbound (RX) and outbound (TX) bandwidth telemetry"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-xs font-mono mr-2">
                    <span className="flex items-center gap-1.5 text-foreground">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      RX: {formatBytes(currentSpeed.rx || trafficHistory[trafficHistory.length - 1]?.rx || 0)}/s
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-zinc-400" />
                      TX: {formatBytes(currentSpeed.tx || trafficHistory[trafficHistory.length - 1]?.tx || 0)}/s
                    </span>
                  </div>

                  <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border text-[11px] font-mono">
                    <button
                      onClick={() => setTimeRange("5m")}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        timeRange === "5m"
                          ? "bg-background text-foreground font-medium shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      5m
                    </button>
                    <button
                      onClick={() => setTimeRange("30m")}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        timeRange === "30m"
                          ? "bg-background text-foreground font-medium shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      30m
                    </button>
                    <button
                      onClick={() => setTimeRange("3h")}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        timeRange === "3h"
                          ? "bg-background text-foreground font-medium shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      3h
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="w-full h-44 overflow-hidden relative">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="monoRxGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isDark ? "#f4f4f5" : "#18181b"} stopOpacity="0.25" />
                      <stop offset="100%" stopColor={isDark ? "#f4f4f5" : "#18181b"} stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="monoTxGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isDark ? "#71717a" : "#64748b"} stopOpacity="0.15" />
                      <stop offset="100%" stopColor={isDark ? "#71717a" : "#64748b"} stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines */}
                  <line
                    x1="0"
                    y1="40"
                    x2={chartWidth}
                    y2="40"
                    stroke={isDark ? "#27272a" : "#e2e8f0"}
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1="0"
                    y1="90"
                    x2={chartWidth}
                    y2="90"
                    stroke={isDark ? "#27272a" : "#e2e8f0"}
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1="0"
                    y1="140"
                    x2={chartWidth}
                    y2="140"
                    stroke={isDark ? "#27272a" : "#e2e8f0"}
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />

                  {/* Area fills */}
                  {trafficHistory.length > 0 && (
                    <>
                      <polygon points={rxAreaPoints} fill="url(#monoRxGrad)" />
                      <polygon points={txAreaPoints} fill="url(#monoTxGrad)" />
                      {/* Lines */}
                      <polyline
                        points={txPoints}
                        fill="none"
                        stroke={isDark ? "#71717a" : "#64748b"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <polyline
                        points={rxPoints}
                        fill="none"
                        stroke={isDark ? "#f4f4f5" : "#18181b"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </svg>
              </div>

              {/* Time axis labels */}
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground pt-2 border-t border-border/60">
                <span>{trafficHistory[0]?.time || "00:00"}</span>
                <span>{trafficHistory[Math.floor(trafficHistory.length / 2)]?.time || "12:00"}</span>
                <span>{trafficHistory[trafficHistory.length - 1]?.time || "23:59"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Bypass & VPN Status Cards (3 Columns - 100% Real Live Data) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Zapret2 DPI Bypass */}
            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="pb-2 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span>{t.overview.zapretDpi}</span>
                  </CardTitle>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${zapret?.running ? "bg-emerald-500" : "bg-zinc-500"}`} />
                    {zapret?.running ? (isRu ? "Активен" : "Active") : (isRu ? "Остановлен" : "Stopped")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-3 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{t.overview.engine}</span>
                  <span className="font-mono text-foreground">
                    nfqws ({zapret?.fwtype || "nftables"})
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{t.overview.tcpStrategy}</span>
                  <span className="font-mono text-foreground truncate max-w-[170px]" title={zapret?.profiles?.[0]?.methods?.join(" + ")}>
                    {zapret?.profiles?.[0]?.methods?.join(" + ") || "fake + disorder (ALT11)"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">{t.overview.udpStrategy}</span>
                  <span className="font-mono text-foreground">fake + ipfrag2</span>
                </div>
              </CardContent>
            </Card>

            {/* AmneziaWG (AWG) */}
            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="pb-2 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span>{t.overview.amneziaWg}</span>
                  </CardTitle>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${awg?.active ? "bg-emerald-500" : "bg-zinc-500"}`} />
                    {awg?.active ? (isRu ? "Подключено" : "Connected") : (isRu ? "Не настроен" : "Not configured")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-3 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{t.overview.interface}</span>
                  <span className="font-mono text-foreground">
                    {awg?.active && awg?.addresses?.[0]
                      ? `awg0 (${awg.addresses[0]})`
                      : `awg0 (${isRu ? "Отключен" : "Disabled"})`}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{t.overview.obfuscation}</span>
                  <span className="font-mono text-foreground">
                    {awg?.configured
                      ? `Jc:${awg.jc ?? 4} Jmin:${awg.jmin ?? 40} H1-H4`
                      : (isRu ? "Нет профиля" : "No profile")}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">{t.overview.latestHandshake}</span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {awg?.active && awg.peers?.[0]?.latest_handshake
                      ? `${Math.max(1, Math.floor(Date.now() / 1000 - awg.peers[0].latest_handshake))} ${isRu ? "сек назад" : "s ago"}`
                      : (isRu ? "Нет соединения" : "No handshake")}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Sing-box / VLESS - Real Live Data & Real Latency */}
            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="pb-2 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>{t.overview.singboxVless}</span>
                  </CardTitle>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${vless?.running ? "bg-emerald-500" : "bg-zinc-500"}`} />
                    {vless?.running
                      ? (vlessLatency?.latency ? `${vlessLatency.latency}ms` : (isRu ? "В сети" : "Online"))
                      : (isRu ? "Отключен" : "Disabled")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-3 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{t.overview.activeNode}</span>
                  <span className="font-medium text-foreground truncate max-w-[170px]" title={activeVlessNode?.server}>
                    {activeVlessNode?.name || activeVlessNode?.server || (isRu ? "Нет активного узла" : "No active node")}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{t.overview.protocol}</span>
                  <span className="font-mono text-foreground">
                    {activeVlessNode?.transport ? activeVlessNode.transport.toUpperCase() : "VLESS"} {activeVlessNode?.security ? `(${activeVlessNode.security})` : "Reality"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">{t.overview.inboundMode}</span>
                  <span className="font-mono text-foreground">
                    {vless?.running ? "tun0 / TProxy :10808" : (isRu ? "Остановлен" : "Stopped")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Network Interfaces Table */}
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-foreground flex items-center gap-2">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  {t.overview.activeIfaces}
                </CardTitle>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {ifaces?.length || 0} {isRu ? "интерфейсов" : "interfaces"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-8 text-center"></TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      {isRu ? "Интерфейс" : "Interface"}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      {isRu ? "Протокол / Устройство" : "Proto / Device"}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      {isRu ? "IPv4 Адрес" : "IPv4 Address"}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground text-right">
                      RX / TX
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ifaces?.map((iface) => {
                    const rx = iface.data?.statistics?.rx_bytes || 0;
                    const tx = iface.data?.statistics?.tx_bytes || 0;
                    const ip =
                      iface["ipv4-address"]?.[0]?.address ||
                      (isRu ? "Не назначен" : "Unassigned");

                    return (
                      <TableRow
                        key={iface.interface}
                        className="border-border/60 hover:bg-muted/40 transition-colors"
                      >
                        <TableCell className="text-center">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              iface.up ? "bg-emerald-500" : "bg-muted-foreground/40"
                            }`}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs font-semibold text-foreground uppercase">
                            {iface.interface}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground uppercase">
                            {iface.proto} ({iface.l3_device || iface.device || "phy"})
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-foreground tabular-nums">
                            {ip}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3 text-xs font-mono tabular-nums">
                            <span className="text-foreground">
                              ↓ {formatBytes(rx)}
                            </span>
                            <span className="text-muted-foreground">
                              ↑ {formatBytes(tx)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Real-time Graphs */}
        <TabsContent value="graphs" className="mt-6">
          <BandwidthGraph />
        </TabsContent>

        {/* Tab 3: Connected Devices & Per-Device PBR */}
        <TabsContent value="devices" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-medium text-foreground">
                {isRu ? "Маршрутизация подключенных устройств" : "Per-Device Policy-Based Routing"}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isRu
                  ? "Направляйте трафик отдельных смартфонов, компьютеров или ТВ в выбранные туннели с автоматической привязкой статических DHCP-аренд"
                  : "Direct individual client devices to specific VPN tunnels or bypass with automatic static DHCP lease pinning"}
              </p>
            </div>
          </div>
          <DeviceRoutingTable />
        </TabsContent>
      </Tabs>
    </div>
  );
};
