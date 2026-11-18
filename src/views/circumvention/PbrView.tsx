import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Network,
  Search,
  Plus,
  Trash2,
  ArrowRight,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { PbrRule } from "@/types/ubus";
import { DeviceRoutingTable } from "@/components/pbr/DeviceRoutingTable";

export const PbrView: React.FC = () => {
  const { t, lang } = useI18nStore();
  const queryClient = useQueryClient();
  const { data: pbrRulesData } = useQuery({
    queryKey: ["pbr-rules"],
    queryFn: () => ubusClient.getPbrRules(),
  });

  const [rules, setRules] = useState<PbrRule[]>(pbrRulesData || []);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);

  React.useEffect(() => {
    if (pbrRulesData) {
      setRules(pbrRulesData);
    }
  }, [pbrRulesData]);

  const showFeedback = (text: string, error = false) => {
    setFeedback({ text, error });
    setTimeout(() => setFeedback(null), 6000);
  };

  const [traceTarget, setTraceTarget] = useState("youtube.com");
  const [traceResult, setTraceResult] = useState<{
    target: string;
    ip: string;
    rule: string;
    interface: string;
    nexthop?: string;
  } | null>(null);
  const [isTracing, setIsTracing] = useState(false);

  // New rule dialog state
  const [newRuleName, setNewRuleName] = useState("");
  const [newDestAddr, setNewDestAddr] = useState("");
  const [newInterface, setNewInterface] = useState("zapret");
  const [isAdding, setIsAdding] = useState(false);

  const handleTraceRoute = async () => {
    if (!traceTarget.trim()) return;
    setIsTracing(true);
    try {
      const res = await ubusClient.traceRoute(traceTarget.trim());
      setTraceResult(res);
    } catch {
      alert(lang === "ru" ? "Ошибка трассировки маршрута" : "Trace failed");
    } finally {
      setIsTracing(false);
    }
  };

  // Backend returns the committed section id as rule.id - toggling/deleting hits the real config
  const handleToggleRule = async (rule: PbrRule) => {
    setBusyRuleId(rule.id);
    try {
      await ubusClient.upsertPbrRule({
        id: rule.id,
        name: rule.name,
        enabled: !rule.enabled,
        interface: rule.interface,
        src_addr: rule.src_addr,
        dest_addr: rule.dest_addr,
        proto: rule.proto,
      });
      queryClient.invalidateQueries({ queryKey: ["pbr-rules"] });
      showFeedback(
        !rule.enabled
          ? (lang === "ru" ? "Правило включено и применено (pbr reload)" : "Rule enabled and applied (pbr reload)")
          : (lang === "ru" ? "Правило отключено и применено (pbr reload)" : "Rule disabled and applied (pbr reload)")
      );
    } catch (e: any) {
      showFeedback((lang === "ru" ? "ОШИБКА: правило НЕ изменено на роутере: " : "ERROR: rule NOT changed on router: ") + (e?.message || String(e)), true);
    } finally {
      setBusyRuleId(null);
    }
  };

  const handleDeleteRule = async (rule: PbrRule) => {
    setBusyRuleId(rule.id);
    try {
      await ubusClient.deletePbrRule(rule.id);
      queryClient.invalidateQueries({ queryKey: ["pbr-rules"] });
      showFeedback(lang === "ru" ? "Правило удалено с роутера" : "Rule deleted from the router");
    } catch (e: any) {
      showFeedback((lang === "ru" ? "ОШИБКА: правило НЕ удалено: " : "ERROR: rule NOT deleted: ") + (e?.message || String(e)), true);
    } finally {
      setBusyRuleId(null);
    }
  };

  const handleAddRule = async () => {
    if (!newRuleName.trim() || !newDestAddr.trim()) {
      alert(lang === "ru" ? "Пожалуйста, укажите название правила и целевые домены/IP" : "Please fill in Rule Name and Target Domains/IPs");
      return;
    }

    // Section-safe id: ASCII slug from the name, fall back to a timestamp
    const slug = newRuleName.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
    const sectionId = slug || `rule-${Date.now()}`;

    setIsAdding(true);
    try {
      const res = await ubusClient.upsertPbrRule({
        id: sectionId,
        name: newRuleName.trim(),
        enabled: true,
        interface: newInterface,
        dest_addr: newDestAddr.trim(),
        proto: "tcp udp",
      });
      setNewRuleName("");
      setNewDestAddr("");
      queryClient.invalidateQueries({ queryKey: ["pbr-rules"] });
      if (res.applied) {
        showFeedback(lang === "ru" ? "Правило сохранено в /etc/config/pbr и служба pbr перезагружена" : "Rule saved to /etc/config/pbr and pbr service reloaded");
      } else {
        showFeedback(
          (lang === "ru"
            ? "Правило сохранено в UCI, но служба pbr НЕ перезагрузилась (код " + res.reload_code + "). Проверьте /etc/config/pbr"
            : "Rule saved to UCI, but the pbr service did NOT reload (code " + res.reload_code + "). Check /etc/config/pbr"),
          true
        );
      }
    } catch (e: any) {
      showFeedback((lang === "ru" ? "ОШИБКА: правило НЕ сохранено на роутере: " : "ERROR: rule NOT saved on the router: ") + (e?.message || String(e)), true);
    } finally {
      setIsAdding(false);
    }
  };

  const getInterfaceBadge = (iface: string) => {
    switch (iface) {
      case "zapret":
        return (
          <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-300 font-mono text-[10px] flex items-center gap-1 shadow-sm">
            <Zap className="h-3 w-3 text-zinc-400" />
            <span>Zapret (DPI Bypass)</span>
          </Badge>
        );
      case "singbox":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-mono text-[10px]">VLESS Sing-box</Badge>;
      case "awg0":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[10px]">AmneziaWG (awg0)</Badge>;
      case "wan":
        return <Badge variant="outline" className="font-mono text-[10px]">{t.pbr.wanOption}</Badge>;
      case "drop":
        return <Badge variant="destructive" className="font-mono text-[10px]">{t.pbr.dropOption}</Badge>;
      default:
        return <Badge variant="secondary" className="font-mono text-[10px]">{iface}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">{t.pbr.title}</h2>
          <p className="text-xs text-muted-foreground">{t.pbr.subtitle}</p>
        </div>
      </div>

      {/* Zapret DPI Bypass Integration Notice */}
      <div className="flex items-start sm:items-center gap-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 text-xs shadow-sm">
        <Zap className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5 sm:mt-0" />
        <div className="space-y-0.5">
          <span className="font-semibold text-zinc-200">{t.pbr.zapretBannerTitle}: </span>
          <span className="text-zinc-400">{t.pbr.zapretBannerDesc}</span>
        </div>
      </div>

      {/* Interactive Route Checker Tool */}
      <Card className="border-zinc-800 bg-zinc-900/50 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
            <Search className="h-4 w-4 text-zinc-400" />
            <span>{t.pbr.routeCheckerTitle}</span>
          </CardTitle>
          <CardDescription className="text-[11px] text-zinc-500">
            {t.pbr.routeCheckerDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="flex gap-2 max-w-xl">
            <Input
              value={traceTarget}
              onChange={(e) => setTraceTarget(e.target.value)}
              placeholder={t.pbr.inputPlaceholder}
              className="h-8 text-xs font-mono bg-zinc-950 border-zinc-800 text-zinc-200"
              onKeyDown={(e) => e.key === "Enter" && handleTraceRoute()}
            />
            <Button
              variant="default"
              size="sm"
              onClick={handleTraceRoute}
              disabled={isTracing}
              className="h-8 text-xs px-3 bg-zinc-100 text-zinc-950 hover:bg-white font-medium shadow-sm"
            >
              {isTracing ? t.pbr.tracing : t.pbr.traceButton}
            </Button>
          </div>

          {traceResult && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 space-y-2 text-xs font-mono animate-in fade-in-50">
              <div className="text-[11px] text-zinc-400 font-sans font-medium flex items-center gap-1.5 border-b border-zinc-800 pb-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>{t.pbr.resolutionFor}: <strong className="text-zinc-100">{traceResult.target}</strong></span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase">{t.pbr.resolvedIp}</span>
                  <span className="text-zinc-300 font-bold">{traceResult.ip}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase">{t.pbr.matchedRule}</span>
                  <span className="text-zinc-300 truncate block">{traceResult.rule}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase">{t.pbr.outboundGateway}</span>
                  <span className="text-emerald-400 font-bold">{traceResult.interface}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase">{t.pbr.nextHop}</span>
                  <span className="text-zinc-400">{traceResult.nexthop || "-"}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Real write-operation feedback (only shown after an actual router call) */}
      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            feedback.error
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Per-Device Policy Routing Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Network className="h-4 w-4 text-zinc-400" />
              {lang === "ru" ? "Маршрутизация по устройствам (LAN / Wi-Fi)" : "Per-Device Policy Routing (LAN / Wi-Fi)"}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {lang === "ru"
                ? "Привязка трафика конкретных устройств к туннелям (Sing-box, AWG, Zapret2, Прямой WAN) с фиксацией статической DHCP-аренды"
                : "Assign specific LAN / Wi-Fi devices to tunnels with automatic DHCP static lease pinning"}
            </p>
          </div>
        </div>
        <DeviceRoutingTable />
      </div>

      {/* Rules Table */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              <span>{t.pbr.policiesTitle}</span>
            </CardTitle>
            <Badge variant="outline" className="font-mono text-xs">{rules.length} {t.pbr.policiesActive}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Add Rule Form */}
          <div className="grid gap-3 sm:grid-cols-4 p-3 rounded-lg border bg-card/40">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">{t.pbr.ruleName}</span>
              <Input
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                placeholder={lang === "ru" ? "Например, Обход DPI YouTube" : "e.g. YouTube DPI Bypass"}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <span className="text-[11px] text-muted-foreground">{t.pbr.destDomains}</span>
              <Input
                value={newDestAddr}
                onChange={(e) => setNewDestAddr(e.target.value)}
                placeholder={lang === "ru" ? "Например, rutracker.org или 1.2.3.4" : "e.g. rutracker.org or 1.2.3.4"}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">{t.pbr.targetOutbound}</span>
              <div className="flex gap-2">
                <select
                  value={newInterface}
                  onChange={(e) => setNewInterface(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background/50 px-2 text-xs font-mono"
                >
                  <option value="zapret">{t.pbr.zapretOption}</option>
                  <option value="singbox">{t.pbr.singboxOption}</option>
                  <option value="awg0">{t.pbr.awgOption}</option>
                  <option value="wan">{t.pbr.wanOption}</option>
                  <option value="drop">{t.pbr.dropOption}</option>
                </select>
                <Button variant="default" size="sm" onClick={handleAddRule} disabled={isAdding} className="h-8 text-xs px-3">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card/60 hover:bg-card transition-colors gap-3"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={rule.enabled}
                    disabled={busyRuleId === rule.id}
                    onCheckedChange={() => handleToggleRule(rule)}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{rule.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">({rule.proto || "all"})</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate max-w-md">
                      {rule.dest_addr || (rule.src_addr ? `Source: ${rule.src_addr}` : "All Traffic")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    {getInterfaceBadge(rule.interface)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busyRuleId === rule.id}
                    onClick={() => handleDeleteRule(rule)}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
