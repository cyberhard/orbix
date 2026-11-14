# OpenWrt Modern Admin Panel — MCP Server Integration Guide

This document describes the Model Context Protocol (MCP) server integrated into the OpenWrt Modern Admin Panel project. The MCP server allows LLM assistants (e.g. Claude Desktop, Cursor, Antigravity, Cline) to query router telemetry, inspect network interfaces, manage Policy-Based Routing (PBR) rules, diagnose Zapret2 DPI desynchronization strategies, and apply UCI changes safely.

---

## 1. Overview & Architecture

The MCP server is implemented using the official `@modelcontextprotocol/sdk` in TypeScript (`mcp-server/src/index.ts`). It communicates over standard I/O (stdio) via the JSON-RPC 2.0 based Model Context Protocol.

```
┌────────────────────────────────┐
│   LLM Client (Claude / Cursor) │
└───────────────┬────────────────┘
                │ Standard Input / Output (stdio)
                ▼
┌────────────────────────────────────────────────────────┐
│             OpenWrt MCP Server (Node.js/tsx)           │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │              Tool & Resource Registry          │   │
│   │  - System board & telemetry tools              │   │
│   │  - PBR rules management & packet tracer        │   │
│   │  - Zapret2 DPI status & strategy tester        │   │
│   │  - VPN handshake & node latency inspector      │   │
│   │  - UCI commit & apply bridge                   │   │
│   └───────────────────────┬────────────────────────┘   │
└───────────────────────────┼────────────────────────────┘
                            │ HTTP JSON-RPC (/ubus)
                            ▼
┌────────────────────────────────────────────────────────┐
│            OpenWrt Target Router (192.168.1.1)         │
└────────────────────────────────────────────────────────┘
```

---

## 2. Configuration & Quick Start

### Prerequisites
- Node.js 18+ (tested on Node v20/v24)
- Target OpenWrt router reachable via IP (default: `192.168.1.1`) or running in mock mode.

### Running the MCP Server
```bash
# From the project root
npm run mcp
```
or directly via `tsx`:
```bash
npx tsx mcp-server/src/index.ts
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `OPENWRT_HOST` | IP address or hostname of the OpenWrt router | `192.168.1.1` |
| `OPENWRT_USERNAME` | Ubus administrative username | `root` |
| `OPENWRT_PASSWORD` | Ubus administrative password | `root` |
| `OPENWRT_MOCK` | Set to `"true"` to run against simulated router state | `false` |

---

## 3. Client Configuration Examples

### A. Claude Desktop
Add this to your Claude Desktop configuration file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "openwrt": {
      "command": "node",
      "args": [
        "-e",
        "require('child_process').spawn('npx', ['tsx', '/path/to/openwrt-modern-panel/mcp-server/src/index.ts'], { stdio: 'inherit' })"
      ],
      "env": {
        "OPENWRT_HOST": "192.168.1.1",
        "OPENWRT_USERNAME": "root",
        "OPENWRT_PASSWORD": "root",
        "OPENWRT_MOCK": "false"
      }
    }
  }
}
```

Or using direct `npx`:
```json
{
  "mcpServers": {
    "openwrt": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/absolute/path/to/openwrt-modern-panel/mcp-server/src/index.ts"
      ],
      "env": {
        "OPENWRT_HOST": "192.168.1.1",
        "OPENWRT_USERNAME": "root",
        "OPENWRT_PASSWORD": "root"
      }
    }
  }
}
```

