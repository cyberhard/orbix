# ORBIX — Hardware & Platform Compatibility

## 1. Supported Hardware Architectures

ORBIX utilizes a dynamic Hardware Abstraction Layer (HAL) that detects capabilities at runtime rather than relying on static model whitelists.

| Architecture | Classification | Target SoC Families | Feature Support |
|---|---|---|---|
| **ARM64 (`aarch64`)** | **Tier 1 (Optimal)** | MediaTek Filogic (MT7981, MT7986, MT7988), Rockchip (RK3399, RK3568, RK3588), Qualcomm IPQ807x, Broadcom BCM2711 | Full support: Wi-Fi 6/7, WireGuard, AmneziaWG, Sing-box VLESS, Zapret NFQWS, hardware crypto offloading. |
| **ARMv7 (`arm`)** | **Tier 1 (Fully Supported)** | Qualcomm IPQ40xx, Marvell Armada 38x, Broadcom BCM53xx | Full support: WireGuard, Sing-box, Zapret, PBR routing. |
| **x86_64 (`amd64`)** | **Tier 1 (Enterprise / Virtualized)** | Intel Celeron/Core, AMD Ryzen, Proxmox VE, ESXi, Bare metal mini-PCs | Full support: Multi-gigabit routing, high-concurrency VPN outbounds, container virtualization. |
| **MIPS / MIPSEL** | **Tier 2 (Supported with Limits)** | MediaTek MT7621, MT7628, Atheros AR9344 | PBR and Zapret supported. Heavy cryptographic tunnels (VLESS Reality) may be CPU-constrained. |

---

## 2. Wireless Chipset & Generation Support

ORBIX supports standard Linux `mac80211` and `hostapd` stacks:
- **Wi-Fi 7 (`802.11be` / EHT)**: Fully supported with 320 MHz channel detection and multi-band steering.
- **Wi-Fi 6 (`802.11ax` / HE)**: Tested on MediaTek MT7981 / MT7986 (Filogic).
- **Wi-Fi 5 (`802.11ac` / VHT)** & **Wi-Fi 4 (`802.11n` / HT)**: Standard legacy fallback.
- **WPA3 SAE & OWE**: Detected and configurable via Wireless settings.

---

## 3. OpenWrt Version Compatibility

| OpenWrt Version | Package Manager | Firewall Backend | Status |
|---|---|---|---|
| **OpenWrt 25.12+ / Master** | `apk` | `nftables` | **Native Support (Tested Baseline)** |
| **OpenWrt 24.10** | `opkg` | `nftables` | **Fully Supported** |
| **OpenWrt 23.05** | `opkg` | `nftables` | **Fully Supported** |
| **OpenWrt 22.03** | `opkg` | `nftables` | **Supported** |
| **OpenWrt 21.02** | `opkg` | `iptables` | **Supported (Legacy fallback)** |

---

## 4. Hardware Capability Matrix

The Hardware Abstraction Layer exposes the following capability tokens to UI modules:

```json
{
  "hardware": {
    "architecture": "aarch64",
    "packageManager": "apk",
    "ramTotalMb": 512,
    "storageTotalMb": 128
  },
  "network": {
    "vlanSupported": true,
    "hardwareOffloading": true,
    "firewallBackend": "nftables"
  },
  "wireless": {
    "supported": true,
    "wifi6Supported": true,
    "bandSteeringSupported": true
  },
  "services": {
    "wireguard": true,
    "amneziawg": true,
    "singboxVless": true,
    "zapretDpi": true,
    "pbrRouting": true
  }
}
```
If a feature is unsupported or missing required packages, the UI gracefully disables the controls and presents actionable instructions.
