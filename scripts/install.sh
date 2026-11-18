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

log() {
    printf "%b\n" "$*"
}

print_banner() {
    log "${COLOR_CYAN}======================================================${COLOR_RESET}"
    log "${COLOR_GREEN}         ORBIX — OpenWrt Management Platform          ${COLOR_RESET}"
    log "${COLOR_CYAN}======================================================${COLOR_RESET}"
}

check_root() {
    if [ "$(id -u)" != "0" ]; then
        log "${COLOR_RED}Error: This script must be run as root!${COLOR_RESET}" >&2
        exit 1
    fi
}

check_system() {
    if [ ! -f /etc/openwrt_release ]; then
        log "${COLOR_RED}Error: /etc/openwrt_release not found. Is this an OpenWrt system?${COLOR_RESET}" >&2
        exit 1
    fi
    . /etc/openwrt_release
    ARCH=$(uname -m)
    OPENWRT_VER="${DISTRIB_RELEASE:-unknown}"
    TARGET="${DISTRIB_TARGET:-unknown}"

    log "Detected System: ${COLOR_YELLOW}${DISTRIB_DESCRIPTION}${COLOR_RESET}"
    log "Architecture:    ${COLOR_YELLOW}${ARCH} (${TARGET})${COLOR_RESET}"
}

health_check() {
    print_banner
    check_system
    log "\n${COLOR_CYAN}--> Running ORBIX Health & Diagnostics Check...${COLOR_RESET}"

    # 1. Check uhttpd
    if /etc/init.d/uhttpd status >/dev/null 2>&1 || ps | grep -q "[u]httpd"; then
        log "  [✓] uhttpd Web Server:  ${COLOR_GREEN}RUNNING${COLOR_RESET}"
    else
        log "  [✗] uhttpd Web Server:  ${COLOR_RED}STOPPED${COLOR_RESET}"
    fi

    # 2. Check rpcd
    if /etc/init.d/rpcd status >/dev/null 2>&1 || ps | grep -q "[r]pcd"; then
        log "  [✓] rpcd System Daemon: ${COLOR_GREEN}RUNNING${COLOR_RESET}"
    else
        log "  [✗] rpcd System Daemon: ${COLOR_RED}STOPPED${COLOR_RESET}"
    fi

    # 3. Check ubus circumvention object
    if ubus list 2>/dev/null | grep -q "^circumvention$"; then
        log "  [✓] ORBIX RPCD Object:  ${COLOR_GREEN}REGISTERED & ACTIVE${COLOR_RESET}"
    else
        log "  [!] ORBIX RPCD Object:  ${COLOR_YELLOW}PENDING FIRST REQUEST${COLOR_RESET}"
    fi

    # 4. Check Web UI files in /www
    if [ -f "/www/index.html" ] && [ -f "/www/favicon.svg" ]; then
        log "  [✓] ORBIX Frontend:     ${COLOR_GREEN}INSTALLED IN /www${COLOR_RESET}"
    else
        log "  [✗] ORBIX Frontend:     ${COLOR_RED}MISSING OR INCOMPLETE${COLOR_RESET}"
    fi

    # 5. Check Resources
    OVERLAY_FREE_KB=$(df -k /overlay 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")
    RAM_AVAIL_KB=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "131072")
    log "  [i] Storage Available:  ${COLOR_YELLOW}$((OVERLAY_FREE_KB / 1024)) MB${COLOR_RESET}"
    log "  [i] RAM Available:      ${COLOR_YELLOW}$((RAM_AVAIL_KB / 1024)) MB${COLOR_RESET}"
    echo ""
}

uninstall_orbix() {
    print_banner
    check_root
    log "\n${COLOR_YELLOW}--> Uninstalling ORBIX Platform...${COLOR_RESET}"

    # Clean up any active watchdog processes deterministically
    if [ -f "/tmp/uci_watchdog.sleep_pid" ]; then
        kill -9 "$(cat /tmp/uci_watchdog.sleep_pid 2>/dev/null)" 2>/dev/null || true
    fi
    if [ -f "/tmp/uci_watchdog.pid" ]; then
        kill -9 "$(cat /tmp/uci_watchdog.pid 2>/dev/null)" 2>/dev/null || true
    fi

    # Remove backend files and watchdog state
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

    log "${COLOR_GREEN}✓ ORBIX successfully uninstalled.${COLOR_RESET}\n"
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
    log "${COLOR_YELLOW}Warning: Less than 8MB free in /overlay (${OVERLAY_FREE_KB} KB).${COLOR_RESET}"
fi

RAM_AVAIL_KB=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "131072")
log "Available RAM:   ${COLOR_YELLOW}$((RAM_AVAIL_KB / 1024)) MB${COLOR_RESET}"

