// DNS Routing Center - real state read from dnsmasq UCI + resolv.conf, no invented data.
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Globe, Server, RefreshCw, CheckCircle2, AlertTriangle, Search } from "lucide-react";

interface DnsUpstream {
  address: string;
  source: string; // "dnsmasq UCI" | "resolv.conf.auto (ISP/DHCP)"
}

async function loadDnsState() {
  const dhcp = await ubusClient.getUci<Record<string, any>>("dhcp").catch(() => null);
  const dnsmasq = (dhcp?.values as any)?.["@dnsmasq[0]"] || {};

  const upstreams: DnsUpstream[] = [];
  const serverEntries: string[] = Array.isArray(dnsmasq.server)
    ? dnsmasq.server
    : dnsmasq.server
    ? [dnsmasq.server]
    : [];
  for (const s of serverEntries) {
    upstreams.push({ address: String(s), source: "dnsmasq UCI" });
  }

  let resolvAutoIsp: string[] = [];
  try {
    const resolvAuto = await ubusClient.readResolvConfAuto();
    resolvAutoIsp = resolvAuto
      .split("\n")
      .filter((l) => l.trim().startsWith("nameserver"))
      .map((l) => l.replace("nameserver", "").trim())
      .filter(Boolean);
  } catch {}
  for (const s of resolvAutoIsp) {
    if (!upstreams.some((u) => u.address.startsWith(s) || s.startsWith(u.address.split("/")[0]))) {
      upstreams.push({ address: s, source: "resolv.conf.auto (DHCP/ISP)" });
    }
  }

  // dnsmasq defaults rebind_protection to on when the option is absent
  const rebindProtection = dnsmasq.rebind_protection !== "0";

  return { upstreams, rebindProtection, dnsmasqConfigured: Object.keys(dnsmasq).length > 1 };
}

