import { describe, it, expect } from "vitest";

const b64 = (s: string): string =>
  (globalThis as unknown as {
    Buffer: { from: (b: string, e: "utf8") => { toString(e: "base64"): string } };
  }).Buffer.from(s, "utf8").toString("base64");
import {
  defaultConfig,
  genTierNft,
  genDnsmasqTiers,
  genIprouteScript,
  genSingboxConfig,
  generateAll,
  detectLoops,
  detectDnsLeaks,
  validateConfig,
  parseSubscription,
  parseLink,
  pickNode,
  DEFAULT_FAILOVER,
  type NodeSpec,
  type GeneratedArtifacts,
} from "../src/services/routing-engine";

const NODES: NodeSpec[] = [
  {
    id: "n1", name: "NL Reality", protocol: "vless", server: "203.0.113.20", port: 443,
    uuid: "11111111-2222-3333-4444-555555555555", flow: "xtls-rprx-vision", security: "reality",
    sni: "www.microsoft.com", pbk: "PUBKEY", sid: "ab12", fp: "chrome",
  },
  { id: "n2", name: "DE SS", protocol: "ss", server: "example-host.example", port: 8388, method: "2022-blake3-aes-256-gcm", password: "pw" },
  { id: "n3", name: "FI HY2", protocol: "hysteria2", server: "198.51.100.7", port: 443, password: "secret", sni: "cdn.example", insecure: true },
];

function gen(over?: Partial<Parameters<typeof generateAll>[3]>): GeneratedArtifacts {
  const cfg = defaultConfig();
  const out = generateAll(cfg, NODES, "n1", ["193.233.112.0/25"], true);
  if ("errors" in out) throw new Error("generate failed: " + out.errors.join("; "));
  void over;
  return out;
}

describe("nftables tier generator", () => {
  const art = gen();

  it("node-IP loop guard is the FIRST rule of the mark chain", () => {
    const chain = art.nft.split("chain marktier")[1];
    const firstRule = chain
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("type filter") && l !== "{")[0];
    expect(firstRule).toBe("ip daddr @nodeip counter return");
    expect(art.nft).toContain("203.0.113.20");
    expect(art.nft).toContain("198.51.100.7");
  });

  it("tier ordering: L1 direct before L2 zapret, catch-all mark LAST", () => {
    const rules = art.nft
      .split("chain marktier")[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("type filter") && l !== "}");
    const i1 = rules.findIndex((l) => l.includes("@tier1"));
    const i2 = rules.findIndex((l) => l.includes("@tier2"));
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);
    // forced-proxy statics may mark early, but NO return may follow the first
    // mark except the tier2 return sitting between static-proxy and catch-all
    const firstMark = rules.findIndex((l) => l.includes("meta mark set"));
    expect(firstMark).toBeGreaterThan(i1);
    const returnsAfter = rules.slice(firstMark).filter((l) => l.includes("counter return"));
    expect(returnsAfter.every((l) => l.includes("@tier2"))).toBe(true);
    expect(rules[rules.length - 1]).toContain("meta mark set");
  });

  it("never marks DNS or non-LAN interfaces; RU TLDs never reach the mark", () => {
    expect(art.nft).not.toContain("th dport 53");
    expect(art.nft).toContain('iifname != "br-lan" counter return');
  });

  it("dnsmasq snippet binds .ru/.рф/.su to the DIRECT set and youtube/discord to zapret set", () => {
    expect(art.dnsmasq).toContain("nftset=/ru/inet#paneltiers#tier1");
    expect(art.dnsmasq).toContain("nftset=/xn--p1ai/inet#paneltiers#tier1");
    expect(art.dnsmasq).toContain("nftset=/su/inet#paneltiers#tier1");
    expect(art.dnsmasq).toContain("nftset=/youtube.com/inet#paneltiers#tier2");
    // Discord is DPI-cut on RU lines even with zapret (measured 2026-11: every
    // tested nfqws strategy FAILs discord while it works through VPN) => L3:
    // forced proxy set, never the direct zapret set.
    expect(art.dnsmasq).not.toContain("nftset=/discord.com/inet#paneltiers#tier2");
    expect(art.dnsmasq).toContain("nftset=/discord.com/inet#paneltiers#proxyxdyn");
    const sb: any = art.singbox;
    const proxRule = (sb.route?.rules ?? []).find(
      (r: any) => Array.isArray(r.domain_suffix) && r.domain_suffix.includes("discord.com"),
    );
    expect(proxRule?.outbound).toBe("proxy");
    expect(art.dnsmasq).not.toMatch(/nftset=\/ru[^/]*\/inet#paneltiers#tier2/);
  });

  it("iproute script always keeps the tun default inside its own table", () => {
    expect(art.iproute).toContain(`ip route replace default dev singbox table ${258}`);
    expect(art.iproute).toContain("fwmark 0x330000/0xff0000");
    expect(art.iproute).not.toMatch(/ip route (add|replace) default dev singbox(?!.*table)/);
    expect(art.iproute).toContain("[ -e /sys/class/net/singbox ]");
  });
});

