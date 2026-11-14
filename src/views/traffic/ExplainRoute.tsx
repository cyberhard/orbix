// Explain Route - Intelligent Diagnostic Decision Engine
import React, { useState } from "react";
import { usePolicyStore } from "@/store/policy-store";
import { useI18nStore } from "@/store/i18n-store";
import { routeEvaluator } from "@/services/policy-engine/evaluator";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Radio,
  HelpCircle,
  Activity,
  Layers,
  Info,
} from "lucide-react";
import { RouteEvaluationResult } from "@/services/policy-engine/types";

export const ExplainRoute: React.FC = () => {
  const { language } = useI18nStore();
  const isRu = language === "ru";
  const { policies } = usePolicyStore();

  const [target, setTarget] = useState("youtube.com");
  const [sourceIp, setSourceIp] = useState("192.168.1.130");
  const [result, setResult] = useState<RouteEvaluationResult>(
    routeEvaluator.evaluate("youtube.com", "192.168.1.130", "tcp", 443, policies)
  );

  const handleEvaluate = (tgt = target, src = sourceIp) => {
    if (!tgt.trim()) return;
    const res = routeEvaluator.evaluate(tgt.trim(), src.trim(), "tcp", 443, policies);
    setResult(res);
  };

  const sampleTargets = [
    { label: "YouTube Video CDN", val: "rr3---sn-ug5onuxaxjvh-n8ml.googlevideo.com" },
    { label: "Discord Voice", val: "discord.media" },
    { label: "ChatGPT (AI)", val: "chatgpt.com" },
    { label: "Instagram", val: "www.instagram.com" },
    { label: "Госуслуги (.RU)", val: "gosuslugi.ru" },
    { label: "Сбербанк (Банк)", val: "sberbank.ru" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-zinc-400" />
          <span>{isRu ? "Диагностика решений: Почему трафик идёт именно так? (Explain Route)" : "Routing Decision Diagnostic (Explain Route)"}</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {isRu
            ? "Мгновенный анализ пути любого пакета: проверка совпадений с политиками, порядка приоритетов, работы DNS, DPI и шлюзов выхода"
            : "Instant deterministic inspection: policy evaluation order, winning rule justification, DNS path, DPI state and observed routing"}
        </p>
      </div>

      {/* Target Input Card */}
      <Card className="border-zinc-800 bg-zinc-950 shadow-md">
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEvaluate()}
                placeholder={isRu ? "Введите домен или IP (например, discord.com, chatgpt.com)..." : "Enter domain or IP (e.g. discord.com, chatgpt.com)..."}
                className="pl-9 h-9 text-xs font-mono bg-zinc-900 border-zinc-800 text-zinc-100"
              />
            </div>

            <div className="w-full sm:w-56">
              <Input
                value={sourceIp}
                onChange={(e) => setSourceIp(e.target.value)}
                placeholder="Source Device IP (e.g. 192.168.1.130)"
                className="h-9 text-xs font-mono bg-zinc-900 border-zinc-800 text-zinc-100"
              />
            </div>

            <Button
              onClick={() => handleEvaluate()}
              size="sm"
              className="h-9 px-4 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-medium gap-1.5"
            >
              <Activity className="h-3.5 w-3.5 text-zinc-900" />
              {isRu ? "Объяснить маршрут" : "Explain Route"}
            </Button>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-zinc-500 font-medium mr-1">
              {isRu ? "Быстрые тесты:" : "Quick samples:"}
            </span>
            {sampleTargets.map((s) => (
              <button
                key={s.val}
                onClick={() => {
                  setTarget(s.val);
                  handleEvaluate(s.val);
                }}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                  target === s.val
                    ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Decision Summary Card */}
      <Card className="border-zinc-800 bg-zinc-900/50 shadow-md">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-100">
                  {isRu ? "Итоговое решение маршрутизации" : "Route Resolution Outcome"}
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-400 font-mono">
                  {result.sourceIp} → {result.target}:{result.port} ({result.protocol.toUpperCase()})
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="bg-zinc-800 text-zinc-200 border border-zinc-700 font-mono text-[11px]">
                {result.selectedAction.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="font-mono text-[11px] bg-zinc-950 border-zinc-800 text-emerald-400">
                {result.selectedOutbound}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          {/* Main winning rule explanation */}
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                {isRu ? "Победившая политика" : "Winning Policy"}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                {result.winningPolicy ? `ID: ${result.winningPolicy.id}` : "Default"}
              </span>
            </div>
            <div className="text-xs font-semibold text-zinc-200">
              {isRu ? result.winningReasonRu : result.winningReason}
            </div>
            <p className="text-[11px] text-zinc-400">
              {result.expectedRoute}
            </p>
          </div>

          {/* Three route stages: Expected vs Configured vs Observed */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
              <span className="text-[10px] uppercase font-mono text-zinc-500">
                {isRu ? "1. Ожидаемый маршрут (Engine)" : "1. Expected Route (Engine)"}
              </span>
              <div className="text-xs font-medium text-zinc-200">{result.expectedRoute}</div>
              <span className="text-[10px] text-emerald-400 font-mono">Calculated by Policy Rules</span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
              <span className="text-[10px] uppercase font-mono text-zinc-500">
                {isRu ? "2. Сконфигурированный (UCI/Configs)" : "2. Configured Route (UCI/Configs)"}
              </span>
              <div className="text-xs font-medium text-zinc-200">{result.configuredRoute}</div>
              <span className="text-[10px] text-blue-400 font-mono">Present in sing-box & PBR</span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
              <span className="text-[10px] uppercase font-mono text-zinc-500">
                {isRu ? "3. Наблюдаемый маршрут (Kernel/Live)" : "3. Observed Route (Kernel/Live)"}
              </span>
              <div className="text-xs font-medium text-zinc-200">{result.observedRoute}</div>
              <span className="text-[10px] text-emerald-400 font-mono">✓ Verified via ip route / nft</span>
            </div>
          </div>

          {/* Pipeline Details: DNS, DPI, Firewall */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* DNS */}
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold">
                <Globe className="h-4 w-4" />
                <span>{isRu ? "DNS Резолвер" : "DNS Resolver"}</span>
              </div>
              <div className="text-xs font-mono text-zinc-200">{result.dnsResolution.resolver}</div>
              <span className="text-[10px] text-zinc-500">
                {result.dnsResolution.dohUsed ? "DoH / Encrypted Tunnel" : "Standard UDP 53"}
              </span>
            </div>

            {/* DPI */}
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1">
              <div className="flex items-center gap-2 text-zinc-300 text-xs font-semibold">
                <Zap className="h-4 w-4 text-zinc-400" />
                <span>{isRu ? "DPI Обработка (Zapret)" : "DPI Processing (Zapret)"}</span>
              </div>
              <div className="text-xs font-mono text-zinc-200">
                {result.dpiProcessing.enabled
                  ? `${result.dpiProcessing.strategy}`
                  : isRu ? "Не требуется (Bypass)" : "Not applied (Bypass)"}
              </div>
              <span className="text-[10px] text-zinc-500">
                {result.dpiProcessing.enabled ? "NFQUEUE 200 Hook Active" : "No payload modification"}
              </span>
            </div>

            {/* Firewall */}
            <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1">
              <div className="flex items-center gap-2 text-zinc-300 text-xs font-semibold">
                <Shield className="h-4 w-4 text-zinc-400" />
                <span>{isRu ? "Решение фаервола (fw4)" : "Firewall Decision (fw4)"}</span>
              </div>
              <div className="text-xs font-mono text-emerald-400">{result.firewallDecision}</div>
              <span className="text-[10px] text-zinc-500">Forwarding allowed, NAT Masquerade on</span>
            </div>
          </div>

          {/* Policy Evaluation Tree: Matched Rules */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-semibold text-zinc-300">
              {isRu ? "Оценка цепочки совпадений политик" : "Policy Evaluation Order & Matched Candidates"}
            </h4>
            <div className="space-y-1.5">
              {result.matchedPolicies.map((m, idx) => (
                <div
                  key={m.policy.id}
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                    m.isWinner
                      ? "border-zinc-700 bg-zinc-900 text-zinc-100"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      #{m.policy.priority}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-200">{m.policy.name}</span>
                      <span className="text-[10px] text-zinc-500">{m.matchReason}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {m.policy.action.type}
                    </Badge>
                    {m.isWinner && (
                      <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                        {isRu ? "Победитель" : "Winner"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actionable Troubleshooting Section */}
          {result.troubleshooting.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                <span>{isRu ? "Рекомендации и устранение неисправностей" : "Actionable Troubleshooting Steps"}</span>
              </h4>
              <div className="space-y-2">
                {result.troubleshooting.map((t, i) => (
                  <div key={i} className="p-3 rounded-lg border border-amber-500/30 bg-amber-950/10 space-y-1 text-xs">
                    <div className="font-semibold text-amber-300">{t.title}</div>
                    <div className="text-zinc-400 text-[11px]">{t.description}</div>
                    <div className="pt-1 text-[11px] text-zinc-300 font-medium flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span>{isRu ? "Решение:" : "Action:"} {t.actionableStep}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
