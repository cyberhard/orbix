import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Upload, RotateCcw, AlertTriangle } from "lucide-react";

export const BackupFlash: React.FC = () => {
  const handleDownloadBackup = () => {
    alert("Triggered sysupgrade backup archive download (.tar.gz)");
  };

  const handleResetDefaults = () => {
    if (confirm("WARNING: This will wipe all configurations and reset the router to factory defaults. Continue?")) {
      alert("Factory reset command sent. The router is rebooting.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-foreground">Backup & Flash Firmware</h2>
        <p className="text-xs text-muted-foreground">Export configuration archives, perform factory resets, and flash sysupgrade firmware</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Backup / Restore */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Save className="h-4 w-4 text-primary" />
              <span>Configuration Backup</span>
            </CardTitle>
            <CardDescription>Export current /etc/config settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <p className="text-muted-foreground">
              Generate and download a compressed <code className="font-mono text-foreground">.tar.gz</code> archive containing all network, firewall, and circumvention configurations.
            </p>
            <Button variant="default" size="sm" onClick={handleDownloadBackup} className="gap-1.5 h-8 text-xs">
              <Save className="h-3.5 w-3.5" />
              Generate Configuration Archive
            </Button>
          </CardContent>
        </Card>

        {/* Factory Reset */}
        <Card className="border-destructive/30">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>Factory Defaults</span>
            </CardTitle>
            <CardDescription>Revert router to original state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <p className="text-muted-foreground">
              Erases the JFFS2/UBI overlay filesystem. All custom packages, configs, and SSH keys will be permanently deleted.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="gap-1.5 h-8 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Perform Factory Reset
            </Button>
          </CardContent>
        </Card>

        {/* Flash Firmware */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-400" />
              <span>Flash New Firmware Image (Sysupgrade)</span>
            </CardTitle>
            <CardDescription>Upload a sysupgrade image compatible with MediaTek Filogic (aarch64)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors bg-background/40">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <div className="font-semibold text-foreground">Click to upload firmware image</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Compatible with .bin, .tar.gz, .img.gz with SHA256 checksum validation</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
