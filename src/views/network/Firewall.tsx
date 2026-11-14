import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Shield, Plus, ArrowRight, RefreshCw, Loader2, Save, Trash2, Power } from "lucide-react";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";

interface FirewallZone {
  id: string;
  name: string;
  input: string;
  output: string;
  forward: string;
  masq?: boolean;
  network?: string | string[];
}

interface FirewallRule {
  id: string;
  name: string;
  src?: string;
  dest?: string;
  proto?: string;
  dest_port?: string;
  dest_ip?: string;
  target: string;
  enabled?: boolean;
}

interface PortForward {
  id: string;
  name: string;
  src: string;
  src_dport: string;
  dest: string;
  dest_ip: string;
  dest_port: string;
  proto: string;
  enabled?: boolean;
}

export const Firewall: React.FC = () => {
  const [zones, setZones] = useState<FirewallZone[]>([]);
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [redirects, setRedirects] = useState<PortForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // New port forward form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPfName, setNewPfName] = useState("");
  const [newPfExtPort, setNewPfExtPort] = useState("");
  const [newPfIntIp, setNewPfIntIp] = useState("192.168.1.");
  const [newPfIntPort, setNewPfIntPort] = useState("");
  const [newPfProto, setNewPfProto] = useState("tcp");

  const { lang } = useI18nStore();

  const loadFirewall = async () => {
    try {
      setLoading(true);
      const res = await ubusClient.getUci<Record<string, any>>("firewall");
      if (!res?.values) return;

      const zList: FirewallZone[] = [];
      const rList: FirewallRule[] = [];
      const pfList: PortForward[] = [];

      for (const [key, val] of Object.entries(res.values)) {
        const type = (val as any)[".type"];
        if (type === "zone") {
          zList.push({
            id: key,
            name: val.name || key,
            input: val.input || "DROP",
            output: val.output || "ACCEPT",
            forward: val.forward || "DROP",
            masq: val.masq === "1",
            network: val.network,
          });
        } else if (type === "rule") {
          rList.push({
            id: key,
            name: val.name || key,
            src: val.src,
            dest: val.dest,
            proto: val.proto,
            dest_port: val.dest_port,
            dest_ip: val.dest_ip,
            target: val.target || "ACCEPT",
            enabled: val.enabled !== "0",
          });
        } else if (type === "redirect") {
          pfList.push({
            id: key,
            name: val.name || key,
            src: val.src || "wan",
            src_dport: val.src_dport || "",
            dest: val.dest || "lan",
            dest_ip: val.dest_ip || "",
            dest_port: val.dest_port || val.src_dport || "",
            proto: val.proto || "tcp",
            enabled: val.enabled !== "0",
          });
        }
      }

      setZones(zList);
      setRules(rList);
      setRedirects(pfList);
    } catch (err: any) {
      console.error("Failed to load firewall:", err);
      setMessage({ text: `Failed to load firewall config: ${err.message}`, error: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFirewall();
  }, []);

  const handleToggleRule = async (ruleId: string, currentEnabled?: boolean) => {
    try {
      const newEnabled = !currentEnabled;
      await ubusClient.setUci("firewall", ruleId, {
        enabled: newEnabled ? "1" : "0",
      });
      await ubusClient.commitUci("firewall");
      try {
        await ubusClient.initService("firewall", "restart");
      } catch {}

      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: newEnabled } : r))
      );
      setMessage({
        text: lang === "ru"
          ? `Правило ${ruleId} ${newEnabled ? "включено" : "отключено"}!`
          : `Rule ${ruleId} is now ${newEnabled ? "enabled" : "disabled"}!`,
      });
    } catch (err: any) {
      setMessage({ text: `Error: ${err.message}`, error: true });
    }
  };

  const handleAddPortForward = async () => {
    if (!newPfName || !newPfExtPort || !newPfIntIp || !newPfIntPort) {
      setMessage({ text: "Please fill in all port forward fields.", error: true });
      return;
    }

    try {
      setSaving(true);
      const sectionName = `redirect_${Date.now()}`;
      await ubusClient.setUci("firewall", sectionName, {
        name: newPfName,
        target: "DNAT",
        src: "wan",
        dest: "lan",
        proto: newPfProto,
        src_dport: newPfExtPort,
        dest_ip: newPfIntIp,
        dest_port: newPfIntPort,
        enabled: "1",
      });
      await ubusClient.commitUci("firewall");
      try {
        await ubusClient.initService("firewall", "restart");
      } catch {}

      setShowAddModal(false);
      setNewPfName("");
      setNewPfExtPort("");
      setNewPfIntPort("");
      await loadFirewall();
      setMessage({ text: "Port forward rule created and committed!", error: false });
    } catch (err: any) {
      setMessage({ text: `Failed to add port forward: ${err.message}`, error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {lang === "ru" ? "Межсетевой экран (Firewall4 / nftables)" : "Firewall (fw4 / nftables)"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {lang === "ru"
              ? "Зоны безопасности, проброс портов (DNAT) и правила фильтрации пакетов в реальном времени"
              : "Security zones, NAT port forwarding, and packet filter rules applied to nftables"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadFirewall}
            disabled={loading}
            className="text-xs gap-1.5 h-8 border-zinc-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{lang === "ru" ? "Обновить" : "Refresh"}</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="text-xs gap-1.5 h-8"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{lang === "ru" ? "Добавить проброс порта" : "Add Port Forward"}</span>
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

      {/* Add Port Forward Modal Dialog */}
      {showAddModal && (
        <Card className="border-primary/40 bg-zinc-950 p-4">
          <CardHeader className="p-0 pb-3 border-b border-zinc-800">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span>{lang === "ru" ? "Новый проброс порта (DNAT)" : "Add Port Forward Rule"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-muted-foreground">{lang === "ru" ? "Название" : "Rule Name"}</label>
                <Input
                  value={newPfName}
                  onChange={(e) => setNewPfName(e.target.value)}
                  placeholder="e.g. Minecraft, SSH, Plex"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">{lang === "ru" ? "Протокол" : "Protocol"}</label>
                <select
                  value={newPfProto}
                  onChange={(e) => setNewPfProto(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-zinc-800 bg-background text-xs font-mono"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="tcp udp">TCP+UDP</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">{lang === "ru" ? "Внешний порт (WAN)" : "External Port"}</label>
                <Input
                  value={newPfExtPort}
                  onChange={(e) => setNewPfExtPort(e.target.value)}
                  placeholder="25565"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">{lang === "ru" ? "Внутренний IP устройства" : "Internal IP"}</label>
                <Input
                  value={newPfIntIp}
                  onChange={(e) => setNewPfIntIp(e.target.value)}
                  placeholder="192.168.1.150"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-muted-foreground">{lang === "ru" ? "Внутренний порт" : "Internal Port"}</label>
                <Input
                  value={newPfIntPort}
                  onChange={(e) => setNewPfIntPort(e.target.value)}
                  placeholder="25565"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddModal(false)}
                className="h-8 text-xs"
              >
                {lang === "ru" ? "Отмена" : "Cancel"}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleAddPortForward}
                disabled={saving}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 gap-1.5"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{lang === "ru" ? "Сохранить и применить" : "Save & Apply"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Security Zones */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>{lang === "ru" ? "Зоны безопасности (Firewall Zones)" : "Firewall Zones"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            {zones.map((zone) => (
              <div key={zone.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-card/50">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs uppercase text-zinc-100">{zone.name}</span>
                    {zone.masq && (
                      <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        MASQUERADE
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    ifaces: {Array.isArray(zone.network) ? zone.network.join(", ") : (zone.network || zone.name)}
                  </div>
                </div>

                <div className="flex gap-2 text-[10px] font-mono text-zinc-400">
                  <span className={zone.input === "ACCEPT" ? "text-emerald-400" : "text-amber-400"}>IN: {zone.input}</span>
                  <span className="text-emerald-400">OUT: {zone.output}</span>
                  <span className={zone.forward === "ACCEPT" ? "text-emerald-400" : "text-red-400"}>FWD: {zone.forward}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Port Forwards (DNAT) */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>{lang === "ru" ? "Проброс портов (DNAT Redirects)" : "Port Forwards (DNAT)"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            {redirects.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {lang === "ru" ? "Нет настроенных правил проброса портов." : "No active port forward rules."}
              </div>
            ) : (
              redirects.map((pf) => (
                <div key={pf.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-card/50">
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <span>{pf.name}</span>
                      <Badge variant="outline" className="text-[9px] font-mono uppercase">{pf.proto}</Badge>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      WAN :{pf.src_dport} <ArrowRight className="inline h-3 w-3 mx-1 text-primary" /> {pf.dest_ip}:{pf.dest_port}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    Active
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Traffic Filter Rules */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-400" />
              <span>{lang === "ru" ? "Правила фильтрации трафика (Traffic Rules)" : "Traffic Rules"}</span>
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono">
              {rules.length} rules
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 pt-4 text-xs">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border border-zinc-800/80 bg-card/40 hover:bg-card/80 transition-colors gap-2"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs text-zinc-200 truncate">{rule.name}</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-mono ${
                        rule.target === "ACCEPT"
                          ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                          : "text-red-400 border-red-500/30 bg-red-500/10"
                      }`}
                    >
                      {rule.target}
                    </Badge>
                    {rule.proto && (
                      <span className="text-[10px] font-mono text-zinc-400">proto: {rule.proto}</span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500">
                    {rule.src || "any"} → {rule.dest || "any"}
                    {rule.dest_port ? ` (port ${rule.dest_port})` : ""}
                    {rule.dest_ip ? ` (ip ${rule.dest_ip})` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-zinc-400">{rule.enabled ? "Enabled" : "Disabled"}</span>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => handleToggleRule(rule.id, rule.enabled)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
