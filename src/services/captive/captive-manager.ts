// ORBIX Captive Portal & Network Interception Subsystem Manager
import { ubusClient } from "@/lib/ubus-client";
import {
  CaptivePortalConfig,
  CaptivePortalStatus,
  CaptiveClient,
  DiagnosticCheck,
} from "@/types/captive";

export class CaptivePortalManager {
  /**
   * Sanitizes target hostname to prevent CRLF injection, open redirects, and XSS
   */
  public sanitizeHost(rawHost?: string | null): string {
    if (!rawHost) return "unknown";
    // Strip port, protocols, query strings and control characters
    const noProto = rawHost.replace(/^[a-zA-Z]+:\/\//, "");
    const hostOnly = noProto.split("/")[0].split(":")[0];
    const clean = hostOnly.replace(/[^a-zA-Z0-9.-]/g, "").slice(0, 128);
    return clean.toLowerCase() || "unknown";
  }

  /**
   * Validates if a target redirect URL is safe (anti-open-redirect safeguard)
   */
  public isSafeInternalPortalUrl(urlStr: string, portalDomain = "192.168.1.1"): boolean {
    if (!urlStr) return false;
    try {
      const parsed = new URL(urlStr, "http://192.168.1.1");
      const allowedHosts = new Set([
        "192.168.1.1",
        "192.168.1.2",
        "localhost",
        "127.0.0.1",
        "orbix.lan",
        "openwrt.lan",
        portalDomain.toLowerCase(),
      ]);
      return allowedHosts.has(parsed.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  /**
   * Fetches active configuration
   */
  public async getConfig(): Promise<CaptivePortalConfig> {
    try {
      const res = await ubusClient.getCaptiveConfig();
      return {
        enabled: res.enabled ?? true,
        mode: res.mode || "captive_portal",
        portal_domain: res.portal_domain || "orbix.lan",
        portal_ssl_port: res.portal_ssl_port || 443,
        http_intercept: res.http_intercept ?? true,
        rfc8908_enabled: res.rfc8908_enabled ?? true,
        dhcp_opt114: res.dhcp_opt114 ?? true,
        ra_opt103: res.ra_opt103 ?? true,
        session_timeout_sec: res.session_timeout_sec || 7200,
        exempt_ips: Array.isArray(res.exempt_ips) ? res.exempt_ips : [],
        exempt_macs: Array.isArray(res.exempt_macs) ? res.exempt_macs : [],
        cert_mode: res.cert_mode || "private_ca",
        acme_provider: res.acme_provider || "cloudflare",
        dns_provider: res.dns_provider || "cloudflare",
        updated_at: res.updated_at,
      };
    } catch {
      return {
        enabled: true,
        mode: "captive_portal",
        portal_domain: "orbix.lan",
        portal_ssl_port: 443,
        http_intercept: true,
        rfc8908_enabled: true,
        dhcp_opt114: true,
        ra_opt103: true,
        session_timeout_sec: 7200,
        exempt_ips: [],
        exempt_macs: [],
        cert_mode: "private_ca",
        acme_provider: "cloudflare",
      };
    }
  }

  /**
   * Saves updated configuration to router
   */
  public async saveConfig(cfg: Partial<CaptivePortalConfig>): Promise<{ success: boolean; message: string }> {
    try {
      const res = await ubusClient.setCaptiveConfig(cfg);
      if (res?.status === "ok") {
        return { success: true, message: "Captive Portal configuration updated and applied!" };
      }
      return { success: false, message: "Failed to apply configuration" };
    } catch (e: any) {
      return { success: false, message: e?.message || "Failed to update configuration" };
    }
  }

  /**
   * Fetches active runtime status
   */
  public async getStatus(): Promise<CaptivePortalStatus> {
    try {
      const res = await ubusClient.getCaptiveStatus();
      return {
        enabled: Boolean(res.enabled),
        mode: res.mode || "captive_portal",
        portal_domain: res.portal_domain || "orbix.lan",
        http_intercept_active: Boolean(res.http_intercept_active),
        rfc8908_active: Boolean(res.rfc8908_active),
        dhcp_opt114_active: Boolean(res.dhcp_opt114_active),
        cert_valid: Boolean(res.cert_valid),
        cert_expires_at: res.cert_expires_at || 0,
        cert_days_left: res.cert_days_left || 0,
        total_clients: res.total_clients || 0,
        active_restricted_clients: res.active_restricted_clients || 0,
      };
    } catch {
      return {
        enabled: false,
        mode: "captive_portal",
        portal_domain: "orbix.lan",
        http_intercept_active: false,
        rfc8908_active: false,
        dhcp_opt114_active: false,
        cert_valid: false,
        cert_expires_at: 0,
        cert_days_left: 0,
        total_clients: 0,
        active_restricted_clients: 0,
      };
    }
  }

  /**
   * Retrieves connected LAN clients and their captive states
   */
  public async getClients(): Promise<CaptiveClient[]> {
    try {
      const res = await ubusClient.getCaptiveClients();
      if (res?.clients && Array.isArray(res.clients)) {
        return res.clients;
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Toggles client exemption status
   */
  public async setClientExemption(ip: string, exempt: boolean): Promise<boolean> {
    try {
      const res = await ubusClient.setClientExemption(ip, exempt);
      return res?.status === "ok";
    } catch {
      return false;
    }
  }

  /**
   * Executes full network & captive diagnostics suite
   */
  public async runDiagnostics(): Promise<DiagnosticCheck[]> {
    try {
      const res = await ubusClient.runCaptiveDiagnostics();
      if (res?.checks && Array.isArray(res.checks)) {
        return res.checks;
      }
      return [];
    } catch {
      return [];
    }
  }
}

export const captivePortalManager = new CaptivePortalManager();
