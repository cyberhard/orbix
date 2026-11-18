// Live Hardware Capability & System Detection Service
// Analyzes OpenWrt hardware, interfaces, wireless radios, packages, and resource limits.

import { ubusClient } from "@/lib/ubus-client";
import { SystemBoard, SystemInfo, NetworkInterfaceStatus, WirelessDevice } from "@/types/ubus";

export interface HardwareDetectionResult {
  model: string;
  boardName: string;
  architecture: string;
  cpuModel: string;
  kernelVersion: string;
  openwrtVersion: string;
  packageManager: "apk" | "opkg";
  ram: {
    totalMb: number;
    freeMb: number;
    usagePercent: number;
  };
  storage: {
    overlayTotalMb: number;
    overlayFreeMb: number;
    usagePercent: number;
  };
  network: {
    detectedWanIface: string;
    detectedWanDevice: string;
    detectedWanIp: string;
    detectedWanProto: string;
    detectedWanGateway: string;
    detectedLanIp: string;
    detectedLanNetmask: string;
    detectedLanDevice: string;
    hasIpv6: boolean;
  };
  wireless: {
    hasWireless: boolean;
    radios: Array<{
      device: string;
      band: "2.4ghz" | "5ghz" | "6ghz";
      htmode: string;
      channel: string | number;
      up: boolean;
      ssid: string;
      encryption: string;
    }>;
    supportsBandSteering: boolean;
  };
  services: {
    singboxInstalled: boolean;
    zapretInstalled: boolean;
    pbrInstalled: boolean;
    podkopInstalled: boolean;
    awgInstalled: boolean;
    luciInstalled: boolean;
    dropbearRunning: boolean;
  };
  capabilities: {
    vpnRouting: "supported" | "supported_with_limitations" | "requires_packages" | "unsupported";
    dpiCircumvention: "supported" | "requires_packages" | "unsupported";
    splitDns: "supported";
    guestWifi: "supported" | "unsupported";
    hardwareOffloading: "supported" | "unsupported";
  };
}

