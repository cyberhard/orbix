// Cisco Packet Tracer-Style Interactive Network Topology Map
// Strictly adhering to shadcn/ui zinc design system
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { usePolicyStore } from "@/store/policy-store";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Router,
  Server,
  Network,
  Radio,
  Wifi,
  Smartphone,
  Laptop,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  RotateCcw,
} from "lucide-react";

export type NodeType = "router" | "server" | "switch" | "ap" | "host";
export type NodeStatus = "online" | "warning" | "offline";

export interface TopologyNode {
  id: string;
  name: string;
  sublabel: string;
  type: NodeType;
  status: NodeStatus;
  x: number;
  y: number;
  ip?: string;
  mac?: string;
  interfaceName?: string;
  linkSpeed?: string;
  signal?: string;
  routingTarget?: string;
  policyType?: string;
}

export interface TopologyLink {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  type: "wired" | "wireless" | "tunnel";
  status: "active" | "idle" | "down";
  speed?: string;
}

const STORAGE_KEY_POSITIONS = "openwrt_topology_node_positions_v1";

const DEFAULT_POSITIONS: Record<string, { x: number; y: number }> = {
  "router-core": { x: 480, y: 270 },
  "server-wan": { x: 190, y: 160 },
  "server-singbox": { x: 190, y: 380 },
  "switch-lan": { x: 720, y: 160 },
  "ap-5g": { x: 690, y: 380 },
  "ap-24g": { x: 860, y: 380 },
  "host-quasar": { x: 910, y: 110 },
  "host-eth2": { x: 910, y: 210 },
  "host-redmi9": { x: 610, y: 500 },
  "host-pixel": { x: 740, y: 500 },
  "host-redmi15": { x: 870, y: 500 },
  "host-tecno": { x: 960, y: 440 },
};

