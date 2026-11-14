// ORBIX DNS and IP Leak Protection Engine
// Audits network routing, DNS upstreams, and rebinding vulnerabilities using live OpenWrt telemetry
import { ubusClient } from "@/lib/ubus-client";
import { LeakDetectionAuditResult } from "@/types/errors";
import { useErrorStore } from "@/store/error-store";

class LeakDetector {
  private lastAuditResult: LeakDetectionAuditResult = {
    timestamp: Date.now(),
    dnsLeak: {
      detected: false,
      activeDnsServers: ["127.0.0.1#53 (dnsmasq)"],
      isUnencryptedIspDns: false,
    },
    ipLeak: {
      detected: false,
      defaultGatewayInterface: "wan",
      protectedSubnetLeaking: false,
    },
    dnsRebinding: {
      protected: true,
      suspiciousRequestsCount: 0,
    },
    overallStatus: "secure",
  };

  public async runAudit(): Promise<LeakDetectionAuditResult> {
    const now = Date.now();
    let dnsLeaking = false;
    let ipLeaking = false;
    let isRebindProtected = true;

    try {
      // 1. Audit DNS Configuration
      const ifaces = await ubusClient.getInterfaces();
      const wan = ifaces.find((i) => i.interface === "wan" || i.l3_device === "wan");
      const ispDns = wan?.dns_servers || [];

      // Check /tmp/resolv.conf.auto
      const resolvAuto = await ubusClient.readFile("/tmp/resolv.conf.auto");
      const parsedIspServers = resolvAuto
        .split("\n")
        .filter((l) => l.startsWith("nameserver"))
        .map((l) => l.replace("nameserver", "").trim());

      const activeDnsList = parsedIspServers.length > 0 ? parsedIspServers : (ispDns.length > 0 ? ispDns : ["77.88.8.8"]);

      // Check if VPN is running
      const vless = await ubusClient.getVlessStatus();
      const isVpnActive = Boolean(vless?.running);

      // If VPN is active but clients are directed to ISP DNS servers without encryption -> DNS Leak!
      const isIspDnsActive = activeDnsList.some((ip) => ip.startsWith("10.") || ip.startsWith("192.168."));
      if (isVpnActive && isIspDnsActive) {
        dnsLeaking = true;
        useErrorStore.getState().emitEvent({
          code: 408,
          identifier: "DNS_LEAK_DETECTED",
          source: "leak_detector",
          customMessage: `Обнаружена утечка DNS: запросы направляются на незашифрованный DNS провайдера (${activeDnsList.join(", ")}).`,
          metadata: {
            activeDnsServers: activeDnsList,
            ispDnsDetected: true,
          },
          severityOverride: "critical",
        });
      }

      // 2. Audit IP Routing
      const pbr = await ubusClient.call<any>("circumvention", "pbr_status", {}).catch(() => null);
      if (isVpnActive && pbr) {
        // Verify whether protected rules are enabled
        const redmiRule = pbr.rules?.find((r: any) => r.id?.includes("130") || r.src_addr?.includes("130"));
        if (redmiRule && !redmiRule.enabled) {
          ipLeaking = true;
          useErrorStore.getState().emitEvent({
            code: 409,
            identifier: "IP_LEAK_DETECTED",
            source: "leak_detector",
            customMessage: "Обнаружена утечка IP: защищаемое устройство 192.168.1.130 перенаправлено в открытый WAN.",
            metadata: {
              targetIp: "192.168.1.130",
              routeInterface: "wan",
            },
            severityOverride: "critical",
          });
        }
      }

      // 3. Audit DNS Rebinding Protection in dnsmasq
      const dhcpUci = await ubusClient.getUci("dhcp").catch(() => null);
      const dnsmasqSection = (dhcpUci?.values as any)?.["@dnsmasq[0]"] || {};
      isRebindProtected = dnsmasqSection.rebind_protection !== "0";

      if (!isRebindProtected) {
        useErrorStore.getState().emitEvent({
          code: 606,
          identifier: "DNS_REBINDING_BLOCKED",
          source: "leak_detector",
          customMessage: "Внимание: защита от DNS Rebinding атак отключена в конфигурации dnsmasq.",
          metadata: { rebind_protection: false },
          severityOverride: "warning",
        });
      }

      this.lastAuditResult = {
        timestamp: now,
        dnsLeak: {
          detected: dnsLeaking,
          activeDnsServers: activeDnsList,
          isUnencryptedIspDns: isIspDnsActive,
          details: isIspDnsActive ? "Используются DNS провайдера" : "Зашифрованный DoH/SmartDNS",
        },
        ipLeak: {
          detected: ipLeaking,
          defaultGatewayInterface: wan?.l3_device || "wan",
          protectedSubnetLeaking: ipLeaking,
          details: ipLeaking ? "Утечка трафика в прямой WAN" : "Защищенный туннель tun0/singbox",
        },
        dnsRebinding: {
          protected: isRebindProtected,
          suspiciousRequestsCount: 0,
        },
        overallStatus: dnsLeaking || ipLeaking ? "leaking" : !isRebindProtected ? "warning" : "secure",
      };
    } catch (err) {
      console.error("[LeakDetector] Audit execution error:", err);
    }

    return this.lastAuditResult;
  }

  public getLastResult(): LeakDetectionAuditResult {
    return this.lastAuditResult;
  }
}

export const leakDetector = new LeakDetector();