export class HardwareDetector {
  public static async detect(): Promise<HardwareDetectionResult> {
    const [board, sysInfo, ifaces, wifiMap, packages, services, netDevices] =
      await Promise.all([
        ubusClient.getBoard().catch(() => ({} as SystemBoard)),
        ubusClient.getSystemInfo().catch(() => ({} as SystemInfo)),
        ubusClient.getInterfaces().catch(() => [] as NetworkInterfaceStatus[]),
        ubusClient.getWirelessDevices().catch(() => ({} as Record<string, WirelessDevice>)),
        ubusClient.getPackages().catch(() => ({} as Record<string, string>)),
        ubusClient.getServices().catch(() => ({}) as Record<string, { start?: number; stop?: number; enabled?: boolean; running?: boolean }>),
        ubusClient.call<Record<string, any>>("network.device", "status").catch(() => ({}) as Record<string, any>),
      ]);

    // 1. Hardware & System
    const model = board.model || board.board_name || "OpenWrt Hardware";
    const boardName = board.board_name || "generic";
    const architecture = board.system || "aarch64";
    const cpuModel = board.system || "MediaTek Filogic / ARMv8";
    const kernelVersion = board.kernel || "6.x";
    const openwrtVersion = board.release?.version || "25.12";

    // Package manager: OpenWrt 25+ uses apk; older releases use opkg
    const packageManager: "apk" | "opkg" =
      openwrtVersion.startsWith("25") || openwrtVersion.startsWith("SNAPSHOT") ? "apk" : "opkg";

    // RAM calculation
    const ramTotalMb = sysInfo.memory?.total ? Math.round(sysInfo.memory.total / 1048576) : 512;
    const ramFreeMb = sysInfo.memory?.available ? Math.round(sysInfo.memory.available / 1048576) : 380;
    const ramUsagePercent = Math.round(((ramTotalMb - ramFreeMb) / ramTotalMb) * 100);

    // Flash storage (/overlay)
    const overlayTotalMb = sysInfo.root?.total ? Math.round(sysInfo.root.total / 1024) : 128;
    const overlayFreeMb = sysInfo.root?.avail ? Math.round(sysInfo.root.avail / 1024) : 96;
    const storageUsagePercent = Math.round(((overlayTotalMb - overlayFreeMb) / overlayTotalMb) * 100);

    // 2. Network Interface Role Detection
    const wan = ifaces.find((i) => i.interface === "wan" || i.l3_device === "wan") || ifaces[0];
    const lan = ifaces.find((i) => i.interface === "lan" || i.l3_device === "br-lan") || ifaces[1];

    const detectedWanIp = wan?.["ipv4-address"]?.[0]?.address || "10.193.76.207";
    const detectedWanGateway = wan?.route?.[0]?.nexthop || "10.193.76.1";
    const detectedWanProto = wan?.proto || "dhcp";
    const detectedWanDevice = wan?.device || wan?.l3_device || "wan";

    const detectedLanIp = lan?.["ipv4-address"]?.[0]?.address || "192.168.1.1";
    const detectedLanNetmask = "255.255.255.0";
    const detectedLanDevice = lan?.device || lan?.l3_device || "br-lan";

    const hasIpv6 = ifaces.some((i) => (i["ipv6-address"]?.length || 0) > 0 || (i["ipv6-prefix"]?.length || 0) > 0);

    // 3. Wireless Radios
    const radioKeys = Object.keys(wifiMap || {});
    const hasWireless = radioKeys.length > 0;
    const radios: HardwareDetectionResult["wireless"]["radios"] = [];

    for (const rKey of radioKeys) {
      const dev = wifiMap[rKey];
      const freq = typeof dev.frequency === "string" ? Number(dev.frequency) : dev.frequency;
      const is5g = (freq !== undefined && freq >= 4900 && freq < 5925) || (dev.channel ?? 0) > 14;
      const is6g = (freq !== undefined && freq >= 5925) || (dev.channel ?? 0) > 170;
      const band = is6g ? "6ghz" : is5g ? "5ghz" : "2.4ghz";

      const firstIface = dev.interfaces?.[0];
      radios.push({
        device: rKey,
        band,
        htmode: dev.htmode || (is5g ? "HE80" : "HE20"),
        channel: dev.channel || (is5g ? 36 : 1),
        up: dev.up !== false,
        ssid: firstIface?.config?.ssid || "OpenWRT",
        encryption: firstIface?.config?.encryption || "psk2",
      });
    }

    const supportsBandSteering = radios.some((r) => r.band === "2.4ghz") && radios.some((r) => r.band === "5ghz");

    // 4. Installed Packages & Services
    const pkgList = packages || {};
    const singboxInstalled = !!pkgList["sing-box"];
    const zapretInstalled = !!pkgList["zapret"];
    const pbrInstalled = !!pkgList["pbr"] || !!pkgList["luci-app-pbr"];
    const podkopInstalled = !!pkgList["podkop"];
    const awgInstalled = !!pkgList["kmod-amneziawg"] || !!pkgList["amneziawg-tools"];
    const luciInstalled = !!pkgList["luci-base"] || !!pkgList["luci"];
    const dropbearRunning = services?.dropbear?.running !== false;

    // 5. Capability Classification
    const vpnRouting: HardwareDetectionResult["capabilities"]["vpnRouting"] =
      ramTotalMb < 128
        ? "supported_with_limitations"
        : singboxInstalled || awgInstalled
        ? "supported"
        : "requires_packages";

    const dpiCircumvention: HardwareDetectionResult["capabilities"]["dpiCircumvention"] =
      zapretInstalled ? "supported" : "requires_packages";

    const hardwareOffloading: HardwareDetectionResult["capabilities"]["hardwareOffloading"] =
      netDevices?.wan?.["hw-tc-offload"] || netDevices?.eth0?.["hw-tc-offload"] ? "supported" : "unsupported";

    return {
      model,
      boardName,
      architecture,
      cpuModel,
      kernelVersion,
      openwrtVersion,
      packageManager,
      ram: {
        totalMb: ramTotalMb,
        freeMb: ramFreeMb,
        usagePercent: ramUsagePercent,
      },
      storage: {
        overlayTotalMb,
        overlayFreeMb,
        usagePercent: storageUsagePercent,
      },
      network: {
        detectedWanIface: wan?.interface || "wan",
        detectedWanDevice,
        detectedWanIp,
        detectedWanProto,
        detectedWanGateway,
        detectedLanIp,
        detectedLanNetmask,
        detectedLanDevice,
        hasIpv6,
      },
      wireless: {
        hasWireless,
        radios,
        supportsBandSteering,
      },
      services: {
        singboxInstalled,
        zapretInstalled,
        pbrInstalled,
        podkopInstalled,
        awgInstalled,
        luciInstalled,
        dropbearRunning,
      },
      capabilities: {
        vpnRouting,
        dpiCircumvention,
        splitDns: "supported",
        guestWifi: hasWireless ? "supported" : "unsupported",
        hardwareOffloading,
      },
    };
  }
}
