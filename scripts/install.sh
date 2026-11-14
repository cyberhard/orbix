#!/bin/sh
# ORBIX - Universal Network Management Platform Installer & Maintenance System
# Supports OpenWrt 21.02, 22.03, 23.05, 24.10, and 25.12+ (apk & opkg)
# Usage:
#   Install / Update: curl -sSL https://raw.githubusercontent.com/cyberhard/orbix/main/scripts/install.sh | sh
#   Options: ./install.sh [--install | --update | --uninstall | --health-check | --backup-www]

set -e

ACTION="${1:---install}"

COLOR_GREEN='\033[0;32m'
COLOR_CYAN='\033[0;36m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_RESET='\033[0m'

print_banner() {
    echo -e "${COLOR_CYAN}======================================================${COLOR_RESET}"
    echo -e "${COLOR_GREEN}         ORBIX — OpenWrt Management Platform          ${COLOR_RESET}"
    echo -e "${COLOR_CYAN}======================================================${COLOR_RESET}"
}

check_root() {
    if [ "$(id -u)" != "0" ]; then
        echo -e "${COLOR_RED}Error: This script must be run as root!${COLOR_RESET}" >&2
        exit 1
    fi
}

check_system() {
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
}

health_check() {
    print_banner
    check_system
    echo -e "\n${COLOR_CYAN}--> Running ORBIX Health & Diagnostics Check...${COLOR_RESET}"

    # 1. Check uhttpd
    if /etc/init.d/uhttpd status >/dev/null 2>&1 || ps | grep -q "[u]httpd"; then
        echo -e "  [✓] uhttpd Web Server:  ${COLOR_GREEN}RUNNING${COLOR_RESET}"
    else
        echo -e "  [✗] uhttpd Web Server:  ${COLOR_RED}STOPPED${COLOR_RESET}"
    fi

    # 2. Check rpcd
    if /etc/init.d/rpcd status >/dev/null 2>&1 || ps | grep -q "[r]pcd"; then
        echo -e "  [✓] rpcd System Daemon: ${COLOR_GREEN}RUNNING${COLOR_RESET}"
    else
        echo -e "  [✗] rpcd System Daemon: ${COLOR_RED}STOPPED${COLOR_RESET}"
    fi

    # 3. Check ubus circumvention object
    if ubus list 2>/dev/null | grep -q "^circumvention$"; then
        echo -e "  [✓] ORBIX RPCD Object:  ${COLOR_GREEN}REGISTERED & ACTIVE${COLOR_RESET}"
    else
        echo -e "  [!] ORBIX RPCD Object:  ${COLOR_YELLOW}PENDING FIRST REQUEST${COLOR_RESET}"
    fi

    # 4. Check Web UI files in /www
    if [ -f "/www/index.html" ] && [ -f "/www/favicon.svg" ]; then
        echo -e "  [✓] ORBIX Frontend:     ${COLOR_GREEN}INSTALLED IN /www${COLOR_RESET}"
    else
        echo -e "  [✗] ORBIX Frontend:     ${COLOR_RED}MISSING OR INCOMPLETE${COLOR_RESET}"
    fi

    # 5. Check Resources
    OVERLAY_FREE_KB=$(df -k /overlay 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
    RAM_AVAIL_KB=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "131072")
    echo -e "  [i] Storage Available:  ${COLOR_YELLOW}$((OVERLAY_FREE_KB / 1024)) MB${COLOR_RESET}"
    echo -e "  [i] RAM Available:      ${COLOR_YELLOW}$((RAM_AVAIL_KB / 1024)) MB${COLOR_RESET}"
    echo ""
}

uninstall_orbix() {
    print_banner
    check_root
    echo -e "\n${COLOR_YELLOW}--> Uninstalling ORBIX Platform...${COLOR_RESET}"

    # Remove backend files
    rm -f /usr/libexec/rpcd/circumvention
    rm -f /usr/share/rpcd/acl.d/circumvention.json
    rm -f /tmp/uci_watchdog.* /tmp/uci_rollback_*

    # Restore previous /www if backup exists
    if [ -d "/www.orbix.bak" ]; then
        echo "Restoring previous web interface from /www.orbix.bak..."
        rm -rf /www/*
        cp -rf /www.orbix.bak/* /www/ 2>/dev/null || true
        rm -rf /www.orbix.bak
    else
        echo "Clearing ORBIX web assets from /www..."
        rm -rf /www/assets /www/favicon.svg /www/index.html*
    fi

    /etc/init.d/rpcd restart
    /etc/init.d/uhttpd restart || true

    echo -e "${COLOR_GREEN}✓ ORBIX successfully uninstalled.${COLOR_RESET}\n"
    exit 0
}

# ----------------- Main Execution -----------------
check_root

case "$ACTION" in
    --uninstall|-u)
        uninstall_orbix
        ;;
    --health-check|--status|-s)
        health_check
        exit 0
        ;;
    --backup-www)
        if [ -d "/www" ] && [ ! -d "/www.orbix.bak" ]; then
            echo "Backing up /www to /www.orbix.bak..."
            cp -rf /www /www.orbix.bak
            echo "Backup complete."
        fi
        exit 0
        ;;
    --install|--update|"")
        ;;
    *)
        echo "Usage: $0 [--install | --update | --uninstall | --health-check]"
        exit 1
        ;;
esac

print_banner
check_system

# 1. Check Resources
OVERLAY_FREE_KB=$(df -k /overlay 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
if [ "$OVERLAY_FREE_KB" -lt 8192 ]; then
    echo -e "${COLOR_YELLOW}Warning: Less than 8MB free in /overlay (${OVERLAY_FREE_KB} KB).${COLOR_RESET}"
fi

RAM_AVAIL_KB=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "131072")
echo -e "Available RAM:   ${COLOR_YELLOW}$((RAM_AVAIL_KB / 1024)) MB${COLOR_RESET}"

# 2. Package Manager Check
PKG_MGR="opkg"
if which apk >/dev/null 2>&1; then
    PKG_MGR="apk"
fi
echo -e "Package Manager: ${COLOR_GREEN}${PKG_MGR}${COLOR_RESET}"

# 3. Dependencies
if [ "$ACTION" != "--update" ]; then
    echo -e "\n${COLOR_CYAN}--> Step 1/4: Installing required dependencies...${COLOR_RESET}"
    REQUIRED_PKGS="uhttpd rpcd rpcd-mod-file jsonfilter ca-certificates curl libubox"

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
fi

# 4. Deploy Backend & ACL
echo -e "\n${COLOR_CYAN}--> Step 2/4: Deploying hardened RPCD backend...${COLOR_RESET}"
mkdir -p /usr/libexec/rpcd /usr/share/rpcd/acl.d

if [ -f "./rpcd-circumvention.sh" ]; then
    cp -f ./rpcd-circumvention.sh /usr/libexec/rpcd/circumvention
elif [ -f "./rpcd/circumvention" ]; then
    cp -f ./rpcd/circumvention /usr/libexec/rpcd/circumvention
else
    echo "Downloading rpcd backend script from GitHub..."
    curl -sSL "https://raw.githubusercontent.com/cyberhard/orbix/main/rpcd-circumvention.sh" -o /usr/libexec/rpcd/circumvention || true
fi

chmod +x /usr/libexec/rpcd/circumvention

# Deploy Hardened ACL
if [ -f "./rpcd-circumvention-acl.json" ]; then
    cp -f ./rpcd-circumvention-acl.json /usr/share/rpcd/acl.d/circumvention.json
else
    cat << 'EOF' > /usr/share/rpcd/acl.d/circumvention.json
{
	"circumvention": {
		"description": "Grant access to circumvention and VPN RPC methods",
		"read": {
			"ubus": {
				"circumvention": [
					"awg_status",
					"zapret_status",
					"zapret_test_strategy",
					"vless_status",
					"singbox_test_node",
					"podkop_status",
					"pbr_status",
					"pbr_trace",
					"killswitch_status",
					"sub_get_cache",
					"policy_status",
					"captive_get_config",
					"captive_get_status",
					"captive_get_clients",
					"captive_run_diagnostics",
					"captive_cert_status"
				]
			}
		},
		"write": {
			"ubus": {
				"circumvention": [
					"awg_genkey",
					"awg_import_conf",
					"awg_delete",
					"podkop_update",
					"arm_rollback",
					"confirm_rollback",
					"cancel_rollback",
					"sub_decrypt_fetch",
					"singbox_set_outbound",
					"pbr_set_device_rule",
					"wifi_reload",
					"killswitch_set",
					"sub_save_cache",
					"policy_apply",
					"captive_set_config",
					"captive_set_client_exemption",
					"captive_cert_renew",
					"captive_cert_upload"
				]
			}
		}
	}
}
EOF
fi

# Deploy Captive Portal & Error Router
mkdir -p /www-redirect /www/cgi-bin
if [ -f "./openwrt/www-redirect/redirect.cgi" ]; then
    cp -f ./openwrt/www-redirect/redirect.cgi /www-redirect/redirect.cgi
else
    curl -sSL "https://raw.githubusercontent.com/cyberhard/orbix/main/openwrt/www-redirect/redirect.cgi" -o /www-redirect/redirect.cgi || true
fi
chmod +x /www-redirect/redirect.cgi

if [ -f "./openwrt/www-cgi-bin/captive-portal" ]; then
    cp -f ./openwrt/www-cgi-bin/captive-portal /www/cgi-bin/captive-portal
else
    curl -sSL "https://raw.githubusercontent.com/cyberhard/orbix/main/openwrt/www-cgi-bin/captive-portal" -o /www/cgi-bin/captive-portal || true
fi
chmod +x /www/cgi-bin/captive-portal

# 5. Deploy Frontend Web UI
echo -e "\n${COLOR_CYAN}--> Step 3/4: Deploying ORBIX Web UI...${COLOR_RESET}"

# Back up original /www if not already backed up
if [ -d "/www" ] && [ ! -d "/www.orbix.bak" ] && [ ! -f "/www/favicon.svg" ]; then
    echo "Preserving existing web interface to /www.orbix.bak..."
    cp -rf /www /www.orbix.bak 2>/dev/null || true
fi

mkdir -p /www

if [ -d "./dist" ]; then
    cp -rf ./dist/* /www/
else
    echo "Downloading latest ORBIX release bundle..."
    curl -sSL "https://github.com/cyberhard/orbix/releases/latest/download/orbix-dist.tar.gz" | tar -C /www -xzf - 2>/dev/null || true
fi

# 6. Web Server & Service Configuration
echo -e "\n${COLOR_CYAN}--> Step 4/4: Configuring services & permissions...${COLOR_RESET}"
uci set uhttpd.main.listen_http='0.0.0.0:80 [::]:80' 2>/dev/null || true
uci set uhttpd.main.home='/www' 2>/dev/null || true
uci commit uhttpd 2>/dev/null || true

/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart || /etc/init.d/uhttpd start

# 7. Verification
echo -e "\n${COLOR_CYAN}--> Verifying installation...${COLOR_RESET}"
sleep 1
health_check

echo -e "${COLOR_GREEN}======================================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}          Installation Successful! ORBIX Ready        ${COLOR_RESET}"
echo -e "${COLOR_GREEN}======================================================${COLOR_RESET}"
echo -e "Web Interface:      ${COLOR_CYAN}http://192.168.1.1/#/overview${COLOR_RESET}"
echo -e "Network Topology:   ${COLOR_CYAN}http://192.168.1.1/#/traffic${COLOR_RESET}"
echo -e "Setup Wizard:       ${COLOR_CYAN}http://192.168.1.1/#/wizard${COLOR_RESET}\n"
