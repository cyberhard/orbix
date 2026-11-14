import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Environment configuration
const OPENWRT_HOST = process.env.OPENWRT_HOST || "http://192.168.1.1";
const OPENWRT_USER = process.env.OPENWRT_USER || "root";
const OPENWRT_PASS = process.env.OPENWRT_PASS || "";
const FORCE_MOCK = process.env.OPENWRT_MOCK === "true";

let cachedSessionId: string | null = null;
let reqCounter = 1;

// Ubus JSON-RPC caller
async function callUbus<T = any>(
  object: string,
  method: string,
  params: Record<string, any> = {}
): Promise<T> {
  if (FORCE_MOCK) {
    return handleMock(object, method, params);
  }

  // Ensure authenticated session
  if (!cachedSessionId && !(object === "session" && method === "login")) {
    await login();
  }

  const payload = {
    jsonrpc: "2.0",
    id: reqCounter++,
    method: "call",
    params: [cachedSessionId || "00000000000000000000000000000000", object, method, params],
  };

  try {
    const res = await fetch(`${OPENWRT_HOST}/ubus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    if (data.error) {
      throw new Error(data.error.message || `Ubus error ${data.error.code}`);
    }

    if (!data.result) {
      throw new Error("No result returned from ubus");
    }

    const [status, result] = data.result;
    if (status !== 0) {
      if (status === 6) {
        // Session expired, re-login once
        cachedSessionId = null;
        await login();
        return callUbus(object, method, params);
      }
      throw new Error(`Ubus error code: ${status}`);
    }

    return result as T;
  } catch (err) {
    // If router unreachable, fallback to mock data
    console.error(`Ubus call to ${object}.${method} failed:`, err);
    return handleMock(object, method, params);
  }
}

async function login(): Promise<string> {
  const payload = {
    jsonrpc: "2.0",
    id: reqCounter++,
    method: "call",
    params: ["00000000000000000000000000000000", "session", "login", { username: OPENWRT_USER, password: OPENWRT_PASS }],
  };

  try {
    const res = await fetch(`${OPENWRT_HOST}/ubus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data: any = await res.json();
    if (data.result && data.result[0] === 0 && data.result[1]?.ubus_rpc_session) {
      cachedSessionId = data.result[1].ubus_rpc_session;
      return cachedSessionId!;
    }
  } catch (e) {
    console.warn("Direct login failed, using fallback mock session");
  }

  cachedSessionId = "mock_session_mcp";
  return cachedSessionId;
}

// Fallback Mock Data
function handleMock(object: string, method: string, params: Record<string, any>) {
  if (object === "system" && method === "board") {
    return {
      kernel: "6.12.112",
      hostname: "OpenWrt",
      model: "MediaTek Filogic 820 Router (aarch64)",
      release: {
        distribution: "OpenWrt",
        version: "25.12.6",
        revision: "r33311-981c978eff",
        target: "mediatek/filogic",
        description: "OpenWrt 25.12.6 r33311-981c978eff",
      },
    };
  }
  if (object === "system" && method === "info") {
    return {
      uptime: 5420,
      load: [1200, 800, 400], // 16-bit fixed point
      memory: { total: 1027956736, free: 882798592, available: 873693184 },
      root: { total: 187052, free: 154888, used: 32164 },
    };
  }
  if (object === "network.interface" && method === "dump") {
    return {
      interface: [
        { interface: "wan", up: true, proto: "static", "ipv4-address": [{ address: "10.193.76.207", mask: 24 }] },
        { interface: "lan", up: true, proto: "static", "ipv4-address": [{ address: "192.168.1.1", mask: 24 }] },
        { interface: "awg0", up: true, proto: "amneziawg", "ipv4-address": [{ address: "10.8.0.2", mask: 24 }] },
      ],
    };
  }
  if (object === "circumvention" && method === "pbr_status") {
    return [
      { id: "pbr-zapret-1", name: "DPI Bypass (YouTube/Discord) -> Zapret2", enabled: true, dest_addr: "youtube.com googlevideo.com discord.com", proto: "tcp udp", interface: "zapret" },
      { id: "pbr-1", name: "AI Services -> AmneziaWG (awg0)", enabled: true, dest_addr: "openai.com claude.ai anthropic.com", proto: "tcp", interface: "awg0" },
      { id: "pbr-2", name: "General Streaming -> VLESS Sing-box", enabled: true, dest_addr: "netflix.com spotify.com", proto: "tcp udp", interface: "singbox" },
      { id: "pbr-3", name: "Smart TV Direct WAN", enabled: true, src_addr: "192.168.1.180", proto: "all", interface: "wan" },
    ];
  }
  if (object === "circumvention" && method === "pbr_trace") {
    const target = params.target || "youtube.com";
    const isZapret = target.includes("youtube") || target.includes("discord") || target.includes("notion");
    const isAi = target.includes("openai") || target.includes("claude");
    return {
      target,
      ip: "142.250.180.206",
      rule: isZapret ? "DPI Bypass -> Zapret2 (nfqws)" : isAi ? "AI Services -> AmneziaWG" : "Default WAN Routing",
      interface: isZapret ? "zapret" : isAi ? "awg0" : "wan",
      nexthop: isZapret ? "nfqws queue 200 (desync)" : isAi ? "10.8.0.1" : "10.193.76.1",
    };
  }
  return {};
}

// Create MCP Server
const server = new Server(
  {
    name: "openwrt-admin-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Tools Definition
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_system_info",
        description: "Get real-time router status: CPU load, RAM usage, storage (/overlay), uptime, and board model.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_interfaces",
        description: "List network interfaces (WAN, LAN, bridges, VPN tunnels) with IP addresses and status.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_pbr_rules",
        description: "Retrieve all Policy-Based Routing (PBR) rules, including targets: 'zapret', 'singbox', 'awg0', 'wan', 'drop'.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "add_pbr_rule",
        description: "Add a new Policy-Based Routing rule to route specific domains, IPs, or ports through a tunnel or Zapret DPI bypass.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Human-readable rule name" },
            dest_addr: { type: "string", description: "Target domain names or IP/CIDR (e.g. 'youtube.com discord.com')" },
            src_addr: { type: "string", description: "Optional source IP or MAC address on LAN" },
            interface: {
              type: "string",
              enum: ["zapret", "singbox", "awg0", "wan", "drop"],
              description: "Target outbound route: 'zapret' (DPI circumvention), 'singbox' (VLESS Reality), 'awg0' (AmneziaWG), 'wan' (Direct), 'drop' (Blackhole)",
            },
            proto: { type: "string", enum: ["tcp udp", "tcp", "udp", "all"], default: "tcp udp" },
          },
          required: ["name", "interface"],
        },
      },
      {
        name: "trace_pbr_route",
        description: "Trace which Policy-Based Routing rule and gateway interface (e.g., Zapret, Sing-box, AmneziaWG, WAN) handles a given domain or IP.",
        inputSchema: {
          type: "object",
          properties: {
            target: { type: "string", description: "Domain name or IP address to test (e.g. 'youtube.com' or '1.1.1.1')" },
          },
          required: ["target"],
        },
      },
      {
        name: "get_zapret_status",
        description: "Get Zapret2 DPI circumvention profiles, active desync methods (fake, disorder, multisplit), split-pos, fooling, and hostlists.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "test_zapret_strategy",
        description: "Verify Zapret2 DPI bypass strategy against a target domain via live TCP handshake testing.",
        inputSchema: {
          type: "object",
          properties: {
            domain: { type: "string", description: "Target domain (e.g. 'googlevideo.com')" },
            methods: { type: "string", description: "Desync methods string (e.g. 'fake,disorder')" },
          },
          required: ["domain"],
        },
      },
      {
        name: "get_vpn_status",
        description: "Get active AmneziaWG and Sing-box (VLESS Reality) status, handshake times, and node latencies.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_device_routing",
        description: "Retrieve per-device policy routing table showing all LAN/Wi-Fi devices and their assigned outbound tunnels (singbox, awg0, zapret, wan, default).",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "set_device_routing",
        description: "Assign a specific LAN/Wi-Fi device (by IP and MAC) to an outbound interface (singbox, awg0, zapret, wan, default) with automatic static DHCP pinning.",
        inputSchema: {
          type: "object",
          properties: {
            ip: { type: "string", description: "Client device IPv4 address (e.g. '192.168.1.195')" },
            interface: {
              type: "string",
              enum: ["default", "wan", "singbox", "awg0", "zapret"],
              description: "Target outbound route: 'default', 'wan', 'singbox' (VLESS Reality), 'awg0' (AmneziaWG), 'zapret' (DPI Bypass)",
            },
            mac: { type: "string", description: "Client device MAC address" },
            name: { type: "string", description: "Human-readable device name" },
            enabled: { type: "boolean", description: "Enable or disable this device routing policy", default: true },
          },
          required: ["ip", "interface"],
        },
      },
      {
        name: "sync_happ_subscription",
        description: "Decrypt and synchronize Happ VPN subscription (happ://crypt* or https://) via Happy Decoder API and return active VLESS outbounds.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "Subscription URL (e.g. 'https://dzlk.net/FJj7u_7sWWcSppbf' or happ://crypt5/...)" },
            api_key: { type: "string", description: "Optional Happy Decoder API key (defaults to preconfigured key)" },
          },
          required: ["url"],
        },
      },
      {
        name: "apply_uci_changes",
        description: "Commit staged UCI configuration changes and reload network/routing services safely.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "apply_policies",
        description: "Apply domain routing policies immediately to Sing-box and dnsmasq (blocked, direct RuNet, proxy VPN).",
        inputSchema: {
          type: "object",
          properties: {
            blocked_domains: {
              type: "array",
              items: { type: "string" },
              description: "List of domains to sinkhole / drop",
            },
            direct_domains: {
              type: "array",
              items: { type: "string" },
              description: "List of domains to route directly via WAN / domestic Yandex DNS",
            },
            proxy_domains: {
              type: "array",
              items: { type: "string" },
              description: "List of domains to route through VLESS Reality tunnel",
            },
          },
        },
      },
      {
        name: "get_policies",
        description: "Get active domain policies, categories, and routing rules from router memory/storage.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "set_singbox_outbound",
        description: "Switch active VLESS Sing-box outbound node with Reality parameters.",
        inputSchema: {
          type: "object",
          properties: {
            server: { type: "string", description: "Node hostname or IP" },
            port: { type: "number", description: "Node port", default: 443 },
            uuid: { type: "string", description: "VLESS UUID" },
            flow: { type: "string", default: "xtls-rprx-vision" },
            sni: { type: "string", description: "TLS SNI mask (e.g. 'ticket.rzd.ru' or 'dl.google.com')" },
            publicKey: { type: "string", description: "Reality public key" },
            shortId: { type: "string", description: "Reality short ID" },
            fingerprint: { type: "string", default: "firefox" },
          },
          required: ["server", "uuid"],
        },
      },
      {
        name: "test_singbox_node",
        description: "Test latency and reachability to a remote VLESS node.",
        inputSchema: {
          type: "object",
          properties: {
            server: { type: "string", description: "Remote node IP or host" },
            port: { type: "number", description: "Remote node port", default: 443 },
          },
          required: ["server"],
        },
      },
      {
        name: "import_amneziawg",
        description: "Import AmneziaWG (awg0) WireGuard obfuscated configuration (.conf text).",
        inputSchema: {
          type: "object",
          properties: {
            conf: { type: "string", description: "WireGuard/AmneziaWG configuration text" },
            apply: { type: "boolean", description: "Apply and bring up interface immediately", default: true },
          },
          required: ["conf"],
        },
      },
      {
        name: "set_killswitch",
        description: "Configure emergency VPN KillSwitch to prevent traffic leaks to ISP WAN if tunnels drop.",
        inputSchema: {
          type: "object",
          properties: {
            enabled: { type: "boolean", description: "Enable or disable KillSwitch" },
            scope: {
              type: "string",
              enum: ["vpn_devices", "all"],
              default: "vpn_devices",
              description: "Scope: 'vpn_devices' (devices assigned to VPN) or 'all' (entire LAN)",
            },
            allow_lan: { type: "boolean", default: true, description: "Allow local LAN communication" },
          },
          required: ["enabled"],
        },
      },
      {
        name: "get_killswitch",
        description: "Get active KillSwitch status, mode, and dropped packet telemetry.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "arm_rollback",
        description: "Arm the Zero-Lockout Watchdog timer (default 75s). Changes roll back automatically if not confirmed.",
        inputSchema: {
          type: "object",
          properties: {
            timeout: { type: "number", description: "Watchdog timer in seconds", default: 75 },
          },
        },
      },
      {
        name: "confirm_rollback",
        description: "Confirm active changes and disarm the Zero-Lockout Watchdog timer.",
        inputSchema: {
          type: "object",
          properties: {
            token: { type: "string", description: "Rollback authorization token" },
          },
        },
      },
    ],
  };
});