describe("routing-loop detector", () => {
  it("clean generation has zero loop findings", () => {
    const art = gen();
    expect(detectLoops(defaultConfig(), art)).toEqual([]);
  });

  const sabotage = (mut: (a: GeneratedArtifacts) => void) => {
    const art = gen();
    mut(art);
    return detectLoops(defaultConfig(), art);
  };

  it("flags a node IP missing from the sing-box direct guard", () => {
    const errs = sabotage((a) => {
      a.singbox = { ...a.singbox, route: { ...(a.singbox.route as object), rules: [] } };
    });
    expect(errs.some((e) => /203\.0\.113\.20|ip_cidr/.test(e))).toBe(true);
  });

  it("flags marking before the interface guard", () => {
    const errs = sabotage((a) => {
      a.nft = a.nft.replace('iifname != "br-lan" counter return', "# removed");
    });
    expect(errs.some((e) => /guard/i.test(e))).toBe(true);
  });

  it("flags marking DNS traffic", () => {
    const errs = sabotage((a) => {
      a.nft = a.nft.replace("th dport 80 counter meta mark", "th dport 53 counter meta mark").replace("dport 80", "dport 53");
    });
    expect(errs.some((e) => /DNS/i.test(e))).toBe(true);
  });

  it("flags a default route into the TUN without its policy table", () => {
    const errs = sabotage((a) => {
      a.iproute = a.iproute.replace(/table 258/g, "table main");
    });
    expect(errs.some((e) => /таблиц|main/.test(e))).toBe(true);
  });

  it("flags sing-box auto_route (double route management)", () => {
    const errs = sabotage((a) => {
      const inb = (a.singbox.inbounds as Record<string, unknown>[]).find((i) => i.tag === "tun-in");
      if (inb) inb.auto_route = true;
    });
    expect(errs.some((e) => /auto_route/.test(e))).toBe(true);
  });

  it("flags final!=proxy when tier3 is enabled and lanIf==tunIf in config", () => {
    const art = gen();
    (art.singbox.route as Record<string, unknown>).final = "direct";
    expect(detectLoops(defaultConfig(), art).some((e) => /final/.test(e))).toBe(true);
    const cfg = defaultConfig();
    cfg.tunIf = cfg.lanIf;
    expect(validateConfig(cfg).some((e) => /петля/.test(e))).toBe(true);
  });

  it("rejects reserved routing tables and mismatched mark mask", () => {
    const cfg = defaultConfig();
    cfg.routeTable = 254;
    expect(validateConfig(cfg).some((e) => /routeTable/.test(e))).toBe(true);
    cfg.routeTable = 258; // the live router convention — must be legal
    expect(validateConfig(cfg)).toEqual([]);
    cfg.mark = "0x00440000";
    expect(validateConfig(cfg).some((e) => /mask/i.test(e))).toBe(true);
  });
});

