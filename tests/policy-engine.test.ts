import { describe, it, expect } from "vitest";
import { PolicyCompiler } from "@/services/policy-engine/compiler";
import { PolicyConflictDetector } from "@/services/policy-engine/conflict-detector";
import { RouteEvaluator } from "@/services/policy-engine/evaluator";
import { NetworkPolicy } from "@/services/policy-engine/types";
import { DEFAULT_DOMAIN_CATEGORIES } from "@/services/policy-engine/categories";

describe("Unified Policy Engine", () => {
  const compiler = new PolicyCompiler(DEFAULT_DOMAIN_CATEGORIES, [
    {
      id: "smartphones",
      name: "Smartphones",
      nameRu: "Смартфоны",
      icon: "smartphone",
      deviceIps: ["192.168.1.130", "192.168.1.159"],
    },
  ]);

  const detector = new PolicyConflictDetector();
  const evaluator = new RouteEvaluator(DEFAULT_DOMAIN_CATEGORIES, []);

  it("should resolve domain categories accurately", () => {
    const domains = compiler.resolveDomains(["category:youtube", "domain:example.com"]);
    expect(domains).toContain("googlevideo.com");
    expect(domains).toContain("youtube.com");
    expect(domains).toContain("example.com");
  });

  it("should resolve device groups to concrete IP addresses", () => {
    const ips = compiler.resolveSourceAddresses(["group:smartphones", "ip:192.168.1.200"]);
    expect(ips).toContain("192.168.1.130");
    expect(ips).toContain("192.168.1.159");
    expect(ips).toContain("192.168.1.200");
  });

  it("should compile device policies into PBR rules and domain policies into Sing-box rules", () => {
    const testPolicies: NetworkPolicy[] = [
      {
        id: "pol-device",
        name: "Smartphone VPN",
        enabled: true,
        priority: 10,
        mode: "simple",
        source: { type: "device", values: ["192.168.1.130"] },
        destination: { type: "all", values: [] },
        action: { type: "vpn_tunnel", target: "singbox" },
      },
      {
        id: "pol-direct",
        name: "Direct Russian Sites",
        enabled: true,
        priority: 20,
        mode: "simple",
        source: { type: "all", values: [] },
        destination: { type: "category", values: ["category:russia"] },
        action: { type: "direct_wan" },
      },
      {
        id: "pol-zapret",
        name: "YouTube Zapret",
        enabled: true,
        priority: 30,
        mode: "simple",
        source: { type: "all", values: [] },
        destination: { type: "category", values: ["category:youtube"] },
        action: { type: "zapret_dpi" },
      },
    ];

    const compiled = compiler.compile(testPolicies);

    // 1. PBR Rule for device
    expect(compiled.pbrPolicies.length).toBe(1);
    expect(compiled.pbrPolicies[0].src_addr).toBe("192.168.1.130");
    expect(compiled.pbrPolicies[0].interface).toBe("singbox");

    // 2. Sing-box direct rules for Russian sites & Zapret
    expect(compiled.singboxRules.length).toBeGreaterThan(1);

    // 3. Zapret hostlists populated
    expect(compiled.zapretHostlists.general.length + compiled.zapretHostlists.google.length).toBeGreaterThan(0);
  });

  it("should detect shadowing conflicts between overlapping policies", () => {
    const conflictingPolicies: NetworkPolicy[] = [
      {
        id: "pol-broad",
        name: "All Traffic to VPN",
        enabled: true,
        priority: 10,
        mode: "expert",
        source: { type: "all", values: [] },
        destination: { type: "all", values: [] },
        action: { type: "vpn_tunnel", target: "singbox" },
      },
      {
        id: "pol-shadowed",
        name: "YouTube Direct",
        enabled: true,
        priority: 50,
        mode: "simple",
        source: { type: "all", values: [] },
        destination: { type: "category", values: ["category:youtube"] },
        action: { type: "direct_wan" },
      },
    ];

    const conflicts = detector.detectConflicts(conflictingPolicies);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].type).toBe("shadow");
  });

  it("should evaluate real-time route decision for given client and target", () => {
    const policies: NetworkPolicy[] = [
      {
        id: "pol-yt",
        name: "YouTube Zapret",
        enabled: true,
        priority: 10,
        mode: "simple",
        source: { type: "all", values: [] },
        destination: { type: "category", values: ["category:youtube"] },
        action: { type: "zapret_dpi" },
      },
    ];

    const result = evaluator.evaluate("googlevideo.com", "192.168.1.130", "tcp", 443, policies);
    expect(result.winningPolicy?.name).toBe("YouTube Zapret");
    expect(result.dpiProcessing.enabled).toBe(true);
    expect(result.dpiProcessing.engine).toBe("nfqws");
  });
});
