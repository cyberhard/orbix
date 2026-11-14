# ORBIX — Installation & Deployment Guide

## 1. Prerequisites & System Requirements

ORBIX is hardware-independent and designed to operate on OpenWrt routers.

### 1.1 Minimum Hardware Specifications
- **Architecture**: ARM64 (`aarch64`), ARMv7 (`arm`), x86_64, MIPS / MIPSEL.
- **RAM**: 128 MB minimum (256 MB+ recommended for high-throughput VLESS/WireGuard routing).
- **Storage**: Minimum 16 MB free in `/overlay` for packages and frontend assets.
- **OpenWrt Releases**: 21.02, 22.03, 23.05, 24.10, 25.12+ (compatible with both `opkg` and `apk`).

### 1.2 Package Dependencies
- `uhttpd`: Lightweight HTTP web server.
- `rpcd`, `rpcd-mod-file`: System RPC daemon and file access plugins.
- `jsonfilter`, `libubox`: POSIX JSON filtering and serialization.
- `ca-certificates`, `curl`: Secure HTTPS connectivity and remote probes.
- *(Optional for specific features)*: `sing-box`, `zapret`, `pbr`, `kmod-amneziawg`, `iwinfo`.

---

## 2. One-Line Universal Installation

To install or upgrade ORBIX directly on an active OpenWrt router, run:

```sh
curl -sSL https://raw.githubusercontent.com/cyberhard/orbix/main/scripts/install.sh | sh
```

The universal installer automatically:
1. Detects system release and package manager (`apk` vs `opkg`).
2. Verifies storage space and memory availability.
3. Automatically backs up any existing web interface in `/www` to `/www.orbix.bak`.
4. Installs missing OpenWrt dependencies.
5. Deploys the hardened RPCD backend (`/usr/libexec/rpcd/circumvention`) and ACL permissions (`/usr/share/rpcd/acl.d/circumvention.json`).
6. Unpacks the modern SPA frontend into `/www`.
7. Configures `uhttpd` and restarts system services.
8. Executes an automated health verification check.

---

## 3. Maintenance CLI Options

The installer script (`scripts/install.sh`) also acts as a lifecycle maintenance utility:

### 3.1 Health Check & Diagnostics
Verify status of services, ubus registration, and storage:
```sh
/bin/sh /www/scripts/install.sh --health-check
```

### 3.2 Update ORBIX to Latest Release
Update Web UI and backend RPC scripts without reinstalling system dependencies:
```sh
/bin/sh /www/scripts/install.sh --update
```

### 3.3 Safe Uninstallation
Restore the previous web interface from backup and remove ORBIX services cleanly:
```sh
/bin/sh /www/scripts/install.sh --uninstall
```

---

## 4. Manual / Offline Installation

If the target router does not have direct Internet access:

1. Build the production bundle on a development machine:
   ```sh
   git clone https://github.com/cyberhard/orbix.git
   cd orbix
   npm install
   npm run build
   ```
2. Transfer files to the router via SSH / SCP:
   ```sh
   # Deploy RPCD backend and ACL
   ssh root@192.168.1.1 "cat > /usr/libexec/rpcd/circumvention" < rpcd-circumvention.sh
   ssh root@192.168.1.1 "chmod +x /usr/libexec/rpcd/circumvention"
   ssh root@192.168.1.1 "cat > /usr/share/rpcd/acl.d/circumvention.json" < rpcd-circumvention-acl.json

   # Deploy Web UI assets
   tar -C dist -czf - . | ssh root@192.168.1.1 "tar -C /www -xzf -"
   ```
3. Restart router services:
   ```sh
   ssh root@192.168.1.1 "/etc/init.d/rpcd restart && /etc/init.d/uhttpd restart"
   ```
4. Access the panel at `http://192.168.1.1/#/overview`.
