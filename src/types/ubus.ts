// OpenWrt ubus JSON-RPC types

export interface UbusRpcRequest<T = Record<string, unknown>> {
  jsonrpc: "2.0";
  id: number;
  method: "call";
  params: [string, string, string, T];
}

export interface UbusRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: [number, T];
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface SystemInfo {
  localtime: number;
  uptime: number;
  load: [number, number, number];
  memory: {
    total: number;
    free: number;
    shared: number;
    buffered: number;
    available: number;
    cached: number;
  };
  root: {
    total: number;
    free: number;
    used: number;
    avail: number;
  };
  tmp: {
    total: number;
    free: number;
    used: number;
    avail: number;
  };
  swap: {
    total: number;
    free: number;
  };
}

export interface SystemBoard {
  kernel: string;
  hostname: string;
  system: string;
  model: string;
  board_name: string;
  rootfs_type: string;
  release: {
    distribution: string;
    version: string;
    revision: string;
    target: string;
    description: string;
  };
}

export interface NetworkInterfaceStatus {
  interface: string;
  up: boolean;
  pending: boolean;
  available: boolean;
  autostart: boolean;
  dynamic: boolean;
  uptime: number;
  l3_device: string;
  proto: string;
  device?: string;
  route?: Array<{ target?: string; nexthop?: string; device?: string; table?: number }>;
  "ipv4-address"?: Array<{ address: string; mask: number }>;
  "ipv6-address"?: Array<{ address: string; mask: number }>;
  "ipv6-prefix"?: Array<{ address: string; mask: number }>;
  dns_servers?: string[];
  data?: {
    statistics?: {
      rx_bytes: number;
      rx_packets: number;
      tx_bytes: number;
      tx_packets: number;
      rx_errors?: number;
      tx_errors?: number;
    };
    /** enriched by getInterfaces() from network.device status */
    macaddr?: string;
    speed?: number;
  };
}

export interface DhcpLease {
  expires: number;
  macaddr: string;
  ipaddr: string;
  hostname?: string;
  duid?: string;
}

export interface WirelessDevice {
  name: string;
  up: boolean;
  disabled: boolean;
  channel?: number;
  frequency?: number;
  txpower?: number;
  htmode?: string;
  band?: "2g" | "5g" | "6g";
  /** luci-rpc getWirelessDevices() augments radios with their UCI section */
  config?: Record<string, any>;
  iwinfo?: Record<string, any>;
  interfaces: Array<{
    ifname: string;
    section: string;
    ssid: string;
    bssid: string;
    mode: string;
    encryption: string;
    channel: number;
    signal?: number;
    noise?: number;
    /** UCI key material joined by luci-rpc / getWirelessDevices enrichment */
    key?: string;
    config?: Record<string, any>;
    iwinfo?: Record<string, any>;
    assoclist?: Record<string, {
      signal: number;
      noise: number;
      rx_rate: number;
      tx_rate: number;
      key?: string;
      macaddr?: string;
      speed?: number;
    }>;
  }>;
}

export interface UciChange {
  type: "add" | "set" | "delete" | "order";
  config: string;
  section: string;
  option?: string;
  value?: string | string[];
  oldValue?: string | string[];
}

// Circumvention & VPN types
export interface AmneziaWgConfig {
  name: string;
  configured?: boolean;
  active?: boolean;
  private_key?: string;
  public_key?: string;
  listen_port: number;
  addresses: string[];
  dns?: string[];
  mtu?: number;
  // AWG Obfuscation params
  jc: number;
  jmin: number;
  jmax: number;
  s1: number;
  s2: number;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  peers: Array<{
    public_key: string;
    preshared_key?: string;
    endpoint?: string;
    allowed_ips: string[];
    persistent_keepalive?: number;
    latest_handshake?: number;
    transfer_rx?: number;
    transfer_tx?: number;
  }>;
}

export interface VlessNode {
  id: string;
  name: string;
  server: string;
  port: number;
  uuid: string;
  flow?: string;
  security: "none" | "tls" | "reality";
  sni?: string;
  fingerprint?: string;
  publicKey?: string;
  shortId?: string;
  transport: "tcp" | "ws" | "grpc" | "httpupgrade" | "xhttp";
  path?: string;
  serviceName?: string;
  latency?: number;
  active?: boolean;
  country?: string;
  raw?: string;
}

export interface HysteriaConfig {
  server: string;
  port: number;
  auth: string;
  obfs?: {
    type: "salamander";
    password: string;
  };
  up_mbps: number;
  down_mbps: number;
  port_hopping?: string;
  sni?: string;
  insecure?: boolean;
  status?: "running" | "stopped" | "error";
}

export interface ZapretProfile {
  id: string;
  name: string;
  enabled: boolean;
  mode: "nfqws" | "tpws";
  protocol: "tcp" | "udp";
  ports: string;
  methods: Array<"fake" | "multisplit" | "disorder" | "fakedsplit" | "ipfrag2">;
  split_pos: number;
  split_any_protocol: boolean;
  repeats: number;
  fooling: Array<"ts" | "md5sig" | "badseq" | "badsum" | "hopbyhop">;
  fake_payload_file?: string;
  hostlist_mode: "hostlist" | "ipset" | "all";
  hostlist: string[];
  exclude_list: string[];
}

