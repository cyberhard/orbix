import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FileCode2, Globe, Shield, Plus, Save, Loader2, Trash2, RefreshCw } from "lucide-react";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";

interface StaticLease {
  id: string;
  name: string;
  mac: string;
  ip: string;
}

export const DhcpDns: React.FC = () => {
  const [localDomain, setLocalDomain] = useState("lan");
  const [dnsServers, setDnsServers] = useState("1.1.1.1 8.8.8.8");
  const [rebindProtection, setRebindProtection] = useState(true);
  const [authoritative, setAuthoritative] = useState(true);

  // DHCP Pool
  const [poolStart, setPoolStart] = useState("100");
  const [poolLimit, setPoolLimit] = useState("150");
  const [leaseTime, setLeaseTime] = useState("12h");

  // Static Leases
  const [staticLeases, setStaticLeases] = useState<StaticLease[]>([]);
  const [showAddLease, setShowAddLease] = useState(false);
  const [newHostName, setNewHostName] = useState("");
  const [newHostMac, setNewHostMac] = useState("");
  const [newHostIp, setNewHostIp] = useState("192.168.1.");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const { lang } = useI18nStore();

  const loadDhcpConfig = async () => {
    try {
      setLoading(true);
      const res = await ubusClient.getUci<Record<string, any>>("dhcp");
      if (!res?.values) return;

      const leases: StaticLease[] = [];

      for (const [key, val] of Object.entries(res.values)) {
        const type = (val as any)[".type"];
        if (type === "dnsmasq") {
          if (val.domain) setLocalDomain(val.domain);
          if (val.rebind_protection !== undefined) {
            setRebindProtection(val.rebind_protection === "1");
          }
          if (val.authoritative !== undefined) {
            setAuthoritative(val.authoritative === "1");
          }
          if (val.server) {
            setDnsServers(Array.isArray(val.server) ? val.server.join(" ") : String(val.server));
          }
        } else if (key === "lan" && type === "dhcp") {
          if (val.start) setPoolStart(String(val.start));
          if (val.limit) setPoolLimit(String(val.limit));
          if (val.leasetime) setLeaseTime(String(val.leasetime));
        } else if (type === "host") {
          leases.push({
            id: key,
            name: val.name || "Static-Host",
            mac: val.mac || "",
            ip: val.ip || "",
          });
        }
      }

      setStaticLeases(leases);
    } catch (err: any) {
      console.error("Failed to load DHCP config:", err);
      setMessage({ text: `Failed to load DHCP config: ${err.message}`, error: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDhcpConfig();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      // Find dnsmasq section name
      const res = await ubusClient.getUci<Record<string, any>>("dhcp");
      let dnsmasqSection = "@dnsmasq[0]";
      if (res?.values) {
        for (const [key, val] of Object.entries(res.values)) {
          if ((val as any)[".type"] === "dnsmasq") {
            dnsmasqSection = key;
            break;
          }
        }
      }

      const srvList = dnsServers.trim().split(/\s+/).filter(Boolean);

      await ubusClient.setUci("dhcp", dnsmasqSection, {
        domain: localDomain,
        rebind_protection: rebindProtection ? "1" : "0",
        authoritative: authoritative ? "1" : "0",
        server: srvList,
      });

      await ubusClient.setUci("dhcp", "lan", {
        start: poolStart,
        limit: poolLimit,
        leasetime: leaseTime,
      });

      await ubusClient.commitUci("dhcp");
      try {
        await ubusClient.initService("dnsmasq", "restart");
      } catch {}

      setMessage({
        text: lang === "ru"
          ? "Настройки DHCP и DNSmasq успешно сохранены и применены!"
          : "DHCP and DNSmasq settings successfully saved and applied!",
      });
      await loadDhcpConfig();
    } catch (err: any) {
      setMessage({ text: `Error saving DHCP settings: ${err.message}`, error: true });
    } finally {
      setSaving(false);
    }
  };

  const handleAddStaticLease = async () => {
    if (!newHostMac || !newHostIp) {
      setMessage({ text: "MAC address and IP address are required.", error: true });
      return;
    }

    try {
      setSaving(true);
      const cleanMac = newHostMac.toUpperCase().replace(/[^0-9A-F:]/g, "");
      const hostId = `host_${cleanMac.replace(/:/g, "")}`;

      await ubusClient.setUci("dhcp", hostId, {
        name: newHostName || `Host-${newHostIp.split(".").pop()}`,
        mac: cleanMac,
        ip: newHostIp,
      });
      await ubusClient.commitUci("dhcp");
      try {
        await ubusClient.initService("dnsmasq", "restart");
      } catch {}

      setShowAddLease(false);
      setNewHostName("");
      setNewHostMac("");
      await loadDhcpConfig();
      setMessage({ text: "Static DHCP lease pinned successfully!", error: false });
    } catch (err: any) {
      setMessage({ text: `Failed to add static lease: ${err.message}`, error: true });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLease = async (id: string) => {
    if (!confirm(lang === "ru" ? "Удалить статическую аренду DHCP?" : "Delete this static DHCP lease?")) return;
    try {
      setSaving(true);
      // Revert / remove UCI section
      await ubusClient.exec("uci", ["delete", `dhcp.${id}`]);
      await ubusClient.commitUci("dhcp");
      try {
        await ubusClient.initService("dnsmasq", "restart");
      } catch {}
      await loadDhcpConfig();
    } catch (err: any) {
      setMessage({ text: `Failed to delete lease: ${err.message}`, error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {lang === "ru" ? "Конфигурация DHCP и DNS (dnsmasq)" : "DHCP & DNS Configuration"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {lang === "ru"
              ? "Управление сервером dnsmasq, пулом адресов br-lan, апстрим-серверами и статическими арендами"
              : "Manage dnsmasq daemon, LAN DHCP address pool, upstream resolvers, and static IP reservations"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDhcpConfig}
            disabled={loading}
            className="text-xs gap-1.5 h-8 border-zinc-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{lang === "ru" ? "Обновить" : "Refresh"}</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>{lang === "ru" ? "Сохранить настройки" : "Save DNS Settings"}</span>
          </Button>
        </div>
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
        {/* DNS Resolver Settings */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <span>{lang === "ru" ? "DNS Резолвер (dnsmasq)" : "Upstream DNS Forwarders"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-muted-foreground">
                {lang === "ru" ? "Апстрим DNS серверы (через пробел)" : "Upstream DNS Servers (space-separated)"}
              </label>
              <Input
                value={dnsServers}
                onChange={(e) => setDnsServers(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">{lang === "ru" ? "Локальный домен" : "Local Domain"}</label>
              <Input
                value={localDomain}
                onChange={(e) => setLocalDomain(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="font-semibold text-foreground">
                  {lang === "ru" ? "Защита DNS Rebind" : "DNS Rebind Protection"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {lang === "ru" ? "Отбрасывать нелокальные RFC1918 ответы" : "Discard upstream RFC1918 responses"}
                </div>
              </div>
              <Switch checked={rebindProtection} onCheckedChange={setRebindProtection} />
            </div>
          </CardContent>
        </Card>

        {/* DHCP Server Settings */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-emerald-400" />
              <span>{lang === "ru" ? "Пул адресов DHCP (br-lan)" : "DHCP Server (br-lan)"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-muted-foreground">{lang === "ru" ? "Начальный IP смещение" : "Start IP Offset"}</label>
                <Input
                  value={poolStart}
                  onChange={(e) => setPoolStart(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">{lang === "ru" ? "Размер пула (Лимит)" : "Pool Limit"}</label>
                <Input
                  value={poolLimit}
                  onChange={(e) => setPoolLimit(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">{lang === "ru" ? "Время аренды (Lease Time)" : "Lease Time"}</label>
              <Input
                value={leaseTime}
                onChange={(e) => setLeaseTime(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="font-semibold text-foreground">
                  {lang === "ru" ? "Авторитетный DHCP сервер" : "Authoritative DHCP Server"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {lang === "ru" ? "Ускоряет выдачу адресов новым клиентам" : "Speed up DHCP leasing on LAN"}
                </div>
              </div>
              <Switch checked={authoritative} onCheckedChange={setAuthoritative} />
            </div>
          </CardContent>
        </Card>

        {/* Static DHCP Leases */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-400" />
              <span>{lang === "ru" ? "Статические IP аренды (Static DHCP Leases)" : "Static DHCP Leases"}</span>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddLease(!showAddLease)}
              className="text-xs gap-1 h-7 border-zinc-800"
            >
              <Plus className="h-3 w-3" />
              <span>{lang === "ru" ? "Закрепить IP" : "Add Static Lease"}</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            {showAddLease && (
              <div className="p-3 rounded-lg border border-primary/30 bg-card/60 space-y-3 mb-3">
                <div className="font-semibold text-zinc-200">
                  {lang === "ru" ? "Закрепление постоянного IP адреса за устройством" : "Pin Static IP to Device"}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder={lang === "ru" ? "Имя (e.g. MyPhone)" : "Hostname"}
                    value={newHostName}
                    onChange={(e) => setNewHostName(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                  <Input
                    placeholder="MAC: B2:68:C5:3D:2E:52"
                    value={newHostMac}
                    onChange={(e) => setNewHostMac(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                  <Input
                    placeholder="IP: 192.168.1.130"
                    value={newHostIp}
                    onChange={(e) => setNewHostIp(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowAddLease(false)} className="h-7 text-xs">
                    {lang === "ru" ? "Отмена" : "Cancel"}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAddStaticLease}
                    disabled={saving}
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 gap-1"
                  >
                    <Save className="h-3 w-3" />
                    <span>{lang === "ru" ? "Сохранить" : "Save"}</span>
                  </Button>
                </div>
              </div>
            )}

            {staticLeases.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                {lang === "ru" ? "Нет закреплённых статических аренд." : "No static DHCP leases configured."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {staticLeases.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-800 bg-card/40 hover:bg-card/70 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-zinc-200 text-xs">{l.name}</div>
                      <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                        {l.ip} • <span className="text-zinc-500">{l.mac}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteLease(l.id)}
                      className="h-7 w-7 text-zinc-500 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
