// ORBIX • Route canonicalization tests — every legacy hash must land on the new
// 14-section hub layout with the correct ?tab= deep link.
import { describe, it, expect } from "vitest";
import { canonicalHashFromLocation } from "@/lib/routing";

const c = (hash: string) => canonicalHashFromLocation(hash);

describe("ORBIX canonical router", () => {
  it("keeps canonical hubs as-is", () => {
    expect(c("")).toBe("overview");
    expect(c("#")).toBe("overview");
    expect(c("#/")).toBe("overview");
    expect(c("#/overview")).toBe("overview");
    expect(c("#/clients")).toBe("clients");
    expect(c("#/policies")).toBe("policies");
    expect(c("#/vpn")).toBe("vpn");
    expect(c("#/zapret")).toBe("zapret");
    expect(c("#/kid")).toBe("kid");
    expect(c("#/interfaces")).toBe("interfaces");
    expect(c("#/wireless")).toBe("wireless");
    expect(c("#/dhcp")).toBe("dhcp");
    expect(c("#/firewall")).toBe("firewall");
    expect(c("#/diagnostics")).toBe("diagnostics");
    expect(c("#/services")).toBe("services");
    expect(c("#/software")).toBe("software");
  });

  it("redirects merged Overview sections", () => {
    expect(c("#/bandwidth")).toBe("overview");
    expect(c("#/graphs")).toBe("overview");
    expect(c("#/status/bandwidth")).toBe("overview");
    expect(c("#/traffic")).toBe("clients");
    expect(c("#/topology")).toBe("clients");
    expect(c("#/devices")).toBe("clients");
  });

  it("redirects Routing hub sections with tabs", () => {
    expect(c("#/routing-tiers")).toBe("policies?tab=tiers");
    expect(c("#/pbr")).toBe("policies?tab=pbr");
    expect(c("#/circumvention/pbr")).toBe("policies?tab=pbr");
    expect(c("#/lists")).toBe("policies?tab=lists");
    expect(c("#/categories")).toBe("policies?tab=lists");
    expect(c("#/policies?tab=lists")).toBe("policies?tab=lists");
    expect(c("#/expert/policies")).toBe("policies");
  });

  it("redirects VPN, DNS, Diagnostics, Services, Settings with tabs", () => {
    expect(c("#/subscriptions")).toBe("vpn?tab=subscriptions");
    expect(c("#/happ")).toBe("vpn?tab=subscriptions");
    expect(c("#/dns")).toBe("dhcp?tab=dns");
    expect(c("#/explain")).toBe("diagnostics?tab=explain");
    expect(c("#/logs")).toBe("diagnostics?tab=logs");
    expect(c("#/status/logs")).toBe("diagnostics?tab=logs");
    expect(c("#/podkop")).toBe("services?tab=podkop");
    expect(c("#/tasks")).toBe("services?tab=cron");
    expect(c("#/settings")).toBe("settings?tab=general");
    expect(c("#/general")).toBe("settings?tab=general");
    expect(c("#/ssh")).toBe("settings?tab=admin");
    expect(c("#/system/admin")).toBe("settings?tab=admin");
    expect(c("#/backup")).toBe("settings?tab=backup");
    expect(c("#/system/backup")).toBe("settings?tab=backup");
    expect(c("#/install")).toBe("settings?tab=install");
    expect(c("#/network/firewall")).toBe("firewall");
    expect(c("#/circumvention/zapret")).toBe("zapret");
  });

  it("preserves explicit tab and extra query params over redirect defaults", () => {
    expect(c("#/routing-tiers?tab=rules")).toBe("policies?tab=rules");
    expect(c("#/settings?tab=backup")).toBe("settings?tab=backup");
    expect(c("#/network/wireless/?ref=overview")).toBe("wireless?ref=overview");
    expect(c("#/policies?tab=list&x=1")).toBe("policies?tab=list&x=1");
  });

  it("keeps the wizard special route and falls back unknowns to overview", () => {
    expect(c("#/wizard")).toBe("wizard");
    expect(c("#/setup")).toBe("wizard");
    expect(c("#/some/unknown/path")).toBe("overview");
  });
});
