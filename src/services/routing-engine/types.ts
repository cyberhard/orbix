// Unified traffic-routing engine for orbix (architecture studied in
// ordo-systems/keen-proxy: fwmark + policy route table + domain groups,
// re-expressed for fw4/nftables + iproute2 + sing-box).
//
// Three tiers, evaluated top to bottom:
//   L1 Direct  — RU zone (.ru/.рф/.su, geoip:ru peers, banks, gosuslugi):
//                straight out WAN, never Zapret queues, never sing-box.
//   L2 Zapret  — DPI-throttled but RU-IP-friendly services (YouTube, Discord,
//                user list): leave via WAN but through nfqws NFQUEUE
//                (zapret's own rules), excluded from the VPN mark.
//   L3 Proxy   — everything else (geo-blocked-from-RU included): fwmark ->
//                policy table -> sing-box TUN -> subscription node.
//
// Loop-freedom invariants (enforced by validate.ts + tests):
//   - node server IPs are RETURNED before the catch-all mark,
//   - the mark chain only touches `iifname <lan>` traffic,
//   - sing-box's own TUN subnet is never marked,
//   - the mark table's default points at the TUN device only;
//     main/default route for the router itself is untouched.
export interface NodeSpec {
  id: string;
  name: string;
  protocol: "vless" | "trojan" | "ss" | "hysteria2" | "vmess";
  server: string;
  port: number;
  uuid?: string;
  password?: string;
  method?: string;
  flow?: string;
  security?: "reality" | "tls" | "none";
  sni?: string;
  pbk?: string;
  sid?: string;
  fp?: string;
  insecure?: boolean;
  transport?: string;
  path?: string;
}

export interface TierDns {
  /** RU resolvers used for tier1/tier2 and as the panel's default */
  ruServers: string[];
  /** DoH URL resolved *through the proxy* for tier3 domains */
  remoteDoH: string;
}

export interface TierConfig {
  version: number;
  lanIf: string;
  tunIf: string;
  /** TUN point-to-point address of sing-box, e.g. 172.19.0.1 */
  tunAddr: string;
  tunPrefix: number;
  /** full fwmark value, e.g. 0x00330000 */
  mark: string;
  /** mark/mask used by ip rule, e.g. 0x330000/0xff0000 */
  markMask: string;
  routeTable: number;
  rulePriority: number;
  /** true when tier3 (VPN) is active at all */
  proxyEnabled: boolean;
  tier1: {
    /** additional exact/suffix domains beyond the RU TLD rules */
    domains: string[];
    /** RU provider CIDRs (Yandex/VK/Mail/Tele2/banks backbones) */
    networks: string[];
  };
  tier2: {
    /** domains whose resolved IPs bypass the proxy mark (zapret handles them) */
    domains: string[];
    /** static CIDRs bypassing the proxy mark (e.g. pinned Meta CDN edges) */
    networks?: string[];
  };
  /** domains forced into proxy even if matched by lower tiers */
  tier3ExtraDomains: string[];
  /** blocked everywhere (reject) */
  blockedDomains: string[];
  dns: TierDns;
}

export const DEFAULT_TIER_DNS: TierDns = {
  ruServers: ["77.88.8.8", "213.180.204.1"],
  remoteDoH: "https://dns.google/dns-query",
};

/** Default tier2 set — must stay consistent with zapret hostlists. */
/** Pinned Meta/Instagram edges that must stay direct-with-zapret
 *  (selective RU blocking drops many other Meta ranges; these are alive). */
export const DEFAULT_TIER2_NETWORKS = [
  "31.13.72.32/27",
  "31.13.78.32/27",
  "31.13.80.32/27",
  "157.240.205.0/24",
];

export const DEFAULT_TIER2_DOMAINS = [
  "youtube.com",
  "googlevideo.com",
  "youtu.be",
  "ytimg.com",
];

/**
 * L3 force-proxy domains. Discord is measured (2026-11, RZD-class line) to be
 * cut by DPI under every tested nfqws strategy (fake ttl 3/4/5, retries,
 * syn-repeat) while it works fine through the subscription VPN, so it follows
 * the same rule as Telegram DCs: VPN-only, never direct.
 */
