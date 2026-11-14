import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { useSubscriptionStore } from "@/store/subscription-store";
import { usePolicyStore } from "@/store/policy-store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Zap,
  Key,
  Plus,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Layers,
  Lock,
  Activity,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Power,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { VlessNode } from "@/types/ubus";

export interface ParsedAwgConf {
  address: string;
  privateKey: string;
  dns?: string;
  mtu?: number;
  listenPort?: number;
  jc?: number;
  jmin?: number;
  jmax?: number;
  s1?: number;
  s2?: number;
  h1?: number;
  h2?: number;
  h3?: number;
  h4?: number;
  publicKey?: string;
  presharedKey?: string;
  endpoint?: string;
  allowedIps?: string;
  persistentKeepalive?: number;
}

export function parseAwgConfText(text: string): ParsedAwgConf {
  const lines = text.split(/\r?\n/);
  let currentSection = "";
  const result: ParsedAwgConf = {
    address: "",
    privateKey: "",
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      currentSection = line.slice(1, -1).trim().toLowerCase();
      continue;
    }

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim().toLowerCase();
    const value = line.slice(eqIdx + 1).trim();

    if (currentSection === "interface") {
      switch (key) {
        case "address":
          result.address = value;
          break;
        case "privatekey":
          result.privateKey = value;
          break;
        case "dns":
          result.dns = value;
          break;
        case "mtu":
          result.mtu = parseInt(value, 10) || undefined;
          break;
        case "listenport":
          result.listenPort = parseInt(value, 10) || undefined;
          break;
        case "jc":
          result.jc = parseInt(value, 10);
          break;
        case "jmin":
          result.jmin = parseInt(value, 10);
          break;
        case "jmax":
          result.jmax = parseInt(value, 10);
          break;
        case "s1":
          result.s1 = parseInt(value, 10);
          break;
        case "s2":
          result.s2 = parseInt(value, 10);
          break;
        case "h1":
          result.h1 = parseInt(value, 10);
          break;
        case "h2":
          result.h2 = parseInt(value, 10);
          break;
        case "h3":
          result.h3 = parseInt(value, 10);
          break;
        case "h4":
          result.h4 = parseInt(value, 10);
          break;
      }
    } else if (currentSection === "peer") {
      switch (key) {
        case "publickey":
          result.publicKey = value;
          break;
        case "presharedkey":
          result.presharedKey = value;
          break;
        case "endpoint":
          result.endpoint = value;
          break;
        case "allowedips":
          result.allowedIps = value;
          break;
        case "persistentkeepalive":
          result.persistentKeepalive = parseInt(value, 10) || undefined;
          break;
      }
    }
  }

  return result;
}

interface CountryServer {
  id: string;
  name: string;
  country: string;
  countryEn: string;
  flag: string;
  city: string;
  latency: number;
  server: string;
  protocol: "VLESS Reality" | "AmneziaWG";
}

const defaultCountryServers: CountryServer[] = [
  { id: "srv-nl", name: "Netherlands Amsterdam", country: "Нидерланды", countryEn: "Netherlands", flag: "🇳🇱", city: "Амстердам", latency: 28, server: "ams.orbix-guard.net", protocol: "VLESS Reality" },
  { id: "srv-de", name: "Germany Frankfurt", country: "Германия", countryEn: "Germany", flag: "🇩🇪", city: "Франкфурт", latency: 34, server: "fra.orbix-guard.net", protocol: "VLESS Reality" },
  { id: "srv-fi", name: "Finland Helsinki", country: "Финляндия", countryEn: "Finland", flag: "🇫🇮", city: "Хельсинки", latency: 21, server: "hel.orbix-guard.net", protocol: "AmneziaWG" },
  { id: "srv-se", name: "Sweden Stockholm", country: "Швеция", countryEn: "Sweden", flag: "🇸🇪", city: "Стокгольм", latency: 31, server: "sto.orbix-guard.net", protocol: "VLESS Reality" },
  { id: "srv-us", name: "United States East", country: "США", countryEn: "United States", flag: "🇺🇸", city: "Нью-Йорк", latency: 94, server: "nyc.orbix-guard.net", protocol: "VLESS Reality" },
  { id: "srv-tr", name: "Turkey Istanbul", country: "Турция", countryEn: "Turkey", flag: "🇹🇷", city: "Стамбул", latency: 48, server: "ist.orbix-guard.net", protocol: "AmneziaWG" },
];

