import React, { useState, useEffect } from "react";
import { useSubscriptionStore } from "@/store/subscription-store";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  RefreshCw,
  Globe,
  Zap,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Layers,
  Settings2,
  Trash2,
  Info,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";

export const SubscriptionsView: React.FC = () => {
  const {
    url,
    apiKey,
    metadata,
    nodes,
    activeNodeId,
    isSyncing,
    isTestingLatency,
    error,
    setUrl,
    setApiKey,
    syncSubscription,
    setActiveNode,
    setSelectionMode,
    setAutoUpdateInterval,
    testAllLatencies,
    deleteNode,
    deleteSubscription,
  } = useSubscriptionStore();

  const { language } = useI18nStore();
  const isRu = language === "ru";

  const [inputUrl, setInputUrl] = useState(url);
  const [inputApiKey, setInputApiKey] = useState(apiKey);
  const [showConfig, setShowConfig] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setInputUrl(url);
    setInputApiKey(apiKey);
  }, [url, apiKey]);

  const showFeedbackToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSaveAndSync = async () => {
    const success = await syncSubscription(inputUrl, inputApiKey);
    if (success) {
      showFeedbackToast(isRu ? "Узлы подписки успешно загружены!" : "Subscription synced successfully!");
    }
  };

  const handleDeleteSubscription = () => {
    const confirmed = window.confirm(
      isRu
        ? "Вы уверены, что хотите удалить эту подписку и очистить список серверов?"
        : "Are you sure you want to delete this subscription and clear all nodes?"
    );
    if (confirmed) {
      deleteSubscription();
      setInputUrl("");
      showFeedbackToast(isRu ? "Подписка удалена." : "Subscription deleted.");
    }
  };

  const handleDeleteNode = (id: string, name: string) => {
    deleteNode(id);
    showFeedbackToast(isRu ? `Узел "${name}" удален.` : `Node "${name}" removed.`);
  };

  const handleSelectNode = async (id: string, name: string) => {
    const ok = await setActiveNode(id);
    if (ok) {
      showFeedbackToast(isRu ? `Активный сервер переключен на "${name}"` : `Active node switched to "${name}"`);
    }
  };

  // Quota calculation
  const usedBytes = (metadata.uploadBytes || 0) + (metadata.downloadBytes || 0);
  const totalBytes = metadata.totalBytes || 107374182400; // 100 GB default if 0
  const quotaPercent = Math.min(100, Math.round((usedBytes / totalBytes) * 100));

  const formatExpiration = (ts: number) => {
    if (!ts || ts === 0) return isRu ? "Бессрочно" : "Unlimited";
    const date = new Date(ts * 1000);
    const now = Date.now();
    const daysLeft = Math.max(0, Math.ceil((date.getTime() - now) / (1000 * 60 * 60 * 24)));
    const formatted = date.toLocaleDateString(isRu ? "ru-RU" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return `${formatted} (${daysLeft} ${isRu ? "дн. осталось" : "days left"})`;
  };

  const getLatencyBadge = (ms?: number) => {
    if (!ms || ms === 0) return <span className="text-zinc-500 font-mono text-xs">-</span>;
    let colorClass = "text-emerald-400 bg-emerald-950/40 border-emerald-800/50";
    if (ms > 100) {
      colorClass = "text-red-400 bg-red-950/40 border-red-800/50";
    } else if (ms > 60) {
      colorClass = "text-amber-400 bg-amber-950/40 border-amber-800/50";
    }
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono tabular-nums border ${colorClass}`}
      >
        <span className="h-1 w-1 rounded-full bg-current" />
        {ms} ms
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
            <Globe className="h-5 w-5 text-zinc-400" />
            {isRu ? "Подписки Happ VPN и декодер" : "Happ VPN Subscriptions & Decoder"}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {isRu
              ? "Декодирование зашифрованных подписок happ://, синхронизация с Sing-box VLESS и учет квоты"
              : "Encrypted subscriptions decoding, automated Sing-box VLESS synchronization, and quota management"}
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
          {url && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteSubscription}
              className="text-xs border-red-900/60 bg-red-950/20 text-red-400 hover:bg-red-900/40 hover:text-red-200 gap-1.5 flex-1 sm:flex-initial h-8"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isRu ? "Удалить подписку" : "Delete Sub"}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
            className="text-xs border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 gap-1.5 flex-1 sm:flex-initial h-8"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {isRu ? "Настройки API" : "Decoder Settings"}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleSaveAndSync}
            disabled={isSyncing}
            className="text-xs bg-zinc-100 text-zinc-950 hover:bg-white font-medium gap-1.5 shadow-sm flex-1 sm:flex-initial h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing
              ? isRu
                ? "Синхронизация..."
                : "Syncing..."
              : isRu
              ? "Синхронизировать"
              : "Sync Now"}
          </Button>
        </div>
      </div>

      {/* Success / Feedback Toast */}
      {feedback && (
        <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 text-xs text-emerald-300 flex items-center gap-2.5 animate-in fade-in-50 duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Provider Announce Notice */}
      {metadata.announce && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300 flex items-start gap-2.5">
          <Info className="h-4 w-4 shrink-0 text-zinc-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-zinc-200">{isRu ? "Объявление провайдера" : "Provider Notice"}:</span>
            <p className="text-zinc-400 font-mono text-[11px] whitespace-pre-line">{metadata.announce}</p>
          </div>
        </div>
      )}

      {/* Error / Rate Limit Alert */}
      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* URL & API Config drawer */}
      {showConfig && (
        <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-zinc-200">
              {isRu ? "Параметры источника подписки" : "Subscription Source & Decoder Settings"}
            </CardTitle>
            <CardDescription className="text-[11px] text-zinc-400">
              {isRu
                ? "Поддерживаются ссылки happ://crypt/ ... happ://crypt5/, happ://add/<url> и прямые ссылки https://"
                : "Supports happ://crypt/ through happ://crypt5/, happ://add/<url>, and standard https:// subscription URLs"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-zinc-300">
                {isRu ? "URL адрес подписки" : "Subscription URL"}
              </label>
              <Input
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://... or happ://crypt5/..."
                className="h-8 text-xs font-mono bg-zinc-950 border-zinc-800 text-zinc-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-zinc-300">
                {isRu ? "API-ключ Happy Decoder (https://happy-decoder.cc)" : "Happy Decoder API Key"}
              </label>
              <Input
                value={inputApiKey}
                onChange={(e) => setInputApiKey(e.target.value)}
                placeholder="hd_..."
                className="h-8 text-xs font-mono bg-zinc-950 border-zinc-800 text-zinc-200"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAndSync}
                disabled={isSyncing}
                className="text-xs border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              >
                {isRu ? "Сохранить и загрузить узлы" : "Save & Sync Nodes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription KPI & Quota Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Profile Card */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">
                {isRu ? "Профиль подписки" : "Subscription Profile"}
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div>
              <div className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                {metadata.profileTitle || "DzenVPN"}
              </div>
              <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5" title={url}>
                {url}
              </p>
            </div>
            <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/80">
              <span>{isRu ? "Серверов в пуле" : "Decoded servers"}</span>
              <span className="font-mono font-medium text-zinc-200 tabular-nums">
                {nodes.length}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Quota Progress Card */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">
                {isRu ? "Использовано трафика" : "Data Quota Usage"}
              </span>
              <span className="text-[11px] font-mono text-zinc-300 tabular-nums">
                {quotaPercent}%
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold font-mono tabular-nums text-zinc-100">
                {formatBytes(usedBytes)} / {formatBytes(totalBytes)}
              </div>
              <div className="mt-2">
                <Progress value={quotaPercent} className="h-1.5 bg-zinc-800" />
              </div>
            </div>
            <div className="pt-1 flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-800/80 font-mono">
              <span>TX: {formatBytes(metadata.uploadBytes || 0)}</span>
              <span>RX: {formatBytes(metadata.downloadBytes || 0)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Expiration & Schedule Card */}
        <Card className="border-zinc-800 bg-zinc-900/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">
                {isRu ? "Срок действия" : "Subscription Expiration"}
              </span>
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-200">
                {formatExpiration(metadata.expireTimestamp)}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">
                {isRu ? "Последнее обновление: " : "Last updated: "}
                {metadata.lastUpdated
                  ? new Date(metadata.lastUpdated * 1000).toLocaleTimeString()
                  : "-"}
              </div>
            </div>
            <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/80">
              <span>{isRu ? "Автообновление" : "Auto-update"}</span>
              <Select
                value={metadata.autoUpdateInterval || "6h"}
                onValueChange={(val: any) => setAutoUpdateInterval(val)}
              >
                <SelectTrigger className="h-6 w-24 text-[10px] bg-zinc-950 border-zinc-800 text-zinc-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-300">
                  <SelectItem value="disabled">{isRu ? "Отключено" : "Disabled"}</SelectItem>
                  <SelectItem value="6h">6 {isRu ? "часов" : "hours"}</SelectItem>
                  <SelectItem value="12h">12 {isRu ? "часов" : "hours"}</SelectItem>
                  <SelectItem value="24h">24 {isRu ? "часа" : "hours"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control bar: Mode Selection + Test Latency */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-zinc-300">
            {isRu ? "Режим выбора узла:" : "Server Selection Mode:"}
          </span>
          <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-md border border-zinc-800">
            <button
              onClick={() => setSelectionMode("manual")}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                metadata.selectionMode === "manual"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {isRu ? "Ручной выбор" : "Manual"}
            </button>
            <button
              onClick={() => setSelectionMode("auto_best")}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                metadata.selectionMode === "auto_best"
                  ? "bg-zinc-800 text-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {isRu ? "Автовыбор лучшего (Пинг)" : "Auto Best (Ping)"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testAllLatencies}
            disabled={isTestingLatency}
            className="text-xs border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 gap-1.5"
          >
            <Zap className={`h-3 w-3 text-amber-400 ${isTestingLatency ? "animate-bounce" : ""}`} />
            {isTestingLatency
              ? isRu
                ? "Замер задержки..."
                : "Testing latency..."
              : isRu
              ? "Проверить пинг узлов"
              : "Test Latencies"}
          </Button>
        </div>
      </div>

      {/* Decoded Server Nodes Table */}
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xs font-medium text-zinc-200 flex items-center gap-2">
                <Layers className="h-4 w-4 text-zinc-400" />
                {isRu ? "Узлы подписки Sing-box VLESS" : "Decoded Sing-box VLESS Outbounds"}
              </CardTitle>
              <CardDescription className="text-[11px] text-zinc-500 mt-0.5">
                {isRu
                  ? "Выберите узел для переключения исходящего шлюза Sing-box в OpenWrt"
                  : "Select an outbound node to switch the active Sing-box routing gateway"}
              </CardDescription>
            </div>
            <div className="text-[11px] font-mono text-zinc-400">
              {nodes.length} {isRu ? "серверов" : "servers"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-3 py-1.5 bg-zinc-950/60 border-b border-zinc-800/60 text-[10px] text-zinc-500 font-mono sm:hidden">
            {isRu ? "← Прокрутите таблицу по горизонтали →" : "← Scroll table horizontally →"}
          </div>
          <Table className="min-w-[620px]">
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="w-10 text-center text-zinc-500"></TableHead>
                <TableHead className="text-xs text-zinc-400 font-medium">
                  {isRu ? "Название сервера" : "Server Name"}
                </TableHead>
                <TableHead className="text-xs text-zinc-400 font-medium">
                  {isRu ? "Адрес и порт" : "Endpoint"}
                </TableHead>
                <TableHead className="text-xs text-zinc-400 font-medium">
                  {isRu ? "Протокол / Защита" : "Protocol / Security"}
                </TableHead>
                <TableHead className="text-xs text-zinc-400 font-medium text-right">
                  {isRu ? "Задержка" : "Latency"}
                </TableHead>
                <TableHead className="w-24 text-right text-zinc-400 font-medium text-xs">
                  {isRu ? "Действие" : "Action"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.map((node) => {
                const isActive = node.id === activeNodeId || node.active;
                return (
                  <TableRow
                    key={node.id}
                    className={`border-zinc-800/80 transition-colors ${
                      isActive ? "bg-zinc-900/90 font-medium" : "hover:bg-zinc-900/40"
                    }`}
                  >
                    <TableCell className="text-center">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          isActive ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-zinc-700"
                        }`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-200 flex items-center gap-1.5">
                          {node.name}
                          {isActive && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 h-4 border-emerald-800 text-emerald-400 bg-emerald-950/30"
                            >
                              {isRu ? "Активен" : "Active"}
                            </Badge>
                          )}
                        </span>
                        {node.sni && (
                          <span className="text-[10px] font-mono text-zinc-500">
                            SNI: {node.sni}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-zinc-400 tabular-nums">
                        {node.server}:{node.port}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-300">
                        <span className="uppercase">{node.transport || "tcp"}</span>
                        <span className="text-zinc-600">/</span>
                        <span className="uppercase text-zinc-400">{node.security || "reality"}</span>
                        {node.flow && (
                          <span className="text-[10px] text-zinc-500 ml-1">({node.flow})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {getLatencyBadge(node.latency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={isActive ? "outline" : "ghost"}
                        size="sm"
                        disabled={isActive}
                        onClick={() => setActiveNode(node.id)}
                        className={`h-7 px-2.5 text-xs ${
                          isActive
                            ? "border-emerald-800/60 text-emerald-400 bg-emerald-950/20 cursor-default"
                            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                        }`}
                      >
                        {isActive ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            {isRu ? "Выбран" : "Selected"}
                          </span>
                        ) : (
                          isRu ? "Выбрать" : "Select"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};