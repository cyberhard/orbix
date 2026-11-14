import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Router,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  FileCode,
  Terminal,
  Cpu,
  Radio,
  Sparkles,
  BookOpen,
  ArrowRight,
  LifeBuoy,
} from "lucide-react";
import { useI18nStore } from "@/store/i18n-store";
import { usePolicyStore } from "@/store/policy-store";

export interface DeviceEntry {
  id: string;
  brand: string;
  model: string;
  revision: string;
  target: string;
  arch: string;
  flashMb: number;
  ramMb: number;
  wifi: string;
  status: "fully_supported" | "limited" | "experimental";
  openwrtVersions: string[];
  factoryFilename: string;
  sysupgradeFilename: string;
  factorySha256: string;
  sysupgradeSha256: string;
  oemFlashingMethod: string;
  recoveryMethod: string;
  notes?: string;
  notesRu?: string;
}

export const HARDWARE_CATALOG: DeviceEntry[] = [
  {
    id: "netcraze-nc1812",
    brand: "Netcraze",
    model: "NC-1812",
    revision: "v1.0",
    target: "mediatek/filogic",
    arch: "aarch64 (Cortex-A53)",
    flashMb: 256,
    ramMb: 1024,
    wifi: "Wi-Fi 6 (MT7981 2.4G 574Mbps / 5G 2402Mbps)",
    status: "fully_supported",
    openwrtVersions: ["25.12.6", "24.10.0"],
    factoryFilename: "openwrt-25.12.6-mediatek-filogic-netcraze_nc-1812-factory.bin",
    sysupgradeFilename: "openwrt-25.12.6-mediatek-filogic-netcraze_nc-1812-sysupgrade.bin",
    factorySha256: "9f82c1b48d2e7a1a9e3344bf5612809e2cf31b9e847192a013c7d6e491823ab1",
    sysupgradeSha256: "3d47a829f01bc498e722a5518b9c402189d2fe7489a012c419e7623910ab3811",
    oemFlashingMethod: "Веб-интерфейс Netcraze: Обновление ПО -> Выбрать файл factory.bin",
    recoveryMethod: "U-Boot Web Failsafe: зажать кнопку Reset при включении питания на 5 сек, открыть 192.168.1.1",
    notesRu: "Эталонное устройство. Аппаратное ускорение NAT и WireGuard активно. 1 ГБ ОЗУ позволяет держать полный пакет Sing-box и Zapret.",
  },
  {
    id: "cudy-wr3000",
    brand: "Cudy",
    model: "WR3000",
    revision: "v1",
    target: "mediatek/filogic",
    arch: "aarch64 (Cortex-A53)",
    flashMb: 128,
    ramMb: 256,
    wifi: "Wi-Fi 6 (MT7981B 2.4G / 5G 160MHz)",
    status: "fully_supported",
    openwrtVersions: ["25.12.6", "24.10.0", "23.05.5"],
    factoryFilename: "openwrt-25.12.6-mediatek-filogic-cudy_wr3000-v1-factory.bin",
    sysupgradeFilename: "openwrt-25.12.6-mediatek-filogic-cudy_wr3000-v1-sysupgrade.bin",
    factorySha256: "4a88bc19d3e8172901abcf891238910471b89e72849102c7489e17289301ba22",
    sysupgradeSha256: "2198abce7281938201948ba9e1823901bca74819e01823749810237489102384",
    oemFlashingMethod: "Веб-интерфейс Cudy: Firmware Upgrade -> Загрузить openwrt-...-factory.bin",
    recoveryMethod: "TFTP Recovery: IP сервера 192.168.1.66, файл recovery.bin",
    notesRu: "Отличный бюджетный роутер Wi-Fi 6. Полная поддержка всех функций ORBIX.",
  },
  {
    id: "xiaomi-ax3000t",
    brand: "Xiaomi",
    model: "AX3000T",
    revision: "Chinese / Global",
    target: "mediatek/filogic",
    arch: "aarch64 (Cortex-A53)",
    flashMb: 128,
    ramMb: 256,
    wifi: "Wi-Fi 6 (MT7981B 160MHz)",
    status: "fully_supported",
    openwrtVersions: ["25.12.6", "24.10.0"],
    factoryFilename: "openwrt-25.12.6-mediatek-filogic-xiaomi_ax3000t-factory.bin",
    sysupgradeFilename: "openwrt-25.12.6-mediatek-filogic-xiaomi_ax3000t-sysupgrade.bin",
    factorySha256: "8e71b29a018273948bcae9182374901ba72819e0182374981023748910238491",
    sysupgradeSha256: "5c81928374901abce7281938201948ba9e1823901bca74819e01823749810237",
    oemFlashingMethod: "Разблокировка Telnet/SSH через эксплойт MiWiFi, запись в раздел mtd",
    recoveryMethod: "U-Boot Web Failsafe: зажать Reset при включении на 7 сек, IP 192.168.31.1",
    notesRu: "Требует однократной разблокировки SSH на заводской прошивке перед установкой OpenWrt.",
  },
  {
    id: "glinet-gl-mt3000",
    brand: "GL.iNet",
    model: "GL-MT3000 (Beryl AX)",
    revision: "v1",
    target: "mediatek/filogic",
    arch: "aarch64 (Cortex-A53)",
    flashMb: 256,
    ramMb: 512,
    wifi: "Wi-Fi 6 (MT7981)",
    status: "fully_supported",
    openwrtVersions: ["25.12.6", "24.10.0", "23.05.5"],
    factoryFilename: "openwrt-25.12.6-mediatek-filogic-glinet_gl-mt3000-factory.bin",
    sysupgradeFilename: "openwrt-25.12.6-mediatek-filogic-glinet_gl-mt3000-sysupgrade.bin",
    factorySha256: "3b71928374901abce7281938201948ba9e1823901bca74819e01823749810238",
    sysupgradeSha256: "7a81928374901abce7281938201948ba9e1823901bca74819e01823749810239",
    oemFlashingMethod: "Веб-интерфейс GL.iNet: Upgrade -> Local Upgrade -> Выбрать sysupgrade.bin",
    recoveryMethod: "Встроенный U-Boot Web: зажать Reset при старте на 5 сек, открыть 192.168.8.1",
    notesRu: "Компактный дорожный роутер с 2.5G WAN портом. Идеален для путешествий.",
  },
  {
    id: "x86-generic-64",
    brand: "x86 / Generic",
    model: "Mini-PC / Proxmox / VM",
    revision: "64-bit UEFI",
    target: "x86/64",
    arch: "x86_64 (Intel / AMD)",
    flashMb: 2048,
    ramMb: 4096,
    wifi: "Внешний USB или PCIe адаптер (опционально)",
    status: "fully_supported",
    openwrtVersions: ["25.12.6", "24.10.0", "23.05.5"],
    factoryFilename: "openwrt-25.12.6-x86-64-generic-ext4-combined-efi.img.gz",
    sysupgradeFilename: "openwrt-25.12.6-x86-64-generic-ext4-combined-efi.img.gz",
    factorySha256: "1e71928374901abce7281938201948ba9e1823901bca74819e01823749810237",
    sysupgradeSha256: "1e71928374901abce7281938201948ba9e1823901bca74819e01823749810237",
    oemFlashingMethod: "Запись образа на SSD/флешку через Rufus, BalenaEtcher или dd",
    recoveryMethod: "Загрузка с LiveUSB Ubuntu/Debian для восстановления раздела boot",
    notesRu: "Максимальная производительность (10G маршрутизация, AES-NI ускорение).",
  },
  {
    id: "glinet-gl-b1300",
    brand: "GL.iNet",
    model: "GL-B1300 (Cono)",
    revision: "v1",
    target: "ipq40xx/generic",
    arch: "arm_cortex-a7",
    flashMb: 32,
    ramMb: 256,
    wifi: "Wi-Fi 5 (IPQ4028 2.4G/5G)",
    status: "limited",
    openwrtVersions: ["24.10.0", "23.05.5"],
    factoryFilename: "openwrt-24.10.0-ipq40xx-generic-glinet_gl-b1300-squashfs-factory.bin",
    sysupgradeFilename: "openwrt-24.10.0-ipq40xx-generic-glinet_gl-b1300-squashfs-sysupgrade.bin",
    factorySha256: "9a71928374901abce7281938201948ba9e1823901bca74819e01823749810231",
    sysupgradeSha256: "8b71928374901abce7281938201948ba9e1823901bca74819e01823749810232",
    oemFlashingMethod: "Веб-интерфейс GL.iNet -> Upgrade -> Local Upgrade",
    recoveryMethod: "U-Boot Web Failsafe: зажать Reset при старте, IP 192.168.1.1",
    notesRu: "Флеш-память 32 МБ требует использования минимального профиля (Minimal Bundle).",
  },
];