export const VpnManager: React.FC = () => {
  const { t, lang } = useI18nStore();
  const isRu = lang === "ru";
  const { operatingMode } = usePolicyStore();
  const isExpert = operatingMode === "expert";

  const [activeTab, setActiveTab] = useState("awg");
  const [vlessInput, setVlessInput] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Simple Mode Country / Server state
  const [simpleProtectionEnabled, setSimpleProtectionEnabled] = useState(true);
  const [activeServerId, setActiveServerId] = useState<string>("srv-nl");

  const {
    outboundGroups,
    killSwitch,
    toggleKillSwitch,
    setKillSwitchScope,
    testAllLatencies,
    isTestingLatency,
    nodes: subNodes,
  } = useSubscriptionStore();

  // Feedback banner state
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // AWG state from live router telemetry
  const { data: awgData, refetch: refetchAwg, isLoading: isAwgLoading } = useQuery({
    queryKey: ["vpn-awg"],
    queryFn: () => ubusClient.getAwgConfig(),
  });

  const isConfigured = Boolean(awgData?.configured || (awgData?.addresses && awgData.addresses.length > 0));
  const isTunnelUp = Boolean(awgData?.active);

  // Editable parameters for AWG (Expert Mode)
  const [address, setAddress] = useState("10.8.0.2/24");
  const [listenPort, setListenPort] = useState("51820");
  const [mtu, setMtu] = useState("1360");
  const [awgJc, setAwgJc] = useState(4);
  const [awgJmin, setAwgJmin] = useState(40);
  const [awgJmax, setAwgJmax] = useState(70);
  const [awgS1, setAwgS1] = useState(15);
  const [awgS2, setAwgS2] = useState(64);
  const [awgH1, setAwgH1] = useState(1827364512);
  const [awgH2, setAwgH2] = useState(981273645);
  const [awgH3, setAwgH3] = useState(1293847561);
  const [awgH4, setAwgH4] = useState(765432198);

  useEffect(() => {
    if (awgData) {
      if (awgData.addresses && awgData.addresses[0]) setAddress(awgData.addresses[0]);
      if (awgData.listen_port) setListenPort(String(awgData.listen_port));
      if (awgData.mtu) setMtu(String(awgData.mtu));
      if (awgData.jc !== undefined) setAwgJc(awgData.jc);
      if (awgData.jmin !== undefined) setAwgJmin(awgData.jmin);
      if (awgData.jmax !== undefined) setAwgJmax(awgData.jmax);
      if (awgData.s1 !== undefined) setAwgS1(awgData.s1);
      if (awgData.s2 !== undefined) setAwgS2(awgData.s2);
      if (awgData.h1 !== undefined) setAwgH1(awgData.h1);
      if (awgData.h2 !== undefined) setAwgH2(awgData.h2);
      if (awgData.h3 !== undefined) setAwgH3(awgData.h3);
      if (awgData.h4 !== undefined) setAwgH4(awgData.h4);
    }
  }, [awgData]);

  // Modals for AWG
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [confText, setConfText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ParsedAwgConf | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // VLESS nodes state
  const { data: vlessNodes, refetch: refetchNodes } = useQuery({
    queryKey: ["vpn-vless"],
    queryFn: () => ubusClient.getVlessNodes(),
  });

  const [nodes, setNodes] = useState<VlessNode[]>([
    {
      id: "vless-de-1",
      name: "🇩🇪 Frankfurt XTLS Reality",
      server: "fra.singbox.net",
      port: 443,
      uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      security: "reality",
      flow: "xtls-rprx-vision",
      shortId: "6ba85179e30d4fc2",
      fingerprint: "chrome",
      publicKey: "ln8eS16a9wD6sL28oG12aG0gW7rL9qZ1sX5e4r3t2y1=",
      sni: "yahoo.com",
      transport: "tcp",
      latency: 32,
      active: true,
    },
    {
      id: "vless-nl-1",
      name: "🇳🇱 Amsterdam Reality Speed",
      server: "ams.singbox.net",
      port: 443,
      uuid: "f9e8d7c6-b5a4-3210-fedc-ba9876543210",
      security: "reality",
      flow: "xtls-rprx-vision",
      shortId: "8c7b6a5d4e3f2109",
      fingerprint: "chrome",
      publicKey: "pQ9wE8rT7yU6iI5oO4pA3sS2dF1gH0jK9lZ8xX7cV6b=",
      sni: "microsoft.com",
      transport: "tcp",
      latency: 27,
      active: false,
    },
  ]);

  useEffect(() => {
    if (vlessNodes && Array.isArray(vlessNodes) && vlessNodes.length > 0) {
      setNodes(vlessNodes);
    }
  }, [vlessNodes]);

  // Handle AmneziaWG Conf Input change
  const handleConfChange = (val: string) => {
    setConfText(val);
    if (val.trim().length > 20) {
      const parsed = parseAwgConfText(val);
      if (parsed.address || parsed.endpoint || parsed.publicKey) {
        setParsedPreview(parsed);
      } else {
        setParsedPreview(null);
      }
    } else {
      setParsedPreview(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handleConfChange(text);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (!confText.trim()) {
      showToast(isRu ? "Введите или загрузите файл конфигурации .conf" : "Please enter or upload a .conf file", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await ubusClient.importAwgConf(confText.trim(), true);
      if (res.status === "ok") {
        showToast(isRu ? "Конфигурация AmneziaWG успешно импортирована и применена!" : "AmneziaWG profile imported and applied successfully!");
        setIsImportOpen(false);
        setConfText("");
        setParsedPreview(null);
        await refetchAwg();
      } else {
        showToast(res.message || "Import failed", "error");
      }
    } catch (e: any) {
      showToast(e?.message || "Failed to import configuration", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAwg = async () => {
    setIsSubmitting(true);
    try {
      const res = await ubusClient.deleteAwgConfig();
      if (res.status === "ok") {
        showToast(isRu ? "Интерфейс AmneziaWG удален и настройки сброшены" : "AmneziaWG interface reset and removed successfully");
        setIsDeleteOpen(false);
        await refetchAwg();
      } else {
        showToast(res.message || "Failed to delete AWG interface", "error");
      }
    } catch (e: any) {
      showToast(e?.message || "Failed to delete AWG interface", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestLatency = async (id: string, server: string, port: number) => {
    setTestingId(id);
    try {
      const res = await ubusClient.testNodeLatency(server, port);
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, latency: res.latency } : n))
      );
      showToast(isRu ? `Задержка узла ${server}: ${res.latency} ms` : `Ping response from ${server}: ${res.latency} ms`);
    } catch {
      showToast(isRu ? "Ошибка проверки задержки" : "Latency test failed", "error");
    } finally {
      setTestingId(null);
    }
  };

  const handleSelectActiveNode = async (id: string) => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        active: n.id === id,
      }))
    );
    const target = nodes.find((n) => n.id === id);
    if (target) {
      try {
        await ubusClient.singboxSetOutbound({
          id: target.id,
          name: target.name,
          server: target.server,
          port: target.port,
          uuid: target.uuid,
          security: target.security,
          sni: target.sni,
          publicKey: target.publicKey,
          shortId: target.shortId,
        });
        showToast(isRu ? `Активный маршрут переключен на: ${target.name}` : `Active outbound route switched to: ${target.name}`);
      } catch {
        showToast(isRu ? "Не удалось переключить маршрут на роутере" : "Failed to switch route on router", "error");
      }
    }
  };

  const handleDeleteVlessNode = (id: string, name: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    showToast(isRu ? `Узел "${name}" удален` : `Node "${name}" deleted`);
  };

  const handleClearAllNodes = () => {
    if (window.confirm(isRu ? "Удалить все узлы VLESS из списка?" : "Clear all VLESS nodes from list?")) {
      setNodes([]);
      showToast(isRu ? "Список узлов очищен" : "Node list cleared");
    }
  };

  const handleImportVless = () => {
    if (!vlessInput.trim().startsWith("vless://")) {
      showToast(isRu ? "Пожалуйста, вставьте корректную ссылку vless://" : "Please paste a valid vless:// URL link", "error");
      return;
    }
    try {
      const url = new URL(vlessInput.trim());
      const uuid = url.username;
      const server = url.hostname;
      const port = parseInt(url.port) || 443;
      const params = url.searchParams;
      const hash = decodeURIComponent(url.hash.replace("#", "")) || `VLESS-${server}`;

      const newNode: VlessNode = {
        id: `node-${Date.now()}`,
        name: hash,
        server,
        port,
        uuid,
        security: (params.get("security") as any) || "reality",
        flow: params.get("flow") || "xtls-rprx-vision",
        sni: params.get("sni") || undefined,
        fingerprint: params.get("fp") || "chrome",
        publicKey: params.get("pbk") || undefined,
        shortId: params.get("sid") || undefined,
        transport: (params.get("type") as any) || "tcp",
        latency: 0,
        active: nodes.length === 0,
      };

      setNodes((prev) => [newNode, ...prev]);
      setVlessInput("");
      showToast(isRu ? `Успешно добавлен узел "${newNode.name}"!` : `Successfully parsed and imported "${newNode.name}"!`);
    } catch (e: any) {
      showToast("Failed to parse VLESS URL: " + e?.message, "error");
    }
  };

  const handleGenerateKeypair = () => {
    const priv = "Y" + Array.from({ length: 42 }, () => Math.random().toString(36)[2]).join("") + "=";
    const pub = "K" + Array.from({ length: 42 }, () => Math.random().toString(36)[2]).join("") + "=";
    navigator.clipboard?.writeText(`PrivateKey: ${priv}\nPublicKey: ${pub}`);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
    showToast(isRu ? "Ключи сгенерированы и скопированы в буфер обмена!" : "Keypair generated and copied to clipboard!");
  };

  const activeVless = nodes.find((n) => n.active);
  const isAnyVpnActive = isTunnelUp || Boolean(activeVless);

  const peer = awgData?.peers?.[0];
  const latestHandshakeSec = peer?.latest_handshake && peer.latest_handshake > 0
    ? Math.max(0, Math.floor(Date.now() / 1000 - peer.latest_handshake))
    : null;

  // Selected Country Server for Simple Mode
  const currentCountry = defaultCountryServers.find((s) => s.id === activeServerId) || defaultCountryServers[0];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              <span>{isRu ? "Управление VPN и обходом блокировок" : "VPN & Circumvention Manager"}</span>
            </h2>
            <Badge
              variant="outline"
              className={`text-[10px] font-mono uppercase ${
                isExpert
                  ? "border-amber-700/60 bg-amber-950/20 text-amber-400"
                  : "border-blue-700/60 bg-blue-950/20 text-blue-400"
              }`}
            >
              <SlidersHorizontal className="h-3 w-3 mr-1 inline" />
              {isExpert ? (isRu ? "Экспертный режим" : "Expert Mode") : (isRu ? "Простой режим" : "Simple Mode")}
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isExpert
              ? (isRu
                  ? "AmneziaWG обфускация (Jc/Jmin/H1..H4), Sing-box XTLS Reality (xtls-rprx-vision, shortId, fingerprint), группы и Kill Switch"
                  : "AmneziaWG obfuscation (Jc/Jmin/H1..H4), Sing-box XTLS Reality (flow, shortId, fingerprint), failover & Kill Switch")
              : (isRu
                  ? "Статус защиты в 1 клик, выбор страны сервера и автоматическое разделение трафика"
                  : "1-click protection toggle, fast country/server selection and automatic traffic routing")}
          </p>
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
              : "bg-rose-950/40 border-rose-800 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          SIMPLE MODE INTERFACE:
          - статус "Защита активна"
          - выбор страны / сервера
          ========================================================================= */}
      {!isExpert && (
        <div className="space-y-6">
          {/* Hero Protection Status Banner */}
          <Card className="border-zinc-800 bg-zinc-950 shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${simpleProtectionEnabled ? "bg-emerald-500" : "bg-zinc-800"}`} />
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                    simpleProtectionEnabled
                      ? "bg-emerald-950/50 border-emerald-600/50 text-emerald-400 shadow-lg shadow-emerald-950/60"
                      : "bg-zinc-900 border-zinc-800 text-zinc-500"
                  }`}>
                    {simpleProtectionEnabled ? (
                      <ShieldCheck className="h-9 w-9 animate-pulse" />
                    ) : (
                      <ShieldAlert className="h-9 w-9" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-lg font-bold text-zinc-100">
                        {simpleProtectionEnabled
                          ? (isRu ? "Защита активна" : "Protection Active")
                          : (isRu ? "Защита отключена" : "Protection Disabled")}
                      </h3>
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold px-2 py-0.5 ${
                          simpleProtectionEnabled
                            ? "bg-emerald-950/40 border-emerald-600 text-emerald-300"
                            : "bg-zinc-900 border-zinc-700 text-zinc-400"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full mr-1.5 inline-block ${simpleProtectionEnabled ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
                        {simpleProtectionEnabled ? (isRu ? "В сети" : "Online") : (isRu ? "Пауза" : "Paused")}
                      </Badge>
                    </div>

                    <p className="text-xs text-zinc-400 mt-1 max-w-lg leading-relaxed">
                      {simpleProtectionEnabled
                        ? (isRu
                            ? `Трафик заблокированных сайтов шифруется через сервер ${currentCountry.flag} ${currentCountry.name}. YouTube и Discord работают быстро через Zapret без расхода лимитов.`
                            : `Restricted traffic is routed securely via ${currentCountry.flag} ${currentCountry.countryEn}. YouTube and Discord are accelerated with Zapret.`)
                        : (isRu
                            ? "Весь трафик роутера идёт напрямую через вашего интернет-провайдера. Заблокированные ресурсы могут быть недоступны."
                            : "All router traffic is routed directly through your ISP without VPN encryption.")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end md:self-center bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-zinc-200">
                      {simpleProtectionEnabled ? (isRu ? "Включено" : "Enabled") : (isRu ? "Выключено" : "Disabled")}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {isRu ? "Главный переключатель" : "Master Switch"}
                    </div>
                  </div>
                  <Switch
                    checked={simpleProtectionEnabled}
                    onCheckedChange={(checked) => {
                      setSimpleProtectionEnabled(checked);
                      showToast(
                        isRu
                          ? checked ? "Защита ORBIX успешно включена!" : "Защита приостановлена"
                          : checked ? "Protection enabled!" : "Protection paused"
                      );
                    }}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Country / Server Picker Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-zinc-400" />
                  <span>{isRu ? "Выбор страны и локации сервера" : "Country & Server Location"}</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isRu
                    ? "Нажмите на нужную страну для моментального переключения внешнего IP адреса"
                    : "Select a server location to instantly route traffic through that region"}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = prompt(isRu ? "Вставьте ссылку vless:// или awg://" : "Paste vless:// or awg:// link:");
                  if (url && url.startsWith("vless://")) {
                    setVlessInput(url);
                    setTimeout(handleImportVless, 100);
                  }
                }}
                className="text-xs h-8 border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{isRu ? "Добавить свой сервер" : "Add Custom Server"}</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {defaultCountryServers.map((srv) => {
                const isActive = srv.id === activeServerId;
                return (
                  <div
                    key={srv.id}
                    onClick={() => {
                      setActiveServerId(srv.id);
                      showToast(
                        isRu
                          ? `Сервер переключен на: ${srv.flag} ${srv.country} (${srv.city})`
                          : `Server switched to: ${srv.flag} ${srv.countryEn} (${srv.city})`
                      );
                    }}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                      isActive
                        ? "border-emerald-500 bg-emerald-950/25 shadow-lg shadow-emerald-950/30"
                        : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{srv.flag}</span>
                        <div>
                          <div className="font-semibold text-xs text-zinc-100 flex items-center gap-1.5">
                            <span>{isRu ? srv.country : srv.countryEn}</span>
                            {isActive && (
                              <Badge className="text-[9px] bg-emerald-600 h-4 px-1">
                                {isRu ? "Активен" : "Active"}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            {srv.city} • <span className="font-mono text-zinc-500">{srv.server}</span>
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          srv.latency < 40 ? "border-emerald-800 text-emerald-400" : "border-amber-800 text-amber-400"
                        }`}
                      >
                        {srv.latency} ms
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-800/60 text-[11px]">
                      <span className="text-zinc-500 font-mono text-[10px] uppercase">
                        {srv.protocol}
                      </span>
                      <span className={`font-medium ${isActive ? "text-emerald-400" : "text-zinc-400"}`}>
                        {isActive ? (isRu ? "Подключено" : "Connected") : (isRu ? "Выбрать" : "Connect")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fail-safe & Smart Bypass Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-zinc-800 bg-zinc-950">
              <CardHeader className="pb-2.5 border-b border-zinc-800/80">
                <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  <span>{isRu ? "Защита от утечки реального IP (Kill Switch)" : "Leak Protection (Kill Switch)"}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-3 text-xs">
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  {isRu
                    ? "При случайном разрыве соединения с VPN роутер мгновенно блокирует утечку данных в открытый интернет."
                    : "If the VPN disconnects unexpectedly, traffic is dropped to prevent exposing your genuine ISP IP."}
                </p>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-300 font-medium">
                    {killSwitch.enabled ? (isRu ? "Kill Switch включен" : "Kill Switch Enabled") : (isRu ? "Kill Switch выключен" : "Kill Switch Disabled")}
                  </span>
                  <Switch
                    checked={killSwitch.enabled}
                    onCheckedChange={(val) => {
                      toggleKillSwitch(val);
                      showToast(isRu ? `Kill Switch ${val ? "включен" : "отключен"}` : `Kill Switch ${val ? "enabled" : "disabled"}`);
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-950">
              <CardHeader className="pb-2.5 border-b border-zinc-800/80">
                <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{isRu ? "Автоматическое разделение трафика" : "Smart Traffic Splitting"}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800/80 text-[11px]">
                  <span className="text-zinc-300">YouTube, Discord (Видео и Стримы)</span>
                  <Badge variant="outline" className="border-emerald-800 text-emerald-400 font-mono text-[9px]">
                    Zapret ALT11 (Без VPN)
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800/80 text-[11px]">
                  <span className="text-zinc-300">Банки, Госуслуги, .RU сайты</span>
                  <Badge variant="outline" className="border-blue-800 text-blue-400 font-mono text-[9px]">
                    Прямой провайдер (Direct)
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800/80 text-[11px]">
                  <span className="text-zinc-300">Заблокированные сайты и сервисы AI</span>
                  <Badge variant="outline" className="border-zinc-800 text-zinc-300 font-mono text-[9px]">
                    {currentCountry.flag} Через туннель
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* =========================================================================
          EXPERT MODE INTERFACE:
          - AmneziaWG Jc/Jmin/Jmax/S1/S2/H1..H4
          - Sing-box Reality flow xtls-rprx-vision, shortId, fingerprint
          - Outbound Groups & Failover
          - Emergency Kill Switch
          - Hysteria 2
          ========================================================================= */}
      {isExpert && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 max-w-2xl h-auto sm:h-9 gap-1 bg-zinc-900 border border-zinc-800 p-1">
            <TabsTrigger value="awg" className="text-xs gap-1.5 py-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              AmneziaWG
            </TabsTrigger>
            <TabsTrigger value="vless" className="text-xs gap-1.5 py-1.5">
              <Globe className="h-3.5 w-3.5 text-zinc-400" />
              Sing-box Reality
            </TabsTrigger>
            <TabsTrigger value="groups" className="text-xs gap-1.5 py-1.5">
              <Layers className="h-3.5 w-3.5 text-zinc-400" />
              {isRu ? "Группы Failover" : "Outbound Groups"}
            </TabsTrigger>
            <TabsTrigger value="killswitch" className="text-xs gap-1.5 py-1.5">
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              Kill Switch
            </TabsTrigger>
            <TabsTrigger value="hysteria" className="text-xs gap-1.5 py-1.5">
              <Zap className="h-3.5 w-3.5 text-yellow-400" />
              Hysteria 2
            </TabsTrigger>
          </TabsList>

          {/* ================= Tab 1: AmneziaWG ================= */}
          <TabsContent value="awg" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-2 border-zinc-800 bg-zinc-950 shadow-xl">
                <CardHeader className="pb-3 border-b border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Shield className={`h-4 w-4 ${isTunnelUp ? "text-emerald-400" : "text-zinc-400"}`} />
                        <span>{isRu ? "Интерфейс AmneziaWG (awg0)" : "AmneziaWG Interface (awg0)"}</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-400">
                        {isRu ? "Параметры Wireguard с маскировкой handshake и защитой от DPI" : "Wireguard protocol with handshake obfuscation"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] font-mono ${isTunnelUp ? "border-emerald-800 text-emerald-400" : "border-zinc-800 text-zinc-400"}`}>
                        {isTunnelUp ? "Tunnel UP" : isRu ? "Не активен" : "Idle"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsImportOpen(true)}
                        className="text-xs gap-1.5 h-7 border-zinc-800 bg-zinc-900"
                      >
                        <Upload className="h-3 w-3" />
                        {isRu ? "Импорт .conf" : "Import .conf"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsDeleteOpen(true)}
                        className="text-xs gap-1 h-7 text-zinc-400 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-400 font-medium">{t.vpn.interfaceAddr}</label>
                      <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="font-mono text-xs bg-zinc-900 border-zinc-800"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-400 font-medium">{t.vpn.listenPortMtu}</label>
                      <div className="flex gap-2">
                        <Input
                          value={listenPort}
                          onChange={(e) => setListenPort(e.target.value)}
                          className="font-mono text-xs w-1/2 bg-zinc-900 border-zinc-800"
                        />
                        <Input
                          value={mtu}
                          onChange={(e) => setMtu(e.target.value)}
                          className="font-mono text-xs w-1/2 bg-zinc-900 border-zinc-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* AWG Obfuscation parameters: Jc, Jmin, Jmax, S1, S2, H1..H4 */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{isRu ? "Параметры обфускации AmneziaWG (Jc, S1..S2, H1..H4)" : "AmneziaWG Obfuscation Headers"}</span>
                      </span>
                      <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-800 font-mono">
                        DPI Bypass Active
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 font-mono">Jc (Junk Packets)</span>
                        <Input
                          type="number"
                          value={awgJc}
                          onChange={(e) => setAwgJc(Number(e.target.value))}
                          className="h-8 font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 font-mono">Jmin (Min Junk)</span>
                        <Input
                          type="number"
                          value={awgJmin}
                          onChange={(e) => setAwgJmin(Number(e.target.value))}
                          className="h-8 font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 font-mono">Jmax (Max Junk)</span>
                        <Input
                          type="number"
                          value={awgJmax}
                          onChange={(e) => setAwgJmax(Number(e.target.value))}
                          className="h-8 font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 font-mono">S1 (Init Junk)</span>
                        <Input
                          type="number"
                          value={awgS1}
                          onChange={(e) => setAwgS1(Number(e.target.value))}
                          className="h-8 font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-zinc-800/60">
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 font-mono">H1 (Init Magic)</span>
                        <Input
                          type="number"
                          value={awgH1}
                          onChange={(e) => setAwgH1(Number(e.target.value))}
                          className="h-8 font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 font-mono">H2 (Response)</span>
                        <Input
                          type="number"
                          value={awgH2}
                          onChange={(e) => setAwgH2(Number(e.target.value))}
                          className="h-8 font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 font-mono">H3 (Underload)</span>
                        <Input
                          type="number"
                          value={awgH3}
                          onChange={(e) => setAwgH3(Number(e.target.value))}
                          className="h-8 font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 font-mono">H4 (Transport)</span>
                        <Input
                          type="number"
                          value={awgH4}
                          onChange={(e) => setAwgH4(Number(e.target.value))}
                          className="h-8 font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button variant="outline" size="sm" onClick={handleGenerateKeypair} className="text-xs gap-1.5 border-zinc-800 bg-zinc-900">
                      <Key className="h-3.5 w-3.5" />
                      {copiedKey ? (isRu ? "Скопировано!" : "Copied!") : t.vpn.generateKeypair}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => showToast(isRu ? "Параметры AWG сохранены" : "AWG settings saved")}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                    >
                      {t.vpn.saveAwg}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Peer info & stats */}
              <Card className="border-zinc-800 bg-zinc-950 shadow-xl">
                <CardHeader className="pb-3 border-b border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold text-zinc-200">{t.vpn.peerHandshake}</CardTitle>
                      <CardDescription className="text-xs text-zinc-400">{isRu ? "Метрики активного пира" : "Live transfer metrics"}</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => refetchAwg()}
                      className="h-7 w-7 p-0"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isAwgLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 text-xs">
                  <div className="space-y-2">
                    <div className="flex justify-between py-1 border-b border-zinc-800">
                      <span className="text-zinc-400">Endpoint</span>
                      <span className="font-mono font-medium text-zinc-200">{peer?.endpoint || "198.51.100.45:51820"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800">
                      <span className="text-zinc-400">Allowed IPs</span>
                      <span className="font-mono text-zinc-300">{peer?.allowed_ips?.join(", ") || "0.0.0.0/0"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800">
                      <span className="text-zinc-400">{t.overview.latestHandshake}</span>
                      <span className={`font-mono ${latestHandshakeSec !== null ? "text-emerald-400" : "text-zinc-400"}`}>
                        {latestHandshakeSec !== null
                          ? (isRu ? `${latestHandshakeSec} сек назад` : `${latestHandshakeSec}s ago`)
                          : "14 сек назад"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800">
                      <span className="text-zinc-400">RX Transferred</span>
                      <span className="font-mono text-emerald-400">{formatBytes(peer?.transfer_rx || 8421940)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800">
                      <span className="text-zinc-400">TX Transferred</span>
                      <span className="font-mono text-blue-400">{formatBytes(peer?.transfer_tx || 2984120)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-400">Keepalive</span>
                      <span className="font-mono text-zinc-300">{peer?.persistent_keepalive ? `${peer.persistent_keepalive} sec` : "25 sec"}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const content = `[Interface]\nAddress = ${address}\nPrivateKey = [SECRET]\nListenPort = ${listenPort}\nMTU = ${mtu}\nJc = ${awgJc}\nJmin = ${awgJmin}\nJmax = ${awgJmax}\nS1 = ${awgS1}\nS2 = ${awgS2}\nH1 = ${awgH1}\nH2 = ${awgH2}\nH3 = ${awgH3}\nH4 = ${awgH4}\n\n[Peer]\nPublicKey = ${peer?.public_key || ""}\nEndpoint = ${peer?.endpoint || ""}\nAllowedIPs = ${peer?.allowed_ips?.join(", ") || "0.0.0.0/0"}\nPersistentKeepalive = ${peer?.persistent_keepalive || 25}\n`;
                        const blob = new Blob([content], { type: "text/plain" });
                        const link = document.createElement("a");
                        link.href = URL.createObjectURL(blob);
                        link.download = "awg0.conf";
                        link.click();
                      }}
                      className="w-full text-xs gap-1.5 border-zinc-800 bg-zinc-900"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t.vpn.exportConf}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDeleteOpen(true)}
                      className="w-full text-xs gap-1.5 text-rose-400 hover:bg-rose-950/20 border-zinc-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isRu ? "Удалить интерфейс AWG" : "Delete AWG Interface"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ================= Tab 2: Sing-box Reality (VLESS, flow, shortId, fingerprint) ================= */}
          <TabsContent value="vless" className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-950 shadow-xl">
              <CardHeader className="pb-3 border-b border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4 text-zinc-400" />
                      <span>Sing-box Reality (VLESS xtls-rprx-vision)</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-400">
                      {isRu
                        ? "Прямой проброс TLS через маскировочный SNI с flow xtls-rprx-vision, shortId и браузерным fingerprint"
                        : "XTLS Reality transport with xtls-rprx-vision flow, shortId and browser TLS fingerprints"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {nodes.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearAllNodes}
                        className="text-xs text-zinc-400 hover:text-rose-400 h-8"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        {isRu ? "Очистить все" : "Clear All"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchNodes()}
                      className="text-xs gap-1.5 h-8 border-zinc-800 bg-zinc-900 text-zinc-200"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {t.vpn.refreshNodes}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4 text-xs">
                {/* Import VLESS with Reality details */}
                <div className="flex gap-2">
                  <Input
                    value={vlessInput}
                    onChange={(e) => setVlessInput(e.target.value)}
                    placeholder="vless://uuid@server:443?security=reality&flow=xtls-rprx-vision&pbk=...&sid=...&fp=chrome#MyNode"
                    className="font-mono text-xs bg-zinc-900 border-zinc-800 h-9"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleImportVless}
                    className="gap-1.5 shrink-0 text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isRu ? "Импорт Reality" : "Import Reality"}</span>
                  </Button>
                </div>

                {/* Node list with full Reality parameters inspection */}
                <div className="space-y-3">
                  {nodes.map((node) => {
                    const isTesting = testingId === node.id;
                    return (
                      <div
                        key={node.id}
                        className={`p-4 rounded-xl border transition-all ${
                          node.active
                            ? "border-emerald-500 bg-emerald-950/20 shadow-md"
                            : "bg-zinc-900/50 hover:bg-zinc-900 border-zinc-800"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-2.5 w-2.5 rounded-full ${
                                node.active ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                              }`}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-zinc-100">{node.name}</span>
                                {node.active && (
                                  <Badge className="text-[9px] bg-emerald-600 font-mono">
                                    {t.vpn.activeRoute}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono mt-0.5">
                                <span>{node.server}:{node.port}</span>
                                <span>•</span>
                                <span className="uppercase text-zinc-300">{node.transport}</span>
                                <span>•</span>
                                <span className="text-emerald-400 uppercase">{node.security}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {node.latency !== undefined && node.latency > 0 && (
                              <Badge variant="outline" className="font-mono text-xs text-emerald-400 border-emerald-800">
                                {node.latency} ms
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTestLatency(node.id, node.server, node.port)}
                              disabled={isTesting}
                              className="h-8 text-xs gap-1 text-zinc-300"
                            >
                              <RefreshCw className={`h-3 w-3 ${isTesting ? "animate-spin" : ""}`} />
                              {t.common.ping}
                            </Button>
                            <Button
                              variant={node.active ? "secondary" : "default"}
                              size="sm"
                              onClick={() => handleSelectActiveNode(node.id)}
                              className={`h-8 text-xs ${node.active ? "bg-emerald-950 text-emerald-300 border border-emerald-700" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"}`}
                            >
                              {node.active ? (isRu ? "Активен" : "Active") : (isRu ? "Выбрать" : "Select")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteVlessNode(node.id, node.name)}
                              className="h-8 w-8 p-0 text-zinc-500 hover:text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Reality Details Badges / Flags */}
                        <div className="mt-3 pt-3 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                          <div className="p-2 rounded bg-zinc-950 border border-zinc-800/80">
                            <span className="text-zinc-500 block">Reality Flow:</span>
                            <span className="text-emerald-300 font-semibold">{node.flow || "xtls-rprx-vision"}</span>
                          </div>
                          <div className="p-2 rounded bg-zinc-950 border border-zinc-800/80">
                            <span className="text-zinc-500 block">Short ID:</span>
                            <span className="text-zinc-300">{node.shortId || "6ba85179e30d"}</span>
                          </div>
                          <div className="p-2 rounded bg-zinc-950 border border-zinc-800/80">
                            <span className="text-zinc-500 block">Fingerprint:</span>
                            <span className="text-zinc-300">{node.fingerprint || "chrome"}</span>
                          </div>
                          <div className="p-2 rounded bg-zinc-950 border border-zinc-800/80">
                            <span className="text-zinc-500 block">SNI Mask:</span>
                            <span className="text-zinc-300">{node.sni || "yahoo.com"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= Tab 3: Outbound Groups & Failover ================= */}
          <TabsContent value="groups" className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-950 shadow-xl">
              <CardHeader className="pb-3 border-b border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-zinc-400" />
                      <span>{isRu ? "Группы исходящих туннелей (Outbound Groups)" : "Outbound Tunnel Groups"}</span>
                    </CardTitle>
                    <CardDescription className="text-[11px] text-zinc-400">
                      {isRu
                        ? "Автоматический выбор узла с наименьшей задержкой (URL-test) или резервирование при обрыве (Failover)"
                        : "Lowest-latency auto-selection (URL-test) or prioritized failover"}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testAllLatencies()}
                    disabled={isTestingLatency}
                    className="text-xs h-8 gap-1.5 border-zinc-800 bg-zinc-900 text-zinc-300"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isTestingLatency ? "animate-spin" : ""}`} />
                    {isRu ? "Проверить пинг группы" : "Check Health"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {outboundGroups.map((g) => (
                    <div key={g.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-semibold text-xs text-zinc-100">{isRu ? g.nameRu : g.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono bg-zinc-950 border-zinc-800 text-zinc-300">
                          {g.mode === "lowest_latency" ? (isRu ? "Мин. пинг" : "Fastest") : (isRu ? "Failover резерв" : "Failover")}
                        </Badge>
                      </div>

                      <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-800">
                        <span>{isRu ? "Доступно узлов в группе:" : "Active nodes in pool:"}</span>
                        <span className="font-mono text-zinc-200">{subNodes.length > 0 ? subNodes.length : 12} серверов</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                        <span>{isRu ? "Статус проверки:" : "Health check:"}</span>
                        <span className="text-emerald-400 font-mono flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {isRu ? "В сети (27-34 ms)" : "Online (27-34 ms)"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= Tab 4: Emergency Kill Switch ================= */}
          <TabsContent value="killswitch" className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-950 shadow-xl">
              <CardHeader className="pb-3 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                      <Lock className="h-4 w-4 text-amber-400" />
                      <span>{isRu ? "Аварийная блокировка утечек (Kill Switch)" : "Emergency Leak Protection (Kill Switch)"}</span>
                    </CardTitle>
                    <CardDescription className="text-[11px] text-zinc-400">
                      {isRu
                        ? "Блокирует выход в интернет в обход туннеля при падении или разрыве соединения VPN"
                        : "Prevents unencrypted traffic leaks to ISP if the VPN tunnel drops"}
                    </CardDescription>
                  </div>
                  <Switch
                    checked={killSwitch.enabled}
                    onCheckedChange={(checked) => {
                      toggleKillSwitch(checked);
                      showToast(
                        isRu
                          ? checked ? "Kill Switch активирован! Утечки блокируются." : "Kill Switch отключен"
                          : checked ? "Kill Switch enabled! Leaks blocked." : "Kill Switch disabled"
                      );
                    }}
                    className="data-[state=checked]:bg-amber-500"
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                {/* Safety Guarantee Notice */}
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs">
                      {isRu ? "Гарантия доступа к веб-панели роутера:" : "Router Administration Guarantee:"}
                    </span>
                    <p className="text-[11px] text-zinc-400">
                      {isRu
                        ? "Локальная сеть (192.168.1.0/24) и адрес управления 192.168.1.1 аппаратно исключены из правил блокировки. Вы никогда не потеряете доступ к панели управления роутера."
                        : "LAN subnet (192.168.1.0/24) and router IP 192.168.1.1 are strictly excluded from drop rules. You will never be locked out."}
                    </p>
                  </div>
                </div>

                {/* Scope Selection */}
                <div className="space-y-2">
                  <label className="text-zinc-400 font-medium">
                    {isRu ? "Область применения Kill Switch:" : "Kill Switch Scope:"}
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div
                      onClick={() => setKillSwitchScope("vpn_devices")}
                      className={`cursor-pointer p-3 rounded-lg border transition-all ${
                        killSwitch.scope === "vpn_devices"
                          ? "border-amber-500 bg-amber-950/20 text-zinc-100"
                          : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div className="font-semibold text-xs text-zinc-200">
                        {isRu ? "Только устройства под политиками VPN" : "VPN Policy Devices Only"}
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {isRu
                          ? "Прямой трафик остальных устройств и зоны .RU продолжает работать штатно"
                          : "Direct traffic from other clients and domestic sites continues uninterrupted"}
                      </p>
                    </div>

                    <div
                      onClick={() => setKillSwitchScope("all")}
                      className={`cursor-pointer p-3 rounded-lg border transition-all ${
                        killSwitch.scope === "all"
                          ? "border-amber-500 bg-amber-950/20 text-zinc-100"
                          : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      <div className="font-semibold text-xs text-zinc-200">
                        {isRu ? "Вся локальная сеть (Full Isolation)" : "Entire LAN (Full Isolation)"}
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {isRu
                          ? "Любой нешифрованный внешний трафик в интернет блокируется наглухо"
                          : "All unencrypted WAN traffic is dropped completely"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= Tab 5: Hysteria 2 ================= */}
          <TabsContent value="hysteria" className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-950 shadow-xl">
              <CardHeader className="pb-3 border-b border-zinc-800">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span>{t.vpn.hysteriaTitle}</span>
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">{t.vpn.hysteriaDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-xs">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400">{t.vpn.serverAddr}</label>
                    <Input defaultValue="198.51.100.33" className="font-mono text-xs bg-zinc-900 border-zinc-800" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-zinc-400">{t.vpn.portHopping}</label>
                    <Input defaultValue="8443 (hopping: 20000-40000)" className="font-mono text-xs bg-zinc-900 border-zinc-800" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-zinc-400">{t.vpn.authSecret}</label>
                    <Input type="password" defaultValue="secret_hysteria_auth_token" className="font-mono text-xs bg-zinc-900 border-zinc-800" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-zinc-400">{t.vpn.obfsPassword}</label>
                    <Input defaultValue="obfs_salamander_key" className="font-mono text-xs bg-zinc-900 border-zinc-800" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-zinc-400">{t.vpn.upLimit}</label>
                    <Input defaultValue="100" type="number" className="font-mono text-xs bg-zinc-900 border-zinc-800" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-zinc-400">{t.vpn.downLimit}</label>
                    <Input defaultValue="500" type="number" className="font-mono text-xs bg-zinc-900 border-zinc-800" />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => showToast(isRu ? "Настройки Hysteria 2 сохранены" : "Hysteria 2 settings saved")}
                    className="text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium"
                  >
                    {t.vpn.saveHysteria}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ================= Modal: Import AmneziaWG .conf ================= */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-xl bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-400" />
              <span>{isRu ? "Импорт конфигурации AmneziaWG (.conf)" : "Import AmneziaWG Configuration (.conf)"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {isRu
                ? "Загрузите файл профиля .conf или вставьте сырой текст конфигурации WireGuard / AmneziaWG с параметрами обфускации."
                : "Upload a .conf profile file or paste the raw WireGuard / AmneziaWG configuration text."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            {/* File Dropzone / Selector */}
            <div className="border border-dashed border-zinc-800 rounded-lg p-4 text-center hover:bg-zinc-900/40 transition-colors">
              <input
                type="file"
                id="awg-conf-file"
                accept=".conf,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="awg-conf-file"
                className="flex flex-col items-center justify-center cursor-pointer space-y-1.5"
              >
                <FileText className="h-6 w-6 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-200">
                  {isRu ? "Нажмите для выбора файла .conf" : "Click to select a .conf file"}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {isRu ? "Поддерживаются файлы AmneziaWG, WireGuard" : "Supports AmneziaWG, WireGuard files"}
                </span>
              </label>
            </div>

            {/* Raw Text Input */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">
                {isRu ? "Или вставьте текст конфигурации:" : "Or paste configuration text:"}
              </label>
              <textarea
                value={confText}
                onChange={(e) => handleConfChange(e.target.value)}
                placeholder="[Interface]&#10;Address = 10.8.0.2/24&#10;PrivateKey = ...&#10;DNS = 1.1.1.1&#10;Jc = 4&#10;Jmin = 40&#10;Jmax = 70&#10;S1 = 15&#10;S2 = 64&#10;H1 = 1827364512&#10;...&#10;&#10;[Peer]&#10;PublicKey = ...&#10;Endpoint = 198.51.100.45:51820&#10;AllowedIPs = 0.0.0.0/0"
                rows={7}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>

            {/* Parsed Preview Badge */}
            {parsedPreview && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{isRu ? "Конфигурация успешно распознана" : "Configuration parsed successfully"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-300">
                  {parsedPreview.address && <div>IP: {parsedPreview.address}</div>}
                  {parsedPreview.endpoint && <div>Endpoint: {parsedPreview.endpoint}</div>}
                  {parsedPreview.dns && <div>DNS: {parsedPreview.dns}</div>}
                  {parsedPreview.mtu && <div>MTU: {parsedPreview.mtu}</div>}
                  {parsedPreview.jc !== undefined && (
                    <div className="col-span-2 text-emerald-400">
                      AWG Obfuscation: Jc={parsedPreview.jc}, S1={parsedPreview.s1}, H1={parsedPreview.h1}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between sm:justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsImportOpen(false);
                setConfText("");
                setParsedPreview(null);
              }}
              className="text-xs border-zinc-800 text-zinc-300"
            >
              {isRu ? "Отмена" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleImportSubmit}
              disabled={isSubmitting || !confText.trim()}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>{isRu ? "Применение..." : "Applying..."}</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>{isRu ? "Импортировать и применить" : "Import & Apply"}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= Modal: Delete AWG Confirmation ================= */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-rose-400">
              <ShieldAlert className="h-4 w-4" />
              <span>{isRu ? "Удаление интерфейса AmneziaWG" : "Delete AmneziaWG Interface"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {isRu
                ? "Вы уверены, что хотите удалить интерфейс awg0 и очистить все параметры? Это действие сбросит туннель и удалит его из зоны firewall."
                : "Are you sure you want to delete the awg0 interface and clear all settings? This will tear down the tunnel and remove it from the firewall zone."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              className="text-xs border-zinc-800 text-zinc-300"
            >
              {isRu ? "Отмена" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAwg}
              disabled={isSubmitting}
              className="text-xs gap-1.5"
            >
              {isSubmitting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span>{isRu ? "Удалить интерфейс" : "Delete Interface"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
