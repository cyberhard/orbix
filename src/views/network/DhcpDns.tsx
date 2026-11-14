import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FileCode2, Globe, Shield, Plus } from "lucide-react";

export const DhcpDns: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">DHCP & DNS Configuration</h2>
          <p className="text-xs text-muted-foreground">Manage `dnsmasq`, upstream resolvers, DNS-over-HTTPS (DoH), and rebind protection</p>
        </div>
        <Button variant="default" size="sm" className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500">
          Save DNS Settings
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* DNS Resolver Settings */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <span>Upstream DNS Forwarders</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-muted-foreground">Upstream DNS Servers (1 per line or space)</label>
              <Input defaultValue="1.1.1.1 8.8.8.8" className="font-mono text-xs" />
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">Local Domain</label>
              <Input defaultValue="lan" className="font-mono text-xs" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="font-semibold text-foreground">DNS Rebind Protection</div>
                <div className="text-[10px] text-muted-foreground">Discard upstream RFC1918 responses</div>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="font-semibold text-foreground">DNS-over-HTTPS (DoH) / DoT</div>
                <div className="text-[10px] text-muted-foreground">Route DNS requests over TLS/HTTPS (Cloudflare / Quad9)</div>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* DHCP Server Settings */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-emerald-400" />
              <span>DHCP Server (br-lan)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-muted-foreground">Start IP Address</label>
                <Input defaultValue="100" className="font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">Limit (Pool Size)</label>
                <Input defaultValue="150" className="font-mono text-xs" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">Lease Time</label>
              <Input defaultValue="12h" className="font-mono text-xs" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="font-semibold text-foreground">Authoritative DHCP Server</div>
                <div className="text-[10px] text-muted-foreground">Speed up DHCP leasing on LAN</div>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
