# ORBIX — Security Policy & Guidelines

## 1. Security Architecture Overview

ORBIX is designed around the principle of **Defense-in-Depth** for embedded network operating systems. It interacts with OpenWrt system services (`procd`, `netifd`, `uci`, `nftables`, `dnsmasq`, `sing-box`, `zapret`) using isolated, least-privilege interfaces.

```
┌───────────────────────────────────────────────┐
│              ORBIX Management UI             │
│        (Strict CSP, Sanitized DOM, SPA)       │
└───────────────────────┬───────────────────────┘
                        │ JSON-RPC (HTTP / HTTPS)
┌───────────────────────▼───────────────────────┐
│               uhttpd Web Server               │
│          (Localhost / LAN Binding Only)       │
└───────────────────────┬───────────────────────┘
                        │ Session Token / ACL Check
┌───────────────────────▼───────────────────────┐
│                     rpcd                      │
│            (OpenWrt RPC Daemon)               │
└───────────┬───────────────────────┬───────────┘
            │                       │
┌───────────▼───────────┐ ┌─────────▼───────────┐
│  Built-in RPC Modules │ │  ORBIX Backend RPC  │
│ (uci, file, sys, log) │ │   (/usr/libexec/    │
│                       │ │    rpcd/circumv)    │
└───────────────────────┘ └─────────┬───────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    │          Strict POSIX Validation & Safe Execution             │
    │  - Regex whitelisting for all network inputs (IP, FQDN, MAC)  │
    │  - Deterministic Process Group Watchdogs                      │
    │  - No eval, no shell word-splitting                           │
    └───────────────────────────────────────────────────────────────┘
```

---

## 2. Threat Model & Mitigations

### 2.1 Remote Network Compromise
- **Threat**: Attackers attempting to modify router routing tables or bypass authentication from the WAN side.
- **Mitigation**: uhttpd web interface and ubus endpoints are bound exclusively to the LAN bridge interface (`br-lan`) by default. WAN-side access to administrative ports (`80`, `443`, `ubus`) is strictly dropped by nftables rules.

### 2.2 Command & Shell Injection
- **Threat**: Malicious hostnames, domain names, or subscription URLs injected via Web UI inputs to execute arbitrary commands under the `root` account.
- **Mitigation**: Every parameter passed to backend shell scripts is parsed via `jsonfilter` and validated against strict POSIX regex patterns. Any input containing shell metacharacters (`;&|$\` etc.) or unexpected formats is rejected with an HTTP 200 JSON error before reaching any system binaries.

### 2.3 Accidental Lockout (Denial of Service)
- **Threat**: User applies invalid network, firewall, or LAN subnet settings, permanently severing connectivity to the management interface.
- **Mitigation**: ORBIX implements a **Zero-Lockout Transactional Engine**. Network modifications are applied under a hardware/software watchdog timer. If confirmation is not received within the timeout window (default 75 seconds), all configurations are atomically restored and services restarted.

### 2.4 Credential & Secret Exposure
- **Threat**: Exporting router configurations leaks WireGuard private keys, Wi-Fi pre-shared keys, or VPN credentials.
- **Mitigation**: Configuration exports support:
  1. **Secret Stripping**: Automatically masks all private keys, passwords, and tokens by default.
  2. **Zero-Knowledge Encryption**: Optional client-side AES-GCM 256-bit encryption with PBKDF2 (10,000 iterations) using a user-specified passphrase.

---

## 3. Reporting Security Vulnerabilities

We take security issues seriously. If you discover a security vulnerability in ORBIX, please do not open a public issue.

Instead, report it via:
- **Email**: `security@orbix.network` or `maintainer@cyberhard.org`
- **GitHub**: Security Advisory tab on [https://github.com/cyberhard/orbix/security/advisories](https://github.com/cyberhard/orbix/security/advisories)

Please include:
1. Affected version / commit SHA.
2. Step-by-step reproduction instructions or proof-of-concept.
3. Potential impact assessment.

Vulnerabilities will be triaged within 48 hours and patches deployed to the `main` branch.
