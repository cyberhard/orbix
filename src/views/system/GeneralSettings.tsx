import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Cpu, Clock, Globe } from "lucide-react";

export const GeneralSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">General System Settings</h2>
          <p className="text-xs text-muted-foreground">Router hostname, timezone, and NTP time synchronization</p>
        </div>
        <Button variant="default" size="sm" className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500">
          Save Settings
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <span>System Identity</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-muted-foreground">Hostname</label>
              <Input defaultValue="OpenWrt" className="font-mono text-xs" />
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">Timezone</label>
              <Input defaultValue="UTC / Europe-Moscow (MSK, +03:00)" className="font-mono text-xs" />
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">Current Local Time</label>
              <div className="p-2.5 rounded border bg-background/50 font-mono text-xs text-emerald-400">
                {new Date().toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span>NTP Time Synchronization</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">Enable NTP Client</div>
                <div className="text-[10px] text-muted-foreground">Synchronize system clock with internet servers</div>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">NTP Server Candidates</label>
              <Input defaultValue="0.openwrt.pool.ntp.org 1.openwrt.pool.ntp.org time.cloudflare.com" className="font-mono text-xs" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