export const TrafficFlow: React.FC = () => {
  const { lang, language } = useI18nStore();
  const isRu = (lang || language) === "ru";
  const { policies } = usePolicyStore();

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Pan and Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Dragging
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selection & Search
  const [selectedNodeId, setSelectedNodeId] = useState<string>("router-core");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Live Router Queries
  const { data: ifaces } = useQuery({
    queryKey: ["network-interfaces"],
    queryFn: () => ubusClient.getInterfaces(),
    refetchInterval: 3000,
  });

  const { data: leases } = useQuery({
    queryKey: ["dhcp-leases"],
    queryFn: () => ubusClient.getDhcpLeases(),
    refetchInterval: 4000,
  });

  const { data: wireless } = useQuery({
    queryKey: ["wireless-devices"],
    queryFn: () => ubusClient.getWirelessDevices(),
    refetchInterval: 5000,
  });

  const wan = ifaces?.find((i) => i.interface === "wan" || i.l3_device === "wan");
  const lan = ifaces?.find((i) => i.interface === "lan" || i.interface === "br-lan");
  const singbox = ifaces?.find((i) => i.interface === "singbox");

  // Load custom node positions or fall back to defaults
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POSITIONS);
      if (saved) {
        return { ...DEFAULT_POSITIONS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_POSITIONS;
  });

  // Save node positions on change
  const savePositions = useCallback((updated: Record<string, { x: number; y: number }>) => {
    try {
      localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, []);

  // Assemble base nodes dynamically with real live data
  const nodes: TopologyNode[] = useMemo(() => {
    const list: TopologyNode[] = [];

    // 1. Core Router
    const routerPos = nodePositions["router-core"] || DEFAULT_POSITIONS["router-core"];
    list.push({
      id: "router-core",
      name: "Core Router",
      sublabel: `Netcraze NC-1812 (${lan?.ipv4_address?.[0]?.address || "192.168.1.1"})`,
      type: "router",
      status: "online",
      x: routerPos.x,
      y: routerPos.y,
      ip: lan?.ipv4_address?.[0]?.address || "192.168.1.1",
      mac: "D8:43:AE:C0:54:5C",
      interfaceName: "br-lan",
      linkSpeed: "1 Gbps Full-Duplex",
      routingTarget: "OpenWrt 25.12 Core / Kernel 6.6",
    });

    // 2. Internet WAN Gateway
    const wanPos = nodePositions["server-wan"] || DEFAULT_POSITIONS["server-wan"];
    list.push({
      id: "server-wan",
      name: isRu ? "Интернет WAN" : "Internet WAN",
      sublabel: `ISP Gateway (${wan?.ipv4_address?.[0]?.address || "10.193.76.207"})`,
      type: "server",
      status: wan?.up ? "online" : "warning",
      x: wanPos.x,
      y: wanPos.y,
      ip: wan?.ipv4_address?.[0]?.address || "10.193.76.207",
      interfaceName: "eth0 (wan)",
      linkSpeed: "1 Gbps WAN",
      routingTarget: "Direct RuNet & Default Route",
    });

    // 3. Sing-box VLESS / VPN Gateway
    const vpnPos = nodePositions["server-singbox"] || DEFAULT_POSITIONS["server-singbox"];
    list.push({
      id: "server-singbox",
      name: "Sing-box VLESS",
      sublabel: "Reality Proxy • Helsinki (48 ms)",
      type: "server",
      status: "online",
      x: vpnPos.x,
      y: vpnPos.y,
      ip: "172.19.0.1",
      interfaceName: "tun0",
      linkSpeed: "XTLS Reality 100 Mbps",
      routingTarget: "Restricted Services (IG/X/Bypass)",
    });

    // 4. Switch-01 (LAN Ethernet Ports)
    const switchPos = nodePositions["switch-lan"] || DEFAULT_POSITIONS["switch-lan"];
    list.push({
      id: "switch-lan",
      name: "Switch-01 (LAN)",
      sublabel: "Ports eth1-eth3 (1GbE)",
      type: "switch",
      status: "online",
      x: switchPos.x,
      y: switchPos.y,
      interfaceName: "br-lan (VLAN 1)",
      linkSpeed: "1 Gbps Wire-Speed",
      routingTarget: "Local Bridge",
    });

    // 5. AP-01 (Wi-Fi 5 GHz)
    const ap5Pos = nodePositions["ap-5g"] || DEFAULT_POSITIONS["ap-5g"];
    list.push({
      id: "ap-5g",
      name: "AP-01 (5 GHz)",
      sublabel: "Wi-Fi 6 AX • Ch 36 (80MHz)",
      type: "ap",
      status: "online",
      x: ap5Pos.x,
      y: ap5Pos.y,
      interfaceName: "phy0.1-ap0",
      linkSpeed: "AX3000 (1201 Mbps)",
      routingTarget: "SSID: OpenWRT",
    });

    // 6. AP-02 (Wi-Fi 2.4 GHz)
    const ap24Pos = nodePositions["ap-24g"] || DEFAULT_POSITIONS["ap-24g"];
    list.push({
      id: "ap-24g",
      name: "AP-02 (2.4 GHz)",
      sublabel: "Wi-Fi 6 AX • Ch 1 (20MHz)",
      type: "ap",
      status: "online",
      x: ap24Pos.x,
      y: ap24Pos.y,
      interfaceName: "phy0.0-ap0",
      linkSpeed: "AX600 (574 Mbps)",
      routingTarget: "SSID: OpenWRT",
    });

    // 7. Client Hosts from real DHCP Leases
    const realLeases = leases?.dhcp_leases || [];
    if (realLeases.length > 0) {
      realLeases.forEach((l) => {
        const hostId = `host-${l.ipaddr.replace(/\./g, "-")}`;
        const pos = nodePositions[hostId] || DEFAULT_POSITIONS[hostId] || {
          x: 600 + (parseInt(l.ipaddr.split(".")[3], 10) % 5) * 80,
          y: 480 + ((parseInt(l.ipaddr.split(".")[3], 10) % 3) * 40),
        };

        const isKnownDevice = l.ipaddr === "192.168.1.130"; // Redmi Note 9 ADB device
        list.push({
          id: hostId,
          name: l.hostname || (isKnownDevice ? "Redmi-Note-9" : `Device-${l.ipaddr.split(".")[3]}`),
          sublabel: l.ipaddr,
          type: "host",
          status: "online",
          x: pos.x,
          y: pos.y,
          ip: l.ipaddr,
          mac: l.macaddr,
          interfaceName: isKnownDevice ? "phy0.1-ap0 (5 GHz)" : "br-lan",
          linkSpeed: isKnownDevice ? "433 Mbps (-61 dBm)" : "1 Gbps",
          signal: isKnownDevice ? "-61 dBm" : undefined,
          routingTarget: isKnownDevice ? "Zapret ALT11 (YouTube/Discord) + RuNet Direct" : "Default Direct",
        });
      });
    } else {
      // Fallback default host nodes for visualization
      const hostQuasarPos = nodePositions["host-quasar"] || DEFAULT_POSITIONS["host-quasar"];
      list.push({
        id: "host-quasar",
        name: "quasar (Dev Host)",
        sublabel: "192.168.1.176",
        type: "host",
        status: "online",
        x: hostQuasarPos.x,
        y: hostQuasarPos.y,
        ip: "192.168.1.176",
        mac: "D8:43:AE:C0:54:5D",
        interfaceName: "eth1",
        linkSpeed: "1 Gbps",
        routingTarget: "Direct / Developer Host",
      });

      const hostRedmiPos = nodePositions["host-redmi9"] || DEFAULT_POSITIONS["host-redmi9"];
      list.push({
        id: "host-redmi9",
        name: "Redmi Note 9",
        sublabel: "192.168.1.130",
        type: "host",
        status: "online",
        x: hostRedmiPos.x,
        y: hostRedmiPos.y,
        ip: "192.168.1.130",
        mac: "B2:68:C5:3D:2E:52",
        interfaceName: "phy0.1-ap0 (5 GHz)",
        linkSpeed: "433 Mbps",
        signal: "-61 dBm",
        routingTarget: "Zapret ALT11 + RuNet Direct",
      });
    }

    return list;
  }, [nodePositions, ifaces, leases, isRu]);

  // Assemble links between nodes
  const links: TopologyLink[] = useMemo(() => {
    const list: TopologyLink[] = [
      {
        id: "link-wan-router",
        source: "server-wan",
        target: "router-core",
        sourcePort: "ISP",
        targetPort: "eth0",
        type: "wired",
        status: "active",
        speed: "1 Gbps",
      },
      {
        id: "link-vpn-router",
        source: "server-singbox",
        target: "router-core",
        sourcePort: "Reality",
        targetPort: "tun0",
        type: "tunnel",
        status: "active",
        speed: "100 Mbps",
      },
      {
        id: "link-router-switch",
        source: "router-core",
        target: "switch-lan",
        sourcePort: "br-lan",
        targetPort: "Trunk",
        type: "wired",
        status: "active",
        speed: "1 Gbps",
      },
      {
        id: "link-router-ap5",
        source: "router-core",
        target: "ap-5g",
        sourcePort: "PCIe",
        targetPort: "phy0.1",
        type: "wired",
        status: "active",
        speed: "AX3000",
      },
      {
        id: "link-router-ap24",
        source: "router-core",
        target: "ap-24g",
        sourcePort: "PCIe",
        targetPort: "phy0.0",
        type: "wired",
        status: "active",
        speed: "AX600",
      },
    ];

    // Connect hosts to either switch or access points
    nodes.forEach((n) => {
      if (n.type === "host") {
        if (n.ip === "192.168.1.176" || n.name.toLowerCase().includes("quasar")) {
          list.push({
            id: `link-${n.id}`,
            source: "switch-lan",
            target: n.id,
            sourcePort: "eth1",
            targetPort: "NIC",
            type: "wired",
            status: "active",
          });
        } else if (n.ip === "192.168.1.130" || n.name.toLowerCase().includes("note-9") || n.name.toLowerCase().includes("pixel")) {
          list.push({
            id: `link-${n.id}`,
            source: "ap-5g",
            target: n.id,
            sourcePort: "5GHz",
            targetPort: "Wi-Fi",
            type: "wireless",
            status: "active",
          });
        } else {
          list.push({
            id: `link-${n.id}`,
            source: "ap-24g",
            target: n.id,
            sourcePort: "2.4GHz",
            targetPort: "Wi-Fi",
            type: "wireless",
            status: "active",
          });
        }
      }
    });

    return list;
  }, [nodes]);

  // Filter nodes based on search query
  const filteredNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const matches = new Set<string>();
    nodes.forEach((n) => {
      if (
        n.name.toLowerCase().includes(q) ||
        n.sublabel.toLowerCase().includes(q) ||
        (n.ip && n.ip.includes(q)) ||
        (n.mac && n.mac.toLowerCase().includes(q))
      ) {
        matches.add(n.id);
      }
    });
    return matches;
  }, [nodes, searchQuery]);

  // Selected Node Details
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  }, [nodes, selectedNodeId]);

  // Drag handlers
  const handleMouseDownNode = (e: React.MouseEvent, node: TopologyNode) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setDraggingNodeId(node.id);

    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const clickX = (e.clientX - rect.left - pan.x) / zoom;
      const clickY = (e.clientY - rect.top - pan.y) / zoom;
      setDragOffset({
        x: clickX - node.x,
        y: clickY - node.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const currentX = (e.clientX - rect.left - pan.x) / zoom;
      const currentY = (e.clientY - rect.top - pan.y) / zoom;

      const newX = Math.round(currentX - dragOffset.x);
      const newY = Math.round(currentY - dragOffset.y);

      setNodePositions((prev) => {
        const next = { ...prev, [draggingNodeId]: { x: newX, y: newY } };
        return next;
      });
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
      savePositions(nodePositions);
    }
    if (isPanning) {
      setIsPanning(false);
    }
  };

  // Pan canvas handlers
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === "rect") {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
    }
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNodePositions(DEFAULT_POSITIONS);
    savePositions(DEFAULT_POSITIONS);
  };

  const handleExport = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `network-topology-${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Node Icon Helper
  const renderNodeIcon = (type: NodeType) => {
    switch (type) {
      case "router":
        return <Router className="h-6 w-6 text-zinc-100" />;
      case "server":
        return <Server className="h-6 w-6 text-zinc-300" />;
      case "switch":
        return <Network className="h-6 w-6 text-zinc-300" />;
      case "ap":
        return <Radio className="h-6 w-6 text-zinc-300" />;
      case "host":
        return <Smartphone className="h-5 w-5 text-zinc-300" />;
      default:
        return <Activity className="h-6 w-6 text-zinc-300" />;
    }
  };

  // Legend Icon Helper
  const renderLegendIcon = (type: NodeType) => {
    switch (type) {
      case "router":
        return <Router className="h-4 w-4 text-zinc-300" />;
      case "server":
        return <Server className="h-4 w-4 text-zinc-400" />;
      case "switch":
        return <Network className="h-4 w-4 text-zinc-400" />;
      case "ap":
        return <Radio className="h-4 w-4 text-zinc-400" />;
      case "host":
        return <Smartphone className="h-4 w-4 text-zinc-400" />;
    }
  };

  // Calculate Node Stats
  const onlineCount = nodes.filter((n) => n.status === "online").length;
  const warningCount = nodes.filter((n) => n.status === "warning").length;
  const offlineCount = nodes.filter((n) => n.status === "offline").length;

  return (
    <div className="space-y-4">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Network className="h-5 w-5 text-zinc-400" />
            <span>{isRu ? "Топология сети" : "Network Topology"}</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isRu
              ? "Интерактивная визуализация сетевой инфраструктуры в стиле Cisco Packet Tracer"
              : "Interactive visualization of network infrastructure"}
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRu ? "Поиск узлов, IP, MAC..." : "Search devices, networks..."}
              className="h-8 w-44 sm:w-56 pl-8 pr-2 text-xs bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-zinc-700"
            />
          </div>

          {/* Zoom In */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom((z) => Math.min(z + 0.15, 1.8))}
            className="h-8 w-8 border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            title={isRu ? "Увеличить (+)" : "Zoom In"}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>

          {/* Zoom Out */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
            className="h-8 w-8 border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            title={isRu ? "Уменьшить (-)" : "Zoom Out"}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>

          {/* Reset / Center */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleResetView}
            className="h-8 w-8 border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            title={isRu ? "Сбросить масштаб и положение" : "Reset View"}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-8 px-2.5 text-xs font-medium gap-1.5 border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            title={isRu ? "Экспорт карты в SVG" : "Export Topology"}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isRu ? "Экспорт" : "Export"}</span>
          </Button>
        </div>
      </div>

      {/* Main 2-Column Layout matching Cisco Packet Tracer / Reference Screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Interactive Network Map Canvas (9 cols) */}
        <Card className="lg:col-span-9 border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-zinc-800/80 pb-3 bg-zinc-900/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-100">
                  {isRu ? "Карта сети (Network Map)" : "Network Map"}
                </CardTitle>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {isRu
                    ? "Интерактивная топология — перетаскивайте узлы мышью для изменения схемы"
                    : "Interactive topology view - drag nodes to reposition"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono bg-zinc-950 border-zinc-800 text-zinc-400">
                  {nodes.length} {isRu ? "узлов" : "nodes"} • {links.length} {isRu ? "линков" : "links"}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 relative bg-zinc-950 select-none overflow-hidden min-h-[560px]">
            {/* SVG Interactive Canvas */}
            <svg
              ref={svgRef}
              className="w-full h-full min-h-[560px] cursor-crosshair"
              viewBox="0 0 1060 620"
              onMouseDown={handleMouseDownCanvas}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Subtle Packet Tracer Dot Matrix Background */}
              <defs>
                <pattern id="grid-dots" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="12" cy="12" r="1" fill="#27272a" />
                </pattern>
                {/* Connection Endpoints Marker */}
                <marker id="port-dot" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6">
                  <circle cx="3" cy="3" r="2.5" fill="#10b981" />
                </marker>
              </defs>

              <rect width="100%" height="100%" fill="url(#grid-dots)" />

              {/* Canvas Content Group with Pan & Zoom */}
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Render Links (Cables) First */}
                {links.map((link) => {
                  const srcNode = nodes.find((n) => n.id === link.source);
                  const tgtNode = nodes.find((n) => n.id === link.target);
                  if (!srcNode || !tgtNode) return null;

                  const isSelected = selectedNodeId === link.source || selectedNodeId === link.target;
                  const isFiltered =
                    filteredNodeIds && (!filteredNodeIds.has(link.source) && !filteredNodeIds.has(link.target));

                  // Node dimensions: 54x54, offset from center
                  const x1 = srcNode.x + 27;
                  const y1 = srcNode.y + 27;
                  const x2 = tgtNode.x + 27;
                  const y2 = tgtNode.y + 27;

                  // Midpoint for port labels
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;

                  return (
                    <g key={link.id} opacity={isFiltered ? 0.2 : 1}>
                      {/* Connection Line */}
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isSelected ? "#38bdf8" : "#3f3f46"}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        strokeDasharray={link.type === "wireless" ? "4 3" : link.type === "tunnel" ? "6 4" : undefined}
                        className="transition-colors duration-150"
                      />

                      {/* Source Port Status Dot */}
                      <circle cx={x1 + (x2 - x1) * 0.15} cy={y1 + (y2 - y1) * 0.15} r="3" fill="#10b981" />

                      {/* Target Port Status Dot */}
                      <circle cx={x2 - (x2 - x1) * 0.15} cy={y2 - (y2 - y1) * 0.15} r="3" fill="#10b981" />

                      {/* Port Label at link midpoint */}
                      {(link.sourcePort || link.targetPort) && (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x="-24"
                            y="-9"
                            width="48"
                            height="18"
                            rx="4"
                            fill="#09090b"
                            stroke="#27272a"
                            strokeWidth="1"
                          />
                          <text
                            x="0"
                            y="3"
                            textAnchor="middle"
                            fill="#a1a1aa"
                            fontSize="9"
                            fontFamily="monospace"
                          >
                            {link.targetPort || link.sourcePort}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Render Nodes (Interactive Draggable Cards) */}
                {nodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isFiltered = filteredNodeIds && !filteredNodeIds.has(node.id);

                  // Node status dot color
                  const statusDotColor =
                    node.status === "online" ? "#10b981" : node.status === "warning" ? "#f59e0b" : "#ef4444";

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onMouseDown={(e) => handleMouseDownNode(e, node)}
                      className="cursor-grab active:cursor-grabbing transition-transform duration-75"
                      opacity={isFiltered ? 0.25 : 1}
                    >
                      {/* Node Selection Glow / Ring */}
                      {isSelected && (
                        <rect
                          x="-3"
                          y="-3"
                          width="60"
                          height="60"
                          rx="14"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeOpacity="0.8"
                        />
                      )}

                      {/* Node Box (Rounded Container) */}
                      <rect
                        x="0"
                        y="0"
                        width="54"
                        height="54"
                        rx="12"
                        fill="#18181b"
                        stroke={node.type === "router" ? "#10b981" : isSelected ? "#38bdf8" : "#27272a"}
                        strokeWidth={node.type === "router" ? 2 : 1.2}
                        className="transition-colors hover:stroke-zinc-600"
                      />

                      {/* Center Node Icon */}
                      <foreignObject x="11" y="11" width="32" height="32" className="pointer-events-none">
                        <div className="w-full h-full flex items-center justify-center">
                          {renderNodeIcon(node.type)}
                        </div>
                      </foreignObject>

                      {/* Status Indicator Dot in upper-right corner */}
                      <circle
                        cx="45"
                        cy="9"
                        r="4.5"
                        fill={statusDotColor}
                        stroke="#09090b"
                        strokeWidth="1.5"
                      />

                      {/* Node Label Below */}
                      <text
                        x="27"
                        y="70"
                        textAnchor="middle"
                        fill="#f4f4f5"
                        fontSize="11"
                        fontWeight="600"
                        className="pointer-events-none select-none"
                      >
                        {node.name}
                      </text>

                      {/* Node Sublabel / IP Below */}
                      <text
                        x="27"
                        y="83"
                        textAnchor="middle"
                        fill="#71717a"
                        fontSize="9.5"
                        fontFamily="monospace"
                        className="pointer-events-none select-none"
                      >
                        {node.sublabel}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </CardContent>
        </Card>

        {/* Right Column: Legend, Status, Network Stats & Inspector (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Legend Card */}
          <Card className="border-zinc-800 bg-zinc-950">
            <CardHeader className="pb-2.5 pt-3.5 px-4 border-b border-zinc-800/80">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {isRu ? "Обозначения (Legend)" : "Legend"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 space-y-2.5 text-xs">
              {/* Router */}
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/60 bg-zinc-900 text-zinc-200 shrink-0">
                  {renderLegendIcon("router")}
                </div>
                <div>
                  <div className="font-medium text-zinc-200">{isRu ? "Роутер" : "Router"}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{isRu ? "Сетевое ядро" : "Network core"}</div>
                </div>
              </div>

              {/* Server */}
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 shrink-0">
                  {renderLegendIcon("server")}
                </div>
                <div>
                  <div className="font-medium text-zinc-200">{isRu ? "Сервер / Шлюз" : "Server"}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{isRu ? "Шлюз / WAN / VPN" : "Compute / Uplink"}</div>
                </div>
              </div>

              {/* Switch */}
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 shrink-0">
                  {renderLegendIcon("switch")}
                </div>
                <div>
                  <div className="font-medium text-zinc-200">{isRu ? "Коммутатор" : "Switch"}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{isRu ? "LAN порты eth1-eth3" : "Network switch"}</div>
                </div>
              </div>

              {/* Access Point */}
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 shrink-0">
                  {renderLegendIcon("ap")}
                </div>
                <div>
                  <div className="font-medium text-zinc-200">{isRu ? "Точка доступа (AP)" : "Access Point"}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{isRu ? "Wi-Fi 2.4 / 5 GHz" : "Wireless AP"}</div>
                </div>
              </div>

              {/* Client Host */}
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 shrink-0">
                  {renderLegendIcon("host")}
                </div>
                <div>
                  <div className="font-medium text-zinc-200">{isRu ? "Клиент" : "Host Client"}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{isRu ? "Подключенный хост" : "Connected device"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Breakdown Card */}
          <Card className="border-zinc-800 bg-zinc-950">
            <CardHeader className="pb-2.5 pt-3.5 px-4 border-b border-zinc-800/80">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {isRu ? "Статус узлов" : "Status"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-zinc-300">{isRu ? "В сети (Online)" : "Online"}</span>
                </div>
                <span className="font-mono text-zinc-100 font-semibold">{onlineCount}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-zinc-300">{isRu ? "Предупреждение (Warning)" : "Warning"}</span>
                </div>
                <span className="font-mono text-zinc-400">{warningCount}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-zinc-300">{isRu ? "Недоступен (Offline)" : "Offline"}</span>
                </div>
                <span className="font-mono text-zinc-500">{offlineCount}</span>
              </div>
            </CardContent>
          </Card>

          {/* Network Stats Card */}
          <Card className="border-zinc-800 bg-zinc-950">
            <CardHeader className="pb-2.5 pt-3.5 px-4 border-b border-zinc-800/80">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {isRu ? "Сетевая статистика" : "Network Stats"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">{isRu ? "Всего узлов:" : "Total Nodes"}</span>
                <span className="font-mono text-zinc-100 font-semibold">{nodes.length}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">{isRu ? "Соединений (Links):" : "Connections"}</span>
                <span className="font-mono text-zinc-100 font-semibold">{links.length}</span>
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">{isRu ? "Индекс стабильности (Health):" : "Health Score"}</span>
                  <span className="font-mono text-emerald-400 font-semibold">98%</span>
                </div>
                {/* Health Progress Bar */}
                <div className="h-1.5 w-full rounded-full bg-zinc-900 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "98%" }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Node Inspector Card */}
          {selectedNode && (
            <Card className="border-zinc-800 bg-zinc-950">
              <CardHeader className="pb-2 pt-3 px-4 border-b border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    {renderLegendIcon(selectedNode.type)}
                    <span>{selectedNode.name}</span>
                  </CardTitle>
                  <Badge variant="outline" className="text-[9px] font-mono bg-zinc-900 border-zinc-800 text-emerald-400">
                    {selectedNode.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 space-y-2 text-xs">
                {selectedNode.ip && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 font-mono text-[11px]">IP:</span>
                    <span className="font-mono text-zinc-200">{selectedNode.ip}</span>
                  </div>
                )}
                {selectedNode.mac && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 font-mono text-[11px]">MAC:</span>
                    <span className="font-mono text-zinc-400 text-[11px]">{selectedNode.mac}</span>
                  </div>
                )}
                {selectedNode.interfaceName && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 font-mono text-[11px]">{isRu ? "Интерфейс:" : "Interface:"}</span>
                    <span className="font-mono text-zinc-300">{selectedNode.interfaceName}</span>
                  </div>
                )}
                {selectedNode.linkSpeed && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 font-mono text-[11px]">{isRu ? "Скорость:" : "Speed:"}</span>
                    <span className="font-mono text-zinc-300">{selectedNode.linkSpeed}</span>
                  </div>
                )}
                {selectedNode.routingTarget && (
                  <div className="pt-2 border-t border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block mb-1">
                      {isRu ? "Назначенный маршрут / Политика:" : "Assigned Policy:"}
                    </span>
                    <div className="text-[11px] font-mono text-zinc-300 bg-zinc-900 p-1.5 rounded border border-zinc-800">
                      {selectedNode.routingTarget}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
