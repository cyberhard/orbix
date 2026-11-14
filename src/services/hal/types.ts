// Hardware Abstraction Layer (HAL) Types for ORBIX

export type CpuArchitecture = "aarch64" | "arm" | "x86_64" | "mips" | "mipsel" | "riscv64" | "unknown";

export interface HardwareProfile {
  architecture: CpuArchitecture;
  boardName: string;
  model: string;
  cpuModel: string;
  cpuCores: number;
  kernelVersion: string;
  openwrtVersion: string;
  packageManager: "apk" | "opkg";
  ramTotalMb: number;
  ramFreeMb: number;
  storageTotalMb: number;
  storageFreeMb: number;
}

export interface NetworkCapabilities {
  hasWan: boolean;
  hasLan: boolean;
  wanIface: string;
  lanIface: string;
  hasIpv6: boolean;
  vlanSupported: boolean;
  bridgeSupported: boolean;
  hardwareOffloading: boolean;
  firewallBackend: "nftables" | "iptables";
}

export interface WirelessCapabilities {
  supported: boolean;
  radiosCount: number;
  supports24G: boolean;
  supports5G: boolean;
  supports6G: boolean;
  wifi6Supported: boolean; // 802.11ax / HE
  wifi7Supported: boolean; // 802.11be / EHT
  bandSteeringSupported: boolean;
  wpa3Supported: boolean;
}

export interface ServiceCapabilities {
  wireguard: boolean;
  amneziawg: boolean;
  singboxVless: boolean;
  zapretDpi: boolean;
  podkop: boolean;
  pbrRouting: boolean;
  splitDns: boolean;
  luciInstalled: boolean;
}

export interface SystemCapabilities {
  hardware: HardwareProfile;
  network: NetworkCapabilities;
  wireless: WirelessCapabilities;
  services: ServiceCapabilities;
  detectedAt: number;
}
