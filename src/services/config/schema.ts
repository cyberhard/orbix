// Unified Portable JSON Configuration Schema for OpenWrt Modern Panel
// Schema Version: 1

import { NetworkPolicy, DomainCategory, DeviceGroup } from "@/services/policy-engine/types";
import { VlessNode, SubscriptionMetadata, VpnOutboundGroup, KillSwitchConfig, AmneziaWgConfig } from "@/types/ubus";

export const CURRENT_SCHEMA_VERSION = 1;
export const PANEL_FORMAT_IDENTIFIER = "openwrt-modern-panel";

export interface CryptoMetadata {
  algorithm: "AES-GCM";
  kdf: "PBKDF2";
  iterations: number;
  salt: string; // hex encoded
  iv: string;   // hex encoded
}

export interface PackageSourceInfo {
  panel_version: string;
  openwrt_version: string;
  architecture: string;
  board_name: string;
  model: string;
  hostname: string;
}

export interface PackageMetadata {
  description: string;
  author?: string;
  checksum_sha256: string;
  included_sections: string[];
  excluded_sections: string[];
  secrets_included: boolean;
}

// 1. General Settings
export interface GeneralConfigSection {
  hostname: string;
  timezone: string;
  zonename: string;
  ntp_enabled: boolean;
  ntp_servers: string[];
  language: "ru" | "en";
  theme: "dark" | "light" | "system";
  operating_mode: "simple" | "expert";
  wizard_completed: boolean;
}

// 2. Network Settings (Hardware Independent Semantic Roles)
export interface NetworkInterfaceConfig {
  role: "wan" | "lan" | "guest" | "custom";
  proto: "dhcp" | "static" | "pppoe" | "none";
  ipaddr?: string;
  netmask?: string;
  gateway?: string;
  dns?: string[];
  pppoe_username?: string;
  pppoe_password?: string; // sensitive
  vlan_id?: number;
  mtu?: number;
}

export interface StaticDhcpLease {
  name: string;
  mac: string;
  ip: string;
}

export interface WirelessRadioConfig {
  band: "2.4ghz" | "5ghz" | "6ghz";
  channel?: string | number;
  htmode?: string;
  disabled: boolean;
  interfaces: Array<{
    ssid: string;
    encryption: string;
    key?: string; // sensitive
    network: string;
    isolate?: boolean;
    hidden?: boolean;
  }>;
}

export interface NetworkConfigSection {
  interfaces: NetworkInterfaceConfig[];
  dhcp: {
    start: number;
    limit: number;
    leasetime: string;
    local_domain: string;
    authoritative: boolean;
    static_leases: StaticDhcpLease[];
  };
  wireless?: {
    band_steering: boolean;
    radios: WirelessRadioConfig[];
  };
}

// 3. Devices Section
export interface DeviceRecordConfig {
  mac: string;
  ip?: string;
  name: string;
  group_id?: string;
  custom_icon?: string;
  assigned_interface?: string;
  bypass_vpn?: boolean;
}

export interface DevicesConfigSection {
  devices: DeviceRecordConfig[];
  groups: DeviceGroup[];
}

// 4. Policies Section
export interface PoliciesConfigSection {
  policies: NetworkPolicy[];
  categories: DomainCategory[];
}

// 5. VPN Section
export interface VpnConfigSection {
  subscription?: {
    url: string;
    api_key?: string; // sensitive
    metadata: SubscriptionMetadata;
    active_node_id: string;
    nodes: VlessNode[];
  };
  outbound_groups: VpnOutboundGroup[];
  kill_switch: KillSwitchConfig;
  amnezia_wg?: {
    enabled: boolean;
    interface_name: string;
    address: string;
    private_key?: string; // sensitive
    listen_port?: number;
    obfuscation: {
      jc: number;
      jmin: number;
      jmax: number;
      s1: number;
      s2: number;
      h1: number;
      h2: number;
      h3: number;
      h4: number;
    };
    peers: Array<{
      public_key: string;
      endpoint: string;
      allowed_ips: string[];
      preshared_key?: string; // sensitive
    }>;
  };
}

// 6. DNS Section
export interface DnsConfigSection {
  rebind_protection: boolean;
  dns_leak_protection: boolean;
  smart_dns_enabled: boolean;
  smart_dns_upstream: string;
  yandex_dns_servers: string[];
  google_doh_url: string;
  google_dot_url: string;
  split_dns_domains: string[];
}

// 7. Zapret Section
export interface ZapretConfigSection {
  enabled: boolean;
  mode: string;
  youtube_strategy: string;
  discord_strategy: string;
  general_strategy: string;
  nfqueue_tcp: number;
  nfqueue_udp: number;
  block_quic: boolean;
  custom_hostlists: Record<string, string[]>;
}

// 8. Firewall Section
export interface PortForwardConfig {
  name: string;
  src_dport: string;
  dest_ip: string;
  dest_port: string;
  proto: string;
  enabled: boolean;
}

export interface CustomFirewallRule {
  name: string;
  src: string;
  dest?: string;
  dest_port?: string;
  target: "ACCEPT" | "DROP" | "REJECT";
  proto?: string;
  enabled: boolean;
}

export interface FirewallConfigSection {
  syn_flood: boolean;
  drop_invalid: boolean;
  port_forwards: PortForwardConfig[];
  custom_rules: CustomFirewallRule[];
}

// 9. Lists Section
export interface ListsConfigSection {
  categories: DomainCategory[];
  custom_rulesets: Array<{
    id: string;
    name: string;
    domains: string[];
    ips: string[];
  }>;
}

// 10. Diagnostics Section
export interface DiagnosticsConfigSection {
  ping_targets: string[];
  auto_latency_interval: string;
  log_retention_lines: number;
}

// Main Configuration Container
export interface PanelConfiguration {
  general?: GeneralConfigSection;
  network?: NetworkConfigSection;
  devices?: DevicesConfigSection;
  policies?: PoliciesConfigSection;
  vpn?: VpnConfigSection;
  dns?: DnsConfigSection;
  zapret?: ZapretConfigSection;
  firewall?: FirewallConfigSection;
  lists?: ListsConfigSection;
  diagnostics?: DiagnosticsConfigSection;
}

// Complete Export Package
export interface PanelExportPackage {
  format: typeof PANEL_FORMAT_IDENTIFIER;
  schema_version: number;
  exported_at: string;
  export_type: "full" | "selective";
  is_encrypted: boolean;
  crypto_metadata?: CryptoMetadata;
  ciphertext?: string; // base64 encoded when is_encrypted is true
  source: PackageSourceInfo;
  metadata: PackageMetadata;
  configuration?: PanelConfiguration; // present when unencrypted
}
