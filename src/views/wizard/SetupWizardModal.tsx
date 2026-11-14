import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Router,
  Cpu,
  Wifi,
  Shield,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Radio,
  Server,
  Globe,
  Check,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { useWizardStore, WizardStep } from "@/services/wizard/wizard-store";
import { useI18nStore } from "@/store/i18n-store";

export const SetupWizardModal: React.FC = () => {
  const {
    isOpen,
    isCompleted,
    currentStep,
    hardware,
    isLoadingHardware,
    draft,
    isApplying,
    applyProgress,
    error,
    setStep,
    setSetupMode,
    updateDraft,
    loadHardware,
    applyWizard,
    closeWizard,
  } = useWizardStore();

  const { lang } = useI18nStore();
  const isRu = lang === "ru";

  const [showPassword, setShowPassword] = useState(false);
  const [showWifiPassword, setShowWifiPassword] = useState(false);

  // Subnet conflict check in real time
  const hasSubnetConflict =
    hardware?.network.detectedWanIp &&
    draft.lanIp &&
    hardware.network.detectedWanIp.split(".").slice(0, 3).join(".") ===
      draft.lanIp.split(".").slice(0, 3).join(".");

  const stepsList: Array<{ id: WizardStep; label: string; labelRu: string }> = [
    { id: "welcome", label: "Welcome", labelRu: "Введение" },
    { id: "hardware", label: "Hardware", labelRu: "Оборудование" },
    { id: "network", label: "Network", labelRu: "Интернет" },
    { id: "wireless", label: "Wi-Fi", labelRu: "Беспроводная сеть" },
    { id: "security", label: "Security", labelRu: "Безопасность" },
    { id: "services", label: "Services", labelRu: "Сервисы" },
    { id: "summary", label: "Summary", labelRu: "Завершение" },
  ];

  const currentStepIndex = stepsList.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    if (currentStepIndex < stepsList.length - 1) {
      setStep(stepsList[currentStepIndex + 1].id);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setStep(stepsList[currentStepIndex - 1].id);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeWizard()}>
      <DialogContent className="sm:max-w-3xl bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Wizard Top Progress Bar */}
        <div className="border-b border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">
                  {isRu ? "Мастер первоначальной настройки" : "Initial Router Setup Wizard"}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {isRu ? "Быстрая пошаговая конфигурация OpenWrt" : "Quick step-by-step OpenWrt configuration"}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-zinc-700 text-zinc-300 font-mono text-[11px]">
              {isRu ? `Шаг ${currentStepIndex + 1} из ${stepsList.length}` : `Step ${currentStepIndex + 1} of ${stepsList.length}`}
            </Badge>
          </div>

          {/* Stepper Dots */}
          <div className="grid grid-cols-7 gap-1.5">
            {stepsList.map((step, idx) => (
              <div
                key={step.id}
                className={`h-1.5 rounded-full transition-all ${
                  idx < currentStepIndex
                    ? "bg-emerald-500"
                    : idx === currentStepIndex
                    ? "bg-emerald-400 ring-2 ring-emerald-500/30"
                    : "bg-zinc-800"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Wizard Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* STEP 1: Welcome & Mode Selection */}
          {currentStep === "welcome" && (
            <div className="space-y-6">
              <div className="text-center max-w-lg mx-auto space-y-2">
                <h2 className="text-lg font-bold text-zinc-100">
                  {isRu ? "Добро пожаловать в ORBIX!" : "Welcome to ORBIX!"}
                </h2>
                <p className="text-zinc-400 leading-relaxed text-xs">
                  {isRu
                    ? "Эта панель превращает ваш роутер в интеллектуальный сетевой центр: автоматический обход замедления YouTube, разблокировка Discord, умный DNS и раздельная маршрутизация без сложных команд Linux."
                    : "Transform your router into an intelligent network hub: automatic YouTube 1080p bypass, Discord voice unblock, Smart DNS, and split tunneling without terminal commands."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Simple Mode Option */}
                <div
                  onClick={() => setSetupMode("simple")}
                  className={`cursor-pointer p-4 rounded-xl border transition-all ${
                    draft.setupMode === "simple"
                      ? "border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-950/40"
                      : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-zinc-100">{isRu ? "Простой режим" : "Simple Setup"}</span>
                    <Badge variant="outline" className="border-emerald-700 text-emerald-400 text-[10px]">
                      {isRu ? "Рекомендуется" : "Recommended"}
                    </Badge>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    {isRu
                      ? "Минимум технических терминов. Автоматическое определение оборудования, безопасные настройки по умолчанию и готовые правила в один клик."
                      : "Minimal networking jargon. Safe defaults, auto-detection, and one-click rules."}
                  </p>
                </div>

                {/* Advanced Mode Option */}
                <div
                  onClick={() => setSetupMode("expert")}
                  className={`cursor-pointer p-4 rounded-xl border transition-all ${
                    draft.setupMode === "expert"
                      ? "border-amber-500 bg-amber-950/20 shadow-lg shadow-amber-950/40"
                      : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-zinc-100">{isRu ? "Экспертный режим" : "Advanced Setup"}</span>
                    <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px]">
                      Power Users
                    </Badge>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    {isRu
                      ? "Ручная настройка WAN/LAN интерфейсов, VLAN, компилятора Sing-box, параметров Zapret NFQUEUE и статической маршрутизации PBR."
                      : "Full control over interfaces, VLANs, Sing-box compiler, Zapret NFQUEUE, and PBR tables."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Hardware Detection */}
          {currentStep === "hardware" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Router className="h-4 w-4 text-emerald-400" />
                  <span>{isRu ? "Обнаруженное оборудование и возможности" : "Detected Hardware & Capabilities"}</span>
                </h4>
                <p className="text-zinc-400 mt-0.5">
                  {isRu
                    ? "Система автоматически опросила ядро Linux и определила характеристики роутера"
                    : "The platform polled Linux kernel and identified hardware capabilities"}
                </p>
              </div>

              {isLoadingHardware ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                  <span className="text-zinc-400">{isRu ? "Опрос устройств и ядра..." : "Probing hardware..."}</span>
                </div>
              ) : hardware ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-1">
                    <div className="text-zinc-500 text-[10px] uppercase font-mono">{isRu ? "Модель роутера" : "Model"}</div>
                    <div className="font-bold text-zinc-200 text-sm">{hardware.model}</div>
                    <div className="text-[11px] text-zinc-400 font-mono">{hardware.architecture} • {hardware.cpuModel}</div>
                  </div>

                  <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-1">
                    <div className="text-zinc-500 text-[10px] uppercase font-mono">{isRu ? "Версия прошивки" : "OpenWrt Release"}</div>
                    <div className="font-bold text-emerald-400 text-sm">OpenWrt {hardware.openwrtVersion}</div>
                    <div className="text-[11px] text-zinc-400 font-mono">Kernel {hardware.kernelVersion} • {hardware.packageManager.toUpperCase()}</div>
                  </div>

                  <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-1">
                    <div className="text-zinc-500 text-[10px] uppercase font-mono">{isRu ? "Оперативная память (RAM)" : "RAM"}</div>
                    <div className="font-bold text-zinc-200">{hardware.ram.totalMb} MB total</div>
                    <div className="text-[11px] text-zinc-400">{hardware.ram.freeMb} MB доступно ({hardware.ram.usagePercent}% занято)</div>
                  </div>

                  <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-1">
                    <div className="text-zinc-500 text-[10px] uppercase font-mono">{isRu ? "Флеш-память (/overlay)" : "Storage"}</div>
                    <div className="font-bold text-zinc-200">{hardware.storage.overlayTotalMb} MB total</div>
                    <div className="text-[11px] text-zinc-400">{hardware.storage.overlayFreeMb} MB свободно ({hardware.storage.usagePercent}% занято)</div>
                  </div>

                  <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-1 sm:col-span-2">
                    <div className="text-zinc-500 text-[10px] uppercase font-mono">{isRu ? "Сетевые порты и Wi-Fi радиомодули" : "Network & Wireless"}</div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="outline" className="border-emerald-800 text-emerald-400 font-mono">
                        WAN: {hardware.network.detectedWanDevice} ({hardware.network.detectedWanProto.toUpperCase()})
                      </Badge>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-300 font-mono">
                        LAN: {hardware.network.detectedLanDevice} ({hardware.network.detectedLanIp})
                      </Badge>
                      {hardware.wireless.radios.map((r) => (
                        <Badge key={r.device} variant="outline" className="border-zinc-700 text-zinc-300 font-mono">
                          Wi-Fi {r.band} ({r.htmode})
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* STEP 3: Network & Subnet Setup */}
          {currentStep === "network" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-zinc-400" />
                  <span>{isRu ? "Подключение к интернету (WAN) и локальная сеть (LAN)" : "Internet (WAN) & Local Network (LAN)"}</span>
                </h4>
                <p className="text-zinc-400 mt-0.5">
                  {isRu
                    ? "Укажите тип подключения от вашего провайдера и локальный IP роутера"
                    : "Configure ISP WAN connection type and local LAN IP address"}
                </p>
              </div>

              {/* Subnet Conflict Warning */}
              {hasSubnetConflict && (
                <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">{isRu ? "Внимание: коллизия подсетей!" : "Subnet Collision Detected!"}</div>
                    <div className="text-[11px] text-amber-300/80 mt-0.5">
                      {isRu
                        ? `IP провайдера (${hardware?.network.detectedWanIp}) и локальный IP роутера (${draft.lanIp}) находятся в одной подсети 192.168.1.x. Рекомендуется сменить LAN на 192.168.2.1.`
                        : `WAN IP (${hardware?.network.detectedWanIp}) collides with LAN (${draft.lanIp}). Recommend changing LAN to 192.168.2.1.`}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => updateDraft({ lanIp: "192.168.2.1" })}
                      className="h-7 text-xs mt-2 bg-amber-600 hover:bg-amber-500 text-white"
                    >
                      {isRu ? "Сменить LAN на 192.168.2.1" : "Fix to 192.168.2.1"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
                <label className="block text-zinc-300 font-semibold">{isRu ? "Тип подключения WAN (Провайдер)" : "WAN Connection Type"}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["dhcp", "pppoe", "static"] as const).map((proto) => (
                    <Button
                      key={proto}
                      type="button"
                      variant={draft.wanProto === proto ? "default" : "outline"}
                      onClick={() => updateDraft({ wanProto: proto })}
                      className={`h-9 text-xs uppercase font-mono ${
                        draft.wanProto === proto ? "bg-emerald-600 text-white" : "border-zinc-800 text-zinc-400"
                      }`}
                    >
                      {proto === "dhcp" ? "DHCP (IPoE)" : proto.toUpperCase()}
                    </Button>
                  ))}
                </div>

                {draft.wanProto === "pppoe" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <span className="text-zinc-400 text-[11px]">{isRu ? "Логин PPPoE" : "PPPoE Username"}</span>
                      <Input
                        value={draft.wanPppoeUser || ""}
                        onChange={(e) => updateDraft({ wanPppoeUser: e.target.value })}
                        placeholder="user@isp"
                        className="h-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 mt-1"
                      />
                    </div>
                    <div>
                      <span className="text-zinc-400 text-[11px]">{isRu ? "Пароль PPPoE" : "PPPoE Password"}</span>
                      <Input
                        type="password"
                        value={draft.wanPppoePassword || ""}
                        onChange={(e) => updateDraft({ wanPppoePassword: e.target.value })}
                        placeholder="••••••••"
                        className="h-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 mt-1"
                      />
                    </div>
                  </div>
                )}

                {draft.wanProto === "static" && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <span className="text-zinc-400 text-[11px]">Static IP</span>
                      <Input
                        value={draft.wanStaticIp || ""}
                        onChange={(e) => updateDraft({ wanStaticIp: e.target.value })}
                        placeholder="192.168.0.2"
                        className="h-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 mt-1"
                      />
                    </div>
                    <div>
                      <span className="text-zinc-400 text-[11px]">Gateway</span>
                      <Input
                        value={draft.wanStaticGateway || ""}
                        onChange={(e) => updateDraft({ wanStaticGateway: e.target.value })}
                        placeholder="192.168.0.1"
                        className="h-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
                <label className="block text-zinc-300 font-semibold">{isRu ? "Локальный IP адрес роутера (LAN)" : "Router LAN IP Address"}</label>
                <div className="flex items-center gap-3">
                  <Input
                    value={draft.lanIp}
                    onChange={(e) => updateDraft({ lanIp: e.target.value })}
                    className="h-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 font-mono w-48"
                  />
                  <span className="text-zinc-500 font-mono text-[11px]">/ 255.255.255.0</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Wireless Setup */}
          {currentStep === "wireless" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-emerald-400" />
                  <span>{isRu ? "Настройка беспроводной сети Wi-Fi" : "Wireless Wi-Fi Configuration"}</span>
                </h4>
                <p className="text-zinc-400 mt-0.5">
                  {isRu
                    ? "Задайте имя домашней сети и надёжный пароль для доступа ваших устройств"
                    : "Set home network name (SSID) and strong WPA2/WPA3 passphrase"}
                </p>
              </div>

              <div className="space-y-4 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div>
                    <div className="font-semibold text-zinc-200">{isRu ? "Включить Wi-Fi" : "Enable Wireless Radios"}</div>
                    <div className="text-[11px] text-zinc-500">{isRu ? "Вещание сетей 2.4 GHz и 5 GHz" : "Broadcast 2.4 GHz & 5 GHz bands"}</div>
                  </div>
                  <Switch checked={draft.wifiEnabled} onCheckedChange={(val) => updateDraft({ wifiEnabled: val })} />
                </div>

                {draft.wifiEnabled && (
                  <div className="space-y-3">
                    <div>
                      <span className="text-zinc-400 text-[11px]">{isRu ? "Имя сети (SSID)" : "Network Name (SSID)"}</span>
                      <Input
                        value={draft.wifiSsid}
                        onChange={(e) => updateDraft({ wifiSsid: e.target.value })}
                        className="h-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 mt-1"
                      />
                    </div>

                    <div>
                      <span className="text-zinc-400 text-[11px]">{isRu ? "Пароль сети (WPA2/WPA3)" : "Wi-Fi Password"}</span>
                      <div className="relative mt-1">
                        <Input
                          type={showWifiPassword ? "text" : "password"}
                          value={draft.wifiPassword}
                          onChange={(e) => updateDraft({ wifiPassword: e.target.value })}
                          className="h-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 pr-9 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowWifiPassword(!showWifiPassword)}
                          className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300"
                        >
                          {showWifiPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <div className="font-medium text-zinc-300">{isRu ? "Единая сеть (Band Steering)" : "Band Steering (Unified SSID)"}</div>
                        <div className="text-[11px] text-zinc-500">{isRu ? "Автоматический выбор 2.4G/5G для лучшего сигнала" : "Combine 2.4GHz & 5GHz into one SSID"}</div>
                      </div>
                      <Switch checked={draft.wifiBandSteering} onCheckedChange={(val) => updateDraft({ wifiBandSteering: val })} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Security Setup */}
          {currentStep === "security" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-400" />
                  <span>{isRu ? "Защита администратора и доступ к роутеру" : "Administrator Security & Access Control"}</span>
                </h4>
                <p className="text-zinc-400 mt-0.5">
                  {isRu
                    ? "Установите надежный пароль root. Доступ из интернета (WAN) по умолчанию заблокирован."
                    : "Set administrator password. WAN external access is strictly blocked by default."}
                </p>
              </div>

              <div className="space-y-4 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
                <div>
                  <span className="text-zinc-400 text-[11px]">{isRu ? "Новый пароль администратора (root)" : "New Root Password"}</span>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={draft.rootPassword}
                      onChange={(e) => updateDraft({ rootPassword: e.target.value })}
                      placeholder="••••••••••••"
                      className="h-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 pr-9 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-400 text-[11px]">{isRu ? "Подтверждение пароля" : "Confirm Password"}</span>
                  <Input
                    type="password"
                    value={draft.confirmRootPassword}
                    onChange={(e) => updateDraft({ confirmRootPassword: e.target.value })}
                    placeholder="••••••••••••"
                    className="h-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 font-mono mt-1"
                  />
                  {draft.rootPassword && draft.confirmRootPassword && draft.rootPassword !== draft.confirmRootPassword && (
                    <div className="text-[11px] text-rose-400 mt-1">{isRu ? "Пароли не совпадают!" : "Passwords do not match!"}</div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                  <div>
                    <div className="font-semibold text-zinc-200">{isRu ? "Защита SSH Dropbear" : "Dropbear SSH Security"}</div>
                    <div className="text-[11px] text-zinc-500">{isRu ? "Привязать SSH строго к локальной сети LAN" : "Bind SSH strictly to local LAN interface"}</div>
                  </div>
                  <Switch checked={draft.disableRemoteSsh} onCheckedChange={(val) => updateDraft({ disableRemoteSsh: val })} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Core Services Setup */}
          {currentStep === "services" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-zinc-400" />
                  <span>{isRu ? "Выбор предустановленных служб обхода" : "Core Circumvention & Routing Services"}</span>
                </h4>
                <p className="text-zinc-400 mt-0.5">
                  {isRu
                    ? "Включите необходимые службы. Любую функцию можно изменить или отключить позже."
                    : "Toggle desired features. All rules can be changed anytime."}
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-zinc-200">{isRu ? "Zapret: YouTube 1080p (DPI Desync)" : "Zapret: YouTube 1080p (hostfakesplit)"}</div>
                    <div className="text-[11px] text-zinc-400">{isRu ? "Обход замедления googlevideo без VPN" : "TSPU bypass without VPN traffic consumption"}</div>
                  </div>
                  <Switch checked={draft.enableZapretYoutube} onCheckedChange={(v) => updateDraft({ enableZapretYoutube: v })} />
                </div>

                <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-zinc-200">{isRu ? "Zapret: Discord и голос (multisplit)" : "Zapret: Discord Voice & Media"}</div>
                    <div className="text-[11px] text-zinc-400">{isRu ? "Разблокировка голосовых комнат WebRTC" : "Split ClientHello across ports 2053/8443"}</div>
                  </div>
                  <Switch checked={draft.enableZapretDiscord} onCheckedChange={(v) => updateDraft({ enableZapretDiscord: v })} />
                </div>

                <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-zinc-200">{isRu ? "RuNet Direct (.RU и Банки)" : "RuNet Direct (.RU & Banks)"}</div>
                    <div className="text-[11px] text-zinc-400">{isRu ? "Госуслуги, Сбер, Т-Банк строго напрямую" : "Direct WAN routing without foreign VPN"}</div>
                  </div>
                  <Switch checked={draft.enableRuNetDirect} onCheckedChange={(v) => updateDraft({ enableRuNetDirect: v })} />
                </div>

                <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-zinc-200">{isRu ? "Smart DNS (dns-ai.ru)" : "Smart DNS (dns-ai.ru)"}</div>
                    <div className="text-[11px] text-zinc-400">{isRu ? "ChatGPT, Claude напрямую через умный прокси" : "Reverse proxy for AI services without VPN"}</div>
                  </div>
                  <Switch checked={draft.enableSmartDnsAi} onCheckedChange={(v) => updateDraft({ enableSmartDnsAi: v })} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Summary & Apply */}
          {currentStep === "summary" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>{isRu ? "Сводка параметров и применение" : "Configuration Summary & Apply"}</span>
                </h4>
                <p className="text-zinc-400 mt-0.5">
                  {isRu
                    ? "Проверьте выбранные параметры перед записью в ядро OpenWrt"
                    : "Review selected parameters before committing to OpenWrt"}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-3 font-mono text-[11px]">
                <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                  <span className="text-zinc-500">{isRu ? "Режим работы:" : "Setup Mode:"}</span>
                  <span className="text-zinc-200 uppercase font-bold">{draft.setupMode}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                  <span className="text-zinc-500">WAN Uplink:</span>
                  <span className="text-emerald-400 font-bold">{draft.wanProto.toUpperCase()}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                  <span className="text-zinc-500">LAN Subnet:</span>
                  <span className="text-zinc-200">{draft.lanIp} / 24</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                  <span className="text-zinc-500">Wi-Fi SSID:</span>
                  <span className="text-zinc-200">{draft.wifiEnabled ? draft.wifiSsid : "DISABLED"}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                  <span className="text-zinc-500">Admin Security:</span>
                  <span className="text-zinc-200">{draft.rootPassword ? "Password set (Protected)" : "No password change"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Active Services:</span>
                  <span className="text-zinc-300">
                    Zapret ({draft.enableZapretYoutube ? "YT" : ""}{draft.enableZapretDiscord ? " DC" : ""}) • RuNet Direct • Smart DNS
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-950/20 border border-emerald-800/60 rounded-lg text-emerald-300 flex items-start gap-2">
                <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="text-[11px]">
                  {isRu
                    ? "Безопасное применение: на роутере активируется сторожевой таймер (75 сек). Если доступ пропадет, роутер автоматически восстановит рабочие параметры."
                    : "Safety Guarantee: 75-second rollback watchdog is armed. If connectivity fails, previous state is restored automatically."}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="border-t border-zinc-800 bg-zinc-900/60 p-4 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={currentStepIndex === 0 ? closeWizard : handleBack}
            disabled={isApplying}
            className="h-8 text-xs border-zinc-800 text-zinc-400 hover:bg-zinc-900"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            <span>{currentStepIndex === 0 ? (isRu ? "Пропустить" : "Skip") : (isRu ? "Назад" : "Back")}</span>
          </Button>

          {currentStep === "summary" ? (
            <Button
              type="button"
              size="sm"
              onClick={applyWizard}
              disabled={isApplying}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5"
            >
              {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span>{isApplying ? applyProgress || "Применение..." : (isRu ? "Применить и запустить роутер" : "Apply & Launch")}</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1.5"
            >
              <span>{isRu ? "Далее" : "Next"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
