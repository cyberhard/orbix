/**
 * Integration test: emulates the router's rpcd "circumvention" JSON-RPC
 * endpoint and drives the FULL panel pipeline end to end:
 *
 *   subscription text -> parser -> failover pick -> tier engine artifacts
 *   -> chunked tiers_stage + tiers_commit over fake ubus transport
 *
 * Verifies the final sing-box config and nftables/dnsmasq/iproute rules for
 * all three traffic classes: RU -> Direct, TSPU-sensitive -> Zapret (direct
 * but nfqws-marked), Foreign -> VPN (proxy), with no routing loops and no
 * DNS leaks.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  defaultConfig,
  generateAll,
  validateConfig,
  detectLoops,
  detectDnsLeaks,
  parseSubscription,
  pickNode,
  DEFAULT_FAILOVER,
  type GeneratedArtifacts,
  type NodeSpec,
  type TierConfig,
} from "../src/services/routing-engine";
import { ubusClient } from "../src/lib/ubus-client";

// base64 helpers (node globals; typed loosely like the other tests)
const b = globalThis as unknown as {
  Buffer: {
    from: (d: string, e: string) => { toString: (e: string) => string };
  };
};
const b64enc = (s: string) => b.Buffer.from(s, "utf8").toString("base64");
const b64dec = (s: string) => b.Buffer.from(s, "base64").toString("utf8");

// ---------------------------------------------------------------------------
// 1. Subscription fixtures: VLESS+Reality, Shadowsocks (SIP002), Hysteria2,
//    Trojan. Raw subscription is served base64-encoded, plus one junk line.
// ---------------------------------------------------------------------------
const SUB_LINKS = [
  "vless://11111111-2222-3333-4444-555555555555@203.0.113.20:443?encryption=none&security=reality&sni=www.microsoft.com&fp=chrome&pbk=PUBKEYPUBKEYPUBKEY&sid=ab12&type=tcp&flow=xtls-rprx-vision#Zurich%20Reality",
  "ss://YWVzLTI1Ni1nY206c2VjcmV0MTIz@198.51.100.7:8443#Frankfurt%20SS",
  "hy2://ssw0rd123@203.0.113.99:443?insecure=1&sni=edge.example#Vienna%20Hy2",
  "trojan://topsecret@198.51.100.44:443?sni=cdn.example.com#Warsaw%20Trojan",
  "this-is-junk-and-must-be-skipped",
].join("\n");

// ---------------------------------------------------------------------------
// Emulated rpcd state (mirrors rpcd-circumvention.sh tiers_stage semantics:
// base64 chunks appended per part until tiers_commit assembles them).
// ---------------------------------------------------------------------------
type RpcBody = {
  jsonrpc: string;
  id: number;
  method: "call";
  params: [string, string, string, Record<string, unknown>];
};
type RpcOk = { jsonrpc: string; id: number; result: [number, unknown] };

class FakeRpcd {
  parts: Record<string, string> = {};
  stagedParts: string[] = [];
  dropPart?: string;
  commits = 0;
  lastCommittedParts: Record<string, string> = {};
  calls: Array<{ object: string; method: string; params?: Record<string, unknown> }> = [];

  install() {
    const self = this;
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as RpcBody;
      const [object, method] = [body.params[1], body.params[2]];
      const p = body.params[3] ?? {};
      self.calls.push({ object, method, params: p });
      const reply = (data: unknown): Response =>
        ({
          ok: true,
          status: 200,
          json: async (): Promise<RpcOk> => ({ jsonrpc: "2.0", id: body.id, result: [0, data] }),
        }) as unknown as Response;

      if (object !== "circumvention") return reply({});

      switch (method) {
        case "tiers_stage": {
          const sp = p as unknown as { part: string; chunk: string; final?: number };
          if (self.dropPart === sp.part) return reply({ status: "ok", dropped: true });
          self.parts[sp.part] = (self.parts[sp.part] ?? "") + sp.chunk;
          if (sp.final) self.stagedParts.push(sp.part);
          return reply({ status: "ok", part: sp.part, bytes: b64dec(sp.chunk).length });
        }
        case "tiers_commit": {
          self.commits += 1;
          // the router refuses to commit unless all four parts were staged
          const need = ["nft", "dnsmasq", "routes", "config"];
          const missing = need.filter((p) => !(p in self.parts));
          if (missing.length) {
            return reply({
              status: "error",
              message: `tiers_commit:нетданныхчасти${missing[0]}(сначалаtiers_stage)`,
            });
          }
          self.lastCommittedParts = Object.fromEntries(
            Object.entries(self.parts).map(([k, v]) => [k, b64dec(v)]),
          );
          return reply({
            status: "ok",
            nft_applied: 1,
            route_applied: 1,
            dns_hook_applied: 1,
            singbox_applied: 1,
            backup: "/root/orbix-tiers-backup-test",
            message: "применено",
          });
        }
        case "tiers_status":
          return reply({
            status: "ok",
            nft_installed: 1,
            nft_live: 1,
            routes_installed: 1,
            dns_hook: 1,
            cron: 1,
            config_version: "1",
            active_name: "Zurich Reality",
            active_server: "203.0.113.20",
            active_port: "443",
            active_protocol: "vless",
            active_latency_ms: "38",
            active_updated: "just now",
            node_count: 4,
            node_servers: "203.0.113.20 198.51.100.7 203.0.113.99 198.51.100.44",
            singbox_running: 1,
            nfqws_running: 1,
          });
        case "tiers_disable":
          return reply({ status: "ok", message: "отключено" });
        default:
          return reply({ status: "ok" });
      }
    });
  }

  reset() {
    this.parts = {};
    this.stagedParts = [];
    this.commits = 0;
    this.lastCommittedParts = {};
    this.calls = [];
  }
}

const rpcd = new FakeRpcd();

// ---------------------------------------------------------------------------
describe("routing engine integration (ubus -> sing-box + nftables)", () => {
  let nodes: NodeSpec[];
  let cfg: TierConfig;
  let artifacts: GeneratedArtifacts;

  beforeEach(() => {
    rpcd.install();
    rpcd.reset();

    // -- subscription parsing (parser is pure; runs before any RPC)
    const parsed = parseSubscription(b64enc(SUB_LINKS));
    expect(parsed.nodes.length).toBe(4);
    expect(parsed.skipped).toBe(1);
    expect(["links", "base64-links"]).toContain(parsed.format);
    const protocols = parsed.nodes.map((n) => n.protocol).sort();
    expect(protocols).toEqual(["hysteria2", "ss", "trojan", "vless"]);
    nodes = parsed.nodes;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses every supported protocol from the subscription payload", () => {
    const vless = nodes.find((n) => n.protocol === "vless");
    expect(vless?.security).toBe("reality");
    expect(vless?.pbk).toBe("PUBKEYPUBKEYPUBKEY");
    expect(vless?.flow).toBe("xtls-rprx-vision");
    const ss = nodes.find((n) => n.protocol === "ss");
    expect(ss?.method).toBe("aes-256-gcm");
    expect(ss?.password).toBe("secret123");
    const hy = nodes.find((n) => n.protocol === "hysteria2");
    expect(hy?.password).toBe("ssw0rd123");
  });

  it("failover keeps current node within hysteresis and switches on dead node", () => {
    const probes = [
      { id: "dead", ok: false, latencyMs: 0 },
      { id: "cur", ok: true, latencyMs: 100 },
      { id: "near", ok: true, latencyMs: 60 }, // not decisively better (60*1.5 > 100-80)
      { id: "far", ok: true, latencyMs: 900 },
    ];
    expect(pickNode(probes, "cur", DEFAULT_FAILOVER).id).toBe("cur");
    expect(pickNode(probes, "dead", DEFAULT_FAILOVER).id).toBe("near");
    const killer = [
      { id: "cur", ok: true, latencyMs: 1000 },
      { id: "best", ok: true, latencyMs: 90 },
    ];
    expect(pickNode(killer, "cur", DEFAULT_FAILOVER).id).toBe("best");
    expect(pickNode([{ id: "x", ok: false, latencyMs: 0 }], "x", DEFAULT_FAILOVER).id).toBeNull();
  });

  it("generates coherent sing-box + nftables artifacts for all 3 traffic classes", () => {
    cfg = { ...defaultConfig(), proxyEnabled: true };
    const gen = generateAll(cfg, nodes, nodes[0].id, ["193.233.112.0/25"], true);
    if ("errors" in gen) throw new Error(gen.errors.join(" | "));
    artifacts = gen;

    // invariants: no loops, no DNS leaks, clean validation
    expect(validateConfig(cfg)).toEqual([]);
    expect(detectLoops(cfg, artifacts)).toEqual([]);
    expect(detectDnsLeaks(cfg, artifacts)).toEqual([]);

    // ---------------- nftables ----------------
    const nft = artifacts.nft;
    // L1 RU: tier1 sets exist and RU domains are DNS-bound, RU net ranges inline
    expect(nft).toContain("set tier1");
    expect(nft).toContain("set tier1dyn");
    expect(nft).toMatch(/ip daddr @tier1\d? counter return|ip daddr @tier1 counter return|@tier1dyn/);
    // L2 Zapret: static tier2 CIDRs return BEFORE the catch-all proxy mark,
    // zapret's own ipset stays untouched by panel marks
    const tier2Return = nft.indexOf("ip daddr @tier2static counter return");
    const catchAll = nft.lastIndexOf("meta mark set");
    expect(tier2Return).toBeGreaterThan(-1);
    expect(catchAll).toBeGreaterThan(tier2Return);
    // node server IPs must return before any proxy marking (loop guard)
    const nodeGuard = nft.indexOf("@nodeip");
    expect(nodeGuard).toBeGreaterThanOrEqual(0);
    expect(nodeGuard).toBeLessThan(nft.indexOf("meta mark set"));
    // atomic recreate preamble so fw4 reload never duplicates rules
    expect(nft.indexOf("delete table inet paneltiers")).toBeLessThan(nft.indexOf("table inet paneltiers {"));
    // L3: only LAN-origin traffic is marked (no router self-proxy loop)
    expect(nft).toMatch(/iifname.*(br-?lan|lan)/);

    // ---------------- sing-box ----------------
    const sb = artifacts.singbox as {
      route: { final: string; rules: Array<Record<string, unknown>> };
      outbounds: Array<Record<string, unknown>>;
      inbounds: Array<Record<string, unknown>>;
    };
    const rules = sb.route.rules;
    const outTags = sb.outbounds.map((o) => o.tag);
    expect(outTags).toContain("proxy");
    expect(sb.route.final).toBe("proxy"); // L3 catch-all = VPN

    const ruleOut = (pred: (r: Record<string, unknown>) => boolean) =>
      rules.find(pred)?.outbound;

    // L1 Direct: RU domain suffixes -> direct
    expect(
      ruleOut(
        (r) =>
          Array.isArray(r.domain_suffix) &&
          (r.domain_suffix as string[]).some((d) => d === "ru" || d === "xn--p1ai"),
      ),
    ).toBe("direct");
    // L2 Zapret: youtube etc. -> direct (zapret handles it below L3)
    expect(
      ruleOut(
        (r) =>
          Array.isArray(r.domain_suffix) &&
          (r.domain_suffix as string[]).some((d: string) => d.includes("youtube")),
      ),
    ).toBe("direct");
    // L3 Forced proxy: discord via VPN on this line (measured nfqws FAIL)
    const discordRule = ruleOut(
      (r) => Array.isArray(r.domain_suffix) && (r.domain_suffix as string[]).some((d: string) => d.includes("discord")),
    );
    expect(discordRule).toBe("proxy");
    // node server IPs bypass the tunnel (loop guard inside sing-box too)
    expect(
      rules.some(
        (r) =>
          r.outbound === "direct" &&
          Array.isArray(r.ip_cidr) &&
          (r.ip_cidr as string[]).some((c) => c === nodes[0].server || c === `${nodes[0].server}/32`),
      ),
    ).toBe(true);

    // no DNS leak: every DNS resolver is a trusted non-node address
    const sbJson = artifacts.singboxJson;
    for (const n of nodes) expect(sbJson).not.toContain(`"${n.server}"` + `,\n          "port": 53`);
    expect(sbJson).not.toMatch(/"server":\s*"203\.0\.113\.20",\s*"port":\s*53/);

    // ---------------- dnsmasq hook ----------------
    const dns = artifacts.dnsmasq;
    expect(dns).toContain("nftset=/ru/inet#paneltiers#tier1dyn");
    expect(dns).toMatch(/xn--p1ai/); // punycode .рф
    expect(dns).toMatch(/youtube\.com/);
    expect(dns).toMatch(/nftset=\/discord\.com\/inet#paneltiers#proxyxdyn/);

    // ---------------- iproute policy ----------------
    const routes = artifacts.iproute;
    expect(routes).toMatch(new RegExp(`table ${cfg.routeTable}`));
    expect(routes).toMatch(/fwmark/);
    expect(routes).toContain("default");
  });

  it("drives tier_stage chunks + tiers_commit through the emulated rpcd endpoint", async () => {
    cfg = { ...defaultConfig(), proxyEnabled: true };
    const gen = generateAll(cfg, nodes, nodes[0].id, [], true);
    if ("errors" in gen) throw new Error(gen.errors.join(" | "));
    const art = gen;

    const res = await ubusClient.tiersDeploy({
      nft: art.nft,
      dnsmasq: art.dnsmasq,
      iproute: art.iproute,
      tierConfigJson: JSON.stringify(cfg),
    });

    // transport: 4 staged parts + exactly one commit, in protocol order
    expect(rpcd.stagedParts).toEqual(["nft", "dnsmasq", "routes", "config"]);
    expect(rpcd.commits).toBe(1);
    expect(rpcd.calls.some((c) => c.object === "circumvention" && c.method === "tiers_commit")).toBe(true);

    // the router-side reassembly must equal the client-side artifacts verbatim
    expect(rpcd.lastCommittedParts.nft).toBe(art.nft);
    expect(rpcd.lastCommittedParts.dnsmasq).toBe(art.dnsmasq);
    expect(rpcd.lastCommittedParts.routes).toBe(art.iproute);
    const committedCfg = JSON.parse(rpcd.lastCommittedParts.config) as TierConfig;
    expect(committedCfg.routeTable).toBe(cfg.routeTable);
    expect(committedCfg.proxyEnabled).toBe(true);

    // commit result propagated (UI must show router truth, not optimistic success)
    expect(res.status).toBe("ok");
    expect([res.nft_applied, res.route_applied, res.dns_hook_applied, res.singbox_applied]).toEqual([1, 1, 1, 1]);

    // status round-trip through the same fake transport
    const st = await ubusClient.getTiersStatus();
    expect(st.nft_live).toBe(1);
    expect(st.active_protocol).toBe("vless");
    expect(st.node_servers).toContain("203.0.113.20");
    expect(st.singbox_running).toBe(1);
  });

  it("commit error from rpcd surfaces to the UI caller (no fake success)", async () => {
    // stage only `nft`: the emulated rpcd must reject the commit
    await ubusClient.call("circumvention", "tiers_stage", { part: "nft", seq: 0, chunk: b64enc("abc"), final: 1 });
    const r = await ubusClient.call<{ status: string; message?: string }>("circumvention", "tiers_commit", {});
    expect(r.status).toBe("error");
    expect(r.message).toContain("tiers_commit");
    // and tiersDeploy must propagate that error as a rejection (router lost `config`)
    rpcd.reset();
    rpcd.dropPart = "config";
    await expect(
      ubusClient.tiersDeploy({ nft: "x", dnsmasq: "y", iproute: "z", tierConfigJson: "{}" }),
    ).rejects.toThrow(/tiers_commit/);
    rpcd.dropPart = undefined;
  });
});
