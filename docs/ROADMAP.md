# ORBIX — Production Evolution Roadmap

## Phase 1: Security Hardening & Zero-Lockout (Completed)
- [x] Complete security audit of RPCD backend.
- [x] Fixed orphaned watchdog processes in Busybox ash by tracking PIDs and killing process groups.
- [x] Implemented strict POSIX regex sanitization on all IP, domain, URL, and port parameters.
- [x] Enforced least-privilege RPCD ACL permissions separating read and write methods.
- [x] Removed hardcoded third-party API credentials.
- [x] Automated unit and integration test suite via Vitest (100% pass rate).

## Phase 2: Configuration Reliability & LuCI Decoupling (Completed)
- [x] Standardized configuration schema on `orbix-config` format with legacy backward compatibility.
- [x] Implemented zero-knowledge AES-256-GCM encryption with PBKDF2 for backup packages.
- [x] Added automated subnet conflict detection and LAN IP adaptation in `ConfigMigrator`.
- [x] Decoupled `ubusClient` from `luci-rpc`, adding native fallbacks for `/tmp/dhcp.leases`, `/proc/net/arp`, and `network.wireless`.
- [x] Isolated Hardware Abstraction Layer into `src/services/hal/`.

## Phase 3: Universal Distribution & Lifecycle (Completed)
- [x] Enhanced `scripts/install.sh` with `--install`, `--update`, `--uninstall`, and `--health-check` CLI options.
- [x] Added automatic pre-install backup of `/www` to `/www.orbix.bak` to protect existing web interfaces.
- [x] Full packaging into lightweight compressed bundles (`dist/index.html.gz`, `dist/assets/*.gz`).

## Phase 4: Enterprise Networking & Multi-WAN (Q1 2027)
- [ ] Policy Engine support for dynamic Multi-WAN failover (mwan3 integration).
- [ ] WireGuard peer QR code generator directly in the UI.
- [ ] BGP / OSPF dynamic routing integration for advanced enterprise deployments.
- [ ] Time-of-day scheduled policy automation (parental controls & bedtime filters).

## Phase 5: Distributed Fleet Management (Q2 2027)
- [ ] Centralized ORBIX Cloud / Fleet Controller for managing multiple OpenWrt routers.
- [ ] Mutual TLS (mTLS) encrypted management tunnel.
- [ ] Automated configuration sync and differential firmware upgrades across router clusters.
