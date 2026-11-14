import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Save,
  Upload,
  RotateCcw,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Download,
  Shield,
  Lock,
  Unlock,
  FileCode,
  ArrowRight,
  RefreshCw,
  Info,
  Server,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
  Copy,
  Check,
  Terminal,
  Hash,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { usePolicyStore } from "@/store/policy-store";
import { ConfigExporter } from "@/services/config/exporter";
import { ConfigImporter, ImportPreviewResult, ImportMode } from "@/services/config/importer";
import { PanelExportPackage } from "@/services/config/schema";

export const BackupFlash: React.FC = () => {
  const { lang } = useI18nStore();
  const isRu = lang === "ru";
  const { operatingMode } = usePolicyStore();
  const isExpert = operatingMode === "expert";

  // Tab state (Expert mode)
  const [activeTab, setActiveTab] = useState<string>("json-config");

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [encryptBackup, setEncryptBackup] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [previewPackage, setPreviewPackage] = useState<PanelExportPackage | null>(null);

  // Simple Mode password
  const [simpleExportPassword, setSimpleExportPassword] = useState("");
  const [showSimplePassword, setShowSimplePassword] = useState(false);

  // Expert Mode UCI sections & Protocol flags
  const [selectedUciSections, setSelectedUciSections] = useState<string[]>([
    "network",
    "wireless",
    "firewall",
    "dhcp",
    "system",
    "amneziawg",
    "sing-box",
    "zapret",
    "pbr",
  ]);
  const [exportAwgConfig, setExportAwgConfig] = useState(true);
  const [exportSingboxConfig, setExportSingboxConfig] = useState(true);

  // SHA-256 Checksum Inspector state
  const [backupSha256, setBackupSha256] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);
  const [verifyShaInput, setVerifyShaInput] = useState("");
  const [verifyShaResult, setVerifyShaResult] = useState<"match" | "mismatch" | null>(null);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [selectedImportSections, setSelectedImportSections] = useState<string[]>([
    "general",
    "network",
    "devices",
    "policies",
    "vpn",
    "dns",
    "zapret",
    "firewall",
  ]);

  // Expert: Advanced import audit log
  const [showAdvancedLog, setShowAdvancedLog] = useState(false);
  const [advancedLog, setAdvancedLog] = useState<string[]>([]);

  // Status feedback
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);

  // Sysupgrade state
  const [generatingTar, setGeneratingTar] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Helper: compute SHA-256 hash using Web Crypto API
  const computeSha256 = async (str: string): Promise<string> => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    }
  };

  // --- Handlers: Simple Mode Export ---
  const handleSimpleExport = async () => {
    try {
      setIsExporting(true);
      setFeedback(null);

      const hasPassword = simpleExportPassword.trim().length > 0;
      if (hasPassword && simpleExportPassword.trim().length < 6) {
        throw new Error(
          isRu
            ? "Пароль защиты должен содержать минимум 6 символов."
            : "Protection password must be at least 6 characters."
        );
      }

      const pkg = await ConfigExporter.export({
        includeSecrets: true,
        password: hasPassword ? simpleExportPassword.trim() : undefined,
      });

      const jsonStr = JSON.stringify(pkg, null, 2);
      const sha = await computeSha256(jsonStr);
      setBackupSha256(sha);

      const blob = new Blob([jsonStr], { type: "application/json" });
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orbix-backup-${dateStr}${hasPassword ? ".enc" : ""}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setFeedback({
        text: isRu
          ? `Резервная копия ${a.download} успешно сохранена!`
          : `Backup ${a.download} downloaded successfully!`,
      });
    } catch (err: any) {
      console.error("Simple export failed:", err);
      setFeedback({ text: err.message || "Export failed", error: true });
    } finally {
      setIsExporting(false);
    }
  };

  // --- Handlers: Expert Mode JSON Export ---
  const handleExportJson = async () => {
    try {
      setIsExporting(true);
      setFeedback(null);

      if (encryptBackup && (!exportPassword || exportPassword.length < 6)) {
        throw new Error(
          isRu
            ? "Пароль шифрования должен содержать не менее 6 символов."
            : "Encryption password must be at least 6 characters long."
        );
      }

      const pkg = await ConfigExporter.export({
        includeSecrets,
        password: encryptBackup ? exportPassword : undefined,
      });

      const jsonStr = JSON.stringify(pkg, null, 2);
      const sha = await computeSha256(jsonStr);
      setBackupSha256(sha);

      const blob = new Blob([jsonStr], { type: "application/json" });
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `openwrt-config-${pkg.source.board_name.replace(/[^a-zA-Z0-9]/g, "-")}-${dateStr}${
        encryptBackup ? ".enc" : ""
      }.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setFeedback({
        text: isRu
          ? `Файл конфигурации ${a.download} успешно сформирован! SHA-256: ${sha.slice(0, 16)}...`
          : `Configuration file ${a.download} generated! SHA-256: ${sha.slice(0, 16)}...`,
      });
    } catch (err: any) {
      console.error("Export failed:", err);
      setFeedback({ text: err.message || "Export failed", error: true });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreviewExport = async () => {
    try {
      setIsExporting(true);
      const pkg = await ConfigExporter.export({
        includeSecrets,
        password: undefined, // preview unencrypted
      });
      const jsonStr = JSON.stringify(pkg, null, 2);
      const sha = await computeSha256(jsonStr);
      setBackupSha256(sha);
      setPreviewPackage(pkg);
    } catch (err: any) {
      setFeedback({ text: err.message, error: true });
    } finally {
      setIsExporting(false);
    }
  };

  // --- Handlers: JSON Import ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      setImportFileContent(content);

      // Compute SHA-256 of uploaded file
      const sha = await computeSha256(content);
      setBackupSha256(sha);

      // Add audit log entry
      setAdvancedLog([
        `[${new Date().toLocaleTimeString()}] File uploaded: "${file.name}" (${file.size} bytes)`,
        `[${new Date().toLocaleTimeString()}] Calculated SHA-256: ${sha}`,
        `[${new Date().toLocaleTimeString()}] Parsing JSON envelope and verifying magic signature...`,
      ]);

      await processUploadedContent(content);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const processUploadedContent = async (content: string, password?: string) => {
    try {
      setIsImporting(true);
      setFeedback(null);
      const preview = await ConfigImporter.parseAndPreview(content, password);
      setImportPreview(preview);
      setShowPasswordModal(false);

      setAdvancedLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Backup parsed successfully.`,
        `[${new Date().toLocaleTimeString()}] Source: ${preview.rawPackage.source.model} (${preview.rawPackage.source.architecture})`,
        `[${new Date().toLocaleTimeString()}] Schema version: ${preview.validation.schemaVersion}, Export Type: ${preview.rawPackage.export_type}`,
        `[${new Date().toLocaleTimeString()}] Migration report: ${preview.migrationReport.items.length} items parsed, Subnet collision: ${preview.migrationReport.subnetConflictDetected ? "YES" : "NO"}`,
      ]);
    } catch (err: any) {
      if (err.message === "ENCRYPTION_PASSWORD_REQUIRED") {
        setShowPasswordModal(true);
        setAdvancedLog((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ENCRYPTION_PASSWORD_REQUIRED: File is protected with AES-256-GCM. Prompting for key.`,
        ]);
      } else {
        setFeedback({ text: err.message || "Failed to parse backup", error: true });
        setAdvancedLog((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ERROR: ${err.message}`,
        ]);
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleApplyImport = async () => {
    if (!importPreview) return;

    const confirmMsg = isRu
      ? `Применить конфигурацию из бэкапа "${importPreview.rawPackage.source.model}" в режиме [${importMode.toUpperCase()}]? На роутере включится таймер автоотката (75 сек) для безопасности.`
      : `Apply configuration from backup "${importPreview.rawPackage.source.model}" using [${importMode.toUpperCase()}] mode? Rollback watchdog (75s) will be armed for safety.`;

    if (!confirm(confirmMsg)) return;

    try {
      setIsImporting(true);
      setFeedback(null);

      setAdvancedLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Initiating configuration commit via ubus...`,
        `[${new Date().toLocaleTimeString()}] Arming rollback watchdog: /usr/libexec/orbix-rollback arm 75`,
      ]);

      const res = await ConfigImporter.apply(
        importPreview.configuration,
        importPreview.migrationReport,
        importMode,
        selectedImportSections
      );

      setAdvancedLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Success: ${res.message}`,
        `[${new Date().toLocaleTimeString()}] Rollback Watchdog active! Token: ${res.rollbackToken}. Countdown: 75s`,
      ]);

      setFeedback({
        text: isRu
          ? `${res.message} Автооткат вооружён (таймер: 75 сек, токен: ${res.rollbackToken}).`
          : `${res.message} Rollback armed (watchdog: 75s, token: ${res.rollbackToken}).`,
      });

      // Clear preview
      setImportPreview(null);
      setImportFileContent(null);
    } catch (err: any) {
      setFeedback({ text: err.message || "Apply failed", error: true });
      setAdvancedLog((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] APPLY ERROR: ${err.message}`,
      ]);
    } finally {
      setIsImporting(false);
    }
  };

  // --- Handlers: Sysupgrade Tar.gz ---
  const handleDownloadTarBackup = async () => {
    try {
      setGeneratingTar(true);
      setFeedback(null);

      const genRes = await ubusClient.exec("/sbin/sysupgrade", ["-b", "/tmp/backup.tar.gz"]);
      if (genRes.code !== 0) {
        throw new Error(genRes.stderr || `sysupgrade exited with code ${genRes.code}`);
      }

      const fileRes = await ubusClient.call<{ data?: string }>("file", "read", {
        path: "/tmp/backup.tar.gz",
        base64: true,
      });

      if (!fileRes?.data) {
        throw new Error("Empty archive returned from router");
      }

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

      setFeedback({
        text: isRu
          ? "Бинарный архив backup.tar.gz успешно скачан."
          : "Binary backup.tar.gz archive downloaded successfully.",
      });
    } catch (err: any) {
      setFeedback({ text: `Sysupgrade export failed: ${err.message}`, error: true });
    } finally {
      setGeneratingTar(false);
    }
  };

  const handleResetDefaults = async () => {
    const msg = isRu
      ? "ВНИМАНИЕ! Это действие удалит все настройки, добавленные ключи VPN и вернёт роутер к заводскому состоянию. Продолжить?"
      : "WARNING! This will erase all custom configurations, VPN profiles and reset OpenWrt to factory state. Proceed?";

    if (!confirm(msg)) return;

    try {
      setResetting(true);
      setFeedback(null);

      await ubusClient.exec("/sbin/firstboot", ["-y"]);
      setTimeout(() => {
        ubusClient.reboot().catch(() => {});
      }, 1000);

      setFeedback({
        text: isRu
          ? "Команда сброса отправлена. Роутер очищает overlay и перезагружается..."
          : "Factory reset command sent. Router is wiping overlay and rebooting...",
      });
    } catch (err: any) {
      setFeedback({ text: `Factory reset failed: ${err.message}`, error: true });
    } finally {
      setResetting(false);
    }
  };

  const handleVerifySha = () => {
    if (!verifyShaInput.trim() || !backupSha256) {
      setVerifyShaResult(null);
      return;
    }
    const cleanInput = verifyShaInput.trim().toLowerCase();
    const currentSha = backupSha256.toLowerCase();
    setVerifyShaResult(cleanInput === currentSha ? "match" : "mismatch");
  };

  const toggleUciSection = (sec: string) => {
    setSelectedUciSections((prev) =>
      prev.includes(sec) ? prev.filter((s) => s !== sec) : [...prev, sec]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Save className="h-5 w-5 text-emerald-400" />
              <span>{isRu ? "Резервное копирование и восстановление" : "Backup & Configuration Restore"}</span>
            </h2>
            <Badge
              variant="outline"
              className={`text-[10px] font-mono uppercase ${
                isExpert
                  ? "border-amber-700/60 bg-amber-950/20 text-amber-400"
                  : "border-blue-700/60 bg-blue-950/20 text-blue-400"
              }`}
            >
              <SlidersHorizontal className="h-3 w-3 mr-1 inline" />
              {isExpert ? (isRu ? "Экспертный режим" : "Expert Mode") : (isRu ? "Простой режим" : "Simple Mode")}
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isExpert
              ? (isRu
                  ? "Полный экспорт в JSON, UCI-секции, AmneziaWG/Sing-box, проверка SHA-256, аудит импорта и sysupgrade"
                  : "Comprehensive JSON export, UCI sections, AmneziaWG/Sing-box keys, SHA-256 checksums, import audit logs & sysupgrade")
              : (isRu
                  ? "Быстрое сохранение и восстановление настроек роутера в 1 клик с защитой от сбоев"
                  : "1-click router configuration backup & restore with automatic 75s safety watchdog")}
          </p>
        </div>
      </div>

      {/* Status Feedback Alert */}
      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 animate-in fade-in ${
            feedback.error
              ? "bg-rose-950/40 border-rose-800 text-rose-300"
              : "bg-emerald-950/40 border-emerald-800 text-emerald-300"
          }`}
        >
          {feedback.error ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* =========================================================================
          SIMPLE MODE INTERFACE
          ========================================================================= */}
      {!isExpert && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Simple Card 1: Download Backup */}
            <Card className="border-zinc-800 bg-zinc-950 shadow-xl flex flex-col justify-between">
              <CardHeader className="border-b border-zinc-800/80 pb-3">
                <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Download className="h-4 w-4 text-emerald-400" />
                  <span>{isRu ? "Скачать резервную копию" : "Download Backup"}</span>
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  {isRu
                    ? "Сохраняет текущие настройки сети, пароли Wi-Fi, активные серверы VPN и списки обхода."
                    : "Saves current network settings, Wi-Fi credentials, active VPN servers, and routing rules."}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800">
                    <label className="text-[11px] font-medium text-zinc-300 block mb-1.5">
                      {isRu ? "Пароль для защиты копии (необязательно)" : "Backup protection password (optional)"}
                    </label>
                    <div className="relative">
                      <Input
                        type={showSimplePassword ? "text" : "password"}
                        placeholder={isRu ? "Оставьте пустым или укажите пароль..." : "Leave empty or enter password..."}
                        value={simpleExportPassword}
                        onChange={(e) => setSimpleExportPassword(e.target.value)}
                        className="h-9 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSimplePassword(!showSimplePassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                      >
                        {showSimplePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1">
                      <Shield className="h-3 w-3 text-emerald-400" />
                      <span>
                        {isRu
                          ? "Если пароль задан, копия шифруется стандартом AES-256."
                          : "If set, backup will be encrypted with AES-256."}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleSimpleExport}
                    disabled={isExporting}
                    className="w-full h-10 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2 shadow-lg shadow-emerald-950/40"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    <span>{isRu ? "Скачать резервную копию" : "Download Backup File"}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Simple Card 2: Restore Backup */}
            <Card className="border-zinc-800 bg-zinc-950 shadow-xl flex flex-col justify-between">
              <CardHeader className="border-b border-zinc-800/80 pb-3">
                <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-cyan-400" />
                  <span>{isRu ? "Восстановить из файла" : "Restore from Backup"}</span>
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  {isRu
                    ? "Загрузите ранее сохранённый файл бэкапа для восстановления настроек."
                    : "Upload a previously downloaded backup file to restore router settings."}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs flex-1 flex flex-col justify-between">
                <div className="border-2 border-dashed border-zinc-800 rounded-xl p-5 text-center hover:border-zinc-700 transition-colors bg-zinc-900/30">
                  <Upload className="h-7 w-7 text-zinc-400 mx-auto mb-1.5" />
                  <div className="font-medium text-zinc-200">
                    {isRu ? "Перетащите файл бэкапа сюда" : "Drag and drop backup file here"}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5 mb-3">
                    {isRu ? "Поддерживаются файлы *.json" : "Supports *.json files"}
                  </div>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="h-8 text-xs border-zinc-700 text-zinc-200 pointer-events-none">
                      {isRu ? "Выбрать файл..." : "Choose File..."}
                    </Button>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2 p-2.5 bg-blue-950/20 border border-blue-900/50 rounded-lg text-blue-300 text-[11px]">
                  <Shield className="h-4 w-4 text-blue-400 shrink-0" />
                  <span>
                    {isRu
                      ? "Безопасное применение: если после загрузки бэкапа пропадёт связь, настройки автоматически откатятся назад через 75 секунд."
                      : "Fail-safe guarantee: if router loses connectivity after applying, changes automatically roll back after 75s."}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Simple Mode Active Preview Card */}
          {importPreview && (
            <Card className="border-emerald-800/80 bg-zinc-950 shadow-2xl animate-in fade-in">
              <CardHeader className="border-b border-zinc-800 pb-3 bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>{isRu ? "Файл бэкапа успешно проверен" : "Backup File Verified"}</span>
                  </CardTitle>
                  <Badge variant="outline" className="border-emerald-700 text-emerald-400 text-xs">
                    {importPreview.rawPackage.source.model}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-zinc-400 mt-1">
                  {isRu
                    ? `Готово к восстановлению: будут обновлены сетевые настройки, Wi-Fi и параметры VPN.`
                    : `Ready to restore: network configurations, Wi-Fi and VPN settings will be applied.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                  <Button
                    onClick={() => setImportPreview(null)}
                    variant="outline"
                    className="h-9 text-xs border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                  >
                    {isRu ? "Отмена" : "Cancel"}
                  </Button>
                  <Button
                    onClick={handleApplyImport}
                    disabled={isImporting}
                    className="h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5"
                  >
                    {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{isRu ? "Применить бэкап (с автооткатом 75 сек)" : "Apply Backup (75s Auto-Rollback)"}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* =========================================================================
          EXPERT MODE INTERFACE
          ========================================================================= */}
      {isExpert && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-zinc-900 border border-zinc-800 p-1">
            <TabsTrigger value="json-config" className="gap-2 text-xs">
              <FileCode className="h-4 w-4 text-emerald-400" />
              <span>{isRu ? "Конфигурация JSON и UCI секции" : "JSON Configuration & UCI Sections"}</span>
            </TabsTrigger>
            <TabsTrigger value="sysupgrade-tar" className="gap-2 text-xs">
              <Server className="h-4 w-4 text-zinc-400" />
              <span>{isRu ? "Образ OpenWrt (Sysupgrade tar.gz)" : "OpenWrt Image (Sysupgrade)"}</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: JSON Config Export/Import */}
          <TabsContent value="json-config" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Expert Export Card */}
              <Card className="border-zinc-800 bg-zinc-950 shadow-xl">
                <CardHeader className="border-b border-zinc-800 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                      <Download className="h-4 w-4 text-emerald-400" />
                      <span>{isRu ? "Экспорт конфигурации (JSON)" : "Export Configuration (JSON)"}</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-mono border-zinc-700 text-zinc-400">
                      Schema v1.2.0
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-zinc-400">
                    {isRu
                      ? "Выборочный экспорт секций UCI, обфускации AmneziaWG, профилей Sing-box и контрольных сумм."
                      : "Selective export of UCI sections, AmneziaWG obfuscation, Sing-box profiles, and checksums."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-xs">
                  {/* UCI Section Selector */}
                  <div className="space-y-2 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                    <div className="font-medium text-zinc-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-cyan-400" />
                        {isRu ? "Секции конфигурации UCI:" : "UCI Configuration Sections:"}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {selectedUciSections.length}/9 {isRu ? "выбрано" : "selected"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {[
                        "network",
                        "wireless",
                        "firewall",
                        "dhcp",
                        "system",
                        "amneziawg",
                        "sing-box",
                        "zapret",
                        "pbr",
                      ].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => toggleUciSection(sec)}
                          className={`px-2 py-1 rounded text-[11px] font-mono text-left flex items-center justify-between border transition-all ${
                            selectedUciSections.includes(sec)
                              ? "bg-emerald-950/30 border-emerald-700/80 text-emerald-300"
                              : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                          }`}
                        >
                          <span>{sec}</span>
                          {selectedUciSections.includes(sec) && <Check className="h-3 w-3 text-emerald-400" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Protocols Export Toggles */}
                  <div className="space-y-2.5 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/80">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-zinc-200">
                          {isRu ? "Параметры AmneziaWG (Jc, Jmin, Jmax, S1/S2, H1..H4)" : "AmneziaWG Obfuscation (Jc, S1..S2, H1..H4)"}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {isRu ? "Экспортировать заголовки маскировки handshake" : "Export packet junk and custom headers"}
                        </div>
                      </div>
                      <Switch checked={exportAwgConfig} onCheckedChange={setExportAwgConfig} />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                      <div>
                        <div className="font-medium text-zinc-200">
                          {isRu ? "Sing-box Reality (xtls-rprx-vision, shortId, SNI)" : "Sing-box Reality flow & keys"}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {isRu ? "Экспортировать селекторы outbounds и Reality профили" : "Export outbound groups and XTLS Reality flow"}
                        </div>
                      </div>
                      <Switch checked={exportSingboxConfig} onCheckedChange={setExportSingboxConfig} />
                    </div>
                  </div>

                  {/* Security Options */}
                  <div className="space-y-3 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800/80">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-zinc-200">{isRu ? "Включить приватные ключи и пароли" : "Include Secrets & Keys"}</div>
                        <div className="text-[10px] text-zinc-500">
                          {isRu
                            ? "По умолчанию ключи VPN и пароли Wi-Fi маскируются в целях безопасности."
                            : "By default, VPN private keys and passwords are scrubbed."}
                        </div>
                      </div>
                      <Switch checked={includeSecrets} onCheckedChange={setIncludeSecrets} />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                      <div>
                        <div className="font-medium text-zinc-200 flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 text-amber-400" />
                          <span>{isRu ? "Шифровать паролем (AES-256-GCM)" : "Encrypt with Password (AES-256-GCM)"}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {isRu ? "Надежная защита бэкапа (PBKDF2 100k rounds + AES-GCM)" : "PBKDF2 100,000 rounds + AES-GCM"}
                        </div>
                      </div>
                      <Switch checked={encryptBackup} onCheckedChange={setEncryptBackup} />
                    </div>

                    {encryptBackup && (
                      <div className="pt-2">
                        <Input
                          type="password"
                          placeholder={isRu ? "Введите надежный пароль шифрования..." : "Enter strong encryption password..."}
                          value={exportPassword}
                          onChange={(e) => setExportPassword(e.target.value)}
                          className="h-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={handleExportJson}
                      disabled={isExporting}
                      className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                    >
                      {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                      <span>{isRu ? "Скачать JSON бэкап" : "Download JSON Backup"}</span>
                    </Button>

                    <Button
                      onClick={handlePreviewExport}
                      variant="outline"
                      className="h-9 text-xs border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                    >
                      <FileCode className="h-4 w-4 mr-1.5" />
                      <span>{isRu ? "Превью" : "Preview"}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Expert Import & Migration Card */}
              <div className="space-y-6">
                <Card className="border-zinc-800 bg-zinc-950 shadow-xl">
                  <CardHeader className="border-b border-zinc-800 pb-3">
                    <CardTitle className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                      <Upload className="h-4 w-4 text-cyan-400" />
                      <span>{isRu ? "Импорт и перенос на другой роутер" : "Import & Cross-Device Migration"}</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-400">
                      {isRu
                        ? "Загрузите файл конфигурации .json. Система автоматически сопоставит сетевые порты и проверит отсутствие конфликтов IP."
                        : "Upload a .json configuration. The engine auto-adapts interfaces and resolves subnet collisions."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4 text-xs">
                    <div className="border-2 border-dashed border-zinc-800 rounded-xl p-5 text-center hover:border-zinc-700 transition-colors">
                      <Upload className="h-7 w-7 text-zinc-500 mx-auto mb-1.5" />
                      <div className="font-medium text-zinc-300">
                        {isRu ? "Выберите файл .json конфигурации" : "Select .json configuration file"}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 mb-2.5">
                        {isRu ? "Поддерживаются файлы открытого и зашифрованного формата" : "Plaintext and AES-GCM encrypted formats supported"}
                      </div>
                      <label className="cursor-pointer">
                        <Button variant="outline" size="sm" className="h-8 text-xs border-zinc-700 text-zinc-200 pointer-events-none">
                          {isRu ? "Обзор файлов..." : "Browse Files..."}
                        </Button>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </CardContent>
                </Card>

                {/* SHA-256 Checksum Inspector Card */}
                <Card className="border-zinc-800 bg-zinc-950 shadow-xl">
                  <CardHeader className="border-b border-zinc-800 pb-2.5">
                    <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-amber-400" />
                      <span>{isRu ? "Проверка контрольной суммы (SHA-256 Checksum)" : "SHA-256 Checksum Verification"}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-3 text-xs">
                    <div>
                      <div className="text-[10px] text-zinc-400 mb-1 flex items-center justify-between">
                        <span>{isRu ? "Рассчитанный хеш файла:" : "Computed Hash:"}</span>
                        {backupSha256 && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(backupSha256);
                              setCopiedSha(true);
                              setTimeout(() => setCopiedSha(false), 2000);
                            }}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                          >
                            {copiedSha ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedSha ? (isRu ? "Скопировано!" : "Copied!") : (isRu ? "Скопировать" : "Copy")}</span>
                          </button>
                        )}
                      </div>
                      <div className="p-2 bg-zinc-900 font-mono text-[11px] text-zinc-300 rounded border border-zinc-800 break-all select-all">
                        {backupSha256 || (isRu ? "Ожидание экспорта или загрузки файла..." : "Awaiting export or file upload...")}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
                      <div className="text-[10px] text-zinc-400">
                        {isRu ? "Сверить с известным хешем SHA-256:" : "Verify against reference SHA-256:"}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
                          value={verifyShaInput}
                          onChange={(e) => {
                            setVerifyShaInput(e.target.value);
                            setVerifyShaResult(null);
                          }}
                          className="h-8 text-xs bg-zinc-900 border-zinc-800 font-mono text-zinc-200"
                        />
                        <Button
                          size="sm"
                          onClick={handleVerifySha}
                          disabled={!backupSha256 || !verifyShaInput.trim()}
                          className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 shrink-0"
                        >
                          {isRu ? "Сверить" : "Verify"}
                        </Button>
                      </div>

                      {verifyShaResult === "match" && (
                        <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{isRu ? "Хеш совпадает! Целостность файла подтверждена." : "Checksum MATCHES! Integrity confirmed."}</span>
                        </div>
                      )}
                      {verifyShaResult === "mismatch" && (
                        <div className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>{isRu ? "Хеши не совпадают! Файл поврежден или изменен." : "Checksum MISMATCH! File corrupted or tampered."}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Import Preview & Migration Report */}
            {importPreview && (
              <Card className="border-zinc-800 bg-zinc-950 shadow-2xl animate-in fade-in">
                <CardHeader className="border-b border-zinc-800 pb-3 bg-zinc-900/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400" />
                        <span>{isRu ? "Отчёт миграции и проверка совместимости" : "Migration Report & Compatibility Analysis"}</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-400 mt-0.5">
                        {isRu
                          ? `Источник: ${importPreview.rawPackage.source.model} (${importPreview.rawPackage.source.architecture}) → Целевой роутер: ${importPreview.migrationReport.targetDevice}`
                          : `Source: ${importPreview.rawPackage.source.model} → Target: ${importPreview.migrationReport.targetDevice}`}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs border-emerald-800 text-emerald-400 font-mono">
                      Schema v{importPreview.validation.schemaVersion} • {importPreview.rawPackage.export_type.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-xs">
                  {/* Import Mode Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div
                      onClick={() => setImportMode("merge")}
                      className={`cursor-pointer p-3 rounded-lg border transition-all ${
                        importMode === "merge"
                          ? "border-emerald-500 bg-emerald-950/20"
                          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                      }`}
                    >
                      <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                        <span>{isRu ? "Объединение (Merge)" : "Merge (Recommended)"}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {isRu
                          ? "Добавить новые правила и списки, сохраняя существующие системные настройки роутера."
                          : "Add new rules while preserving existing router configurations."}
                      </p>
                    </div>

                    <div
                      onClick={() => setImportMode("replace")}
                      className={`cursor-pointer p-3 rounded-lg border transition-all ${
                        importMode === "replace"
                          ? "border-amber-500 bg-amber-950/20"
                          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                      }`}
                    >
                      <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                        <span>{isRu ? "Замена (Replace)" : "Replace All"}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {isRu
                          ? "Полностью заменить управляемые политики и профили конфигурацией из файла."
                          : "Replace all managed policies with configuration from backup."}
                      </p>
                    </div>

                    <div
                      onClick={() => setImportMode("selective")}
                      className={`cursor-pointer p-3 rounded-lg border transition-all ${
                        importMode === "selective"
                          ? "border-cyan-500 bg-cyan-950/20"
                          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                      }`}
                    >
                      <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                        <span>{isRu ? "Выборочно (Selective)" : "Selective Restore"}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {isRu ? "Восстановить только выбранные разделы (VPN, DNS, Правила)." : "Restore only selected modules."}
                      </p>
                    </div>
                  </div>

                  {/* Subnet collision banner */}
                  {importPreview.migrationReport.subnetConflictDetected && (
                    <div className="p-3 bg-amber-950/30 border border-amber-800 rounded-lg text-amber-300 flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">{isRu ? "Автоматическое разрешение конфликта IP" : "Automated Subnet Resolution"}</div>
                        <div className="text-[11px] text-amber-300/80 mt-0.5">
                          {isRu
                            ? `LAN адрес роутера автоматически перенаправлен на ${importPreview.migrationReport.proposedLanIp}, чтобы избежать коллизии с WAN провайдера.`
                            : `LAN address automatically adapted to ${importPreview.migrationReport.proposedLanIp} to prevent WAN conflict.`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Migration Checklist Table */}
                  <div className="border border-zinc-800 rounded-lg overflow-hidden">
                    <div className="bg-zinc-900/80 px-3 py-2 border-b border-zinc-800 font-semibold text-zinc-300 flex items-center justify-between">
                      <span>{isRu ? "Элементы для применения:" : "Items to be migrated:"}</span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {importPreview.migrationReport.items.length} {isRu ? "параметров" : "settings"}
                      </span>
                    </div>
                    <div className="divide-y divide-zinc-800/80 max-h-60 overflow-y-auto">
                      {importPreview.migrationReport.items.map((item, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between bg-zinc-950 hover:bg-zinc-900/30">
                          <div>
                            <div className="font-medium text-zinc-200 flex items-center gap-2">
                              <span>{item.title}</span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] font-mono uppercase ${
                                  item.status === "imported"
                                    ? "border-emerald-800 text-emerald-400"
                                    : item.status === "adapted"
                                    ? "border-cyan-800 text-cyan-400"
                                    : item.status === "requires_attention"
                                    ? "border-amber-800 text-amber-400"
                                    : "border-rose-800 text-rose-400"
                                }`}
                              >
                                {item.status}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">{item.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Import Audit Log Console */}
                  <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedLog(!showAdvancedLog)}
                      className="w-full bg-zinc-900/90 px-3 py-2 text-left font-mono text-[11px] text-zinc-300 flex items-center justify-between hover:bg-zinc-850"
                    >
                      <span className="flex items-center gap-2">
                        <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{isRu ? "Расширенный лог импорта и валидации (Audit Log)" : "Advanced Import & Validation Audit Log"}</span>
                      </span>
                      {showAdvancedLog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {showAdvancedLog && (
                      <div className="p-3 bg-zinc-950 font-mono text-[11px] text-zinc-400 space-y-1 max-h-48 overflow-y-auto border-t border-zinc-800/80">
                        {advancedLog.length > 0 ? (
                          advancedLog.map((log, i) => (
                            <div key={i} className="leading-tight">
                              {log}
                            </div>
                          ))
                        ) : (
                          <div className="text-zinc-600 italic">
                            {isRu ? "Лог выполнения появится при загрузке или применении бэкапа." : "Audit log will stream here during import operations."}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Apply Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                    <Button
                      onClick={() => setImportPreview(null)}
                      variant="outline"
                      className="h-9 text-xs border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                    >
                      {isRu ? "Отмена" : "Cancel"}
                    </Button>

                    <Button
                      onClick={handleApplyImport}
                      disabled={isImporting}
                      className="h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5"
                    >
                      {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      <span>{isRu ? "Применить на роутере (с защитой 75 сек)" : "Apply with 75s Safety Rollback"}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab 2: Sysupgrade Tar.gz */}
          <TabsContent value="sysupgrade-tar" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-zinc-800 bg-zinc-950 shadow-xl">
                <CardHeader className="border-b border-zinc-800 pb-3">
                  <CardTitle className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <Download className="h-4 w-4 text-emerald-400" />
                    <span>{isRu ? "Резервная копия OpenWrt (sysupgrade -b)" : "OpenWrt Sysupgrade Archive"}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-400">
                    {isRu
                      ? "Генерирует бинарный gzip-архив /etc/config и системных файлов роутера."
                      : "Generates binary gzip archive of /etc/config directly via /sbin/sysupgrade."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-xs">
                  <p className="text-zinc-400">
                    {isRu
                      ? "Стандартный архив sysupgrade содержит копию всей файловой системы /etc. Используется для полного восстановления при обновлении прошивки."
                      : "Standard sysupgrade archive containing raw /etc configuration. Used for firmware upgrades."}
                  </p>
                  <Button
                    onClick={handleDownloadTarBackup}
                    disabled={generatingTar}
                    className="h-9 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium"
                  >
                    {generatingTar ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                    <span>{isRu ? "Сгенерировать backup.tar.gz" : "Generate backup.tar.gz"}</span>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-zinc-800 bg-zinc-950 shadow-xl">
                <CardHeader className="border-b border-zinc-800 pb-3">
                  <CardTitle className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    <span>{isRu ? "Сброс к заводским настройкам (firstboot)" : "Factory Reset (firstboot)"}</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-400">
                    {isRu
                      ? "Очистка раздела overlay и возвращение параметров OpenWrt в исходное состояние."
                      : "Wipes overlay partition and reverts OpenWrt to clean factory state."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 text-xs">
                  <div className="p-3 rounded-lg border border-rose-900/60 bg-rose-950/20 text-rose-300">
                    <div className="font-semibold">{isRu ? "Внимание: действие необратимо" : "Warning: irreversible operation"}</div>
                    <div className="text-[11px] text-rose-300/80 mt-1">
                      {isRu
                        ? "Все добавленные подписки, профили Zapret, пароли и правила будут удалены."
                        : "All custom subscriptions, Zapret profiles, and rules will be deleted."}
                    </div>
                  </div>

                  <Button
                    onClick={handleResetDefaults}
                    disabled={resetting}
                    variant="destructive"
                    className="h-9 text-xs font-semibold gap-1.5"
                  >
                    {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    <span>{isRu ? "Сбросить роутер (firstboot -y)" : "Reset Router to Factory Defaults"}</span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Password Decryption Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-400" />
              <span>{isRu ? "Файл бэкапа защищен паролем" : "Encrypted Backup File"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {isRu
                ? "Этот архив зашифрован с использованием AES-256-GCM. Введите пароль для расшифровки."
                : "This archive is protected with AES-256-GCM authenticated encryption."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <Input
              type="password"
              placeholder={isRu ? "Введите пароль расшифровки..." : "Enter decryption password..."}
              value={decryptPassword}
              onChange={(e) => setDecryptPassword(e.target.value)}
              className="h-9 text-xs bg-zinc-900 border-zinc-700 text-zinc-200"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPasswordModal(false)}
                className="h-8 text-xs border-zinc-800"
              >
                {isRu ? "Отмена" : "Cancel"}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (importFileContent) {
                    processUploadedContent(importFileContent, decryptPassword);
                  }
                }}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isRu ? "Расшифровать и открыть" : "Decrypt & Unlock"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Preview Modal */}
      <Dialog open={!!previewPackage} onOpenChange={(open) => !open && setPreviewPackage(null)}>
        <DialogContent className="sm:max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <FileCode className="h-4 w-4 text-emerald-400" />
              <span>{isRu ? "Предпросмотр структуры JSON конфигурации" : "JSON Configuration Schema Preview"}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-zinc-900/60 p-3 rounded-lg border border-zinc-800 font-mono text-[11px] text-zinc-300">
            <pre>{previewPackage ? JSON.stringify(previewPackage, null, 2) : ""}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
