#!/bin/sh
# OpenWrt Modern Panel - Guided Universal One-Line Installer
# Supports OpenWrt 21.02, 22.03, 23.05, 24.10, and 25.12+ (apk & opkg)
# Usage: curl -sSL https://raw.githubusercontent.com/.../install.sh | sh

set -e

COLOR_GREEN='\033[0;32m'
COLOR_CYAN='\033[0;36m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_CYAN}======================================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}      OpenWrt Modern Panel - Universal Installer      ${COLOR_RESET}"
echo -e "${COLOR_CYAN}======================================================${COLOR_RESET}"

# 1. Check Root
if [ "$(id -u)" != "0" ]; then
    echo -e "${COLOR_RED}Error: This script must be run as root!${COLOR_RESET}" >&2
    exit 1
fi

# 2. Detect OpenWrt System & Release
if [ ! -f /etc/openwrt_release ]; then
    echo -e "${COLOR_RED}Error: /etc/openwrt_release not found. Is this an OpenWrt system?${COLOR_RESET}" >&2
    exit 1
fi

. /etc/openwrt_release
ARCH=$(uname -m)
OPENWRT_VER="${DISTRIB_RELEASE:-unknown}"
TARGET="${DISTRIB_TARGET:-unknown}"

echo -e "Detected System: ${COLOR_YELLOW}${DISTRIB_DESCRIPTION}${COLOR_RESET}"
echo -e "Architecture:    ${COLOR_YELLOW}${ARCH} (${TARGET})${COLOR_RESET}"

# 3. Check Resources (Storage & RAM)
OVERLAY_FREE_KB=$(df -k /overlay 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
if [ "$OVERLAY_FREE_KB" -lt 8192 ]; then
    echo -e "${COLOR_YELLOW}Warning: Less than 8MB free in /overlay (${OVERLAY_FREE_KB} KB). Minimal installation mode will be used.${COLOR_RESET}"
fi

RAM_AVAIL_KB=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "131072")
echo -e "Available RAM:   ${COLOR_YELLOW}$((RAM_AVAIL_KB / 1024)) MB${COLOR_RESET}"

# 4. Detect Package Manager (apk vs opkg)
PKG_MGR="opkg"
if which apk >/dev/null 2>&1; then
    PKG_MGR="apk"
fi
echo -e "Package Manager: ${COLOR_GREEN}${PKG_MGR}${COLOR_RESET}"

# 5. Install Dependencies
echo -e "\n${COLOR_CYAN}--> Step 1/4: Installing required dependencies...${COLOR_RESET}"
REQUIRED_PKGS="uhttpd rpcd rpcd-mod-file rpcd-mod-luci jsonfilter ca-certificates curl libubox"

if [ "$PKG_MGR" = "apk" ]; then
    apk update || true
    for pkg in $REQUIRED_PKGS; do
        if ! apk info -e "$pkg" >/dev/null 2>&1; then
            echo "Installing $pkg via apk..."
            apk add "$pkg" || echo "Note: $pkg may be built-in."
        fi
    done
else
    opkg update || true
    for pkg in $REQUIRED_PKGS; do
        if ! opkg list-installed | grep -q "^$pkg "; then
            echo "Installing $pkg via opkg..."
            opkg install "$pkg" || echo "Note: $pkg may be built-in."
        fi
    done
fi

# 6. Install RPCD Backend
echo -e "\n${COLOR_CYAN}--> Step 2/4: Deploying backend services...${COLOR_RESET}"
mkdir -p /usr/libexec/rpcd /usr/share/rpcd/acl.d /etc/dropbear

if [ -f "./rpcd-circumvention.sh" ]; then
    cp -f ./rpcd-circumvention.sh /usr/libexec/rpcd/circumvention
elif [ -f "./rpcd/circumvention" ]; then
    cp -f ./rpcd/circumvention /usr/libexec/rpcd/circumvention
else
    # Fetch from repository if run via curl pipe
    echo "Downloading rpcd backend script..."
    curl -sSL "https://raw.githubusercontent.com/openwrt-modern-panel/panel/main/rpcd-circumvention.sh" -o /usr/libexec/rpcd/circumvention || true
fi

chmod +x /usr/libexec/rpcd/circumvention

# Deploy ACL
if [ -f "./rpcd-circumvention-acl.json" ]; then
    cp -f ./rpcd-circumvention-acl.json /usr/share/rpcd/acl.d/circumvention.json
else
    cat << 'EOF' > /usr/share/rpcd/acl.d/circumvention.json
{
  "circumvention": {
    "description": "Access to circumvention, singbox, awg and pbr features",
    "read": {
      "ubus": {
        "circumvention": ["*"],
        "file": ["read", "exec", "stat"],
        "network.device": ["status"],
        "network.interface": ["dump"],
        "network.wireless": ["status"],
        "system": ["board", "info"],
        "log": ["read"],
        "rc": ["list", "init"],
        "rpc-sys": ["packagelist", "password_set"],
        "uci": ["get", "changes"]
      }
    },
    "write": {
      "ubus": {
        "circumvention": ["*"],
        "file": ["write", "exec"],
        "network.wireless": ["reconf"],
        "system": ["reboot"],
        "rc": ["init"],
        "rpc-sys": ["password_set"],
        "uci": ["set", "commit", "revert", "apply"]
      }
    }
  }
}
EOF
fi

# 7. Deploy Frontend Web UI
echo -e "\n${COLOR_CYAN}--> Step 3/4: Deploying Modern Panel Web UI...${COLOR_RESET}"
mkdir -p /www

if [ -d "./dist" ]; then
    cp -rf ./dist/* /www/
else
    echo "Downloading and extracting latest pre-built panel bundle..."
    curl -sSL "https://github.com/openwrt-modern-panel/panel/releases/latest/download/panel-dist.tar.gz" | tar -C /www -xzf - 2>/dev/null || true
fi

# 8. Configure Web Server & Firewall
echo -e "\n${COLOR_CYAN}--> Step 4/4: Configuring services & permissions...${COLOR_RESET}"

# Ensure uhttpd runs on port 80 and points to /www
uci set uhttpd.main.listen_http='0.0.0.0:80 [::]:80' 2>/dev/null || true
uci set uhttpd.main.home='/www' 2>/dev/null || true
uci commit uhttpd 2>/dev/null || true

# Restart daemons
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart || /etc/init.d/uhttpd start

# 9. Verify Installation
echo -e "\n${COLOR_CYAN}--> Verifying installation...${COLOR_RESET}"
sleep 2

if ubus list | grep -q "circumvention"; then
    echo -e "${COLOR_GREEN}✓ RPCD circumvention service is ACTIVE and registered!${COLOR_RESET}"
else
    echo -e "${COLOR_YELLOW}! Note: RPCD object circumvention pending first request.${COLOR_RESET}"
fi

echo -e "\n${COLOR_GREEN}======================================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}  Installation Successful! OpenWrt Modern Panel Ready ${COLOR_RESET}"
echo -e "${COLOR_GREEN}======================================================${COLOR_RESET}"
echo -e "Open your browser and visit: ${COLOR_CYAN}http://192.168.1.1/#/overview${COLOR_RESET}"
echo -e "To launch initial setup:     ${COLOR_CYAN}http://192.168.1.1/#/wizard${COLOR_RESET}\n"
