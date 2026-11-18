// Hard validators: routing-loop and DNS-leak detection for generated
// artifacts. The panel runs these BEFORE pushing anything to the router,
// and tests/routing-engine.test.ts asserts the detectors fire on sabotage.
import { isValidDomain, isValidIPv4Cidr, type NodeSpec, type TierConfig } from "./types";
import { genTierNft, genDnsmasqTiers, genIprouteScript, NFT_TABLE } from "./nft-gen";
import { genSingboxConfig, OUT_DIRECT, OUT_PROXY, SREM, SRU, TUN_IN } from "./singbox-gen";

export interface GeneratedArtifacts {
  nft: string;
  dnsmasq: string;
  iproute: string;
  singbox: Record<string, unknown>;
  singboxJson: string;
}

const IPV4_RE = /^\d+\.\d+\.\d+\.\d+$/;

export function validateConfig(cfg: TierConfig): string[] {
  const e: string[] = [];
  if (!cfg.lanIf || !/^[A-Za-z0-9_.@-]{1,15}$/.test(cfg.lanIf)) e.push("lanIf некорректен");
  if (!cfg.tunIf || !/^[A-Za-z0-9_.@-]{1,15}$/.test(cfg.tunIf)) e.push("tunIf некорректен");
  if (cfg.lanIf === cfg.tunIf) e.push("lanIf и tunIf совпадают — гарантированная петля");
  if (!IPV4_RE.test(cfg.tunAddr)) e.push("tunAddr должен быть IPv4");
  if (cfg.tunPrefix < 24 || cfg.tunPrefix > 30) e.push("tunPrefix вне 24..30");
  if (!/^0x[0-9a-fA-F]{1,8}$/.test(cfg.mark)) e.push("mark не hex");
  if (!/^0x[0-9a-fA-F]+\/0x[0-9a-fA-F]+$/.test(cfg.markMask)) e.push("markMask должен быть mark/mask");
  const markVal = parseInt(cfg.mark, 16);
  const [mRule, mMask] = cfg.markMask.split("/").map((x) => parseInt(x, 16));
  if ((markVal & mMask) !== (mRule & mMask)) e.push("ip rule mask не накрывает fwmark");
  if (cfg.routeTable < 100 || cfg.routeTable > 10000 || [253, 254, 255].includes(cfg.routeTable))
    e.push("routeTable вне 100..10000 или зарезервирован (253 default / 254 main / 255 local)");
  if (cfg.rulePriority < 100 || cfg.rulePriority > 32000) e.push("rulePriority вне 100..32000");
  for (const d of [...cfg.tier1.domains, ...cfg.tier2.domains, ...cfg.tier3ExtraDomains, ...cfg.blockedDomains])
    if (!isValidDomain(d)) e.push(`домен некорректен: ${d}`);
  for (const c of [...cfg.tier1.networks, ...(cfg.tier2.networks || [])]) if (!isValidIPv4Cidr(c)) e.push(`CIDR некорректен: ${c}`);
  if (cfg.dns.ruServers.length === 0) e.push("нет RU DNS-серверов");
  for (const s of cfg.dns.ruServers)
    if (!IPV4_RE.test(s.replace(/:\d+$/, ""))) e.push(`RU DNS должен быть IPv4 (без DoH напрямую!): ${s}`);
  if (!/^https:\/\//.test(cfg.dns.remoteDoH)) e.push("remoteDoH должен быть https:// (иначе DNS-утечка открытым текстом)");
  return e;
}

export function generateAll(cfg: TierConfig, nodes: NodeSpec[], activeId: string, staticProxyCidrs: string[], withAntizapret: boolean): GeneratedArtifacts | { errors: string[] } {
  const errors = validateConfig(cfg);
  const active = nodes.find((n) => n.id === activeId);
  if (!active) return { errors: [...errors, "нет активного узла подписки"] };
  if (errors.length) return { errors };
  const nodeServers = nodes.map((n) => n.server);
  const nft = genTierNft({ cfg, nodeServers, staticProxyCidrs });
  const dnsmasq = genDnsmasqTiers(cfg);
  const iproute = genIprouteScript(cfg);
  const singbox = genSingboxConfig({ cfg, node: active, nodeServers, staticProxyCidrs, withAntizapret });
  return { nft, dnsmasq, iproute, singbox, singboxJson: JSON.stringify(singbox, null, 2) };
}

export function detectLoops(cfg: TierConfig, art: GeneratedArtifacts): string[] {
  const e: string[] = [];
  const { nft, iproute, singbox } = art;

  // 1. chain guard: LAN-only + return-first structure
  const chainLines = nft.split("chain marktier")[1]?.split("}")[0] ?? "";
  const ruleLines = chainLines
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l !== "{" && l !== "}" && !l.startsWith("type filter"));
  const firstMark = ruleLines.findIndex((l) => l.includes("meta mark set"));
  const guardIdx = ruleLines.findIndex((l) => l === `iifname != "${cfg.lanIf}" counter return`);
  if (guardIdx < 0) e.push("nft: нет guard-правила 'iifname != lan return' — чужие интерфейсы будут помечены");
  if (firstMark >= 0 && guardIdx >= 0 && guardIdx > firstMark) e.push("nft: guard интерфейса идёт ПОСЛЕ mark-правил");
  if (!ruleLines[0]?.includes("@nodeip")) e.push("nft: первое правило chain не возвращает @nodeip (VPN-серверы) — петля sing-box↔WAN");

  // 2. catch-all must never mark DNS or the TUN subnet
  if (nft.includes("th dport 53")) e.push("nft: catch-all помечает DNS-трафик — перехват резолвера ломается");
  if (new RegExp(`meta mark set.*\\n.*${cfg.tunAddr}`).test(chainLines)) e.push("nft: TUN-подсеть помечается в VPN — петля");

  // 3. every node IP literal must be protected inside sing-box rules too
  const routeObj = (singbox.route ?? {}) as Record<string, unknown>;
  const sbRules = (routeObj.rules as Record<string, unknown>[]) ?? [];
  const guarded = new Set<string>();
  for (const rr of sbRules) {
    if (rr.outbound === OUT_DIRECT && Array.isArray(rr.ip_cidr))
      for (const c of rr.ip_cidr as string[]) if (IPV4_RE.test(c)) guarded.add(c);
  }
  for (const server of artNodeServers(art)) {
    if (!guarded.has(server)) e.push(`sing-box: IP узла ${server} не в ip_cidr direct-guard — tunnel-in-tunnel`);
  }

  // 4. iproute: table numbers agree, no default route into main, no touching LAN
  if (!iproute.includes(`table ${cfg.routeTable}`)) e.push("iproute: таблица маршрутизации не соответствует конфигу");
  if (!iproute.includes(`fwmark ${cfg.markMask}`)) e.push("iproute: fwmark/mask не соответствует конфигу");
  if (new RegExp(`ip route (add|replace) default dev ${cfg.tunIf}(?!.*table)`).test(iproute))
    e.push("iproute: default-маршрут в tun БЕЗ таблицы ломает основную сеть (петля whole-router)");
  if (iproute.includes(`table main`) || iproute.includes(`table local`)) e.push("iproute: скрипт трогает main/local таблицы");
  if (!iproute.includes(`/sys/class/net/${cfg.tunIf}`)) e.push("iproute: нет проверки существования tun-устройства");

  // 5. sing-box must not claim to manage routes itself (we own the policy)
  const inbounds = (singbox.inbounds as Record<string, unknown>[]) ?? [];
  const tun = inbounds.find((i) => i.tag === TUN_IN);
  if (tun?.auto_route === true) e.push("sing-box: auto_route=true конфликтует с панельным policy-маршрутом (двойная петля)");

  // 6. final route must be proxy only when a node exists; direct when disabled
  const route = singbox.route as Record<string, unknown>;
  if (cfg.proxyEnabled && route.final !== OUT_PROXY) e.push("sing-box: final != proxy при включённом tier3 — silent leak вместо VPN");
  if (!cfg.proxyEnabled && route.final !== OUT_DIRECT) e.push("sing-box: final != direct при выключенном tier3");

  return e;
}

