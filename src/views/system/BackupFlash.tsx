import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Upload, RotateCcw, AlertTriangle, Loader2, CheckCircle2, Download, ShieldAlert } from "lucide-react";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";

export const BackupFlash: React.FC = () => {
  const [generating, setGenerating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const { lang } = useI18nStore();

  const handleDownloadBackup = async () => {
    try {
      setGenerating(true);
      setMessage(null);

      // Generate backup on router
      const genRes = await ubusClient.exec("/sbin/sysupgrade", ["-b", "/tmp/backup.tar.gz"]);
      if (genRes.code !== 0) {
        throw new Error(genRes.stderr || `sysupgrade exited with code ${genRes.code}`);
      }

      // Read backup archive as base64
      const fileRes = await ubusClient.call<{ data?: string }>("file", "read", {
        path: "/tmp/backup.tar.gz",
        base64: true,
      });

      if (!fileRes?.data) {
        throw new Error("Empty archive returned from router");
      }

      // Convert base64 to binary blob and trigger browser download
      const byteCharacters = atob(fileRes.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/gzip" });

      const dateStr = new Date().toISOString().slice(0, 10);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-openwrt-${dateStr}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage({
        text: lang === "ru"
          ? "Архив конфигурации backup.tar.gz успешно сгенерирован и скачан!"
          : "Configuration archive backup.tar.gz successfully generated and downloaded!",
      });
    } catch (err: any) {
      console.error("Backup error:", err);
      setMessage({ text: `Backup creation failed: ${err.message}`, error: true });
    } finally {
      setGenerating(false);
    }
  };

  const handleResetDefaults = async () => {
    const warning = lang === "ru"
      ? "ВНИМАНИЕ! Это действие удалит все настройки, ключи, профили и вернет роутер к заводским настройкам (firstboot). Продолжить?"
      : "WARNING: This will erase all custom configurations and reset the router to factory defaults. Proceed?";

    if (!confirm(warning)) return;

    try {
      setResetting(true);
      setMessage(null);
      await ubusClient.exec("/sbin/firstboot", ["-y"]);
      setTimeout(() => {
        ubusClient.reboot().catch(() => {});
      }, 1000);

      setMessage({
        text: lang === "ru"
          ? "Команда сброса отправлена. Роутер очищает overlay и перезагружается..."
          : "Factory reset command sent. Router is wiping overlay and rebooting...",
      });
    } catch (err: any) {
      setMessage({ text: `Factory reset failed: ${err.message}`, error: true });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-foreground">
          {lang === "ru" ? "Бэкап и прошивка роутера" : "Backup & Flash Firmware"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {lang === "ru"
            ? "Экспорт архива конфигурации (/etc/config), сброс до заводских настроек и обновление прошивки"
            : "Export configuration archives (.tar.gz), perform factory reset, and manage sysupgrade"}
        </p>
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Backup / Restore */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Save className="h-4 w-4 text-primary" />
              <span>{lang === "ru" ? "Архив конфигурации (sysupgrade -b)" : "Configuration Backup"}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {lang === "ru" ? "Экспорт всех настроек сети, VPN и правил" : "Export current /etc/config settings"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <p className="text-muted-foreground">
              {lang === "ru"
                ? "Создаёт сжатый tar.gz архив всех конфигурационных файлов, сетевых политик, скриптов zapret, sing-box и ключей dropbear."
                : "Generates and downloads a compressed .tar.gz archive containing all network, firewall, and circumvention configurations."}
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={handleDownloadBackup}
              disabled={generating}
              className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-500"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span>{lang === "ru" ? "Сгенерировать и скачать бэкап" : "Generate Configuration Archive"}</span>
            </Button>
          </CardContent>
        </Card>

        {/* Factory Reset */}
        <Card className="border-destructive/30">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{lang === "ru" ? "Заводские настройки (firstboot)" : "Factory Defaults"}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {lang === "ru" ? "Очистить оверлей и вернуть исходное состояние" : "Revert router to original state"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <p className="text-muted-foreground">
              {lang === "ru"
                ? "Удаляет все изменения в /overlay (JFFS2/UBI). Все установленные пакеты, пользовательские правила и SSH-ключи будут стёрты."
                : "Erases the JFFS2/UBI overlay filesystem. All custom packages, configs, and SSH keys will be permanently deleted."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              disabled={resetting}
              className="gap-1.5 h-8 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/40"
            >
              {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              <span>{lang === "ru" ? "Выполнить сброс к заводским" : "Perform Factory Reset"}</span>
            </Button>
          </CardContent>
        </Card>

        {/* Sysupgrade Info */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-cyan-400" />
              <span>{lang === "ru" ? "Информация о платформе и Sysupgrade" : "Platform & Sysupgrade Information"}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Netcraze NC-1812 / MediaTek Filogic (aarch64)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-zinc-800 bg-card/40">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono">Architecture</span>
                <span className="font-mono font-semibold text-zinc-200">mediatek/filogic (aarch64)</span>
              </div>
              <div className="p-3 rounded-lg border border-zinc-800 bg-card/40">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono">OpenWrt Release</span>
                <span className="font-mono font-semibold text-zinc-200">25.12.6</span>
              </div>
              <div className="p-3 rounded-lg border border-zinc-800 bg-card/40">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono">Kernel</span>
                <span className="font-mono font-semibold text-zinc-200">Linux 6.12.112</span>
              </div>
            </div>
            <p className="text-muted-foreground text-[11px]">
              {lang === "ru"
                ? "Для обновления системы загрузите образ sysupgrade.bin для платформы mediatek/filogic через CLI (sysupgrade /tmp/image.bin) либо используйте attendedsysupgrade."
                : "To flash firmware, upload a mediatek/filogic sysupgrade image or use attended-sysupgrade."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