describe("DNS-leak detector", () => {
  it("clean generation resolves RU zones direct and foreign DoH only via proxy", () => {
    const art = gen();
    expect(detectDnsLeaks(defaultConfig(), art)).toEqual([]);
    const dns = art.singbox.dns as Record<string, unknown>;
    const remote = (dns.servers as Record<string, unknown>[]).find((s) => s.tag === "remote-dns");
    expect(remote?.detour).toBe("proxy");
    expect(String(remote?.address)).toMatch(/^https:\/\//);
    const ru = (dns.servers as Record<string, unknown>[]).find((s) => s.tag === "ru-dns");
    expect(ru?.detour).toBe("direct");
  });

  const sabDns = (mut: (a: GeneratedArtifacts) => void) => {
    const art = gen();
    mut(art);
    return detectDnsLeaks(defaultConfig(), art);
  };

  it("flags remote resolver going direct (DoH through RU = leak+fingerprints)", () => {
    const errs = sabDns((a) => {
      const servers = (a.singbox.dns as Record<string, unknown>).servers as Record<string, unknown>[];
      servers.find((s) => s.tag === "remote-dns")!.detour = "direct";
    });
    expect(errs.some((e) => /remote/.test(e))).toBe(true);
  });

  it("flags plaintext public resolvers appearing anywhere in the config", () => {
    const errs = sabDns((a) => {
      (a.singbox.dns as Record<string, unknown>).servers = [
        { tag: "ru-dns", address: "8.8.8.8", detour: "direct" },
        { tag: "remote-dns", address: "https://dns.google/dns-query", detour: "proxy" },
      ];
    });
    expect(errs.some((e) => /plaintext/.test(e))).toBe(true);
  });

  it("flags .ru not pinned to the RU resolver (geo-blocked sites leak)", () => {
    const errs = sabDns((a) => {
      (a.singbox.dns as Record<string, unknown>).rules = [];
      (a.singbox.dns as Record<string, unknown>).final = "remote-dns";
    });
    expect(errs.some((e) => /\.ru/.test(e))).toBe(true);
    expect(errs.some((e) => /final/.test(e))).toBe(true);
  });

  it("flags a missing dnsmasq TLD binding and a resolver pointed at a node IP", () => {
    const errs = sabDns((a) => {
      a.dnsmasq = a.dnsmasq.replace("nftset=/ru/inet#paneltiers#tier1", "# removed");
      (a.singbox.dns as Record<string, unknown>).servers = [
        { tag: "ru-dns", address: "203.0.113.20", detour: "direct" },
        { tag: "remote-dns", address: "https://dns.google/dns-query", detour: "proxy" },
      ];
    });
    expect(errs.some((e) => /\.ru/.test(e))).toBe(true);
    expect(errs.some((e) => /петля|node/i.test(e))).toBe(true);
  });

  it("flags http (non-DoH) remote resolver and plaintext RU DoH", () => {
    const cfg = defaultConfig();
    cfg.dns.remoteDoH = "udp://1.1.1.1";
    const out = generateAll(cfg, NODES, "n1", [], true);
    expect("errors" in out && out.errors.some((e) => /https/.test(e))).toBe(true);
  });
});

describe("sing-box config generation per protocol", () => {
  it("vless+reality outbound carries pbk/sid/utls and a vision flow", () => {
    const sb = genSingboxConfig({ cfg: defaultConfig(), node: NODES[0], nodeServers: ["203.0.113.20"], withAntizapret: false });
    const ob = (sb.outbounds as Record<string, unknown>[])[0];
    expect(ob.type).toBe("vless");
    const tls = ob.tls as Record<string, Record<string, unknown>>;
    expect(tls.reality.enabled).toBe(true);
    expect(tls.reality.public_key).toBe("PUBKEY");
    expect(ob.flow).toBe("xtls-rprx-vision");
  });

  it("hysteria2 outbound is QUIC-based with insecure flag and no flow/vless keys", () => {
    const sb = genSingboxConfig({ cfg: defaultConfig(), node: NODES[2], nodeServers: ["198.51.100.7"], withAntizapret: false });
    const ob = (sb.outbounds as Record<string, unknown>[])[0];
    expect(ob.type).toBe("hysteria2");
    expect(ob.password).toBe("secret");
    expect((ob.tls as Record<string, unknown>).insecure).toBe(true);
    expect(ob.uuid).toBeUndefined();
  });

  it("SS and Trojan outbounds carry password/method, no TLS for plain ss", () => {
    const cfg = defaultConfig();
    const ss = genSingboxConfig({ cfg, node: NODES[1], nodeServers: [], withAntizapret: false });
    const ob = (ss.outbounds as Record<string, unknown>[])[0];
    expect(ob.type).toBe("shadowsocks");
    expect(ob.method).toBe("2022-blake3-aes-256-gcm");
    const trojan: NodeSpec = { id: "t", name: "t", protocol: "trojan", server: "a.example", port: 443, password: "p", sni: "a.example", security: "tls" };
    const tj = genSingboxConfig({ cfg, node: trojan, nodeServers: [], withAntizapret: false });
    const tob = (tj.outbounds as Record<string, unknown>[])[0];
    expect(tob.type).toBe("trojan");
    expect((tob.tls as Record<string, unknown>).server_name).toBe("a.example");
  });

  it("tier rules: RU direct before antizapret proxy before zapret-direct; final=proxy", () => {
    const sb = genSingboxConfig({ cfg: defaultConfig(), node: NODES[0], nodeServers: ["203.0.113.20"], withAntizapret: true });
    const rules = (sb.route as Record<string, unknown>).rules as Record<string, unknown>[];
    const idx = (pred: (r: Record<string, unknown>) => boolean) => rules.findIndex(pred);
    const ruDirect = idx((r) => Array.isArray(r.domain_suffix) && (r.domain_suffix as string[]).includes("ru"));
    const anti = idx((r) => Array.isArray(r.rule_set));
    const t2 = idx((r) => Array.isArray(r.domain_suffix) && (r.domain_suffix as string[]).includes("youtube.com"));
    expect(ruDirect).toBeGreaterThan(-1);
    expect(anti).toBeGreaterThan(ruDirect);
    expect(t2).toBeGreaterThan(anti);
    expect((sb.route as Record<string, unknown>).final).toBe("proxy");
  });

  it("proxy disabled -> everything direct, no marks in nft, catch-all removed", () => {
    const cfg = defaultConfig();
    cfg.proxyEnabled = false;
    const nft = genTierNft({ cfg, nodeServers: ["203.0.113.20"] });
    expect(nft).not.toContain("meta mark set");
    expect(nft).toContain("@tier2 counter return");
  });
});

describe("subscription parser", () => {
  it("parses vless+reality link with params and fragment name", () => {
    const n = parseLink("vless://11111111-2222-3333-4444-555555555555@203.0.113.20:443?security=reality&type=tcp&flow=xtls-rprx-vision&fp=chrome&pbk=KEY&sid=cd&sni=www.microsoft.com#%D0%9D%D0%BE%D0%B4%D0%B0%201");
    expect(n).not.toBeNull();
    expect(n!.protocol).toBe("vless");
    expect(n!.security).toBe("reality");
    expect(n!.pbk).toBe("KEY");
    expect(n!.name).toBe("Нода 1");
  });

  it("parses trojan, SIP002 ss, legacy ss, hysteria2 and vmess", () => {
    expect(parseLink("trojan://pass123@host.example:443?sni=host.example&allowInsecure=1#t")!.protocol).toBe("trojan");
    const sip002 = "ss://" + b64("2022-blake3-aes-128-gcm:secret-pw".padEnd(24, "x")) + "@1.2.3.4:8388#ss1";
    const s1 = parseLink(sip002)!;
    expect(s1.method).toBe("2022-blake3-aes-128-gcm");
    const legacy = "ss://" + b64("aes-256-gcm:pw@5.6.7.8:8389") + "#old";
    const s2 = parseLink(legacy)!;
    expect(s2.server).toBe("5.6.7.8");
    expect(s2.port).toBe(8389);
    const h2 = parseLink("hysteria2://sec%40ret%3Apw@198.51.100.7:443?insecure=1&sni=cdn.example#hy")!;
    expect(h2.protocol).toBe("hysteria2");
    expect(h2.password).toBe("sec@ret:pw");
    expect(h2.insecure).toBe(true);
    const vm = "vmess://" + b64(JSON.stringify({ v: "2", ps: "vm", add: "9.9.9.9", port: "443", id: "uuid-1", tls: "tls", sni: "a.example" }));
    const v = parseLink(vm)!;
    expect(v.protocol).toBe("vmess");
    expect(v.security).toBe("tls");
  });

  it("parses a base64 subscription blob and a sing-box JSON subscription", () => {
    const blob = b64("vless://u@203.0.113.20:443?security=reality&pbk=K#a\nTrojan://p@t.example:443#b\nwireguard://nope@x:51820#c\n");
    const r = parseSubscription(blob);
    expect(r.nodes.length).toBe(2);
    expect(r.skipped).toBe(1);
    expect(r.format).toBe("links");
    const json = JSON.stringify({
      outbounds: [
        { type: "vless", name: "j1", uuid: "u", server: "203.0.113.20", server_port: 8443, flow: "", tls: { enabled: true, server_name: "s.example", reality: { enabled: true, public_key: "PK", short_id: "ab" }, utls: { enabled: true, fingerprint: "safari" } } },
        { type: "hysteria2", name: "j2", server: "198.51.100.9", server_port: 443, password: "pw", tls: { enabled: true, insecure: true } },
        { type: "wireguard", name: "skipme", server: "x", server_port: 51820 },
      ],
    });
    const rj = parseSubscription(json);
    expect(rj.format).toBe("singbox-json");
    expect(rj.nodes.map((n) => n.protocol)).toEqual(["vless", "hysteria2"]);
    expect(rj.nodes[0].pbk).toBe("PK");
    expect(rj.nodes[1].insecure).toBe(true);
    expect(rj.skipped).toBe(1);
  });

  it("returns unknown for garbage and dedupes identical endpoints", () => {
    expect(parseSubscription("????????").format).toBe("unknown");
    const r = parseSubscription("vless://u@1.1.1.1:443#x\nvless://u@1.1.1.1:443#y\n");
    expect(r.nodes.length).toBe(1);
  });
});

describe("URLTest failover", () => {
  const P = (id: string, ok: boolean, ms: number) => ({ id, ok, latencyMs: ms });
  it("keeps the current node while it is the best", () => {
    expect(pickNode([P("a", true, 100), P("b", true, 120)], "a").id).toBe("a");
  });
  it("does not flap on marginal improvement (hysteresis)", () => {
    const r = pickNode([P("a", true, 150), P("b", true, 110)], "a", DEFAULT_FAILOVER);
    expect(r.id).toBe("a");
    expect(r.reason).toBe("current-acceptable");
  });
  it("switches to a decisively faster node", () => {
    const r = pickNode([P("a", true, 600), P("b", true, 120)], "a");
    expect(r.id).toBe("b");
    expect(r.reason).toContain("failover");
  });
  it("fails over when the current node dies", () => {
    const r = pickNode([P("a", false, 0), P("b", true, 300)], "a");
    expect(r.id).toBe("b");
    expect(r.reason).toContain("dead");
  });
  it("reports all-dead instead of picking a dead node", () => {
    expect(pickNode([P("a", false, 0), P("b", true, 5000)], "a").id).toBeNull();
  });
});

describe("tier2 static networks (pinned Meta edges for Instagram)", () => {
  it("emits a static tier2 set and a return rule before the catch-all", () => {
    const cfg = defaultConfig();
    cfg.tier2.networks = ["31.13.72.32/27", "157.240.205.0/24"];
    const nft = genTierNft({ cfg, nodeServers: ["203.0.113.20"] });
    expect(nft).toContain("delete table inet paneltiers");
    expect(nft).toContain("set tier2static {");
    expect(nft).toContain("31.13.72.32/27");
    expect(nft).toContain("157.240.205.0/24");
    expect(nft).toContain("ip daddr @tier2static counter return");
    // ordering: static return must precede the catch-all mark
    const idxStatic = nft.indexOf("ip daddr @tier2static counter return");
    const idxCatch = nft.indexOf("th dport 443 counter meta mark set");
    expect(idxStatic).toBeGreaterThan(-1);
    expect(idxStatic).toBeLessThan(idxCatch);
  });

  it("defaults ship Meta pinned edges in tier2 networks", () => {
    const cfg = defaultConfig();
    expect(cfg.tier2.networks).toContain("157.240.205.0/24");
  });

  it("rejects malformed tier2 CIDRs in validateConfig", () => {
    const cfg = defaultConfig();
    cfg.tier2.networks = ["31.13.72.32/33"];
    expect(validateConfig(cfg).some((e) => e.includes("CIDR"))).toBe(true);
  });
});

describe("generated nft is syntactically balanced", () => {
  it("braces balance for empty and populated sets", () => {
    const a = genTierNft({ cfg: defaultConfig(), nodeServers: [] });
    const b = genTierNft({ cfg: defaultConfig(), nodeServers: ["203.0.113.20", "198.51.100.7"], staticProxyCidrs: ["193.233.112.0/25"] });
    for (const nft of [a, b]) {
      const open = (nft.match(/{/g) || []).length;
      const close = (nft.match(/}/g) || []).length;
      expect(open).toBe(close);
    }
    // empty sets must omit the elements statement entirely (nft rejects `elements = {}`)
    expect(a).not.toContain("elements = {}");
    expect(b).toContain("elements = {");
  });
});
