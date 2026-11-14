import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Network, Plus, ArrowDownLeft, ArrowUpRight, Settings2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";

export const Interfaces: React.FC = () => {
  const { data: ifaces, refetch } = useQuery({
    queryKey: ["network-interfaces"],
    queryFn: () => ubusClient.getInterfaces(),
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Network Interfaces & VLANs</h2>
          <p className="text-xs text-muted-foreground">Manage physical ports, DSA bridges, VLAN 802.1Q tags, and protocol settings</p>
        </div>
        <Button variant="default" size="sm" className="text-xs gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />
          Add New Interface
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ifaces?.map((iface) => {
          const rx = iface.data?.statistics?.rx_bytes || 0;
          const tx = iface.data?.statistics?.tx_bytes || 0;
          const ip = iface["ipv4-address"]?.[0]?.address || "Unassigned";
          const mask = iface["ipv4-address"]?.[0]?.mask || 24;

          return (
            <Card key={iface.interface} className="flex flex-col justify-between">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <CardTitle className="text-sm font-bold uppercase font-mono">{iface.interface}</CardTitle>
                  </div>
                  <Badge variant={iface.up ? "success" : "destructive"} className="text-[10px]">
                    {iface.up ? "RUNNING" : "DOWN"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Protocol</span>
                  <span className="font-mono uppercase font-semibold">{iface.proto}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Device / L3</span>
                  <span className="font-mono">{iface.device || iface.l3_device}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">IPv4 Address</span>
                  <span className="font-mono text-emerald-400 font-medium">{ip}/{mask}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-mono">{Math.floor(iface.uptime / 3600)}h {Math.floor((iface.uptime % 3600) / 60)}m</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <ArrowDownLeft className="h-3.5 w-3.5" /> RX: {formatBytes(rx)}
                  </span>
                  <span className="flex items-center gap-1 text-blue-400">
                    <ArrowUpRight className="h-3.5 w-3.5" /> TX: {formatBytes(tx)}
                  </span>
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <Settings2 className="h-3 w-3" /> Edit
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
