# ORBIX — Configuration Management Specification

## 1. Portable JSON Configuration Schema

ORBIX uses a declarative, versioned, hardware-independent JSON format (`orbix-config`).

### 1.1 Specification Header

```json
{
  "format": "orbix-config",
  "schema_version": 1,
  "orbix_version": "1.0.0",
  "openwrt_version": "25.12",
  "exported_at": "2026-11-14T15:00:00.000Z",
  "export_type": "full",
  "is_encrypted": false,
  "source": {
    "panel_version": "1.0.0",
    "openwrt_version": "25.12",
    "architecture": "aarch64",
    "board_name": "netcraze,nc-1812",
    "model": "Netcraze NC-1812",
    "hostname": "ORBIX-Router"
  },
  "metadata": {
    "description": "ORBIX Portable System Configuration",
    "checksum_sha256": "3fa85f64...",
    "included_sections": ["general", "network", "policies", "vpn", "dns", "zapret", "firewall"],
    "excluded_sections": [],
    "secrets_included": false
  },
  "configuration": { ... }
}
```

---

## 2. Configuration Sections

1. **`general`**: Hostname, timezone, NTP servers, theme, language, and operating mode (`simple` / `expert`).
2. **`network`**: Semantic interface roles (`wan`, `lan`, `guest`), IPv4/IPv6 static/DHCP protocols, subnets, and DNS servers.
3. **`devices`**: Device groups, MAC/IP bindings, friendly names, and group memberships.
4. **`policies`**: Unified Policy Engine rules (priority, sources, destinations, actions, and time conditions).
5. **`vpn`**: AmneziaWG / WireGuard endpoints, Sing-box VLESS nodes, subscription URLs, and outbound groups.
6. **`dns`**: DoH/DoT upstream servers, domain routing rules, and Smart DNS reverse proxies.
7. **`zapret`**: DPI desynchronization profiles (`ALT11`, `hostfakesplit`, `split-seqovl`), TCP/UDP target ports, and custom hostlists.
8. **`firewall`**: Custom forwarding rules, port mappings, and DMZ configurations.
9. **`lists`**: User-defined domain and IP categories.
10. **`diagnostics`**: Target ping hosts and retention settings.

---

## 3. Secret Protection & Encryption

- **Secret Masking**: By default, `includeSecrets: false` replaces all sensitive keys (WireGuard private keys, Wi-Fi PSK, VLESS UUIDs) with `[REDACTED]`.
- **AES-GCM Encryption**: When a passphrase is provided, the plaintext JSON configuration is encrypted using:
  - **Cipher**: AES-256-GCM
  - **Key Derivation**: PBKDF2 with SHA-256 (10,000 iterations)
  - **Salt & IV**: Cryptographically random 16-byte salt and 12-byte IV

---

## 4. Cross-Device Migration & Conflict Detection

When importing a configuration onto different hardware:
1. **Subnet Conflict Resolution**: Compares the imported LAN subnet against the target router's current WAN IP. If overlapping (e.g. both are `192.168.1.0/24`), the LAN IP is adapted to `192.168.2.1` to prevent route collision.
2. **Missing Package Warnings**: Scans for services referenced in the configuration (e.g. `sing-box`, `zapret`, `kmod-amneziawg`) and warns the user if packages need to be installed.
3. **Dry-Run Diff**: Renders a complete side-by-side diff before writing to the system.
4. **Atomic Rollback**: Applies changes under the Zero-Lockout watchdog timer (default 75s).
