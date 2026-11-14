import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ubusClient } from "@/lib/ubus-client";
import { useI18nStore } from "@/store/i18n-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import {
  Radio,
  Wifi,
  Scan,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Signal,
} from "lucide-react";

export const Wireless: React.FC = () => {
  const { language } = useI18nStore();
  const isRu = language === "ru";

  const { data: wifiMap, refetch, isLoading } = useQuery({
    queryKey: ["wireless-devices"],
    queryFn: () => ubusClient.getWirelessDevices(),
    refetchInterval: 5000,
  });

  const [scanOpen, setScanOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<any[]>([]);

  // Per-radio form state
  const [radioForms, setRadioForms] = useState<
    Record<
      string,
      {
        ssid: string;
        key: string;
        encryption: string;
        channel: number | string;
        htmode: string;
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

        const liveSsid = ifaceConfig.ssid || ifaceIwinfo.ssid || iface?.ssid || (is5G ? "OpenWRT" : "OpenWRT");
        const liveKey = ifaceConfig.key || iface?.key || "12345678";
        const liveEncryption = ifaceConfig.encryption || iface?.encryption || "psk2";
        const liveChannel = radioConfig.channel || radioIwinfo.channel || radio.channel || (is5G ? 36 : 1);
        const liveHtmode = radioConfig.htmode || (is5G ? "EHT80" : "EHT20");
        const liveDisabled = radioConfig.disabled === true || radio.disabled === true || ifaceConfig.disabled === true;

        if (!next[radioName]) {
          next[radioName] = {
            ssid: liveSsid,
            key: liveKey,
            encryption: liveEncryption,
            channel: liveChannel,
            htmode: liveHtmode,
            disabled: liveDisabled,
            showKey: false,
            isSaving: false,
            savedSuccess: false,
            error: null,
          };
        }
      });
      return next;
    });
  }, [wifiMap]);

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

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Title & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Wifi className="h-4 w-4 text-zinc-400" />
            {isRu ? "Беспроводная сеть Wi-Fi (802.11be / Wi-Fi 7)" : "Wi-Fi Wireless Networks (802.11be / Wi-Fi 7)"}
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isRu
              ? "Управление диапазонами 2.4 GHz и 5 GHz, SSIDs, паролями WPA2/WPA3 и шириной канала"
              : "Manage 2.4 GHz and 5 GHz radios, SSIDs, WPA2/WPA3 security, and channel widths"}
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartScan}
            disabled={isScanning}
            className="text-xs gap-1.5 h-8 border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 flex-1 sm:flex-initial"
          >
            <Scan className={`h-3.5 w-3.5 ${isScanning ? "animate-spin" : ""}`} />
            {isScanning ? (isRu ? "Сканирование..." : "Scanning...") : (isRu ? "Сканировать эфир" : "Scan Channels")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="text-xs gap-1.5 h-8 border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 flex-1 sm:flex-initial"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {isRu ? "Обновить статус" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Radios Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {radios.map(([radioName, radio]) => {
          const form = radioForms[radioName] || {
            ssid: "OpenWrt",
            key: "12345678",
            encryption: "psk2",
            channel: 1,
            htmode: "EHT20",
            disabled: false,
            showKey: false,
            isSaving: false,
            savedSuccess: false,
            error: null,
          };

          const iface = radio.interfaces?.[0];
          const is5G = radio.band === "5g" || radioName.includes("1");
          const isEnabled = !form.disabled;
          const stationsCount = iface?.assoclist ? Object.keys(iface.assoclist).length : 0;

          return (
            <Card key={radioName} className="border-zinc-800 bg-zinc-900/50 flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b border-zinc-800/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-200">
                        <Radio className="h-4 w-4 text-zinc-300" />
                      </div>
                      <div>
                        <CardTitle className="text-xs font-semibold font-mono text-zinc-200 uppercase">
                          {radioName} • {is5G ? "5 GHz (Wi-Fi 7)" : "2.4 GHz (Wi-Fi 7)"}
                        </CardTitle>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          MediaTek MT7992E • {iface?.ifname || "phy0"}
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
                    <div className="p-2.5 rounded-md bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                      <span>{form.error}</span>
                    </div>
                  )}

                  {/* SSID Name */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-zinc-400">
                      {isRu ? "Имя сети (SSID)" : "Network Name (SSID)"}
                    </label>
                    <Input
                      value={form.ssid}
                      onChange={(e) => handleFieldChange(radioName, "ssid", e.target.value)}
                      disabled={!isEnabled}
                      className="h-8 font-mono text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                      placeholder={is5G ? "OpenWrt-5G" : "OpenWrt-2.4G"}
                    />
                  </div>

                  {/* Password / Key */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-zinc-400 flex items-center justify-between">
                      <span>{isRu ? "Пароль сети (WPA Key)" : "Password (WPA Key)"}</span>
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

                  {/* Security & Channel Settings */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-zinc-400">
                        {isRu ? "Шифрование" : "Security"}
                      </label>
                      <select
                        value={form.encryption}
                        onChange={(e) => handleFieldChange(radioName, "encryption", e.target.value)}
                        disabled={!isEnabled}
                        className="w-full h-8 px-2 text-xs font-mono rounded-md bg-zinc-950 border border-zinc-800 text-zinc-200"
                      >
                        <option value="psk2">WPA2-PSK (CCMP)</option>
                        <option value="sae">WPA3-SAE</option>
                        <option value="sae-mixed">WPA2/WPA3 Mixed</option>
                        <option value="none">{isRu ? "Без пароля (Open)" : "Open (No Security)"}</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-zinc-400">
                        {isRu ? "Канал" : "Channel"}
                      </label>
                      <select
                        value={String(form.channel)}
                        onChange={(e) => handleFieldChange(radioName, "channel", e.target.value)}
                        disabled={!isEnabled}
                        className="w-full h-8 px-2 text-xs font-mono rounded-md bg-zinc-950 border border-zinc-800 text-zinc-200"
                      >
                        {is5G ? (
                          <>
                            <option value="auto">Auto (ACS)</option>
                            <option value="36">36 (5.180 GHz)</option>
                            <option value="40">40 (5.200 GHz)</option>
                            <option value="44">44 (5.220 GHz)</option>
                            <option value="48">48 (5.240 GHz)</option>
                            <option value="149">149 (5.745 GHz)</option>
                            <option value="153">153 (5.765 GHz)</option>
                            <option value="157">157 (5.785 GHz)</option>
                            <option value="161">161 (5.805 GHz)</option>
                          </>
                        ) : (
                          <>
                            <option value="auto">Auto (ACS)</option>
                            <option value="1">1 (2.412 GHz)</option>
                            <option value="6">6 (2.437 GHz)</option>
                            <option value="11">11 (2.462 GHz)</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="7">7</option>
                            <option value="8">8</option>
                            <option value="9">9</option>
                            <option value="10">10</option>
                            <option value="12">12</option>
                            <option value="13">13</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Width & Active Status Row */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-zinc-400">
                        {isRu ? "Ширина канала" : "Channel Width"}
                      </label>
                      <select
                        value={form.htmode}
                        onChange={(e) => handleFieldChange(radioName, "htmode", e.target.value)}
                        disabled={!isEnabled}
                        className="w-full h-8 px-2 text-xs font-mono rounded-md bg-zinc-950 border border-zinc-800 text-zinc-200"
                      >
                        {is5G ? (
                          <>
                            <option value="EHT160">EHT160 (160 MHz)</option>
                            <option value="EHT80">EHT80 (80 MHz)</option>
                            <option value="HE80">HE80 (80 MHz Wi-Fi 6)</option>
                            <option value="VHT80">VHT80 (80 MHz Wi-Fi 5)</option>
                            <option value="HT40">HT40 (40 MHz)</option>
                          </>
                        ) : (
                          <>
                            <option value="EHT20">EHT20 (20 MHz)</option>
                            <option value="EHT40">EHT40 (40 MHz)</option>
                            <option value="HE20">HE20 (20 MHz Wi-Fi 6)</option>
                            <option value="HT20">HT20 (20 MHz)</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-zinc-400">
                        {isRu ? "Подключенные клиенты" : "Connected Clients"}
                      </label>
                      <div className="h-8 px-3 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-300">
                        <span>{stationsCount} {isRu ? "клиентов" : "clients"}</span>
                        <Signal className="h-3.5 w-3.5 text-zinc-500" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>

              {/* Card Footer with Save & Apply Button */}
              <div className="p-4 pt-3 border-t border-zinc-800/80 bg-zinc-950/40 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => handleSaveRadio(radioName)}
                  disabled={form.isSaving}
                  className="text-xs bg-zinc-100 text-zinc-950 hover:bg-white font-medium gap-1.5 shadow-sm"
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

      {/* Channel Scan Survey Modal */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Scan className="h-4 w-4 text-zinc-400" />
              {isRu ? "Сканирование радиоэфира (Wi-Fi Survey)" : "Wi-Fi Spectrum Survey"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {isRu
                ? "Обнаруженные соседние беспроводные сети и их уровни сигналов"
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
