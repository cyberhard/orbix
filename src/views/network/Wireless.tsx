import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { usePolicyStore } from "@/store/policy-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Radio, Wifi, Scan, Shield, Save, CheckCircle2, AlertCircle, Eye, EyeOff, RefreshCw, Signal, Sparkles, Users, QrCode, SlidersHorizontal, Radar } from "lucide-react";

export const Wireless: React.FC = () => {
  const { lang } = useI18nStore();
  const isRu = lang === "ru";

  const { operatingMode } = usePolicyStore();
  const isExpert = operatingMode === "expert";

  const {data: wifiMap, refetch} = useQuery({
    queryKey: ["wireless-devices"],
    queryFn: () => ubusClient.getWirelessDevices(),
    refetchInterval: 5000,
  });

  const [scanOpen, setScanOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<any[]>([]);

  // Simple Mode State: Independent or Synced 2.4 / 5 GHz
  const [simpleSyncBands, setSimpleSyncBands] = useState(true);
  const [simpleSsid24, setSimpleSsid24] = useState("ORBIX-Home");
  const [simpleKey24, setSimpleKey24] = useState("orbix-super-secure");
  const [simpleEnabled24, setSimpleEnabled24] = useState(true);
  const [showKey24, setShowKey24] = useState(false);

  const [simpleSsid5, setSimpleSsid5] = useState("ORBIX-Home-5G");
  const [simpleKey5, setSimpleKey5] = useState("orbix-super-secure");
  const [simpleEnabled5, setSimpleEnabled5] = useState(true);
  const [showKey5, setShowKey5] = useState(false);

  const [simpleSaving, setSimpleSaving] = useState(false);
  const [simpleSaved, setSimpleSaved] = useState(false);
  const [showQrModal, setShowQrModal] = useState<"2.4" | "5" | null>(null);

  // Per-radio form state (Expert Mode)
  const [radioForms, setRadioForms] = useState<
    Record<
      string,
      {
        ssid: string;
        key: string;
        encryption: string;
        channel: number | string;
        htmode: string;
        txpower: number;
        bssid: string;
        pmf: string; // "0" = disabled, "1" = optional, "2" = required
        saePwe: string; // "0" = hunting, "1" = hash-to-element, "2" = both
        transitionDisable: boolean;
        fastRoaming: boolean;
        disabled: boolean;
        showKey: boolean;
        isSaving: boolean;
        savedSuccess: boolean;
        error: string | null;
      }
    >
  >({});

  // Initialize or update forms when live radio data loads
  useEffect(() => {
    if (!wifiMap) return;

    setRadioForms((prev) => {
      const next = { ...prev };
      Object.entries(wifiMap).forEach(([radioName, radio]) => {
        const iface = radio.interfaces?.[0];
        const is5G = radio.config?.band === "5g" || radioName.includes("1");
        const ifaceConfig = iface?.config || {};
        const ifaceIwinfo = iface?.iwinfo || {};
        const radioConfig = radio?.config || {};
        const radioIwinfo = radio?.iwinfo || {};

        const liveSsid = ifaceConfig.ssid || ifaceIwinfo.ssid || iface?.ssid || (is5G ? "ORBIX-5G" : "ORBIX-2.4G");
        const liveKey = ifaceConfig.key || iface?.key || "12345678";
        const liveEncryption = ifaceConfig.encryption || iface?.encryption || "sae-mixed";
        const liveChannel = radioConfig.channel || radioIwinfo.channel || radio.channel || (is5G ? 36 : 1);
        const liveHtmode = radioConfig.htmode || (is5G ? "EHT160" : "EHT20");
        const liveDisabled = radioConfig.disabled === true || radio.disabled === true || ifaceConfig.disabled === true;
        const liveBssid = ifaceIwinfo.bssid || iface?.bssid || (is5G ? "60:BE:B4:12:34:57" : "60:BE:B4:12:34:56");
        const liveTxpower = radioConfig.txpower || radioIwinfo.txpower || 23;

        if (!next[radioName]) {
          next[radioName] = {
            ssid: liveSsid,
            key: liveKey,
            encryption: liveEncryption,
            channel: liveChannel,
            htmode: liveHtmode,
            txpower: typeof liveTxpower === "number" ? liveTxpower : 23,
            bssid: liveBssid,
            pmf: "1",
            saePwe: "2",
            transitionDisable: false,
            fastRoaming: true,
            disabled: liveDisabled,
            showKey: false,
            isSaving: false,
            savedSuccess: false,
            error: null,
          };
        }
      });

      // Update Simple Mode states from primary radios
      const radiosArr = Object.entries(wifiMap);
      if (radiosArr.length > 0) {
        const r24 = radiosArr.find(([name, r]) => r.config?.band === "2g" || name.includes("0")) || radiosArr[0];
        const r5 = radiosArr.find(([name, r]) => r.config?.band === "5g" || name.includes("1")) || radiosArr[1] || radiosArr[0];

        const cfg24 = r24[1]?.interfaces?.[0]?.config || {};
        const cfg5 = r5[1]?.interfaces?.[0]?.config || {};

        if (cfg24.ssid) setSimpleSsid24(cfg24.ssid);
        if (cfg24.key) setSimpleKey24(cfg24.key);
        if (r24[1]?.config?.disabled !== undefined) setSimpleEnabled24(!r24[1].config.disabled);

        if (cfg5.ssid) setSimpleSsid5(cfg5.ssid);
        if (cfg5.key) setSimpleKey5(cfg5.key);
        if (r5[1]?.config?.disabled !== undefined) setSimpleEnabled5(!r5[1].config.disabled);
      }

      return next;
    });
  }, [wifiMap]);

  // Sync 2.4G to 5G when sync toggle is on
  const handleSimpleSsid24Change = (val: string) => {
    setSimpleSsid24(val);
    if (simpleSyncBands) {
      setSimpleSsid5(val);
    }
  };

  const handleSimpleKey24Change = (val: string) => {
    setSimpleKey24(val);
    if (simpleSyncBands) {
      setSimpleKey5(val);
    }
  };

  const handleSimpleSaveAll = async () => {
    setSimpleSaving(true);
    setSimpleSaved(false);
    try {
      if (wifiMap) {
        for (const [radioName, radio] of Object.entries(wifiMap)) {
          const is5G = radio.config?.band === "5g" || radioName.includes("1");
          const ifaceSection = radio?.interfaces?.[0]?.section || `default_${radioName}`;
          const currentForm = radioForms[radioName];

          const ssidToApply = is5G ? (simpleSyncBands ? simpleSsid24 : simpleSsid5) : simpleSsid24;
          const keyToApply = is5G ? (simpleSyncBands ? simpleKey24 : simpleKey5) : simpleKey24;
          const disabledToApply = is5G ? !simpleEnabled5 : !simpleEnabled24;

          await ubusClient.saveWifiRadio(radioName, ifaceSection, {
            ssid: ssidToApply,
            key: keyToApply,
            encryption: currentForm?.encryption || "sae-mixed",
            channel: currentForm?.channel || (is5G ? 36 : 1),
            htmode: currentForm?.htmode || (is5G ? "EHT160" : "EHT20"),
            disabled: disabledToApply,
          });
        }
      }
      await refetch();
      setSimpleSaved(true);
      setTimeout(() => setSimpleSaved(false), 4000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSimpleSaving(false);
    }
  };

  const handleFieldChange = (radioName: string, field: string, val: any) => {
    setRadioForms((prev) => ({
      ...prev,
      [radioName]: {
        ...prev[radioName],
        [field]: val,
        savedSuccess: false,
        error: null,
      },
    }));
  };

  const handleSaveRadio = async (radioName: string) => {
    const form = radioForms[radioName];
    if (!form) return;

    const radio = wifiMap?.[radioName];
    const ifaceSection = radio?.interfaces?.[0]?.section || `default_${radioName}`;

    setRadioForms((prev) => ({
      ...prev,
      [radioName]: { ...prev[radioName], isSaving: true, error: null, savedSuccess: false },
    }));

    try {
      await ubusClient.saveWifiRadio(radioName, ifaceSection, {
        ssid: form.ssid,
        key: form.key,
        encryption: form.encryption,
        channel: form.channel,
        htmode: form.htmode,
        disabled: form.disabled,
      });

      await refetch();

      setRadioForms((prev) => ({
        ...prev,
        [radioName]: {
          ...prev[radioName],
          isSaving: false,
          savedSuccess: true,
          error: null,
        },
      }));

      setTimeout(() => {
        setRadioForms((prev) => ({
          ...prev,
          [radioName]: { ...prev[radioName], savedSuccess: false },
        }));
      }, 4000);
    } catch (err: any) {
      setRadioForms((prev) => ({
        ...prev,
        [radioName]: {
          ...prev[radioName],
          isSaving: false,
          error: err?.message || (isRu ? "Ошибка сохранения" : "Save failed"),
        },
      }));
    }
  };

  const handleStartScan = async () => {
    setScanOpen(true);
    setIsScanning(true);
    try {
      const res = await ubusClient.scanWifi("phy0.0-ap0");
      setScanResults(res);
    } catch {
      setScanResults([]);
    } finally {
      setIsScanning(false);
    }
  };

  const radios = wifiMap ? Object.entries(wifiMap) : [];

  // Helper: check if a channel is in DFS radar frequency range
  const isDfsChannel = (ch: number | string) => {
    const c = typeof ch === "string" ? parseInt(ch, 10) : ch;
    return (c >= 52 && c <= 64) || (c >= 100 && c <= 144);
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Title & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <Wifi className="h-5 w-5 text-emerald-400" />
              <span>{isRu ? "Беспроводная сеть Wi-Fi (Wi-Fi 7 / 802.11be)" : "Wi-Fi Wireless Networks (Wi-Fi 7 / 802.11be)"}</span>
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
                  ? "HT mode (EHT160), DFS радары, мощность TX power, BSSID, WPA3-SAE, PMF и анализ радиоэфира"
                  : "HT mode (EHT160), DFS radar channels, TX power, BSSID override, WPA3-SAE, PMF and spectrum survey")
              : (isRu
                  ? "Быстрое переключение имени сети и пароля 2.4/5GHz, QR-код для гостей и единое имя сети"
                  : "Quick SSID and password setup for 2.4/5GHz, guest QR-code and Smart Band Steering")}
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
          {isExpert && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartScan}
              disabled={isScanning}
              className="text-xs gap-1.5 h-8 border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            >
              <Scan className={`h-3.5 w-3.5 ${isScanning ? "animate-spin" : ""}`} />
              <span>{isScanning ? (isRu ? "Сканирование..." : "Scanning...") : (isRu ? "Сканировать эфир" : "Spectrum Survey")}</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="text-xs gap-1.5 h-8 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{isRu ? "Обновить" : "Refresh"}</span>
          </Button>
        </div>
      </div>

      {/* =========================================================================
          SIMPLE MODE: Быстрое переключение имени сети и пароля 2.4/5GHz
          ========================================================================= */}
      {!isExpert && (
        <div className="space-y-6">
          {/* Smart Band Steering Toggle Banner */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs">
                <div className="font-semibold text-zinc-100">
                  {isRu ? "Smart Wi-Fi (Единое имя для 2.4 и 5 GHz)" : "Smart Wi-Fi (Unified Band Steering)"}
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  {isRu
                    ? "Устройства автоматически подключаются к самому скоростному диапазону (2.4 GHz для дальности, 5 GHz для скорости)."
                    : "Devices automatically connect to the best available band with seamless fast roaming."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <span className="text-xs text-zinc-300 font-medium">
                {simpleSyncBands ? (isRu ? "Общая сеть" : "Unified") : (isRu ? "Раздельные сети" : "Separate")}
              </span>
              <Switch checked={simpleSyncBands} onCheckedChange={setSimpleSyncBands} />
            </div>
          </div>

          {/* Cards Grid: 2.4 GHz and 5 GHz */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 2.4 GHz Card */}
            <Card className="border-zinc-800 bg-zinc-950 shadow-xl">
              <CardHeader className="border-b border-zinc-800/80 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-amber-400" />
                    <CardTitle className="text-sm font-semibold text-zinc-200">
                      {isRu ? "Диапазон 2.4 GHz (Дальнобойный)" : "2.4 GHz Band (Long Range)"}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400">
                      {simpleEnabled24 ? (isRu ? "Включен" : "Enabled") : (isRu ? "Выключен" : "Disabled")}
                    </span>
                    <Switch checked={simpleEnabled24} onCheckedChange={setSimpleEnabled24} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-400">
                    {isRu ? "Имя сети (SSID)" : "Network Name (SSID)"}
                  </label>
                  <Input
                    value={simpleSsid24}
                    onChange={(e) => handleSimpleSsid24Change(e.target.value)}
                    disabled={!simpleEnabled24}
                    placeholder="ORBIX-Home"
                    className="h-9 font-medium text-xs bg-zinc-900 border-zinc-700 text-zinc-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-400 flex items-center justify-between">
                    <span>{isRu ? "Пароль сети" : "Password"}</span>
                    <button
                      type="button"
                      onClick={() => setShowQrModal("2.4")}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px]"
                    >
                      <QrCode className="h-3 w-3" />
                      <span>{isRu ? "Показать QR" : "Show QR"}</span>
                    </button>
                  </label>
                  <div className="relative">
                    <Input
                      type={showKey24 ? "text" : "password"}
                      value={simpleKey24}
                      onChange={(e) => handleSimpleKey24Change(e.target.value)}
                      disabled={!simpleEnabled24}
                      placeholder="••••••••"
                      className="h-9 font-mono text-xs bg-zinc-900 border-zinc-700 text-zinc-200 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey24(!showKey24)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showKey24 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                  <span>{isRu ? "Стандарт: Wi-Fi 7 (802.11be)" : "Standard: Wi-Fi 7 (802.11be)"}</span>
                  <Badge variant="outline" className="border-amber-800/80 text-amber-400 text-[10px]">
                    2.4 GHz
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* 5 GHz Card */}
            <Card className="border-zinc-800 bg-zinc-950 shadow-xl">
              <CardHeader className="border-b border-zinc-800/80 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-zinc-400" />
                    <CardTitle className="text-sm font-semibold text-zinc-200">
                      {isRu ? "Диапазон 5 GHz (Сверхбыстрый)" : "5 GHz Band (Ultra Fast)"}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400">
                      {simpleEnabled5 ? (isRu ? "Включен" : "Enabled") : (isRu ? "Выключен" : "Disabled")}
                    </span>
                    <Switch checked={simpleEnabled5} onCheckedChange={setSimpleEnabled5} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-400">
                    {isRu ? "Имя сети (SSID)" : "Network Name (SSID)"}
                  </label>
                  <Input
                    value={simpleSyncBands ? simpleSsid24 : simpleSsid5}
                    onChange={(e) => setSimpleSsid5(e.target.value)}
                    disabled={!simpleEnabled5 || simpleSyncBands}
                    placeholder="ORBIX-Home-5G"
                    className="h-9 font-medium text-xs bg-zinc-900 border-zinc-700 text-zinc-200"
                  />
                  {simpleSyncBands && (
                    <div className="text-[10px] text-zinc-500 italic">
                      {isRu ? "Синхронизировано со Smart Wi-Fi (2.4 GHz)" : "Synced with Smart Wi-Fi (2.4 GHz)"}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-400 flex items-center justify-between">
                    <span>{isRu ? "Пароль сети" : "Password"}</span>
                    <button
                      type="button"
                      onClick={() => setShowQrModal("5")}
                      className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 text-[11px]"
                    >
                      <QrCode className="h-3 w-3" />
                      <span>{isRu ? "Показать QR" : "Show QR"}</span>
                    </button>
                  </label>
                  <div className="relative">
                    <Input
                      type={showKey5 ? "text" : "password"}
                      value={simpleSyncBands ? simpleKey24 : simpleKey5}
                      onChange={(e) => setSimpleKey5(e.target.value)}
                      disabled={!simpleEnabled5 || simpleSyncBands}
                      placeholder="••••••••"
                      className="h-9 font-mono text-xs bg-zinc-900 border-zinc-700 text-zinc-200 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey5(!showKey5)}
                      disabled={simpleSyncBands}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
                    >
                      {showKey5 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                  <span>{isRu ? "Ширина: 160 MHz (EHT160)" : "Bandwidth: 160 MHz (EHT160)"}</span>
                  <Badge variant="outline" className="border-zinc-700 text-zinc-300 text-[10px]">
                    5 GHz
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Simple Save Actions Banner */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="text-xs text-zinc-400">
              {simpleSaved ? (
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isRu ? "Настройки Wi-Fi успешно сохранены и применены!" : "Wi-Fi settings applied successfully!"}</span>
                </div>
              ) : (
                <span>
                  {isRu
                    ? "После сохранения роутер применит новое имя и пароль без перезагрузки системы."
                    : "Changes will be applied instantly without rebooting the system."}
                </span>
              )}
            </div>

            <Button
              onClick={handleSimpleSaveAll}
              disabled={simpleSaving}
              className="h-10 px-6 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2 shadow-lg shadow-emerald-950/40 w-full sm:w-auto"
            >
              {simpleSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{isRu ? "Применить настройки Wi-Fi" : "Save & Apply Wi-Fi"}</span>
            </Button>
          </div>
        </div>
      )}

      {/* =========================================================================
          EXPERT MODE: HT mode, DFS каналы, мощность TX power, bssid, WPA3/SAE флаги
          ========================================================================= */}
      {isExpert && (
        <div className="grid gap-6 md:grid-cols-2">
          {radios.map(([radioName, radio]) => {
            const form = radioForms[radioName] || {
              ssid: "ORBIX",
              key: "12345678",
              encryption: "sae-mixed",
              channel: 1,
              htmode: "EHT20",
              txpower: 23,
              bssid: "60:BE:B4:12:34:56",
              pmf: "1",
              saePwe: "2",
              transitionDisable: false,
              fastRoaming: true,
              disabled: false,
              showKey: false,
              isSaving: false,
              savedSuccess: false,
              error: null,
            };

            const iface = radio.interfaces?.[0];
            const is5G = radio.config?.band === "5g" || radioName.includes("1");
            const isEnabled = !form.disabled;
            const stationsCount = iface?.assoclist ? Object.keys(iface.assoclist).length : 0;
            const channelIsDfs = is5G && isDfsChannel(form.channel);

            return (
              <Card key={radioName} className="border-zinc-800 bg-zinc-950 shadow-xl flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3 border-b border-zinc-800/80 bg-zinc-900/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200">
                          <Radio className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                          <CardTitle className="text-xs font-semibold font-mono text-zinc-200 uppercase flex items-center gap-1.5">
                            <span>{radioName} • {is5G ? "5 GHz (Wi-Fi 7)" : "2.4 GHz (Wi-Fi 7)"}</span>
                            <Badge variant="outline" className="text-[9px] font-mono border-zinc-700 text-zinc-400">
                              802.11be
                            </Badge>
                          </CardTitle>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            MediaTek MT7992E • {iface?.ifname || "phy0"} • BSSID: {form.bssid}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isEnabled ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                            }`}
                          />
                          {isEnabled ? (isRu ? "Активен" : "Broadcasting") : (isRu ? "Выключен" : "Disabled")}
                        </span>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleFieldChange(radioName, "disabled", !checked)}
                        />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4 text-xs">
                    {/* Feedback Banners */}
                    {form.savedSuccess && (
                      <div className="p-2.5 rounded-md bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in-50">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        <span>{isRu ? "Параметры Wi-Fi сохранены и применены!" : "Wi-Fi settings applied successfully!"}</span>
                      </div>
                    )}

                    {form.error && (
                      <div className="p-2.5 rounded-md bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                        <span>{form.error}</span>
                      </div>
                    )}

                    {/* DFS Radar Channel Warning Banner */}
                    {channelIsDfs && (
                      <div className="p-2.5 bg-amber-950/30 border border-amber-800/70 rounded-md text-amber-300 flex items-start gap-2">
                        <Radar className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                        <div className="text-[11px] leading-tight">
                          <span className="font-semibold">{isRu ? "DFS радарный канал:" : "DFS Radar Channel Active:"}</span>{" "}
                          {isRu
                            ? "Требуется проверка чистоты частоты (CAC) в течение 60 секунд. При фиксации импульсов метеорадара роутер автоматически переключится на резервный канал."
                            : "Requires 60s Channel Availability Check (CAC). In case of radar detection, frequency switches automatically."}
                        </div>
                      </div>
                    )}

                    {/* SSID Name & BSSID */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-zinc-400">
                          {isRu ? "Имя сети (SSID)" : "Network Name (SSID)"}
                        </label>
                        <Input
                          value={form.ssid}
                          onChange={(e) => handleFieldChange(radioName, "ssid", e.target.value)}
                          disabled={!isEnabled}
                          className="h-8 font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                          placeholder={is5G ? "ORBIX-5G" : "ORBIX-2.4G"}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-zinc-400">
                          {isRu ? "BSSID (Hardware MAC)" : "BSSID Override"}
                        </label>
                        <Input
                          value={form.bssid}
                          onChange={(e) => handleFieldChange(radioName, "bssid", e.target.value)}
                          disabled={!isEnabled}
                          className="h-8 font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-300"
                          placeholder="60:BE:B4:12:34:56"
                        />
                      </div>
                    </div>

                    {/* Password / Key */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-zinc-400 flex items-center justify-between">
                        <span>{isRu ? "Пароль сети (WPA Pre-Shared Key)" : "Password (WPA Key)"}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">мин. 8 символов</span>
                      </label>
                      <div className="relative">
                        <Input
                          type={form.showKey ? "text" : "password"}
                          value={form.key}
                          onChange={(e) => handleFieldChange(radioName, "key", e.target.value)}
                          disabled={!isEnabled || form.encryption === "none"}
                          className="h-8 font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200 pr-8"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => handleFieldChange(radioName, "showKey", !form.showKey)}
                          className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
                        >
                          {form.showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Channel Width (HT Mode) & Channel Selector */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-zinc-400">
                          {isRu ? "Ширина канала (HT Mode)" : "Channel Width (HT Mode)"}
                        </label>
                        <select
                          value={form.htmode}
                          onChange={(e) => handleFieldChange(radioName, "htmode", e.target.value)}
                          disabled={!isEnabled}
                          className="w-full h-8 px-2 text-xs font-mono rounded-md bg-zinc-950 border border-zinc-800 text-zinc-200"
                        >
                          {is5G ? (
                            <>
                              <option value="EHT160">EHT160 (160 MHz Wi-Fi 7)</option>
                              <option value="EHT80">EHT80 (80 MHz Wi-Fi 7)</option>
                              <option value="HE160">HE160 (160 MHz Wi-Fi 6)</option>
                              <option value="HE80">HE80 (80 MHz Wi-Fi 6)</option>
                              <option value="VHT80">VHT80 (80 MHz Wi-Fi 5)</option>
                              <option value="HT40">HT40 (40 MHz)</option>
                            </>
                          ) : (
                            <>
                              <option value="EHT20">EHT20 (20 MHz Wi-Fi 7)</option>
                              <option value="EHT40">EHT40 (40 MHz Wi-Fi 7)</option>
                              <option value="HE20">HE20 (20 MHz Wi-Fi 6)</option>
                              <option value="HT20">HT20 (20 MHz)</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-zinc-400">
                          {isRu ? "Канал и DFS радары" : "Channel & DFS"}
                        </label>
                        <select
                          value={String(form.channel)}
                          onChange={(e) => handleFieldChange(radioName, "channel", e.target.value)}
                          disabled={!isEnabled}
                          className={`w-full h-8 px-2 text-xs font-mono rounded-md bg-zinc-950 border text-zinc-200 ${
                            channelIsDfs ? "border-amber-700/80 text-amber-300" : "border-zinc-800"
                          }`}
                        >
                          {is5G ? (
                            <>
                              <option value="auto">Auto (ACS Dynamic)</option>
                              <optgroup label={isRu ? "Без DFS (Indoor standard)" : "Non-DFS Channels"}>
                                <option value="36">Ch 36 (5.180 GHz)</option>
                                <option value="40">Ch 40 (5.200 GHz)</option>
                                <option value="44">Ch 44 (5.220 GHz)</option>
                                <option value="48">Ch 48 (5.240 GHz)</option>
                              </optgroup>
                              <optgroup label={isRu ? "DFS каналы (Radar sensitive)" : "DFS Radar Channels"}>
                                <option value="52">Ch 52 (5.260 GHz DFS)</option>
                                <option value="56">Ch 56 (5.280 GHz DFS)</option>
                                <option value="60">Ch 60 (5.300 GHz DFS)</option>
                                <option value="64">Ch 64 (5.320 GHz DFS)</option>
                                <option value="100">Ch 100 (5.500 GHz DFS)</option>
                                <option value="108">Ch 108 (5.540 GHz DFS)</option>
                                <option value="120">Ch 120 (5.600 GHz DFS Weather Radar)</option>
                                <option value="136">Ch 136 (5.680 GHz DFS)</option>
                                <option value="144">Ch 144 (5.720 GHz DFS)</option>
                              </optgroup>
                              <optgroup label={isRu ? "Верхний диапазон (Non-DFS)" : "Upper UNII-3 Channels"}>
                                <option value="149">Ch 149 (5.745 GHz)</option>
                                <option value="153">Ch 153 (5.765 GHz)</option>
                                <option value="157">Ch 157 (5.785 GHz)</option>
                                <option value="161">Ch 161 (5.805 GHz)</option>
                              </optgroup>
                            </>
                          ) : (
                            <>
                              <option value="auto">Auto (ACS Dynamic)</option>
                              <option value="1">Ch 1 (2.412 GHz)</option>
                              <option value="6">Ch 6 (2.437 GHz)</option>
                              <option value="11">Ch 11 (2.462 GHz)</option>
                              <option value="2">Ch 2</option>
                              <option value="3">Ch 3</option>
                              <option value="4">Ch 4</option>
                              <option value="5">Ch 5</option>
                              <option value="7">Ch 7</option>
                              <option value="8">Ch 8</option>
                              <option value="9">Ch 9</option>
                              <option value="10">Ch 10</option>
                              <option value="12">Ch 12</option>
                              <option value="13">Ch 13</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    {/* TX Power Control */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                          <Signal className="h-3.5 w-3.5 text-emerald-400" />
                          <span>{isRu ? "Мощность передатчика (TX Power):" : "Transmit Power (TX Power):"}</span>
                        </label>
                        <span className="font-mono text-xs text-emerald-400 font-semibold">
                          {form.txpower} dBm ({Math.round(Math.pow(10, form.txpower / 10))} mW)
                        </span>
                      </div>
                      <Slider
                        value={[form.txpower]}
                        min={10}
                        max={30}
                        step={1}
                        onValueChange={(vals) => handleFieldChange(radioName, "txpower", vals[0])}
                        disabled={!isEnabled}
                        className="py-1"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                        <span>10 dBm (10 mW)</span>
                        <span>20 dBm (100 mW)</span>
                        <span>23 dBm (200 mW)</span>
                        <span>30 dBm (1000 mW)</span>
                      </div>
                    </div>

                    {/* WPA3 / SAE Flags & Roaming */}
                    <div className="space-y-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                      <div className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-zinc-400" />
                        <span>{isRu ? "Безопасность WPA3 / SAE и роуминг" : "WPA3 / SAE Flags & Roaming"}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 font-medium">
                            {isRu ? "Режим шифрования" : "Security Suite"}
                          </label>
                          <select
                            value={form.encryption}
                            onChange={(e) => handleFieldChange(radioName, "encryption", e.target.value)}
                            disabled={!isEnabled}
                            className="w-full h-7 px-2 text-[11px] font-mono rounded bg-zinc-950 border border-zinc-800 text-zinc-200"
                          >
                            <option value="sae">WPA3-SAE Only</option>
                            <option value="sae-mixed">WPA2/WPA3 Mixed</option>
                            <option value="psk2">WPA2-PSK (CCMP)</option>
                            <option value="none">{isRu ? "Без шифрования (Open)" : "Open"}</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 font-medium">
                            {isRu ? "Фреймы управления (PMF)" : "PMF (802.11w)"}
                          </label>
                          <select
                            value={form.pmf}
                            onChange={(e) => handleFieldChange(radioName, "pmf", e.target.value)}
                            disabled={!isEnabled}
                            className="w-full h-7 px-2 text-[11px] font-mono rounded bg-zinc-950 border border-zinc-800 text-zinc-200"
                          >
                            <option value="2">Required (Обязательно для WPA3)</option>
                            <option value="1">Optional (Совместимость)</option>
                            <option value="0">Disabled (Отключено)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-800/60">
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 font-medium">
                            {isRu ? "Метод SAE-PWE" : "SAE-PWE Hash"}
                          </label>
                          <select
                            value={form.saePwe}
                            onChange={(e) => handleFieldChange(radioName, "saePwe", e.target.value)}
                            disabled={!isEnabled}
                            className="w-full h-7 px-2 text-[11px] font-mono rounded bg-zinc-950 border border-zinc-800 text-zinc-200"
                          >
                            <option value="2">2 - Hash-to-Element & Hunting</option>
                            <option value="1">1 - Hash-to-Element Only</option>
                            <option value="0">0 - Hunting-and-Pecking</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between pt-3">
                          <span className="text-[10px] text-zinc-400">802.11r Fast Roaming:</span>
                          <Switch
                            checked={form.fastRoaming}
                            onCheckedChange={(val) => handleFieldChange(radioName, "fastRoaming", val)}
                            disabled={!isEnabled}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Connected Clients Counter */}
                    <div className="h-8 px-3 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-300">
                      <span>{stationsCount} {isRu ? "клиентов подключено" : "connected stations"}</span>
                      <Users className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                  </CardContent>
                </div>

                {/* Card Footer with Save & Apply Button */}
                <div className="p-4 pt-3 border-t border-zinc-800/80 bg-zinc-950 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => handleSaveRadio(radioName)}
                    disabled={form.isSaving}
                    className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1.5 shadow-sm"
                  >
                    <Save className={`h-3.5 w-3.5 ${form.isSaving ? "animate-spin" : ""}`} />
                    {form.isSaving
                      ? isRu
                        ? "Применение..."
                        : "Applying..."
                      : isRu
                      ? "Сохранить и применить"
                      : "Save & Apply"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* QR Code Quick Connect Modal (Simple Mode) */}
      <Dialog open={!!showQrModal} onOpenChange={() => setShowQrModal(null)}>
        <DialogContent className="sm:max-w-xs bg-zinc-950 border-zinc-800 text-zinc-100 flex flex-col items-center text-center">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-1.5">
              <QrCode className="h-4 w-4 text-emerald-400" />
              <span>{isRu ? "Подключение к Wi-Fi" : "Wi-Fi Quick Connect"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {isRu ? "Отсканируйте камерой смартфона" : "Scan with phone camera"}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-white rounded-xl my-2 shadow-inner">
            <QRCodeSVG
              value={`WIFI:T:WPA;S:${
                showQrModal === "5" && !simpleSyncBands ? simpleSsid5 : simpleSsid24
              };P:${
                showQrModal === "5" && !simpleSyncBands ? simpleKey5 : simpleKey24
              };;`}
              size={180}
              level="M"
            />
          </div>

          <div className="text-xs font-mono text-zinc-300">
            SSID: <span className="font-bold text-white">{showQrModal === "5" && !simpleSyncBands ? simpleSsid5 : simpleSsid24}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowQrModal(null)}
            className="w-full mt-2 h-8 text-xs border-zinc-800"
          >
            {isRu ? "Закрыть" : "Close"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Channel Scan Survey Modal (Expert Mode) */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Scan className="h-4 w-4 text-zinc-400" />
              <span>{isRu ? "Сканирование радиоэфира (Wi-Fi Survey)" : "Wi-Fi Spectrum Survey"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {isRu
                ? "Обнаруженные соседние беспроводные сети, уровни сигналов (RSSI) и частоты"
                : "Detected neighboring wireless access points, channels and signal strengths"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {isScanning ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400 text-xs">
                <RefreshCw className="h-6 w-6 animate-spin text-zinc-500" />
                <span>{isRu ? "Сканирование частот..." : "Scanning frequencies..."}</span>
              </div>
            ) : scanResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                {isRu ? "Сети не обнаружены" : "No networks detected in scan"}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800">
                      <TableHead className="text-xs text-zinc-400">SSID</TableHead>
                      <TableHead className="text-xs text-zinc-400">BSSID</TableHead>
                      <TableHead className="text-xs text-zinc-400">{isRu ? "Канал" : "Channel"}</TableHead>
                      <TableHead className="text-xs text-zinc-400">{isRu ? "Сигнал" : "Signal"}</TableHead>
                      <TableHead className="text-xs text-zinc-400">{isRu ? "Защита" : "Security"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scanResults.map((net, i) => (
                      <TableRow key={i} className="border-zinc-800/60 font-mono text-xs">
                        <TableCell className="font-semibold text-zinc-200">
                          {net.ssid || "<Hidden SSID>"}
                        </TableCell>
                        <TableCell className="text-zinc-500 text-[11px]">{net.bssid}</TableCell>
                        <TableCell className="text-zinc-300">{net.channel || "-"}</TableCell>
                        <TableCell className="text-emerald-400">{net.signal ? `${net.signal} dBm` : "-"}</TableCell>
                        <TableCell className="text-zinc-400">
                          {net.encryption?.enabled ? "WPA/WPA2" : "Open"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
