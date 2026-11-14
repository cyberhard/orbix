# OpenWrt Modern Admin Panel — Architecture Documentation

This document describes the design, system architecture, integration points, and security constraints of the **OpenWrt Modern Admin Panel**, a modern web interface built to replace LuCI while providing native management for censorship circumvention tools, VPN protocols, and policy-based routing.

---

## 1. High-Level Architectural Overview

The system is split into two primary layers:
1. **Frontend SPA (Single-Page Application):** Static assets built with React 18, Vite, TypeScript, Tailwind CSS, and shadcn/ui components. Served directly by OpenWrt's native web server (`uhttpd`).
2. **Backend Services (OpenWrt System Layer):** Built entirely on standard OpenWrt primitives (`rpcd`, `ubus`, `uci`, `nftables`/`fw4`) without installing heavy runtimes like Node.js or Python on the router.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Browser (Client)                          │
│                                                                        │
│   React 18 SPA (shadcn/ui + Tailwind CSS + TanStack Query + Zustand)  │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ HTTP JSON-RPC (POST /ubus)
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      OpenWrt Router (192.168.1.1)                      │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │               uhttpd (Port 80 / 443 Web Server)                │   │
│   │   - Serves static /www assets (HTML, CSS, JS, Gzip/Brotli)     │   │
│   │   - Proxies JSON-RPC requests to /ubus unix domain socket      │   │
│   └─────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                      │
│                                 ▼                                      │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                    rpcd (Ubus RPC Daemon)                      │   │
│   │   - Session & authentication (/usr/libexec/rpcd/session)       │   │
│   │   - UCI configuration RPC (/usr/libexec/rpcd/uci)              │   │
│   │   - System & package RPC (/usr/libexec/rpcd/system, opkg/apk)  │   │
│   │   - Custom Circumvention RPC (/usr/libexec/rpcd/circumvention) │   │
│   └───────────────┬───────────────────────────────┬────────────────┘   │
│                   │                               │                    │
│                   ▼                               ▼                    │
│   ┌───────────────────────────────┐  ┌─────────────────────────────┐   │
│   │   Standard OpenWrt Subsystems │  │   Circumvention & Routing   │   │
│   │   - netifd (Interfaces/VLANs) │  │   - zapret2 (nfqws / tpws)  │   │
│   │   - dnsmasq (DHCP & DNS)      │  │   - AmneziaWG (awg-tools)   │   │
│   │   - fw4 / nftables (Firewall) │  │   - sing-box / xray (VLESS) │   │
│   │   - dropbear (SSH daemon)     │  │   - pbr (Policy Routing)    │   │
│   └───────────────────────────────┘  └─────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Technology Stack & Footprint

| Layer | Technology | Rationale / Benefits |
|---|---|---|
| **Framework** | React 18 + Vite 8 | Fast cold start, modular code splitting, sub-second HMR in dev. |
| **Component System** | **shadcn/ui** (Radix UI primitives) | Headless accessibility, zero bloated runtime CSS, highly customizable via Tailwind utility classes. |
| **Styling** | Tailwind CSS v3 | Purges unused classes in production; dark/light theme support via CSS variables. |
| **State Management** | Zustand | Zero-boilerplate local state for theme, i18n, authentication, and UCI staging bar. |
| **Data Fetching** | TanStack Query v5 | Automated background polling (traffic graphs, interface stats, handshake counters) and cache invalidation. |
| **Icons** | Lucide React | High-contrast SVG icons with tree-shaking for minimal footprint. |
| **Bundle Footprint** | ~166 KB gzipped total | Extremely lightweight; compresses into less than 0.2 MB in router flash memory. |

---

## 3. Communication Protocol (ubus JSON-RPC)

All interactions between the web frontend and OpenWrt are executed via standard `ubus` JSON-RPC 2.0 calls sent to `/ubus`:

```http
POST /ubus HTTP/1.1
Host: 192.168.1.1
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "call",
  "params": [
    "<session_id>",
    "system",
    "info",
    {}
  ]
}
```

### Response Signature:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    0,
    {
      "uptime": 184520,
      "load": [8192, 5242, 3276],
      "memory": {
        "total": 513978368,
        "free": 509890560,
        "shared": 0,
        "buffered": 0
      }
    }
  ]
}
```
*Note on OpenWrt Load Average:* Load averages returned by `system.info` are represented as 16-bit fixed-point integers (multiplied by 65536). The frontend normalizes them: `val > 100 ? val / 65536 : val`.

---

## 4. Custom Backend RPC Plugin (`circumvention`)

To avoid heavy third-party runtimes on the router, custom administrative commands (such as testing Zapret2 DPI desynchronization strategies, checking Sing-box outbounds, and tracing PBR routing) are handled by a lightweight shell plugin conforming to OpenWrt's `rpcd` executable convention.

- **Plugin Location:** `/usr/libexec/rpcd/circumvention`
- **ACL Definition:** `/usr/share/rpcd/acl.d/circumvention.json`

### Supported RPC Methods:
- `circumvention.awg_status`: Query active AmneziaWG peer handshakes and TX/RX bytes.
- `circumvention.awg_genkey`: Generate WireGuard / AmneziaWG keypairs on-the-fly.
- `circumvention.zapret_status`: Check `nfqws` / `tpws` daemon health and active queue numbers.
- `circumvention.zapret_test_strategy`: Run an isolated TLS/HTTP probe against a target domain using specified desync parameters.
- `circumvention.vless_status`: List configured VLESS/Sing-box outbounds and active routes.
- `circumvention.singbox_test_node`: Measure TCP handshake and TLS roundtrip latency to a proxy node.
- `circumvention.podkop_status`: Check Podkop feed status and enabled service sets.
- `circumvention.podkop_update`: Download updated service sets and reload firewall ipsets.
- `circumvention.pbr_status`: Read configured policy routing rules and target gateways.
- `circumvention.pbr_trace`: Trace routing resolution for a domain or IP through the active ruleset.

---

## 5. UCI Staging & Apply Workflow

To prevent accidental lockouts or broken network states, configuration updates follow the OpenWrt **Staging Bar pattern**:

1. **Local Staging:** Edits in the UI are staged in memory.
2. **UCI Diff Inspection:** Users can review an exact JSON/Unified Diff of all modified files (`/etc/config/*`).
3. **Save & Apply:** The frontend calls:
   - `uci.commit({ config: "..." })`
   - Reloads specific services (`/etc/init.d/<service> reload`) via `rc.init` or `file.exec`.
4. **Revert:** Users can discard all uncommitted changes in one click via `uci.revert`.

---

## 6. LuCI Coexistence and Safety Guardrails

- **Zero-Disruption Architecture:** The modern admin panel replaces `/www/index.html`, but preserves original LuCI at `/www/luci.html` and `/cgi-bin/luci`.
- **Pre-deployment Router Backups:** Backups of `/etc/config/` and `/usr/share/rpcd/` are stored under `/root/backup/` before any file modifications.
- **Fail-safe Network Access:** SSH daemon (`dropbear`) access on port 22 remains untouched and accessible at all times.
