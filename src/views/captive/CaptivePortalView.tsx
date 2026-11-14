// ORBIX Captive Portal, HTTP Interception & Secure Error Portal View
// Strictly adhering to shadcn/ui Zinc design language specifications
import React, { useState, useEffect } from "react";
import { useCaptiveStore } from "@/store/captive-store";
import { useI18nStore } from "@/store/i18n-store";
import { CaptivePortalMode, CertificateMode } from "@/types/captive";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  ShieldAlert,
  Globe,
  Lock,
  RefreshCw,
  Server,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Terminal,
  ArrowRight,
  ExternalLink,
  Key,
  Upload,
  Clock,
  Laptop,
  Sliders,
  Check,
  FileCheck,
  Shield,
  Layers,
  HelpCircle,
  Network,
} from "lucide-react";

export const CaptivePortalView: React.FC = () => {
  const { lang } = useI18nStore();
  const isRu = lang === "ru";

  const {
    config,
    status,
    clients,
    certStatus,
    diagnostics,
    events,
    activeTab,
    isLoading,
    isSaving,
    isRunningDiagnostics,
    setActiveTab,
    loadAll,
    updateConfig,
    saveConfig,
    setMode,
    refreshClients,
    toggleClientExemption,
    refreshCertStatus,
    renewCertificate,
    uploadCertificate,
    runDiagnostics,
    clearEvents,
  } = useCaptiveStore();

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadCertPem, setUploadCertPem] = useState("");
  const [uploadKeyPem, setUploadKeyPem] = useState("");
  const [uploadDomain, setUploadDomain] = useState(config.portal_domain || "orbix.lan");

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      refreshClients();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    const res = await saveConfig();
    setFeedback({
      type: res.success ? "success" : "error",
      message: res.message,
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleRenewCert = async () => {
    const res = await renewCertificate();
    setFeedback({
      type: res.success ? "success" : "error",
      message: res.message,
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleUploadCertSubmit = async () => {
    const res = await uploadCertificate(uploadCertPem, uploadKeyPem, uploadDomain);
    setFeedback({
      type: res.success ? "success" : "error",
      message: res.message,
    });
    if (res.success) {
      setUploadDialogOpen(false);
      setUploadCertPem("");
      setUploadKeyPem("");
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  const getModeBadge = (mode: CaptivePortalMode) => {
    switch (mode) {
      case "strict":
        return (
          <Badge variant="outline" className="border-red-800/60 bg-red-950/30 text-red-400 font-mono text-xs">
            {isRu ? "СТРОГИЙ РЕЖИМ (A)" : "STRICT (MODE A)"}
          </Badge>
        );
      case "captive_portal":
        return (
          <Badge variant="outline" className="border-emerald-800/60 bg-emerald-950/30 text-emerald-400 font-mono text-xs">
            {isRu ? "КАПТИВ-ПОРТАЛ (B)" : "CAPTIVE PORTAL (MODE B)"}
          </Badge>
        );
      case "http_redirect":
        return (
          <Badge variant="outline" className="border-amber-800/60 bg-amber-950/30 text-amber-400 font-mono text-xs">
            {isRu ? "HTTP РЕДИРЕКТ (C)" : "HTTP REDIRECT (MODE C)"}
          </Badge>
        );
    }
  };

  const getClientStateBadge = (state: string) => {
    switch (state) {
      case "open":
      case "authorized":
        return (
          <Badge variant="outline" className="border-emerald-800/60 bg-emerald-950/30 text-emerald-400 font-mono text-[11px]">
            {isRu ? "РАЗРЕШЕНО" : "AUTHORIZED"}
          </Badge>
        );
      case "exempt":
        return (
          <Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-300 font-mono text-[11px]">
            {isRu ? "ИСКЛЮЧЕНИЕ" : "EXEMPT"}
          </Badge>
        );
      case "restricted":
        return (
          <Badge variant="outline" className="border-red-800/60 bg-red-950/30 text-red-400 font-mono text-[11px]">
            {isRu ? "ОГРАНИЧЕН" : "RESTRICTED"}
          </Badge>
        );
      case "captive":
      default:
        return (
          <Badge variant="outline" className="border-amber-800/60 bg-amber-950/30 text-amber-400 font-mono text-[11px]">
            {isRu ? "КАПТИВ" : "CAPTIVE"}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Radio className="h-5 w-5 text-foreground" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {isRu ? "Каптив-портал и HTTP-перехват" : "Captive Portal & HTTP Interception"}
            </h1>
            <Badge variant="outline" className="text-xs font-mono border-border bg-card text-muted-foreground">
              RFC 8952 • RFC 8908 • RFC 8910
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isRu
              ? "Управление оповещениями об ограничениях сети, RFC 8908 API, HTTP 307 перехватом и TLS-сертификатами"
              : "Enterprise network restriction notifications, RFC 8908 Captive API, HTTP 307 redirection and TLS certificates"}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAll}
            disabled={isLoading}
            className="h-8 text-xs font-medium gap-1.5 border-border bg-card text-foreground hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isRu ? "Обновить" : "Refresh"}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 text-xs font-medium gap-1.5 bg-foreground text-background hover:bg-foreground/90"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{isSaving ? (isRu ? "Применение..." : "Applying...") : (isRu ? "Применить настройки" : "Apply Changes")}</span>
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-md text-xs font-mono flex items-center gap-2 border ${
            feedback.type === "success"
              ? "bg-emerald-950/20 border-emerald-800/50 text-emerald-400"
              : "bg-red-950/20 border-red-800/50 text-red-400"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted border border-border p-1 w-full justify-start overflow-x-auto h-auto flex-wrap">
          <TabsTrigger value="overview" className="text-xs">
            {isRu ? "Обзор" : "Overview"}
          </TabsTrigger>
          <TabsTrigger value="general" className="text-xs">
            {isRu ? "Основные" : "General"}
          </TabsTrigger>
          <TabsTrigger value="interception" className="text-xs">
            {isRu ? "HTTP Перехват" : "HTTP Interception"}
          </TabsTrigger>
          <TabsTrigger value="api" className="text-xs">
            {isRu ? "RFC 8908 API" : "Captive API"}
          </TabsTrigger>
          <TabsTrigger value="certs" className="text-xs">
            {isRu ? "TLS Сертификаты" : "TLS Certificates"}
          </TabsTrigger>
          <TabsTrigger value="dns" className="text-xs">
            {isRu ? "DNS и Домен" : "DNS & Domain"}
          </TabsTrigger>
          <TabsTrigger value="clients" className="text-xs">
            {isRu ? "Клиенты" : "Client Policies"}
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="text-xs">
            {isRu ? "Диагностика" : "Diagnostics"}
          </TabsTrigger>
          <TabsTrigger value="events" className="text-xs">
            {isRu ? "Журнал событий" : "Event History"}
          </TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-mono uppercase text-muted-foreground flex items-center justify-between">
                  <span>{isRu ? "Статус Каптива" : "Captive State"}</span>
                  <Radio className="h-4 w-4 text-emerald-500" />
                </CardDescription>
                <CardTitle className="text-xl font-bold font-mono text-foreground">
                  {status?.enabled ? (isRu ? "АКТИВЕН" : "ACTIVE") : (isRu ? "ОТКЛЮЧЕН" : "DISABLED")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-1.5 mt-1">
                  {getModeBadge(config.mode)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-mono uppercase text-muted-foreground flex items-center justify-between">
                  <span>{isRu ? "HTTP Перехват" : "HTTP Intercept"}</span>
                  <Globe className="h-4 w-4 text-foreground" />
                </CardDescription>
                <CardTitle className="text-xl font-bold font-mono text-foreground">
                  {status?.http_intercept_active ? "PORT 80 -> 8088" : "STANDBY"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-[11px] font-mono text-muted-foreground mt-1">
                  {isRu ? "HTTP 307 Safe Redirects (0 fake certs)" : "HTTP 307 Safe Redirects (Zero MITM)"}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-mono uppercase text-muted-foreground flex items-center justify-between">
                  <span>{isRu ? "TLS Сертификат" : "TLS Certificate"}</span>
                  <Lock className={`h-4 w-4 ${status?.cert_valid ? "text-emerald-500" : "text-amber-500"}`} />
                </CardDescription>
                <CardTitle className="text-xl font-bold font-mono text-foreground">
                  {status?.cert_valid ? `${status.cert_days_left}d remaining` : "NOT CONFIGURED"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-[11px] font-mono text-muted-foreground truncate mt-1">
                  Domain: {config.portal_domain}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-mono uppercase text-muted-foreground flex items-center justify-between">
                  <span>{isRu ? "Клиенты в сети" : "Active Clients"}</span>
                  <Laptop className="h-4 w-4 text-foreground" />
                </CardDescription>
                <CardTitle className="text-xl font-bold font-mono text-foreground">
                  {clients.length} {isRu ? "устройств" : "devices"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-[11px] font-mono text-muted-foreground mt-1">
                  {status?.active_restricted_clients || 0} {isRu ? "ограничены" : "under policy block"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Architecture & Telemetry Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  <span>{isRu ? "Сетевая конфигурация подсистемы" : "Subsystem Telemetry & Endpoints"}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRu ? "Режим работы:" : "Operating Mode:"}</span>
                  <span className="text-foreground font-semibold">{config.mode.toUpperCase()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRu ? "Домен портала:" : "Secure Portal FQDN:"}</span>
                  <span className="text-foreground">{config.portal_domain}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRu ? "RFC 8908 API URL:" : "RFC 8908 Endpoint:"}</span>
                  <a href={`http://192.168.1.1/cgi-bin/captive-portal`} target="_blank" rel="noreferrer" className="text-foreground underline flex items-center gap-1">
                    <span>/cgi-bin/captive-portal</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRu ? "DHCP Option 114:" : "DHCP Option 114:"}</span>
                  <span className={status?.dhcp_opt114_active ? "text-emerald-500 font-semibold" : "text-amber-500"}>
                    {status?.dhcp_opt114_active ? "ENABLED (ADVERTISED)" : "DISABLED"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRu ? "HTTPS Поведение:" : "HTTPS Port 443 Policy:"}</span>
                  <span className="text-emerald-500 font-semibold">TCP RESET (NO MITM / ZERO SSL ERRORS)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">{isRu ? "HTTP Перенаправление:" : "HTTP Port 80 Intercept:"}</span>
                  <span className="text-foreground">NAT &rarr; 192.168.1.2:8088 &rarr; HTTP 307</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card text-card-foreground shadow-sm">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span>{isRu ? "Стандарты безопасности и соответствие" : "Security Standards & Compliance"}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-2.5 text-xs text-foreground/90">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold font-mono">RFC 8952 / 8908:</span> Captive Portal Architecture & API JSON specification implemented natively.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold font-mono">RFC 8910:</span> Captive Portal Identification via DHCPv4 Option 114 and IPv6 RA Option 103.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold font-mono">Zero TLS Interception:</span> Strict prohibition of MITM certificate forging. Blocked HTTPS requests trigger TCP RST without browser certificate alerts.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold font-mono">Anti-Open-Redirect:</span> All redirect locations are validated against local portal origins, stripping CR/LF and XSS injection vectors.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. GENERAL TAB (THREE OPERATING MODES) */}
        <TabsContent value="general" className="space-y-4">
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground">
                    {isRu ? "Режимы работы подсистемы перехвата" : "Subsystem Operating Modes"}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    {isRu
                      ? "Выберите один из трех независимых режимов согласно спецификации безопасности ORBIX"
                      : "Choose between three independently configurable operating modes per ORBIX security specification"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    {config.enabled ? (isRu ? "Включено" : "Enabled") : (isRu ? "Выключено" : "Disabled")}
                  </span>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(val) => updateConfig({ enabled: val })}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Three Mode Selector Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Mode A: Strict */}
                <div
                  onClick={() => updateConfig({ mode: "strict" })}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    config.mode === "strict"
                      ? "border-foreground bg-muted shadow-sm"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">
                      {isRu ? "Режим A — Строгий" : "Mode A — Strict"}
                    </span>
                    {config.mode === "strict" && <CheckCircle2 className="h-4 w-4 text-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {isRu
                      ? "Максимальная безопасность. Трафик блокируется silent drop/reject без перенаправлений. Полный запрет MITM и перехватов."
                      : "Maximum security. Violating traffic is dropped/rejected with no redirects. No TLS MITM, zero client interception."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1 font-mono text-[10px]">
                    <Badge variant="outline" className="border-border">Silent Drop</Badge>
                    <Badge variant="outline" className="border-border">No Popups</Badge>
                  </div>
                </div>

                {/* Mode B: Captive Portal */}
                <div
                  onClick={() => updateConfig({ mode: "captive_portal" })}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    config.mode === "captive_portal"
                      ? "border-foreground bg-muted shadow-sm"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">
                      {isRu ? "Режим B — Каптив-портал" : "Mode B — Captive Portal"}
                    </span>
                    {config.mode === "captive_portal" && <CheckCircle2 className="h-4 w-4 text-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {isRu
                      ? "Стандарт RFC 8908 / 8910. Автоматическое обнаружение ОС через DHCP Opt 114 и IPv6 RA. Открытие системного помощника подключения."
                      : "RFC 8908 / 8910 standards. OS automatic discovery via DHCP Option 114 & RA Option 103. Native sign-in prompt."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1 font-mono text-[10px]">
                    <Badge variant="outline" className="border-border">RFC 8908 API</Badge>
                    <Badge variant="outline" className="border-border">DHCP Opt 114</Badge>
                  </div>
                </div>

                {/* Mode C: HTTP Redirect */}
                <div
                  onClick={() => updateConfig({ mode: "http_redirect" })}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    config.mode === "http_redirect"
                      ? "border-foreground bg-muted shadow-sm"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">
                      {isRu ? "Режим C — HTTP Редирект" : "Mode C — HTTP Redirect"}
                    </span>
                    {config.mode === "http_redirect" && <CheckCircle2 className="h-4 w-4 text-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {isRu
                      ? "Провайдерские страницы ошибок. Перехват незашифрованного HTTP (порт 80) с мгновенным 307 редиректом. Без навязчивых всплывающих окон ОС."
                      : "ISP-style error notifications. Intercepts port 80 HTTP with instant 307 redirect to error portal. No OS captive popups."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1 font-mono text-[10px]">
                    <Badge variant="outline" className="border-border">HTTP 307</Badge>
                    <Badge variant="outline" className="border-border">In-Browser Only</Badge>
                  </div>
                </div>
              </div>

              {/* General Parameters Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {isRu ? "Доменное имя портала (FQDN):" : "Portal Hostname (FQDN):"}
                  </label>
                  <Input
                    value={config.portal_domain}
                    onChange={(e) => updateConfig({ portal_domain: e.target.value })}
                    className="h-8 text-xs font-mono border-border bg-card text-foreground"
                    placeholder="orbix.lan"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {isRu
                      ? "Локальное доменное имя, разрешающееся на IP роутера (192.168.1.1)"
                      : "Local hostname resolving to router LAN IP address (192.168.1.1)"}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {isRu ? "Таймаут сессии (секунды):" : "Captive Session Timeout (seconds):"}
                  </label>
                  <Input
                    type="number"
                    value={config.session_timeout_sec}
                    onChange={(e) => updateConfig({ session_timeout_sec: parseInt(e.target.value, 10) || 3600 })}
                    className="h-8 text-xs font-mono border-border bg-card text-foreground"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {isRu ? "Время действия авторизации или перепроверки политик" : "Authorization lease time or policy re-check window"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. HTTP INTERCEPTION TAB */}
        <TabsContent value="interception" className="space-y-4">
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>{isRu ? "Механизм HTTP Перехвата (Порт 80)" : "HTTP Port 80 Interception Engine"}</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {isRu
                  ? "Перенаправление незашифрованного HTTP трафика на локальный обработчик HTTP 307"
                  : "Redirection of unencrypted HTTP traffic to local uhttpd HTTP 307 redirector"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border border-border">
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    {isRu ? "Включить перехват HTTP TCP 80" : "Enable TCP Port 80 HTTP Interception"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {isRu
                      ? "Применяет nftables правило redirect to :8088 для запрещенных ресурсов"
                      : "Enforces nftables prerouting redirect to :8088 for restricted traffic"}
                  </div>
                </div>
                <Switch
                  checked={config.http_intercept}
                  onCheckedChange={(val) => updateConfig({ http_intercept: val })}
                />
              </div>

              {/* Architecture Alert */}
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>{isRu ? "Архитектура безопасности HTTPS и Порта 443" : "HTTPS Port 443 Security Guarantee"}</span>
                </div>
                <p className="text-muted-foreground leading-relaxed text-[11px]">
                  {isRu
                    ? "В соответствии с требованиями безопасности ORBIX, перехват HTTPS трафика через поддельные сертификаты (MITM) строго запрещен. Заблокированные HTTPS соединения немедленно сбрасываются с TCP RST (`reject with tcp reset`), полностью исключая системные предупреждения `ERR_CERT_AUTHORITY_INVALID`. Одновременно фоновый зонд ОС или браузера обращается по HTTP к captive API и открывает безопасную страницу ошибки."
                    : "Per ORBIX security requirements, transparent HTTPS interception using forged certificates (MITM) is strictly forbidden. Blocked HTTPS connections are terminated immediately with TCP RST (`reject with tcp reset`), completely eliminating browser certificate errors. The client OS captive assistant or browser network probe connects over plain HTTP, receiving the 307 redirect cleanly."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-md bg-muted/30 border border-border space-y-1">
                  <div className="text-muted-foreground">{isRu ? "Входящий порт:" : "Ingress Target:"}</div>
                  <div className="text-foreground font-semibold">TCP 80 (HTTP) &rarr; 192.168.1.2:8088</div>
                </div>
                <div className="p-3 rounded-md bg-muted/30 border border-border space-y-1">
                  <div className="text-muted-foreground">{isRu ? "Ответ сервера:" : "Response Protocol:"}</div>
                  <div className="text-foreground font-semibold">HTTP/1.1 307 Temporary Redirect</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. CAPTIVE API TAB */}
        <TabsContent value="api" className="space-y-4">
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                <span>{isRu ? "RFC 8908 Captive Portal API & RFC 8910" : "RFC 8908 Captive Portal API & RFC 8910 Discovery"}</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {isRu
                  ? "Спецификация API взаимодействия с операционными системами (macOS, iOS, Windows, Android)"
                  : "Standardized API for operating system captive detection and network authorization"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border border-border">
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      {isRu ? "DHCPv4 Option 114" : "DHCPv4 Option 114"}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {isRu ? "Анонсирование API в DHCP-ответах клиентам" : "Advertise Captive API URI via DHCP leases"}
                    </div>
                  </div>
                  <Switch
                    checked={config.dhcp_opt114}
                    onCheckedChange={(val) => updateConfig({ dhcp_opt114: val })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border border-border">
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      {isRu ? "IPv6 RA Option 103" : "IPv6 RA Option 103"}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {isRu ? "Анонсирование через Router Advertisements (odhcpd)" : "Advertise Captive URI via IPv6 Router Advertisements"}
                    </div>
                  </div>
                  <Switch
                    checked={config.ra_opt103}
                    onCheckedChange={(val) => updateConfig({ ra_opt103: val })}
                  />
                </div>
              </div>

              {/* JSON API Schema preview */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {isRu ? "Формат ответа RFC 8908 (application/captive+json):" : "RFC 8908 Response Example (application/captive+json):"}
                </label>
                <pre className="p-3 rounded-md bg-muted/60 border border-border text-[11px] font-mono text-foreground overflow-x-auto">
{`{
  "captive": true,
  "user-portal-url": "http://${config.portal_domain}/#/errors/402",
  "venue-info-url": "http://${config.portal_domain}/",
  "seconds-remaining": ${config.session_timeout_sec},
  "can-extend-session": false
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. TLS CERTIFICATES TAB */}
        <TabsContent value="certs" className="space-y-4">
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    <span>{isRu ? "Управление TLS Сертификатами" : "TLS Certificate Manager"}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    {isRu
                      ? "Сертификаты безопасности для защищенного доступа к порталу без браузерных предупреждений"
                      : "Public ACME DNS-01, User-provided SSL and ORBIX Private CA management"}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadDialogOpen(true)}
                    className="h-8 text-xs font-medium gap-1.5 border-border bg-card text-foreground hover:bg-muted"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{isRu ? "Загрузить SSL" : "Upload SSL"}</span>
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleRenewCert}
                    disabled={isSaving}
                    className="h-8 text-xs font-medium gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isSaving ? "animate-spin" : ""}`} />
                    <span>{isRu ? "Перевыпустить" : "Renew Certificate"}</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Active Certificate Telemetry */}
              <div className="p-3.5 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <Lock className={`h-4 w-4 ${certStatus?.is_valid ? "text-emerald-500" : "text-amber-500"}`} />
                    <span className="text-xs font-semibold text-foreground">
                      {isRu ? "Текущий активный сертификат веб-сервера:" : "Active Web Server Certificate:"}
                    </span>
                  </div>
                  <Badge variant="outline" className={certStatus?.is_valid ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-400 font-mono text-[11px]" : "border-amber-800/60 bg-amber-950/30 text-amber-400 font-mono text-[11px]"}>
                    {certStatus?.is_valid ? (isRu ? "ДЕЙСТВИТЕЛЕН" : "VALID") : (isRu ? "ТРЕБУЕТ ОБНОВЛЕНИЯ" : "ACTION REQUIRED")}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground">{isRu ? "Субъект (Subject): " : "Subject: "}</span>
                    <span className="text-foreground">{certStatus?.subject || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{isRu ? "Издатель (Issuer): " : "Issuer: "}</span>
                    <span className="text-foreground">{certStatus?.issuer || "N/A"}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">{isRu ? "Альтернативные имена (SAN): " : "Subject Alt Names (SAN): "}</span>
                    <span className="text-foreground break-all">{certStatus?.san || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{isRu ? "Дней до истечения: " : "Days Remaining: "}</span>
                    <span className="text-foreground font-semibold">{certStatus?.days_remaining ?? "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{isRu ? "Режим сертификата: " : "Certificate Mode: "}</span>
                    <span className="text-foreground">{config.cert_mode.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {/* Mode Architecture Description */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="p-3 rounded-md bg-muted/30 border border-border space-y-1">
                  <div className="text-xs font-semibold text-foreground">1. Public ACME (DNS-01)</div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    {isRu
                      ? "Автоматический выпуск доверенного Let's Encrypt через DNS-01 без открытия портов роутера наружу."
                      : "Automated Let's Encrypt issuance via DNS-01 validation. Zero public ports exposed to WAN."}
                  </div>
                </div>

                <div className="p-3 rounded-md bg-muted/30 border border-border space-y-1">
                  <div className="text-xs font-semibold text-foreground">2. Custom SSL Upload</div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    {isRu
                      ? "Загрузка собственного сертификата и приватного ключа с автоматической проверкой формата."
                      : "Upload your existing corporate certificate and private key with atomic verification."}
                  </div>
                </div>

                <div className="p-3 rounded-md bg-muted/30 border border-border space-y-1">
                  <div className="text-xs font-semibold text-foreground">3. ORBIX Private CA</div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    {isRu
                      ? "Локальный корневой CA. Требует однократной установки корневого сертификата на устройства."
                      : "Local Private CA. Requires one-time root CA certificate install on client devices."}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. DNS & DOMAIN TAB */}
        <TabsContent value="dns" className="space-y-4">
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Network className="h-4 w-4" />
                <span>{isRu ? "Локальный DNS и Домен Портала" : "Local DNS & Split-Horizon Resolution"}</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {isRu
                  ? "Разрешение доменного имени портала на локальный адрес роутера даже при отсутствии интернета"
                  : "Guaranteed local portal name resolution regardless of upstream WAN availability"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="p-3 rounded-md bg-muted/40 border border-border text-xs space-y-2">
                <div className="font-semibold text-foreground">
                  {isRu ? "Автоматическое сопоставление записей:" : "Configured Host Records in dnsmasq:"}
                </div>
                <div className="font-mono text-[11px] space-y-1 text-muted-foreground">
                  <div>192.168.1.1 &rarr; {config.portal_domain} (Primary LAN Host)</div>
                  <div>192.168.1.1 &rarr; openwrt.lan</div>
                  <div>192.168.1.2 &rarr; orbix-sinkhole.lan (Sinkhole Alias for HTTP 307 Redirection)</div>
                </div>
              </div>

              <div className="p-3 rounded-md border border-border bg-card text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground">
                  {isRu ? "Защита от блокировки собственного домена:" : "Self-Domain Whitelisting:"}
                </div>
                <div>
                  {isRu
                    ? "Домен портала автоматически исключается из любых черных списков и категорий Adblock / DNS-фильтрации."
                    : "The portal domain is permanently whitelisted from DNS filters and content categories to guarantee Zero-Lockout."}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. CLIENT POLICIES TAB */}
        <TabsContent value="clients" className="space-y-4">
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Laptop className="h-4 w-4" />
                    <span>{isRu ? "Подключенные устройства и каптив-статус" : "Connected LAN Clients & Captive Status"}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    {isRu
                      ? "Список активных устройств, их текущий статус доступа и управление исключениями"
                      : "Live client devices, access states, restriction reasons and exemption controls"}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshClients}
                  className="h-8 text-xs font-medium gap-1.5 border-border bg-card text-foreground hover:bg-muted"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{isRu ? "Обновить" : "Refresh"}</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs font-mono">{isRu ? "IP Адрес" : "IP Address"}</TableHead>
                      <TableHead className="text-xs font-mono">{isRu ? "MAC / Имя хоста" : "MAC / Hostname"}</TableHead>
                      <TableHead className="text-xs font-mono">{isRu ? "Интерфейс" : "Interface"}</TableHead>
                      <TableHead className="text-xs font-mono">{isRu ? "Состояние" : "Captive State"}</TableHead>
                      <TableHead className="text-xs font-mono">{isRu ? "Причина" : "Restriction Reason"}</TableHead>
                      <TableHead className="text-xs font-mono text-right">{isRu ? "Действие" : "Action"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                          {isRu ? "Нет обнаруженных клиентов на br-lan" : "No active clients found on br-lan"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      clients.map((c) => (
                        <TableRow key={c.ip} className="border-border text-xs font-mono">
                          <TableCell className="font-semibold text-foreground">{c.ip}</TableCell>
                          <TableCell>
                            <div className="text-foreground">{c.hostname || "Device"}</div>
                            <div className="text-[10px] text-muted-foreground">{c.mac}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{c.interface}</TableCell>
                          <TableCell>{getClientStateBadge(c.state)}</TableCell>
                          <TableCell className="text-muted-foreground text-[11px]">{c.reason}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleClientExemption(c.ip)}
                              className={`h-7 px-2.5 text-[11px] font-mono border-border ${
                                c.is_exempt ? "bg-muted text-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {c.is_exempt ? (isRu ? "Снять исключение" : "Revoke Exemption") : (isRu ? "Исключить" : "Exempt Client")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 8. DIAGNOSTICS TAB */}
        <TabsContent value="diagnostics" className="space-y-4">
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    <span>{isRu ? "Комплексная сетевая диагностика (12 проверок)" : "Comprehensive Network Diagnostics (12 Checks)"}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    {isRu
                      ? "Автоматический аудит доступности портов, TLS сертификатов, DHCP Opt 114 и правил файрвола"
                      : "Automated verification of portal ports, certificate SANs, DHCP discovery and firewall rules"}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={runDiagnostics}
                  disabled={isRunningDiagnostics}
                  className="h-8 text-xs font-medium gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRunningDiagnostics ? "animate-spin" : ""}`} />
                  <span>{isRunningDiagnostics ? (isRu ? "Проверка..." : "Running...") : (isRu ? "Запустить тест" : "Run Diagnostics")}</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-2">
              <div className="space-y-2">
                {diagnostics.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    {isRu ? "Нажмите «Запустить тест» для выполнения полной диагностики" : "Click 'Run Diagnostics' to execute all 12 system checks"}
                  </div>
                ) : (
                  diagnostics.map((chk) => (
                    <div
                      key={chk.id}
                      className="p-3 rounded-md border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{chk.name}</span>
                          <Badge
                            variant="outline"
                            className={`font-mono text-[10px] ${
                              chk.status === "pass"
                                ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-400"
                                : chk.status === "warn"
                                ? "border-amber-800/60 bg-amber-950/30 text-amber-400"
                                : "border-red-800/60 bg-red-950/30 text-red-400"
                            }`}
                          >
                            {chk.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground">{chk.details}</div>
                      </div>

                      {chk.remediation && chk.status !== "pass" && (
                        <div className="text-[11px] text-amber-500 font-mono bg-amber-950/20 px-2 py-1 rounded border border-amber-800/30 shrink-0">
                          {chk.remediation}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 9. EVENT HISTORY TAB */}
        <TabsContent value="events" className="space-y-4">
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{isRu ? "Журнал каптив-событий и перенаправлений" : "Captive Event & Redirection History"}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    {isRu ? "Аудиторский след перехватов, API запросов и изменений статуса" : "Audit trail of network redirections and client status transitions"}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearEvents}
                  className="h-8 text-xs font-medium border-border bg-card text-muted-foreground hover:text-foreground"
                >
                  {isRu ? "Очистить" : "Clear History"}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-2">
              <div className="space-y-2">
                {events.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    {isRu ? "Журнал событий пуст" : "No captive events recorded"}
                  </div>
                ) : (
                  events.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-md border border-border bg-card flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2.5">
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                          {ev.type.toUpperCase()}
                        </Badge>
                        <span className="text-foreground">{ev.details}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload SSL Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {isRu ? "Загрузка TLS Сертификата" : "Upload Custom TLS Certificate"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isRu
                ? "Вставьте PEM-сертификат и соответствующий приватный ключ для установки в uhttpd"
                : "Paste PEM certificate and matching private key to deploy atomically to uhttpd"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">
                {isRu ? "Доменное имя:" : "Domain Name:"}
              </label>
              <Input
                value={uploadDomain}
                onChange={(e) => setUploadDomain(e.target.value)}
                className="h-8 text-xs font-mono border-border bg-card"
                placeholder="orbix.lan"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">
                {isRu ? "Сертификат (PEM):" : "Certificate (PEM):"}
              </label>
              <textarea
                value={uploadCertPem}
                onChange={(e) => setUploadCertPem(e.target.value)}
                className="w-full h-24 p-2 text-[11px] font-mono rounded-md border border-border bg-muted/40 text-foreground resize-none"
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">
                {isRu ? "Приватный ключ (PEM):" : "Private Key (PEM):"}
              </label>
              <textarea
                value={uploadKeyPem}
                onChange={(e) => setUploadKeyPem(e.target.value)}
                className="w-full h-24 p-2 text-[11px] font-mono rounded-md border border-border bg-muted/40 text-foreground resize-none"
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadDialogOpen(false)}
              className="text-xs border-border bg-card"
            >
              {isRu ? "Отмена" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleUploadCertSubmit}
              disabled={!uploadCertPem.trim() || !uploadKeyPem.trim()}
              className="text-xs bg-foreground text-background hover:bg-foreground/90"
            >
              {isRu ? "Установить сертификат" : "Install Certificate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
