import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Plus, ArrowRight } from "lucide-react";

export const Firewall: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Firewall (fw4 / nftables)</h2>
          <p className="text-xs text-muted-foreground">Security zones, NAT port forwarding, and custom traffic rules</p>
        </div>
        <Button variant="default" size="sm" className="text-xs gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />
          Add Port Forward
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Security Zones */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Firewall Zones</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            {[
              { name: "lan", input: "ACCEPT", output: "ACCEPT", forward: "ACCEPT", masq: false, color: "text-emerald-400" },
              { name: "wan", input: "REJECT", output: "ACCEPT", forward: "REJECT", masq: true, color: "text-red-400" },
              { name: "vpn", input: "ACCEPT", output: "ACCEPT", forward: "ACCEPT", masq: true, color: "text-blue-400" },
            ].map((zone) => (
              <div key={zone.name} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-bold uppercase ${zone.color}`}>{zone.name}</span>
                  {zone.masq && <Badge variant="outline" className="text-[10px]">MASQUERADE</Badge>}
                </div>
                <div className="flex gap-2 text-[10px] font-mono text-muted-foreground">
                  <span>IN: {zone.input}</span>
                  <span>OUT: {zone.output}</span>
                  <span>FWD: {zone.forward}</span>
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
              <span>Port Forwards (DNAT)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            {[
              { name: "SSH Remote (Port 2222)", ext: "2222", int: "192.168.1.1:22", proto: "TCP" },
              { name: "WireGuard UDP", ext: "51820", int: "192.168.1.1:51820", proto: "UDP" },
              { name: "Web Server HTTPS", ext: "443", int: "192.168.1.100:443", proto: "TCP" },
            ].map((pf) => (
              <div key={pf.name} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                <div>
                  <div className="font-semibold text-foreground">{pf.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    WAN :{pf.ext} <ArrowRight className="inline h-3 w-3 mx-1" /> {pf.int} ({pf.proto})
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">Active</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
