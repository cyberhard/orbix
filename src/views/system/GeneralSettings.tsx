import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Cpu, Clock, Globe, Save, Loader2, RefreshCw } from "lucide-react";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";

export const GeneralSettings: React.FC = () => {
  const [hostname, setHostname] = useState("OpenWrt");
  const [timezone, setTimezone] = useState("GMT0");
  const [zonename, setZonename] = useState("UTC");
  const [ntpEnabled, setNtpEnabled] = useState(true);
  const [ntpServers, setNtpServers] = useState("0.openwrt.pool.ntp.org 1.openwrt.pool.ntp.org");
  const [routerTime, setRouterTime] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const { lang } = useI18nStore();

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [sysRes, dateRes] = await Promise.all([
        ubusClient.getUci<Record<string, any>>("system"),
        ubusClient.exec("date").catch(() => ({ stdout: new Date().toUTCString(), code: 0 })),
      ]);

      if (sysRes?.values) {
        // Find system section
        const sysSection = Object.values(sysRes.values).find((v: any) => v[".type"] === "system") as any;
        if (sysSection) {
          if (sysSection.hostname) setHostname(sysSection.hostname);
          if (sysSection.timezone) setTimezone(sysSection.timezone);
          if (sysSection.zonename) setZonename(sysSection.zonename);
        }

        // Find ntp section
        const ntpSection = Object.values(sysRes.values).find((v: any) => v[".type"] === "timeserver" || v.enabled !== undefined) as any;
        if (ntpSection) {
          setNtpEnabled(ntpSection.enabled === "1" || ntpSection.enabled === true);
          const srv = ntpSection.server;
          if (Array.isArray(srv)) {
            setNtpServers(srv.join(" "));
          } else if (typeof srv === "string") {
            setNtpServers(srv);
          }
        }
      }

      if (dateRes?.stdout) {
        setRouterTime(dateRes.stdout.trim());
      }
    } catch (err: any) {
      console.error("Failed to load general settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      // Save system section
      const sysRes = await ubusClient.getUci<Record<string, any>>("system");
      let sysSectionName = "@system[0]";
      let ntpSectionName = "ntp";

      if (sysRes?.values) {
        for (const [key, val] of Object.entries(sysRes.values)) {
          if ((val as any)[".type"] === "system") sysSectionName = key;
          if ((val as any)[".type"] === "timeserver") ntpSectionName = key;
        }
      }

      await ubusClient.setUci("system", sysSectionName, {
        hostname,
        timezone,
        zonename,
      });

      const serverList = ntpServers.trim().split(/\s+/).filter(Boolean);
      await ubusClient.setUci("system", ntpSectionName, {
        enabled: ntpEnabled ? "1" : "0",
        server: serverList,
      });

      await ubusClient.commitUci("system");

      // Reload system service
      try {
        await ubusClient.initService("system", "restart");
      } catch {}

      setMessage({
        text: lang === "ru"
          ? "Системные настройки OpenWrt успешно сохранены и применены!"
          : "System settings successfully committed to UCI system!",
      });

      await loadSettings();
    } catch (err: any) {
      setMessage({ text: `Failed to save settings: ${err.message}`, error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {lang === "ru" ? "Общие настройки системы" : "General System Settings"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {lang === "ru"
              ? "Имя хоста роутера, часовой пояс, системное время и серверы синхронизации NTP"
              : "Router hostname, timezone, hardware clock, and NTP synchronization servers"}
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={saving || loading}
          className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 gap-1.5"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>{lang === "ru" ? "Сохранить настройки" : "Save Settings"}</span>
        </Button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            message.error
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <span>{lang === "ru" ? "Идентификация роутера" : "System Identity"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-muted-foreground">{lang === "ru" ? "Имя хоста (Hostname)" : "Hostname"}</label>
              <Input
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-muted-foreground">{lang === "ru" ? "Зона (Zonename)" : "Zonename"}</label>
                <Input
                  value={zonename}
                  onChange={(e) => setZonename(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted-foreground">{lang === "ru" ? "Таймзона (POSIX)" : "POSIX Timezone"}</label>
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">{lang === "ru" ? "Время на роутере (date)" : "Router Local Time"}</label>
              <div className="p-2.5 rounded border border-zinc-800 bg-background/50 font-mono text-xs text-emerald-400 flex items-center justify-between">
                <span>{routerTime || "Reading..."}</span>
                <button onClick={loadSettings} className="text-zinc-500 hover:text-zinc-200">
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span>{lang === "ru" ? "Синхронизация времени (NTP)" : "NTP Time Synchronization"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">
                  {lang === "ru" ? "Включить NTP клиент" : "Enable NTP Client"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {lang === "ru" ? "Синхронизировать системные часы с интернетом" : "Synchronize system clock with time servers"}
                </div>
              </div>
              <Switch checked={ntpEnabled} onCheckedChange={setNtpEnabled} />
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">
                {lang === "ru" ? "Серверы NTP (через пробел)" : "NTP Server Candidates (space-separated)"}
              </label>
              <Input
                value={ntpServers}
                onChange={(e) => setNtpServers(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
