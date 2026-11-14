import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RotateCw, Play, Square, RefreshCw, Search, CheckCircle2, XCircle, Power, Loader2 } from "lucide-react";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";

interface ServiceInfo {
  name: string;
  start?: number;
  stop?: number;
  enabled?: boolean;
  running?: boolean;
}

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  "zapret": "DPI circumvention engine (nfqws / NFQUEUE 200/201)",
  "sing-box": "Universal proxy platform (TUN / VLESS Reality / Hysteria)",
  "pbr": "Policy-Based Routing service (fwmark / ip rule tables)",
  "dnsmasq": "DHCP server and local DNS cache with split resolution",
  "dropbear": "Dropbear SSH remote management daemon",
  "firewall": "Firewall4 nftables packet filter and NAT manager",
  "network": "Netifd Linux network interfaces and bridges manager",
  "odhcpd": "IPv6 router advertisement and DHCPv6 server",
  "uhttpd": "OpenWrt embedded Web server for LuCI and API",
  "cron": "Periodic background cron task scheduler",
  "sysntpd": "Network Time Protocol daemon for clock sync",
  "log": "System kernel and userspace log buffer (logd)",
  "wpad": "Hostapd wireless authenticator for 2.4GHz & 5GHz APs",
  "rpcd": "Ubus RPC daemon powering Modern Admin UI",
};

export const StartupServices: React.FC = () => {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const { lang } = useI18nStore();

  const loadServices = async () => {
    try {
      setLoading(true);
      const res = await ubusClient.getServices();
      const list: ServiceInfo[] = Object.entries(res).map(([name, data]) => ({
        name,
        start: data.start,
        stop: data.stop,
        enabled: data.enabled ?? true,
        running: data.running ?? false,
      }));

      // Sort with critical services first (zapret, sing-box, pbr, dnsmasq, firewall)
      const priorityOrder = ["zapret", "sing-box", "pbr", "dnsmasq", "firewall", "network", "dropbear", "uhttpd"];
      list.sort((a, b) => {
        const aIndex = priorityOrder.indexOf(a.name);
        const bIndex = priorityOrder.indexOf(b.name);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.name.localeCompare(b.name);
      });

      setServices(list);
    } catch (err: any) {
      console.error("Failed to load services:", err);
      setStatusMessage({ text: `Failed to load services: ${err.message}`, error: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleAction = async (name: string, action: "start" | "stop" | "restart" | "enable" | "disable") => {
    const actionKey = `${name}:${action}`;
    setActionInProgress(actionKey);
    setStatusMessage(null);

    try {
      await ubusClient.initService(name, action);
      setStatusMessage({
        text: lang === "ru"
          ? `Служба ${name}: успешно выполнена команда "${action}"`
          : `Service ${name}: successfully executed "${action}"`,
      });
      // Refresh state after slight delay for procd to settle
      setTimeout(loadServices, 1000);
    } catch (err: any) {
      setStatusMessage({
        text: `Error executing ${action} on ${name}: ${err.message}`,
        error: true,
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    (SERVICE_DESCRIPTIONS[s.name] || "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {lang === "ru" ? "Службы автозапуска и демоны (/etc/init.d/*)" : "Startup & System Services (/etc/init.d/*)"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {lang === "ru"
              ? "Управление состоянием, перезапуском и автозагрузкой служб OpenWrt в реальном времени"
              : "Manage real-time lifecycle, restart, and boot-enable state of OpenWrt system services"}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadServices}
          disabled={loading}
          className="text-xs gap-1.5 h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {lang === "ru" ? "Обновить список" : "Refresh Services"}
        </Button>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            statusMessage.error
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
          <div className="flex items-center gap-2 w-full sm:w-80">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={lang === "ru" ? "Поиск службы..." : "Filter services..."}
              className="h-8 text-xs bg-background/50 font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              {filtered.length} {lang === "ru" ? "служб" : "services"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-2 pt-4">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{lang === "ru" ? "Опрос состояния служб роутера..." : "Querying service states..."}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              {lang === "ru" ? "Службы не найдены" : "No services found matching filter."}
            </div>
          ) : (
            filtered.map((svc) => {
              const isWorking = actionInProgress?.startsWith(`${svc.name}:`);

              return (
                <div
                  key={svc.name}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-zinc-800/80 bg-card/60 hover:bg-card transition-colors gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-foreground">{svc.name}</span>
                      <Badge
                        variant={svc.running ? "outline" : "secondary"}
                        className={`text-[10px] ${
                          svc.running
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "text-zinc-500"
                        }`}
                      >
                        {svc.running ? "RUNNING" : "STOPPED"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          svc.enabled
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : "text-zinc-500 border-zinc-800"
                        }`}
                      >
                        {svc.enabled ? "AUTOSTART ON" : "DISABLED"}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {SERVICE_DESCRIPTIONS[svc.name] || `Standard init script (order: start ${svc.start ?? "?"})`}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Restart */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(svc.name, "restart")}
                      disabled={isWorking}
                      className="h-7 px-2.5 text-xs gap-1 border-zinc-800 hover:bg-zinc-800"
                      title={lang === "ru" ? "Перезапустить службу" : "Restart service"}
                    >
                      <RefreshCw className={`h-3 w-3 ${actionInProgress === `${svc.name}:restart` ? "animate-spin" : ""}`} />
                      <span>{lang === "ru" ? "Рестарт" : "Restart"}</span>
                    </Button>

                    {/* Start / Stop toggle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction(svc.name, svc.running ? "stop" : "start")}
                      disabled={isWorking}
                      className={`h-7 px-2.5 text-xs gap-1 ${
                        svc.running ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"
                      }`}
                      title={svc.running ? (lang === "ru" ? "Остановить" : "Stop") : (lang === "ru" ? "Запустить" : "Start")}
                    >
                      {svc.running ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      <span>{svc.running ? (lang === "ru" ? "Стоп" : "Stop") : (lang === "ru" ? "Старт" : "Start")}</span>
                    </Button>

                    {/* Enable / Disable toggle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction(svc.name, svc.enabled ? "disable" : "enable")}
                      disabled={isWorking}
                      className={`h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200`}
                      title={svc.enabled ? (lang === "ru" ? "Отключить автозапуск" : "Disable Boot Autostart") : (lang === "ru" ? "Включить автозапуск" : "Enable Boot Autostart")}
                    >
                      <Power className={`h-3 w-3 ${svc.enabled ? "text-blue-400" : "text-zinc-600"}`} />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};
