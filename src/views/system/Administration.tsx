import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Key, ShieldCheck, Plus } from "lucide-react";

export const Administration: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-foreground">Administration & SSH Access</h2>
        <p className="text-xs text-muted-foreground">Manage router administrator password, Dropbear SSH daemon, and authorized public keys</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Router Password */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <span>Router Password</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-muted-foreground">New Password</label>
              <Input type="password" placeholder="Enter new root password..." className="font-mono text-xs" />
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground">Confirmation</label>
              <Input type="password" placeholder="Retype password..." className="font-mono text-xs" />
            </div>

            <Button variant="default" size="sm" className="w-full text-xs">
              Change Root Password
            </Button>
          </CardContent>
        </Card>

        {/* Dropbear SSH */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Dropbear SSH Access</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-muted-foreground">SSH Port</label>
                <Input defaultValue="22" className="font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">Interface</label>
                <Input defaultValue="All interfaces (0.0.0.0)" className="font-mono text-xs" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="font-semibold text-foreground">Password Authentication</div>
                <div className="text-[10px] text-muted-foreground">Allow SSH password login</div>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="font-semibold text-foreground">Root Login via SSH</div>
                <div className="text-[10px] text-muted-foreground">Allow direct root SSH login</div>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Authorized SSH Keys */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-400" />
                <span>Authorized SSH Public Keys (/etc/dropbear/authorized_keys)</span>
              </CardTitle>
              <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8">
                <Plus className="h-3.5 w-3.5" />
                Add SSH Key
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            <textarea
              defaultValue="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK+47391928475192837461928374619283746192834 quasar@workspace"
              className="w-full h-24 p-3 rounded-lg border bg-background/50 font-mono text-[11px] text-muted-foreground"
            />
            <div className="flex justify-end">
              <Button variant="default" size="sm" className="text-xs bg-emerald-600 hover:bg-emerald-500">
                Save Authorized Keys
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