/** helper: node server literals mentioned in nft elements (must stay in nodeip set) */
function artNodeServers(art: GeneratedArtifacts): string[] {
  const m = art.nft.match(/set nodeip \{[\s\S]*?elements = \{([^}]*)\}/);
  return (m?.[1] ?? "").split(/[,\s]+/).filter((s) => IPV4_RE.test(s));
}

export function detectDnsLeaks(cfg: TierConfig, art: GeneratedArtifacts): string[] {
  const e: string[] = [];
  const dns = (art.singbox.dns ?? {}) as Record<string, unknown>;
  const servers = (dns.servers as Record<string, unknown>[]) ?? [];
  const route = (art.singbox.route ?? {}) as Record<string, unknown>;
  const rules = (route.rules as Record<string, unknown>[]) ?? [];

  if (!servers.length) e.push("dns: в sing-box нет ни одного сервера");
  const remote = servers.find((s) => s.tag === SREM);
  if (!remote) e.push("dns: нет remote-резолвера через proxy");
  else if (remote.detour !== OUT_PROXY) e.push("dns: remote-резолвер идёт не через proxy (DoH через RU = детект + утечка)");
  else if (typeof remote.address !== "string" || !remote.address.startsWith("https://"))
    e.push("dns: remote-резолвер не https DoH");
  for (const s of servers) {
    if (s.tag !== SREM && s.detour === OUT_PROXY) e.push(`dns: RU-резолвер ${s.tag} идёт через proxy — региональный DNS через VPN`);
    if (typeof s.address === "string" && /^https?:\/\//.test(s.address) && s.tag !== SREM)
      e.push(`dns: ${s.tag} использует DoH поверх direct — неочевидная утечка при blocked DoH`);
  }
  if (dns.final !== SRU) e.push("dns: final не на RU-резолвер — домены по умолчанию резолвятся через proxy (geoblock-утечка)");

  const hasHijack = rules.some((r) => r.action === "hijack-dns");
  if (!hasHijack) e.push("dns: нет hijack-dns для tun-резолвера — кривые клиенты минуют dnsmasq-пины");

  const dnsRules = (dns.rules as Record<string, unknown>[]) ?? [];
  const ruRoute = dnsRules.find((r) => r.server === SRU);
  const suffixes = (ruRoute?.domain_suffix as string[]) ?? [];
  for (const tld of ["ru", "xn--p1ai", "su"])
    if (!suffixes.includes(tld)) e.push(`dns: TLD .${tld} не закреплён за RU-резолвером (геоблок-сайты получат foreign IP)`);

  // dnsmasq side: TLD rules must exist and point at the direct set
  if (!art.dnsmasq.includes(`nftset=/ru/inet#${NFT_TABLE}#tier1`)) e.push("dnsmasq: нет nftset-правила для зоны .ru");
  if (!art.dnsmasq.includes("xn--p1ai")) e.push("dnsmasq: нет зоны .рф (punycode)");
  if (!art.dnsmasq.includes("su/")) e.push("dnsmasq: нет зоны .su");

  // no plaintext foreign DNS anywhere (evaluate the live object, not cached text)
  const liveJson = JSON.stringify(art.singbox).replace(/https:\/\/dns\.google\/dns-query/g, "");
  if (/8\.8\.8\.8|1\.1\.1\.1/.test(liveJson)) e.push("dns: в конфиге всплыл публичный plaintext-резолвер");

  // node servers must never be DNS addresses (feedback loop via VPN DNS)
  for (const s of servers) {
    const addr = String(s.address ?? "");
    if (artNodeServers(art).includes(addr)) e.push(`dns: резолвер ${addr} — это IP VPN-узла ( петля )`);
  }
  void cfg;
  return e;
}

// ---------------- URLTest / failover ----------------
export interface NodeProbe {
  id: string;
  ok: boolean;
  latencyMs: number;
  /** real payload speed (KB/s), 0 = unknown */
  speedKbps?: number;
}

export interface FailoverPolicy {
  /** switch only if the challenger is this fraction faster than current */
  hysteresisFactor: number;
  /** absolute latency budget before anything counts as dead */
  maxLatencyMs: number;
}

export const DEFAULT_FAILOVER: FailoverPolicy = { hysteresisFactor: 1.5, maxLatencyMs: 1500 };

/**
 * URLTest-style selection with hysteresis: keep the current node unless it
 * is dead/unacceptable or a live peer is decisively better (>= factor faster
 * AND at least 80ms better), so a flapping link does not bounce the tunnel.
 */
export function pickNode(probes: NodeProbe[], currentId: string, policy: FailoverPolicy = DEFAULT_FAILOVER): { id: string | null; reason: string } {
  const live = probes.filter((p) => p.ok && p.latencyMs > 0 && p.latencyMs <= policy.maxLatencyMs).sort((a, b) => a.latencyMs - b.latencyMs);
  if (live.length === 0) return { id: null, reason: "all-dead" };
  const best = live[0];
  const cur = probes.find((p) => p.id === currentId);
  if (cur && cur.ok && cur.latencyMs > 0 && cur.latencyMs <= policy.maxLatencyMs) {
    if (cur.id === best.id) return { id: cur.id, reason: "current-best" };
    const decisivelyBetter = best.latencyMs * policy.hysteresisFactor <= cur.latencyMs - 80;
    if (!decisivelyBetter) return { id: cur.id, reason: "current-acceptable" };
    return { id: best.id, reason: `failover:${cur.latencyMs}ms->${best.latencyMs}ms` };
  }
  return { id: best.id, reason: cur && !cur.ok ? `failover:dead->${best.id}` : `switch:${best.latencyMs}ms` };
}
