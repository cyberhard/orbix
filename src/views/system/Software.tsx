import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search, RefreshCw, Download, Trash2, ArrowUpCircle } from "lucide-react";

export const Software: React.FC = () => {
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"installed" | "available">("installed");
  const [isUpdating, setIsUpdating] = useState(false);

  const installedPackages = [
    { name: "sing-box", version: "1.13.21-r1", size: "20.1 MB", desc: "Universal proxy platform with VLESS, Reality, and Tun support" },
    { name: "wireguard-tools", version: "1.0.20260223-r1", size: "185 KB", desc: "WireGuard fast, modern, secure VPN kernel tunnel tools" },
    { name: "pbr", version: "1.2.2-r20", size: "84 KB", desc: "Policy-Based Routing service for OpenWrt supporting multiple uplinks" },
    { name: "curl", version: "8.23.0-r1", size: "192 KB", desc: "Command line tool for transferring data with URL syntax" },
    { name: "dnsmasq", version: "2.93-r1", size: "320 KB", desc: "Lightweight DHCP and caching DNS server" },
    { name: "firewall4", version: "2025.03.17-r2", size: "140 KB", desc: "OpenWrt 4th generation firewall based on nftables and ucode" },
    { name: "dropbear", version: "2025.89-r3", size: "260 KB", desc: "Small SSH 2 server and client for embedded systems" },
  ];

  const filtered = installedPackages.filter(
    (p) => p.name.toLowerCase().includes(filter.toLowerCase()) || p.desc.toLowerCase().includes(filter.toLowerCase())
  );

  const handleUpdateFeeds = async () => {
    setIsUpdating(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsUpdating(false);
    alert("Package feeds updated: 11,139 distinct packages available in OpenWrt repositories!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Software Package Manager (apk)</h2>
          <p className="text-xs text-muted-foreground">Search, install, upgrade, and remove packages from OpenWrt 25.12 feeds</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpdateFeeds}
            disabled={isUpdating}
            className="text-xs gap-1.5 h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? "animate-spin" : ""}`} />
            {isUpdating ? "Updating..." : "Update Feeds"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
          <div className="flex items-center gap-2 w-full sm:w-80">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter installed packages..."
              className="h-8 text-xs bg-background/50"
            />
          </div>

          <Badge variant="outline" className="font-mono text-xs">
            {filtered.length} Packages Found
          </Badge>
        </CardHeader>

        <CardContent className="space-y-2 pt-4">
          {filtered.map((pkg) => (
            <div
              key={pkg.name}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card/60 hover:bg-card transition-colors gap-2"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-foreground">{pkg.name}</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">{pkg.version}</Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">({pkg.size})</span>
                </div>
                <div className="text-[11px] text-muted-foreground">{pkg.desc}</div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
