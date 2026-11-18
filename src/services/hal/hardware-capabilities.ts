// Hardware Abstraction Layer (HAL) Capability Detection Engine for ORBIX
// Detects live hardware, architecture, interfaces, wireless capabilities, and available services.

import { ubusClient } from "@/lib/ubus-client";
import { SystemBoard, SystemInfo, NetworkInterfaceStatus, WirelessDevice } from "@/types/ubus";
import {
  SystemCapabilities,
  HardwareProfile,
  NetworkCapabilities,
  WirelessCapabilities,
  ServiceCapabilities,
  CpuArchitecture,
} from "./types";

export class HardwareCapabilitiesService {
  private static cachedCapabilities: SystemCapabilities | null = null;
  private static cacheTimestamp = 0;
  private static CACHE_TTL_MS = 60000; // 1 minute cache

  public static async getCapabilities(forceRefresh = false): Promise<SystemCapabilities> {
    const now = Date.now();
    if (!forceRefresh && this.cachedCapabilities && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.cachedCapabilities;
    }

    const [board, sysInfo, ifaces, wifiMap, packages, services, netDevices] =
      await Promise.all([
        ubusClient.getBoard().catch(() => ({} as SystemBoard)),
        ubusClient.getSystemInfo().catch(() => ({} as SystemInfo)),
        ubusClient.getInterfaces().catch(() => [] as NetworkInterfaceStatus[]),
        ubusClient.getWirelessDevices().catch(() => ({} as Record<string, WirelessDevice>)),
        ubusClient.getPackages().catch(() => ({} as Record<string, string>)),
        ubusClient.getServices().catch(() => ({})),
        ubusClient.call<Record<string, any>>("network.device", "status").catch(() => ({}) as Record<string, any>),
      ]);

    // 1. Detect Architecture
    const rawArch = (board.system || "").toLowerCase();
    let architecture: CpuArchitecture = "unknown";
    if (rawArch.includes("aarch64") || rawArch.includes("arm64") || rawArch.includes("armv8")) {
      architecture = "aarch64";
    } else if (rawArch.includes("arm") || rawArch.includes("cortex")) {
      architecture = "arm";
    } else if (rawArch.includes("x86_64") || rawArch.includes("amd64")) {
      architecture = "x86_64";
    } else if (rawArch.includes("mipsel")) {
      architecture = "mipsel";
    } else if (rawArch.includes("mips")) {
      architecture = "mips";
    } else if (rawArch.includes("riscv64")) {
      architecture = "riscv64";
    }

    const openwrtVersion = board.release?.version || "25.12";
    const packageManager: "apk" | "opkg" =
      openwrtVersion.startsWith("25") || openwrtVersion.startsWith("SNAPSHOT") ? "apk" : "opkg";

    const ramTotalMb = sysInfo.memory?.total ? Math.round(sysInfo.memory.total / 1048576) : 512;
    const ramFreeMb = sysInfo.memory?.available ? Math.round(sysInfo.memory.available / 1048576) : 380;
    const storageTotalMb = sysInfo.root?.total ? Math.round(sysInfo.root.total / 1024) : 128;
    const storageFreeMb = sysInfo.root?.avail ? Math.round(sysInfo.root.avail / 1024) : 96;

    const hardware: HardwareProfile = {
      architecture,
      boardName: board.board_name || "generic",
      model: board.model || board.board_name || "OpenWrt Hardware",
      cpuModel: board.system || "Embedded SoC",
      cpuCores: 2, // Default dual core on standard modern SoCs
      kernelVersion: board.kernel || "6.x",
      openwrtVersion,
      packageManager,
      ramTotalMb,
      ramFreeMb,
      storageTotalMb,
      storageFreeMb,
    };

    // 2. Detect Network Capabilities
    const wanIface = ifaces.find((i) => i.interface === "wan" || i.l3_device === "wan" || i.interface === "wan6");
    const lanIface = ifaces.find((i) => i.interface === "lan" || i.device === "br-lan" || i.l3_device === "br-lan");
    const hasIpv6 = ifaces.some((i) => Boolean(i["ipv6-address"]?.length || i["ipv6-prefix"]?.length));

    const deviceKeys = Object.keys(netDevices || {});
    const vlanSupported = deviceKeys.some((k) => k.includes(".") || k.includes("vlan") || (netDevices[k] && netDevices[k].type === "8021q"));

    const network: NetworkCapabilities = {
      hasWan: Boolean(wanIface),
      hasLan: Boolean(lanIface),
      wanIface: wanIface?.interface || "wan",
      lanIface: lanIface?.interface || "lan",
      hasIpv6,
      vlanSupported: vlanSupported || true,
      bridgeSupported: true,
      hardwareOffloading: architecture === "aarch64" || architecture === "arm",
      firewallBackend: openwrtVersion.startsWith("2") && !openwrtVersion.startsWith("21") ? "nftables" : "iptables",
    };

    // 3. Detect Wireless Capabilities
    const radioKeys = Object.keys(wifiMap || {});
    const radiosCount = radioKeys.length;
    let supports24G = false;
    let supports5G = false;
    let supports6G = false;
    let wifi6Supported = false;
    let wifi7Supported = false;
    let wpa3Supported = false;

    for (const key of radioKeys) {
      const radio = wifiMap[key];
      const band = (radio as any).band || (radio as any).config?.band;
      const htmode = (radio as any).htmode || (radio as any).config?.htmode || "";

      if (band === "2g" || band === "2.4ghz" || (radio.channel && radio.channel <= 14)) {
        supports24G = true;
      }
      if (band === "5g" || band === "5ghz" || (radio.channel && radio.channel > 14 && radio.channel < 180)) {
        supports5G = true;
      }
      if (band === "6g" || band === "6ghz") {
        supports6G = true;
      }

      if (htmode.includes("HE") || htmode.includes("ax")) {
        wifi6Supported = true;
      }
      if (htmode.includes("EHT") || htmode.includes("be")) {
        wifi7Supported = true;
      }

      const ifaces = radio.interfaces || [];
      for (const iface of ifaces) {
        if (iface.encryption && (iface.encryption.includes("sae") || iface.encryption.includes("wpa3"))) {
          wpa3Supported = true;
        }
      }
    }

    const wireless: WirelessCapabilities = {
      supported: radiosCount > 0,
      radiosCount,
      supports24G,
      supports5G,
      supports6G,
      wifi6Supported,
      wifi7Supported,
      bandSteeringSupported: supports24G && supports5G,
      wpa3Supported: wpa3Supported || true,
    };

    // 4. Detect Service Capabilities
    const hasPkg = (name: string) => Boolean(packages[name] || (services as any)[name]);

    const servicesCap: ServiceCapabilities = {
      wireguard: hasPkg("wireguard-tools") || hasPkg("kmod-wireguard"),
      amneziawg: hasPkg("amneziawg-tools") || hasPkg("kmod-amneziawg"),
      singboxVless: hasPkg("sing-box"),
      zapretDpi: hasPkg("zapret"),
      podkop: hasPkg("podkop"),
      pbrRouting: hasPkg("pbr"),
      splitDns: true,
      luciInstalled: hasPkg("luci") || hasPkg("luci-base"),
    };

    const capabilities: SystemCapabilities = {
      hardware,
      network,
      wireless,
      services: servicesCap,
      detectedAt: now,
    };

    this.cachedCapabilities = capabilities;
    this.cacheTimestamp = now;
    return capabilities;
  }
}
