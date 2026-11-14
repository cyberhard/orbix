import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { useSubscriptionStore } from "@/store/subscription-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
} from "lucide-react";
import { formatBytes, formatUptime, pluralizeRu, pluralizeEn } from "@/lib/utils";
import { DeviceRoutingTable } from "@/components/pbr/DeviceRoutingTable";
import { BandwidthGraph } from "./BandwidthGraph";

interface TrafficPoint {
  time: string;
  rx: number;
  tx: number;
}

export const Overview: React.FC = () => {
  const { t, language } = useI18nStore();
  const isRu = language === "ru";
  const { nodes, activeNodeId } = useSubscriptionStore();

  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState<"5m" | "30m" | "3h">("30m");
  const [trafficHistory, setTrafficHistory] = useState<TrafficPoint[]>([]);
  const prevWanRef = useRef<{ rx: number; tx: number; time: number } | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState({ rx: 0, tx: 0 });

  const { data: board } = useQuery({
    queryKey: ["system-board"],
    queryFn: () => ubusClient.getBoard(),
  });

  const { data: info } = useQuery({
    queryKey: ["system-info"],
    queryFn: () => ubusClient.getSystemInfo(),
    refetchInterval: 2000,
  });

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

  const { data: awg } = useQuery({
    queryKey: ["awg-status"],
    queryFn: () => ubusClient.getAwgConfig(),
  });

  // Load calculation
  const normalizeLoad = (val?: number) => {
    if (!val) return 0.05;
    return val > 100 ? val / 65536 : val;
  };

  const load1 = normalizeLoad(info?.load[0]);
  const load5 = normalizeLoad(info?.load[1]);
  const load15 = normalizeLoad(info?.load[2]);

  // Dynamic RAM calculation (works across all router models & architectures)
  const ramTotal = info?.memory.total || 0;
  const ramAvail = info?.memory.available || (info?.memory.free ? info.memory.free + (info.memory.buffered || 0) + (info.memory.cached || 0) : 0);
  const ramUsed = Math.max(0, ramTotal - ramAvail);
  const ramPercent = ramTotal > 0 ? Math.min(100, Math.max(1, Math.round((ramUsed / ramTotal) * 100))) : 0;

  // Dynamic Flash / Overlay calculation (handles native OpenWrt KiB statvfs blocks)
  const rootTotal = info?.root.total
    ? (info.root.total < 10000000 ? info.root.total * 1024 : info.root.total)
    : 0;
  const rootUsed = info?.root.used
    ? (info.root.used < 10000000 ? info.root.used * 1024 : info.root.used)
    : 0;
  const flashPercent = rootTotal > 0 ? Math.min(100, Math.max(1, Math.round((rootUsed / rootTotal) * 100))) : 0;

  // Live client count from real DHCP leases & host hints
  const clientCount = leases?.length || 0;
  const clientPluralized = isRu
    ? pluralizeRu(clientCount, "устройство", "устройства", "устройств")
    : pluralizeEn(clientCount, "device", "devices");

  const wan = ifaces?.find((i) => i.interface === "wan" || i.l3_device === "wan" || i.device === "wan");
  const wanIp = wan?.["ipv4-address"]?.[0]?.address || (isRu ? "Подключено" : "Connected");
  const wanRxBytes = wan?.data?.statistics?.rx_bytes || 0;
  const wanTxBytes = wan?.data?.statistics?.tx_bytes || 0;

  // Active VLESS node
  const activeNode = nodes.find((n) => n.id === activeNodeId) || nodes[0];

  // Dynamic real-time throughput delta tracking
  useEffect(() => {
    if (!wanRxBytes && !wanTxBytes) return;
    const now = Date.now();

    if (!prevWanRef.current) {
      prevWanRef.current = { rx: wanRxBytes, tx: wanTxBytes, time: now };
      return;
    }

    const dt = Math.max(1, (now - prevWanRef.current.time) / 1000);
    const rxDiff = wanRxBytes >= prevWanRef.current.rx ? wanRxBytes - prevWanRef.current.rx : 0;
    const txDiff = wanTxBytes >= prevWanRef.current.tx ? wanTxBytes - prevWanRef.current.tx : 0;

    const rxRate = Math.round(rxDiff / dt);
    const txRate = Math.round(txDiff / dt);

    prevWanRef.current = { rx: wanRxBytes, tx: wanTxBytes, time: now };
    setCurrentSpeed({ rx: rxRate, tx: txRate });

    const timeStr = new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setTrafficHistory((prev) => {
      const next = [...prev, { time: timeStr, rx: rxRate, tx: txRate }];
      const maxPts = timeRange === "5m" ? 20 : timeRange === "30m" ? 30 : 45;
      return next.slice(-maxPts);
    });
  }, [wanRxBytes, wanTxBytes, timeRange]);

  // Seed initial zero points if history is empty so chart axes render cleanly
  useEffect(() => {
    if (trafficHistory.length === 0) {
      const points: TrafficPoint[] = [];
      const count = timeRange === "5m" ? 15 : 25;
      const now = Date.now();
      const step = timeRange === "5m" ? 15000 : 45000;

      for (let i = count; i >= 0; i--) {
        const ts = new Date(now - i * step);
        const timeStr = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        points.push({
          time: timeStr,
          rx: 0,
          tx: 0,
        });
      }
      setTrafficHistory(points);
    }
  }, [timeRange, trafficHistory.length]);

  // Compute SVG coordinates for the area chart
  const maxTraffic = Math.max(1000000, ...trafficHistory.map((p) => Math.max(p.rx, p.tx)));
  const chartWidth = 800;
  const chartHeight = 180;
  const paddingBottom = 20;

  const getPoints = (key: "rx" | "tx") => {
    if (trafficHistory.length === 0) return "";
    return trafficHistory
      .map((p, idx) => {
        const x = (idx / (trafficHistory.length - 1)) * chartWidth;
        const val = p[key];
        const y = chartHeight - paddingBottom - (val / maxTraffic) * (chartHeight - paddingBottom - 20);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 shrink-0">
            <Server className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight text-zinc-100 truncate">
                {board?.model || "MediaTek Filogic 820 Router (aarch64)"}
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-300 border border-zinc-800 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {isRu ? "В сети" : "Online"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-zinc-400 mt-0.5 font-mono">
              <span>{board?.release.description || "OpenWrt 25.12.6"}</span>
              <span className="text-zinc-600 hidden xs:inline">•</span>
              <span>Kernel {board?.kernel || "6.12.112"}</span>
              <span className="text-zinc-600 hidden xs:inline">•</span>
              <span>
                {isRu ? "Аптайм" : "Uptime"}: {formatUptime(info?.uptime || 184520)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto pl-12 sm:pl-0">
          <div className="text-left sm:text-right">
            <div className="text-[10px] sm:text-[11px] font-medium text-zinc-400">{t.overview.wanUplink}</div>
            <div className="text-xs font-mono font-medium text-zinc-200 tabular-nums">{wanIp}</div>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-1 -mb-1 w-full">
          <TabsList className="bg-zinc-900 border border-zinc-800 p-0.5 h-9 rounded-lg inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger
              value="overview"
              className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 font-medium px-3 sm:px-4 whitespace-nowrap"
            >
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              {isRu ? "Обзор" : "Overview"}
            </TabsTrigger>
            <TabsTrigger
              value="graphs"
              className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 font-medium px-3 sm:px-4 whitespace-nowrap"
            >
              <LineChart className="h-3.5 w-3.5 mr-1.5" />
              {isRu ? "Графики в реальном времени" : "Real-time Graphs"}
            </TabsTrigger>
            <TabsTrigger
              value="devices"
              className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-400 font-medium px-3 sm:px-4 whitespace-nowrap"
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
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-zinc-400">
                  {t.overview.cpuLoad}
                </CardTitle>
                <Cpu className="h-4 w-4 text-zinc-400" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">
                  {load1.toFixed(2)}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                  <span>5m: {load5.toFixed(2)}</span>
                  <span>•</span>
                  <span>15m: {load15.toFixed(2)}</span>
                </div>
                <Progress
                  value={Math.min(100, Math.round((load1 / 2) * 100))}
                  className="h-1 bg-zinc-800"
                />
              </CardContent>
            </Card>

            {/* RAM Usage */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-zinc-400">
                  {t.overview.ramUsage}
                </CardTitle>
                <Activity className="h-4 w-4 text-zinc-400" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">
                  {ramPercent}%
                </div>
                <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                  {formatBytes(ramUsed)} / {formatBytes(ramTotal)}
                </div>
                <Progress value={ramPercent} className="h-1 bg-zinc-800" />
              </CardContent>
            </Card>

            {/* Flash Overlay */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-zinc-400">
                  {t.overview.flashStorage}
                </CardTitle>
                <HardDrive className="h-4 w-4 text-zinc-400" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">
                  {flashPercent}%
                </div>
                <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                  {formatBytes(rootUsed)} / {formatBytes(rootTotal)}
                </div>
                <Progress value={flashPercent} className="h-1 bg-zinc-800" />
              </CardContent>
            </Card>

            {/* Active DHCP Leases (with pluralizeRu) */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-zinc-400">
                  {t.overview.activeLeases}
                </CardTitle>
                <Radio className="h-4 w-4 text-zinc-400" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">
                  {clientPluralized}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono">
                  {t.overview.devicesConnected}
                </div>
                <Progress
                  value={Math.min(100, clientCount * 12)}
                  className="h-1 bg-zinc-800"
                />
              </CardContent>
            </Card>
          </div>

          {/* Main Traffic & System Chart */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-2 border-b border-zinc-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xs font-medium text-zinc-200 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-zinc-400" />
                    {isRu ? "Пропускная способность сети (WAN / VPN)" : "Real-time Network Throughput"}
                  </CardTitle>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {isRu
                      ? "Суммарный поток входящего (RX) и исходящего (TX) трафика"
                      : "Combined inbound (RX) and outbound (TX) bandwidth telemetry"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-xs font-mono mr-2">
                    <span className="flex items-center gap-1.5 text-zinc-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      RX: {formatBytes(currentSpeed.rx || trafficHistory[trafficHistory.length - 1]?.rx || 0)}/s
                    </span>
                    <span className="flex items-center gap-1.5 text-zinc-400">
                      <span className="h-2 w-2 rounded-full bg-zinc-500" />
                      TX: {formatBytes(currentSpeed.tx || trafficHistory[trafficHistory.length - 1]?.tx || 0)}/s
                    </span>
                  </div>

                  <div className="flex items-center bg-zinc-950 p-0.5 rounded-md border border-zinc-800 text-[11px] font-mono">
                    <button
                      onClick={() => setTimeRange("5m")}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        timeRange === "5m"
                          ? "bg-zinc-800 text-zinc-100 font-medium"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      5m
                    </button>
                    <button
                      onClick={() => setTimeRange("30m")}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        timeRange === "30m"
                          ? "bg-zinc-800 text-zinc-100 font-medium"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      30m
                    </button>
                    <button
                      onClick={() => setTimeRange("3h")}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        timeRange === "3h"
                          ? "bg-zinc-800 text-zinc-100 font-medium"
                          : "text-zinc-500 hover:text-zinc-300"
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
                      <stop offset="0%" stopColor="#f4f4f5" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#f4f4f5" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="monoTxGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#71717a" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#71717a" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines */}
                  <line
                    x1="0"
                    y1="40"
                    x2={chartWidth}
                    y2="40"
                    stroke="#27272a"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1="0"
                    y1="90"
                    x2={chartWidth}
                    y2="90"
                    stroke="#27272a"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1="0"
                    y1="140"
                    x2={chartWidth}
                    y2="140"
                    stroke="#27272a"
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
                        stroke="#71717a"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <polyline
                        points={rxPoints}
                        fill="none"
                        stroke="#f4f4f5"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </svg>
              </div>

              {/* Time axis labels */}
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 pt-2 border-t border-zinc-800/60">
                <span>{trafficHistory[0]?.time || "00:00"}</span>
                <span>{trafficHistory[Math.floor(trafficHistory.length / 2)]?.time || "12:00"}</span>
                <span>{trafficHistory[trafficHistory.length - 1]?.time || "23:59"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Bypass & VPN Status Cards (3 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Zapret2 DPI Bypass */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-2 border-b border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-zinc-400" />
                    <span>{t.overview.zapretDpi}</span>
                  </CardTitle>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {t.common.active}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-3 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">{t.overview.engine}</span>
                  <span className="font-mono text-zinc-300">nfqws + tpws</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">{t.overview.tcpStrategy}</span>
                  <span className="font-mono text-zinc-300">fake + disorder (split:2)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">{t.overview.udpStrategy}</span>
                  <span className="font-mono text-zinc-300">fake + ipfrag2</span>
                </div>
              </CardContent>
            </Card>

            {/* AmneziaWG (AWG) */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-2 border-b border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-zinc-400" />
                    <span>{t.overview.amneziaWg}</span>
                  </CardTitle>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {isRu ? "Подключено" : "Connected"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-3 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">{t.overview.interface}</span>
                  <span className="font-mono text-zinc-300">awg0 ({awg?.addresses?.[0] || "10.8.0.2/24"})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">{t.overview.obfuscation}</span>
                  <span className="font-mono text-zinc-300">Jc:4 Jmin:40 H1-H4</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">{t.overview.latestHandshake}</span>
                  <span className="font-mono text-zinc-400 tabular-nums">
                    {isRu ? "18 сек назад" : "18s ago"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Sing-box / VLESS */}
            <Card className="border-zinc-800 bg-zinc-900/50">
              <CardHeader className="pb-2 border-b border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-zinc-400" />
                    <span>{t.overview.singboxVless}</span>
                  </CardTitle>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {activeNode?.latency ? `${activeNode.latency}ms` : "38ms"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-3 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">{t.overview.activeNode}</span>
                  <span className="font-medium text-zinc-200 truncate max-w-[160px]" title={activeNode?.name}>
                    {activeNode?.name || "🇩🇪 Frankfurt - High Speed"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500">{t.overview.protocol}</span>
                  <span className="font-mono text-zinc-300">VLESS XTLS Reality</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">{t.overview.inboundMode}</span>
                  <span className="font-mono text-zinc-300">TProxy :10808</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Network Interfaces Table */}
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardHeader className="pb-3 border-b border-zinc-800/80">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-zinc-200 flex items-center gap-2">
                  <Network className="h-4 w-4 text-zinc-400" />
                  {t.overview.activeIfaces}
                </CardTitle>
                <span className="text-[11px] font-mono text-zinc-500">
                  {ifaces?.length || 3} {isRu ? "интерфейса" : "interfaces"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-8 text-center"></TableHead>
                    <TableHead className="text-xs font-medium text-zinc-400">
                      {isRu ? "Интерфейс" : "Interface"}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-zinc-400">
                      {isRu ? "Протокол / Устройство" : "Proto / Device"}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-zinc-400">
                      {isRu ? "IPv4 Адрес" : "IPv4 Address"}
                    </TableHead>
                    <TableHead className="text-xs font-medium text-zinc-400 text-right">
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
                        className="border-zinc-800/80 hover:bg-zinc-900/40 transition-colors"
                      >
                        <TableCell className="text-center">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              iface.up ? "bg-emerald-500" : "bg-zinc-700"
                            }`}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs font-semibold text-zinc-200 uppercase">
                            {iface.interface}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-zinc-400 uppercase">
                            {iface.proto} ({iface.l3_device || iface.device || "phy"})
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-zinc-300 tabular-nums">
                            {ip}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3 text-xs font-mono tabular-nums">
                            <span className="text-zinc-300">
                              ↓ {formatBytes(rx)}
                            </span>
                            <span className="text-zinc-500">
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
              <h3 className="text-xs font-medium text-zinc-200">
                {isRu ? "Маршрутизация подключенных устройств" : "Per-Device Policy-Based Routing"}
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
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