# 2. Package Manager Check
PKG_MGR="opkg"
if command -v apk >/dev/null 2>&1; then
    PKG_MGR="apk"
fi
log "Package Manager: ${COLOR_GREEN}${PKG_MGR}${COLOR_RESET}"

# 3. Dependencies
if [ "$ACTION" != "--update" ]; then
    log "\n${COLOR_CYAN}--> Step 1/4: Installing required dependencies...${COLOR_RESET}"
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
log "\n${COLOR_CYAN}--> Step 2/4: Deploying hardened RPCD backend...${COLOR_RESET}"
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
					"zapret_get_options",
					"zapret_list_files",
					"vless_status",
					"singbox_test_node",
					"podkop_status",
					"pbr_status",
					"pbr_trace",
					"killswitch_status",
					"sub_get_cache",
					"policy_status",
					"kid_status",
					"node_balancer_status",
					"zapret_flowoff_status",
					"zapret_auto_status",
					"watchdog_status",
					"tiers_status",
					"tiers_get"
				],
				"file": [
					"read",
					"stat",
					"list",
					"md5"
				]
			},
			"read-files": [
				"/tmp/resolv.conf.d/resolv.conf.auto",
				"/tmp/resolv.conf.auto",
				"/etc/crontabs/root",
				"/etc/dropbear/authorized_keys",
				"/tmp/orbix/*"
			]
		},
		"write": {
			"ubus": {
				"network.interface.*": [
					"restart"
				],
				"circumvention": [
					"sub_get_cache",
					"awg_genkey",
					"awg_import_conf",
					"awg_delete",
					"zapret_set_options",
					"zapret_import_chunk",
					"zapret_import_profile",
					"zapret_restore_backup",
					"podkop_update",
					"arm_rollback",
					"confirm_rollback",
					"cancel_rollback",
					"sub_decrypt_fetch",
					"singbox_set_outbound",
					"pbr_set_device_rule",
					"pbr_rule_upsert",
					"pbr_rule_delete",
					"wifi_reload",
					"killswitch_set",
					"sub_save_cache",
					"policy_apply",
					"run_cmd",
					"kid_set_master",
					"kid_set_device",
					"kid_set_block",
					"kid_set_bedtime",
					"node_balancer_run",
					"sub_refresh",
					"sub_set_source",
					"zapret_flowoff_fix",
					"zapret_ports_sync",
					"zapret_auto_test",
					"zaptest_stop",
					"watchdog_set",
					"tiers_stage",
					"tiers_commit",
					"tiers_disable"
				],
				"file": [
					"write",
					"put",
					"mkdir",
					"remove",
					"rename"
				]
			},
			"write-files": [
				"/etc/dropbear/authorized_keys",
				"/etc/crontabs/root",
				"/tmp/orbix/*"
			]
		}
	}
}
EOF
fi

# 5. Deploy Frontend Web UI
log "\n${COLOR_CYAN}--> Step 3/4: Deploying ORBIX Web UI...${COLOR_RESET}"

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
log "\n${COLOR_CYAN}--> Step 4/4: Configuring services & permissions...${COLOR_RESET}"
uci set uhttpd.main.listen_http='0.0.0.0:80 [::]:80' 2>/dev/null || true
uci set uhttpd.main.home='/www' 2>/dev/null || true
uci commit uhttpd 2>/dev/null || true

/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart || /etc/init.d/uhttpd start

# 7. Verification
log "\n${COLOR_CYAN}--> Verifying installation...${COLOR_RESET}"
sleep 1
health_check

LAN_IP=$(uci -q get network.lan.ipaddr 2>/dev/null | cut -d/ -f1)
[ -z "$LAN_IP" ] && LAN_IP="192.168.1.1"

log "${COLOR_GREEN}======================================================${COLOR_RESET}"
log "${COLOR_GREEN}          Installation Successful! ORBIX Ready        ${COLOR_RESET}"
log "${COLOR_GREEN}======================================================${COLOR_RESET}"
log "Web Interface:      ${COLOR_CYAN}http://${LAN_IP}/#/overview${COLOR_RESET}"
log "Network Topology:   ${COLOR_CYAN}http://${LAN_IP}/#/traffic${COLOR_RESET}"
log "Setup Wizard:       ${COLOR_CYAN}http://${LAN_IP}/#/wizard${COLOR_RESET}\n"
