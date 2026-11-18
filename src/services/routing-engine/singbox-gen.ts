// sing-box config generator for the orbix tier engine (single source of
// truth for the TUN policy stack: final=proxy, RU direct, zapret-direct,
// node-IP loop guard, split DNS with proxy-only remote resolver).
import { normalizeDomain, type NodeSpec, type TierConfig } from "./types";
import { SET_PROXYX, SET_TIER1, SET_TIER2, SET_NODEIP } from "./nft-gen";

export const TUN_IN = "tun-in";
export const MIXED_IN = "mixed-in";
export const DNS_IN = "dns-in";
export const OUT_PROXY = "proxy";
export const OUT_DIRECT = "direct";
export const SRU = "ru-dns";
export const SREM = "remote-dns";
export const RS_ANTIZAPRET = "antizapret";

function hostOf(server: string): string {
  const s = String(server || "").trim().replace(/^\[|\]$/g, "");
  return /^\d+\.\d+\.\d+\.\d+$/.test(s) ? s : "";
}

export function nodeOutbound(n: NodeSpec): Record<string, unknown> {
  const base: Record<string, unknown> = {
    type: n.protocol === "ss" ? "shadowsocks" : n.protocol,
    tag: OUT_PROXY,
    server: n.server,
    server_port: n.port,
  };
  const tls: Record<string, unknown> = {};
  switch (n.protocol) {
    case "vless":
      base.uuid = n.uuid || "";
      if (n.flow) base.flow = n.flow;
      tls.enabled = true;
      tls.server_name = n.sni || "";
      tls.utls = { enabled: true, fingerprint: n.fp || "firefox" };
      tls.reality = {
        enabled: n.security === "reality" && !!n.pbk,
        public_key: n.pbk || "",
        short_id: n.sid || "",
      };
      if (n.insecure) tls.insecure = true;
      break;
    case "trojan":
      base.password = n.password || "";
      tls.enabled = true;
      tls.server_name = n.sni || "";
      if (n.insecure) tls.insecure = true;
      if (n.fp) tls.utls = { enabled: true, fingerprint: n.fp };
      break;
    case "ss":
      base.method = n.method || "aes-256-gcm";
      base.password = n.password || "";
      break;
    case "hysteria2":
      base.password = n.password || "";
      tls.enabled = true;
      tls.server_name = n.sni || "";
      if (n.insecure) tls.insecure = true;
      break;
    case "vmess":
      base.uuid = n.uuid || "";
      base.security = "auto";
      if (n.sni || n.security !== "none") {
        tls.enabled = n.security === "tls";
        tls.server_name = n.sni || "";
      }
      break;
  }
  if (Object.keys(tls).length) base.tls = tls;
  return base;
}

export interface SingboxGenInput {
  cfg: TierConfig;
  node: NodeSpec;
  /** all known node server IPs (loop guard, incl. standby nodes) */
  nodeServers: string[];
  staticProxyCidrs?: string[];
  /** set true when /etc/sing-box/antizapret.srs exists on the router */
  withAntizapret?: boolean;
}

