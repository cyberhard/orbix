// Expert Mode Centralized Policy Engine View
import React, { useState } from "react";
import { usePolicyStore } from "@/store/policy-store";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Network, Plus, Trash2, AlertTriangle, CheckCircle2, Zap, Globe, Save, Search, Code, Info} from "lucide-react";
import { PolicyActionType } from "@/services/policy-engine/types";

export const PolicyEngineView: React.FC = () => {
  const { language } = useI18nStore();
  const isRu = language === "ru";
  const {policies, categories, conflicts, compiledConfig, addPolicy, deletePolicy, togglePolicy, applyPoliciesToRouter, isApplying} = usePolicyStore();

  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showCompiledModal, setShowCompiledModal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New policy form state
  const [formName, setFormName] = useState("");
  const [formPriority, setFormPriority] = useState(50);
  const [formSourceType] = useState<"all" | "device" | "group">("all");
  const [formSourceValue] = useState("");
  const [formDestType] = useState<"category" | "custom_domains">("category");
  const [formDestValue, setFormDestValue] = useState("category:restricted");
  const [formAction, setFormAction] = useState<PolicyActionType>("vpn_tunnel");
  const [formTarget] = useState("singbox");

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleApply = async () => {
    const res = await applyPoliciesToRouter();
    if (res.success) {
      showToast(isRu ? "Политики скомпилированы и применены на роутере с защитой Watchdog!" : "Policies deployed safely with Watchdog protection!");
    } else {
      showToast(res.message);
    }
  };

  const handleCreatePolicy = () => {
    if (!formName.trim()) {
      showToast(isRu ? "Введите название политики" : "Enter policy name");
      return;
    }

    const sourceValues =
      formSourceType === "all"
        ? []
        : formSourceValue
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter(Boolean);

    const destValues =
      formDestType === "category"
        ? [formDestValue]
        : formDestValue
            .split(/[\s,]+/)
            .map((d) => d.trim())
            .filter(Boolean);

    addPolicy({
      name: formName.trim(),
      enabled: true,
      priority: Number(formPriority) || 50,
      mode: "expert",
      source: {
        type: formSourceType,
        values: sourceValues,
      },
      destination: {
        type: formDestType,
        values: destValues,
      },
      action: {
        type: formAction,
        target: formTarget,
      },
    });

    setIsAddOpen(false);
    setFormName("");
    showToast(isRu ? "Новая политика добавлена!" : "New policy created!");
  };

  const filtered = policies.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.destination.values.some((v) => v.toLowerCase().includes(search.toLowerCase()))
  );

  const getActionBadge = (action: PolicyActionType, target?: string) => {
    switch (action) {
      case "zapret_dpi":
        return (
          <Badge variant="outline" className="bg-zinc-900 text-zinc-300 border-zinc-800 font-mono text-[10px] flex items-center gap-1">
            <Zap className="h-3 w-3 text-zinc-400" />
            <span>Zapret ({target?.replace("profile:", "") || "DPI"})</span>
          </Badge>
        );
      case "vpn_tunnel":
      case "vpn_group":
        return (
          <Badge className="bg-blue-950/80 text-blue-300 border border-blue-800/80 font-mono text-[10px] flex items-center gap-1">
            <Globe className="h-3 w-3" />
            <span>VPN ({target || "singbox"})</span>
          </Badge>
        );
      case "direct_wan":
      case "default":
        return (
          <Badge variant="outline" className="font-mono text-[10px] bg-zinc-900 border-zinc-800 text-zinc-300">
            Direct WAN
          </Badge>
        );
      case "block":
        return (
          <Badge variant="destructive" className="font-mono text-[10px]">
            BLOCK (Drop)
          </Badge>
        );
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase tracking-wider">
              {isRu ? "Экспертный режим" : "Expert Mode"}
            </span>
            <h2 className="text-base font-bold text-zinc-100">
              {isRu ? "Единый движок сетевых политик (Policy Engine)" : "Unified Network Policy Engine"}
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {isRu
              ? "Единый источник истины: детерминированная компиляция правил в Sing-box, PBR, Zapret и DNSmasq."
              : "Single source of truth: deterministic policy compiler translating rules into Sing-box, PBR, Zapret, and DNSmasq."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCompiledModal(true)}
            className="text-xs h-8 border-zinc-800 bg-zinc-950 text-zinc-300 gap-1.5"
          >
            <Code className="h-3.5 w-3.5 text-zinc-400" />
            {isRu ? "Превью компилятора" : "Compiled Diff"}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="text-xs h-8 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-medium gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            {isRu ? "Добавить политику" : "Add Policy"}
          </Button>

          <Button
            size="sm"
            onClick={handleApply}
            disabled={isApplying}
            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-medium shadow-md shadow-emerald-950/40"
          >
            <Save className={`h-3.5 w-3.5 ${isApplying ? "animate-spin" : ""}`} />
            {isApplying ? (isRu ? "Применение..." : "Applying...") : (isRu ? "Применить в ядро" : "Apply to Kernel")}
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Conflicts & Shadowing Banner */}
      {conflicts.length > 0 && (
        <div className="space-y-2">
          {conflicts.map((c) => (
            <div
              key={c.id}
              className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                c.severity === "error"
                  ? "border-red-500/40 bg-red-950/20 text-red-300"
                  : "border-amber-500/40 bg-amber-950/20 text-amber-300"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{isRu ? "Обнаружен конфликт приоритетов:" : "Policy Conflict Detected:"}</span>
              </div>
              <p className="text-[11px] text-zinc-300">{isRu ? c.messageRu : c.message}</p>
              <div className="pt-1 text-[11px] text-zinc-300 font-medium flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <span>{isRu ? "Рекомендация:" : "Recommendation:"} {isRu ? c.recommendationRu : c.recommendation}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Policies Table */}
      <Card className="border-zinc-800 bg-zinc-950 shadow-md">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Network className="h-4 w-4 text-zinc-400" />
              <span>{isRu ? "Активные политики в порядке исполнения (Сверху вниз)" : "Active Policies (Evaluation Priority Order)"}</span>
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isRu ? "Фильтр правил..." : "Search policies..."}
                className="pl-8 h-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-100"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="w-12 text-center text-xs font-mono text-zinc-400">#</TableHead>
                <TableHead className="text-xs font-medium text-zinc-400">
                  {isRu ? "Политика / Название" : "Policy Name"}
                </TableHead>
                <TableHead className="text-xs font-medium text-zinc-400">
                  {isRu ? "Источник (Клиенты)" : "Source (Clients)"}
                </TableHead>
                <TableHead className="text-xs font-medium text-zinc-400">
                  {isRu ? "Целевые домены / Категории" : "Destinations / Feeds"}
                </TableHead>
                <TableHead className="text-xs font-medium text-zinc-400">
                  {isRu ? "Действие / Шлюз" : "Action / Outbound"}
                </TableHead>
                <TableHead className="w-20 text-center text-xs font-medium text-zinc-400">
                  {isRu ? "Статус" : "Status"}
                </TableHead>
                <TableHead className="w-16 text-right text-xs font-medium text-zinc-400">
                  {isRu ? "Удалить" : "Delete"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((policy) => (
                <TableRow
                  key={policy.id}
                  className={`border-zinc-800/80 hover:bg-zinc-900/40 transition-colors ${
                    !policy.enabled ? "opacity-50" : ""
                  }`}
                >
                  <TableCell className="text-center font-mono text-xs font-bold text-zinc-300">
                    {policy.priority}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-zinc-100">{policy.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono truncate max-w-xs">
                        {policy.id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono text-zinc-300">
                      {policy.source.type === "all" ? (isRu ? "Все устройства" : "All Devices") : policy.source.values.join(", ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-sm">
                      {policy.destination.values.map((d) => (
                        <span
                          key={d}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300 truncate"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getActionBadge(policy.action.type, policy.action.target)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={policy.enabled}
                      onCheckedChange={() => togglePolicy(policy.id)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {!policy.isSystem && (
                      <button
                        onClick={() => deletePolicy(policy.id)}
                        className="text-zinc-600 hover:text-red-400 transition-colors"
                        title={isRu ? "Удалить правило" : "Delete rule"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Policy Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-zinc-400" />
              {isRu ? "Создать новую сетевую политику" : "Create New Network Policy"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {isRu
                ? "Политика будет автоматически транслирована в Sing-box, PBR, Zapret и DNS"
                : "The policy will be compiled deterministically into Sing-box, PBR, Zapret, and DNSmasq"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <label className="text-zinc-400 font-medium">{isRu ? "Название правила" : "Rule Name"}</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Work Laptop via Finland VPN"
                className="h-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">{isRu ? "Приоритет (меньше = выше)" : "Priority (1-990)"}</label>
                <Input
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(Number(e.target.value))}
                  className="h-8 text-xs font-mono bg-zinc-900 border-zinc-800 text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">{isRu ? "Действие (Action)" : "Action"}</label>
                <select
                  value={formAction}
                  onChange={(e) => setFormAction(e.target.value as any)}
                  className="w-full h-8 text-xs bg-zinc-900 border border-zinc-800 rounded px-2 text-zinc-200"
                >
                  <option value="vpn_tunnel">VPN Tunnel (Sing-box)</option>
                  <option value="zapret_dpi">Zapret DPI Desync</option>
                  <option value="direct_wan">Direct WAN (Bypass)</option>
                  <option value="block">Block Traffic (Drop)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-zinc-400 font-medium">{isRu ? "Целевая категория доменов" : "Destination Feeds"}</label>
              <select
                value={formDestValue}
                onChange={(e) => setFormDestValue(e.target.value)}
                className="w-full h-8 text-xs bg-zinc-900 border border-zinc-800 rounded px-2 text-zinc-200"
              >
                {categories.map((c) => (
                  <option key={c.id} value={`category:${c.id}`}>
                    {c.nameRu} ({c.domains.length} доменов)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)} className="text-xs">
              {isRu ? "Отмена" : "Cancel"}
            </Button>
            <Button size="sm" onClick={handleCreatePolicy} className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-medium">
              {isRu ? "Создать политику" : "Create Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compiled Diff Modal */}
      <Dialog open={showCompiledModal} onOpenChange={setShowCompiledModal}>
        <DialogContent className="sm:max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Code className="h-4 w-4 text-zinc-400" />
              {isRu ? "Скомпилированные конфигурации ядра" : "Compiled Backend Artifacts"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {isRu
                ? "Фактический вид конфигураций, генерируемых движком для демонов роутера"
                : "Active configuration artifacts compiled by the engine for Sing-box, PBR, and Zapret"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[420px] overflow-y-auto font-mono text-[11px]">
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <span className="text-zinc-200 font-bold block mb-1">Sing-box Route Rules (config.json):</span>
              <pre className="text-zinc-300 whitespace-pre-wrap">
                {JSON.stringify(compiledConfig.singboxRules, null, 2)}
              </pre>
            </div>

            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <span className="text-blue-400 font-bold block mb-1">Zapret Google Hostlist (list-google.txt):</span>
              <div className="text-zinc-300">
                {compiledConfig.zapretHostlists.google.slice(0, 10).join(", ")}...
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
