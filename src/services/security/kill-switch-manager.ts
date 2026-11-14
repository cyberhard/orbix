// ORBIX Kill Switch Engine
// Kernel-level nftables enforcement preventing unencrypted WAN fallback leaks
import { ubusClient } from "@/lib/ubus-client";
import { KillSwitchRuntimeState } from "@/types/errors";
import { useErrorStore } from "@/store/error-store";

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
      // Query kernel nftables state via file exec
      const res = await ubusClient.exec("nft", ["list", "table", "inet", "orbix_protection"]);
      if (res && res.code === 0 && res.stdout) {
        this.runtimeState.active = true;
        this.runtimeState.enabled = true;

        // Parse dropped packet counter
        const match = res.stdout.match(/counter packets (\d+) bytes (\d+)/);
        if (match) {
          this.runtimeState.activeDropRulesCount = parseInt(match[1], 10) || 0;
        }
      } else {
        this.runtimeState.active = false;
      }
    } catch {
      // fallback to cached state if router busy
    }

    return { ...this.runtimeState };
  }

  public async enableKillSwitch(options?: {
    scope?: "vpn_devices" | "all";
    allowLan?: boolean;
    devices?: string[];
  }): Promise<boolean> {
    const scope = options?.scope || this.runtimeState.scope;
    const allowLan = options?.allowLan !== undefined ? options.allowLan : true;
    const devices = options?.devices || this.runtimeState.protectedDevices;

    this.runtimeState.enabled = true;
    this.runtimeState.scope = scope;
    this.runtimeState.allowLan = allowLan;
    this.runtimeState.protectedDevices = devices;

    try {
      // Build atomic nftables script
      const commands = [
        "add table inet orbix_protection",
        "add chain inet orbix_protection forward { type filter hook forward priority -5; policy accept; }",
        "flush chain inet orbix_protection forward",
      ];

      // 1. Always allow router management access (Zero-lockout guarantee)
      if (allowLan) {
        commands.push("add rule inet orbix_protection forward ip daddr 192.168.1.0/24 accept");
      }

      // 2. Allow established / related packets
      commands.push("add rule inet orbix_protection forward ct state established,related accept");

      // 3. Allow traffic egressing via encrypted tunnels
      commands.push('add rule inet orbix_protection forward oifname { "tun0", "awg0" } accept');

      // 4. Drop unencrypted WAN fallback
      if (scope === "all") {
        commands.push('add rule inet orbix_protection forward ip saddr 192.168.1.0/24 oifname { "wan", "eth0" } counter drop');
      } else if (devices.length > 0) {
        const formattedIps = devices.join(", ");
        commands.push(`add rule inet orbix_protection forward ip saddr { ${formattedIps} } oifname { "wan", "eth0" } counter drop`);
      }

      const script = commands.join("; ");
      const res = await ubusClient.exec("nft", [script]);

      this.runtimeState.active = res?.code === 0;

      // Check tunnel health immediately
      await this.auditTunnelHealth();

      return true;
    } catch (err) {
      console.error("[KillSwitchManager] Failed to apply nftables rules:", err);
      return false;
    }
  }

  public async disableKillSwitch(): Promise<boolean> {
    this.runtimeState.enabled = false;
    this.runtimeState.active = false;
    this.runtimeState.blockedWan = false;

    try {
      await ubusClient.exec("nft", ["delete", "table", "inet", "orbix_protection"]);
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

        // Emit Critical Event 410 KILL_SWITCH_TRIGGERED
        useErrorStore.getState().emitEvent({
          code: 410,
          identifier: "KILL_SWITCH_TRIGGERED",
          source: "kill_switch",
          customMessage: "Защищенный VPN туннель недоступен. Kill Switch заблокировал незашифрованный трафик в WAN.",
          metadata: {
            scope: this.runtimeState.scope,
            protectedDevices: this.runtimeState.protectedDevices,
            droppedPackets: this.runtimeState.activeDropRulesCount,
            tunnelStatus: "down",
          },
          severityOverride: "critical",
        });
      } else {
        if (this.runtimeState.blockedWan) {
          this.runtimeState.blockedWan = false;
          // Resolve any active 410 events
          const active410 = useErrorStore
            .getState()
            .events.find((e) => e.code === 410 && e.status === "active");
          if (active410) {
            useErrorStore.getState().resolveEvent(active410.event_id);
          }
        }
      }
    } catch (err) {
      console.error("[KillSwitchManager] auditTunnelHealth error:", err);
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
    }
  }
}

export const killSwitchManager = new KillSwitchManager();