export interface PodkopConfig {
  installed?: boolean | number;
  running?: boolean | number;
  status?: string;
  message?: string;
  enabled: boolean;
  mode: "sing-box" | "byedpi" | "awg" | "mixed";
  outbound_interface: string;
  services: {
    youtube: boolean;
    discord: boolean;
    meta: boolean;
    ai_services: boolean;
    telegram: boolean;
    notion: boolean;
  };
  custom_domains: string[];
  custom_subnets: string[];
}

export interface PbrRule {
  id: string;
  name: string;
  enabled: boolean;
  src_addr?: string;
  dest_addr?: string;
  src_port?: string;
  dest_port?: string;
  proto?: "all" | "tcp" | "udp" | "tcp udp" | "icmp";
  interface: "zapret" | "singbox" | "awg0" | "wan" | "drop" | string;
}

// Per-Device Routing Rule
export interface DeviceRoutingRule {
  ip: string;
  mac: string;
  name: string;
  interface: "default" | "wan" | "awg0" | "singbox" | "zapret";
  enabled: boolean;
  online?: boolean;
  lastSeen?: string;
}

// Happ VPN Subscriptions via Happy Decoder API
export interface SubscriptionMetadata {
  profileTitle: string;
  updateInterval: string;
  uploadBytes: number;
  downloadBytes: number;
  totalBytes: number;
  expireTimestamp: number; // 0 if unlimited
  announce?: string;
  supportUrl?: string;
  lastUpdated: number;
  nextUpdate?: number;
  autoUpdateInterval: "disabled" | "6h" | "12h" | "24h";
  selectionMode: "manual" | "auto_best";
}

export interface HappSubscriptionData {
  url: string;
  decryptedUrl?: string;
  apiKey: string;
  metadata: SubscriptionMetadata;
  nodes: VlessNode[];
  activeNodeId: string;
  isSyncing: boolean;
  rateLimitUntil?: number; // timestamp when 429 lock clears
}

// VPN Outbound Groups & Failover
export interface VpnOutboundGroup {
  id: string;
  name: string;
  nameRu: string;
  mode: "lowest_latency" | "failover" | "manual";
  nodeIds: string[];
  activeNodeId?: string;
  healthStatus?: "healthy" | "degraded" | "down";
  lastCheckTimestamp?: number;
}

export interface KillSwitchConfig {
  enabled: boolean;
  scope: "all" | "vpn_devices";
  allowLan: boolean; // Preserves 192.168.1.1 router admin access
  activeDropRulesCount?: number;
}

export interface RollbackState {
  isArmed: boolean;
  token: string | null;
  timeout: number;
  startedAt: number;
}

export interface VlessStatusResponse {
  running: boolean;
  nodes: VlessNode[];
  activeNode?: VlessNode;
}

export interface ZapretStatusResponse {
  running: boolean;
  enabled: boolean;
  installed?: boolean;
  fwtype: string;
  mode_filter?: string;
  ports_tcp?: string;
  ports_udp?: string;
  profiles: Array<{
    id: string;
    name: string;
    enabled: boolean;
    mode: string;
    protocol: string;
    ports: string;
    methods: string[];
    hostlist?: string[];
    exclude_list?: string[];
  }>;
}

export interface AwgStatusResponse {
  enabled: boolean;
  configured: boolean;
  active: boolean;
  name: string;
  public_key?: string;
  listen_port?: number;
  mtu?: number;
  addresses?: string[];
  dns?: string[];
  peers?: Array<{
    endpoint?: string;
    allowed_ips?: string;
    latest_handshake?: number;
    transfer_rx?: number;
    transfer_tx?: number;
  }>;
  jc?: number;
  jmin?: number;
  jmax?: number;
  s1?: number;
  s2?: number;
  h1?: number;
  h2?: number;
  h3?: number;
  h4?: number;
}


export interface ZapretOptionsResponse {
  installed: boolean;
  running: boolean;
  nfqws_enable: boolean;
  ports_tcp: string;
  ports_udp: string;
  mode_filter: string;
  run_on_boot: string;
  fwtype: string;
  nfqws_opt: string;
  list_files: Array<{ name: string; path: string; size: number }>;
  backups: string[];
}

export interface KidDevice {
  mac: string;
  ip: string;
  name: string;
  online: boolean;
  paused: boolean;
}

export interface NodeBalancerStatusResponse {
  status: string;
  updated: number;
  active_server: string;
  active_port: string;
  score: number;
  scanned: number;
  best: number;
  switched: boolean;
  message?: string;
  sub_nodes: number;
  log?: string[];
}

export interface KidStatusResponse {
  status: string;
  installed: boolean;
  master: boolean;
  effective: boolean;
  auto_bedtime: boolean;
  bedtime_start: string;
  bedtime_end: string;
  blocks: string[];
  paused: string[];
  devices: KidDevice[];
  message?: string;
}
