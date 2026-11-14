import { describe, it, expect } from "vitest";

describe("ORBIX Universal Route Normalizer", () => {
  const normalizeRoute = (rawHash: string): string => {
    let raw = rawHash.replace(/^#\/?/, "").toLowerCase().trim();
    raw = raw.split("?")[0].replace(/\/+$/, "");
    if (!raw) return "overview";

    const segments = raw.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "overview";
    const fullNormalized = segments.join("/");

    const routeMap: Record<string, string> = {
      // Status
      overview: "overview",
      status: "overview",
      "status/overview": "overview",
      graphs: "bandwidth",
      realtime: "bandwidth",
      bandwidth: "bandwidth",
      "status/bandwidth": "bandwidth",
      "status/graphs": "bandwidth",
      devices: "clients",
      leases: "clients",
      clients: "clients",
      "status/clients": "clients",
      logs: "logs",
      syslog: "logs",
      "status/logs": "logs",

      // Traffic
      traffic: "traffic",
      flow: "traffic",
      topology: "traffic",
      "traffic/flow": "traffic",
      "traffic/topology": "traffic",
      explain: "explain",
      "diagnose-route": "explain",
      why: "explain",
      "traffic/explain": "explain",

      // Policy & Lists
      policies: "policies",
      policy: "policies",
      rules: "policies",
      "policy-rules": "policies",
      "expert/policies": "policies",
      "simple/policies": "policies",
      lists: "lists",
      categories: "lists",
      feeds: "lists",
      dns: "dns",
      smartdns: "dns",
      "dns-routing": "dns",

      // Circumvention
      vpn: "vpn",
      vpns: "vpn",
      "vpn-manager": "vpn",
      "circumvention/vpn": "vpn",
      subs: "subscriptions",
      sub: "subscriptions",
      happ: "subscriptions",
      subscriptions: "subscriptions",
      "circumvention/subscriptions": "subscriptions",
      zapret: "zapret",
      "circumvention/zapret": "zapret",
      podkop: "podkop",
      "circumvention/podkop": "podkop",
      pbr: "pbr",
      "circumvention/pbr": "pbr",

      // Network
      interfaces: "interfaces",
      vlans: "interfaces",
      "network/interfaces": "interfaces",
      wifi: "wireless",
      wireless: "wireless",
      "network/wireless": "wireless",
      "network/wifi": "wireless",
      dhcp: "dhcp",
      "dhcp-dns": "dhcp",
      "network/dhcp": "dhcp",
      fw: "firewall",
      firewall: "firewall",
      "firewall-rules": "firewall",
      "network/firewall": "firewall",
      diagnostics: "diagnostics",
      diag: "diagnostics",
      "network/diagnostics": "diagnostics",

      // System
      general: "general",
      settings: "general",
      "system/general": "general",
      admin: "admin",
      ssh: "admin",
      password: "admin",
      "system/admin": "admin",
      software: "software",
      packages: "software",
      opkg: "software",
      apk: "software",
      "system/software": "software",
      services: "services",
      startup: "services",
      init: "services",
      "system/services": "services",
      tasks: "tasks",
      cron: "tasks",
      crontab: "tasks",
      "system/tasks": "tasks",
      backup: "backup",
      flash: "backup",
      restore: "backup",
      "system/backup": "backup",
      "system/flash": "backup",

      // Install & Wizard
      install: "install",
      catalog: "install",
      firmware: "install",
      "devices-catalog": "install",
      wizard: "wizard",
      setup: "wizard",
    };

    return routeMap[fullNormalized] || routeMap[lastSegment] || routeMap[raw] || "overview";
  };

  it("should normalize simple routes correctly", () => {
    expect(normalizeRoute("#/overview")).toBe("overview");
    expect(normalizeRoute("#/backup")).toBe("backup");
    expect(normalizeRoute("#/wireless")).toBe("wireless");
    expect(normalizeRoute("#/vpn")).toBe("vpn");
  });

  it("should resolve nested LuCI and category paths", () => {
    expect(normalizeRoute("#/system/backup")).toBe("backup");
    expect(normalizeRoute("#/system/admin")).toBe("admin");
    expect(normalizeRoute("#/system/software")).toBe("software");
    expect(normalizeRoute("#/system/services")).toBe("services");
    expect(normalizeRoute("#/network/interfaces")).toBe("interfaces");
    expect(normalizeRoute("#/network/wireless")).toBe("wireless");
    expect(normalizeRoute("#/network/firewall")).toBe("firewall");
    expect(normalizeRoute("#/network/dhcp")).toBe("dhcp");
    expect(normalizeRoute("#/status/logs")).toBe("logs");
    expect(normalizeRoute("#/status/overview")).toBe("overview");
    expect(normalizeRoute("#/circumvention/vpn")).toBe("vpn");
    expect(normalizeRoute("#/circumvention/zapret")).toBe("zapret");
  });

  it("should strip query parameters and trailing slashes safely", () => {
    expect(normalizeRoute("#/backup?tab=expert&lang=ru")).toBe("backup");
    expect(normalizeRoute("#/network/wireless/?ref=overview")).toBe("wireless");
    expect(normalizeRoute("#/system/backup/")).toBe("backup");
  });

  it("should fallback cleanly on unknown routes to overview", () => {
    expect(normalizeRoute("#/some/unknown/path")).toBe("overview");
    expect(normalizeRoute("")).toBe("overview");
    expect(normalizeRoute("#")).toBe("overview");
  });
});
