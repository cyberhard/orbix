import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Search, Pin, Smartphone, Laptop, Tv, Monitor, Network } from "lucide-react";
import { useUciStore } from "@/store/uci-store";
import { DeviceRoutingTable } from "@/components/pbr/DeviceRoutingTable";

export const ConnectedClients: React.FC = () => {
  const { t, lang } = useI18nStore();
  const [filter, setFilter] = useState("");
  const { stageChange } = useUciStore();

  const { data: leases } = useQuery({
    queryKey: ["dhcp-leases"],
    queryFn: () => ubusClient.getDhcpLeases(),
    refetchInterval: 5000,
  });

  const getDeviceIcon = (hostname = "") => {
    const h = hostname.toLowerCase();
    if (h.includes("iphone") || h.includes("android") || h.includes("phone")) {
      return <Smartphone className="h-4 w-4 text-emerald-400" />;
    }
    if (h.includes("macbook") || h.includes("laptop") || h.includes("thinkpad")) {
      return <Laptop className="h-4 w-4 text-blue-400" />;
    }
    if (h.includes("tv") || h.includes("roku") || h.includes("apple-tv")) {
      return <Tv className="h-4 w-4 text-amber-400" />;
    }
    return <Monitor className="h-4 w-4 text-primary" />;
  };

  const handleMakeStatic = async (lease: { hostname?: string; macaddr: string; ipaddr: string }) => {
    try {
      await stageChange({
        config: "dhcp",
        section: `host_${lease.macaddr.replace(/:/g, "")}`,
        option: "ip",
        oldValue: null,
        newValue: lease.ipaddr,
        type: "set",
      });
      alert(lang === "ru" ? `Подготовлена статическая привязка IP для ${lease.hostname || lease.ipaddr} (${lease.macaddr}). Примените в панели UCI.` : `Staged static lease binding for ${lease.hostname || lease.ipaddr} (${lease.macaddr}). Check UCI bar to Apply.`);
    } catch {
      alert("Failed to stage static lease binding");
    }
  };

  const filtered = leases?.filter((l) => {
    const q = filter.toLowerCase();
    return (
      l.ipaddr.includes(q) ||
      l.macaddr.toLowerCase().includes(q) ||
      (l.hostname && l.hostname.toLowerCase().includes(q))
    );
  }) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">{t.clients.title}</h2>
          <p className="text-xs text-muted-foreground">{t.clients.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t.clients.filterPlaceholder}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Per-Device Policy Routing Table */}
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
            <Network className="h-4 w-4 text-zinc-400" />
            {lang === "ru" ? "Маршрутизация подключенных устройств" : "Per-Device Policy-Based Routing"}
          </h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {lang === "ru"
              ? "Управляйте привязкой трафика устройств к туннелям (Sing-box, AWG, Zapret2, WAN) с автоматической статической фиксацией в DHCP"
              : "Manage per-device outbound gateway steering with automatic DHCP static host lease pinning"}
          </p>
        </div>
        <DeviceRoutingTable />
      </div>

      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold flex items-center justify-between text-zinc-200">
            <span>{t.clients.activeLeases}</span>
            <Badge variant="outline" className="font-mono text-[10px] bg-zinc-950 border-zinc-800 text-zinc-400">
              {filtered.length} {t.clients.connected}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t.clients.deviceHostname}</TableHead>
                <TableHead>{t.clients.ipv4Address}</TableHead>
                <TableHead>{t.clients.macAddress}</TableHead>
                <TableHead>{t.clients.leaseExpires}</TableHead>
                <TableHead className="text-right">{t.clients.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t.clients.noClients}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lease) => (
                  <TableRow key={lease.macaddr}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {getDeviceIcon(lease.hostname)}
                        <div>
                          <div className="font-semibold text-foreground">
                            {lease.hostname || "Anonymous Device"}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            DHCPv4
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono font-medium text-emerald-400">
                      {lease.ipaddr}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-[11px]">
                      {lease.macaddr}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {Math.floor(lease.expires / 3600)}h {Math.floor((lease.expires % 3600) / 60)}m
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMakeStatic(lease)}
                        className="h-7 text-xs gap-1 border-border/80 hover:bg-primary hover:text-primary-foreground"
                      >
                        <Pin className="h-3 w-3" />
                        {t.clients.staticBind}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