### B. Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "openwrt-router": {
      "command": "npx",
      "args": ["tsx", "mcp-server/src/index.ts"],
      "env": {
        "OPENWRT_HOST": "192.168.1.1",
        "OPENWRT_USERNAME": "root",
        "OPENWRT_PASSWORD": "root"
      }
    }
  }
}
```

### C. Antigravity (`mcp.json`)
```json
{
  "mcpServers": {
    "openwrt-admin": {
      "command": "npx",
      "args": ["tsx", "mcp-server/src/index.ts"],
      "env": {
        "OPENWRT_HOST": "192.168.1.1",
        "OPENWRT_USERNAME": "root",
        "OPENWRT_PASSWORD": "root"
      }
    }
  }
}
```

---

## 4. Exposed MCP Tools

### 1. `get_system_info`
Retrieves system board model, OpenWrt release version, kernel, uptime, and normalized load averages.
- **Parameters:** None.
- **Example Response:**
  ```json
  {
    "model": "MediaTek Filogic 820 Router (aarch64)",
    "release": "OpenWrt 25.12.6 r33311-981c978eff",
    "kernel": "6.12.112",
    "uptime_seconds": 184520,
    "load_average": {
      "1m": 0.12,
      "5m": 0.08,
      "15m": 0.05
    }
  }
  ```

### 2. `get_interfaces`
Lists all active network interfaces (`wan`, `lan`, `awg0`, etc.) along with IP addresses, link status, and RX/TX traffic counters.
- **Parameters:** None.

### 3. `get_pbr_rules`
Fetches all configured Policy-Based Routing policies from OpenWrt (`pbr` configuration).
- **Parameters:** None.
- **Example Response:**
  ```json
  [
    {
      "id": "pbr-zapret-1",
      "name": "DPI Bypass (YouTube / Discord / Notion) -> Zapret2",
      "enabled": true,
      "dest_addr": "youtube.com googlevideo.com discord.com notion.so",
      "proto": "tcp udp",
      "interface": "zapret"
    }
  ]
  ```

### 4. `add_pbr_rule`
Creates and stages a new policy routing rule.
- **Parameters:**
  - `name` (string): Descriptive rule name (e.g. `"Torrent to WAN"`).
  - `dest_addr` (string, optional): Target domain names, IP addresses, or CIDR subnets.
  - `src_addr` (string, optional): Source client IP or subnet.
  - `interface` (string): Target gateway/outbound (`zapret`, `singbox`, `awg0`, `wan`, `drop`).
  - `proto` (string, optional): Protocol (`tcp`, `udp`, `tcp udp`, `all`). Default: `"tcp udp"`.

### 5. `trace_pbr_route`
Simulates and traces which rule and gateway outbound traffic will match for a given domain or IP.
- **Parameters:**
  - `target` (string): Target domain or IP address (e.g. `"youtube.com"`).
- **Example Response:**
  ```json
  {
    "target": "youtube.com",
    "ip": "142.250.180.206",
    "rule": "DPI Bypass (YouTube / Discord / Notion) -> Zapret2",
    "interface": "zapret",
    "nexthop": "nfqws queue 200 (packet desync)"
  }
  ```

### 6. `get_zapret_status`
Queries the status and running profiles of the Zapret2 DPI circumvention engine (`nfqws` and `tpws`).
- **Parameters:** None.

### 7. `test_zapret_strategy`
Tests a DPI desynchronization strategy against a live domain.
- **Parameters:**
  - `domain` (string): Domain to probe (e.g. `"googlevideo.com"`).
  - `methods` (string array): Desync methods (`["fake", "disorder"]`).
  - `split_pos` (number): Packet split position.
  - `fooling` (string array): Fooling flags (`["md5sig", "badseq"]`).

### 8. `get_vpn_status`
Returns real-time status of configured VPN outbounds (AmneziaWG peer handshake, Sing-box Reality active node, and latency).
- **Parameters:** None.

### 9. `apply_uci_changes`
Commits staged UCI configurations and optionally reloads the relevant services.
- **Parameters:**
  - `config` (string): UCI config file name (e.g. `"pbr"`, `"network"`, `"firewall"`).
  - `reload_service` (boolean, optional): Whether to trigger service reload. Default: `true`.

---

## 5. Exposed MCP Resources

The MCP server exposes readable URI resources:

| Resource URI | Description | MIME Type |
|---|---|---|
| `openwrt://system/board` | Hardware model, CPU architecture, OpenWrt release information | `application/json` |
| `openwrt://routing/policies` | Current PBR policies and target gateways | `application/json` |
| `openwrt://circumvention/zapret` | Active Zapret2 configuration, desync flags, and hostlists | `application/json` |

---

## 6. Testing & Verifying with Stdio

You can verify the MCP server directly in the shell using standard JSON-RPC requests:

```bash
# Test tools/list
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx tsx mcp-server/src/index.ts

# Test trace_pbr_route for youtube.com
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"trace_pbr_route","arguments":{"target":"youtube.com"}}}' | npx tsx mcp-server/src/index.ts
```
