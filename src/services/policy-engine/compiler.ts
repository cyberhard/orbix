// Deterministic Policy Compiler for OpenWrt
import {
  NetworkPolicy,
  DomainCategory,
  DeviceGroup,
  CompiledSystemConfig,
} from "./types";
import { DEFAULT_DOMAIN_CATEGORIES } from "./categories";

export class PolicyCompiler {
  private categories: Map<string, DomainCategory> = new Map();
  private deviceGroups: Map<string, DeviceGroup> = new Map();

  constructor(
    categories: DomainCategory[] = DEFAULT_DOMAIN_CATEGORIES,
    deviceGroups: DeviceGroup[] = []
  ) {
    categories.forEach((c) => this.categories.set(c.id, c));
    deviceGroups.forEach((g) => this.deviceGroups.set(g.id, g));
  }

  public setCategories(cats: DomainCategory[]) {
    this.categories.clear();
    cats.forEach((c) => this.categories.set(c.id, c));
  }

  public setDeviceGroups(groups: DeviceGroup[]) {
    this.deviceGroups.clear();
    groups.forEach((g) => this.deviceGroups.set(g.id, g));
  }

  /**
   * Resolves category references (e.g. "category:youtube") into an array of concrete domain strings
   */
  public resolveDomains(destValues: string[]): string[] {
    const domains = new Set<string>();

    for (const val of destValues) {
      if (val.startsWith("category:")) {
        const catId = val.replace("category:", "");
        const cat = this.categories.get(catId);
        if (cat) {
          cat.domains.forEach((d) => domains.add(d.toLowerCase()));
        }
      } else if (val.startsWith("domain:")) {
        domains.add(val.replace("domain:", "").toLowerCase());
      } else if (!val.includes("/") && !val.includes(":")) {
        domains.add(val.toLowerCase());
      }
    }

    return Array.from(domains);
  }

  /**
   * Resolves source specifications (e.g. "group:smartphones") into concrete IPv4 addresses or subnets
   */
  public resolveSourceAddresses(sourceValues: string[]): string[] {
    const addrs = new Set<string>();

    for (const val of sourceValues) {
      if (val.startsWith("group:")) {
        const groupId = val.replace("group:", "");
        const group = this.deviceGroups.get(groupId);
        if (group) {
          group.deviceIps.forEach((ip) => addrs.add(ip));
        }
      } else if (val.startsWith("device:") || val.startsWith("ip:")) {
        addrs.add(val.replace(/^(device|ip):/, ""));
      } else {
        addrs.add(val);
      }
    }

    return Array.from(addrs);
  }

  /**
   * Compiles the high-level user policies into concrete backend configurations
   */
  public compile(policies: NetworkPolicy[]): CompiledSystemConfig {
    // 1. Sort active policies strictly by priority (lower number = evaluated first)
    const activePolicies = policies
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    const compiled: CompiledSystemConfig = {
      pbrPolicies: [],
      singboxRules: [
        { action: "sniff" },
        { ip_is_private: true, outbound: "direct" } as any,
      ],
      zapretHostlists: {
        google: [],
        general: [],
        exclude: [],
      },
      dnsmasqEntries: [],
      firewallRules: [],
    };

    const zapretGoogleSet = new Set<string>();
    const zapretGeneralSet = new Set<string>();
    const zapretExcludeSet = new Set<string>();
    const singboxDirectSet = new Set<string>();
    const singboxProxySet = new Set<string>();
    const singboxBlockSet = new Set<string>();
    const claimedDomains = new Set<string>();

    for (const policy of activePolicies) {
      const domains = this.resolveDomains(policy.destination.values);
      const sourceAddrs = this.resolveSourceAddresses(policy.source.values);

      // A. Per-Device PBR Policies
      if (policy.source.type === "device" || policy.source.type === "group" || sourceAddrs.length > 0) {
        for (const src of sourceAddrs) {
          let iface = "wan";
          if (policy.action.type === "vpn_tunnel" || policy.action.type === "vpn_group") {
            iface = policy.action.target || "singbox";
          } else if (policy.action.type === "zapret_dpi") {
            iface = "wan"; // Zapret operates directly on WAN
          } else if (policy.action.type === "block") {
            iface = "ignore";
          }

          compiled.pbrPolicies.push({
            name: `${policy.name} (${src})`,
            src_addr: src,
            dest_addr: domains.length > 0 ? domains.slice(0, 15).join(" ") : undefined,
            interface: iface,
            proto: policy.condition?.protocols ? policy.condition.protocols.join(" ") : "all",
            enabled: true,
          });
        }
      }

      // B. Action compilation for destinations with strict priority claiming
      for (const d of domains) {
        if (claimedDomains.has(d)) continue; // Higher priority policy already claimed this domain
        claimedDomains.add(d);

        switch (policy.action.type) {
          case "block":
            singboxBlockSet.add(d);
            break;

          case "vpn_tunnel":
          case "vpn_group":
            singboxProxySet.add(d);
            break;

          case "direct_wan":
            singboxDirectSet.add(d);
            break;

          case "zapret_dpi":
            singboxDirectSet.add(d);
            if (policy.action.target?.includes("hostfakesplit") || policy.id.includes("youtube")) {
              zapretGoogleSet.add(d);
            } else {
              zapretGeneralSet.add(d);
            }
            break;

          case "default":
            break;
        }
      }
    }

    // Assemble Sing-box Route Rules
    if (singboxBlockSet.size > 0) {
      compiled.singboxRules.push({
        domain_suffix: Array.from(singboxBlockSet),
        action: "reject",
      } as any);
    }

    if (singboxProxySet.size > 0) {
      compiled.singboxRules.push({
        domain_suffix: Array.from(singboxProxySet),
        outbound: "proxy",
      });
    }

    if (singboxDirectSet.size > 0) {
      compiled.singboxRules.push({
        domain_suffix: Array.from(singboxDirectSet),
        outbound: "direct",
      });
    }

    compiled.zapretHostlists.google = Array.from(zapretGoogleSet);
    compiled.zapretHostlists.general = Array.from(zapretGeneralSet);
    compiled.zapretHostlists.exclude = Array.from(zapretExcludeSet);

    compiled.blockedDomains = Array.from(singboxBlockSet);
    compiled.directDomains = Array.from(singboxDirectSet);
    compiled.proxyDomains = Array.from(singboxProxySet);

    // Split DNS configuration: Russian domains to Yandex (77.88.8.8), rest to Google DoH/DoT (127.0.0.1#5353)
    const ruCategory = this.categories.get("russia");
    const ruDomains = ruCategory ? ruCategory.domains : [".ru", ".su", ".xn--p1ai", "yandex.ru", "gosuslugi.ru", "sberbank.ru"];
    compiled.dnsmasqEntries = [
      "server=127.0.0.1#5353", // Secure Google DoH (https://dns.google/dns-query) & DoT (tls://dns.google:853)
      ...ruDomains.slice(0, 35).map((d) => `server=/${d.startsWith(".") ? d.slice(1) : d}/77.88.8.8`),
    ];

    return compiled;
  }
}

export const policyCompiler = new PolicyCompiler();
