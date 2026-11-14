import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search, RefreshCw, Download, Trash2, Loader2, Plus, Terminal } from "lucide-react";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";

interface PackageItem {
  name: string;
  version: string;
}

export const Software: React.FC = () => {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [isUpdatingFeeds, setIsUpdatingFeeds] = useState(false);
  const [newPkgName, setNewPkgName] = useState("");
  const [installing, setInstalling] = useState(false);
  const [logOutput, setLogOutput] = useState<string | null>(null);
  const { lang } = useI18nStore();

  const loadPackages = async () => {
    try {
      setLoading(true);
      const pkgMap = await ubusClient.getPackages();
      const list: PackageItem[] = Object.entries(pkgMap).map(([name, version]) => ({
        name,
        version,
      }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setPackages(list);
    } catch (err: any) {
      console.error("Failed to load packages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const handleUpdateFeeds = async () => {
    setIsUpdatingFeeds(true);
    setLogOutput(null);
    try {
      const res = await ubusClient.exec("apk", ["update"]);
      setLogOutput(res.stdout || res.stderr || `Feeds update completed with code ${res.code}`);
      await loadPackages();
    } catch (err: any) {
      setLogOutput(`Error updating feeds: ${err.message}`);
    } finally {
      setIsUpdatingFeeds(false);
    }
  };

  const handleInstallPackage = async () => {
    const pkg = newPkgName.trim();
    if (!pkg) return;

    setInstalling(true);
    setLogOutput(null);
    try {
      const res = await ubusClient.exec("apk", ["add", pkg]);
      setLogOutput(res.stdout || res.stderr || `Install completed with code ${res.code}`);
      setNewPkgName("");
      await loadPackages();
    } catch (err: any) {
      setLogOutput(`Installation error: ${err.message}`);
    } finally {
      setInstalling(false);
    }
  };

  const filtered = packages.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.version.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {lang === "ru" ? "Менеджер пакетов ПО (apk)" : "Software Package Manager (apk)"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {lang === "ru"
              ? "Управление установленными пакетами и репозиториями OpenWrt 25.12 (MediaTek Filogic aarch64)"
              : "Manage installed packages and repositories on OpenWrt 25.12 (MediaTek Filogic aarch64)"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpdateFeeds}
            disabled={isUpdatingFeeds}
            className="text-xs gap-1.5 h-8 border-zinc-800 bg-zinc-900/60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isUpdatingFeeds ? "animate-spin text-primary" : ""}`} />
            {isUpdatingFeeds
              ? (lang === "ru" ? "Обновление репозиториев..." : "Updating...")
              : (lang === "ru" ? "Обновить фиды (apk update)" : "Update Feeds")}
          </Button>
        </div>
      </div>

      {/* Install Package Bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Package className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={newPkgName}
                onChange={(e) => setNewPkgName(e.target.value)}
                placeholder={lang === "ru" ? "Имя пакета для установки (например: curl, tcpdump, htop)..." : "Package to install (e.g. curl, tcpdump)..."}
                className="pl-8 h-8 text-xs font-mono bg-background/50"
                onKeyDown={(e) => e.key === "Enter" && !installing && handleInstallPackage()}
              />
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleInstallPackage}
              disabled={installing || !newPkgName.trim()}
              className="h-8 text-xs gap-1.5 w-full sm:w-auto"
            >
              {installing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{lang === "ru" ? "Установить пакет" : "Install Package"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Terminal log output for install / update */}
      {logOutput && (
        <Card className="border-zinc-800 bg-black/80">
          <CardHeader className="py-2.5 px-4 border-b border-zinc-800 flex flex-row items-center justify-between">
            <span className="text-xs font-mono text-zinc-400 flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              <span>Output Log</span>
            </span>
            <button onClick={() => setLogOutput(null)} className="text-xs text-zinc-500 hover:text-zinc-200">
              ✕
            </button>
          </CardHeader>
          <CardContent className="p-3">
            <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {logOutput}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Installed Packages List */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
          <div className="flex items-center gap-2 w-full sm:w-80">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={lang === "ru" ? "Фильтр установленных пакетов..." : "Filter installed packages..."}
              className="h-8 text-xs bg-background/50 font-mono"
            />
          </div>

          <Badge variant="outline" className="font-mono text-xs">
            {filtered.length} / {packages.length} {lang === "ru" ? "пакетов" : "packages"}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-1.5 pt-4">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{lang === "ru" ? "Чтение базы пакетов роутера..." : "Reading package database..."}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              {lang === "ru" ? "Пакеты не найдены." : "No packages found."}
            </div>
          ) : (
            filtered.map((pkg) => (
              <div
                key={pkg.name}
                className="flex items-center justify-between p-2.5 rounded-md border border-zinc-800/60 bg-card/40 hover:bg-card/80 transition-colors gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Package className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  <span className="font-mono font-medium text-xs text-zinc-200 truncate">{pkg.name}</span>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px] text-zinc-400 bg-zinc-900 shrink-0">
                  {pkg.version}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