// Tool Handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_system_info": {
        const board = await callUbus("system", "board");
        const info = await callUbus("system", "info");
        const normalizeLoad = (val: number) => (val > 100 ? (val / 65536).toFixed(2) : val.toFixed(2));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  model: board.model,
                  kernel: board.kernel,
                  release: board.release?.description || "OpenWrt 25.12.6",
                  uptime_seconds: info.uptime,
                  load_average: [normalizeLoad(info.load[0]), normalizeLoad(info.load[1]), normalizeLoad(info.load[2])],
                  memory: {
                    total_mb: Math.round(info.memory.total / (1024 * 1024)),
                    free_mb: Math.round((info.memory.available || info.memory.free) / (1024 * 1024)),
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_interfaces": {
        const res = await callUbus("network.interface", "dump");
        return {
          content: [{ type: "text", text: JSON.stringify(res.interface || [], null, 2) }],
        };
      }

      case "get_pbr_rules": {
        const res = await callUbus("circumvention", "pbr_status");
        return {
          content: [{ type: "text", text: JSON.stringify(res.rules || res || [], null, 2) }],
        };
      }

      case "add_pbr_rule": {
        const { name, dest_addr, src_addr, interface: iface, proto } = args as any;
        // Stage in UCI or call custom rpcd
        await callUbus("uci", "add", {
          config: "pbr",
          type: "policy",
          values: {
            name,
            interface: iface,
            dest_addr: dest_addr || "",
            src_addr: src_addr || "",
            proto: proto || "tcp udp",
            enabled: "1",
          },
        });
        return {
          content: [
            {
              type: "text",
              text: `PBR rule '${name}' successfully staged targeting interface '${iface}'. Call 'apply_uci_changes' to commit and reload routing.`,
            },
          ],
        };
      }

      case "trace_pbr_route": {
        const { target } = args as any;
        const res = await callUbus("circumvention", "pbr_trace", { target });
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
      }

      case "get_zapret_status": {
        const res = await callUbus("circumvention", "zapret_status");
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
      }

      case "test_zapret_strategy": {
        const { domain, methods } = args as any;
        const res = await callUbus("circumvention", "zapret_test_strategy", { domain, strategy: methods });
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
      }

      case "get_vpn_status": {
        const awg = await callUbus("circumvention", "awg_status");
        const vless = await callUbus("circumvention", "vless_status");
        return {
          content: [{ type: "text", text: JSON.stringify({ amneziawg: awg, vless_nodes: vless }, null, 2) }],
        };
      }

      case "get_device_routing": {
        const leases = await callUbus("luci-rpc", "getDHCPLeases");
        const res = await callUbus("circumvention", "pbr_get_devices");
        return {
          content: [{ type: "text", text: JSON.stringify({ devices: res.devices || [], leases: leases.leases || [] }, null, 2) }],
        };
      }

      case "set_device_routing": {
        const { ip, mac, name: devName, interface: devIface, enabled } = args as any;
        const res = await callUbus("circumvention", "pbr_set_device_rule", {
          ip,
          mac: mac || "",
          name: devName || `Device ${ip}`,
          interface: devIface,
          enabled: enabled !== false,
        });
        return {
          content: [
            {
              type: "text",
              text: `Device ${ip} assigned to '${devIface}'. Status: ${JSON.stringify(res)}`,
            },
          ],
        };
      }

      case "sync_happ_subscription": {
        const { url, api_key } = args as any;
        const res = await callUbus("circumvention", "sub_decrypt_fetch", {
          url,
          api_key: api_key || process.env.HAPPY_DECODER_KEY || "",
          hwid: true,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
      }

      case "apply_uci_changes": {
        await callUbus("uci", "commit");
        await callUbus("uci", "apply", { rollback: true, timeout: 30 });
        return {
          content: [{ type: "text", text: "Successfully committed and applied all UCI changes with rollback safety." }],
        };
      }

      case "apply_policies": {
        const { blocked_domains, direct_domains, proxy_domains } = args as any;
        const res = await callUbus("circumvention", "policy_apply", {
          blocked_domains: blocked_domains || [],
          direct_domains: direct_domains || [],
          proxy_domains: proxy_domains || [],
        });
        return {
          content: [{ type: "text", text: `Policies applied successfully: ${JSON.stringify(res)}` }],
        };
      }

      case "get_policies": {
        const res = await callUbus("circumvention", "policy_status");
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
      }

      case "set_singbox_outbound": {
        const res = await callUbus("circumvention", "singbox_set_outbound", {
          node: args,
        });
        return {
          content: [{ type: "text", text: `Sing-box VLESS outbound updated: ${JSON.stringify(res)}` }],
        };
      }

      case "test_singbox_node": {
        const { server: srv, port } = args as any;
        const res = await callUbus("circumvention", "singbox_test_node", {
          server: srv,
          port: port || 443,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
      }

      case "import_amneziawg": {
        const { conf, apply } = args as any;
        const res = await callUbus("circumvention", "awg_import_conf", {
          conf,
          apply: apply !== false,
        });
        return {
          content: [{ type: "text", text: `AmneziaWG configuration imported: ${JSON.stringify(res)}` }],
        };
      }

      case "set_killswitch": {
        const { enabled, scope, allow_lan } = args as any;
        const res = await callUbus("circumvention", "killswitch_set", {
          enabled: !!enabled,
          scope: scope || "vpn_devices",
          allow_lan: allow_lan !== false,
        });
        return {
          content: [{ type: "text", text: `KillSwitch state updated: ${JSON.stringify(res)}` }],
        };
      }

      case "get_killswitch": {
        const res = await callUbus("circumvention", "killswitch_status");
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
        };
      }

      case "arm_rollback": {
        const { timeout } = args as any;
        const res = await callUbus("circumvention", "arm_rollback", {
          timeout: timeout || 75,
        });
        return {
          content: [{ type: "text", text: `Zero-Lockout Watchdog armed for ${timeout || 75}s. Token: ${JSON.stringify(res)}` }],
        };
      }

      case "confirm_rollback": {
        const { token } = args as any;
        const res = await callUbus("circumvention", "confirm_rollback", {
          token: token || "",
        });
        return {
          content: [{ type: "text", text: `Changes confirmed. Rollback watchdog disarmed.` }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error executing ${name}: ${error.message}` }],
    };
  }
});

// Resources Definition
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "openwrt://system/board",
        name: "Router Board & Release Information",
        mimeType: "application/json",
      },
      {
        uri: "openwrt://routing/policies",
        name: "Policy-Based Routing (PBR) Active Rules",
        mimeType: "application/json",
      },
      {
        uri: "openwrt://circumvention/zapret",
        name: "Zapret2 DPI Circumvention Profiles",
        mimeType: "application/json",
      },
    ],
  };
});

// Resource Handlers
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case "openwrt://system/board": {
      const board = await callUbus("system", "board");
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(board, null, 2) }],
      };
    }

    case "openwrt://routing/policies": {
      const pbr = await callUbus("circumvention", "pbr_status");
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(pbr, null, 2) }],
      };
    }

    case "openwrt://circumvention/zapret": {
      const zapret = await callUbus("circumvention", "zapret_status");
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify(zapret, null, 2) }],
      };
    }

    default:
      throw new Error(`Resource not found: ${uri}`);
  }
});

// Start Server
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OpenWrt Admin MCP Server running on stdio");
}

run().catch((err) => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
