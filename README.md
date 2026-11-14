# ORBIX • OpenWrt Network Management Platform

[![OpenWrt Version](https://img.shields.io/badge/OpenWrt-25.12%20%2F%2024.10%20%2F%2023.05-blue.svg)](https://openwrt.org)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![UI Framework](https://img.shields.io/badge/UI-shadcn%2Fui%20zinc-black.svg)](https://ui.shadcn.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vitejs.dev)
[![Bundle Size](https://img.shields.io/badge/Bundle%20Size-~115%20KB%20gz-success.svg)](#)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A next-generation, high-performance web administration interface and network management platform for **OpenWrt routers**, designed with strict **shadcn/ui zinc** aesthetics. 

**ORBIX** transforms OpenWrt into an intuitive, visual, and secure networking platform for both home users and network engineers. Built directly on top of OpenWrt's native **ubus**, **UCI**, and **sysfs** architecture with **zero mocks or stubs**.

---

## Quick One-Line Installation

Connect to your OpenWrt router via SSH and run:

```sh
sh -c "$(wget -qO- https://raw.githubusercontent.com/cyberhard/orbix/main/scripts/install.sh)"
```

*Supports OpenWrt 21.02, 22.03, 23.05, 24.10, and 25.12+ (auto-detects `apk` and `opkg`).*

---

## Key Capabilities

### 1. Cisco Packet Tracer-Style Interactive Network Topology
- **Interactive SVG Canvas**: Visual infrastructure map with dot-matrix grid workspace.
- **Full Drag-and-Drop**: Reposition any node in real-time with automatic cable/link recalculation. Positions are saved persistently in `localStorage`.
- **Live Hardware & Client Detection**: Automatically maps Core Router (`192.168.1.1`), Internet WAN (`eth0`), Sing-box VLESS (`tun0`), Switch (`eth1-eth3`), Wi-Fi 5 GHz (`phy0.1-ap0`), Wi-Fi 2.4 GHz (`phy0.0-ap0`), and all active DHCP/ARP client hosts.
- **Port Status & Cable Indicators**: Real-time port dots, interface labels (`eth0`, `tun0`, `5GHz`, `2.4GHz`), and link speeds.
- **Node Inspector & Search**: Instant device inspection (IP, MAC, signal dBm, link speed, assigned routing rule) and live keyword search.
- **SVG Export**: One-click vector topology snapshot download.

### 2. First-Run Setup Wizard (`#/wizard`)
- **7-Step Guided Setup**:
  1. **Welcome**: Choose between **Simple Mode** (safe defaults) and **Expert Mode** (full network control).
  2. **Hardware Detection**: Auto-detects router model, SoC, RAM, flash overlay, network ports, and DPI/VPN acceleration.
  3. **Internet (WAN/LAN)**: IPoE/DHCP, PPPoE, Static IP with **Subnet Collision Resolver** (auto-shifts LAN to `192.168.2.1` if ISP assigns `192.168.1.x`).
  4. **Wi-Fi Radios**: Band Steering (Smart Connect 2.4G/5G), WPA2/WPA3 Mixed encryption, and isolated Guest Network.
  5. **Security & SSH**: Root password strength meter and Dropbear SSH hardening (LAN-only binding).
  6. **Bypass & Core Services**: One-click enable for Zapret2 (ALT11 strategy), RuNet Direct routing, Smart DNS, and VLESS Reality.
  7. **Safety Rollback Watchdog**: 75-second countdown timer reverts configuration if client connectivity is dropped.

### 3. Full Configuration JSON Backup & Migration (`#/backup`)
- **Versioned JSON Schema** (`openwrt-modern-panel` v1): Covers General, Network, Devices, Policies, VPN, DNS, Zapret, Firewall, and Lists.
- **Safe Export vs Encrypted Full Backup**: Scrubbed secrets for public sharing or **AES-256-GCM** (PBKDF2 100k iterations) encrypted backup with pure TypeScript fallback for plain HTTP (`http://192.168.1.1`).
- **Cross-Device Migration Engine**: Automatically resolves hardware differences and subnet conflicts when restoring to a different router model.
- **Restoration Modes**: Merge, Replace, or Selective section restore.

### 4. DPI Circumvention & Traffic Routing Suite
- **Zapret2 DPI Bypass**: Embedded `nfqws` engine running the battle-tested **ALT11 strategy** (`fake`, `disorder`, `multisplit`, `badseq`) for YouTube 1080p/4K and Discord voice unblocking.
- **RuNet Direct Routing**: Automatic direct unthrottled path for Russian services (.ru, .рф, banking, Gosuslugi) bypassing VPN tunnels.
- **Smart DNS Resolver**: Split-horizon resolution using Yandex DNS for domestic services and secure Google DoH/DoT for international domains.
- **Sing-box VLESS / Reality & AmneziaWG**: High-speed fallback proxy and obfuscated WireGuard tunnel (`Jc`, `Jmin`, `Jmax`, `S1`, `S2`, `H1–H4`).
- **Happ VPN Subscriptions**: Universal decoder for `happ://` and `https://` provider URLs with latency-based auto failover.

### 5. Universal Distribution & Hardware Catalog (`#/install`)
- Tested device profiles for MediaTek Filogic (**Netcraze NC-1812**, **Cudy WR3000**, **Xiaomi AX3000T**, **GL-MT3000**), **x86/64**, and Qualcomm IPQ40xx.
- Beginner-friendly flashing guide (Factory vs Sysupgrade, TFTP / U-Boot recovery).
- Automated ImageBuilder pipeline (`scripts/build-firmware.sh`) with SHA-256 checksums.

---

## Architecture & Technology Stack

```
ORBIX Web UI (React 19 + TypeScript + Vite 8 + Tailwind CSS + shadcn/ui zinc)
   │
   ├── JSON-RPC / ubus HTTP API
   │      ├── luci-rpc (getDHCPLeases, getWirelessDevices)
   │      ├── uci (get, set, commit, apply)
   │      └── circumvention (custom rpcd plugin: awg, zapret, pbr)
   │
   └── OpenWrt Host System (Linux 6.6 / musl libc)
          ├── nftables / fw4 (packet filtering & NAT)
          ├── nfqws (Zapret2 DPI desynchronization)
          ├── sing-box (XTLS Reality VLESS client)
          ├── amneziawg-go / kmod-amneziawg (obfuscated WireGuard)
          └── dnsmasq-full (split-horizon DNS & DHCP)
```

---

## Local Development & Building

### Prerequisites
- Node.js 20+ and npm

```bash
# Clone repository
git clone https://github.com/cyberhard/orbix.git
cd orbix

# Install dependencies
npm install

# Start local development server
npm run dev

# Build production bundle
npm run build
```

### Deploying to Router

```bash
tar -C dist -cf - . | ssh root@192.168.1.1 "tar -C /www -xf -"
```

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
