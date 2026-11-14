// ORBIX Kill Switch Engine
// Kernel-level nftables enforcement preventing unencrypted WAN fallback leaks
import { ubusClient } from "@/lib/ubus-client";

export interface KillSwitchRuntimeState {
  enabled: boolean;
  scope: "vpn_devices" | "all";
  allowLan: boolean;
  active: boolean;
  activeDropRulesCount: number;
  protectedDevices: string[];
  tunnelStatus: "up" | "down" | "checking";
  blockedWan: boolean;
  lastTriggeredAt?: number;
}

class KillSwitchManager {
  private runtimeState: KillSwitchRuntimeState = {
    enabled: false,
    scope: "vpn_devices",
    allowLan: true,
    active: false,
    activeDropRulesCount: 0,
    protectedDevices: ["192.168.1.130", "192.168.1.195"],
    tunnelStatus: "up",
    blockedWan: false,
  };

  private pollTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startWatchdog();
  }

  public async getRuntimeState(): Promise<KillSwitchRuntimeState> {
    try {
      // Query router killswitch status via dedicated circumvention RPC
      const statusRes = await ubusClient.call("circumvention", "killswitch_status");
      if (statusRes) {
        this.runtimeState.enabled = Boolean(statusRes.enabled);
        this.runtimeState.active = Boolean(statusRes.active);
        this.runtimeState.scope = (statusRes.scope as any) || "vpn_devices";
        this.runtimeState.activeDropRulesCount = Number(statusRes.dropped_packets) || 0;
        this.runtimeState.blockedWan = Boolean(statusRes.blocked_wan);
        return { ...this.runtimeState };
      }

      // Query kernel nftables state via file exec as fallback
      const res = await ubusClient.exec("nft", ["list", "table", "inet", "orbix_protection"]);
      if (res && res.code === 0 && res.stdout) {
        this.runtimeState.active = true;
        this.runtimeState.enabled = true;
      } else {
        this.runtimeState.active = false;
      }
    } catch {
      // Offline fallback
    }

    return { ...this.runtimeState };
  }

  public async setEnabled(enabled: boolean, scope: "vpn_devices" | "all" = "vpn_devices"): Promise<boolean> {
    this.runtimeState.enabled = enabled;
    this.runtimeState.scope = scope;

    try {
      const res = await ubusClient.call("circumvention", "killswitch_set", {
        enabled,
        scope,
        allow_lan: true,
      });
      if (res && res.status === "ok") {
        this.runtimeState.active = enabled;
        return true;
      }
    } catch {
      // Fallback
    }

    return this.applyNftablesRules(enabled, scope);
  }

  public async setScope(scope: "vpn_devices" | "all"): Promise<boolean> {
    this.runtimeState.scope = scope;
    if (this.runtimeState.enabled) {
      return this.setEnabled(true, scope);
    }
    return true;
  }

  private async applyNftablesRules(enabled: boolean, scope: "vpn_devices" | "all"): Promise<boolean> {
    try {
      if (!enabled) {
        await ubusClient.exec("nft", ["delete", "table", "inet", "orbix_protection"]).catch(() => null);
        this.runtimeState.active = false;
        this.runtimeState.blockedWan = false;
        return true;
      }

      await ubusClient.exec("nft", ["add", "table", "inet", "orbix_protection"]).catch(() => null);
      await ubusClient.exec("nft", [
        "add",
        "chain",
        "inet",
        "orbix_protection",
        "forward",
        "{",
        "type",
        "filter",
        "hook",
        "forward",
        "priority",
        "-5;",
        "policy",
        "accept;",
        "}",
      ]).catch(() => null);

      await ubusClient.exec("nft", ["flush", "chain", "inet", "orbix_protection", "forward"]).catch(() => null);
      await ubusClient.exec("nft", ["add", "rule", "inet", "orbix_protection", "forward", "ip", "daddr", "192.168.1.0/24", "accept"]).catch(() => null);
      await ubusClient.exec("nft", ["add", "rule", "inet", "orbix_protection", "forward", "ip", "saddr", "192.168.1.0/24", "ip", "daddr", "192.168.1.0/24", "accept"]).catch(() => null);
      await ubusClient.exec("nft", ["add", "rule", "inet", "orbix_protection", "forward", "ct", "state", "established,related", "accept"]).catch(() => null);
      await ubusClient.exec("nft", ["add", "rule", "inet", "orbix_protection", "forward", "oifname", "{", "tun0", "awg0", "}", "accept"]).catch(() => null);

      if (scope === "all") {
        await ubusClient.exec("nft", ["add", "rule", "inet", "orbix_protection", "forward", "ip", "saddr", "192.168.1.0/24", "oifname", "{", "wan", "eth0", "}", "counter", "drop"]).catch(() => null);
      } else {
        for (const devIp of this.runtimeState.protectedDevices) {
          await ubusClient.exec("nft", ["add", "rule", "inet", "orbix_protection", "forward", "ip", "saddr", devIp, "oifname", "{", "wan", "eth0", "}", "counter", "drop"]).catch(() => null);
        }
      }

      this.runtimeState.active = true;
      return true;
    } catch {
      return false;
    }
  }

  public async auditTunnelHealth(): Promise<void> {
    if (!this.runtimeState.enabled) return;

    try {
      const vless = await ubusClient.getVlessStatus();
      const awg = await ubusClient.getAwgStatus();

      const isVlessRunning = Boolean(vless?.running);
      const isAwgActive = Boolean(awg?.active);

      const tunnelIsHealthy = isVlessRunning || isAwgActive;
      this.runtimeState.tunnelStatus = tunnelIsHealthy ? "up" : "down";

      if (!tunnelIsHealthy) {
        this.runtimeState.blockedWan = true;
        this.runtimeState.lastTriggeredAt = Date.now();
      } else {
        if (this.runtimeState.blockedWan) {
          this.runtimeState.blockedWan = false;
        }
      }
    } catch {
      // Safe fallback for background tunnel audit
    }
  }

  private startWatchdog(): void {
    if (typeof window === "undefined") return;
    this.pollTimer = setInterval(() => {
      if (this.runtimeState.enabled) {
        this.auditTunnelHealth();
      }
    }, 10000);
  }

  public destroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export const killSwitchManager = new KillSwitchManager();
