import { UbusRpcRequest, UbusRpcResponse, SystemInfo, SystemBoard, NetworkInterfaceStatus, DhcpLease, WirelessDevice, AmneziaWgConfig, ZapretProfile, PbrRule, PodkopConfig, HappSubscriptionData, VlessNode, VlessStatusResponse, ZapretStatusResponse, ZapretOptionsResponse, KidStatusResponse, NodeBalancerStatusResponse, AwgStatusResponse } from "@/types/ubus";

class UbusClient {
  private endpoint = "/ubus";
  private sessionId = "00000000000000000000000000000000";
  private reqId = 1;
  private defaultTimeoutMs = 15000;
  private loginPromise: Promise<string> | null = null;
  private authExpiredDispatched = false;
  private lanPrefix: string | null = null;

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

  private handleAuthExpired(): void {
    this.sessionId = "00000000000000000000000000000000";
    if (typeof window !== "undefined") {
      localStorage.removeItem("openwrt_session_id");
      if (!this.authExpiredDispatched) {
        this.authExpiredDispatched = true;
        window.dispatchEvent(new CustomEvent("ubus_auth_expired"));
        setTimeout(() => {
          this.authExpiredDispatched = false;
        }, 1000);
      }
    }
  }

  private combineSignals(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
    if (typeof AbortSignal.any === "function") {
      return AbortSignal.any([signal1, signal2]);
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal1.addEventListener("abort", onAbort, { once: true });
    signal2.addEventListener("abort", onAbort, { once: true });
    return controller.signal;
  }

  public async call<T = unknown>(
    object: string,
    method: string,
    params: Record<string, unknown> = {},
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<T> {
    const payload: UbusRpcRequest = {
      jsonrpc: "2.0",
      id: this.reqId++,
      method: "call",
      params: [this.sessionId, object, method, params],
    };

    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = options?.signal ? this.combineSignals(options.signal, timeoutSignal) : timeoutSignal;

    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }

      let json: UbusRpcResponse<T>;
      try {
        json = await res.json();
      } catch (parseErr: unknown) {
        throw new Error(
          `Ubus JSON parse error: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
        );
      }

      if (json.error) {
        if (
          json.error.message === "Access denied" ||
          json.error.code === -32002 ||
          json.error.message?.toLowerCase().includes("permission denied")
        ) {
          this.handleAuthExpired();
          throw new Error("Access denied: session expired or unauthorized");
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
          this.handleAuthExpired();
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(`Ubus call returned error code: ${status}`);
      }

      return data as T;
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === "TimeoutError" || err.message?.includes("timed out"))) {
        console.warn(`Ubus call timed out after ${timeoutMs}ms for ${object}.${method}`);
        throw new Error(`Ubus call to ${object}.${method} timed out after ${timeoutMs}ms`);
      }
      console.warn(`Live ubus call failed for ${object}.${method}:`, err);
      throw err;
    }
  }

  public async login(username = "root", password = "", timeoutMs = 15000): Promise<string> {
    if (this.loginPromise) {
      return this.loginPromise;
    }

    this.loginPromise = (async () => {
      try {
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
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!res.ok) {
          throw new Error(`HTTP login error ${res.status}: ${res.statusText}`);
        }

        const json = await res.json();
        if (json.result && json.result[0] === 0 && json.result[1]?.ubus_rpc_session) {
          this.sessionId = json.result[1].ubus_rpc_session;
          this.authExpiredDispatched = false;
          if (typeof window !== "undefined") {
            localStorage.setItem("openwrt_session_id", this.sessionId);
          }
          return this.sessionId;
        }

        throw new Error("Invalid username or password");
      } finally {
        this.loginPromise = null;
      }
    })();

    return this.loginPromise;
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

  /** Same live `system board` telemetry, aliased for view naming. */
  public async getSystemBoard(): Promise<SystemBoard> {
    return this.getBoard();
  }

  public async getSystemInfo(): Promise<SystemInfo> {
    return this.call<SystemInfo>("system", "info");
  }

  public async restartInterface(name: string): Promise<{ success: boolean }> {
    // netifd only accepts well-formed logical interface names; reject anything else
    if (!/^[A-Za-z0-9_.@-]{1,30}$/.test(name)) {
      throw new Error(`Invalid interface name: ${name}`);
    }
    try {
      const res = await this.call<number>(`network.interface.${name}`, "restart");
      // netifd codes: 0=OK 2=INVALID_ARGUMENT 3=VALIDATION_FAILED 4=NOT_FOUND 9=OPERATION_NOT_SUPPORTED
      if (typeof res === "number" && res !== 0) {
        throw new Error(
          (res === 3 || res === 9)
            ? `netifd refused restart for '${name}' (code ${res}) — this interface or its protocol does not support restart`
            : `netifd refused restart for '${name}' (code ${res})`
        );
      }
      return { success: true };
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes("not found")) {
        throw new Error(`Interface '${name}' is not managed by netifd`);
      }
      if (msg.includes("Permission")) {
        throw new Error("Router refused: session lacks permission to restart interfaces");
      }
      throw err;
    }
  }

  public async getInterfaces(): Promise<NetworkInterfaceStatus[]> {
    try {
      const [resDump, resDevices] = await Promise.all([
        this.call<{ interface: NetworkInterfaceStatus[] }>("network.interface", "dump"),
        this.call<Record<string, { statistics?: { rx_bytes: number; tx_bytes: number; rx_packets?: number; tx_packets?: number }; macaddr?: string; speed?: number }>>("network.device", "status").catch(() => ({} as any)),
      ]);

      const ifaces = resDump.interface || [];
      if (resDevices) {
        for (const iface of ifaces) {
          const devName = iface.l3_device || iface.interface;
          const devStats = resDevices[devName] || resDevices[iface.interface] as any;
          if (devStats) {
            iface.data = iface.data || {};
            iface.data.macaddr = devStats.macaddr;
            iface.data.speed = devStats.speed;
            if (devStats.statistics) {
              iface.data.statistics = {
                rx_bytes: devStats.statistics.rx_bytes || 0,
                tx_bytes: devStats.statistics.tx_bytes || 0,
                rx_packets: devStats.statistics.rx_packets || 0,
                tx_packets: devStats.statistics.tx_packets || 0,
              };
            }
          }
        }
      }
      return ifaces;
    } catch {
      return [];
    }
  }

  // Discover the router's LAN subnet prefix (e.g. "192.168.0.") from UCI instead of
  // assuming 192.168.1.0/24 - wrong assumption hid every client on other subnets.
  private async getLanPrefix(): Promise<string> {
    if (this.lanPrefix) return this.lanPrefix;
    try {
      const res = await this.call<{ values: Record<string, any> }>("uci", "get", { config: "network" });
      const sections = res?.values || {};
      let lanIp = "";
      for (const [secName, vals] of Object.entries(sections)) {
        if (vals?.[".type"] === "interface" && (secName === "lan" || vals?.name === "lan") && vals?.ipaddr) {
          lanIp = String(vals.ipaddr).split("/")[0];
          break;
        }
      }
      if (lanIp) {
        const parts = lanIp.split(".");
        if (parts.length === 4) {
          this.lanPrefix = `${parts[0]}.${parts[1]}.${parts[2]}.`;
          return this.lanPrefix;
        }
      }
    } catch {}
    this.lanPrefix = "192.168.1.";
    return this.lanPrefix;
  }

  public async getDhcpLeases(): Promise<DhcpLease[]> {
    try {
      const [resLeases, resHints, lanPrefix] = await Promise.all([
        this.call<any>("luci-rpc", "getDHCPLeases").catch(() => ({})),
        this.call<Record<string, { name?: string; ipaddrs?: string[] }>>("luci-rpc", "getHostHints").catch(() => ({} as Record<string, { name?: string; ipaddrs?: string[] }>)),
        this.getLanPrefix(),
      ]);
      const routerIp = `${lanPrefix}1`;

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
          if (ip && !seenIps.has(ip) && ip.startsWith(lanPrefix) && ip !== routerIp) {
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
              if (ip && mac && mac !== "00:00:00:00:00:00" && !seenIps.has(ip) && ip.startsWith(lanPrefix) && ip !== routerIp) {
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
    } catch {
      return [];
    }
  }

  public async getWirelessDevices(): Promise<Record<string, WirelessDevice>> {
    // LuCI Independence & Accurate Keys: Fetch UCI wireless config in parallel
    let uciWirelessValues: Record<string, any> = {};
    try {
      const uciRes = await this.call<{ values: Record<string, any> }>("uci", "get", { config: "wireless" });
      uciWirelessValues = uciRes?.values || {};
    } catch {}

    const resolveKey = (radioName: string, ifaceSection?: string) => {
      if (ifaceSection && uciWirelessValues[ifaceSection]?.key) {
        return uciWirelessValues[ifaceSection].key;
      }
      for (const val of Object.values(uciWirelessValues)) {
        if (val[".type"] === "wifi-iface" && (val.device === radioName || !radioName)) {
          if (val.key) return val.key;
        }
      }
      return "";
    };

    try {
      const res = await this.call<Record<string, WirelessDevice>>("luci-rpc", "getWirelessDevices");
      if (res && Object.keys(res).length > 0) {
        // Enrich with keys from UCI
        for (const [radioName, rDev] of Object.entries(res)) {
          if (rDev.interfaces) {
            for (const iface of rDev.interfaces) {
              if (!iface.key) {
                iface.key = resolveKey(radioName, iface.section);
              }
            }
          }
        }
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
            key: i.config?.key || resolveKey(radioName, i.section) || "",
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
    } catch (firstErr) {
      try {
        await this.call("network.wireless", "reconf", { device: "radio0" });
        await this.call("network.wireless", "reconf", { device: "radio1" });
      } catch {
        throw firstErr;
      }
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

  public async getAwgStatus(): Promise<AwgStatusResponse> {
    try {
      return await this.call<AwgStatusResponse>("circumvention", "awg_status", {});
    } catch {
      return {
        enabled: false,
        configured: false,
        active: false,
        name: "awg0",
        addresses: [],
        dns: [],
        peers: [],
      };
    }
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

  public async getZapretStatus(): Promise<ZapretStatusResponse> {
    try {
      const res = await this.call<any>("circumvention", "zapret_status", {});
      return {
        running: Boolean(res.running),
        enabled: Boolean(res.enabled),
        installed: res.installed === undefined ? undefined : Boolean(res.installed),
        fwtype: res.fwtype || "nftables",
        mode_filter: res.mode_filter,
        ports_tcp: res.ports_tcp,
        ports_udp: res.ports_udp,
        profiles: res.profiles || [],
      };
    } catch {
      return { running: false, enabled: false, fwtype: "nftables", profiles: [] };
    }
  }

  public async getPodkopConfig(): Promise<PodkopConfig> {
    return this.call<PodkopConfig>("circumvention", "podkop_status", {});
  }

  public async podkopUpdate(): Promise<{ status: string; exit_code?: number; output?: string; message?: string }> {
    return this.call("circumvention", "podkop_update", {});
  }

  public async testZapretStrategy(domain: string): Promise<{
    status: string;
    verified: boolean;
    target: string;
    http_code?: number;
    connect_time_ms?: number;
    tls_handshake_ms?: number;
    total_time_ms?: number;
    message?: string;
  }> {
    return this.call("circumvention", "zapret_test_strategy", { domain });
  }

  // ---------- zapret live configuration (real UCI read/write + restart on the router) ----------
  public async getZapretOptions(): Promise<ZapretOptionsResponse> {
    const res = await this.call<any>("circumvention", "zapret_get_options", {});
    if (res && res.status === "error") throw new Error(res.message || "zapret_get_options failed");
    return {
      installed: Boolean(res.installed),
      running: Boolean(res.running),
      nfqws_enable: Boolean(res.nfqws_enable),
      ports_tcp: res.ports_tcp || "",
      ports_udp: res.ports_udp || "",
      mode_filter: res.mode_filter || "hostlist",
      run_on_boot: res.run_on_boot || "0",
      fwtype: res.fwtype || "",
      nfqws_opt: res.nfqws_opt || "",
      list_files: res.list_files || [],
      backups: res.backups || [],
    };
  }

  public async setZapretOptions(opts: {
    nfqws_enable?: string;
    ports_tcp?: string;
    ports_udp?: string;
    mode_filter?: string;
    run_on_boot?: string;
    nfqws_opt?: string;
    restart?: number;
  }): Promise<{ status: string; committed?: boolean; verified?: boolean; restart_started?: boolean; message?: string }> {
    const res = await this.call<any>("circumvention", "zapret_set_options", opts);
    if (res && res.status === "error") throw new Error(res.message || "zapret_set_options failed");
    return res;
  }

  // Chunked upload so big domain lists pass under the ubus message-size limit.
  public async uploadZapretList(name: string, content: string): Promise<{ name: string; bytes: number }> {
    const bytes = new TextEncoder().encode(content);
    const CHUNK = 16384;
    let last = false;
    let result: { name: string; bytes: number } | null = null;
    for (let off = 0; off < bytes.length || off === 0; off += CHUNK) {
      const slice = bytes.subarray(off, off + CHUNK);
      let bin = "";
      for (let i = 0; i < slice.length; i++) bin += String.fromCharCode(slice[i]);
      const b64 = btoa(bin);
      last = off + CHUNK >= bytes.length;
      const res = await this.call<any>("circumvention", "zapret_import_chunk", { file: name, b64, last: last ? 1 : 0 });
      if (res && res.status === "error") throw new Error(res.message || "zapret_import_chunk failed");
      result = { name: res.name, bytes: res.bytes };
      if (last) break;
    }
    return result as { name: string; bytes: number };
  }

  public async importZapretProfile(payload: {
    name: string;
    nfqws_opt: string;
    ports_tcp?: string;
    ports_udp?: string;
    mode: "replace" | "append";
    files?: string[];
    restart?: number;
  }): Promise<{ status: string; written?: string[]; committed?: boolean; restart_started?: boolean; message?: string }> {
    const res = await this.call<any>("circumvention", "zapret_import_profile", payload);
    if (res && res.status === "error") throw new Error(res.message || "zapret_import_profile failed");
    return res;
  }

  public async restoreZapretBackup(file: string): Promise<{ status: string; restored?: boolean; message?: string }> {
    const res = await this.call<any>("circumvention", "zapret_restore_backup", { file });
    if (res && res.status === "error") throw new Error(res.message || "zapret_restore_backup failed");
    return res;
  }

  // --- fw4 flow offloading fix for zapret (ported from Zapret-Manager) ---
  public async getZapretFlowoff(): Promise<{
    status: string;
    zapret_installed: number;
    fw4_tpl: number;
    offload: "none" | "sw" | "hw";
    fix_applied: number;
    fix_needed: number;
  }> {
    return this.call("circumvention", "zapret_flowoff_status", {});
  }

  public async setZapretFlowoffFix(enable: boolean): Promise<{ status: string; fix_applied: number; offload: string; message: string }> {
    const res = await this.call<any>("circumvention", "zapret_flowoff_fix", { enable });
    if (res && res.status === "error") throw new Error(res.message || "zapret_flowoff_fix failed");
    return res;
  }

  // --- NFQWS ports sync with the active strategy ---
  public async syncZapretPorts(): Promise<{
    status: string;
    changed: number;
    ports_tcp: string;
    ports_udp: string;
    required_tcp: string;
    required_udp: string;
    message: string;
  }> {
    const res = await this.call<any>("circumvention", "zapret_ports_sync", {});
    if (res && res.status === "error") throw new Error(res.message || "zapret_ports_sync failed");
    return res;
  }

  // --- strategy auto-test loop (ported from Zapret-Manager test module) ---
  public async startZapretAutoTest(applyBest: boolean): Promise<{ status: string; started: number; message: string }> {
    const res = await this.call<any>("circumvention", "zapret_auto_test", { apply_best: applyBest });
    if (res && res.status === "error") throw new Error(res.message || "zapret_auto_test failed");
    return res;
  }

  public async getZapretAutoStatus(): Promise<{
    status: string;
    running: number;
    recovered: number;
    cur: string;
    idx: number;
    total: number;
    best: string;
    results: { name: string; ok: number; total: number; ts: string }[];
    log: string;
  }> {
    return this.call("circumvention", "zapret_auto_status", {});
  }

  public async stopZapretAutoTest(): Promise<{ status: string; message: string }> {
    const res = await this.call<any>("circumvention", "zaptest_stop", {});
    if (res && res.status === "error") throw new Error(res.message || "zaptest_stop failed");
    return res;
  }

  // --- services watchdog (cron sweep, Zapret-Manager zm_watch pattern) ---
  public async getWatchdogStatus(): Promise<{
    status: string;
    installed: number;
    enabled: number;
    spec: string;
    state: string;
    log: string;
  }> {
    return this.call("circumvention", "watchdog_status", {});
  }

  public async setWatchdog(opts: { enable?: boolean; interval_min?: number; run_now?: boolean }): Promise<{
    status: string;
    enabled: number;
    spec: string;
    message?: string;
  }> {
    const res = await this.call<any>("circumvention", "watchdog_set", opts);
    if (res && res.status === "error") throw new Error(res.message || "watchdog_set failed");
    return res;
  }

  // --- Unified three-tier routing engine (direct / zapret / proxy) ---
  public async getTiersStatus(): Promise<{
    status: string;
    nft_installed: number;
    nft_live: number;
    routes_installed: number;
    dns_hook: number;
    cron: number;
    config_version: string;
    active_name: string;
    active_server: string;
    active_port: string;
    active_protocol: string;
    active_latency_ms: string;
    active_updated: string;
    node_count: number;
    node_servers: string;
    singbox_running: number;
    nfqws_running: number;
  }> {
    return this.call("circumvention", "tiers_status", {});
  }

  public async getTiersConfig(): Promise<{ status: string; config: string; nft: string }> {
    return this.call("circumvention", "tiers_get", {});
  }

  private async tierStage(part: string, payload: string): Promise<void> {
    const bytes = new TextEncoder().encode(payload);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    const size = 6000;
    let seq = 0;
    for (let i = 0; i < b64.length; i += size) {
      const res = await this.call<any>("circumvention", "tiers_stage", {
        part,
        seq,
        chunk: b64.slice(i, i + size),
        final: i + size >= b64.length ? 1 : 0,
      });
      if (res && res.status === "error") throw new Error(res.message || `tiers_stage ${part} failed`);
      seq += 1;
    }
  }

  /** Stage all artifacts then commit atomically on router (nft -c / sh -n validated there).
   * tierConfigJson = TierConfig itself; router regenerates /etc/sing-box/config.json from it. */
  public async tiersDeploy(artifacts: { nft: string; dnsmasq: string; iproute: string; tierConfigJson: string }): Promise<{
    status: string; nft_applied: number; route_applied: number; dns_hook_applied: number; singbox_applied: number; backup: string; message: string;
  }> {
    await this.tierStage("nft", artifacts.nft);
    await this.tierStage("dnsmasq", artifacts.dnsmasq);
    await this.tierStage("routes", artifacts.iproute);
    await this.tierStage("config", artifacts.tierConfigJson);
    const res = await this.call<any>("circumvention", "tiers_commit", {});
    if (res && res.status === "error") throw new Error(res.message || "tiers_commit failed");
    return res;
  }

  public async tiersDisable(): Promise<{ status: string; message: string }> {
    const res = await this.call<any>("circumvention", "tiers_disable", {});
    if (res && res.status === "error") throw new Error(res.message || "tiers_disable failed");
    return res;
  }

  public async awgGenkey(): Promise<{ status: string; private_key: string; public_key: string }> {
    return this.call("circumvention", "awg_genkey", {});
  }

  public async getPbrRules(): Promise<PbrRule[]> {
    const res = await this.call<any>("circumvention", "pbr_status", {});
    return res.rules || (Array.isArray(res) ? res : []);
  }

  /** Live PBR state as reported by rpcd `circumvention pbr_status`. */
  public async getPbrStatus(): Promise<{ enabled: boolean; policies: PbrRule[]; rules: PbrRule[] }> {
    const res = await this.call<any>("circumvention", "pbr_status", {});
    const rules: PbrRule[] = res?.rules || (Array.isArray(res) ? res : []);
    return { enabled: Boolean(res?.enabled), rules, policies: rules };
  }

  // Real domain-policy CRUD: writes /etc/config/pbr, commits and reloads the service server-side
  public async upsertPbrRule(rule: {
    id?: string;
    name: string;
    enabled?: boolean;
    interface: string;
    src_addr?: string;
    dest_addr?: string;
    proto?: string;
  }): Promise<{ status: string; section: string; applied: boolean; reload_code: number; reload_output?: string }> {
    return this.call("circumvention", "pbr_rule_upsert", rule);
  }

  public async deletePbrRule(id: string): Promise<{ status: string; applied: boolean; reload_code: number }> {
    return this.call("circumvention", "pbr_rule_delete", { id });
  }

  public async getVlessNodes(): Promise<VlessNode[]> {
    const res = await this.call<any>("circumvention", "vless_status", {});
    return res.nodes || (Array.isArray(res) ? res : []);
  }

  public async getVlessStatus(): Promise<VlessStatusResponse> {
    try {
      const res = await this.call<any>("circumvention", "vless_status", {});
      const nodes: VlessNode[] = res.nodes || (Array.isArray(res) ? res : []);
      const activeNode = nodes.find((n) => n.active) || nodes[0];
      return {
        running: Boolean(res.running),
        nodes,
        activeNode,
      };
    } catch {
      return { running: false, nodes: [] };
    }
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
      api_key: apiKey || "",
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
  // NOTE: stock rpcd's `file` object has NO exec method; use our whitelisted runner.
  public async exec(
    command: string,
    params: string[] = []
  ): Promise<{ code: number; stdout?: string; stderr?: string }> {
    return this.call<{ code: number; stdout?: string; stderr?: string }>("circumvention", "run_cmd", {
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
    const res = await this.call<{ status: string }>("circumvention", "confirm_rollback", {
      token: token || "",
    });
    // Also confirm native OpenWrt UCI rollback session if armed
    await this.call("uci", "confirm", {}).catch(() => {});
    return res;
  }

  public async cancelRollback(): Promise<{ status: string }> {
    return this.call<{ status: string }>("circumvention", "cancel_rollback", {});
  }

  // Policy Engine Backend Synchronization
  public async applyPolicyBackend(payload: {
    blocked_domains: string[];
    direct_domains: string[];
    proxy_domains: string[];
    policies?: any[];
  }): Promise<{ status: string; blocked_count: number }> {
    return this.call<{ status: string; blocked_count: number }>("circumvention", "policy_apply", payload);
  }

  public async getPolicyBackendStatus(): Promise<{
    active: boolean;
    blocked_domains: string[];
    direct_domains: string[];
    proxy_domains: string[];
    rules_count: number;
    updated_at: number;
  }> {
    return this.call("circumvention", "policy_status", {});
  }

  // Kid (child-friendly) controls — real enforcement on router (nft + dnsmasq)
  public async getKidStatus(): Promise<KidStatusResponse> {
    return this.call<KidStatusResponse>("circumvention", "kid_status", {});
  }

  public async kidSetMaster(on: boolean): Promise<KidStatusResponse> {
    return this.call<KidStatusResponse>("circumvention", "kid_set_master", { on: on ? 1 : 0 });
  }

  public async kidSetDevice(mac: string, on: boolean, name?: string): Promise<KidStatusResponse> {
    return this.call<KidStatusResponse>("circumvention", "kid_set_device", { mac, on: on ? 1 : 0, name: name || "" });
  }

  public async kidSetBlock(category: string, on: boolean): Promise<KidStatusResponse> {
    return this.call<KidStatusResponse>("circumvention", "kid_set_block", { category, on: on ? 1 : 0 });
  }

  public async kidSetBedtime(on: boolean, start: string, end: string): Promise<KidStatusResponse> {
    return this.call<KidStatusResponse>("circumvention", "kid_set_bedtime", { on: on ? 1 : 0, start, end });
  }

  // Subscription refresh on router (parses provider link, replaces node list atomically)
  public async subRefresh(): Promise<{ status: string; nodes?: number; skipped_non_vless?: number; message?: string }> {
    return this.call<{ status: string; nodes?: number; skipped_non_vless?: number; message?: string }>("circumvention", "sub_refresh", {});
  }

  public async subSetSource(url: string, apiKey?: string): Promise<{ status: string }> {
    return this.call<{ status: string }>("circumvention", "sub_set_source", { url, api_key: apiKey || "" });
  }

  // Node balancer — real throughput probes + auto-failover on router (panel-node-balancer)
  public async getNodeBalancerStatus(): Promise<NodeBalancerStatusResponse> {
    return this.call<NodeBalancerStatusResponse>("circumvention", "node_balancer_status", {});
  }

  public async nodeBalancerRun(): Promise<{ status: string; message?: string }> {
    return this.call<{ status: string; message?: string }>("circumvention", "node_balancer_run", {});
  }

}

export const ubusClient = new UbusClient();
