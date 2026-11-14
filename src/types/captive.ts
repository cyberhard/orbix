// ORBIX Captive Portal, HTTP Interception & Certificate Management Types
// Adhering to RFC 8952, RFC 8908, RFC 8910 and OpenWrt standards

export type CaptivePortalMode = "strict" | "captive_portal" | "http_redirect";

export type CaptiveClientState =
  | "open"
  | "captive"
  | "restricted"
  | "authorized"
  | "expired"
  | "exempt"
  | "offline";

export type CertificateMode = "acme" | "custom" | "private_ca";

export interface CaptivePortalConfig {
  enabled: boolean;
  mode: CaptivePortalMode;
  portal_domain: string;
  portal_ssl_port: number;
  http_intercept: boolean;
  rfc8908_enabled: boolean;
  dhcp_opt114: boolean;
  ra_opt103: boolean;
  session_timeout_sec: number;
  exempt_ips: string[];
  exempt_macs: string[];
  cert_mode: CertificateMode;
  acme_provider: string;
  dns_provider?: string;
  dns_api_credentials?: Record<string, string>;
  updated_at?: number;
}

export interface CaptivePortalStatus {
  enabled: boolean;
  mode: CaptivePortalMode;
  portal_domain: string;
  http_intercept_active: boolean;
  rfc8908_active: boolean;
  dhcp_opt114_active: boolean;
  cert_valid: boolean;
  cert_expires_at: number;
  cert_days_left: number;
  total_clients: number;
  active_restricted_clients: number;
}

export interface CaptiveClient {
  ip: string;
  mac: string;
  hostname: string;
  interface: string;
  state: CaptiveClientState;
  reason: string;
  error_code: number;
  is_exempt: boolean;
  lease_expires?: number;
  first_seen?: number;
  last_activity?: number;
}

export interface CertificateStatus {
  installed: boolean;
  subject?: string;
  issuer?: string;
  san?: string;
  valid_from?: number;
  valid_to?: number;
  days_remaining?: number;
  is_valid?: boolean;
}

export interface DiagnosticCheck {
  id: string;
  name: string;
  status: "pass" | "warn" | "fail";
  details: string;
  remediation: string;
  timestamp: number;
}

export interface CaptiveEvent {
  id: string;
  timestamp: number;
  type: "redirect" | "api_query" | "state_change" | "cert_renew" | "exemption";
  client_ip?: string;
  client_mac?: string;
  target_domain?: string;
  error_code?: number;
  details: string;
}