export function genSingboxConfig({ cfg, node, nodeServers, staticProxyCidrs = [], withAntizapret = true }: SingboxGenInput): Record<string, unknown> {
  const t1 = [...new Set(cfg.tier1.domains.map(normalizeDomain).filter(Boolean))].sort();
  const t2 = [...new Set(cfg.tier2.domains.map(normalizeDomain).filter(Boolean))].sort();
  const t3 = [...new Set(cfg.tier3ExtraDomains.map(normalizeDomain).filter(Boolean))].sort();
  const blocked = [...new Set(cfg.blockedDomains.map(normalizeDomain).filter(Boolean))].sort();
  const nodeIps = [...new Set(nodeServers.map(hostOf).filter(Boolean))].sort();
  const proxyCidrs = [...new Set([...staticProxyCidrs, ...nodeIps.map((ip) => ip)].map((c) => c.trim()).filter(Boolean))].sort();

  const rules: Record<string, unknown>[] = [
    { inbound: DNS_IN, action: "hijack-dns" },
    { inbound: MIXED_IN, outbound: cfg.proxyEnabled ? OUT_PROXY : OUT_DIRECT },
    { action: "sniff" },
    // loop guard: node endpoints never tunnel, whatever else matches
    ...(nodeIps.length ? [{ ip_cidr: nodeIps, outbound: OUT_DIRECT }] : []),
    { ip_is_private: true, outbound: OUT_DIRECT },
    // L1 Direct: RU zone out of the tunnel entirely
    {
      domain_suffix: ["ru", "xn--p1ai", "su", ...t1],
      outbound: OUT_DIRECT,
    },
    { ip_cidr: cfg.tier1.networks, outbound: OUT_DIRECT },
  ];
  if (withAntizapret) {
    rules.push({ rule_set: [RS_ANTIZAPRET], outbound: OUT_PROXY });
  }
  if (blocked.length) rules.push({ domain_suffix: blocked, action: "reject" });
  if (t3.length) rules.push({ domain_suffix: t3, outbound: OUT_PROXY });
  if (proxyCidrs.filter((c) => c.includes("/") || !nodeIps.includes(c)).length) {
    rules.push({ ip_cidr: proxyCidrs.filter((c) => !nodeIps.includes(c)), outbound: OUT_PROXY });
  }
  // L2 Zapret: normally never reaches the TUN (nft returns them); if a stale
  // set entry sneaks in, keep it DIRECT — zapret, not VPN.
  if (t2.length) rules.push({ domain_suffix: t2, outbound: OUT_DIRECT });
  const t2Net = [...new Set((cfg.tier2.networks || []).filter(Boolean))];
  if (t2Net.length) rules.push({ ip_cidr: t2Net, outbound: OUT_DIRECT });
  rules.push({ protocol: ["dns"], outbound: cfg.proxyEnabled ? OUT_PROXY : OUT_DIRECT });

  const dnsServers: Record<string, unknown>[] = [
    ...cfg.dns.ruServers.map((ip, i) => ({
      tag: i === 0 ? SRU : `${SRU}-${i + 1}`,
      address: ip,
      detour: OUT_DIRECT,
    })),
    { tag: SREM, address: cfg.dns.remoteDoH, strategy: "ipv4_only", detour: OUT_PROXY },
  ];
  const dnsRules: Record<string, unknown>[] = [
    { action: "route", server: SREM, domain_suffix: t3, rule_set: withAntizapret ? [RS_ANTIZAPRET] : undefined },
    { action: "route", server: SRU, domain_suffix: ["ru", "xn--p1ai", "su", ...t1] },
  ].map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)));

  const config: Record<string, unknown> = {
    log: { level: "info" },
    inbounds: [
      {
        type: "tun",
        tag: TUN_IN,
        interface_name: cfg.tunIf,
        address: [`${cfg.tunAddr}/${cfg.tunPrefix}`],
        auto_route: false,
        strict_route: false,
        stack: "gvisor",
        // DNS hijack for LAN clients whose queries reach the TUN
        // (router DNAT normally keeps them on dnsmasq)
      },
      { type: "mixed", tag: MIXED_IN, listen: "127.0.0.1", listen_port: 10808 },
      { type: "direct", tag: DNS_IN, listen: "127.0.0.1", listen_port: 5353 },
    ],
    outbounds: [nodeOutbound(node), { type: "direct", tag: OUT_DIRECT }],
    route: {
      auto_detect_interface: true,
      rule_set: withAntizapret
        ? [{ tag: RS_ANTIZAPRET, type: "local", format: "binary", path: "/etc/sing-box/antizapret.srs" }]
        : [],
      rules,
      final: cfg.proxyEnabled ? OUT_PROXY : OUT_DIRECT,
      default_domain_resolver: SRU,
    },
    dns: {
      servers: dnsServers,
      rules: dnsRules,
      final: SRU,
    },
  };
  if (!withAntizapret) delete (config.route as Record<string, unknown>).rule_set;
  return config;
}

/** Which nft set each sing-box decision relies on — kept in docs/tests. */
export const TIER_SET_MAP = {
  tier1Direct: `inet#paneltiers#${SET_TIER1}`,
  tier2Zapret: `inet#paneltiers#${SET_TIER2}`,
  forcedProxy: `inet#paneltiers#${SET_PROXYX}`,
  nodeLoopGuard: `inet#paneltiers#${SET_NODEIP}`,
} as const;