export const DEFAULT_FORCED_PROXY_DOMAINS = [
  "discord.com",
  "discord.gg",
  "discord.media",
  "discordapp.com",
  "discordapp.net",
  "gateway.discord.gg",
  "cdn.discordapp.com",
];

/**
 * Curated category-ru (banks/gov/state media) used where the `.ru/.рф/.su`
 * TLD rules are not enough (services on foreign TLDs that must stay direct).
 */
export const DEFAULT_RU_DOMAINS = [
  "sberbank.ru",
  "tinkoff.ru",
  "t-bank.ru",
  "vtb.ru",
  "gazprombank.ru",
  "alfabank.ru",
  "mos.ru",
  "gosuslugi.ru",
  "nalog.ru",
  "mvd.ru",
  "mchs.gov.ru",
  "vk.com",
  "vk.ru",
  "ok.ru",
  "dzen.ru",
  "yandex.ru",
  "yandex.net",
  "mail.ru",
  "ozon.ru",
  "wildberries.ru",
  "kinopoisk.ru",
  "ivi.ru",
  "mvideo.ru",
  "citilink.ru",
  "tsum.ru",
  "lenta.com",
  "tbank.ru",
  "rzd.ru",
  "pochta.ru",
];

/** RU backbone CIDRs (geoip:ru stand-in; extendable via UI/uci). */
export const DEFAULT_RU_NETWORKS = [
  "5.255.255.0/24", // yandex
  "77.88.44.0/24", // yandex
  "213.180.192.0/19", // yandex
  "87.250.240.0/20", // vk
  "95.163.16.0/20", // vk/mail
  "95.213.0.0/16", // vk
  "185.129.100.0/22", // vk
  "149.3.64.0/21", // mail
  "217.69.136.0/21", // mail
  "176.32.255.0/24", // rzd/wcs
  "31.130.128.0/21", // mts
  "81.176.64.0/18", // mts
  "185.32.217.0/24", // tele2
  "109.207.16.0/21", // tele2
  "91.194.226.0/24", // sber
  "109.70.11.0/24", // sber
  "212.118.57.0/24", // mts-web
];

const TLD_RE = /^xn--[a-z0-9-]+\.[a-z]{2,}$|^[a-z0-9а-я-]+(\.[a-zа-я]{2,})+$/i;

export function normalizeDomain(d: string): string {
  let s = String(d || "")
    .trim()
    .toLowerCase()
    .replace(/^[.*]+/, "")
    .replace(/\.+$/, "");
  // punycode for cyrillic TLDs (`.рф` -> `xn--p1ai`)
  if (s.endsWith(".рф") || s === "рф") s = s.replace(/рф$/, "xn--p1ai");
  if (s.endsWith(".xn--p1ai") || s === "xn--p1ai") s = s; // already puny
  return s;
}

export function isValidDomain(d: string): boolean {
  const s = normalizeDomain(d);
  return !!s && s.length <= 253 && (TLD_RE.test(s) || /^xn--/.test(s));
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\d{1,2}))?$/;

export function isValidIPv4Cidr(s: string): boolean {
  const m = IPV4_RE.exec(String(s || "").trim());
  if (!m) return false;
  for (const part of [m[1], m[2], m[3], m[4]]) if (Number(part) > 255) return false;
  const plen = m[6] === undefined ? 32 : Number(m[6]);
  return plen >= 0 && plen <= 32;
}

export const DEFAULT_TIER_CONFIG: TierConfig = {
  version: 1,
  lanIf: "br-lan",
  tunIf: "singbox",
  tunAddr: "172.19.0.1",
  tunPrefix: 30,
  mark: "0x00330000",
  markMask: "0x330000/0xff0000",
  routeTable: 258,
  rulePriority: 29990,
  proxyEnabled: true,
  tier1: { domains: [...DEFAULT_RU_DOMAINS], networks: [...DEFAULT_RU_NETWORKS] },
  tier2: { domains: [...DEFAULT_TIER2_DOMAINS], networks: [...DEFAULT_TIER2_NETWORKS] },
  tier3ExtraDomains: [...DEFAULT_FORCED_PROXY_DOMAINS],
  blockedDomains: [],
  dns: { ...DEFAULT_TIER_DNS },
};

export function defaultConfig(): TierConfig {
  return JSON.parse(JSON.stringify(DEFAULT_TIER_CONFIG)) as TierConfig;
}
