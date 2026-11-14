// ORBIX Error and Event System Type Definitions
// Strictly adhering to shadcn/ui Zinc design specifications

export type ErrorCategory =
  | "system"
  | "network"
  | "routing"
  | "security"
  | "vpn"
  | "dns"
  | "config"
  | "hardware"
  | "services";

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export type EventStatus = "active" | "resolved" | "acknowledged";

export interface LocalizedString {
  en: string;
  ru: string;
}

export interface LocalizedArray {
  en: string[];
  ru: string[];
}

export interface ErrorDefinition {
  code: number;
  identifier: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  internalDescription: string;
  title: LocalizedString;
  description: LocalizedString;
  triggerConditions: LocalizedArray;
  remediation: LocalizedArray;
  httpRedirectApplicable: boolean;
  autoRecovery: boolean;
  relatedService: string;
}

export interface NetworkEvent {
  event_id: string;
  code: number;
  identifier: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  source: string;
  message: string;
  timestamp: number;
  status: EventStatus;
  metadata?: Record<string, unknown>;
  correlation_id?: string;
  acknowledged?: boolean;
  resolvedAt?: number;
  repeatCount?: number;
}

export interface ErrorSystemSettings {
  enableNonCriticalNotifications: boolean;
  retentionLimit: number; // e.g. 50, 100, 200, 500
  deduplicationIntervalMs: number; // e.g. 15000 ms
  autoRecovery: boolean;
  killSwitchEnforcement: "strict" | "adaptive" | "off";
  leakProtection: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface KillSwitchRuntimeState {
  enabled: boolean;
  scope: "vpn_devices" | "all";
  allowLan: boolean;
  active: boolean; // whether kernel nftables drop rule is currently applied
  activeDropRulesCount: number;
  protectedDevices: string[];
  tunnelStatus: "up" | "down" | "degraded";
  blockedWan: boolean;
  lastTriggeredAt?: number;
}

export interface LeakDetectionAuditResult {
  timestamp: number;
  dnsLeak: {
    detected: boolean;
    activeDnsServers: string[];
    isUnencryptedIspDns: boolean;
    details?: string;
  };
  ipLeak: {
    detected: boolean;
    defaultGatewayInterface: string;
    protectedSubnetLeaking: boolean;
    details?: string;
  };
  dnsRebinding: {
    protected: boolean;
    suspiciousRequestsCount: number;
  };
  overallStatus: "secure" | "warning" | "leaking";
}
