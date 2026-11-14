# ORBIX — Comprehensive Project Audit & Technical Baseline

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-14  
**Auditor:** Principal Software Architect & Network Security Engineer  
**Target Repository:** `https://github.com/cyberhard/orbix`  
**Target Hardware Baseline:** Netcraze NC-1812 (MediaTek Filogic 820 MT7981, 2x ARM Cortex-A53, 512MB RAM, OpenWrt 25.12.6 r33311-981c978eff)

---

## 1. Executive Summary

ORBIX has made significant architectural strides, evolving from a simple administrative dashboard into a comprehensive Network Management Platform. It features a Unified Policy Engine, Cisco Packet Tracer-style network topology visualization, automated First-Run Setup Wizard, portable encrypted JSON configuration management, and DPI/VPN routing engines.

However, moving to **Production Ready** status requires resolving several critical technical and architectural challenges:
1. **Eliminating LuCI Dependencies**: Complete independence from `luci-rpc` by providing native OpenWrt fallbacks (via `/tmp/dhcp.leases`, `iwinfo`, and `/proc/net/arp`).
2. **Security Hardening**: Remediation of shell-argument injection risks, POSIX-compliant input validation, eliminating hardcoded fallback keys, and hardening RPCD ACL permissions.
3. **Deterministic Zero-Lockout Watchdog**: Replacing unreliable process killing (`killall uci_watchdog.sh`) with strict PID tracking and subshell termination to guarantee recovery from bad network configurations.
4. **Testing Infrastructure**: Bootstrapping an automated test suite (`vitest`) for compiler, validator, crypto, and migrator logic.
5. **Universal Distribution**: Enhancing `install.sh` with safe pre-install backups, health checks, updates, and clean uninstallation.

---

## 2. Component Audit Table

| Module / Component | Path / File | Status | Identified Problems & Risks | Priority | Proposed Solution |
|---|---|---|---|---|---|
| **RPCD Backend** | `rpcd-circumvention.sh` | **Functional** | Lack of strict regex validation on inputs (domain, IP, URL); `printf "%b"` interprets escape sequences; PID tracking for watchdog lacks process group cleanup; hardcoded Happ API key. | **Critical** | Implement strict POSIX input sanitization; replace `printf "%b"` with `printf "%s"`; save watchdog PID in `/tmp/uci_watchdog.pid` and kill process tree; sanitize URLs. |
| **Testing Infrastructure** | `package.json` | **Missing** | No test runner configured (`vitest`/`jest`). Zero automated unit or integration tests exist in repository. | **Critical** | Install `vitest`; configure `npm test`; write comprehensive test suites for compiler, crypto, validator, and migrator. |
| **RPCD ACL Configuration** | `rpcd-circumvention-acl.json` | **Functional** | Permissions grant `*` access to circumvention methods; needs granular read/write separation to enforce least privilege. | **High** | Split read methods (`status`, `trace`, `list`) and write methods (`arm_rollback`, `import`, `set_rule`) in ACL. |
| **Zero-Lockout Network Watchdog** | `rpcd-circumvention.sh`, `rollback-store.ts` | **Functional** | Busybox ash names background scripts `sh`, causing `killall uci_watchdog.sh` to fail; child `sleep` process is orphaned until timeout. | **High** | Record watchdog PID; use `kill -TERM "$PID" $(pgrep -P "$PID")` on confirmation; implement automated connectivity handshake. |
| **LuCI RPC Decoupling** | `src/lib/ubus-client.ts` | **Functional** | Hard dependencies on `luci-rpc:getDHCPLeases`, `luci-rpc:getHostHints`, and `luci-rpc:getWirelessDevices`. Fails on clean OpenWrt without LuCI. | **High** | Implement native fallback: query `/tmp/dhcp.leases` via `file.read` or custom rpcd, query `iwinfo` ubus object directly, read `/proc/net/arp`. |
| **Configuration Schema & Versioning** | `src/services/config/schema.ts` | **Functional** | Format identifier was `openwrt-modern-panel` instead of `orbix-config`; schema migration lacked explicit migration adapter for future v2. | **High** | Support `orbix-config` as primary identifier while retaining backward compatibility for `openwrt-modern-panel`. |
| **Hardware Abstraction Layer (HAL)** | `src/services/wizard/hardware-detector.ts` | **Functional** | HAL logic is embedded inside wizard service rather than being an independent system module for the whole platform. | **High** | Extract into standalone `src/services/hal/` module; expose system capabilities to all UI components. |
| **Universal Installer** | `scripts/install.sh` | **Functional** | Overwrites `/www` directly without backing up existing web UI; lacks `--uninstall`, `--update`, and `--health-check` CLI options. | **High** | Implement pre-install backup to `/www.orbix.bak`, add `--update`, `--uninstall`, and post-install health verification. |
| **Unified Policy Engine** | `src/services/policy-engine/` | **Functional** | Complex compilation to sing-box and zapret has no automated test verification; edge cases in priority shadowing not tested. | **Medium** | Author automated unit tests for compiler, conflict detector, and priority evaluator. |
| **Topology Map (Packet Tracer)** | `src/views/traffic/TrafficFlow.tsx` | **Functional** | Nodes use localStorage for positioning; needs graceful auto-layout fallback when localStorage is empty or device count is large. | **Medium** | Add deterministic layered hierarchical layout fallback and SVG export validation. |
| **Authentication & Sessions** | `src/views/auth/LoginView.tsx`, `auth-store.ts` | **Functional** | Plaintext session token in localStorage; no client-side brute-force throttling or lockouts. | **Medium** | Add exponential backoff on login failures; ensure session purge on 401/403 events. |
| **Firmware Build System** | `scripts/build-firmware.sh` | **Functional** | Relies on OpenWrt ImageBuilder; lacks automated image verification checksum generation and unattended profile builds. | **Low** | Add SHA256 checksum generation and support for additional target profiles (x86_64, MT7621). |

