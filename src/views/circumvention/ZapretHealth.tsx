// Zapret health cards — fw4 flow-offloading fix, NFQWS ports sync,
// strategy auto-test loop. Backends: zapret_flowoff_*/zapret_ports_sync/
// zapret_auto_* in rpcd-circumvention.sh (mechanics ported from
// StressOzz/Zapret-Manager). Every control here maps 1:1 to an RPC.
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, RefreshCw, Play, Square, Gauge } from "lucide-react";

export const ZapretHealth: React.FC = () => {
  const { lang } = useI18nStore();
  const isRu = lang === "ru";
  const L = (ru: string, en: string) => (isRu ? ru : en);
  const qc = useQueryClient();

  // ---------- flow offloading ----------
  const [foMsg, setFoMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const { data: flowoff } = useQuery({
    queryKey: ["zapret-flowoff"],
    queryFn: () => ubusClient.getZapretFlowoff(),
    refetchInterval: 15000,
  });
  const foMut = useMutation({
    mutationFn: (enable: boolean) => ubusClient.setZapretFlowoffFix(enable),
    onSuccess: (r) => {
      setFoMsg({ text: r.message });
      qc.invalidateQueries({ queryKey: ["zapret-flowoff"] });
    },
    onError: (e: any) => setFoMsg({ text: e.message || String(e), error: true }),
  });

  // ---------- ports sync ----------
  const [portMsg, setPortMsg] = useState<{ text: string; error?: boolean; detail?: string } | null>(null);
  const portsMut = useMutation({
    mutationFn: () => ubusClient.syncZapretPorts(),
    onSuccess: (r) => {
      setPortMsg({
        text: r.message,
        detail: `TCP ${r.ports_tcp}${r.ports_udp ? ` | UDP ${r.ports_udp}` : ""}`,
      });
      qc.invalidateQueries({ queryKey: ["zapret-status"] });
    },
    onError: (e: any) => setPortMsg({ text: e.message || String(e), error: true }),
  });

  // ---------- auto test ----------
  const [applyBest, setApplyBest] = useState(false);
  const [atErr, setAtErr] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const { data: at } = useQuery({
    queryKey: ["zapret-autotest"],
    queryFn: () => ubusClient.getZapretAutoStatus(),
    refetchInterval: (q) => (q.state.data?.running ? 3000 : 20000),
  });
  const startMut = useMutation({
    mutationFn: () => ubusClient.startZapretAutoTest(applyBest),
    onSuccess: () => {
      setAtErr(null);
      qc.invalidateQueries({ queryKey: ["zapret-autotest"] });
    },
    onError: (e: any) => setAtErr(e.message || String(e)),
  });
  const stopMut = useMutation({
    mutationFn: () => ubusClient.stopZapretAutoTest(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["zapret-autotest"] }),
    onError: (e: any) => setAtErr(e.message || String(e)),
  });

  const offloadLabel = flowoff
    ? flowoff.offload === "hw"
      ? L("Аппаратный (hw)", "Hardware (hw)")
      : flowoff.offload === "sw"
        ? L("Программный (sw)", "Software (sw)")
        : L("Выключен", "Off")
    : "—";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ---------- Flow Offloading ---------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            {L("Flow Offloading (fw4)", "Flow Offloading (fw4)")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{L("Режим offloading", "Offload mode")}</span>
            <Badge variant={flowoff?.offload === "none" ? "success" : "default"} className="text-[10px]">
              {offloadLabel}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{L("Поправка для Zapret", "Zapret fix")}</span>
            <Badge variant={flowoff?.fix_applied ? "success" : flowoff?.fix_needed ? "destructive" : "secondary"} className="text-[10px]">
              {flowoff?.fix_applied ? L("Применена", "Applied") : flowoff?.fix_needed ? L("НУЖНА", "NEEDED") : L("Не требуется", "Not needed")}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {L(
              "При включённом flow offloading Zapret не видит первые пакеты соединений. Поправка откладывает выгрузку потока до 30 пакетов (ct original packets ge 30). Применяется идемпотентно, при сбое перезагрузки фаервола шаблон откатывается.",
              "With flow offloading enabled, Zapret never sees a connection's first packets. The fix defers offload until 30 packets (ct original packets ge 30). Idempotent; rolls the template back if the firewall reload fails."
            )}
          </p>
          {foMsg && (
            <div className={`text-[10px] font-mono ${foMsg.error ? "text-destructive" : "text-emerald-500"}`}>{foMsg.text}</div>
          )}
          <Button
            size="sm"
            variant={flowoff?.fix_applied ? "outline" : "default"}
            className="w-full h-7 text-xs"
            disabled={foMut.isPending || !flowoff || (!flowoff.zapret_installed && !flowoff.fix_applied)}
            onClick={() => foMut.mutate(!flowoff?.fix_applied)}
          >
            <ShieldCheck className="h-3 w-3 mr-1" />
            {foMut.isPending
              ? flowoff?.fix_applied
                ? L("Снимаю...", "Removing...")
                : L("Применяю...", "Applying...")
              : flowoff?.fix_applied
                ? L("Снять поправку", "Remove fix")
                : L("Применить поправку", "Apply fix")}
          </Button>
        </CardContent>
      </Card>

      {/* ---------- Ports sync ---------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-blue-500" />
            {L("Порты NFQWS", "NFQWS Ports")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p className="text-[10px] text-muted-foreground leading-snug">
            {L(
              "Синхронизирует NFQWS_PORTS_TCP/UDP с --filter-портf из активной стратегии NFQWS_OPT: объединяет, нормализует диапазоны и убирает дубликаты. Правила nftables рендерятся Zapret заново из конфига — дублей не возникает. Запись только при реальных изменениях.",
              "Syncs NFQWS_PORTS_TCP/UDP with the --filter ports of the active NFQWS_OPT strategy: unions, normalizes ranges, removes duplicates. nftables rules are re-rendered by Zapret from config — no duplicated rules. Writes only on real change."
            )}
          </p>
          {portMsg && (
            <div className={`text-[10px] font-mono ${portMsg.error ? "text-destructive" : "text-emerald-500"}`}>
              {portMsg.text}
              {portMsg.detail && <div className="text-muted-foreground mt-0.5">{portMsg.detail}</div>}
            </div>
          )}
          <Button size="sm" variant="outline" className="w-full h-7 text-xs" disabled={portsMut.isPending} onClick={() => portsMut.mutate()}>
            <RefreshCw className={`h-3 w-3 mr-1 ${portsMut.isPending ? "animate-spin" : ""}`} />
            {portsMut.isPending ? L("Сверяю...", "Syncing...") : L("Сверить порты со стратегией", "Sync ports with strategy")}
          </Button>
        </CardContent>
      </Card>

      {/* ---------- Auto test ---------- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold flex items-center gap-2">
            <Play className="h-3.5 w-3.5 text-amber-500" />
            {L("Автоподбор стратегии DPI-обхода", "DPI Strategy Auto-Test")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p className="text-[10px] text-muted-foreground leading-snug">
            {L(
              "По очереди прогоняет проверки по списку доменов для контрольного замера (Zapret остановлен) и каждой стратегии из /etc/orbix/zaptest-strategies.txt, затем ВСЕГДА возвращает исходный конфиг. Основной режим: только тесты, сеть не «чинится» втемную.",
              "For each strategy runs domain checks after a control round (Zapret stopped), then ALWAYS restores the original config. Nothing is applied unless you tick apply-best."
            )}
          </p>
          {at?.recovered ? (
            <div className="text-[10px] font-mono text-amber-500">
              {L("Обнаружен прерванный тест — конфиг восстановлен автоматически.", "Interrupted test detected — config restored automatically.")}
            </div>
          ) : null}
          {at?.running ? (
            <div className="space-y-1">
              <div className="flex justify-between font-mono text-[10px]">
                <span>{at.cur}</span>
                <span>{at.idx}/{at.total}</span>
              </div>
              <div className="h-1.5 rounded bg-muted overflow-hidden">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${at.total ? (at.idx / at.total) * 100 : 0}%` }} />
              </div>
            </div>
          ) : null}
          {at?.results && at.results.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded border border-border/60">
              <table className="w-full text-[10px] font-mono">
                <tbody>
                  {at.results.map((r, i) => (
                    <tr key={`${r.name}-${i}`} className={`border-b border-border/40 ${r.name === at.best ? "bg-emerald-500/10" : r.name.startsWith("control") ? "text-muted-foreground" : ""}`}>
                      <td className="px-2 py-1">{r.name}{r.name === at.best ? " ★" : ""}</td>
                      <td className="px-2 py-1 text-right whitespace-nowrap">{r.ok}/{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {atErr && <div className="text-[10px] font-mono text-destructive">{atErr}</div>}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
              <input type="checkbox" checked={applyBest} onChange={(e) => setApplyBest(e.target.checked)} disabled={!!at?.running} />
              {L("применить лучшую", "apply best")}
            </label>
            <div className="flex-1" />
            {at?.running ? (
              <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => stopMut.mutate()} disabled={stopMut.isPending}>
                <Square className="h-3 w-3" /> {L("Стоп", "Stop")}
              </Button>
            ) : (
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => startMut.mutate()} disabled={startMut.isPending}>
                <Play className="h-3 w-3" /> {startMut.isPending ? L("Запуск...", "Starting...") : L("Запустить тест", "Run test")}
              </Button>
            )}
          </div>
          {at?.log && (
            <button className="text-[10px] text-blue-400 underline" onClick={() => setShowLog((v) => !v)}>
              {showLog ? L("скрыть лог", "hide log") : L("показать лог", "show log")}
            </button>
          )}
          {showLog && at?.log && (
            <pre className="max-h-40 overflow-auto text-[9px] font-mono bg-black/40 rounded p-2 whitespace-pre-wrap">{at.log}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
