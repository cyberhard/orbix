import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useSubscriptionStore } from "@/store/subscription-store";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Gauge, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

const MIN_BW = 60000; // B/s — порог живости, тот что в /usr/sbin/panel-node-balancer

function fmtBW(bps: number): string {
  if (!bps || bps <= 0) return "0 Б/с";
  if (bps >= 1048576) return `${(bps / 1048576).toFixed(1)} МБ/с`;
  return `${Math.round(bps / 1024)} КБ/с`;
}

const NodeBalancerCard: React.FC = () => {
  const { lang } = useI18nStore();
  const ru = lang === "ru";
  const qc = useQueryClient();
  const [showLog, setShowLog] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["node-balancer-status"],
    queryFn: () => ubusClient.getNodeBalancerStatus(),
    refetchInterval: 60_000,
  });

  const [busy, setBusy] = useState<null | string>(null);

  const refreshSub = async () => {
    setBusy("sub");
    try {
      const res = await ubusClient.subRefresh();
      setRunMsg(res.message || (ru ? "список обновлён" : "list updated"));
      try { await useSubscriptionStore.getState().hydrateFromRouterCache(); } catch { /* UI list is best-effort */ }
      qc.invalidateQueries({ queryKey: ["node-balancer-status"] });
    } catch (e: any) {
      setRunMsg(e?.message || (ru ? "не удалось обновить" : "update failed"));
    } finally {
      setBusy(null);
    }
  };

  const runMutation = async () => {
    try {
      const res = await ubusClient.nodeBalancerRun();
      setRunMsg(res.message || (ru ? "проверка запущена" : "check started"));
      setTimeout(() => {
        setRunMsg(null);
        qc.invalidateQueries({ queryKey: ["node-balancer-status"] });
      }, 90_000);
    } catch (e: any) {
      setRunMsg(e?.message || "error");
    }
  };

  const alive = (data?.score ?? 0) >= MIN_BW;
  const neverRan = !data?.updated;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className={`h-5 w-5 ${neverRan ? "text-muted-foreground" : alive ? "text-green-500" : "text-red-500"}`} />
            <CardTitle className="text-base">
              {ru ? "Балансировщик нод" : "Node balancer"}
            </CardTitle>
            {data && (
              <Badge variant={neverRan ? "secondary" : alive ? "default" : "destructive"}>
                {neverRan
                  ? (ru ? "ещё не запускался" : "not run yet")
                  : `${ru ? "пропускная" : "throughput"}: ${fmtBW(data.score)}`}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={refreshSub} disabled={busy !== null}>
              {busy === "sub" ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              {ru ? "Обновить серверы" : "Refresh servers"}
            </Button>
            <Button size="sm" variant="outline" onClick={runMutation} disabled={busy !== null}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {ru ? "Проверить сейчас" : "Check now"}
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          {ru
            ? "Каждые 15 минут роутер качает тестовый файл через активную ноду. Если скорость падает — сам сканирует узлы подписки и переключает на самого быстрого. Пинг обмануть легко, трафик — нельзя."
            : "Every 15 min the router downloads a test file through the active node. On degradation it scans subscription nodes and switches to the fastest. Ping lies, throughput does not."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isLoading && <div className="text-muted-foreground text-xs">{ru ? "Загрузка…" : "Loading…"}</div>}
        {isError && (
          <div className="flex items-center gap-2 text-xs text-red-500">
            <AlertTriangle className="h-4 w-4" /> {ru ? "Метод недоступен на роутере" : "Method unavailable on router"}: {String((error as any)?.message || "")}
          </div>
        )}
        {runMsg && <div className="text-xs text-muted-foreground">{runMsg}</div>}
        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">{ru ? "Активный узел" : "Active node"}</div>
                <div className="font-mono break-all">{data.active_server || "—"}{data.active_port ? `:${data.active_port}` : ""}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{ru ? "Узлов в подписке" : "Subscription nodes"}</div>
                <div>{data.sub_nodes ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{ru ? "Последний скан" : "Last scan"}</div>
                <div>
                  {data.updated ? new Date(data.updated * 1000).toLocaleString(ru ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "—"}
                  {data.scanned > 0 && ` · ${ru ? `${data.scanned} проверено, лучший ${fmtBW(data.best)}` : `${data.scanned} tested, best ${fmtBW(data.best)}`}`}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">{ru ? "Статус" : "State"}</div>
                <div className="flex items-center gap-1">
                  <Activity className={`h-3.5 w-3.5 ${neverRan ? "text-muted-foreground" : alive ? "text-green-500" : "text-red-500"}`} />
                  {data.message || (ru ? "ок" : "ok")}
                </div>
              </div>
            </div>
            {data.log && data.log.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowLog((v) => !v)}
                >
                  {showLog ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {ru ? "Журнал балансира" : "Balancer log"}
                </button>
                {showLog && (
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] font-mono whitespace-pre-wrap">
                    {data.log.join("\n")}
                  </pre>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default NodeBalancerCard;
