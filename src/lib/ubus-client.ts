import {
  UbusRpcRequest,
  UbusRpcResponse,
  SystemInfo,
  SystemBoard,
  NetworkInterfaceStatus,
  DhcpLease,
  WirelessDevice,
  AmneziaWgConfig,
  ZapretProfile,
  PbrRule,
  PodkopConfig,
  HappSubscriptionData,
  DeviceRoutingRule,
  VlessNode,
} from "@/types/ubus";

class UbusClient {
  private endpoint = "/ubus";
  private sessionId = "00000000000000000000000000000000";
  private reqId = 1;

  constructor() {
    if (typeof window !== "undefined") {
      // Purge any leftover mock flags from older builds
      localStorage.removeItem("openwrt_mock_mode");
      const savedSession = localStorage.getItem("openwrt_session_id");
      if (savedSession) {
        this.sessionId = savedSession;
      }
    }
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public isAuthenticated(): boolean {
    if (typeof window !== "undefined") {
      const savedSession = localStorage.getItem("openwrt_session_id");
      if (savedSession && this.sessionId === "00000000000000000000000000000000") {
        this.sessionId = savedSession;
      }
    }
    return this.sessionId !== "00000000000000000000000000000000" && !!this.sessionId;
  }

  public async call<T = unknown>(
    object: string,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const payload: UbusRpcRequest = {
      jsonrpc: "2.0",
      id: this.reqId++,
      method: "call",
      params: [this.sessionId, object, method, params],
    };

    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }

      const json: UbusRpcResponse<T> = await res.json();

      if (json.error) {
        if (json.error.message === "Access denied" || json.error.code === -32002) {
          this.sessionId = "00000000000000000000000000000000";
          if (typeof window !== "undefined") {
            localStorage.removeItem("openwrt_session_id");
            window.dispatchEvent(new CustomEvent("ubus_auth_expired"));
          }
        }
        throw new Error(json.error.message || `Ubus error ${json.error.code}`);
      }

      if (!json.result) {
        throw new Error("No result returned from ubus");
      }

      const [status, data] = json.result;
      if (status !== 0) {
        if (status === 6) {
          // UBUS_STATUS_PERMISSION_DENIED
          this.sessionId = "00000000000000000000000000000000";
          if (typeof window !== "undefined") {
            localStorage.removeItem("openwrt_session_id");
            window.dispatchEvent(new CustomEvent("ubus_auth_expired"));
          }
          throw new Error("Session expired or permission denied. Please log in again.");
        }
        throw new Error(`Ubus call returned error code: ${status}`);
      }

      return data as T;
    } catch (err: unknown) {
      console.warn(`Live ubus call failed for ${object}.${method}:`, err);
      throw err;
    }
  }

  public async login(username = "root", password = ""): Promise<string> {
    const payload: UbusRpcRequest = {
      jsonrpc: "2.0",
      id: this.reqId++,
      method: "call",
      params: ["00000000000000000000000000000000", "session", "login", { username, password, timeout: 86400 }],
    };

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (json.result && json.result[0] === 0 && json.result[1]?.ubus_rpc_session) {
      this.sessionId = json.result[1].ubus_rpc_session;
      if (typeof window !== "undefined") {
        localStorage.setItem("openwrt_session_id", this.sessionId);
      }
      return this.sessionId;
    }

    throw new Error("Invalid username or password");
  }

  public logout() {
    if (this.sessionId !== "00000000000000000000000000000000") {
      this.call("session", "destroy", {}).catch(() => {});
    }
    this.sessionId = "00000000000000000000000000000000";
    if (typeof window !== "undefined") {
      localStorage.removeItem("openwrt_session_id");
    }
  }

  // Common high-level API methods
  public async getBoard(): Promise<SystemBoard> {
    return this.call<SystemBoard>("system", "board");
  }

  public async getSystemInfo(): Promise<SystemInfo> {
    return this.call<SystemInfo>("system", "info");
  }

  public async getInterfaces(): Promise<NetworkInterfaceStatus[]> {
    try {
      const [resDump, resDevices] = await Promise.all([
        this.call<{ interface: NetworkInterfaceStatus[] }>("network.interface", "dump"),
        this.call<Record<string, { statistics?: { rx_bytes: number; tx_bytes: number; rx_packets?: number; tx_packets?: number } }>>("network.device", "status").catch(() => ({} as any)),
      ]);

      const ifaces = resDump.interface || [];
      if (resDevices) {
        for (const iface of ifaces) {
          const devName = iface.l3_device || iface.device;
          const devStats = resDevices[devName] || resDevices[iface.interface];
          if (devStats?.statistics) {
            if (!iface.data) iface.data = {} as any;
            iface.data.statistics = {
              rx_bytes: devStats.statistics.rx_bytes || 0,
              tx_bytes: devStats.statistics.tx_bytes || 0,
              rx_packets: devStats.statistics.rx_packets || 0,
              tx_packets: devStats.statistics.tx_packets || 0,
            };
          }
        }
      }
      return ifaces;
    } catch (e) {
      console.error("Failed to query live interfaces:", e);
      throw e;
    }
  }

  public async getDhcpLeases(): Promise<DhcpLease[]> {
    try {
      const [resLeases, resHints] = await Promise.all([
        this.call<any>("luci-rpc", "getDHCPLeases").catch(() => ({})),
        this.call<Record<string, { name?: string; ipaddrs?: string[] }>>("luci-rpc", "getHostHints").catch(() => ({})),
      ]);

      const leases: DhcpLease[] = [];
      let leaseList = resLeases.dhcp_leases || resLeases.leases || [];
      const seenIps = new Set<string>();

      // LuCI Independence: Fallback to reading /tmp/dhcp.leases natively if luci-rpc is not installed
      if (!Array.isArray(leaseList) || leaseList.length === 0) {
        try {
          const fileRes = await this.call<{ data: string }>("file", "read", { path: "/tmp/dhcp.leases" });
          if (fileRes?.data) {
            leaseList = fileRes.data
              .trim()
              .split("\n")
              .filter(Boolean)
              .map((line) => {
                const parts = line.split(" ");
                return {
                  expires: parseInt(parts[0], 10) || 43200,
                  mac: parts[1],
                  ip: parts[2],
                  hostname: parts[3],
                };
              });
          }
        } catch {}
      }

      if (Array.isArray(leaseList)) {
        for (const l of leaseList) {
          const ip = l.ipaddr || l.ip;
          const mac = (l.macaddr || l.mac || "").toUpperCase();
          if (!ip) continue;
          seenIps.add(ip);

          const hintName = resHints?.[mac]?.name?.replace(/\.lan$/, "");
          leases.push({
            expires: l.expires || 43200,
            macaddr: mac,
            ipaddr: ip,
            hostname: l.hostname && l.hostname !== "*" ? l.hostname : (hintName || `Device-${ip.split(".").pop()}`),
          });
        }
      }

      // Add active host hints that might not have a dynamic lease (static IP or ARP)
      if (resHints && Object.keys(resHints).length > 0) {
        for (const [macUpper, hint] of Object.entries(resHints)) {
          const ip = hint.ipaddrs?.[0];
          if (ip && !seenIps.has(ip) && ip.startsWith("192.168.1.") && ip !== "192.168.1.1") {
            seenIps.add(ip);
            leases.push({
              expires: 43200,
              macaddr: macUpper,
              ipaddr: ip,
              hostname: hint.name ? hint.name.replace(/\.lan$/, "") : `Device-${ip.split(".").pop()}`,
            });
          }
        }
      } else {
        // Fallback: Read /proc/net/arp directly from kernel without LuCI
        try {
          const arpRes = await this.call<{ data: string }>("file", "read", { path: "/proc/net/arp" });
          if (arpRes?.data) {
            const lines = arpRes.data.trim().split("\n").slice(1);
            for (const line of lines) {
              const parts = line.split(/\s+/);
              const ip = parts[0];
              const mac = (parts[3] || "").toUpperCase();
              if (ip && mac && mac !== "00:00:00:00:00:00" && !seenIps.has(ip) && ip.startsWith("192.168.1.") && ip !== "192.168.1.1") {
                seenIps.add(ip);
                leases.push({
                  expires: 43200,
                  macaddr: mac,
                  ipaddr: ip,
                  hostname: `Device-${ip.split(".").pop()}`,
                });
              }
            }
          }
        } catch {}
      }

      return leases;
    } catch (e) {
      console.error("Failed to get live leases:", e);
      return [];
    }
  }

  public async getWirelessDevices(): Promise<Record<string, WirelessDevice>> {
    try {
      const res = await this.call<Record<string, WirelessDevice>>("luci-rpc", "getWirelessDevices");
      if (res && Object.keys(res).length > 0) {
        return res;
      }
    } catch {}

    // LuCI Independence: Fallback to native netifd `network.wireless status`
    try {
      const netWireless = await this.call<Record<string, any>>("network.wireless", "status");
      const result: Record<string, WirelessDevice> = {};

      for (const [radioName, radioData] of Object.entries(netWireless || {})) {
        const config = radioData.config || {};
        const ifaces = radioData.interfaces || [];
        const band: "2g" | "5g" | "6g" = config.band === "5g" ? "5g" : config.band === "6g" ? "6g" : "2g";

        result[radioName] = {
          name: radioName,
          up: Boolean(radioData.up),
          disabled: Boolean(radioData.disabled),
          channel: parseInt(config.channel, 10) || (band === "5g" ? 36 : 1),
          band,
          interfaces: ifaces.map((i: any) => ({
            ifname: i.ifname || `${radioName}-ap`,
            section: i.section || "",
            ssid: i.config?.ssid || "OpenWRT",
            bssid: "",
            mode: i.config?.mode || "ap",
            encryption: i.config?.encryption || "none",
            channel: parseInt(config.channel, 10) || 1,
          })),
        };
      }
      return result;
    } catch {
      return {};
    }
  }

  public async reloadWifi(): Promise<void> {
    try {
      await this.call("circumvention", "wifi_reload", {});
    } catch {
      try {
        await this.call("network.wireless", "reconf", { device: "radio0" });
        await this.call("network.wireless", "reconf", { device: "radio1" });
      } catch {}
    }
  }

  public async scanWifi(device = "phy0.0-ap0"): Promise<any[]> {
    try {
      const res = await this.call<{ results: any[] }>("iwinfo", "scan", { device });
      return res.results || [];
    } catch {
      return [];
    }
  }

  public async saveWifiRadio(
    radioName: string,
    ifaceSection: string,
    config: {
      channel?: string | number;
      htmode?: string;
      disabled?: boolean;
      ssid?: string;
      key?: string;
      encryption?: string;
    }
  ): Promise<void> {
    if (config.channel !== undefined || config.htmode !== undefined) {
      const radioVals: Record<string, unknown> = {};
      if (config.channel !== undefined) radioVals.channel = String(config.channel);
      if (config.htmode !== undefined) radioVals.htmode = config.htmode;
      await this.setUci("wireless", radioName, radioVals);
    }

    if (ifaceSection) {
      const ifaceVals: Record<string, unknown> = {};
      if (config.ssid !== undefined) ifaceVals.ssid = config.ssid;
      if (config.key !== undefined) ifaceVals.key = config.key;
      if (config.encryption !== undefined) ifaceVals.encryption = config.encryption;
      if (config.disabled !== undefined) ifaceVals.disabled = config.disabled ? "1" : "0";
      await this.setUci("wireless", ifaceSection, ifaceVals);
    }

    await this.commitUci("wireless");
    await this.reloadWifi();
  }

  public async getUci<T = Record<string, unknown>>(config: string): Promise<{ values: T }> {
    return this.call<{ values: T }>("uci", "get", { config });
  }

  public async setUci(config: string, section: string, values: Record<string, unknown>): Promise<void> {
    await this.call("uci", "set", { config, section, values });
  }

  public async getUciChanges(): Promise<Record<string, unknown>> {
    return this.call<Record<string, unknown>>("uci", "changes", {});
  }

  public async commitUci(config?: string): Promise<void> {
    await this.call("uci", "commit", config ? { config } : {});
  }

  public async revertUci(config?: string): Promise<void> {
    await this.call("uci", "revert", config ? { config } : {});
  }

  public async applyUci(rollback = true, timeout = 30): Promise<void> {
    await this.call("uci", "apply", { rollback, timeout });
  }

  public async reboot(): Promise<void> {
    await this.call("system", "reboot", {});
  }

  public async getLog(lines = 100): Promise<{ log: string[] }> {
    return this.call<{ log: string[] }>("log", "read", { lines });
  }

  // Circumvention helper calls
  public async getAwgConfig(): Promise<AmneziaWgConfig> {
    return this.call<AmneziaWgConfig>("circumvention", "awg_status", {});
  }

  public async importAwgConf(conf: string, apply = true): Promise<{ status: string; message: string }> {
    return this.call<{ status: string; message: string }>("circumvention", "awg_import_conf", { conf, apply });
  }

  public async deleteAwgConfig(): Promise<{ status: string; message: string }> {
    return this.call<{ status: string; message: string }>("circumvention", "awg_delete", {});
  }

  public async getZapretProfiles(): Promise<ZapretProfile[]> {
    const res = await this.call<any>("circumvention", "zapret_status", {});
    return res.profiles || (Array.isArray(res) ? res : []);
  }

  public async getPodkopConfig(): Promise<PodkopConfig> {
    return this.call<PodkopConfig>("circumvention", "podkop_status", {});
  }

  public async getPbrRules(): Promise<PbrRule[]> {
    const res = await this.call<any>("circumvention", "pbr_status", {});
    return res.rules || (Array.isArray(res) ? res : []);
  }

  public async getVlessNodes(): Promise<VlessNode[]> {
    const res = await this.call<any>("circumvention", "vless_status", {});
    return res.nodes || (Array.isArray(res) ? res : []);
  }

  public async testNodeLatency(server: string, port: number): Promise<{ latency: number }> {
    return this.call<{ latency: number }>("circumvention", "singbox_test_node", { server, port });
  }

  public async traceRoute(target: string): Promise<{
    target: string;
    ip: string;
    rule: string;
    interface: string;
    nexthop?: string;
  }> {
    return this.call<{
      target: string;
      ip: string;
      rule: string;
      interface: string;
      nexthop?: string;
    }>("circumvention", "pbr_trace", { target });
  }

  // Happ Subscriptions & Happy Decoder API
  public async subDecryptFetch(url: string, apiKey?: string): Promise<{
    success?: boolean;
    data?: HappSubscriptionData;
    error?: string;
    raw?: string;
    servers?: any[];
    nodes?: VlessNode[];
    subscription?: any;
    profileTitle?: string;
    headers?: Record<string, any>;
    announce?: string;
  }> {
    return this.call<any>("circumvention", "sub_decrypt_fetch", {
      url,
      api_key: apiKey || "hd_889c9cc025a10885f358d1caefce6108",
      hwid: true,
    });
  }

  public async singboxSetOutbound(node: Record<string, unknown> | string): Promise<{ status: string }> {
    return this.call<{ status: string }>("circumvention", "singbox_set_outbound", {
      node: typeof node === "string" ? node : JSON.stringify(node),
    });
  }

  // Per-Device Policy-Based Routing
  public async setDeviceRoutingRule(rule: {
    ip: string;
    mac?: string;
    name?: string;
    interface: string;
    enabled?: boolean;
  }): Promise<{ status: string; ip: string; interface: string }> {
    return this.call<{ status: string; ip: string; interface: string }>(
      "circumvention",
      "pbr_set_device_rule",
      rule
    );
  }

  // File & Process Execution APIs
  public async exec(
    command: string,
    params: string[] = []
  ): Promise<{ code: number; stdout?: string; stderr?: string }> {
    return this.call<{ code: number; stdout?: string; stderr?: string }>("file", "exec", {
      command,
      params,
    });
  }

  public async readFile(path: string): Promise<string> {
    try {
      const res = await this.call<{ data?: string }>("file", "read", { path });
      return res.data || "";
    } catch (e: any) {
      if (e?.message?.includes("Not found") || e?.message?.includes("-32000")) {
        return "";
      }
      throw e;
    }
  }

  public async writeFile(path: string, data: string): Promise<void> {
    await this.call("file", "write", { path, data });
  }

  // System Services & Packages
  public async getPackages(): Promise<Record<string, string>> {
    try {
      const res = await this.call<{ packages: Record<string, string> }>("rpc-sys", "packagelist", { all: false });
      return res.packages || {};
    } catch {
      return {};
    }
  }

  public async getServices(): Promise<
    Record<string, { start?: number; stop?: number; enabled?: boolean; running?: boolean }>
  > {
    try {
      return await this.call<
        Record<string, { start?: number; stop?: number; enabled?: boolean; running?: boolean }>
      >("rc", "list", {});
    } catch {
      return {};
    }
  }

  public async initService(
    name: string,
    action: "start" | "stop" | "restart" | "enable" | "disable"
  ): Promise<any> {
    return this.call("rc", "init", { name, action });
  }

  public async setRootPassword(password: string): Promise<void> {
    await this.call("rpc-sys", "password_set", { user: "root", password });
  }

  // Safety Rollback Watchdog
  public async armRollback(timeout = 75): Promise<{ status: string; token: string; timeout: number }> {
    return this.call<{ status: string; token: string; timeout: number }>("circumvention", "arm_rollback", {
      timeout,
    });
  }

  public async confirmRollback(token?: string): Promise<{ status: string }> {
    return this.call<{ status: string }>("circumvention", "confirm_rollback", {
      token: token || "",
    });
  }

  public async cancelRollback(): Promise<{ status: string }> {
    return this.call<{ status: string }>("circumvention", "cancel_rollback", {});
  }
}

export const ubusClient = new UbusClient();