---

## 3. Discovered Vulnerabilities & Architectural Debt

### 3.1 Security Findings
1. **Watchdog Race Condition & Process Leakage**:
   - In `rpcd-circumvention.sh`, `killall -q uci_watchdog.sh` does not kill the process under Busybox because `/proc/$PID/comm` is `sh`. The orphaned `sleep` continues to execute, and if a second rollback is armed before the sleep expires, unexpected rollbacks occur.
2. **Missing Input Validation in Shell Handlers**:
   - Methods such as `zapret_test_strategy`, `pbr_trace`, and `sub_decrypt_fetch` accept parameters (`domain`, `target`, `url`) without strict FQDN/IP regex validation.
3. **Hardcoded Fallback Credentials**:
   - `sub_decrypt_fetch` contains a hardcoded fallback API key for Happy-Decoder (`hd_889c...`). This must be removed in favor of user-provided configuration.
4. **LuCI RPC Coupling**:
   - `ubusClient` relies on `luci-rpc` for DHCP leases and wireless info, which violates the core mandate of LuCI independence.

---

## 4. Prioritized Evolution Roadmap

```
[Phase 1: Security & Backend Hardening]
  ├── Fix watchdog PID tracking & subshell termination
  ├── Implement strict input validation in RPCD backend
  ├── Remove hardcoded API keys
  └── Enforce least-privilege RPCD ACLs

[Phase 2: Configuration Reliability & Zero-Lockout Engine]
  ├── Update schema format to 'orbix-config' with backward compatibility
  ├── Implement atomic commit with connectivity probe handshake
  └── Enhance dry-run diff analysis and conflict detection

[Phase 3: Core API & LuCI Independence]
  ├── Implement native OpenWrt fallbacks in ubusClient (dhcp.leases, iwinfo, /proc/net/arp)
  └── Isolate and formalize Hardware Abstraction Layer (HAL) in src/services/hal/

[Phase 4: Testing & Reliability Infrastructure]
  ├── Setup Vitest runner in package.json
  ├── Unit tests: Policy compiler, schema validator, migrator, crypto
  └── Integration test: Zero-lockout rollback flow simulation

[Phase 5: Universal Installer & Maintenance]
  ├── Add --install, --update, --uninstall, and --health-check to scripts/install.sh
  └── Implement pre-install backup and recovery mechanism

[Phase 6: Documentation Suite]
  └── Complete docs: ARCHITECTURE, SECURITY, SECURITY_AUDIT, INSTALLATION, COMPATIBILITY, CONFIGURATION, API, DEVELOPMENT, ROADMAP
```

---

## 5. Verification & Testing Baseline

Every implemented phase will be verified using:
1. Automated unit test execution (`npm test` via Vitest).
2. Code review and syntax validation (`sh -n` for shell scripts, `npm run build` for TypeScript/React).
3. Real hardware deployment and live verification via ADB (`1e06f7a60406` Redmi Note 9) and SSH to target router (`192.168.1.1`).
