// Configuration Exporter for OpenWrt Modern Panel
// Extracts all managed router settings into portable, versioned JSON.

import {
  CURRENT_SCHEMA_VERSION,
  PANEL_FORMAT_IDENTIFIER,
  PanelExportPackage,
  PanelConfiguration,
  GeneralConfigSection,
  NetworkConfigSection,
  DevicesConfigSection,
  PoliciesConfigSection,
  VpnConfigSection,
  DnsConfigSection,
  ZapretConfigSection,
  FirewallConfigSection,
  ListsConfigSection,
  DiagnosticsConfigSection,
} from "./schema";
import { BackupCrypto } from "./crypto";
import { ubusClient } from "@/lib/ubus-client";
import { usePolicyStore } from "@/store/policy-store";
import { useSubscriptionStore } from "@/store/subscription-store";
import { useDeviceRoutingStore } from "@/store/device-routing-store";
import { useI18nStore } from "@/store/i18n-store";
import { useThemeStore } from "@/store/theme-store";

export interface ExportOptions {
  includeSecrets?: boolean;
  password?: string; // If supplied, outputs encrypted package
  selectedSections?: string[];
  description?: string;
}

export class ConfigExporter {
  public static async export(options: ExportOptions = {}): Promise<PanelExportPackage> {
    const { includeSecrets = false, password, selectedSections, description } = options;

    const sectionsToInclude = selectedSections || [
      "general",
      "network",
      "devices",
      "policies",
      "vpn",
      "dns",
      "zapret",
      "firewall",
      "lists",
      "diagnostics",
    ];

    // 1. Fetch live system board and info
    const [board, sysInfo, sysUci, netUci, dhcpUci, dropbearUci, fwUci] = await Promise.all([
      ubusClient.getBoard().catch(() => null),
      ubusClient.getSystemInfo().catch(() => null),
      ubusClient.getUci<Record<string, any>>("system").catch(() => null),
      ubusClient.getUci<Record<string, any>>("network").catch(() => null),
      ubusClient.getUci<Record<string, any>>("dhcp").catch(() => null),
      ubusClient.getUci<Record<string, any>>("dropbear").catch(() => null),
      ubusClient.getUci<Record<string, any>>("firewall").catch(() => null),
    ]);

    const sourceInfo = {
      panel_version: "1.0.0",
      openwrt_version: board?.release?.version || "25.12",
      architecture: board?.system || "aarch64",
      board_name: board?.board_name || "netcraze,nc-1812",
      model: board?.model || "Netcraze NC-1812",
      hostname: sysUci?.values?.system?.hostname || board?.hostname || "OpenWrt",
    };

    const config: PanelConfiguration = {};

    // 1. General Section
    if (sectionsToInclude.includes("general")) {
      const { lang } = useI18nStore.getState();
      const { theme } = useThemeStore.getState();
      const { operatingMode } = usePolicyStore.getState();

      const generalSec: GeneralConfigSection = {
        hostname: sourceInfo.hostname,
        timezone: sysUci?.values?.system?.timezone || "GMT0",
        zonename: sysUci?.values?.system?.zonename || "UTC",
        ntp_enabled: sysUci?.values?.timeserver?.enabled !== "0",
        ntp_servers: Array.isArray(sysUci?.values?.timeserver?.server)
          ? sysUci.values.timeserver.server
          : ["0.openwrt.pool.ntp.org", "1.openwrt.pool.ntp.org"],
        language: (lang as "ru" | "en") || "ru",
        theme: (theme as "dark" | "light" | "system") || "dark",
        operating_mode: operatingMode,
        wizard_completed: true,
      };
      config.general = generalSec;
    }

    // 2. Network Section
    if (sectionsToInclude.includes("network")) {
      const netSec: NetworkConfigSection = {
        interfaces: [
          {
            role: "wan",
            proto: (netUci?.values?.wan?.proto as any) || "dhcp",
            ipaddr: netUci?.values?.wan?.ipaddr,
            netmask: netUci?.values?.wan?.netmask,
            gateway: netUci?.values?.wan?.gateway,
            dns: netUci?.values?.wan?.dns ? [String(netUci.values.wan.dns)] : ["77.88.8.8", "1.1.1.1"],
          },
          {
            role: "lan",
            proto: "static",
            ipaddr: netUci?.values?.lan?.ipaddr || "192.168.1.1",
            netmask: netUci?.values?.lan?.netmask || "255.255.255.0",
          },
        ],
        dhcp: {
          start: parseInt(dhcpUci?.values?.lan?.start || "100", 10),
          limit: parseInt(dhcpUci?.values?.lan?.limit || "150", 10),
          leasetime: dhcpUci?.values?.lan?.leasetime || "12h",
          local_domain: dhcpUci?.values?.dnsmasq?.domain || "lan",
          authoritative: dhcpUci?.values?.dnsmasq?.authoritative === "1",
          static_leases: [],
        },
      };

      if (dhcpUci?.values) {
        for (const val of Object.values(dhcpUci.values)) {
          if ((val as any)?.[".type"] === "host") {
            netSec.dhcp.static_leases.push({
              name: (val as any).name || "Device",
              mac: (val as any).mac || "",
              ip: (val as any).ip || "",
            });
          }
        }
      }
      config.network = netSec;
    }

    // 3. Devices Section
    if (sectionsToInclude.includes("devices")) {
      const { devices } = useDeviceRoutingStore.getState();
      const { deviceGroups } = usePolicyStore.getState();

      config.devices = {
        devices: devices.map((d) => ({
          mac: d.mac || "",
          ip: d.ip,
          name: d.name,
          assigned_interface: d.interface,
          bypass_vpn: d.interface === "wan",
        })),
        groups: deviceGroups,
      };
    }

    // 4. Policies Section
    if (sectionsToInclude.includes("policies")) {
      const { policies, categories } = usePolicyStore.getState();
      config.policies = {
        policies,
        categories,
      };
    }

    // 5. VPN Section
    if (sectionsToInclude.includes("vpn")) {
      const { url, apiKey, metadata, activeNodeId, nodes, outboundGroups, killSwitch } =
        useSubscriptionStore.getState();

      const vpnSec: VpnConfigSection = {
        subscription: {
          url: includeSecrets ? url : url.replace(/\/[a-f0-9-]{36}$/, "/[REDACTED]"),
          api_key: includeSecrets ? apiKey : undefined,
          metadata,
          active_node_id: activeNodeId,
          nodes: includeSecrets
            ? nodes
            : nodes.map((n) => ({
                ...n,
                uuid: "[REDACTED]",
              })),
        },
        outbound_groups: outboundGroups,
        kill_switch: killSwitch,
      };
      config.vpn = vpnSec;
    }

    // 6. DNS Section
    if (sectionsToInclude.includes("dns")) {
      config.dns = {
        rebind_protection: true,
        dns_leak_protection: true,
        smart_dns_enabled: true,
        smart_dns_upstream: "https://dns.dns-ai.ru/dns-query",
        yandex_dns_servers: ["77.88.8.8", "77.88.8.1"],
        google_doh_url: "https://dns.google/dns-query",
        google_dot_url: "tls://dns.google:853",
        split_dns_domains: [".ru", ".su", ".xn--p1ai", "yandex.ru", "ya.ru", "vk.com", "gosuslugi.ru"],
      };
    }

    // 7. Zapret Section
    if (sectionsToInclude.includes("zapret")) {
      config.zapret = {
        enabled: true,
        mode: "nfqws",
        youtube_strategy: "hostfakesplit",
        discord_strategy: "multisplit",
        general_strategy: "fake",
        nfqueue_tcp: 200,
        nfqueue_udp: 201,
        block_quic: true,
        custom_hostlists: {
          youtube: ["youtube.com", "googlevideo.com", "ytimg.com"],
          discord: ["discord.com", "discord.media", "discord.gg"],
        },
      };
    }

    // 8. Firewall Section
    if (sectionsToInclude.includes("firewall")) {
      const portForwards = [];
      if (fwUci?.values) {
        for (const val of Object.values(fwUci.values)) {
          if ((val as any)?.[".type"] === "redirect") {
            portForwards.push({
              name: (val as any).name || "PortForward",
              src_dport: (val as any).src_dport || "",
              dest_ip: (val as any).dest_ip || "",
              dest_port: (val as any).dest_port || "",
              proto: (val as any).proto || "tcp",
              enabled: (val as any).enabled !== "0",
            });
          }
        }
      }

      config.firewall = {
        syn_flood: true,
        drop_invalid: true,
        port_forwards: portForwards,
        custom_rules: [],
      };
    }

    // 9. Lists & Diagnostics
    if (sectionsToInclude.includes("lists")) {
      const { categories } = usePolicyStore.getState();
      config.lists = {
        categories,
        custom_rulesets: [],
      };
    }

    if (sectionsToInclude.includes("diagnostics")) {
      config.diagnostics = {
        ping_targets: ["ya.ru", "google.com", "1.1.1.1", "77.88.8.8"],
        auto_latency_interval: "30s",
        log_retention_lines: 500,
      };
    }

    const configString = JSON.stringify(config, null, 2);
    const checksum = await BackupCrypto.computeSha256(configString);

    const basePackage: PanelExportPackage = {
      format: PANEL_FORMAT_IDENTIFIER,
      schema_version: CURRENT_SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
      export_type: sectionsToInclude.length === 10 ? "full" : "selective",
      is_encrypted: false,
      source: sourceInfo,
      metadata: {
        description: description || "OpenWrt Modern Panel Full System Backup",
        checksum_sha256: checksum,
        included_sections: sectionsToInclude,
        excluded_sections: [
          "general",
          "network",
          "devices",
          "policies",
          "vpn",
          "dns",
          "zapret",
          "firewall",
          "lists",
          "diagnostics",
        ].filter((s) => !sectionsToInclude.includes(s)),
        secrets_included: includeSecrets,
      },
      configuration: config,
    };

    // If password provided, encrypt payload
    if (password) {
      const { ciphertext, cryptoMetadata } = await BackupCrypto.encrypt(configString, password);
      return {
        ...basePackage,
        is_encrypted: true,
        crypto_metadata: cryptoMetadata,
        ciphertext,
        configuration: undefined, // remove plaintext configuration
      };
    }

    return basePackage;
  }
}
