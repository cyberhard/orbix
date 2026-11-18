// Services watchdog card — cron sweep controlling rpcd/zapret/sing-box,
// flow-offload fix auto-sync and zapret ports sync.
// Backend: watchdog_status / watchdog_set in rpcd-circumvention.sh,
// script /usr/sbin/panel-services-watchdog (Zapret-Manager zm_watch pattern).
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Watch, PlayCircle } from "lucide-react";

type WatchCheck = { name: string; ok: number; action?: string };

export const WatchdogCard: React.FC = () => {
  const { lang } = useI18nStore();
  const isRu = lang === "ru";
  const L = (ru: string, en: string) => (isRu ? ru : en);
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [showLog, setShowLog] = useState(false);

  const { data: wd } = useQuery({
    queryKey: ["services-watchdog"],
    queryFn: () => ubusClient.getWatchdogStatus(),
    refetchInterval: 15000,
  });

  const setMut = useMutation({
    mutationFn: (opts: { enable?: boolean; interval_min?: number; run_now?: boolean }) => ubusClient.setWatchdog(opts),
    onSuccess: () => {
      setMsg(null);
      qc.invalidateQueries({ queryKey: ["services-watchdog"] });
    },
    onError: (e: any) => setMsg({ text: e.message || String(e), error: true }),
  });

  let checks: WatchCheck[] = [];
  let stateTs = "";
  if (wd?.state) {
    try {
      const parsed = JSON.parse(wd.state);
      checks = Array.isArray(parsed?.checks) ? parsed.checks : [];
      stateTs = parsed?.ts || "";
    } catch {
      /* state file malformed — show raw below */
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold flex items-center gap-2">
          <Watch className="h-3.5 w-3.5 text-purple-400" />
          {L("Watchdog служб (cron)", "Services Watchdog (cron)")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <p className="text-[10px] text-muted-foreground leading-snug">
          {L(
            "Периодическая проверка: rpcd (мертв — рестарт; завис — рестарт со второго раза подряд), Zapret (включён, но nfqws нет — рестарт), sing-box (включён, но процесса нет — рестарт), авто-восстановление поправки flow offloading и сверка портов Zapret. Во время теста стратегий проверки Zapret приостанавливаются.",
            "Periodic sweep: rpcd (dead → restart; hung → restart on second consecutive miss), Zapret (enabled but nfqws gone → restart), sing-box (enabled but gone → restart), auto re-apply of the flow-offload fix and zapret ports sync. Zapret checks pause during strategy tests."
          )}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{L("Включён", "Enabled")}</span>
          <div className="flex items-center gap-2">
            {wd && <Badge variant={wd.enabled ? "success" : "secondary"} className="text-[10px]">{wd.spec || (wd.enabled ? "on" : "off")}</Badge>}
            <Switch
              checked={!!wd?.enabled}
              disabled={!wd?.installed || setMut.isPending}
              onCheckedChange={(v) => setMut.mutate({ enable: v })}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{L("Интервал", "Interval")}</span>
          <Select
            value={String(parseInt(wd?.spec?.split(" ")[0]?.replace("*/", "") || "5", 10) || 5)}
            onValueChange={(v) => setMut.mutate({ interval_min: parseInt(v, 10) })}
            disabled={!wd?.installed || setMut.isPending}
          >
            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 5, 10, 15, 30].map((m) => (
                <SelectItem key={m} value={String(m)}>{L(`${m} мин`, `${m} min`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {checks.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground">{L("Последний проход", "Last sweep")}: <span className="font-mono">{stateTs}</span></div>
            <div className="flex flex-wrap gap-1">
              {checks.map((c, i) => (
                <Badge key={`${c.name}-${i}`} variant={c.ok ? (c.action ? "secondary" : "success") : "destructive"} className="text-[10px] font-mono gap-1">
                  {c.name}{c.action ? `:${c.action}` : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {msg && <div className={`text-[10px] font-mono ${msg.error ? "text-destructive" : "text-emerald-500"}`}>{msg.text}</div>}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={!wd?.installed || setMut.isPending} onClick={() => setMut.mutate({ run_now: true })}>
            <PlayCircle className="h-3 w-3" /> {L("Выполнить сейчас", "Run now")}
          </Button>
          {wd?.log && (
            <button className="text-[10px] text-blue-400 underline" onClick={() => setShowLog((v) => !v)}>
              {showLog ? L("скрыть лог", "hide log") : L("лог", "log")}
            </button>
          )}
        </div>
        {showLog && wd?.log && <pre className="max-h-40 overflow-auto text-[9px] font-mono bg-black/40 rounded p-2 whitespace-pre-wrap">{wd.log}</pre>}
        {wd && !wd.installed && (
          <div className="text-[10px] text-amber-500 font-mono">
            {L("Скрипт /usr/sbin/panel-services-watchdog не установлен на роутере.", "/usr/sbin/panel-services-watchdog is not deployed on the router.")}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
