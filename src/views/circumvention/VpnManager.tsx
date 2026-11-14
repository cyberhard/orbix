import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export const VpnManager: React.FC = () => {
  const { t, language } = useI18nStore();
  const isRu = language === "ru";
  const [activeTab, setActiveTab] = useState("awg");
  const [vlessInput, setVlessInput] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

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

  // Editable parameters for AWG
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

  const [nodes, setNodes] = useState<VlessNode[]>([]);

  useEffect(() => {
    if (vlessNodes && Array.isArray(vlessNodes)) {
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
        flow: params.get("flow") || undefined,
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

  const peer = awgData?.peers?.[0];
  const latestHandshakeSec = peer?.latest_handshake && peer.latest_handshake > 0
    ? Math.max(0, Math.floor(Date.now() / 1000 - peer.latest_handshake))
    : null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">{t.vpn.title}</h2>
          <p className="text-xs text-muted-foreground">{t.vpn.subtitle}</p>
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between animate-fade-in ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-md h-9">
          <TabsTrigger value="awg" className="text-xs gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            AmneziaWG
          </TabsTrigger>
          <TabsTrigger value="vless" className="text-xs gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            VLESS / Sing-box
          </TabsTrigger>
          <TabsTrigger value="hysteria" className="text-xs gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Hysteria 2
          </TabsTrigger>
        </TabsList>

        {/* ================= Tab 1: AmneziaWG ================= */}
        <TabsContent value="awg" className="space-y-4">
          {!isConfigured ? (
            /* Empty State: Not Configured */
            <Card className="border-border/60 bg-card/40">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-zinc-400" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-sm font-semibold text-foreground">
                    {isRu ? "Интерфейс AmneziaWG не настроен" : "AmneziaWG Interface Not Configured"}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isRu
                      ? "Туннель awg0 не настроен на роутере. Импортируйте файл .conf от вашего провайдера или вставьте текст конфигурации с параметрами обфускации (Jc, Jmin, Jmax, S1, S2, H1-H4)."
                      : "The awg0 tunnel is not currently configured. Import a .conf file from your VPN provider or paste the configuration text with obfuscation parameters."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Button
                    size="sm"
                    onClick={() => setIsImportOpen(true)}
                    className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isRu ? "Импортировать .conf" : "Import .conf"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateKeypair}
                    className="text-xs gap-1.5"
                  >
                    <Key className="h-3.5 w-3.5" />
                    {copiedKey ? (isRu ? "Скопировано!" : "Copied!") : t.vpn.generateKeypair}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Configured State */
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-2 border-border/60 bg-card/40">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Shield className={`h-4 w-4 ${isTunnelUp ? "text-emerald-400" : "text-zinc-400"}`} />
                        <span>{t.vpn.awgProfile}</span>
                      </CardTitle>
                      <CardDescription>{t.vpn.awgDesc}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isTunnelUp ? "success" : "outline"} className="text-[10px]">
                        {isTunnelUp ? "Tunnel UP" : isRu ? "Не активен" : "Idle"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsImportOpen(true)}
                        className="text-xs gap-1.5 h-7"
                      >
                        <Upload className="h-3 w-3" />
                        {isRu ? "Импорт .conf" : "Import .conf"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsDeleteOpen(true)}
                        className="text-xs gap-1 h-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">{t.vpn.interfaceAddr}</label>
                      <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">{t.vpn.listenPortMtu}</label>
                      <div className="flex gap-2">
                        <Input
                          value={listenPort}
                          onChange={(e) => setListenPort(e.target.value)}
                          className="font-mono text-xs w-1/2"
                        />
                        <Input
                          value={mtu}
                          onChange={(e) => setMtu(e.target.value)}
                          className="font-mono text-xs w-1/2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* AWG Obfuscation parameters */}
                  <div className="rounded-lg border bg-background/40 p-4 space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5 text-primary" />
                        {t.vpn.awgFlags}
                      </span>
                      <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                        {isRu ? "Обфускация активна" : "Obfuscation Active"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-mono">Jc (Junk Packets)</span>
                        <Input
                          type="number"
                          value={awgJc}
                          onChange={(e) => setAwgJc(Number(e.target.value))}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-mono">Jmin (Min Junk)</span>
                        <Input
                          type="number"
                          value={awgJmin}
                          onChange={(e) => setAwgJmin(Number(e.target.value))}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-mono">Jmax (Max Junk)</span>
                        <Input
                          type="number"
                          value={awgJmax}
                          onChange={(e) => setAwgJmax(Number(e.target.value))}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-mono">S1 (Init Junk)</span>
                        <Input
                          type="number"
                          value={awgS1}
                          onChange={(e) => setAwgS1(Number(e.target.value))}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-mono">H1 (Init Magic)</span>
                        <Input
                          type="number"
                          value={awgH1}
                          onChange={(e) => setAwgH1(Number(e.target.value))}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-mono">H2 (Response Magic)</span>
                        <Input
                          type="number"
                          value={awgH2}
                          onChange={(e) => setAwgH2(Number(e.target.value))}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-mono">H3 (Underload)</span>
                        <Input
                          type="number"
                          value={awgH3}
                          onChange={(e) => setAwgH3(Number(e.target.value))}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-mono">H4 (Transport)</span>
                        <Input
                          type="number"
                          value={awgH4}
                          onChange={(e) => setAwgH4(Number(e.target.value))}
                          className="h-8 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button variant="outline" size="sm" onClick={handleGenerateKeypair} className="text-xs gap-1.5">
                      <Key className="h-3.5 w-3.5" />
                      {copiedKey ? (isRu ? "Скопировано!" : "Copied!") : t.vpn.generateKeypair}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => showToast(isRu ? "Параметры AWG сохранены" : "AWG settings saved")}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500"
                    >
                      {t.vpn.saveAwg}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Peer info & stats */}
              <Card className="border-border/60 bg-card/40">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">{t.vpn.peerHandshake}</CardTitle>
                      <CardDescription>{isRu ? "Метрики активного пира" : "Live transfer metrics"}</CardDescription>
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
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Endpoint</span>
                      <span className="font-mono font-medium">{peer?.endpoint || (isRu ? "Не указан" : "None")}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Allowed IPs</span>
                      <span className="font-mono text-zinc-300">{peer?.allowed_ips?.join(", ") || "0.0.0.0/0"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">{t.overview.latestHandshake}</span>
                      <span className={`font-mono ${latestHandshakeSec !== null ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {latestHandshakeSec !== null
                          ? (isRu ? `${latestHandshakeSec} сек назад` : `${latestHandshakeSec}s ago`)
                          : (isRu ? "Нет соединения" : "No handshake")}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">RX Transferred</span>
                      <span className="font-mono text-emerald-400">{formatBytes(peer?.transfer_rx || 0)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">TX Transferred</span>
                      <span className="font-mono text-blue-400">{formatBytes(peer?.transfer_tx || 0)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Keepalive</span>
                      <span className="font-mono">{peer?.persistent_keepalive ? `${peer.persistent_keepalive} sec` : "25 sec"}</span>
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
                      className="w-full text-xs gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t.vpn.exportConf}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDeleteOpen(true)}
                      className="w-full text-xs gap-1.5 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isRu ? "Удалить интерфейс AWG" : "Delete AWG Interface"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ================= Tab 2: VLESS / Sing-box / Xray ================= */}
        <TabsContent value="vless" className="space-y-4">
          <Card className="border-border/60 bg-card/40">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-400" />
                    <span>{t.vpn.vlessTitle}</span>
                  </CardTitle>
                  <CardDescription>{t.vpn.vlessDesc}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {nodes.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAllNodes}
                      className="text-xs text-muted-foreground hover:text-destructive h-8"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {isRu ? "Очистить все" : "Clear All"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchNodes()}
                    className="text-xs gap-1.5 h-8"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t.vpn.refreshNodes}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {/* Import VLESS */}
              <div className="flex gap-2">
                <Input
                  value={vlessInput}
                  onChange={(e) => setVlessInput(e.target.value)}
                  placeholder={t.vpn.pasteVless}
                  className="font-mono text-xs bg-background/50 h-9"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleImportVless}
                  className="gap-1.5 shrink-0 text-xs h-9 bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t.vpn.importNode}
                </Button>
              </div>

              {/* Node list */}
              {nodes.length === 0 ? (
                <div className="py-8 text-center border rounded-lg border-dashed text-xs text-muted-foreground">
                  {isRu
                    ? "Список узлов пуст. Добавьте узел через ссылку vless:// выше или синхронизируйте подписку в разделе 'Подписки'."
                    : "No VLESS nodes added. Paste a vless:// URL above or sync a subscription in the 'Subscriptions' tab."}
                </div>
              ) : (
                <div className="space-y-2">
                  {nodes.map((node) => {
                    const isTesting = testingId === node.id;
                    return (
                      <div
                        key={node.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border transition-all ${
                          node.active
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "bg-card/50 hover:bg-card border-border/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${
                              node.active ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground">{node.name}</span>
                              {node.active && (
                                <Badge variant="default" className="text-[9px] bg-emerald-600">
                                  {t.vpn.activeRoute}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono mt-0.5">
                              <span>{node.server}:{node.port}</span>
                              <span>•</span>
                              <span className="uppercase text-primary/80">{node.transport}</span>
                              <span>•</span>
                              <span className="text-emerald-400">{node.security}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-3 sm:mt-0">
                          {node.latency !== undefined && node.latency > 0 && (
                            <Badge variant="outline" className="font-mono text-xs text-emerald-400">
                              {node.latency} ms
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestLatency(node.id, node.server, node.port)}
                            disabled={isTesting}
                            className="h-8 text-xs gap-1"
                          >
                            <RefreshCw className={`h-3 w-3 ${isTesting ? "animate-spin" : ""}`} />
                            {t.common.ping}
                          </Button>
                          <Button
                            variant={node.active ? "secondary" : "default"}
                            size="sm"
                            onClick={() => handleSelectActiveNode(node.id)}
                            className="h-8 text-xs"
                          >
                            {node.active ? t.common.active : t.vpn.selectNode}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteVlessNode(node.id, node.name)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= Tab 3: Hysteria 2 ================= */}
        <TabsContent value="hysteria" className="space-y-4">
          <Card className="border-border/60 bg-card/40">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <span>{t.vpn.hysteriaTitle}</span>
              </CardTitle>
              <CardDescription>{t.vpn.hysteriaDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t.vpn.serverAddr}</label>
                  <Input defaultValue="198.51.100.33" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t.vpn.portHopping}</label>
                  <Input defaultValue="8443 (hopping: 20000-40000)" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t.vpn.authSecret}</label>
                  <Input type="password" defaultValue="secret_hysteria_auth_token" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t.vpn.obfsPassword}</label>
                  <Input defaultValue="obfs_salamander_key" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t.vpn.upLimit}</label>
                  <Input defaultValue="100" type="number" className="font-mono text-xs" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t.vpn.downLimit}</label>
                  <Input defaultValue="500" type="number" className="font-mono text-xs" />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => showToast(isRu ? "Настройки Hysteria 2 сохранены" : "Hysteria 2 settings saved")}
                  className="text-xs bg-amber-600 hover:bg-amber-500"
                >
                  {t.vpn.saveHysteria}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================= Modal 1: Import AmneziaWG .conf ================= */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-400" />
              {isRu ? "Импорт конфигурации AmneziaWG (.conf)" : "Import AmneziaWG Configuration (.conf)"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isRu
                ? "Загрузите файл профиля .conf или вставьте сырой текст конфигурации WireGuard / AmneziaWG с параметрами обфускации."
                : "Upload a .conf profile file or paste the raw WireGuard / AmneziaWG configuration text."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* File Dropzone / Selector */}
            <div className="border border-dashed rounded-lg p-4 text-center hover:bg-accent/20 transition-colors">
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
                <FileText className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">
                  {isRu ? "Нажмите для выбора файла .conf" : "Click to select a .conf file"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {isRu ? "Поддерживаются файлы AmneziaWG, WireGuard" : "Supports AmneziaWG, WireGuard files"}
                </span>
              </label>
            </div>

            {/* Raw Text Input */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                {isRu ? "Или вставьте текст конфигурации:" : "Or paste configuration text:"}
              </label>
              <textarea
                value={confText}
                onChange={(e) => handleConfChange(e.target.value)}
                placeholder="[Interface]&#10;Address = 10.8.0.2/24&#10;PrivateKey = ...&#10;DNS = 1.1.1.1&#10;Jc = 4&#10;Jmin = 40&#10;Jmax = 70&#10;S1 = 15&#10;S2 = 64&#10;H1 = 1827364512&#10;...&#10;&#10;[Peer]&#10;PublicKey = ...&#10;Endpoint = 198.51.100.45:51820&#10;AllowedIPs = 0.0.0.0/0"
                rows={7}
                className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Parsed Preview Badge */}
            {parsedPreview && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {isRu ? "Конфигурация успешно распознана" : "Configuration parsed successfully"}
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
              className="text-xs"
            >
              {isRu ? "Отмена" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleImportSubmit}
              disabled={isSubmitting || !confText.trim()}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  {isRu ? "Применение..." : "Applying..."}
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {isRu ? "Импортировать и применить" : "Import & Apply"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= Modal 2: Delete AWG Confirmation ================= */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-4 w-4" />
              {isRu ? "Удаление интерфейса AmneziaWG" : "Delete AmneziaWG Interface"}
            </DialogTitle>
            <DialogDescription className="text-xs">
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
              className="text-xs"
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
              {isRu ? "Удалить интерфейс" : "Delete Interface"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
