# ORBIX — Architectural Specification & System Design

**Platform:** ORBIX (Universal Network Management Platform)  
**Target:** OpenWrt 21.02, 22.03, 23.05, 24.10, and 25.12+ (apk & opkg)  
**Design System:** shadcn/ui zinc (Strict monochromatic enterprise aesthetic)

---

## 1. High-Level Architectural Vision

ORBIX is a hardware-independent network management platform built on top of OpenWrt. It is not an alternative LuCI theme or a collection of ad-hoc scripts; it is a complete network management ecosystem providing its own:
- **Core API Gateway & Session Layer**: Native communication with OpenWrt system daemons.
- **Hardware Abstraction Layer (HAL)**: Dynamic probing of SoC, radios, memory, and package manager.
- **Unified Policy Engine**: Deterministic compilation of natural routing rules to PBR, Sing-box, and Zapret.
- **Security & Zero-Lockout Engine**: Transactional configuration changes with automated rollback.
- **Cisco Packet Tracer Topology Map**: Real-time visualization of all physical and logical network nodes.
- **Configuration Engine**: Portable, versioned, zero-knowledge encrypted JSON export/import.

```
┌────────────────────────────────────────────────────────────────────────┐
│                                ORBIX UI                                │
│       (shadcn/ui zinc • Packet Tracer Canvas • Basic / Expert Modes)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ JSON-RPC (HTTP / HTTPS)
┌───────────────────────────────────▼────────────────────────────────────┐
│                              ORBIX Core                                │
│   ┌───────────────────┬───────────────────┬────────────────────────┐   │
│   │    API Gateway    │   Authentication  │  Configuration Manager │   │
│   │   (/ubus client)  │   & Session State │    (orbix-config v1)   │   │
│   └───────────────────┴───────────────────┴────────────────────────┘   │
└───────────┬───────────────────────┬───────────────────────┬────────────┘
            │                       │                       │
┌───────────▼───────────┐ ┌─────────▼───────────┐ ┌─────────▼────────────┐
│    Network Engine     │ │   Security Engine   │ │ Hardware Abstraction │
│ - Interface Manager   │ │ - Firewall (nftables)││ - Arch detection     │
│ - DHCP / DNS Manager  │ │ - Policy Engine     │ │ - Wi-Fi 6/7 probing  │
│ - Wi-Fi Radio Manager │ │ - Zero-Lockout WD   │ │ - Package manager    │
│ - VLAN & QoS Manager  │ │ - VPN (VLESS/AWG)   │ │ - Resource telemetry │
└───────────┬───────────┘ └─────────┬───────────┘ └─────────┬────────────┘
            │                       │                       │
┌───────────▼───────────────────────▼───────────────────────▼────────────┐
│                         OpenWrt System Layer                           │
│     procd • netifd • uci • ubus • nftables/fw4 • dnsmasq • sing-box     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Decoupling from LuCI (LuCI Independence)

A core architectural principle of ORBIX is **zero mandatory dependence on LuCI**. ORBIX communicates directly with OpenWrt's core system daemons via `ubus`:

| Requirement | LuCI Approach (Legacy) | ORBIX Native Architecture |
|---|---|---|
| **DHCP Leases** | `luci-rpc:getDHCPLeases` | Primary: Reads `/tmp/dhcp.leases` via `file.read` ubus object. Secondary: `luci-rpc` if installed. |
| **ARP / Connected Hosts**| `luci-rpc:getHostHints` | Primary: Reads `/proc/net/arp` directly from kernel via `file.read`. |
| **Wireless Interfaces** | `luci-rpc:getWirelessDevices` | Primary: Queries `network.wireless status` (netifd) & `iwinfo info` directly. |
| **Service Control** | LuCI sys init | Direct procd `/etc/init.d/*` management via `rc` and `service` ubus namespaces. |
| **System Telemetry** | LuCI LuA modules | Direct `system.board`, `system.info`, and `network.device status` ubus calls. |

---

## 3. Unified Policy Engine Architecture

The **Policy Engine** serves as the single source of truth for all routing, VPN tunneling, DPI circumvention, and DNS dispatching:

```
User Policy Definition
  │ (e.g. "YouTube -> Zapret", "Discord -> Sing-box", "RU Sites -> Direct")
  ▼
Policy Validator & Conflict Detector (detects shadowing / contradictions)
  ▼
Deterministic Compiler
  ├──> /etc/config/pbr (Policy Based Routing tables & marks)
  ├──> /etc/sing-box/config.json (VLESS Reality routing rules)
  ├──> /opt/zapret/init.d/sysv/zapret (NFQWS hostlists: general, google, exclude)
  └──> /etc/config/dhcp (Split DNS forwarders: Yandex for RU, Google DoH for bypass)
  ▼
Zero-Lockout Transactional Commit
```

---

## 4. Zero-Lockout Engine (Safety Watchdog)

Any modification to network interfaces, firewall rules, or routing marks presents a risk of administrator lockout. ORBIX implements a fail-safe transactional workflow:

1. **Snapshot**: Copies `/etc/config/*` and `/etc/sing-box/*` to `/tmp/uci_rollback_backup/`.
2. **Arm Watchdog**: Generates a cryptographically random token and launches an independent background watchdog timer, saving its PID to `/tmp/uci_watchdog.pid`.
3. **Apply Changes**: Reloads network, firewall, and routing services.
4. **Connectivity Probe**: The browser initiates an echo handshake against `/ubus`.
5. **Confirmation**:
   - If user confirms (or connectivity handshake succeeds), the watchdog process tree is cleanly terminated via PID tracking (`kill -9 $CHILDREN $WD_PID`).
   - If connectivity fails or the countdown expires (default 75s), the watchdog automatically restores configs from `/tmp/uci_rollback_backup/` and reloads all services.

---

## 5. Technology Stack & Footprint

- **Frontend Core**: React 19, TypeScript 5.8+, Vite 8, Zustand 5, TanStack Query 5.
- **UI Components**: shadcn/ui zinc (Radix UI primitives), Lucide React.
- **Styling**: Tailwind CSS v3, CSS variables for dark/light modes.
- **Backend**: Native OpenWrt `rpcd`, Busybox `ash` POSIX shell, `jshn.sh`, `jsonfilter`.
- **Packaging**: Gzip + Brotli pre-compressed static assets (~140 KB total transferred over wire).