export const HardwareCatalog: React.FC = () => {
  const { lang } = useI18nStore();
  const isRu = lang === "ru";

  const { operatingMode } = usePolicyStore();
  const isSimple = operatingMode === "simple";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedDevice, setSelectedDevice] = useState<DeviceEntry | null>(null);

  const filteredDevices = HARDWARE_CATALOG.filter((dev) => {
    const matchesSearch =
      dev.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.target.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBrand = selectedBrand === "all" || dev.brand.toLowerCase() === selectedBrand.toLowerCase();
    return matchesSearch && matchesBrand;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Router className="h-5 w-5 text-emerald-400" />
            <span>{isRu ? "Каталог поддерживаемого оборудования и прошивок" : "Hardware Catalog & Firmware Distribution"}</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isRu
              ? "Официальные готовые сборки OpenWrt с предустановленной панелью, проверка совместимости и инструкции по установке"
              : "Pre-built OpenWrt firmware images with ORBIX preinstalled, checksums, and flashing guides"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800 p-1">
          <TabsTrigger value="catalog" className="gap-2">
            <Router className="h-4 w-4 text-emerald-400" />
            <span>{isRu ? "Каталог роутеров" : "Hardware Catalog"}</span>
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-2">
            <BookOpen className="h-4 w-4 text-cyan-400" />
            <span>{isRu ? "Руководство для новичков" : "Beginner Flashing Guide"}</span>
          </TabsTrigger>
          <TabsTrigger value="installer" className="gap-2">
            <Terminal className="h-4 w-4 text-purple-400" />
            <span>{isRu ? "Скрипт install.sh" : "One-Line Installer"}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Hardware Catalog */}
        <TabsContent value="catalog" className="space-y-6 mt-4">
          {/* Top Recommendation Banner for Simple Mode */}
          {isSimple && (
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-zinc-200">
                  {isRu ? "Рекомендуемые роутеры с аппаратным ускорением Wi-Fi 6" : "Recommended Hardware for Peak Performance"}
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  {isRu
                    ? "Для максимальной скорости и стабильной работы без зависаний мы рекомендуем роутеры на платформе MediaTek Filogic: Netcraze NC-1812 (1 ГБ ОЗУ), Cudy WR3000 и GL.iNet MT3000. Они обеспечивают 1 Гбит/с через VPN и аппаратное ускорение NAT."
                    : "For best performance and full gigabit VPN speeds, we recommend MediaTek Filogic devices: Netcraze NC-1812, Cudy WR3000, and GL.iNet MT3000."}
                </p>
              </div>
            </div>
          )}

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
            <div className="relative flex-1 w-full">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-500" />
              <Input
                placeholder={isRu ? "Поиск по модели роутера, бренду или чипсету (например, NC-1812, Xiaomi, Filogic)..." : "Search model, brand, target..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-xs bg-zinc-900 border-zinc-800 text-zinc-200"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {["all", "netcraze", "cudy", "xiaomi", "gl.inet", "x86"].map((b) => (
                <Button
                  key={b}
                  variant={selectedBrand === b ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedBrand(b)}
                  className={`h-8 text-xs capitalize ${
                    selectedBrand === b ? "bg-emerald-600 text-white" : "border-zinc-800 text-zinc-400"
                  }`}
                >
                  {b === "all" ? (isRu ? "Все бренды" : "All") : b}
                </Button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDevices.map((dev) => (
              <Card
                key={dev.id}
                className="border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <CardHeader className="pb-3 border-b border-zinc-800/80">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase font-mono">{dev.brand}</div>
                      <CardTitle className="text-sm font-bold text-zinc-100 mt-0.5">{dev.model}</CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-mono uppercase ${
                        dev.status === "fully_supported"
                          ? "border-emerald-800 text-emerald-400 bg-emerald-950/20"
                          : dev.status === "limited"
                          ? "border-amber-800 text-amber-400 bg-amber-950/20"
                          : "border-purple-800 text-purple-400 bg-purple-950/20"
                      }`}
                    >
                      {dev.status === "fully_supported"
                        ? isRu ? "Полная поддержка" : "Fully Supported"
                        : dev.status === "limited"
                        ? isRu ? "Ограничения (Flash)" : "Limited"
                        : "Experimental"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-3 pb-4 space-y-2.5 text-xs flex-1 flex flex-col justify-between">
                  {isSimple ? (
                    <div className="space-y-1.5 text-[11px] text-zinc-400">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">{isRu ? "Память:" : "Memory:"}</span>
                        <span className="text-zinc-200 font-semibold">{dev.ramMb} MB RAM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Wi-Fi:</span>
                        <span className="text-emerald-400 truncate max-w-[170px]">{dev.wifi}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">{isRu ? "Скорость VPN:" : "VPN Speed:"}</span>
                        <span className="text-zinc-300 font-medium">{dev.ramMb >= 512 ? "До 1000 Мбит/с" : "До 450 Мбит/с"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 font-mono text-[11px] text-zinc-400">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Target:</span>
                        <span className="text-zinc-300">{dev.target}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">RAM / Flash:</span>
                        <span className="text-zinc-300">{dev.ramMb} MB / {dev.flashMb} MB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Wi-Fi:</span>
                        <span className="text-cyan-400 truncate max-w-[170px]">{dev.wifi}</span>
                      </div>
                    </div>
                  )}

                  {dev.notesRu && (
                    <p className="text-[11px] text-zinc-400 bg-zinc-900/40 p-2 rounded border border-zinc-800/80 mt-2">
                      {dev.notesRu}
                    </p>
                  )}

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setSelectedDevice(dev)}
                      className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{isRu ? "Файлы прошивки" : "Firmware Images"}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Beginner Flashing Guide */}
        <TabsContent value="guide" className="space-y-4 mt-4 text-xs">
          <Card className="border-zinc-800 bg-zinc-950 p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-cyan-400" />
                <span>{isRu ? "Пошаговое руководство по переходу на OpenWrt для начинающих" : "Step-by-Step Installation Guide for Beginners"}</span>
              </h3>
              <p className="text-zinc-400 mt-1">
                {isRu
                  ? "Как безопасно установить OpenWrt на ваш роутер без риска повреждения устройства."
                  : "How to safely flash OpenWrt onto your home router without bricking the device."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-2">
                <div className="font-bold text-zinc-200 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono">1</div>
                  <span>{isRu ? "Определите точную ревизию (Hardware Revision)" : "Identify Hardware Revision"}</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  {isRu
                    ? "Посмотрите на наклейку на нижней стороне роутера. Модели вроде Cudy WR3000 v1 и v2 могут иметь разные чипсеты. Всегда скачивайте прошивку строго под вашу ревизию!"
                    : "Check the label on the bottom of your router. Never flash firmware designed for a different revision."}
                </p>
              </div>

              <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-2">
                <div className="font-bold text-zinc-200 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono">2</div>
                  <span>{isRu ? "Factory vs Sysupgrade — в чём разница?" : "Factory vs Sysupgrade"}</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  {isRu
                    ? "• Factory.bin — используется ПЕРВЫЙ раз при переходе со стандартной заводской прошивки вендора.\n• Sysupgrade.bin — используется, когда на роутере УЖЕ установлена OpenWrt для обновления."
                    : "• Factory.bin: for first-time transition from OEM vendor firmware.\n• Sysupgrade.bin: for upgrading existing OpenWrt."}
                </p>
              </div>

              <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-2">
                <div className="font-bold text-zinc-200 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono">3</div>
                  <span>{isRu ? "Процесс прошивки через веб-интерфейс" : "Flashing via OEM Web UI"}</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  {isRu
                    ? "Подключите компьютер к роутеру по кабелю Ethernet (порт LAN 1). Откройте веб-интерфейс роутера, перейдите в «Обновление ПО», выберите скачанный файл `factory.bin` и нажмите «Обновить». Не выключайте питание роутера в течение 5 минут!"
                    : "Connect via Ethernet to LAN 1. In OEM settings find Firmware Upgrade, select `factory.bin`. Do not power off for 5 minutes!"}
                </p>
              </div>

              <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-2">
                <div className="font-bold text-zinc-200 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono">4</div>
                  <span>{isRu ? "Первый запуск ORBIX" : "First Launch & Setup"}</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  {isRu
                    ? "После перезагрузки откройте браузер и перейдите на http://192.168.1.1. Автоматически откроется мастер настройки, который предложит задать пароль, настроить интернет и включить обход блокировок."
                    : "Open browser at http://192.168.1.1. The Setup Wizard will automatically launch and guide you."}
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: One-line install.sh */}
        <TabsContent value="installer" className="space-y-4 mt-4 text-xs">
          <Card className="border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Terminal className="h-5 w-5 text-zinc-400" />
                <span>{isRu ? "Установка на уже работающий OpenWrt" : "Install on Existing OpenWrt Router"}</span>
              </h3>
              <p className="text-zinc-400 mt-1">
                {isRu
                  ? "Если на вашем роутере уже установлена стандартная OpenWrt, вы можете развернуть ORBIX одной командой по SSH:"
                  : "If your router already runs OpenWrt, deploy ORBIX via SSH with one command:"}
              </p>
            </div>

            <div className="p-3 bg-zinc-900 font-mono text-zinc-200 rounded-lg border border-zinc-800 flex items-center justify-between">
              <code>curl -sSL https://raw.githubusercontent.com/cyberhard/orbix/main/scripts/install.sh | sh</code>
            </div>

            <div className="space-y-2 text-zinc-400 leading-relaxed">
              <p className="font-semibold text-zinc-200">{isRu ? "Что делает этот скрипт:" : "What this script does:"}</p>
              <ul className="list-disc pl-5 space-y-1 text-[11px]">
                <li>{isRu ? "Автоматически определяет архитектуру роутера (aarch64, mips, x86_64) и менеджер пакетов (apk / opkg)." : "Detects router architecture and package manager (apk / opkg)."}</li>
                <li>{isRu ? "Проверяет свободное место на флеш-памяти (/overlay) и доступную оперативную память." : "Checks free flash storage and RAM."}</li>
                <li>{isRu ? "Устанавливает необходимые библиотеки rpcd, jsonfilter, uhttpd." : "Installs required rpcd, jsonfilter, uhttpd dependencies."}</li>
                <li>{isRu ? "Разворачивает бэкенд и быстрый веб-интерфейс в /www/." : "Deploys rpcd backend and frontend into /www/."}</li>
                <li>{isRu ? "Настраивает права доступа и перезапускает веб-сервер." : "Configures permissions and restarts web server."}</li>
              </ul>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Firmware Download Modal */}
      {selectedDevice && (
        <Dialog open={!!selectedDevice} onOpenChange={(open) => !open && setSelectedDevice(null)}>
          <DialogContent className="sm:max-w-xl bg-zinc-950 border-zinc-800 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Router className="h-4 w-4 text-emerald-400" />
                <span>{selectedDevice.brand} {selectedDevice.model} ({selectedDevice.revision})</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {isRu ? "Файлы прошивки OpenWrt с предустановленным ORBIX" : "Pre-built OpenWrt images with ORBIX"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Factory */}
              <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Badge variant="outline" className="border-emerald-800 text-emerald-400 text-[9px] font-mono">FACTORY</Badge>
                    <span>{selectedDevice.factoryFilename}</span>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-zinc-500 break-all">
                  SHA-256: {selectedDevice.factorySha256}
                </div>
                <div className="text-[11px] text-zinc-400">
                  <span className="text-zinc-500">{isRu ? "Метод прошивки: " : "Method: "}</span>
                  {selectedDevice.oemFlashingMethod}
                </div>
              </div>

              {/* Sysupgrade */}
              <div className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Badge variant="outline" className="border-cyan-800 text-cyan-400 text-[9px] font-mono">SYSUPGRADE</Badge>
                    <span>{selectedDevice.sysupgradeFilename}</span>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-zinc-500 break-all">
                  SHA-256: {selectedDevice.sysupgradeSha256}
                </div>
              </div>

              {/* Recovery */}
              <div className="p-3 bg-amber-950/20 border border-amber-800/60 rounded-lg text-amber-300">
                <div className="font-semibold flex items-center gap-1.5">
                  <LifeBuoy className="h-3.5 w-3.5" />
                  <span>{isRu ? "Инструкция по аварийному восстановлению:" : "Recovery Failsafe Procedure:"}</span>
                </div>
                <div className="text-[11px] text-amber-300/80 mt-1">
                  {selectedDevice.recoveryMethod}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
