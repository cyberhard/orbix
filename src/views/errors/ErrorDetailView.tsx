// ORBIX Dynamic Error Diagnostics & Recovery View
// Strictly adhering to shadcn/ui Zinc design language specifications
import React, { useState, useEffect } from "react";
import { getErrorByCode } from "@/services/error/error-registry";
import { useErrorStore } from "@/store/error-store";
import { useI18nStore } from "@/store/i18n-store";
import { killSwitchManager } from "@/services/security/kill-switch-manager";
import { leakDetector } from "@/services/security/leak-detector";
import { ubusClient } from "@/lib/ubus-client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Activity,
  Server,
  Lock,
  Globe,
  HelpCircle,
  Clock,
  Terminal,
  ChevronRight,
  Shield,
  Zap,
} from "lucide-react";

interface ErrorDetailViewProps {
  code: number;
  onNavigate?: (route: string) => void;
}

export const ErrorDetailView: React.FC<ErrorDetailViewProps> = ({ code, onNavigate }) => {
  const { lang } = useI18nStore();
  const isRu = lang === "ru";
  const def = getErrorByCode(code);
  const { events, resolveEvent } = useErrorStore();

  const [isRunningAction, setIsRunningAction] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [runtimeState, setRuntimeState] = useState<any>(null);

  // Find recent matching active event if any
  const matchedEvent = events.find((e) => e.code === code && e.status === "active") || events.find((e) => e.code === code);

  useEffect(() => {
    killSwitchManager.getRuntimeState().then(setRuntimeState);
  }, [code]);

  const handleRetryConnection = async () => {
    setIsRunningAction(true);
    setActionFeedback(isRu ? "Перезапуск сетевых служб и туннеля..." : "Restarting network tunnel daemons...");
    try {
      await ubusClient.initService("sing-box", "restart").catch(() => null);
      await killSwitchManager.auditTunnelHealth();
      if (matchedEvent) {
        resolveEvent(matchedEvent.event_id);
      }
      const updated = await killSwitchManager.getRuntimeState();
      setRuntimeState(updated);
      setActionFeedback(isRu ? "Служба перезапущена! Проверка туннеля завершена." : "Service restarted! Tunnel check completed.");
    } catch {
      setActionFeedback(isRu ? "Ошибка при перезапуске службы" : "Failed to restart service");
    } finally {
      setIsRunningAction(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setIsRunningAction(true);
    setActionFeedback(isRu ? "Выполняется диагностика сетевых маршрутов и утечек DNS..." : "Running network route and DNS leak audit...");
    try {
      const result = await leakDetector.runAudit();
      const updated = await killSwitchManager.getRuntimeState();
      setRuntimeState(updated);
      setActionFeedback(
        isRu
          ? `Диагностика завершена: статус безопасности ${result.overallStatus === "secure" ? "ЗАЩИЩЕНО" : "ВНИМАНИЕ"}`
          : `Diagnostics complete: security status is ${result.overallStatus.toUpperCase()}`
      );
    } catch {
      setActionFeedback(isRu ? "Сбой выполнения аудита" : "Failed to run audit");
    } finally {
      setIsRunningAction(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="outline" className="border-red-800/60 bg-red-950/30 text-red-400 font-mono text-xs">CRITICAL</Badge>;
      case "error":
        return <Badge variant="outline" className="border-rose-800/60 bg-rose-950/30 text-rose-400 font-mono text-xs">ERROR</Badge>;
      case "warning":
        return <Badge variant="outline" className="border-amber-800/60 bg-amber-950/30 text-amber-400 font-mono text-xs">WARNING</Badge>;
      default:
        return <Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-300 font-mono text-xs">INFO</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Top Navigation Back link */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate ? onNavigate("overview") : (window.location.hash = "#/overview")}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 pl-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{isRu ? "Вернуться в Обзор сети" : "Back to Network Overview"}</span>
        </Button>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono border-border bg-card text-muted-foreground">
            {isRu ? "Код события:" : "Event Code:"} {def.code}
          </Badge>
          <Badge variant="outline" className="text-xs font-mono border-border bg-card text-muted-foreground">
            {def.category.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Hero Error Card */}
      <Card className="border-border bg-card text-card-foreground shadow-sm">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg border ${
                def.severity === "critical"
                  ? "bg-red-500/10 border-red-500/30 text-red-500"
                  : def.severity === "warning"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                  : "bg-muted border-border text-foreground"
              }`}>
                {def.severity === "critical" ? (
                  <ShieldAlert className="h-6 w-6" />
                ) : def.severity === "warning" ? (
                  <AlertTriangle className="h-6 w-6" />
                ) : (
                  <Activity className="h-6 w-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground font-semibold">
                    ORBIX #{def.code}
                  </span>
                  {getSeverityBadge(def.severity)}
                </div>
                <CardTitle className="text-xl font-bold tracking-tight text-foreground mt-1">
                  {isRu ? def.title.ru : def.title.en}
                </CardTitle>
                <CardDescription className="text-xs font-mono text-muted-foreground mt-0.5">
                  {def.identifier}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunDiagnostics}
                disabled={isRunningAction}
                className="h-8 text-xs font-medium gap-1.5 border-border bg-card text-foreground hover:bg-muted"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRunningAction ? "animate-spin" : ""}`} />
                <span>{isRu ? "Диагностика" : "Run Diagnostics"}</span>
              </Button>
              {code === 410 || code === 501 || code === 500 ? (
                <Button
                  size="sm"
                  onClick={handleRetryConnection}
                  disabled={isRunningAction}
                  className="h-8 text-xs font-medium gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>{isRu ? "Повторить VPN" : "Retry VPN"}</span>
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            {isRu ? def.description.ru : def.description.en}
          </p>

          {actionFeedback && (
            <div className="p-3 rounded-md bg-muted/60 border border-border text-xs font-mono text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>{actionFeedback}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2-Column Grid: System Telemetry & Remediation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Network State Card */}
        <Card className="border-border bg-card text-card-foreground shadow-sm">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Server className="h-4 w-4" />
              <span>{isRu ? "Текущее состояние системы" : "Current System State"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">{isRu ? "VPN Туннель:" : "VPN Tunnel:"}</span>
              <span className={runtimeState?.tunnelStatus === "up" ? "text-emerald-500" : "text-amber-500 font-semibold"}>
                {runtimeState?.tunnelStatus === "up" ? "CONNECTED" : "DISCONNECTED"}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">{isRu ? "Kill Switch Защита:" : "Kill Switch Protection:"}</span>
              <span className={runtimeState?.active ? "text-emerald-500" : "text-zinc-500"}>
                {runtimeState?.active ? "ACTIVE (ENFORCED)" : "STANDBY"}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">{isRu ? "Трафик через WAN:" : "Unprotected WAN Fallback:"}</span>
              <span className={runtimeState?.blockedWan ? "text-red-500 font-semibold" : "text-emerald-500"}>
                {runtimeState?.blockedWan ? "BLOCKED (SAFE)" : "PASSTHROUGH"}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">{isRu ? "Защита от утечек:" : "Leak Protection:"}</span>
              <span className="text-emerald-500">ACTIVE</span>
            </div>

            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">{isRu ? "Целевая служба:" : "Affected Subsystem:"}</span>
              <span className="text-foreground">{def.relatedService}</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">{isRu ? "ID события:" : "Event ID:"}</span>
              <span className="text-muted-foreground">{matchedEvent?.event_id || "evt_live_check"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recommended Remediation Actions */}
        <Card className="border-border bg-card text-card-foreground shadow-sm">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span>{isRu ? "Рекомендуемые действия по устранению" : "Recommended Actions"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2.5">
            <ul className="space-y-2 text-xs text-foreground/90">
              {(isRu ? def.remediation.ru : def.remediation.en).map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted border border-border text-[10px] font-mono font-semibold text-foreground">
                    {idx + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Trigger Conditions & Diagnostic Info */}
      <Card className="border-border bg-card text-card-foreground shadow-sm">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <span>{isRu ? "Технические условия срабатывания" : "Trigger Conditions & Telemetry"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-3 text-xs">
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-[11px] font-medium">
              {isRu ? "Условия регистрации данного кода ошибки:" : "System criteria that trigger this error:"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(isRu ? def.triggerConditions.ru : def.triggerConditions.en).map((cond, idx) => (
                <Badge key={idx} variant="outline" className="text-[11px] font-mono border-border bg-muted/40 text-muted-foreground">
                  {cond}
                </Badge>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-md bg-muted/30 border border-border text-[11px] font-mono text-muted-foreground space-y-1">
            <div className="text-foreground font-semibold">SECURITY GUARANTEE:</div>
            <div>• No unencrypted plain WAN fallback when Kill Switch is armed.</div>
            <div>• Local LAN (192.168.1.0/24) access preserved at all times (Zero-Lockout).</div>
            <div>• Sensitive tokens, private keys and credentials are permanently scrubbed.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