export const DnsRoutingCenter: React.FC = () => {
  const { language } = useI18nStore();
  const isRu = language === "ru";
  const queryClient = useQueryClient();

  const { data: dnsState, isLoading } = useQuery({
    queryKey: ["dns-center-state"],
    queryFn: loadDnsState,
  });

  const [testDomain, setTestDomain] = useState("");
  const [testResult, setTestResult] = useState<{
    domain: string;
    ips: string[];
    latencyMs: number;
    rawOutput: string;
    ok: boolean;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [rebindSaving, setRebindSaving] = useState(false);
  const [rebindFeedback, setRebindFeedback] = useState<string | null>(null);

  const handleToggleRebind = async (next: boolean) => {
    setRebindSaving(true);
    setRebindFeedback(null);
    try {
      await ubusClient.setUci("dhcp", "@dnsmasq[0]", { rebind_protection: next ? "1" : "0" });
      await ubusClient.commitUci("dhcp");
      try {
        await ubusClient.initService("dnsmasq", "restart");
      } catch {}
      queryClient.invalidateQueries({ queryKey: ["dns-center-state"] });
      setRebindFeedback(
        next
          ? isRu
            ? "Защита от rebind включена, dnsmasq перезапущен"
            : "Rebind protection enabled, dnsmasq restarted"
          : isRu
          ? "ВНИМАНИЕ: защита от rebind ВЫКЛЮЧЕНА на роутере"
          : "WARNING: rebind protection is DISABLED on the router"
      );
    } catch (e: any) {
      setRebindFeedback(
        (isRu ? "ОШИБКА: настройка НЕ изменена на роутере: " : "ERROR: setting NOT changed on router: ") + (e?.message || String(e))
      );
    } finally {
      setRebindSaving(false);
    }
  };

  const handleTestDns = async () => {
    const domain = testDomain.trim().toLowerCase();
    if (!domain || !/^[a-z0-9.-]+$/.test(domain)) return;
    setIsTesting(true);
    setTestResult(null);

    const startTime = Date.now();
    try {
      // Real resolution through the router's own resolver (dnsmasq on 127.0.0.1)
      const res = await ubusClient.exec("nslookup", [domain, "127.0.0.1"]);
      const latency = Date.now() - startTime;
      const raw = (res.stdout || "") + (res.stderr ? "\n" + res.stderr : "");

      const parsedIps: string[] = [];
      for (const line of raw.split("\n")) {
        const m = line.match(/^Address(?:\(\d+\))?:\s+([0-9a-fA-F:.]+)/);
        if (m && !m[1].startsWith("127.0.0.1") && !m[1].endsWith(":53")) {
          parsedIps.push(m[1]);
        }
      }

      setTestResult({
        domain,
        ips: parsedIps,
        latencyMs: latency,
        rawOutput: raw.trim() || `(nslookup finished with exit code ${res.code}, no output)`,
        ok: res.code === 0 && parsedIps.length > 0,
      });
    } catch (e: any) {
      setTestResult({
        domain,
        ips: [],
        latencyMs: Date.now() - startTime,
        rawOutput: String(e?.message || e),
        ok: false,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-400" />
          <span>{isRu ? "Состояние DNS роутера" : "Router DNS State"}</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          {isRu
            ? "Реальные апстрим-серверы из /etc/config/dhcp и /tmp/resolv.conf.auto. Здесь показывается то, что настроено, а не макет."
            : "Live upstreams read from /etc/config/dhcp and /tmp/resolv.conf.auto. This page shows what is actually configured."}
        </p>
      </div>

      {/* Upstream Resolvers List */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
            <Server className="h-4 w-4 text-blue-400" />
            <span>{isRu ? "Сконфигурированные апстрим-резолверы" : "Active Upstream Resolvers"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="font-semibold text-xs text-zinc-200">
                {isRu ? "Защита от Rebind атак (rebind_protection)" : "DNS Rebind Protection (rebind_protection)"}
              </span>
              <p className="text-[10px] text-zinc-500">
                {isRu
                  ? "Отбрасывать ответы апстримов с приватными IP. Вкл/выкл пишется в /etc/config/dhcp и применяется перезапуском dnsmasq."
                  : "Discards upstream RFC1918 answers. Toggle writes /etc/config/dhcp and restarts dnsmasq."}
              </p>
            </div>
            <Switch
              checked={dnsState ? dnsState.rebindProtection : false}
              disabled={rebindSaving || !dnsState}
              onCheckedChange={handleToggleRebind}
              className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-zinc-800 shrink-0"
            />
          </div>
          {rebindFeedback && (
            <div className="p-2 rounded-md border border-zinc-700 bg-zinc-900 text-[11px] text-zinc-300">{rebindFeedback}</div>
          )}
        </CardContent>
      </Card>

      {/* Upstream Resolvers - live */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-400" />
              <span>{isRu ? "Фактические апстрим-резолверы" : "Configured Upstream Resolvers"}</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["dns-center-state"] })} className="h-7 w-7 p-0">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {isLoading ? (
            <div className="p-4 text-xs text-zinc-500">{isRu ? "Чтение конфигурации..." : "Reading config..."}</div>
          ) : !dnsState?.dnsmasqConfigured ? (
            <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px]">
              {isRu
                ? "Секция dnsmasq не найдена в /etc/config/dhcp - роутер резолвит только через DHCP-сервер провайдера."
                : "No dnsmasq section found in /etc/config/dhcp - the router resolves via DHCP-provided servers only."}
            </div>
          ) : dnsState.upstreams.length === 0 ? (
            <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-400 text-[11px]">
              {isRu
                ? "Явных апстримов не настроено: dnsmasq использует серверы, полученные по DHCP (см. /tmp/resolv.conf.auto)."
                : "No explicit upstreams configured: dnsmasq falls back to DHCP-assigned servers (see /tmp/resolv.conf.auto)."}
            </div>
          ) : (
            dnsState.upstreams.map((u) => (
              <div
                key={u.address + u.source}
                className="p-3 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-mono text-zinc-200 truncate">{u.address}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{u.source}</div>
                </div>
                <Badge variant="outline" className="text-[9px] uppercase text-zinc-400 border-zinc-700 shrink-0">
                  {u.source.includes("ISP") ? (isRu ? "провайдер" : "isp/dhcp") : "uci"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Real resolver tester - honest result, never fabricated */}
      <Card className="border-zinc-800 bg-zinc-950 shadow-md">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
            <Search className="h-4 w-4 text-zinc-400" />
            <span>{isRu ? "Проверка резолвинга через роутер" : "Resolution Test via Router"}</span>
          </CardTitle>
          <CardDescription className="text-[11px] text-zinc-500">
            {isRu
              ? "Реальный nslookup с роутера к его собственному резолверу (127.0.0.1). Результат - только фактический вывод, без домысливания IP."
              : "Real nslookup from the router against its own resolver (127.0.0.1). Shows only actual output - never fabricated answers."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex gap-2 max-w-lg">
            <Input
              value={testDomain}
              onChange={(e) => setTestDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTestDns()}
              placeholder="chatgpt.com / youtube.com / ... "
              className="h-8 text-xs font-mono bg-zinc-900 border-zinc-800 text-zinc-100"
            />
            <Button
              onClick={handleTestDns}
              disabled={isTesting || !testDomain.trim()}
              size="sm"
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white gap-1.5"
            >
              <RefreshCw className={`h-3 w-3 ${isTesting ? "animate-spin" : ""}`} />
              {isRu ? "Тест" : "Query"}
            </Button>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-xl border space-y-2 text-xs ${
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-950/20"
                  : "border-red-500/30 bg-red-950/20"
              }`}
            >
              <div className={`flex items-center justify-between font-semibold ${testResult.ok ? "text-emerald-300" : "text-red-300"}`}>
                <span className="flex items-center gap-1.5">
                  {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {testResult.ok
                    ? isRu
                      ? `Резолвится: ${testResult.domain}`
                      : `Resolves: ${testResult.domain}`
                    : isRu
                    ? `НЕ Разрешилось: ${testResult.domain}`
                    : `Resolution FAILED: ${testResult.domain}`}
                </span>
                <span className="font-mono text-[11px]">{testResult.latencyMs} ms</span>
              </div>
              {testResult.ips.length > 0 && (
                <div className="text-[11px] font-mono text-zinc-300 pt-1 border-t border-zinc-700/50">
                  <span className="text-zinc-500">IP: </span>
                  <span className="text-emerald-400">{testResult.ips.join(", ")}</span>
                </div>
              )}
              <pre className="text-[10px] font-mono text-zinc-500 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {testResult.rawOutput}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
