// Cross-Device Configuration Migration & Hardware Adaptation Engine
// Automatically adapts portable configurations to target OpenWrt router hardware.

import { PanelConfiguration, NetworkInterfaceConfig } from "./schema";
import { SystemBoard, NetworkInterfaceStatus, WirelessDevice } from "@/types/ubus";

export interface MigrationItem {
  section: string;
  key: string;
  status: "imported" | "adapted" | "requires_attention" | "unsupported" | "skipped";
  title: string;
  description: string;
  oldValue?: any;
  newValue?: any;
}

export interface MigrationReport {
  targetDevice: string;
  sourceDevice: string;
  items: MigrationItem[];
  canProceed: boolean;
  subnetConflictDetected: boolean;
  proposedLanIp?: string;
  missingPackages: string[];
}

export class ConfigMigrator {
  /**
   * Analyze and adapt an imported configuration to current target router hardware.
   */
  public static analyze(
    importedConfig: PanelConfiguration,
    currentBoard: SystemBoard,
    currentIfaces: NetworkInterfaceStatus[],
    currentRadios: Record<string, WirelessDevice>,
    installedPackages: Record<string, string>,
    sourceDevice = "Unknown router"
  ): MigrationReport {
    const items: MigrationItem[] = [];
    const missingPackages: string[] = [];
    let subnetConflictDetected = false;
    let proposedLanIp: string | undefined;

    const targetModel = currentBoard?.model || currentBoard?.board_name || "OpenWrt Router";

    // 1. Package Dependency & Service Checks
    const checkPackage = (pkgName: string, serviceName: string, section: string) => {
      const isInstalled = !!installedPackages[pkgName];
      if (!isInstalled) {
        missingPackages.push(pkgName);
        items.push({
          section,
          key: pkgName,
          status: "requires_attention",
          title: `Пакет ${pkgName} не установлен`,
          description: `Для работы раздела "${serviceName}" требуется пакет ${pkgName}. Его можно будет установить после импорта.`,
        });
      }
    };

    if (importedConfig.vpn?.subscription?.nodes?.length) {
      checkPackage("sing-box", "VLESS Reality VPN", "vpn");
    }
    if (importedConfig.vpn?.amnezia_wg?.enabled) {
      checkPackage("kmod-amneziawg", "AmneziaWG", "vpn");
    }
    if (importedConfig.zapret?.enabled) {
      checkPackage("zapret", "Zapret DPI Desync", "zapret");
    }

    // 2. Network & Subnet Conflict Resolution
    if (importedConfig.network?.interfaces) {
      const currentWan = currentIfaces.find((i) => i.interface === "wan" || i.l3_device === "wan");
      const currentWanIp = currentWan?.["ipv4-address"]?.[0]?.address;

      const importedLan = importedConfig.network.interfaces.find((i) => i.role === "lan");
      const importedLanIp = importedLan?.ipaddr || "192.168.1.1";

      if (currentWanIp && importedLanIp) {
        // Compare /24 subnets
        const wanSubnet = currentWanIp.split(".").slice(0, 3).join(".");
        const lanSubnet = importedLanIp.split(".").slice(0, 3).join(".");

        if (wanSubnet === lanSubnet) {
          subnetConflictDetected = true;
          proposedLanIp = wanSubnet === "192.168.1" ? "192.168.2.1" : "192.168.1.1";

          items.push({
            section: "network",
            key: "lan_ip_conflict",
            status: "adapted",
            title: "Обнаружен конфликт подсети LAN с WAN провайдера",
            description: `WAN IP роутера (${currentWanIp}) находится в одной подсети с импортируемым LAN (${importedLanIp}). Адрес LAN автоматически адаптирован на ${proposedLanIp} для предотвращения потери доступа.`,
            oldValue: importedLanIp,
            newValue: proposedLanIp,
          });
        } else {
          items.push({
            section: "network",
            key: "lan_ip",
            status: "imported",
            title: "Локальный IP-адрес роутера (LAN)",
            description: `Импортирован адрес ${importedLanIp} без конфликтов.`,
            newValue: importedLanIp,
          });
        }
      }

      // WAN Interface Role Mapping
      const importedWan = importedConfig.network.interfaces.find((i) => i.role === "wan");
      if (importedWan) {
        items.push({
          section: "network",
          key: "wan_protocol",
          status: "imported",
          title: "Протокол подключения WAN",
          description: `Импортирован режим WAN: ${importedWan.proto.toUpperCase()}`,
          newValue: importedWan.proto,
        });
      }
    }

    // 3. Wireless Radios Mapping
    if (importedConfig.network?.wireless?.radios) {
      const currentRadioKeys = Object.keys(currentRadios || {});
      const has5g = currentRadioKeys.some((r) => currentRadios[r]?.frequency?.startsWith("5") || currentRadios[r]?.channel > 14);

      for (const importedRadio of importedConfig.network.wireless.radios) {
        if (importedRadio.band === "5ghz" && !has5g && currentRadioKeys.length > 0) {
          items.push({
            section: "wireless",
            key: "5ghz_radio",
            status: "unsupported",
            title: "Радио 5 GHz отсутствует на целевом устройстве",
            description: "Импортируемый профиль содержал настройки сети 5 GHz, но этот роутер поддерживает только 2.4 GHz.",
          });
        } else {
          items.push({
            section: "wireless",
            key: `${importedRadio.band}_ssid`,
            status: "adapted",
            title: `Беспроводная сеть Wi-Fi (${importedRadio.band})`,
            description: `SSID: "${importedRadio.interfaces[0]?.ssid || "OpenWrt"}" будет привязан к локальному радиомодулю.`,
          });
        }
      }
    }

    // 4. Policy Engine Rules
    if (importedConfig.policies?.policies) {
      items.push({
        section: "policies",
        key: "policy_rules_count",
        status: "imported",
        title: "Правила Unified Policy Engine",
        description: `Будет перенесено ${importedConfig.policies.policies.length} правил маршрутизации и ${importedConfig.policies.categories?.length || 0} категорий.`,
      });
    }

    // 5. VPN Outbound Groups & Kill Switch
    if (importedConfig.vpn) {
      items.push({
        section: "vpn",
        key: "vpn_groups",
        status: "imported",
        title: "Группы выхода VPN и Kill Switch",
        description: `Импорт ${importedConfig.vpn.outbound_groups?.length || 0} пулов серверов и настроек защиты LAN.`,
      });
    }

    // 6. Split DNS Settings
    if (importedConfig.dns) {
      items.push({
        section: "dns",
        key: "dns_routing",
        status: "imported",
        title: "Маршрутизация Split DNS (Яндекс + Google DoH)",
        description: "Шифрованный DoH/DoT и отечественные DNS для зоны .RU импортированы.",
      });
    }

    return {
      targetDevice: targetModel,
      sourceDevice,
      items,
      canProceed: true,
      subnetConflictDetected,
      proposedLanIp,
      missingPackages,
    };
  }

  /**
   * Apply hardware adaptation transformations to the imported configuration.
   */
  public static adapt(
    config: PanelConfiguration,
    report: MigrationReport
  ): PanelConfiguration {
    const adapted = JSON.parse(JSON.stringify(config)) as PanelConfiguration;

    // Apply proposed LAN IP if subnet collision was resolved
    if (report.subnetConflictDetected && report.proposedLanIp && adapted.network?.interfaces) {
      const lanIface = adapted.network.interfaces.find((i) => i.role === "lan");
      if (lanIface) {
        lanIface.ipaddr = report.proposedLanIp;
      }
    }

    return adapted;
  }
}
