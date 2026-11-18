import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Network, ArrowDownLeft, ArrowUpRight, RotateCw } from "lucide-react";
import { formatBytes } from "@/lib/utils";

export const Interfaces: React.FC = () => {
  const {lang} = useI18nStore();
  const isRu = lang === "ru";
  const queryClient = useQueryClient();
  const [busyIface, setBusyIface] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);

  const { data: ifaces } = useQuery({
    queryKey: ["network-interfaces"],
    queryFn: () => ubusClient.getInterfaces(),
    refetchInterval: 5000,
  });

  const handleRestart = async (name: string) => {
    const warn = isRu
      ? `Перезапустить интерфейс «${name}»? На несколько секунд соединение через него прервётся. Продолжить?`
      : `Restart interface “${name}”? Connectivity through it will drop for a few seconds. Continue?`;
    if (!confirm(warn)) return;
    setBusyIface(name);
    setFeedback(null);
    try {
      await ubusClient.restartInterface(name);
      setFeedback({
        text: isRu
          ? `Интерфейс ${name} перезапущен роутером (netifd).`
          : `Interface ${name} restarted by the router (netifd).`,
      });
    } catch (err: any) {
      setFeedback({ text: err.message || String(err), error: true });
    } finally {
      setBusyIface(null);
      queryClient.invalidateQueries({ queryKey: ["network-interfaces"] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {isRu ? "Сетевые интерфейсы" : "Network Interfaces"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRu
              ? "Живой мониторинг логических интерфейсов netifd: состояние, адреса, трафик. Перезапуск интерфейса без перезагрузки роутера"
              : "Live netifd logical interface monitoring: status, addresses, traffic. Restart an interface without rebooting the router"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
          <Network className="h-3.5 w-3.5" />
          <span>netifd / ubus</span>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            feedback.error
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ifaces?.map((iface) => {
          const rx = iface.data?.statistics?.rx_bytes || 0;
          const tx = iface.data?.statistics?.tx_bytes || 0;
          const ip = iface["ipv4-address"]?.[0]?.address || (isRu ? "Не назначен" : "Unassigned");
          const mask = iface["ipv4-address"]?.[0]?.mask || 24;

          return (
            <Card key={iface.interface} className="flex flex-col justify-between border-border bg-card text-card-foreground">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${iface.up ? "bg-emerald-500" : "bg-zinc-500"}`} />
                    <CardTitle className="text-sm font-bold uppercase font-mono text-foreground">{iface.interface}</CardTitle>
                  </div>
                  <Badge variant={iface.up ? "success" : "destructive"} className="text-[10px]">
                    {iface.up ? (isRu ? "РАБОТАЕТ" : "RUNNING") : (isRu ? "ОТКЛЮЧЕН" : "DOWN")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRu ? "Протокол" : "Protocol"}</span>
                  <span className="font-mono uppercase font-semibold text-foreground">{iface.proto}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRu ? "Устройство / L3" : "Device / L3"}</span>
                  <span className="font-mono text-foreground">{iface.device || iface.l3_device}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRu ? "IPv4 Адрес" : "IPv4 Address"}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    {ip}{ip !== (isRu ? "Не назначен" : "Unassigned") ? `/${mask}` : ""}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">{isRu ? "Время работы" : "Uptime"}</span>
                  <span className="font-mono text-foreground">
                    {Math.floor(iface.uptime / 3600)}{isRu ? "ч " : "h "}
                    {Math.floor((iface.uptime % 3600) / 60)}{isRu ? "м" : "m"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <ArrowDownLeft className="h-3.5 w-3.5" /> RX: {formatBytes(rx)}
                  </span>
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <ArrowUpRight className="h-3.5 w-3.5" /> TX: {formatBytes(tx)}
                  </span>
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyIface === iface.interface}
                    onClick={() => handleRestart(iface.interface)}
                    className="h-7 text-xs gap-1 border-border bg-background hover:bg-muted text-foreground"
                  >
                    <RotateCw className={`h-3 w-3 text-muted-foreground ${busyIface === iface.interface ? "animate-spin" : ""}`} />
                    <span>
                      {busyIface === iface.interface
                        ? (isRu ? "Перезапуск..." : "Restarting...")
                        : (isRu ? "Перезапустить" : "Restart")}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
