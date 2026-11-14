import { create } from "zustand";
import { ubusClient } from "@/lib/ubus-client";
import { DeviceRoutingRule, DhcpLease, PbrRule } from "@/types/ubus";

if (typeof window !== "undefined") {
  // Purge any stale mock devices stored in browser localStorage
  localStorage.removeItem("device-routing-storage");
}

interface DeviceRoutingState {
  devices: DeviceRoutingRule[];
  isLoading: boolean;
  error: string | null;

  fetchDevices: () => Promise<void>;
  setDeviceInterface: (
    ip: string,
    targetInterface: DeviceRoutingRule["interface"]
  ) => Promise<boolean>;
  toggleDevice: (ip: string) => Promise<boolean>;
}

export const useDeviceRoutingStore = create<DeviceRoutingState>((set, get) => ({
  devices: [],
  isLoading: false,
  error: null,

  fetchDevices: async () => {
    set({ isLoading: true });
    try {
      // Fetch live DHCP leases and live PBR rules simultaneously
      const [leases, pbrRules]: [DhcpLease[], PbrRule[]] = await Promise.all([
        ubusClient.getDhcpLeases().catch(() => []),
        ubusClient.getPbrRules().catch(() => []),
      ]);

      // Map PBR policies by source IP
      const pbrMap: Record<string, PbrRule> = {};
      for (const rule of pbrRules) {
        if (rule.src_addr) {
          const ips = rule.src_addr.split(/\s+/);
          for (const ip of ips) {
            pbrMap[ip] = rule;
          }
        }
      }

      const seenIps = new Set<string>();

      // 1. Build devices from real DHCP leases
      const realDevices: DeviceRoutingRule[] = leases.map((l) => {
        seenIps.add(l.ipaddr);
        const pbr = pbrMap[l.ipaddr];
        const iface = (pbr?.interface || "default") as DeviceRoutingRule["interface"];
        const enabled = pbr?.enabled !== undefined ? pbr.enabled : true;

        return {
          ip: l.ipaddr,
          mac: l.macaddr,
          name: l.hostname && l.hostname !== "*" ? l.hostname : `Device ${l.ipaddr.split(".").pop()}`,
          interface: iface,
          enabled: enabled,
          online: true,
        };
      });

      // 2. Add any active PBR rules whose devices might not currently have a DHCP lease
      for (const rule of pbrRules) {
        if (rule.src_addr && !rule.src_addr.includes("/")) {
          const ip = rule.src_addr.trim();
          if (ip.startsWith("192.168.1.") && !seenIps.has(ip)) {
            seenIps.add(ip);
            realDevices.push({
              ip,
              mac: "",
              name: rule.name || `Client ${ip.split(".").pop()}`,
              interface: (rule.interface || "default") as DeviceRoutingRule["interface"],
              enabled: rule.enabled !== undefined ? rule.enabled : true,
              online: false,
            });
          }
        }
      }

      set({ devices: realDevices, isLoading: false, error: null });
    } catch (e: any) {
      set({ isLoading: false, error: e?.message || "Failed to fetch devices" });
    }
  },

  setDeviceInterface: async (ip, targetInterface) => {
    const { devices } = get();
    const target = devices.find((d) => d.ip === ip);
    if (!target) return false;

    try {
      await ubusClient.setDeviceRoutingRule({
        ip: target.ip,
        mac: target.mac,
        name: target.name,
        interface: targetInterface,
        enabled: target.enabled,
      });

      set({
        devices: devices.map((d) =>
          d.ip === ip ? { ...d, interface: targetInterface } : d
        ),
      });
      return true;
    } catch (e: any) {
      set({ error: e?.message || "Failed to update device routing rule" });
      return false;
    }
  },

  toggleDevice: async (ip) => {
    const { devices } = get();
    const target = devices.find((d) => d.ip === ip);
    if (!target) return false;

    const nextEnabled = !target.enabled;
    try {
      await ubusClient.setDeviceRoutingRule({
        ip: target.ip,
        mac: target.mac,
        name: target.name,
        interface: target.interface,
        enabled: nextEnabled,
      });

      set({
        devices: devices.map((d) =>
          d.ip === ip ? { ...d, enabled: nextEnabled } : d
        ),
      });
      return true;
    } catch (e: any) {
      set({ error: e?.message || "Failed to toggle device routing" });
      return false;
    }
  },
}));
