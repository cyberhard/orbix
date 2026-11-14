import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCw, Play, Square, RefreshCw } from "lucide-react";

export const StartupServices: React.FC = () => {
  const [services, setServices] = useState([
    { name: "dnsmasq", enabled: true, running: true, desc: "Local DHCP and DNS caching server" },
    { name: "dropbear", enabled: true, running: true, desc: "Dropbear SSH daemon" },
    { name: "firewall", enabled: true, running: true, desc: "OpenWrt firewall4 daemon" },
    { name: "pbr", enabled: true, running: true, desc: "Policy-Based Routing service" },
    { name: "sing-box", enabled: true, running: true, desc: "Sing-box universal proxy platform" },
    { name: "uhttpd", enabled: true, running: true, desc: "Web server daemon" },
    { name: "cron", enabled: true, running: true, desc: "Periodic task scheduler" },
    { name: "network", enabled: true, running: true, desc: "Netifd network manager" },
  ]);

  const handleAction = (name: string, action: string) => {
    alert(`Executed /etc/init.d/${name} ${action}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-foreground">Startup & System Services (/etc/init.d/*)</h2>
        <p className="text-xs text-muted-foreground">Manage service boot startup status and operational lifecycle</p>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <RotateCw className="h-4 w-4 text-primary" />
            <span>Init Scripts</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-4">
          {services.map((svc) => (
            <div
              key={svc.name}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card/60 hover:bg-card transition-colors gap-2"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-foreground">{svc.name}</span>
                  <Badge variant={svc.running ? "success" : "secondary"} className="text-[10px]">
                    {svc.running ? "RUNNING" : "STOPPED"}
                  </Badge>
                  {svc.enabled && <Badge variant="outline" className="text-[10px]">ENABLED AT BOOT</Badge>}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{svc.desc}</div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(svc.name, "restart")}
                  className="h-7 text-xs gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> Restart
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAction(svc.name, svc.running ? "stop" : "start")}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  {svc.running ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
