import React, { useEffect, useState } from "react";
import { useDeviceRoutingStore } from "@/store/device-routing-store";
import { useI18nStore } from "@/store/i18n-store";
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
import { Switch } from "@/components/ui/switch";
import { Smartphone, Laptop, Tv, Monitor, CheckCircle2 } from "lucide-react";
import { DeviceRoutingRule } from "@/types/ubus";

export const DeviceRoutingTable: React.FC = () => {
  const { devices, fetchDevices, setDeviceInterface, toggleDevice } = useDeviceRoutingStore();
  const { language } = useI18nStore();
  const isRu = language === "ru";
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleInterfaceChange = async (ip: string, name: string, iface: DeviceRoutingRule["interface"]) => {
    const success = await setDeviceInterface(ip, iface);
    if (success) {
      showToast(
        isRu
          ? `Маршрут для ${name} (${ip}) изменен на ${iface}`
          : `Routing for ${name} (${ip}) updated to ${iface}`
      );
    }
  };

  const handleToggle = async (ip: string, name: string) => {
    const success = await toggleDevice(ip);
    if (success) {
      showToast(
        isRu
          ? `Статус правила для ${name} (${ip}) переключен`
          : `Rule toggled for ${name} (${ip})`
      );
    }
  };

  const getDeviceIcon = (name = "") => {
    const h = name.toLowerCase();
    if (h.includes("iphone") || h.includes("android") || h.includes("redmi") || h.includes("phone")) {
      return <Smartphone className="h-4 w-4 text-emerald-400" />;
    }
    if (h.includes("macbook") || h.includes("laptop") || h.includes("thinkpad")) {
      return <Laptop className="h-4 w-4 text-zinc-300" />;
    }
    if (h.includes("tv") || h.includes("roku") || h.includes("apple-tv")) {
      return <Tv className="h-4 w-4 text-amber-400" />;
    }
    return <Monitor className="h-4 w-4 text-zinc-400" />;
  };

  return (
    <div className="space-y-3">
      {feedback && (
        <div className="p-2.5 rounded-md bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in-50">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="flex items-center justify-between px-1 sm:hidden">
        <span className="text-[10px] text-zinc-500 font-mono">
          {isRu ? "← Прокрутите таблицу для выбора туннеля →" : "← Scroll table horizontally for options →"}
        </span>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <Table className="min-w-[620px]">
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="w-8 text-center"></TableHead>
              <TableHead className="text-xs font-medium text-zinc-400">
                {isRu ? "Устройство / Имя" : "Device / Hostname"}
              </TableHead>
              <TableHead className="text-xs font-medium text-zinc-400">
                {isRu ? "IP адрес" : "IPv4 Address"}
              </TableHead>
              <TableHead className="text-xs font-medium text-zinc-400">
                {isRu ? "MAC адрес" : "MAC Address"}
              </TableHead>
              <TableHead className="text-xs font-medium text-zinc-400">
                {isRu ? "Целевой туннель / Шлюз" : "Target Tunnel / Interface"}
              </TableHead>
              <TableHead className="w-20 text-center text-xs font-medium text-zinc-400">
                {isRu ? "Статус" : "Status"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => {
              return (
                <TableRow
                  key={device.ip}
                  className="border-zinc-800/80 hover:bg-zinc-900/40 transition-colors"
                >
                  <TableCell className="text-center">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        device.online !== false ? "bg-emerald-500" : "bg-zinc-700"
                      }`}
                      title={device.online !== false ? (isRu ? "В сети" : "Online") : (isRu ? "Офлайн" : "Offline")}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      {getDeviceIcon(device.name)}
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-zinc-200">
                          {device.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          DHCP static host pinned
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono tabular-nums text-zinc-300">
                      {device.ip}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono tabular-nums text-zinc-500">
                      {device.mac}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        value={device.interface}
                        onValueChange={(val: any) => handleInterfaceChange(device.ip, device.name, val)}
                      >
                        <SelectTrigger className="h-8 w-48 text-xs bg-zinc-950 border-zinc-800 text-zinc-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200">
                          <SelectItem value="default">
                            {isRu ? "По умолчанию / Авто" : "Default / Auto"}
                          </SelectItem>
                          <SelectItem value="wan">
                            {isRu ? "Прямой WAN (Обход VPN)" : "Direct WAN (Bypass All)"}
                          </SelectItem>
                          <SelectItem value="singbox">
                            Sing-box (VLESS Reality)
                          </SelectItem>
                          <SelectItem value="awg0">
                            AmneziaWG (awg0)
                          </SelectItem>
                          <SelectItem value="zapret">
                            Zapret2 DPI Bypass
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={device.enabled}
                      onCheckedChange={() => handleToggle(device.ip, device.name)}
                      className="data-[state=checked]:bg-zinc-100 data-[state=unchecked]:bg-zinc-800"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};