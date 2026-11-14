// Unified Policy Engine Types for OpenWrt Modern Admin Platform

export type PolicySourceType = "all" | "device" | "group" | "subnet" | "mac" | "interface";

export type PolicyDestinationType =
  | "all"
  | "category"
  | "domain_list"
  | "ip_list"
  | "subnet"
  | "custom_domains"
  | "port_range";

export type PolicyActionType =
  | "direct_wan"
  | "vpn_tunnel"
  | "vpn_group"
  | "zapret_dpi"
  | "block"
  | "default";

export interface PolicyCondition {
  timeSchedule?: {
    enabled: boolean;
    days: number[]; // 0 = Sun, 1 = Mon ...
    startHour: number; // 0-23
    endHour: number; // 0-23
  };
  protocols?: Array<"all" | "tcp" | "udp" | "icmp">;
  portRange?: string; // e.g. "80,443", "50000-50100"
  exceptions?: Array<{
    type: "domain" | "ip" | "device";
    value: string;
  }>;
}

export interface NetworkPolicy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number; // 1 = highest, 1000 = lowest
  isSystem?: boolean; // Default curated system policy
  mode: "simple" | "expert";

  source: {
    type: PolicySourceType;
    values: string[]; // e.g. ["192.168.1.130"], ["group:smartphones"], ["192.168.1.0/24"]
  };

  destination: {
    type: PolicyDestinationType;
    values: string[]; // e.g. ["category:russia"], ["category:youtube"], ["domain:chatgpt.com"]
  };

  action: {
    type: PolicyActionType;
    target?: string; // e.g. "singbox", "awg0", "group:europe", "profile:zapret-hostfakesplit"
    fallbackAction?: "direct_wan" | "block" | "default";
  };

  condition?: PolicyCondition;
  createdAt?: number;
  updatedAt?: number;
}

export interface DomainCategory {
  id: string;
  name: string;
  nameRu: string;
  description: string;
  descriptionRu: string;
  icon: string;
  domains: string[];
  ipRanges?: string[];
  autoUpdateUrl?: string;
  lastUpdated?: number;
  itemCount: number;
}

export interface DeviceGroup {
  id: string;
  name: string;
  nameRu: string;
  icon: string;
  deviceIps: string[];
  defaultAction?: PolicyActionType;
}

export interface PolicyConflict {
  id: string;
  policyA: { id: string; name: string; priority: number };
  policyB: { id: string; name: string; priority: number };
  type: "shadow" | "overlap" | "contradiction";
  severity: "error" | "warning" | "info";
  message: string;
  messageRu: string;
  recommendation: string;
  recommendationRu: string;
}

export interface RouteEvaluationResult {
  target: string;
  sourceIp: string;
  sourceDeviceName?: string;
  protocol: string;
  port: number;

  // Evaluation outcome
  matchedPolicies: Array<{
    policy: NetworkPolicy;
    matchReason: string;
    isWinner: boolean;
  }>;
  winningPolicy: NetworkPolicy | null;
  winningReason: string;
  winningReasonRu: string;

  // Concrete decisions
  selectedAction: PolicyActionType;
  selectedOutbound: string;
  dnsResolution: {
    resolver: string;
    resolvedIp?: string;
    dohUsed: boolean;
    policyApplied?: string;
  };
  dpiProcessing: {
    enabled: boolean;
    engine?: "nfqws" | "tpws";
    strategy?: string;
    profileName?: string;
  };
  firewallDecision: "ACCEPT" | "DROP" | "REJECT";

  // Comparison & Diagnostics
  expectedRoute: string; // Calculated by Policy Engine
  configuredRoute: string; // Specified in UCI/PBR/sing-box files
  observedRoute?: string; // Verified from active kernel ip route / rule
  verificationStatus: "verified" | "mismatch" | "unverified" | "unavailable";

  troubleshooting: Array<{
    severity: "info" | "warning" | "error";
    title: string;
    description: string;
    actionableStep: string;
  }>;
}

export interface CompiledSystemConfig {
  pbrPolicies: Array<{
    name: string;
    src_addr?: string;
    dest_addr?: string;
    interface: string;
    proto?: string;
    enabled: boolean;
  }>;
  singboxRules: Array<{
    domain_suffix?: string[];
    ip_cidr?: string[];
    outbound: string;
    action?: string;
  }>;
  zapretHostlists: {
    google: string[];
    general: string[];
    exclude: string[];
  };
  dnsmasqEntries: Array<{
    domain: string;
    targetIp?: string;
    server?: string;
  }>;
}
