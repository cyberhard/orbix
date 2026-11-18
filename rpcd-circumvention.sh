#!/bin/sh
# rpcd-circumvention - Production OpenWrt rpcd backend for censorship circumvention, VPNs, and PBR.
# Strictly POSIX sh / BusyBox ash compliant. Uses jshn.sh for valid JSON serialization.

. /usr/share/libubox/jshn.sh

# ============================================================================
# panel-kid: child-friendly controls. Real enforcement:
#  - master / bedtime / per-device pause  -> nft table inet panel (hook forward priority -1,
#    runs BEFORE fw4, so established streams die immediately, no conntrack tools needed)
#  - category blocks                      -> dnsmasq address=/domain/# via uci list
# Helper files self-install on first use (kid_ensure, idempotent).
# ============================================================================
KID_VER=7

kid_ensure() {
	if [ -x /usr/sbin/panel-kid-apply ] && grep -q "panel-kid-version: $KID_VER" /usr/sbin/panel-kid-apply 2>/dev/null; then
		return 0
	fi
	mkdir -p /usr/lib/panel-kid/blocks
	printf "%s\n" youtube.com youtu.be googlevideo.com ytimg.com > /usr/lib/panel-kid/blocks/youtube.txt
	printf "%s\n" roblox.com minecraft.net epicgames.com steampowered.com supercell.com > /usr/lib/panel-kid/blocks/games.txt
	printf "%s\n" vk.com ok.ru tiktok.com instagram.com t.me facebook.com > /usr/lib/panel-kid/blocks/social.txt
	printf "%s\n" pornhub.com xvideos.com xhamster.com onlyfans.com > /usr/lib/panel-kid/blocks/adult.txt
	if [ ! -f /etc/config/panel-kid ]; then
		cat > /etc/config/panel-kid <<'KIDCONF'
config kid 'main'
	option master '1'
	option auto_bedtime '0'
	option bedtime_start '21:30'
	option bedtime_end '07:00'
KIDCONF
		uci -q commit panel-kid
	fi
	cat > /usr/sbin/panel-kid-apply <<'KIDAPPLY'
#!/bin/sh
# panel-kid-version: 7
# Applies /etc/config/panel-kid to kernel + dnsmasq. Idempotent, runs from cron every minute.
BR="br-lan"
M=$(uci -q get panel-kid.main.master); [ -z "$M" ] && M=1
AUTO=$(uci -q get panel-kid.main.auto_bedtime)
S=$(uci -q get panel-kid.main.bedtime_start)
E=$(uci -q get panel-kid.main.bedtime_end)
EFF="$M"
if [ "$AUTO" = "1" ] && [ -n "$S" ] && [ -n "$E" ]; then
	H=$(date +%H); MIN=$(date +%M)
	HM=$((10#$H * 60 + 10#$MIN))
	SH=${S%%:*}; SM=${S##*:}; EH=${E%%:*}; EM=${E##*:}
	case "$SH$SM$EH$EM" in
	''|*[!0-9]*) ;;
	*)
		Smin=$((10#$SH * 60 + 10#$SM)); Emin=$((10#$EH * 60 + 10#$EM))
		if [ "$Smin" -lt "$Emin" ]; then
			[ "$HM" -ge "$Smin" ] && [ "$HM" -lt "$Emin" ] && EFF=0
		else
			if [ "$HM" -ge "$Smin" ] || [ "$HM" -lt "$Emin" ]; then EFF=0; fi
		fi ;;
	esac
fi
echo "$EFF" > /tmp/panel-kid-effective

PAUSED=""
for SEC in $(uci -q show panel-kid 2>/dev/null | sed -n 's/^panel-kid\.\([A-Za-z0-9_-]*\)=kiddev$/\1/p'); do
	P=$(uci -q get "panel-kid.$SEC.paused")
	PMAC=$(uci -q get "panel-kid.$SEC.mac")
	[ "$P" = "1" ] || continue
	[ -n "$PMAC" ] || continue
	case "$PMAC" in ??:??:??:??:??:??) PAUSED="$PAUSED $(printf "%s" "$PMAC" | tr 'A-F' 'a-f')" ;; esac
done

if ! nft list table inet panel >/dev/null 2>&1; then
	nft add table inet panel 2>/dev/null
fi
nft flush table inet panel 2>/dev/null
NEED=0
[ "$EFF" = "0" ] && NEED=1
[ -n "$PAUSED" ] && NEED=1
if [ "$NEED" = "1" ]; then
	nft add chain inet panel guard "{ type filter hook forward priority -1; policy accept; }" 2>/dev/null
	if [ "$EFF" = "0" ]; then
		nft add rule inet panel guard iifname "$BR" counter drop 2>/dev/null
	else
		for KMAC in $PAUSED; do
			nft add rule inet panel guard ether saddr "$KMAC" counter drop 2>/dev/null
		done
	fi
fi

# Preflight: dnsmasq refuses to start on duplicate static-lease IPs; do not hand it a fatal config
_KIPLIST=""
_KDUP=0
for _kh in $(uci -q show dhcp 2>/dev/null | sed -n 's/^dhcp\.\([A-Za-z0-9_-]*\)=host$/\1/p'); do
	_kip=$(uci -q get "dhcp.$_kh.ip" 2>/dev/null)
	[ -n "$_kip" ] || continue
	case " $_KIPLIST " in *" $_kip "*) _KDUP=1 ;; esac
	_KIPLIST="$_KIPLIST $_kip"
done
if [ "$_KDUP" = "1" ]; then
	logger -t panel-kid "dnsmasq restart skipped: duplicate static lease IPs in dhcp config"
fi

BEFORE=$(uci -q get "dhcp.@dnsmasq[0].address" 2>/dev/null)
for F in /usr/lib/panel-kid/blocks/*.txt; do
	for D in $(cat "$F" 2>/dev/null); do
		uci -q del_list "dhcp.@dnsmasq[0].address=/$D/#" 2>/dev/null
	done
done
for C in $(uci -q get panel-kid.main.blocks 2>/dev/null); do
	case "$C" in youtube|games|social|adult) ;; *) continue ;; esac
	for D in $(cat "/usr/lib/panel-kid/blocks/$C.txt" 2>/dev/null); do
		uci -q add_list "dhcp.@dnsmasq[0].address=/$D/#" 2>/dev/null
	done
done
AFTER=$(uci -q get "dhcp.@dnsmasq[0].address" 2>/dev/null)
uci -q commit dhcp
if [ "$BEFORE" != "$AFTER" ] && [ "$_KDUP" != "1" ]; then
	/etc/init.d/dnsmasq restart >/dev/null 2>&1
fi
exit 0
KIDAPPLY
	chmod +x /usr/sbin/panel-kid-apply
	cat > /etc/init.d/panel-kid <<'KIDINIT'
#!/bin/sh /etc/rc.common
# panel-kid-version: 7
START=98
boot() { /usr/sbin/panel-kid-apply; }
start() { /usr/sbin/panel-kid-apply; }
restart() { /usr/sbin/panel-kid-apply; }
KIDINIT
	chmod +x /etc/init.d/panel-kid
	/etc/init.d/panel-kid enable >/dev/null 2>&1
	_CRON=$(crontab -l 2>/dev/null | sed '/# panel-kid:begin/,/# panel-kid:end/d')
	printf "%s\n# panel-kid:begin\n* * * * * /usr/sbin/panel-kid-apply >/dev/null 2>&1\n# panel-kid:end\n" "$_CRON" | crontab - 2>/dev/null || printf "%s\n# panel-kid:begin\n* * * * * /usr/sbin/panel-kid-apply >/dev/null 2>&1\n# panel-kid:end\n" "$_CRON" > /var/spool/cron/crontabs/root
	/etc/init.d/cron restart >/dev/null 2>&1
}

kid_paused_mac() {
	_kp=""
	for _ks in $(uci -q show panel-kid 2>/dev/null | sed -n 's/^panel-kid\.\([A-Za-z0-9_-]*\)=kiddev$/\1/p'); do
		_kp_on=$(uci -q get "panel-kid.$_ks.paused")
		_kp_mac=$(uci -q get "panel-kid.$_ks.mac")
		[ "$_kp_on" = "1" ] || continue
		[ -n "$_kp_mac" ] || continue
		_kp="$_kp $(printf "%s" "$_kp_mac" | tr 'A-F' 'a-f')"
	done
	echo "$_kp"
}

kid_status_json() {
	json_init
	json_add_string "status" "ok"
	json_add_boolean "installed" 1
	_KM=$(uci -q get panel-kid.main.master); [ -z "$_KM" ] && _KM=1
	_KA=$(uci -q get panel-kid.main.auto_bedtime); [ -z "$_KA" ] && _KA=0
	json_add_boolean "master" "$_KM"
	json_add_boolean "auto_bedtime" "$_KA"
	json_add_string "bedtime_start" "$(uci -q get panel-kid.main.bedtime_start)"
	json_add_string "bedtime_end" "$(uci -q get panel-kid.main.bedtime_end)"
	_KE=$(cat /tmp/panel-kid-effective 2>/dev/null); [ -z "$_KE" ] && _KE="$_KM"
	json_add_boolean "effective" "$_KE"
	json_add_array "blocks"
	for _kc in $(uci -q get panel-kid.main.blocks 2>/dev/null); do json_add_string "" "$_kc"; done
	json_close_array
	_KP=$(kid_paused_mac)
	json_add_array "paused"
	for _km in $_KP; do json_add_string "" "$_km"; done
	json_close_array
	json_add_array "devices"
	_KNOW=$(date +%s)
	_KRMAC=$(cat /sys/class/net/br-lan/address 2>/dev/null | tr 'A-F' 'a-f')
	_KSEEN=""
	while read _kexp _km _ki _kh _kc2; do
		[ -n "$_km" ] || continue
		case "$_km" in ??:??:??:??:??:??) ;; *) continue ;; esac
		_km=$(printf "%s" "$_km" | tr 'A-F' 'a-f')
		[ "$_km" = "$_KRMAC" ] && continue
		case " $_KSEEN " in *" $_km "*) continue ;; esac
		_KSEEN="$_KSEEN $_km"
		_kon=0; if [ "${_kexp:-0}" -gt "$_KNOW" ] 2>/dev/null; then _kon=1; fi
		_kp2=0; case " $_KP " in *" $_km "*) _kp2=1 ;; esac
		json_add_object
		json_add_string "mac" "$_km"
		json_add_string "ip" "$_ki"
		json_add_string "name" "$_kh"
		json_add_boolean "online" "$_kon"
		json_add_boolean "paused" "$_kp2"
		json_close_object
	done < /tmp/dhcp.leases
	json_close_array
	json_dump
}

kid_norm_on() {
	case "$1" in 1|true|on) echo 1 ;; 0|false|off|"") echo 0 ;; *) echo bad ;; esac
}

# Helper: return JSON error and exit 0 for rpcd
return_error() {
	json_init
	json_add_string "status" "error"
	json_add_string "message" "$1"
	json_dump
	exit 0
}

# Helper: clean up active watchdog and child processes deterministically
kill_active_watchdog() {
	if [ -f "/tmp/uci_watchdog.sleep_pid" ]; then
		_sleep_pid=$(cat /tmp/uci_watchdog.sleep_pid 2>/dev/null | tr -d ' \r\n')
		if [ -n "$_sleep_pid" ] && [ "$_sleep_pid" -gt 1 ] 2>/dev/null; then
			kill -9 "$_sleep_pid" 2>/dev/null
		fi
		rm -f /tmp/uci_watchdog.sleep_pid
	fi

	if [ -f "/tmp/uci_watchdog.pid" ]; then
		_wd_pid=$(cat /tmp/uci_watchdog.pid 2>/dev/null | tr -d ' \r\n')
		if [ -n "$_wd_pid" ] && [ "$_wd_pid" -gt 1 ] 2>/dev/null; then
			kill -TERM "$_wd_pid" 2>/dev/null
			if command -v pgrep >/dev/null 2>&1; then
				_children=$(pgrep -P "$_wd_pid" 2>/dev/null)
				[ -n "$_children" ] && kill -9 $_children 2>/dev/null
			fi
			kill -9 "$_wd_pid" 2>/dev/null
		fi
		rm -f /tmp/uci_watchdog.pid
	fi
}

# Helper: dynamically resolve LAN subnet in CIDR notation (POSIX sh arithmetic)
get_lan_subnet() {
	_ip=""
	_mask=""
	if command -v ubus >/dev/null 2>&1; then
		_ip=$(ubus call network.interface.lan status 2>/dev/null | jsonfilter -e '@["ipv4-address"][0].address' 2>/dev/null)
		_mask=$(ubus call network.interface.lan status 2>/dev/null | jsonfilter -e '@["ipv4-address"][0].mask' 2>/dev/null)
	fi

	if [ -z "$_ip" ]; then
		_ip=$(uci -q get network.lan.ipaddr)
		_mask=$(uci -q get network.lan.netmask)
	fi

	[ -z "$_ip" ] && _ip="192.168.1.1"
	[ -z "$_mask" ] && _mask="24"

	_cidr=24
	if echo "$_ip" | grep -q "/"; then
		_cidr="${_ip##*/}"
		_ip="${_ip%%/*}"
	elif [ -n "$_mask" ]; then
		case "$_mask" in
			255.255.255.255|32) _cidr=32 ;;
			255.255.255.254|31) _cidr=31 ;;
			255.255.255.252|30) _cidr=30 ;;
			255.255.255.248|29) _cidr=29 ;;
			255.255.255.240|28) _cidr=28 ;;
			255.255.255.224|27) _cidr=27 ;;
			255.255.255.192|26) _cidr=26 ;;
			255.255.255.128|25) _cidr=25 ;;
			255.255.255.0|24)   _cidr=24 ;;
			255.255.254.0|23)   _cidr=23 ;;
			255.255.252.0|22)   _cidr=22 ;;
			255.255.248.0|21)   _cidr=21 ;;
			255.255.240.0|20)   _cidr=20 ;;
			255.255.0.0|16)     _cidr=16 ;;
			255.0.0.0|8)        _cidr=8 ;;
			*) _cidr=24 ;;
		esac
	fi

	_mask_num=$(( (0xFFFFFFFF << (32 - _cidr)) & 0xFFFFFFFF ))
	_m1=$(( (_mask_num >> 24) & 0xFF ))
	_m2=$(( (_mask_num >> 16) & 0xFF ))
	_m3=$(( (_mask_num >> 8) & 0xFF ))
	_m4=$(( _mask_num & 0xFF ))

	_o1=$(echo "$_ip" | cut -d. -f1)
	_o2=$(echo "$_ip" | cut -d. -f2)
	_o3=$(echo "$_ip" | cut -d. -f3)
	_o4=$(echo "$_ip" | cut -d. -f4)

	_n1=$(( (_o1 & _m1) ))
	_n2=$(( (_o2 & _m2) ))
	_n3=$(( (_o3 & _m3) ))
	_n4=$(( (_o4 & _m4) ))

	echo "${_n1}.${_n2}.${_n3}.${_n4}/${_cidr}"
}

# Helper: dynamically detect WAN interface names
get_wan_interfaces() {
	_wan_list="wan eth0"
	_w_dev=$(uci -q get network.wan.device)
	[ -n "$_w_dev" ] && _wan_list="$_wan_list $_w_dev"
	_w_if=$(uci -q get network.wan.ifname)
	[ -n "$_w_if" ] && _wan_list="$_wan_list $_w_if"

	_uniq_wan=""
	for _w in $_wan_list; do
		case " $_uniq_wan " in
			*" $_w "*) ;;
			*) _uniq_wan="${_uniq_wan:+$_uniq_wan, }\"$_w\"" ;;
		esac
	done
	echo "$_uniq_wan"
}

format_json_array() {
	_first=1
	printf "["
	for _item in $1; do
		[ -z "$_item" ] && continue
		[ "$_first" = "1" ] && _first=0 || printf ", "
		printf "\"%s\"" "$_item"
	done
	printf "]"
}

generate_singbox_config() {
	NODE_CONF="/etc/sing-box/active_node.json"
	SERVER=""
	PORT=443
	UUID=""
	SNI=""
	PUBKEY=""
	SHORTID=""
	FP="firefox"
	FLOW="xtls-rprx-vision"

	PROTO="vless"
	PW=""
	METH=""
	if [ -f "$NODE_CONF" ]; then
		PROTO=$(jsonfilter -i "$NODE_CONF" -e '@.protocol' 2>/dev/null | head -1)
		[ -z "$PROTO" ] && PROTO="vless"
		PW=$(jsonfilter -i "$NODE_CONF" -e '@.password' 2>/dev/null | head -1)
		METH=$(jsonfilter -i "$NODE_CONF" -e '@.method' 2>/dev/null | head -1)
		SERVER=$(jsonfilter -i "$NODE_CONF" -e '@.server' -e '@.node.server' 2>/dev/null)
		PORT=$(jsonfilter -i "$NODE_CONF" -e '@.port' -e '@.node.port' 2>/dev/null)
		UUID=$(jsonfilter -i "$NODE_CONF" -e '@.uuid' -e '@.node.uuid' 2>/dev/null)
		SNI=$(jsonfilter -i "$NODE_CONF" -e '@.sni' -e '@.node.sni' 2>/dev/null)
		PUBKEY=$(jsonfilter -i "$NODE_CONF" -e '@.publicKey' -e '@.node.publicKey' 2>/dev/null)
		SHORTID=$(jsonfilter -i "$NODE_CONF" -e '@.shortId' -e '@.node.shortId' 2>/dev/null)
		FP=$(jsonfilter -i "$NODE_CONF" -e '@.fingerprint' -e '@.node.fingerprint' 2>/dev/null)
		FLOW=$(jsonfilter -i "$NODE_CONF" -e '@.flow' -e '@.node.flow' 2>/dev/null)
	fi

	if [ -z "$SERVER" ] && [ -f /etc/sing-box/config.json ]; then
		SERVER=$(jsonfilter -i /etc/sing-box/config.json -e '@.outbounds[0].server' 2>/dev/null)
		PORT=$(jsonfilter -i /etc/sing-box/config.json -e '@.outbounds[0].server_port' 2>/dev/null)
		UUID=$(jsonfilter -i /etc/sing-box/config.json -e '@.outbounds[0].uuid' 2>/dev/null)
		SNI=$(jsonfilter -i /etc/sing-box/config.json -e '@.outbounds[0].tls.server_name' 2>/dev/null)
		PUBKEY=$(jsonfilter -i /etc/sing-box/config.json -e '@.outbounds[0].tls.reality.public_key' 2>/dev/null)
		SHORTID=$(jsonfilter -i /etc/sing-box/config.json -e '@.outbounds[0].tls.reality.short_id' 2>/dev/null)
	fi

	# Rehydrate missing node secrets from subscription cache (active_node.json
	# written by the balancer may only carry server/port/name — regenerating from
	# it must NOT produce an outbound with empty uuid/reality keys).
	if { [ -z "$UUID" ] || [ -z "$PUBKEY" ]; } && [ -n "$SERVER" ] && [ -f /etc/orbix/subscriptions.json ]; then
		NODE_FILL=$(ucode -e '
			let fs = require("fs");
			let d = json(fs.readfile("/etc/orbix/subscriptions.json") || "{}") || {};
			let nodes = d.nodes || [];
			for (let i = 0; i < length(nodes); i++) {
				let n = nodes[i];
				if (!n || n.server != ARGV[0] || "" + n.port != ARGV[1]) continue;
				print(join("|", [n.uuid || "", n.publicKey || n.pbk || "", n.shortId || n.sid || "", n.sni || "", n.fingerprint || "", n.flow || "", n.protocol || "", n.password || "", n.method || ""]));
				break;
			}
		' "$SERVER" "$PORT" 2>/dev/null | head -n1)
		if [ -n "$NODE_FILL" ]; then
			[ -z "$UUID" ] && UUID=$(printf '%s' "$NODE_FILL" | cut -d'|' -f1)
			[ -z "$PUBKEY" ] && PUBKEY=$(printf '%s' "$NODE_FILL" | cut -d'|' -f2)
			[ -z "$SHORTID" ] && SHORTID=$(printf '%s' "$NODE_FILL" | cut -d'|' -f3)
			[ -z "$SNI" ] && SNI=$(printf '%s' "$NODE_FILL" | cut -d'|' -f4)
			[ -z "$FP" ] && FP=$(printf '%s' "$NODE_FILL" | cut -d'|' -f5)
			[ -z "$FLOW" ] && FLOW=$(printf '%s' "$NODE_FILL" | cut -d'|' -f6)
			RP=$(printf '%s' "$NODE_FILL" | cut -d'|' -f7)
			[ -n "$RP" ] && PROTO="$RP"
			[ -z "$PW" ] && PW=$(printf '%s' "$NODE_FILL" | cut -d'|' -f8)
			[ -z "$METH" ] && METH=$(printf '%s' "$NODE_FILL" | cut -d'|' -f9)
		fi
	fi
	[ -z "$FP" ] && FP="firefox"
	[ -z "$FLOW" ] && FLOW="xtls-rprx-vision"
	[ -z "$SNI" ] && SNI="$SERVER"
	[ -z "$PORT" ] && PORT=443

	# Hard guard: never regenerate sing-box config with empty node secrets —
	# keep the working config instead (caller reports the failure).
	NODE_OK=0
	case "$PROTO" in
		vless)   [ -n "$UUID" ] && NODE_OK=1 ;;
		trojan|hysteria2|hysteria)
			[ -n "$PW" ] && NODE_OK=1 ;;
		ss|shadowsocks)
			[ -n "$PW" ] && [ -n "$METH" ] && NODE_OK=1 ;;
		*) NODE_OK=1 ;;
	esac
	if [ "$NODE_OK" = "0" ]; then
		logger -t singbox-gen "abort regenerate: node $SERVER:$PORT ($PROTO) lacks required secrets (active_node.json/subscriptions.json)"
		return 1
	fi
	OUTBOUND_JSON=$(ucode -e '
		// ucode ARGV is 0-based: 0=server 1=port 2=uuid 3=sni 4=fp 5=pubkey
		// 6=shortid 7=(unused) 8=flow 9=proto 10=password 11=method
		if (length(ARGV) < 10 || ARGV[0] == "" || int(ARGV[1]) <= 0) exit;
		let ob = { tag: "proxy", server: ARGV[0], server_port: int(ARGV[1]) };
		switch (ARGV[9]) {
		case "trojan":
			ob.type = "trojan"; ob.password = ARGV[10];
			ob.tls = { enabled: true, server_name: ARGV[3] || ARGV[0] };
			break;
		case "ss": case "shadowsocks":
			ob.type = "shadowsocks"; ob.method = ARGV[11]; ob.password = ARGV[10];
			break;
		case "hysteria2": case "hysteria":
			ob.type = "hysteria2"; ob.password = ARGV[10];
			ob.tls = { enabled: true, server_name: ARGV[3] || "" };
			break;
		default:
			ob.type = "vless"; ob.uuid = ARGV[2]; ob.flow = ARGV[8];
			ob.tls = { enabled: true, server_name: ARGV[3] || ARGV[0], utls: { enabled: true, fingerprint: ARGV[4] || "firefox" } };
			if (ARGV[5] != "") ob.tls.reality = { enabled: true, public_key: ARGV[5], short_id: ARGV[6] };
			else ob.tls.reality = { enabled: false };
		}
		print(sprintf("%J", ob));
	' "$SERVER" "$PORT" "$UUID" "${SNI:-$SERVER}" "$FP" "$PUBKEY" "$SHORTID" "" "$FLOW" "$PROTO" "$PW" "$METH" 2>/dev/null)
[ -z "$OUTBOUND_JSON" ] && { logger -t singbox-gen "abort: outbound builder failed"; return 1; }

	POL_FILE="/etc/orbix/policies.json"
	BLOCKED_DOMS=""
	DIRECT_DOMS=""
	PROXY_DOMS=""
	if [ -f "$POL_FILE" ]; then
		BLOCKED_DOMS=$(jsonfilter -i "$POL_FILE" -e '@.blocked_domains[*]' 2>/dev/null)
		DIRECT_DOMS=$(jsonfilter -i "$POL_FILE" -e '@.direct_domains[*]' 2>/dev/null)
		PROXY_DOMS=$(jsonfilter -i "$POL_FILE" -e '@.proxy_domains[*]' 2>/dev/null)
	fi

	# Always ensure Discord domains are in proxy domains (unless blocked) so Voice WebRTC & Gateway connect reliably
	DISCORD_DOMS="discord.com discord.gg discord.media discordapp.com discordapp.net discord.co discordstatus.com gateway.discord.gg cdn.discordapp.com stable.dl2.discordapp.net"
	for _dc in $DISCORD_DOMS; do
		_is_blocked=0
		for _bd in $BLOCKED_DOMS; do
			if [ "$_dc" = "$_bd" ] || [ ".${_dc##*.}" = "$_bd" ]; then
				_is_blocked=1
				break
			fi
		done
		if [ "$_is_blocked" = "0" ]; then
			case " $PROXY_DOMS " in
				*" $_dc "*) ;;
				*) PROXY_DOMS="$PROXY_DOMS $_dc" ;;
			esac
		fi
	done

	# Clean & deduplicate blocked domains
	CLEAN_BLOCKED=""
	for d in $BLOCKED_DOMS; do
		cdom=$(echo "$d" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9.-')
		[ -n "$cdom" ] && CLEAN_BLOCKED="$CLEAN_BLOCKED $cdom"
	done

	# Clean proxy domains (exclude blocked)
	CLEAN_PROXY=""
	for d in $PROXY_DOMS; do
		cdom=$(echo "$d" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9.-')
		[ -z "$cdom" ] && continue
		case " $CLEAN_BLOCKED " in
			*" $cdom "*) continue ;;
		esac
		CLEAN_PROXY="$CLEAN_PROXY $cdom"
	done

	# Clean direct domains (exclude blocked and proxy)
	CLEAN_DIRECT=""
	for d in $DIRECT_DOMS; do
		cdom=$(echo "$d" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9.-')
		[ -z "$cdom" ] && continue
		case " $CLEAN_BLOCKED " in
			*" $cdom "*) continue ;;
		esac
		case " $CLEAN_PROXY " in
			*" $cdom "*) continue ;;
		esac
		CLEAN_DIRECT="$CLEAN_DIRECT $cdom"
	done

	BLOCKED_JSON=$(format_json_array "$CLEAN_BLOCKED")
	PROXY_JSON=$(format_json_array "$CLEAN_PROXY")
	DIRECT_JSON=$(format_json_array "$CLEAN_DIRECT")

	# Tier engine injection (from /etc/orbix/tiers.json, written by tiers_commit)
	TIER_FINAL=""
	TIER_RULES_JSON=""
	if [ -s /etc/orbix/tiers.json ]; then
		TIER_TMP=/tmp/orbx-tier-sb.json
		ucode -e '
			let fs = require("fs");
			let t = json(fs.readfile("/etc/orbix/tiers.json") || "{}") || {};
			if (!t.version) exit;
			let d1 = ["ru", "xn--p1ai", "su"];
			for (let d in (t.tier1 && t.tier1.domains) || []) push(d1, d);
			let n1 = (t.tier1 && t.tier1.networks) || [];
			let d2 = (t.tier2 && t.tier2.domains) || [];
			// discord is cut by DPI on RU lines under every nfqws strategy we
			// measured; if a stale config still lists it as L2 it belongs in L3
			let d3 = (t.tier3ExtraDomains) || [];
			let keep = [];
			for (let d in d2) { if (!index(d, "discord")) push(keep, d); else push(d3, d); }
			d2 = keep;
			let fin = (t.proxyEnabled === false) ? "direct" : "proxy";
			fs.writefile("/tmp/orbx-tier-sb.json", sprintf("%J", { final: fin, na: (t.withAntizapret !== false), d1: d1, n1: n1, d2: d2, d3: d3 }));
		' 2>/dev/null
		if [ -s "$TIER_TMP" ]; then
			TIER_FINAL=$(jsonfilter -i "$TIER_TMP" -e '@.final' 2>/dev/null | head -1)
			TIER_NA=$(jsonfilter -i "$TIER_TMP" -e '@.na' 2>/dev/null | head -1)
			T_D1=$(jsonfilter -i "$TIER_TMP" -e '@.d1[*]' 2>/dev/null)
			T_N1=$(jsonfilter -i "$TIER_TMP" -e '@.n1[*]' 2>/dev/null)
			T_D2=$(jsonfilter -i "$TIER_TMP" -e '@.d2[*]' 2>/dev/null)
			T_D3=$(jsonfilter -i "$TIER_TMP" -e '@.d3[*]' 2>/dev/null)
			TJ_D1=$(format_json_array "$T_D1")
			TJ_N1=$(format_json_array "$T_N1")
			TJ_D2=$(format_json_array "$T_D2")
			TJ_D3=$(format_json_array "$T_D3")
			TIER_P3=""
			if [ -n "$T_D3" ]; then
				TIER_P3=',
      {
        "domain_suffix": '"$TJ_D3"',
        "outbound": "proxy"
      },'
			fi
			TIER_RULES_JSON="$TIER_P3"$'
      {
        "domain_suffix": '"$TJ_D1"',
        "outbound": "direct"
      },
      {
        "ip_cidr": '"$TJ_N1"$',
        "outbound": "direct"
      },
      {
        "domain_suffix": '"$TJ_D2"$',
        "outbound": "direct"
      }'
		fi
		rm -f "$TIER_TMP"
	fi

	RULE_SET_BLOCK=""
	RULE_SET_RULE=""
	if [ -f "/etc/sing-box/antizapret.srs" ]; then
		RULE_SET_BLOCK=',
    "rule_set": [
      {
        "tag": "antizapret",
        "type": "local",
        "format": "binary",
        "path": "/etc/sing-box/antizapret.srs"
      }
    ]'
		RULE_SET_RULE=',
      {
        "rule_set": ["antizapret"],
        "outbound": "proxy"
      }'
	fi
	if [ "$TIER_NA" = "false" ]; then
		RULE_SET_BLOCK=""
		RULE_SET_RULE=""
	fi

	mkdir -p /etc/sing-box /tmp/singbox
	cat << EOF > /tmp/singbox/config.json.tmp
{
  "log": { "level": "info" },
  "inbounds": [
    {
      "type": "tun",
      "tag": "tun-in",
      "interface_name": "singbox",
      "address": [ "172.19.0.1/30" ],
      "auto_route": false,
      "strict_route": false,
      "stack": "gvisor"
    },
    {
      "type": "mixed",
      "tag": "mixed-in",
      "listen": "127.0.0.1",
      "listen_port": 10808
    },
    {
      "type": "direct",
      "tag": "dns-in",
      "listen": "127.0.0.1",
      "listen_port": 5353,
      "override_address": "8.8.8.8",
      "override_port": 53
    }
  ],
  "outbounds": [
    $OUTBOUND_JSON,
    {
      "type": "direct",
      "tag": "direct"
    }
  ],
  "route": {
    "auto_detect_interface": true$RULE_SET_BLOCK,
    "rules": [
      {
        "inbound": "dns-in",
        "action": "hijack-dns"
      },
      {
        "inbound": "mixed-in",
        "outbound": "proxy"
      },
      {
        "action": "sniff"
      },
      {
        "ip_is_private": true,
        "outbound": "direct"
      },
      {
        "ip_cidr": [
          "66.22.192.0/18",
          "162.159.128.0/20",
          "162.159.192.0/20",
          "147.160.192.0/19",
          "199.19.224.0/21",
          "91.108.4.0/22",
          "91.108.8.0/22",
          "91.108.12.0/22",
          "91.108.16.0/22",
          "91.108.20.0/22",
          "91.108.56.0/22",
          "91.105.192.0/23",
          "149.154.160.0/20",
          "185.76.151.0/24",
          "104.18.32.47",
          "172.64.155.209"
        ],
        "outbound": "proxy"
      }$([ -n "$CLEAN_BLOCKED" ] && echo ",
      {
        \"domain_suffix\": $BLOCKED_JSON,
        \"action\": \"reject\"
      }")$([ -n "$CLEAN_PROXY" ] && echo ",
      {
        \"domain_suffix\": $PROXY_JSON,
        \"outbound\": \"proxy\"
      }")$([ -n "$CLEAN_DIRECT" ] && echo ",
      {
        \"domain_suffix\": $DIRECT_JSON,
        \"outbound\": \"direct\"
      }")$TIER_RULES_JSON$RULE_SET_RULE
    ],
    "final": "${TIER_FINAL:-direct}",
    "default_domain_resolver": "yandex"
  },
  "dns": {
    "servers": [
      {
        "tag": "google-doh",
        "type": "https",
        "server": "dns.google",
        "server_port": 443,
        "detour": "proxy",
        "domain_resolver": "yandex"
      },
      {
        "tag": "google-dot",
        "type": "tls",
        "server": "dns.google",
        "server_port": 853,
        "detour": "proxy",
        "domain_resolver": "yandex"
      },
      {
        "tag": "yandex",
        "type": "udp",
        "server": "77.88.8.8",
        "server_port": 53
      }
    ],
    "rules": [
      {
        "domain_suffix": [ ".ru", ".su", ".xn--p1ai", "yandex.ru", "ya.ru", "yandex.net", "ya.net", "yastatic.net", "yastat.net", "yastatic-net.ru", "strm.yandex.net", "avatars.mds.yandex.net", "storage.mds.yandex.net", "userapi.com", "vk.com", "dzen.ru", "kinopoisk.ru" ],
        "server": "yandex"
      }
    ],
    "final": "google-doh"
  }
}
EOF

	if sing-box check -c /tmp/singbox/config.json.tmp >>/tmp/orbx-sbcheck.log 2>&1; then
		mv /tmp/singbox/config.json.tmp /etc/sing-box/config.json
		RESTART_OUT=$(/etc/init.d/sing-box restart 2>&1)
		RESTART_CODE=$?
		if [ "$RESTART_CODE" -ne 0 ]; then
			logger -t orbix "sing-box restart failed (exit $RESTART_CODE): $RESTART_OUT"
			return 2
		fi
		( sleep 1; /etc/init.d/pbr reload ) >/dev/null 2>&1 &
		return 0
	else
		rm -f /tmp/singbox/config.json.tmp
		return 1
	fi
}

# ---------- zapret helpers ----------
# This package variant uses section type 'main' named 'config' => uci path zapret.config.<field>.
# Older/official builds used 'main'. Try both, config first.
zg() {
	uci -q get "zapret.config.$1" 2>/dev/null || uci -q get "zapret.main.$1" 2>/dev/null
}
zs() {
	uci -q set "zapret.config.$1=$2" 2>/dev/null || uci -q set "zapret.main.$1=$2"
}
zrestart_bg() {
	# hostlist/ipset reload can exceed rpcd call timeout; run detached, caller polls zapret_status
	setsid /etc/init.d/zapret restart >/tmp/zapret-panel-restart.log 2>&1 < /dev/null &
}
zvalidate_opt() {
	# Reject command-substitution/injection patterns and oversized payloads
	case "$1" in
		*'$('*|*'`'*|*'<('*|*'>('*|*';;'*|*'&'*) return 1 ;;
	esac
	if [ "${#1}" -gt 20000 ]; then return 2; fi
	return 0
}

# --- fw4 flow-offloading fix (ported from StressOzz/Zapret-Manager) ---
# When fw4 flow offloading is on, connections are cut out of the nft path
# immediately and zapret's NFQUEUE rules never see the DPI-critical first
# packets. The fix guards the template's flow-offload statement with
# "ct original packets ge 30" so flows only offload after 30 packets.
ORBX_TPL=/usr/share/firewall4/templates/ruleset.uc
orbx_offload_mode() {
	if [ "$(uci -q get firewall.@defaults[0].flow_offloading_hw 2>/dev/null)" = 1 ] && [ "$(uci -q get firewall.@defaults[0].flow_offloading 2>/dev/null)" = 1 ]; then echo hw
	elif [ "$(uci -q get firewall.@defaults[0].flow_offloading 2>/dev/null)" = 1 ]; then echo sw
	else echo none; fi
}
orbx_fix_applied() { grep -q 'ct original packets ge 30 flow offload @ft;' "$ORBX_TPL" 2>/dev/null; }
orbx_zapret_installed() { [ -f /etc/config/zapret ] || [ -x /etc/init.d/zapret ]; }
# Idempotent template patch. Returns: 0=ok (applied or already in state), 2=pattern/template missing
orbx_tpl_fix() { # $1 = 1|0 want fix
	_t="$ORBX_TPL.orbx.tmp.$$"
	[ -f "$ORBX_TPL" ] || return 2
	awk -v zf="$1" '
		BEGIN { re = "^[ 	]*meta l4proto [{] tcp, udp [}] (ct original packets ge 30 )?flow offload @ft;$" }
		!done && $0 ~ re {
			ind = $0; sub(/meta l4proto.*$/, "", ind)
			hz = index($0, "ct original packets ge 30 ") > 0
			if (zf == "1") hz = 1; else hz = 0
			n = ind "meta l4proto { tcp, udp } " (hz ? "ct original packets ge 30 " : "") "flow offload @ft;"
			if (n != $0) ch = 1
			print n; done = 1; next
		}
		{ print }
		END { exit done ? (ch ? 0 : 1) : 2 }' "$ORBX_TPL" > "$_t"
	rc=$?
	case "$rc" in
		0) cat "$_t" > "$ORBX_TPL"; rm -f "$_t"; return 0 ;;
		1) rm -f "$_t"; return 0 ;;
		*) rm -f "$_t"; return 2 ;;
	esac
}

# --- NFQWS port-list helpers (normalize/dedupe; port of Zapret-Manager _zp_calc) ---
zport_norm() { # busybox sort lacks -t/-k: numeric pad via awk on leading number
	tr ',' '\n' | sed '/^$/d' | sort -u | awk '{ n = $0 + 0; printf "%09d|%s\n", n, $0 }' | sort | sed 's/^[0-9]*|//' | tr '\n' ',' | sed 's/,$//'; }
zreq_ports() { # $1=tcp|udp, NFQWS_OPT on stdin -> union of --filter-$1= values
	tr ' \n' '\n\n' | grep "^--filter-$1=" | cut -d= -f2- | tr '\n' ',' | zport_norm; }
_n_num() { case "$1" in ''|*[!0-9]*) echo 0 ;; *) echo "$1" ;; esac; }

case "$1" in
	list)
		json_init
		json_add_object "awg_status"
		json_close_object

		json_add_object "awg_genkey"
		json_close_object

		json_add_object "awg_import_conf"
		json_add_string "conf" "str"
		json_add_boolean "apply" 1
		json_close_object

		json_add_object "awg_delete"
		json_close_object

		json_add_object "zapret_status"
		json_close_object

		json_add_object "zapret_get_options"
		json_close_object

		json_add_object "zapret_set_options"
		json_add_boolean "nfqws_enable" 1
		json_add_string "ports_tcp" "str"
		json_add_string "ports_udp" "str"
		json_add_string "mode_filter" "str"
		json_add_string "run_on_boot" "str"
		json_add_string "nfqws_opt" "str"
		json_add_boolean "restart" 1
		json_close_object

		json_add_object "zapret_import_chunk"
		json_add_string "file" "str"
		json_add_string "b64" "str"
		json_add_boolean "last" 1
		json_close_object

		json_add_object "zapret_import_profile"
		json_add_string "name" "str"
		json_add_string "nfqws_opt" "str"
		json_add_string "ports_tcp" "str"
		json_add_string "ports_udp" "str"
		json_add_string "mode" "str"
		json_add_string "files" "str"
		json_add_boolean "restart" 1
		json_close_object

		json_add_object "zapret_restore_backup"
		json_add_string "file" "str"
		json_close_object

		json_add_object "zapret_list_files"
		json_close_object

		json_add_object "node_balancer_status"
		json_close_object

		json_add_object "node_balancer_run"
		json_close_object
		json_add_object "sub_refresh"
		json_close_object

		json_add_object "sub_set_source"
		json_close_object

		json_add_object "kid_status"
		json_close_object

		json_add_object "kid_set_master"
		json_add_boolean "on" 1
		json_close_object

		json_add_object "kid_set_device"
		json_add_string "mac" "str"
		json_add_boolean "on" 1
		json_add_string "name" "str"
		json_close_object

		json_add_object "kid_set_block"
		json_add_string "category" "str"
		json_add_boolean "on" 1
		json_close_object

		json_add_object "kid_set_bedtime"
		json_add_boolean "on" 1
		json_add_string "start" "str"
		json_add_string "end" "str"
		json_close_object

		json_add_object "zapret_test_strategy"
		json_add_string "domain" "str"
		json_add_string "strategy" "str"
		json_close_object

		json_add_object "zapret_flowoff_status"
		json_close_object

		json_add_object "zapret_flowoff_fix"
		json_add_string "enable" "boolean"
		json_close_object

		json_add_object "zapret_ports_sync"
		json_close_object

		json_add_object "zapret_auto_test"
		json_add_boolean "apply_best"
		json_close_object

		json_add_object "zapret_auto_status"
		json_close_object

		json_add_object "zaptest_stop"
		json_close_object

		json_add_object "watchdog_status"
		json_close_object

		json_add_object "watchdog_set"
		json_add_boolean "enable"
		json_add_string "interval_min" "int"
		json_add_boolean "run_now"
		json_close_object

		json_add_object "tiers_stage"
		json_add_string "part" "nft|routes|dnsmasq|config|singbox"
		json_add_string "seq" "int"
		json_add_string "chunk" "base64"
		json_add_boolean "final"
		json_close_object

		json_add_object "tiers_commit"
		json_close_object

		json_add_object "tiers_disable"
		json_close_object

		json_add_object "tiers_status"
		json_close_object

		json_add_object "tiers_get"
		json_close_object

		json_add_object "vless_status"
		json_close_object

		json_add_object "singbox_test_node"
		json_add_string "server" "str"
		json_add_int "port" 443
		json_close_object

		json_add_object "podkop_status"
		json_close_object

		json_add_object "podkop_update"
		json_close_object

		json_add_object "pbr_status"
		json_close_object

		json_add_object "pbr_trace"
		json_add_string "target" "str"
		json_close_object

		json_add_object "pbr_rule_upsert"
		json_add_string "id" "str"
		json_add_string "name" "str"
		json_add_boolean "enabled" 1
		json_add_string "interface" "str"
		json_add_string "src_addr" "str"
		json_add_string "dest_addr" "str"
		json_add_string "proto" "str"
		json_close_object

		json_add_object "pbr_rule_delete"
		json_add_string "id" "str"
		json_close_object

		json_add_object "arm_rollback"
		json_add_int "timeout" 75
		json_close_object

		json_add_object "confirm_rollback"
		json_add_string "token" "str"
		json_close_object

		json_add_object "cancel_rollback"
		json_close_object

		json_add_object "sub_decrypt_fetch"
		json_add_string "url" "str"
		json_add_string "api_key" "str"
		json_add_boolean "hwid" 1
		json_close_object

		json_add_object "singbox_set_outbound"
		json_add_string "node" "str"
		json_close_object

		json_add_object "pbr_set_device_rule"
		json_add_string "ip" "str"
		json_add_string "mac" "str"
		json_add_string "name" "str"
		json_add_string "interface" "str"
		json_add_boolean "enabled" 1
		json_close_object

		json_add_object "wifi_reload"
		json_close_object

		json_add_object "killswitch_set"
		json_add_boolean "enabled" 1
		json_add_string "scope" "str"
		json_add_boolean "allow_lan" 1
		json_close_object

		json_add_object "killswitch_status"
		json_close_object

		json_add_object "sub_save_cache"
		json_add_string "data" "str"
		json_close_object

		json_add_object "sub_get_cache"
		json_close_object

		json_add_object "policy_apply"
		json_add_array "blocked_domains"
		json_close_array
		json_add_array "direct_domains"
		json_close_array
		json_add_array "proxy_domains"
		json_close_array
		json_close_object

		json_add_object "policy_status"
		json_close_object

		json_dump
		exit 0
	;;

	call)
		if [ -t 0 ]; then
			input=""
		else
			input=$(cat)
		fi

		case "$2" in
			awg_status)
				AWG_CONF="/etc/wireguard/awg0.conf"
				UCI_EXISTS=$(uci -q get network.awg0)

				WG_BIN=""
				if command -v awg >/dev/null 2>&1; then
					WG_BIN="awg"
				elif command -v wg >/dev/null 2>&1; then
					WG_BIN="wg"
				fi

				# If neither config nor kernel interface exists, report unconfigured
				if [ ! -f "$AWG_CONF" ] && [ -z "$UCI_EXISTS" ]; then
					if [ -z "$WG_BIN" ] || ! $WG_BIN show awg0 >/dev/null 2>&1; then
						json_init
						json_add_boolean "enabled" 0
						json_add_boolean "configured" 0
						json_add_boolean "active" 0
						json_add_string "name" "awg0"
						json_add_array "addresses"
						json_close_array
						json_add_array "dns"
						json_close_array
						json_add_array "peers"
						json_close_array
						json_dump
						exit 0
					fi
				fi

				ADDR=""
				DNS=""
				MTU=1360
				LPORT=51820
				JC=0
				JMIN=0
				JMAX=0
				S1=0
				S2=0
				H1=0
				H2=0
				H3=0
				H4=0
				PEER_PUB=""
				PEER_EP=""
				ALLOWED=""
				KEEPALIVE=25

				if [ -f "$AWG_CONF" ]; then
					ADDR=$(grep -i "^Address" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					DNS=$(grep -i "^DNS" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					VAL=$(grep -i "^MTU" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && MTU="$VAL"
					VAL=$(grep -i "^ListenPort" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && LPORT="$VAL"
					VAL=$(grep -i "^Jc" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && JC="$VAL"
					VAL=$(grep -i "^Jmin" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && JMIN="$VAL"
					VAL=$(grep -i "^Jmax" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && JMAX="$VAL"
					VAL=$(grep -i "^S1" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && S1="$VAL"
					VAL=$(grep -i "^S2" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && S2="$VAL"
					VAL=$(grep -i "^H1" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && H1="$VAL"
					VAL=$(grep -i "^H2" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && H2="$VAL"
					VAL=$(grep -i "^H3" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && H3="$VAL"
					VAL=$(grep -i "^H4" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && H4="$VAL"

					PEER_PUB=$(grep -i "^PublicKey" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					PEER_EP=$(grep -i "^Endpoint" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					VAL=$(grep -i "^AllowedIPs" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && ALLOWED="$VAL"
					VAL=$(grep -i "^PersistentKeepalive" "$AWG_CONF" | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
					[ -n "$VAL" ] && KEEPALIVE="$VAL"
				elif [ -n "$UCI_EXISTS" ]; then
					ADDR=$(uci -q get network.awg0.addresses | tr '\n' ' ')
					VAL=$(uci -q get network.awg0.mtu)
					[ -n "$VAL" ] && MTU="$VAL"
					VAL=$(uci -q get network.awg0.listen_port)
					[ -n "$VAL" ] && LPORT="$VAL"
					VAL=$(uci -q get network.awg0.jc)
					[ -n "$VAL" ] && JC="$VAL"
					VAL=$(uci -q get network.awg0.jmin)
					[ -n "$VAL" ] && JMIN="$VAL"
					VAL=$(uci -q get network.awg0.jmax)
					[ -n "$VAL" ] && JMAX="$VAL"
					VAL=$(uci -q get network.awg0.s1)
					[ -n "$VAL" ] && S1="$VAL"
					VAL=$(uci -q get network.awg0.s2)
					[ -n "$VAL" ] && S2="$VAL"
					VAL=$(uci -q get network.awg0.h1)
					[ -n "$VAL" ] && H1="$VAL"
					VAL=$(uci -q get network.awg0.h2)
					[ -n "$VAL" ] && H2="$VAL"
					VAL=$(uci -q get network.awg0.h3)
					[ -n "$VAL" ] && H3="$VAL"
					VAL=$(uci -q get network.awg0.h4)
					[ -n "$VAL" ] && H4="$VAL"

					PEER_PUB=$(uci -q get network.peer_awg0.public_key)
					P_HOST=$(uci -q get network.peer_awg0.endpoint_host)
					P_PORT=$(uci -q get network.peer_awg0.endpoint_port || echo 51820)
					if [ -n "$P_HOST" ]; then
						case "$P_HOST" in
							*:*) PEER_EP="[${P_HOST}]:${P_PORT}" ;;
							*)   PEER_EP="${P_HOST}:${P_PORT}" ;;
						esac
					fi
					VAL=$(uci -q get network.peer_awg0.allowed_ips)
					[ -n "$VAL" ] && ALLOWED="$VAL"
					VAL=$(uci -q get network.peer_awg0.persistent_keepalive)
					[ -n "$VAL" ] && KEEPALIVE="$VAL"
				fi

				PUBKEY=""
				HANDSHAKE=0
				RX=0
				TX=0
				IS_ACTIVE=0

				if [ -n "$WG_BIN" ]; then
					if $WG_BIN show awg0 >/dev/null 2>&1; then
						PUBKEY=$($WG_BIN show awg0 public-key 2>/dev/null)
						VAL=$($WG_BIN show awg0 listen-port 2>/dev/null)
						[ -n "$VAL" ] && LPORT="$VAL"
						VAL=$($WG_BIN show awg0 latest-handshakes 2>/dev/null | awk '{print $2}')
						if [ -n "$VAL" ] && [ "$VAL" -gt 0 ] 2>/dev/null; then
							HANDSHAKE="$VAL"
							IS_ACTIVE=1
						fi
						VAL=$($WG_BIN show awg0 transfer 2>/dev/null | awk '{print $2}')
						[ -n "$VAL" ] && RX="$VAL"
						VAL=$($WG_BIN show awg0 transfer 2>/dev/null | awk '{print $3}')
						[ -n "$VAL" ] && TX="$VAL"
					fi
				fi

				json_init
				json_add_boolean "enabled" 1
				json_add_boolean "configured" 1
				json_add_boolean "active" "$IS_ACTIVE"
				json_add_string "name" "awg0"
				json_add_string "public_key" "$PUBKEY"
				json_add_int "listen_port" "$LPORT"
				json_add_int "mtu" "$MTU"
				json_add_array "addresses"
				for a in $ADDR; do
					[ -n "$a" ] && json_add_string "" "$a"
				done
				json_close_array
				json_add_array "dns"
				for d in $DNS; do
					[ -n "$d" ] && json_add_string "" "$d"
				done
				json_close_array
				json_add_int "jc" "$JC"
				json_add_int "jmin" "$JMIN"
				json_add_int "jmax" "$JMAX"
				json_add_int "s1" "$S1"
				json_add_int "s2" "$S2"
				json_add_int "h1" "$H1"
				json_add_int "h2" "$H2"
				json_add_int "h3" "$H3"
				json_add_int "h4" "$H4"
				json_add_array "peers"
				if [ -n "$PEER_PUB" ] || [ -n "$PEER_EP" ]; then
					json_add_object
					json_add_string "public_key" "$PEER_PUB"
					json_add_string "endpoint" "$PEER_EP"
					json_add_array "allowed_ips"
					for ip in $(echo "$ALLOWED" | tr ',' ' '); do
						[ -n "$ip" ] && json_add_string "" "$ip"
					done
					json_close_array
					json_add_int "persistent_keepalive" "$KEEPALIVE"
					json_add_int "latest_handshake" "$HANDSHAKE"
					json_add_int "transfer_rx" "$RX"
					json_add_int "transfer_tx" "$TX"
					json_close_object
				fi
				json_close_array
				json_dump
			;;

			awg_genkey)
				WG_BIN=""
				if command -v awg >/dev/null 2>&1; then
					WG_BIN="awg"
				elif command -v wg >/dev/null 2>&1; then
					WG_BIN="wg"
				fi

				if [ -z "$WG_BIN" ]; then
					return_error "Neither awg nor wg binary is installed"
				fi

				PRIV=$($WG_BIN genkey 2>/dev/null)
				if [ -z "$PRIV" ]; then
					return_error "Failed to generate private key via $WG_BIN"
				fi

				PUB=$(printf "%s" "$PRIV" | $WG_BIN pubkey 2>/dev/null)
				if [ -z "$PUB" ]; then
					return_error "Failed to derive public key via $WG_BIN"
				fi

				json_init
				json_add_string "status" "ok"
				json_add_string "private_key" "$PRIV"
				json_add_string "public_key" "$PUB"
				json_dump
			;;

			awg_import_conf)
				CONF=$(printf "%s\n" "$input" | jsonfilter -e '@.conf' 2>/dev/null)
				APPLY=$(printf "%s\n" "$input" | jsonfilter -e '@.apply' 2>/dev/null)
				if [ -z "$APPLY" ]; then APPLY="true"; fi

				if [ -z "$CONF" ]; then
					return_error "No configuration content provided"
				fi

				mkdir -p /etc/wireguard
				printf "%s\n" "$CONF" > /etc/wireguard/awg0.conf
				chmod 600 /etc/wireguard/awg0.conf

				ADDR=$(grep -i "^Address" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				PRIV=$(grep -i "^PrivateKey" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				DNS=$(grep -i "^DNS" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				MTU=$(grep -i "^MTU" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				LPORT=$(grep -i "^ListenPort" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				[ -z "$MTU" ] && MTU=1360
				[ -z "$LPORT" ] && LPORT=51820

				JC=$(grep -i "^Jc" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				JMIN=$(grep -i "^Jmin" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				JMAX=$(grep -i "^Jmax" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				S1=$(grep -i "^S1" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				S2=$(grep -i "^S2" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				H1=$(grep -i "^H1" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				H2=$(grep -i "^H2" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				H3=$(grep -i "^H3" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				H4=$(grep -i "^H4" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')

				PUBKEY=$(grep -i "^PublicKey" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				ENDPOINT=$(grep -i "^Endpoint" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				ALLOWED=$(grep -i "^AllowedIPs" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				KEEPALIVE=$(grep -i "^PersistentKeepalive" /etc/wireguard/awg0.conf | head -n1 | cut -d'=' -f2- | tr -d ' \r\t')
				[ -z "$ALLOWED" ] && ALLOWED="0.0.0.0/0"
				[ -z "$KEEPALIVE" ] && KEEPALIVE="25"

				case "$ENDPOINT" in
					\[*\]:*)
						PEER_HOST="${ENDPOINT%%\]*}"
						PEER_HOST="${PEER_HOST#\[}"
						PEER_PORT="${ENDPOINT##*:}"
						;;
					\[*\])
						PEER_HOST="${ENDPOINT#\[}"
						PEER_HOST="${PEER_HOST%\]}"
						PEER_PORT=""
						;;
					*:*:*)
						PEER_HOST="$ENDPOINT"
						PEER_PORT=""
						;;
					*:*)
						PEER_HOST="${ENDPOINT%:*}"
						PEER_PORT="${ENDPOINT##*:}"
						;;
					*)
						PEER_HOST="$ENDPOINT"
						PEER_PORT=""
						;;
				esac
				[ -z "$PEER_PORT" ] && PEER_PORT=51820

				uci -q delete network.awg0
				uci -q delete network.peer_awg0
				uci set network.awg0=interface
				uci set network.awg0.proto='wireguard'
				[ -n "$PRIV" ] && uci set network.awg0.private_key="$PRIV"
				uci set network.awg0.listen_port="$LPORT"
				uci set network.awg0.mtu="$MTU"
				[ -n "$ADDR" ] && uci add_list network.awg0.addresses="$ADDR"

				[ -n "$JC" ] && uci set network.awg0.jc="$JC"
				[ -n "$JMIN" ] && uci set network.awg0.jmin="$JMIN"
				[ -n "$JMAX" ] && uci set network.awg0.jmax="$JMAX"
				[ -n "$S1" ] && uci set network.awg0.s1="$S1"
				[ -n "$S2" ] && uci set network.awg0.s2="$S2"
				[ -n "$H1" ] && uci set network.awg0.h1="$H1"
				[ -n "$H2" ] && uci set network.awg0.h2="$H2"
				[ -n "$H3" ] && uci set network.awg0.h3="$H3"
				[ -n "$H4" ] && uci set network.awg0.h4="$H4"

				if [ -n "$PUBKEY" ]; then
					uci set network.peer_awg0=wireguard_awg0
					uci set network.peer_awg0.public_key="$PUBKEY"
					uci set network.peer_awg0.endpoint_host="$PEER_HOST"
					uci set network.peer_awg0.endpoint_port="$PEER_PORT"
					for ip in $(echo "$ALLOWED" | tr ',' ' '); do
						uci add_list network.peer_awg0.allowed_ips="$ip"
					done
					uci set network.peer_awg0.persistent_keepalive="$KEEPALIVE"
				fi
				uci commit network

				if ! uci get firewall.@zone[1].network 2>/dev/null | grep -q 'awg0'; then
					uci add_list firewall.@zone[1].network='awg0'
					uci commit firewall
				fi

				if [ "$APPLY" = "true" ]; then
					/etc/init.d/network reload >/dev/null 2>&1 &
					/etc/init.d/firewall reload >/dev/null 2>&1 &
				fi

				json_init
				json_add_string "status" "ok"
				json_add_string "message" "AmneziaWG profile imported and applied"
				json_dump
			;;

			awg_delete)
				uci -q delete network.awg0
				uci -q delete network.peer_awg0
				uci -q del_list firewall.@zone[1].network='awg0'
				uci commit network >/dev/null 2>&1
				uci commit firewall >/dev/null 2>&1
				rm -f /etc/wireguard/awg0.conf
				ifdown awg0 >/dev/null 2>&1
				/etc/init.d/network reload >/dev/null 2>&1 &
				/etc/init.d/firewall reload >/dev/null 2>&1 &

				json_init
				json_add_string "status" "ok"
				json_add_string "message" "AmneziaWG configuration removed"
				json_dump
			;;

			zapret_status)
				RUNNING=0
				(pidof nfqws || pgrep nfqws) >/dev/null 2>&1 && RUNNING=1

				ZAPRET_INSTALLED=0
				if [ -f /etc/config/zapret ] || [ -x /opt/zapret/init.d/zapret ] || [ -x /etc/init.d/zapret ] || [ "$RUNNING" = "1" ]; then
					ZAPRET_INSTALLED=1
				fi

				ENABLED=0
				VAL=$(zg NFQWS_ENABLE)
				[ -z "$VAL" ] && VAL=$(zg run_on_boot)
				[ "$VAL" = "1" ] && ENABLED=1

				FWTYPE=$(zg FWTYPE || echo "nftables")
				MODE_FILTER=$(zg MODE_FILTER || echo "hostlist")
				PORTS_TCP=$(zg NFQWS_PORTS_TCP || echo "80,443")
				PORTS_UDP=$(zg NFQWS_PORTS_UDP || echo "")
				NFQWS_OPT=$(zg NFQWS_OPT)
				[ -z "$NFQWS_OPT" ] && NFQWS_OPT=$(zg NFQWS_OPT_TCP)

				json_init
				json_add_boolean "installed" "$ZAPRET_INSTALLED"
				json_add_boolean "running" "$RUNNING"
				json_add_boolean "enabled" "$ENABLED"
				json_add_string "fwtype" "$FWTYPE"
				json_add_string "mode_filter" "$MODE_FILTER"
				json_add_string "ports_tcp" "$PORTS_TCP"
				json_add_string "ports_udp" "$PORTS_UDP"
				json_add_string "nfqws_opt" "$NFQWS_OPT"
				json_add_int "nfqws_opt_len" "${#NFQWS_OPT}"

				# Profiles array parsed from configuration (only when zapret is actually present)
				json_add_array "profiles"
				if [ "$ZAPRET_INSTALLED" = "1" ]; then

				# Profile 1: TCP HTTPS
				json_add_object
				json_add_string "id" "zapret-tcp"
				json_add_string "name" "TCP HTTPS (NFQWS DPI Bypass)"
				json_add_boolean "enabled" "$ENABLED"
				json_add_string "mode" "nfqws"
				json_add_string "protocol" "tcp"
				json_add_string "ports" "$PORTS_TCP"

				# Methods parsed per-protocol from the real NFQWS_OPT --new sections
				json_add_array "methods"
				FLAT=$(printf '%s' "$NFQWS_OPT" | tr '\n' ' ')
				TCPD=$(printf '%s' "$FLAT" | sed 's/--new/\n/g' | grep -- '--filter-tcp' | grep -o -- '--dpi-desync=[^ ]*' | head -n 1 | cut -d= -f2)
				[ -z "$TCPD" ] && TCPD=$(printf '%s' "$(zg NFQWS_OPT_TCP)" | grep -o -- '--dpi-desync=[^ ]*' | head -n 1 | cut -d= -f2)
				if [ -n "$TCPD" ]; then
					for m in $(printf '%s' "$TCPD" | tr ',' ' '); do
						json_add_string "" "$m"
					done
				else
					json_add_string "" "none"
				fi
				json_close_array

				# Real domain list from /opt/zapret/ipset/ or system
				json_add_array "hostlist"
				for hfile in /opt/zapret/ipset/zapret-hosts*.txt /opt/zapret/ipset/*.txt; do
					if [ -f "$hfile" ] && [ "$hfile" != "/opt/zapret/ipset/zapret-hosts-user-exclude.txt.default" ]; then
						head -n 40 "$hfile" 2>/dev/null | while IFS= read -r d; do
							# skip comments and empty lines
							case "$d" in
								\#*|"") continue ;;
								*) json_add_string "" "$d" ;;
							esac
						done
					fi
				done
				json_close_array

				# Real user exclude list
				json_add_array "exclude_list"
				EXCL_FILE="/opt/zapret/ipset/zapret-hosts-user-exclude.txt"
				if [ -f "$EXCL_FILE" ]; then
					head -n 30 "$EXCL_FILE" 2>/dev/null | while IFS= read -r d; do
						case "$d" in
							\#*|"") continue ;;
							*) json_add_string "" "$d" ;;
						esac
					done
				fi
				json_close_array
				json_close_object

				# Profile 2: UDP QUIC
				if [ -n "$PORTS_UDP" ]; then
					json_add_object
					json_add_string "id" "zapret-udp"
					json_add_string "name" "UDP QUIC & Media Voice"
					json_add_boolean "enabled" "$ENABLED"
					json_add_string "mode" "nfqws"
					json_add_string "protocol" "udp"
					json_add_string "ports" "$PORTS_UDP"
					json_add_array "methods"
					UDPD=$(printf '%s' "$FLAT" | sed 's/--new/\n/g' | grep -- '--filter-udp' | grep -o -- '--dpi-desync=[^ ]*' | head -n 1 | cut -d= -f2)
					[ -z "$UDPD" ] && UDPD=$(printf '%s' "$(zg NFQWS_OPT_UDP)" | grep -o -- '--dpi-desync=[^ ]*' | head -n 1 | cut -d= -f2)
					if [ -n "$UDPD" ]; then
						for m in $(printf '%s' "$UDPD" | tr ',' ' '); do
							json_add_string "" "$m"
						done
					else
						json_add_string "" "none"
					fi
					json_close_array
					json_add_array "hostlist"
					json_close_array
					json_add_array "exclude_list"
					json_close_array
					json_close_object
				fi
				fi

				json_close_array
				json_dump
			;;

			zapret_get_options)
				RUNNING=0
				(pidof nfqws || pgrep nfqws) >/dev/null 2>&1 && RUNNING=1
				INSTALLED=0
				[ -f /etc/config/zapret ] && INSTALLED=1
				EN=$(zg NFQWS_ENABLE)
				[ -z "$EN" ] && EN=$(zg run_on_boot)
				[ "$EN" = "1" ] || EN=0
				OPT=$(zg NFQWS_OPT)

				json_init
				json_add_boolean "installed" "$INSTALLED"
				json_add_boolean "running" "$RUNNING"
				json_add_boolean "nfqws_enable" "$EN"
				json_add_string "ports_tcp" "$(zg NFQWS_PORTS_TCP)"
				json_add_string "ports_udp" "$(zg NFQWS_PORTS_UDP)"
				json_add_string "mode_filter" "$(zg MODE_FILTER)"
				json_add_string "run_on_boot" "$(zg run_on_boot)"
				json_add_string "fwtype" "$(zg FWTYPE)"
				json_add_string "nfqws_opt" "$OPT"

				json_add_array "list_files"
				for _lf in /opt/zapret/ipset/*.txt /opt/zapret/hosts/*.txt; do
					[ -f "$_lf" ] || continue
					_SZ=$(stat -c %s "$_lf" 2>/dev/null)
					case "$_SZ" in ''|*[!0-9]*) _SZ=0 ;; esac
					json_add_object
					json_add_string "name" "$(basename "$_lf")"
					json_add_string "path" "$_lf"
					json_add_int "size" "$_SZ"
					json_close_object
				done
				json_close_array

				json_add_array "backups"
				for _bk in $(ls -1 /opt/zapret/panel-backup/ 2>/dev/null | sort | tail -n 10); do
					json_add_string "" "$_bk"
				done
				json_close_array
				json_dump
			;;

			zapret_list_files)
				json_init
				json_add_array "list_files"
				for _lf in /opt/zapret/ipset/*.txt /opt/zapret/hosts/*.txt; do
					[ -f "$_lf" ] || continue
					_SZ=$(stat -c %s "$_lf" 2>/dev/null)
					case "$_SZ" in ''|*[!0-9]*) _SZ=0 ;; esac
					json_add_object
					json_add_string "name" "$(basename "$_lf")"
					json_add_string "path" "$_lf"
					json_add_int "size" "$_SZ"
					json_close_object
				done
				json_close_array
				json_add_array "backups"
				for _bk in $(ls -1 /opt/zapret/panel-backup/ 2>/dev/null | sort | tail -n 10); do
					json_add_string "" "$_bk"
				done
				json_close_array
				json_dump
			;;

			zapret_set_options)
				NFN=$(printf "%s\n" "$input" | jsonfilter -e '@.nfqws_enable' 2>/dev/null)
				PTCP=$(printf "%s\n" "$input" | jsonfilter -e '@.ports_tcp' 2>/dev/null)
				PUDP=$(printf "%s\n" "$input" | jsonfilter -e '@.ports_udp' 2>/dev/null)
				MFILT=$(printf "%s\n" "$input" | jsonfilter -e '@.mode_filter' 2>/dev/null)
				ROB=$(printf "%s\n" "$input" | jsonfilter -e '@.run_on_boot' 2>/dev/null)
				NOPT=$(printf "%s\n" "$input" | jsonfilter -e '@.nfqws_opt' 2>/dev/null)
				RST=$(printf "%s\n" "$input" | jsonfilter -e '@.restart' 2>/dev/null)

				case "$PTCP" in *[!0-9,-]*) return_error "ports_tcp: только цифры, запятые и дефисы" ;; esac
				case "$PUDP" in *[!0-9,-]*) return_error "ports_udp: только цифры, запятые и дефисы" ;; esac
				case "$MFILT" in
					""|hostlist|auto_hostlist|non_tcp|raw) ;;
					*) return_error "mode_filter: допустимы hostlist, auto_hostlist, non_tcp, raw" ;;
				esac
				if [ -n "$NOPT" ]; then
					zvalidate_opt "$NOPT"
					case $? in
						1) return_error "nfqws_opt содержит запрещённые конструкции (\$(, \`, <(, >(; ; &)" ;;
						2) return_error "nfqws_opt длиннее 20000 символов" ;;
					esac
				fi

				# Back current config before any write
				mkdir -p /opt/zapret/panel-backup 2>/dev/null
				[ -f /etc/config/zapret ] && cp -f /etc/config/zapret "/opt/zapret/panel-backup/zapret.$(date +%Y%m%d-%H%M%S).opts" 2>/dev/null

				[ -n "$NFN" ] && zs NFQWS_ENABLE "$NFN"
				[ -n "$PTCP" ] && zs NFQWS_PORTS_TCP "$PTCP"
				[ "$PUDP"x != "x" ] && zs NFQWS_PORTS_UDP "$PUDP"
				[ -n "$MFILT" ] && zs MODE_FILTER "$MFILT"
				[ -n "$ROB" ] && zs run_on_boot "$ROB"
				[ -n "$NOPT" ] && zs NFQWS_OPT "$NOPT"

				if ! uci commit zapret 2>/dev/null; then
					return_error "uci commit не прошёл — изменения НЕ сохранены"
				fi

				# Verify persisted values by reading them back
				OK=1
				[ -n "$PTCP" ] && [ "$(zg NFQWS_PORTS_TCP)" != "$PTCP" ] && OK=0
				[ -n "$NOPT" ] && [ "$(zg NFQWS_OPT)" != "$NOPT" ] && OK=0

				STARTED=0
				if [ "$OK" = "1" ] && [ "$RST" != "0" ]; then
					zrestart_bg
					STARTED=1
				fi

				json_init
				json_add_string "status" "ok"
				json_add_boolean "committed" 1
				json_add_boolean "verified" "$OK"
				json_add_boolean "restart_started" "$STARTED"
				json_add_string "restart_note" "zapret перезапускается в фоне: список хостов перечитывается, дождитесь running=да"
				json_dump
			;;

			zapret_import_chunk)
				_CFILE=$(printf "%s\n" "$input" | jsonfilter -e '@.file' 2>/dev/null)
				_CB64=$(printf "%s\n" "$input" | jsonfilter -e '@.b64' 2>/dev/null)
				_CLAST=$(printf "%s\n" "$input" | jsonfilter -e '@.last' 2>/dev/null)
				_CSAFE=$(printf '%s' "$_CFILE" | tr -cd 'A-Za-z0-9._-' | cut -c1-64)
				[ -z "$_CSAFE" ] && return_error "chunk: некорректное имя файла"
				mkdir -p /tmp/zapret-imp
				printf '%s' "$_CB64" >> "/tmp/zapret-imp/$_CSAFE.b64"
				_BYTES=0
				if [ "$_CLAST" = "1" ]; then
					_DEC_OK=0
					if command -v base64 >/dev/null 2>&1; then
						base64 -d "/tmp/zapret-imp/$_CSAFE.b64" > "/tmp/zapret-imp/$_CSAFE" 2>/dev/null && _DEC_OK=1
					fi
					if [ "$_DEC_OK" = "0" ] && command -v openssl >/dev/null 2>&1; then
						openssl base64 -d -A -in "/tmp/zapret-imp/$_CSAFE.b64" > "/tmp/zapret-imp/$_CSAFE" 2>/dev/null && _DEC_OK=1
						if [ "$_DEC_OK" = "0" ]; then
							openssl enc -d -base64 -A -in "/tmp/zapret-imp/$_CSAFE.b64" > "/tmp/zapret-imp/$_CSAFE" 2>/dev/null && _DEC_OK=1
						fi
					fi
					if [ "$_DEC_OK" = "0" ]; then
						rm -f "/tmp/zapret-imp/$_CSAFE.b64" "/tmp/zapret-imp/$_CSAFE"
						return_error "chunk: повреждённый base64 или нет декодера (base64/openssl) на роутере ($_CSAFE)"
					fi
					rm -f "/tmp/zapret-imp/$_CSAFE.b64"
					_BYTES=$(wc -c < "/tmp/zapret-imp/$_CSAFE" 2>/dev/null)
					case "$_BYTES" in ''|*[!0-9]*) _BYTES=0 ;; esac
				fi
				json_init
				json_add_string "status" "ok"
				json_add_string "name" "$_CSAFE"
				json_add_int "bytes" "$_BYTES"
				json_dump
			;;

			zapret_import_profile)
				_INAME=$(printf "%s\n" "$input" | jsonfilter -e '@.name' 2>/dev/null)
				_INOPT=$(printf "%s\n" "$input" | jsonfilter -e '@.nfqws_opt' 2>/dev/null)
				_iPTCP=$(printf "%s\n" "$input" | jsonfilter -e '@.ports_tcp' 2>/dev/null)
				_iPUDP=$(printf "%s\n" "$input" | jsonfilter -e '@.ports_udp' 2>/dev/null)
				_ImODE=$(printf "%s\n" "$input" | jsonfilter -e '@.mode' 2>/dev/null)
				_IFILES=$(printf "%s\n" "$input" | jsonfilter -e '@.files' 2>/dev/null)
				_iRST=$(printf "%s\n" "$input" | jsonfilter -e '@.restart' 2>/dev/null)

				_INAMES=$(printf '%s' "$_INAME" | tr -cd 'A-Za-z0-9._-' | cut -c1-40)
				[ -z "$_INAMES" ] && return_error "import: пустое или недопустимое имя профиля"
				[ -z "$_INOPT" ] && return_error "import: пустая стратегия"
				zvalidate_opt "$_INOPT"
				case $? in
					1) return_error "import: стратегия содержит запрещённые конструкции" ;;
					2) return_error "import: стратегия длиннее 20000 символов" ;;
				esac
				case "$_iPTCP" in *[!0-9,-]*) return_error "import: ports_tcp некорректны" ;; esac
				case "$_iPUDP" in *[!0-9,-]*) return_error "import: ports_udp некорректны" ;; esac

				# Backup current config before import
				mkdir -p /opt/zapret/panel-backup /opt/zapret/ipset
				cp -f /etc/config/zapret "/opt/zapret/panel-backup/zapret.$(date +%Y%m%d-%H%M%S).pre-import" 2>/dev/null

				json_init
				json_add_string "status" "ok"
				json_add_array "written"
				for _cf in $(printf '%s' "$_IFILES" | tr ',' ' '); do
					_cfs=$(printf '%s' "$_cf" | tr -cd 'A-Za-z0-9._-')
					[ -z "$_cfs" ] && continue
					if [ ! -f "/tmp/zapret-imp/$_cfs" ]; then
						return_error "import: файл чанков не найден: $_cfs (загрузите заново)"
					fi
					# Reject binary/control content (allow newline)
					if LC_ALL=C tr -d '\n' < "/tmp/zapret-imp/$_cfs" | LC_ALL=C grep -q '[[:cntrl:]]'; then
						rm -f "/tmp/zapret-imp/$_cfs"
						return_error "import: $_cfs содержит бинарные данные — список отклонён"
					fi
					mv "/tmp/zapret-imp/$_cfs" "/opt/zapret/ipset/$_cfs" || return_error "import: не удалось записать /opt/zapret/ipset/$_cfs"
					json_add_string "" "/opt/zapret/ipset/$_cfs"
				done
				json_close_array

				if [ "$_ImODE" = "append" ]; then
					_OLD=$(zg NFQWS_OPT)
					if [ -n "$_OLD" ]; then
						_IFINAL=$(printf '%s\n--new\n%s' "$_OLD" "$_INOPT")
					else
						_IFINAL="$_INOPT"
					fi
				else
					_IFINAL="$_INOPT"
				fi

				zs NFQWS_OPT "$_IFINAL" || return_error "import: uci set NFQWS_OPT не прошёл"
				[ -n "$_iPTCP" ] && zs NFQWS_PORTS_TCP "$_iPTCP"
				[ "$_iPUDP"x != "x" ] && zs NFQWS_PORTS_UDP "$_iPUDP"
				if ! uci commit zapret 2>/dev/null; then
					return_error "import: uci commit не прошёл — конфиг НЕ применён (бэкап в /opt/zapret/panel-backup)"
				fi

				_iSTARTED=0
				if [ "$_iRST" != "0" ]; then
					zrestart_bg
					_iSTARTED=1
				fi
				json_add_string "mode" "${_ImODE:-replace}"
				json_add_boolean "committed" 1
				json_add_boolean "restart_started" "$_iSTARTED"
				json_add_int "opt_len" "${#_IFINAL}"
				json_dump
			;;

			zapret_restore_backup)
				_RFB=$(printf "%s\n" "$input" | jsonfilter -e '@.file' 2>/dev/null)
				_RSAFE=$(printf '%s' "$_RFB" | tr -cd 'A-Za-z0-9._-' | cut -c1-80)
				case "$_RSAFE" in zapret.*) ;; *) return_error "restore: некорректное имя бэкапа" ;; esac
				_RSRC="/opt/zapret/panel-backup/$_RSAFE"
				[ -f "$_RSRC" ] || return_error "restore: файл не найден: $_RSAFE"
				mkdir -p /opt/zapret/panel-backup
				cp -f /etc/config/zapret "/opt/zapret/panel-backup/zapret.$(date +%Y%m%d-%H%M%S).pre-restore" 2>/dev/null
				cp -f "$_RSRC" /etc/config/zapret || return_error "restore: не удалось восстановить файл конфига"
				uci -q show zapret >/dev/null 2>&1
				zrestart_bg
				json_init
				json_add_string "status" "ok"
				json_add_boolean "restored" 1
				json_add_string "from" "$_RSAFE"
				json_add_boolean "restart_started" 1
				json_dump
			;;

			zapret_test_strategy)
				RAW_TARGET=$(printf "%s\n" "$input" | jsonfilter -e '@.domain' 2>/dev/null | tr -d ' \t\r\n')
				STRATEGY=$(printf "%s\n" "$input" | jsonfilter -e '@.strategy' 2>/dev/null | tr -d ' \t\r\n')
				if [ -z "$RAW_TARGET" ]; then RAW_TARGET="youtube.com"; fi

				# Strict input sanitization: valid FQDN or IPv4
				TARGET=$(printf "%s" "$RAW_TARGET" | grep -E '^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$' || true)
				if [ -z "$TARGET" ]; then
					TARGET=$(printf "%s" "$RAW_TARGET" | grep -E '^([0-9]{1,3}\.){3}[0-9]{1,3}$' || true)
				fi
				if [ -z "$TARGET" ]; then
					return_error "Invalid target domain or IP address format"
				fi

				# Real curl network probe measuring connect, TLS handshake, and HTTP status
				CURL_OUT=$(curl -s -4 -o /dev/null -w "%{http_code} %{time_connect} %{time_appconnect} %{time_total}" --connect-timeout 4 -m 6 "https://$TARGET" 2>/dev/null)
				CURL_EXIT=$?

				if [ "$CURL_EXIT" -ne 0 ] || [ -z "$CURL_OUT" ]; then
					json_init
					json_add_string "status" "error"
					json_add_boolean "verified" 0
					json_add_string "target" "$TARGET"
					json_add_string "message" "Handshake failed or timed out (curl exit code $CURL_EXIT)"
					json_dump
					exit 0
				fi

				HTTP_CODE=$(echo "$CURL_OUT" | awk '{print $1}')
				T_CONN=$(echo "$CURL_OUT" | awk '{print $2}')
				T_APP=$(echo "$CURL_OUT" | awk '{print $3}')
				T_TOTAL=$(echo "$CURL_OUT" | awk '{print $4}')

				MS_CONN=$(awk "BEGIN {print int($T_CONN * 1000)}")
				MS_APP=$(awk "BEGIN {print int($T_APP * 1000)}")
				MS_TOTAL=$(awk "BEGIN {print int($T_TOTAL * 1000)}")

				json_init
				json_add_string "status" "ok"
				json_add_boolean "verified" 1
				json_add_string "target" "$TARGET"
				json_add_int "http_code" "$HTTP_CODE"
				json_add_int "connect_time_ms" "$MS_CONN"
				json_add_int "tls_handshake_ms" "$MS_APP"
				json_add_int "total_time_ms" "$MS_TOTAL"
				json_dump
			;;

			zapret_flowoff_status)
				json_init
				json_add_string "status" "ok"
				json_add_boolean "zapret_installed" "$(orbx_zapret_installed && echo 1 || echo 0)"
				json_add_boolean "fw4_tpl" "$([ -f "$ORBX_TPL" ] && echo 1 || echo 0)"
				json_add_string "offload" "$(orbx_offload_mode)"
				json_add_boolean "fix_applied" "$(orbx_fix_applied && echo 1 || echo 0)"
				json_add_boolean "fix_needed" "$([ "$(orbx_offload_mode)" != none ] && orbx_zapret_installed && ! orbx_fix_applied && echo 1 || echo 0)"
				json_dump
			;;

			zapret_flowoff_fix)
				WANT=$(printf "%s\n" "$input" | jsonfilter -e '@.enable' 2>/dev/null | tr -d ' 	\r\n')
				[ -n "$WANT" ] || WANT=true
				[ -f "$ORBX_TPL" ] || return_error "firewall4 template not found — cannot manage flow offloading fix"
				case "$WANT" in true|false) ;; *) return_error "enable must be true or false" ;; esac
				cp -f "$ORBX_TPL" /tmp/ruleset.uc.orbx.bak
				if [ "$WANT" = "true" ]; then
					orbx_tpl_fix 1 || { cp -f /tmp/ruleset.uc.orbx.bak "$ORBX_TPL"; return_error "expected flow-offload statement not found in fw4 template — nothing changed"; }
					orbx_fix_applied || { cp -f /tmp/ruleset.uc.orbx.bak "$ORBX_TPL"; return_error "fix verification failed — rolled back, nothing changed"; }
				else
					orbx_tpl_fix 0 || { cp -f /tmp/ruleset.uc.orbx.bak "$ORBX_TPL"; return_error "fw4 template pattern not found — nothing changed"; }
				fi
				if ! /etc/init.d/firewall reload > /tmp/orbx-fw4-reload.log 2>&1; then
					cp -f /tmp/ruleset.uc.orbx.bak "$ORBX_TPL"
					/etc/init.d/firewall reload > /dev/null 2>&1
					return_error "ruleset reload failed — template rolled back ($(tail -n 2 /tmp/orbx-fw4-reload.log | tr '\n' ' '))"
				fi
				logger -t orbix "flow-offload fix: enable=$WANT applied, offload=$(orbx_offload_mode)"
				json_init
				json_add_string "status" "ok"
				json_add_boolean "fix_applied" "$(orbx_fix_applied && echo 1 || echo 0)"
				json_add_string "offload" "$(orbx_offload_mode)"
				json_add_string "message" "$([ "$(orbx_offload_mode)" = none ] && echo "fix stored; offloading is off so ruleset behavior unchanged" || echo "fix applied and firewall reloaded")"
				json_dump
			;;

			zapret_ports_sync)
				if ! orbx_zapret_installed; then return_error "Zapret is not installed"; fi
				OPT=$(zg NFQWS_OPT)
				[ -n "$OPT" ] || OPT=$(zg NFQWS_OPT_TCP)
				[ -n "$OPT" ] || return_error "No NFQWS_OPT found — nothing to sync"
				FLAT=$(printf '%s' "$OPT" | tr '\n' ' ')
				REQ_T=$(printf '%s' "$FLAT" | zreq_ports tcp)
				REQ_U=$(printf '%s' "$FLAT" | zreq_ports udp)
				CUR_T=$(zg NFQWS_PORTS_TCP)
				CUR_U=$(zg NFQWS_PORTS_UDP)
				NEW_T=$(printf '%s,%s' "${CUR_T:-}" "${REQ_T:-}" | zport_norm)
				NEW_U=$(printf '%s,%s' "${CUR_U:-}" "${REQ_U:-}" | zport_norm)
				CHANGED=0
				if [ -n "$NEW_T" ] && [ "$NEW_T" != "$(printf '%s' "${CUR_T:-}" | zport_norm)" ]; then
					zs NFQWS_PORTS_TCP "$NEW_T" && CHANGED=1
				fi
				if [ -n "$NEW_U" ] && [ "$NEW_U" != "$(printf '%s' "${CUR_U:-}" | zport_norm)" ]; then
					zs NFQWS_PORTS_UDP "$NEW_U" && CHANGED=1
				fi
				if [ "$CHANGED" = "1" ]; then
					uci commit zapret
					logger -t orbix "zapret ports synced with strategy: TCP=$NEW_T UDP=$NEW_U"
					zrestart_bg
				fi
				json_init
				json_add_string "status" "ok"
				json_add_boolean "changed" "$CHANGED"
				json_add_string "ports_tcp" "${NEW_T:-$CUR_T}"
				json_add_string "ports_udp" "${NEW_U:-$CUR_U}"
				json_add_string "required_tcp" "$REQ_T"
				json_add_string "required_udp" "$REQ_U"
				json_add_string "message" "$([ "$CHANGED" = 1 ] && echo "ports updated and zapret restarting" || echo "ports already match strategy (deduped)")"
				json_dump
			;;

			zapret_auto_test)
				[ -x /usr/sbin/panel-zaptest ] || return_error "panel-zaptest not deployed on router"
				if [ -f /tmp/orbix-zaptest.run ]; then
					_P=$(cat /tmp/orbix-zaptest.run 2>/dev/null)
					if [ -n "$_P" ] && kill -0 "$_P" 2>/dev/null; then
						return_error "test already running (pid $_P)"
					fi
				fi
				AB=$(printf "%s\n" "$input" | jsonfilter -e '@.apply_best' 2>/dev/null | tr -d ' 	\r\n')
				if [ "$AB" = "true" ]; then
					setsid /usr/sbin/panel-zaptest --apply-best >/dev/null 2>&1 < /dev/null &
				else
					setsid /usr/sbin/panel-zaptest >/dev/null 2>&1 < /dev/null &
				fi
				logger -t orbix "zaptest started apply_best=${AB:-false}"
				json_init
				json_add_string "status" "ok"
				json_add_boolean "started" 1
				json_add_string "message" "Strategy auto-test started; poll zapret_auto_status"
				json_dump
			;;

			zapret_auto_status)
				# crash recovery (ZM _test_recover): config backup exists but runner is dead
				RECOVERED=0
				if [ -s /etc/orbix/zaptest.config.bak ]; then
					_ALIVE=0
					if [ -f /tmp/orbix-zaptest.run ]; then
						_P=$(cat /tmp/orbix-zaptest.run 2>/dev/null)
						[ -n "$_P" ] && kill -0 "$_P" 2>/dev/null && _ALIVE=1
					fi
					if [ "$_ALIVE" = "0" ]; then
						cp -f /etc/orbix/zaptest.config.bak /etc/config/zapret
						/etc/init.d/zapret restart >/dev/null 2>&1
						rm -f /etc/orbix/zaptest.config.bak /tmp/orbix-zaptest.run
						RECOVERED=1
						logger -t orbix "zaptest recovery: config restored after interrupted test"
					fi
				fi
				RUNNING=0
				if [ -f /tmp/orbix-zaptest.run ]; then
					_P=$(cat /tmp/orbix-zaptest.run 2>/dev/null)
					[ -n "$_P" ] && kill -0 "$_P" 2>/dev/null && RUNNING=1
				fi
				CUR=""; IDX=0; TOT=0; BEST=""
				if [ -f /tmp/orbix-zaptest.state ]; then
					CUR=$(jsonfilter -i /tmp/orbix-zaptest.state -e '@.cur' 2>/dev/null)
					IDX=$(jsonfilter -i /tmp/orbix-zaptest.state -e '@.idx' 2>/dev/null)
					TOT=$(jsonfilter -i /tmp/orbix-zaptest.state -e '@.total' 2>/dev/null)
					BEST=$(jsonfilter -i /tmp/orbix-zaptest.state -e '@.best' 2>/dev/null)
				fi
				json_init
				json_add_string "status" "ok"
				json_add_boolean "running" "$RUNNING"
				json_add_boolean "recovered" "$RECOVERED"
				json_add_string "cur" "${CUR:-}"
				json_add_int "idx" "${IDX:-0}"
				json_add_int "total" "${TOT:-0}"
				json_add_string "best" "${BEST:-}"
				json_add_array "results"
				_SRT=/tmp/orbix-zaptest.sorted.$$
				if [ -f /tmp/orbix-zaptest.results ]; then
					awk -F'|' '$1=="S" { printf "%06d %s\n", $3 + 0, $0 }' /tmp/orbix-zaptest.results 2>/dev/null | sort -r | cut -d' ' -f2- > "$_SRT"
					while IFS='|' read -r _t _n _ok _tot _ts; do
						[ "${_t:-}" = "S" ] || continue
						json_add_object
						json_add_string "name" "$_n"
						json_add_int "ok" "$(_n_num "$_ok")"
						json_add_int "total" "$(_n_num "$_tot")"
						json_add_string "ts" "$_ts"
						json_close_object
					done < "$_SRT"
					rm -f "$_SRT"
				fi
				json_close_array
				json_add_string "log" "$(tail -n 60 /tmp/orbix-zaptest.log 2>/dev/null)"
				json_dump
			;;

			zaptest_stop)
				[ -f /tmp/orbix-zaptest.run ] || return_error "test is not running"
				touch /tmp/orbix-zaptest.stop
				json_init
				json_add_string "status" "ok"
				json_add_string "message" "stop requested — test will finish current round and restore config"
				json_dump
			;;

			watchdog_status)
				json_init
				json_add_string "status" "ok"
				json_add_boolean "installed" "$([ -x /usr/sbin/panel-services-watchdog ] && echo 1 || echo 0)"
				json_add_boolean "enabled" "$(grep -q '# orbix-watchdog' /etc/crontabs/root 2>/dev/null && echo 1 || echo 0)"
				json_add_string "spec" "$(grep '# orbix-watchdog' /etc/crontabs/root 2>/dev/null | head -n 1 | awk '{print $1, $2, $3, $4, $5}')"
				json_add_string "state" "$(cat /tmp/panel-watchdog.state.json 2>/dev/null | head -c 4000)"
				json_add_string "log" "$(tail -n 25 /tmp/panel-watchdog.log 2>/dev/null | head -c 3000)"
				json_dump
			;;

			watchdog_set)
				[ -x /usr/sbin/panel-services-watchdog ] || return_error "watchdog script not deployed on router"
				EN=$(printf "%s\n" "$input" | jsonfilter -e '@.enable' 2>/dev/null | tr -d ' 	\r\n')
				IV=$(printf "%s\n" "$input" | jsonfilter -e '@.interval_min' 2>/dev/null | tr -d ' 	\r\n')
				RN=$(printf "%s\n" "$input" | jsonfilter -e '@.run_now' 2>/dev/null | tr -d ' 	\r\n')
				[ -n "$IV" ] || IV=5
				case "$IV" in ''|*[!0-9]*) return_error "interval_min must be a number";; esac
				[ "$IV" -ge 1 ] && [ "$IV" -le 59 ] || return_error "interval_min must be between 1 and 59"
				if [ -n "$EN" ]; then
					case "$EN" in true|false) ;; *) return_error "enable must be true or false" ;; esac
					mkdir -p /etc/crontabs
					touch /etc/crontabs/root
					sed -i '/# orbix-watchdog$/d' /etc/crontabs/root
					if [ "$EN" = "true" ]; then
						if [ "$IV" = "1" ]; then SPEC="* * * * *"; else SPEC="*/$IV * * * *"; fi
						printf '%s /usr/sbin/panel-services-watchdog >/dev/null 2>&1 # orbix-watchdog\n' "$SPEC" >> /etc/crontabs/root
					fi
					/etc/init.d/cron restart >/dev/null 2>&1
					logger -t orbix "services watchdog $EN (*/$IV min)"
				fi
				if [ "$RN" = "true" ]; then
					setsid /usr/sbin/panel-services-watchdog once >/dev/null 2>&1 < /dev/null &
				fi
				json_init
				json_add_string "status" "ok"
				json_add_boolean "enabled" "$(grep -q '# orbix-watchdog' /etc/crontabs/root 2>/dev/null && echo 1 || echo 0)"
				json_add_string "spec" "$(grep '# orbix-watchdog' /etc/crontabs/root 2>/dev/null | head -n 1 | awk '{print $1, $2, $3, $4, $5}')"
				json_dump
			;;

			tiers_stage)
				P=$(printf "%s\n" "$input" | jsonfilter -e '@.part' 2>/dev/null | tr -cd 'a-z')
				SEQ=$(printf "%s\n" "$input" | jsonfilter -e '@.seq' 2>/dev/null)
				FINAL=$(printf "%s\n" "$input" | jsonfilter -e '@.final' 2>/dev/null)
				case "$P" in nft|routes|dnsmasq|config|singbox) ;; *) return_error "tiers_stage: неизвестная часть" ;; esac
				[ -z "$SEQ" ] && return_error "tiers_stage: нет seq"
				CHUNK=$(printf "%s\n" "$input" | jsonfilter -e '@.chunk' 2>/dev/null | tr -d ' \r\n\t')
				[ -z "$CHUNK" ] && return_error "tiers_stage: пустой chunk"
				[ "${#CHUNK}" -gt 24576 ] && return_error "tiers_stage: chunk длиннее 24KB"
				[ "$SEQ" = "0" ] && : > "/tmp/orbx-tier-$P.b64"
				printf '%s' "$CHUNK" >> "/tmp/orbx-tier-$P.b64"
				if [ "$FINAL" = "1" ] || [ "$FINAL" = "true" ]; then
					openssl base64 -d -A -in "/tmp/orbx-tier-$P.b64" > "/tmp/orbx-tier-$P.out" 2>/dev/null
					[ -s "/tmp/orbx-tier-$P.out" ] || return_error "tiers_stage: base64 не распечатался (часть $P)"
				fi
				json_init
				json_add_string "status" "ok"
				json_add_string "part" "$P"
				json_dump
			;;

			tiers_commit)
				ORBX_NFT=/usr/share/nftables.d/ruleset-post/48-panel-tiers.nft
				ORBX_DNS=/etc/orbix/dnsmasq-tiers.conf
				ORBX_RT=/usr/sbin/panel-tier-routes
				ORBX_CFG=/etc/orbix/tiers.json
				SB_CFG=/etc/sing-box/config.json
				for _pf in nft routes dnsmasq config; do
					[ -s "/tmp/orbx-tier-$_pf.out" ] || { return_error "tiers_commit: нет данных части $_pf (сначала tiers_stage)"; }
				done
				BK=/root/orbix-tiers-backup-$(date +%Y%m%d-%H%M%S)
				mkdir -p "$BK" /etc/orbix /usr/share/nftables.d/ruleset-post
				cp -f "$ORBX_CFG" "$BK/tiers.json" 2>/dev/null
				cp -f "$ORBX_NFT" "$BK/48-panel-tiers.nft" 2>/dev/null
				cp -f "$ORBX_DNS" "$BK/dnsmasq-tiers.conf" 2>/dev/null
				cp -f "$ORBX_RT" "$BK/panel-tier-routes" 2>/dev/null
				cp -f "$SB_CFG" "$BK/singbox-config.json" 2>/dev/null
				cp -f /etc/crontabs/root "$BK/crontabs-root" 2>/dev/null
				# --- validate staged artifacts BEFORE any write ---
				SIZE=$(wc -c < /tmp/orbx-tier-nft.out)
				[ "$SIZE" -ge 100 ] && [ "$SIZE" -le 65536 ] || { return_error "tiers_commit: размер nft вне лимита ($SIZE)"; }
				grep -q "table inet paneltiers" /tmp/orbx-tier-nft.out || { return_error "tiers_commit: в nft нет table inet paneltiers"; }
				nft -c -f /tmp/orbx-tier-nft.out 2>/tmp/orbx-nft.err || { R=$(head -c 300 /tmp/orbx-nft.err); return_error "tiers_commit: nft -c не прошёл: $R"; }
				[ -s /tmp/orbx-tier-config.out ] && jsonfilter -i /tmp/orbx-tier-config.out -e '@.version' >/dev/null 2>&1 || { rm -f /tmp/orbx-tier-config.out; }
				[ -s /tmp/orbx-tier-config.out ] || { return_error "tiers_commit: tiers.json не валидный JSON"; }
				[ "$(wc -c < /tmp/orbx-tier-routes.out)" -le 8192 ] || { return_error "tiers_commit: routes больше 8KB"; }
				grep -q 'ip route' /tmp/orbx-tier-routes.out || { return_error "tiers_commit: в routes нет ip route (пустой/битый файл)"; }
				sh -n /tmp/orbx-tier-routes.out || { return_error "tiers_commit: routes не проходит sh -n"; }
				SB_APPLIED=0
				# --- write artifacts ---
				cp -f /tmp/orbx-tier-nft.out "$ORBX_NFT"
				cp -f /tmp/orbx-tier-routes.out "$ORBX_RT"; chmod 755 "$ORBX_RT"
				cp -f /tmp/orbx-tier-dnsmasq.out "$ORBX_DNS"
				cp -f /tmp/orbx-tier-config.out "$ORBX_CFG"
				if [ -s /etc/sing-box/active_node.json ]; then
					generate_singbox_config >>/tmp/orbx-sb-gen.log 2>&1; [ $? -eq 0 ] && SB_APPLIED=1
				fi
				# --- cron self-heal for policy route ---
				grep -v 'panel-tier-routes' /etc/crontabs/root > /tmp/orbx-cr 2>/dev/null
				printf '%s\n' '*/5 * * * * /usr/sbin/panel-tier-routes # orbix-tiers' >> /tmp/orbx-cr
				mv /tmp/orbx-cr /etc/crontabs/root
				# --- dnsmasq hook: inline block in /etc/dnsmasq.conf ---
				# (dnsmasq runs under ujail and cannot read files outside its whitelist,
				#  so the nftset lines are inlined between markers, not conf-file'd)
				awk 'BEGIN{skip=0} /# BEGIN orbix-tiers/{skip=1; next} /# END orbix-tiers/{skip=0; next} skip{next} {print}' /etc/dnsmasq.conf > /tmp/orbx-dnsc
				mv /tmp/orbx-dnsc /etc/dnsmasq.conf
				{ echo "# BEGIN orbix-tiers"; grep -v "^#" /etc/orbix/dnsmasq-tiers.conf | grep -v "^$"; echo "# END orbix-tiers"; } >> /etc/dnsmasq.conf
				# --- L2 sync: zapret hostlist mode only manipulates listed hosts,
				# so every tier2 domain must also be in zapret iphost ---
				ZAP_ADDED=0
				for _zd in $(grep "#tier2$" /etc/orbix/dnsmasq-tiers.conf 2>/dev/null | sed "s|nftset=/||; s|/inet.*||"); do
					uci -q get zapret.config.iphost 2>/dev/null | grep -qx "$_zd" || { uci -q add_list zapret.config.iphost="$_zd" && ZAP_ADDED=1; }
				done
				if [ "$ZAP_ADDED" = "1" ]; then
					uci -q commit zapret
					setsid /etc/init.d/zapret restart >/dev/null 2>&1 < /dev/null &
				fi

				# --- apply ---
				/etc/init.d/dnsmasq restart >/dev/null 2>&1
				/etc/init.d/firewall reload >/dev/null 2>&1
				sleep 2
				"$ORBX_RT" >/dev/null 2>&1
				if [ "$SB_APPLIED" = "1" ]; then
					sleep 3
					(pidof sing-box || pgrep sing-box) >/dev/null 2>&1 || return_error "tiers_commit: sing-box не поднялся после перегенерации (бэкап $BK)"
				fi
				# uci commit dhcp + firewall reload wipe custom ip rules -> re-assert both
				/usr/sbin/panel-proxy-route >/dev/null 2>&1
				"$ORBX_RT" >/dev/null 2>&1
				# --- verify real kernel state ---
				VERIFY_NFT=0; VERIFY_RULE=0; VERIFY_DNS=0
				nft list table inet paneltiers >/dev/null 2>&1 && VERIFY_NFT=1
				_TABV=$(jsonfilter -i /etc/orbix/tiers.json -e '@.routeTable' 2>/dev/null | head -1)
				[ -n "${_TABV:-}" ] && ip rule show | grep -q "lookup $_TABV" && VERIFY_RULE=1
				grep -q 'BEGIN orbix-tiers' /etc/dnsmasq.conf 2>/dev/null && VERIFY_DNS=1
				rm -f /tmp/orbx-tier-*.b64 /tmp/orbx-tier-*.out /tmp/orbx-sb-new.json /tmp/orbx-nft.err /tmp/orbx-sb.err
				json_init
				json_add_string "status" "ok"
				json_add_boolean "nft_applied" "$VERIFY_NFT"
				json_add_boolean "route_applied" "$VERIFY_RULE"
				json_add_boolean "dns_hook_applied" "$VERIFY_DNS"
				json_add_boolean "singbox_applied" "$SB_APPLIED"
				json_add_string "backup" "$BK"
				json_add_string "message" "движок применён; бэкап $BK"
				json_dump
			;;

			tiers_disable)
				rm -f /usr/share/nftables.d/ruleset-post/48-panel-tiers.nft /etc/orbix/dnsmasq-tiers.conf /usr/sbin/panel-tier-routes
				sed -i '/panel-tier-routes/d' /etc/crontabs/root 2>/dev/null
				awk 'BEGIN{skip=0} /# BEGIN orbix-tiers/{skip=1; next} /# END orbix-tiers/{skip=0; next} skip{next} {print}' /etc/dnsmasq.conf > /tmp/orbx-dnsc && mv /tmp/orbx-dnsc /etc/dnsmasq.conf
				/etc/init.d/dnsmasq restart >/dev/null 2>&1
				/etc/init.d/firewall reload >/dev/null 2>&1
				sleep 1
				/usr/sbin/panel-proxy-route >/dev/null 2>&1
				json_init
				json_add_string "status" "ok"
				json_add_boolean "nft_removed" "$([ ! -f /usr/share/nftables.d/ruleset-post/48-panel-tiers.nft ] && echo 1 || echo 0)"
				json_add_string "message" "трёхуровневый движок снят; трафик по прежней схеме"
				json_dump
			;;

			tiers_status)
				json_init
				json_add_string "status" "ok"
				json_add_boolean "nft_installed" "$([ -f /usr/share/nftables.d/ruleset-post/48-panel-tiers.nft ] && echo 1 || echo 0)"
				json_add_boolean "nft_live" "$(nft list table inet paneltiers >/dev/null 2>&1 && echo 1 || echo 0)"
				json_add_boolean "routes_installed" "$([ -x /usr/sbin/panel-tier-routes ] && echo 1 || echo 0)"
				json_add_boolean "dns_hook" "$(grep -q 'BEGIN orbix-tiers' /etc/dnsmasq.conf 2>/dev/null && nft list set inet paneltiers tier2 >/dev/null 2>&1 && echo 1 || echo 0)"
				json_add_int "cron" "$(grep -c 'panel-tier-routes' /etc/crontabs/root 2>/dev/null)"
				json_add_string "config_version" "$(jsonfilter -i /etc/orbix/tiers.json -e '@.version' 2>/dev/null | head -1)"
				AN=/etc/sing-box/active_node.json
				json_add_string "active_name" "$(jsonfilter -i $AN -e '@.name' 2>/dev/null | head -1)"
				json_add_string "active_server" "$(jsonfilter -i $AN -e '@.server' 2>/dev/null | head -1)"
				json_add_string "active_port" "$(jsonfilter -i $AN -e '@.port' 2>/dev/null | head -1)"
				json_add_string "active_protocol" "$(jsonfilter -i $AN -e '@.protocol' 2>/dev/null | head -1)"
				json_add_string "active_latency_ms" "$(jsonfilter -i $AN -e '@.latency_ms' 2>/dev/null | head -1)"
				json_add_int "node_count" "$(jsonfilter -i /etc/orbix/subscriptions.json -e '@.nodes[*].server' 2>/dev/null | wc -l)"
				json_add_string "node_servers" "$(jsonfilter -i /etc/orbix/subscriptions.json -e '@.nodes[*].server' 2>/dev/null | tr '\n' ' ')"
				json_add_string "active_updated" "$(jsonfilter -i $AN -e '@.updated' 2>/dev/null | head -1)"
				json_add_int "singbox_running" "$( (pidof sing-box || pgrep sing-box) >/dev/null 2>&1 && echo 1 || echo 0)"
				json_add_int "nfqws_running" "$(pgrep -f nfqws >/dev/null 2>&1 && echo 1 || echo 0)"
				json_add_int "proxy_traffic" "$(nft list chain inet paneltiers marktier 2>/dev/null | grep -c 'meta mark set')"
				json_dump
			;;

			tiers_get)
				json_init
				json_add_string "status" "ok"
				if [ -s /etc/orbix/tiers.json ]; then
					json_add_string "config" "$(cat /etc/orbix/tiers.json)"
				else
					json_add_string "config" ""
				fi
				json_add_string "nft" "$(cat /usr/share/nftables.d/ruleset-post/48-panel-tiers.nft 2>/dev/null)"
				json_dump
			;;

			vless_status)
				RUNNING=0
				(pidof sing-box || pgrep sing-box) >/dev/null 2>&1 && RUNNING=1

				ACTIVE_CONF="/etc/sing-box/active_node.json"
				MAIN_CONF="/etc/sing-box/config.json"

				json_init
				json_add_boolean "running" "$RUNNING"
				json_add_array "nodes"

				# Read real active node if persisted
				if [ -f "$ACTIVE_CONF" ]; then
					N_ID=$(jsonfilter -i "$ACTIVE_CONF" -e '@.id' 2>/dev/null)
					N_NAME=$(jsonfilter -i "$ACTIVE_CONF" -e '@.name' 2>/dev/null)
					N_SERVER=$(jsonfilter -i "$ACTIVE_CONF" -e '@.server' -e '@.node.server' 2>/dev/null)
					N_PORT=$(jsonfilter -i "$ACTIVE_CONF" -e '@.port' -e '@.node.port' 2>/dev/null)
					N_UUID=$(jsonfilter -i "$ACTIVE_CONF" -e '@.uuid' -e '@.node.uuid' 2>/dev/null)
					N_SEC=$(jsonfilter -i "$ACTIVE_CONF" -e '@.security' 2>/dev/null)
					N_SNI=$(jsonfilter -i "$ACTIVE_CONF" -e '@.sni' -e '@.node.sni' 2>/dev/null)
					N_PBK=$(jsonfilter -i "$ACTIVE_CONF" -e '@.publicKey' -e '@.node.publicKey' 2>/dev/null)
					N_SID=$(jsonfilter -i "$ACTIVE_CONF" -e '@.shortId' -e '@.node.shortId' 2>/dev/null)
					N_TRANS=$(jsonfilter -i "$ACTIVE_CONF" -e '@.transport' 2>/dev/null)

					if [ -n "$N_SERVER" ]; then
						json_add_object
						json_add_string "id" "${N_ID:-active-node}"
						json_add_string "name" "${N_NAME:-Active VLESS Outbound}"
						json_add_string "server" "$N_SERVER"
						json_add_int "port" "${N_PORT:-443}"
						json_add_string "uuid" "$N_UUID"
						json_add_string "security" "${N_SEC:-reality}"
						json_add_string "sni" "$N_SNI"
						json_add_string "publicKey" "$N_PBK"
						json_add_string "shortId" "$N_SID"
						json_add_string "transport" "${N_TRANS:-tcp}"
						json_add_boolean "active" 1
						json_close_object
					fi
				fi

				# Read any outbounds from main sing-box config.json
				if [ -f "$MAIN_CONF" ]; then
					OUT_TYPES=$(jsonfilter -i "$MAIN_CONF" -e '@.outbounds[*].type' 2>/dev/null)
					IDX=0
					for otype in $OUT_TYPES; do
						if [ "$otype" != "direct" ] && [ "$otype" != "block" ] && [ "$otype" != "dns" ]; then
							TAG=$(jsonfilter -i "$MAIN_CONF" -e "@.outbounds[$IDX].tag" 2>/dev/null)
							SRV=$(jsonfilter -i "$MAIN_CONF" -e "@.outbounds[$IDX].server" 2>/dev/null)
							PORT=$(jsonfilter -i "$MAIN_CONF" -e "@.outbounds[$IDX].server_port" 2>/dev/null)

							if [ -n "$SRV" ]; then
								json_add_object
								json_add_string "id" "singbox-outbound-$IDX"
								json_add_string "name" "${TAG:-$otype-$SRV}"
								json_add_string "server" "$SRV"
								json_add_int "port" "${PORT:-443}"
								json_add_string "transport" "$otype"
								json_add_boolean "active" 0
								json_close_object
							fi
						fi
						IDX=$((IDX + 1))
					done
				fi

				json_close_array
				json_dump
			;;

			singbox_test_node)
				RAW_HOST=$(printf "%s\n" "$input" | jsonfilter -e '@.server' -e '@.node.server' 2>/dev/null | tr -d ' \t\r\n')
				RAW_PORT=$(printf "%s\n" "$input" | jsonfilter -e '@.port' -e '@.node.port' 2>/dev/null | tr -d ' \t\r\n')

				if [ -z "$RAW_HOST" ]; then
					return_error "Server address parameter is required"
				fi

				# Strict host sanitization: FQDN or IPv4
				HOST=$(printf "%s" "$RAW_HOST" | grep -E '^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$' || true)
				if [ -z "$HOST" ]; then
					HOST=$(printf "%s" "$RAW_HOST" | grep -E '^([0-9]{1,3}\.){3}[0-9]{1,3}$' || true)
				fi
				if [ -z "$HOST" ]; then
					return_error "Invalid server address format"
				fi

				PORT="$RAW_PORT"
				case "$PORT" in
					''|*[!0-9]*) PORT=443 ;;
					*) if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then PORT=443; fi ;;
				esac

				CURL_ERR=$(mktemp)
				TIME=$(curl -s -4 -o /dev/null -w "%{time_connect}" --connect-timeout 3 -m 4 "http://$HOST:$PORT" 2>"$CURL_ERR")
				CURL_EXIT=$?
				ERR_MSG=$(cat "$CURL_ERR" 2>/dev/null)
				rm -f "$CURL_ERR"

				if [ "$CURL_EXIT" -ne 0 ] || [ -z "$TIME" ] || [ "$TIME" = "0.000000" ]; then
					json_init
					json_add_string "status" "error"
					json_add_boolean "reachable" 0
					json_add_string "server" "$HOST"
					json_add_int "port" "$PORT"
					json_add_string "message" "${ERR_MSG:-Connection refused or timed out}"
					json_dump
					exit 0
				fi

				MS=$(awk "BEGIN {print int($TIME * 1000)}")

				json_init
				json_add_string "status" "ok"
				json_add_boolean "reachable" 1
				json_add_string "server" "$HOST"
				json_add_int "port" "$PORT"
				json_add_int "latency" "$MS"
				json_dump
			;;

			podkop_status)
				if [ ! -f "/etc/config/podkop" ] && [ ! -f "/etc/init.d/podkop" ]; then
					json_init
					json_add_string "status" "error"
					json_add_boolean "installed" 0
					json_add_boolean "running" 0
					json_add_string "message" "Podkop package is not installed (/etc/config/podkop not found)"
					json_dump
					exit 0
				fi

				RUNNING=0
				(pidof podkop || pgrep podkop) >/dev/null 2>&1 && RUNNING=1

				ENABLED=0
				VAL=$(uci -q get podkop.main.enabled)
				[ "$VAL" = "1" ] && ENABLED=1

				MODE=$(uci -q get podkop.main.mode || echo "mixed")
				OUT_IFACE=$(uci -q get podkop.main.outbound_interface || echo "singbox")

				json_init
				json_add_string "status" "ok"
				json_add_boolean "installed" 1
				json_add_boolean "running" "$RUNNING"
				json_add_boolean "enabled" "$ENABLED"
				json_add_string "mode" "$MODE"
				json_add_string "outbound_interface" "$OUT_IFACE"
				json_dump
			;;

			podkop_update)
				if [ ! -f "/etc/init.d/podkop" ]; then
					json_init
					json_add_string "status" "error"
					json_add_int "exit_code" 127
					json_add_string "message" "Podkop init script (/etc/init.d/podkop) not found"
					json_dump
					exit 0
				fi

				OUT=$(/etc/init.d/podkop reload 2>&1)
				EXIT_CODE=$?

				json_init
				if [ "$EXIT_CODE" -eq 0 ]; then
					json_add_string "status" "ok"
					json_add_int "exit_code" 0
					json_add_string "output" "$OUT"
				else
					json_add_string "status" "error"
					json_add_int "exit_code" "$EXIT_CODE"
					json_add_string "message" "Podkop reload failed: $OUT"
				fi
				json_dump
			;;

			pbr_status)
				PBR_ENABLED=0
				VAL=$(uci -q get pbr.config.enabled)
				[ "$VAL" = "1" ] && PBR_ENABLED=1

				json_init
				json_add_boolean "enabled" "$PBR_ENABLED"
				json_add_array "rules"

				for SEC in $(uci -q show pbr | grep '=policy' | cut -d'=' -f1); do
					NAME=$(uci -q get "${SEC}.name")
					EN=$(uci -q get "${SEC}.enabled")
					IFACE=$(uci -q get "${SEC}.interface")
					SRC=$(uci -q get "${SEC}.src_addr")
					DEST=$(uci -q get "${SEC}.dest_addr")
					PROTO=$(uci -q get "${SEC}.proto")

					SEC_ID=$(echo "$SEC" | sed 's/pbr\.//')

					json_add_object
					json_add_string "id" "$SEC_ID"
					json_add_string "name" "${NAME:-$SEC_ID}"
					json_add_boolean "enabled" "${EN:-0}"
					json_add_string "interface" "${IFACE:-default}"
					[ -n "$SRC" ] && json_add_string "src_addr" "$SRC"
					[ -n "$DEST" ] && json_add_string "dest_addr" "$DEST"
					[ -n "$PROTO" ] && json_add_string "proto" "$PROTO"
					json_close_object
				done

				json_close_array
				json_dump
			;;

			pbr_trace)
				RAW_TARGET=$(printf "%s\n" "$input" | jsonfilter -e '@.target' 2>/dev/null | tr -d ' \t\r\n')
				if [ -z "$RAW_TARGET" ]; then
					return_error "Target domain or IP parameter is required"
				fi

				# Strict validation: FQDN or IPv4
				TARGET=$(printf "%s" "$RAW_TARGET" | grep -E '^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$' || true)
				if [ -z "$TARGET" ]; then
					TARGET=$(printf "%s" "$RAW_TARGET" | grep -E '^([0-9]{1,3}\.){3}[0-9]{1,3}$' || true)
				fi
				if [ -z "$TARGET" ]; then
					return_error "Invalid target domain or IP address format"
				fi

				# Real DNS resolution via resolveip or nslookup
				IP=""
				case "$TARGET" in
					[0-9]*.[0-9]*.[0-9]*.[0-9]*) IP="$TARGET" ;;
				esac

				if [ -z "$IP" ] && command -v resolveip >/dev/null 2>&1; then
					IP=$(resolveip -4 -t 3 "$TARGET" 2>/dev/null | head -n1)
				fi
				if [ -z "$IP" ] && command -v nslookup >/dev/null 2>&1; then
					IP=$(nslookup "$TARGET" 2>/dev/null | awk '/^Address: / && !/:53/ {print $2; exit}')
				fi

				case "$IP" in
					*:53*|""|*NXDOMAIN*) IP="" ;;
				esac

				if [ -z "$IP" ]; then
					return_error "DNS resolution failed for target: $TARGET"
				fi

				# Real kernel routing table check
				ROUTE_OUT=$(ip route get "$IP" 2>/dev/null)
				OUT_DEV=$(echo "$ROUTE_OUT" | grep -o 'dev [^ ]*' | cut -d' ' -f2)
				NEXTHOP=$(echo "$ROUTE_OUT" | grep -o 'via [^ ]*' | cut -d' ' -f2)
				[ -z "$OUT_DEV" ] && OUT_DEV="wan"
				[ -z "$NEXTHOP" ] && NEXTHOP="direct"

				# Check against active PBR policies in UCI
				MATCHED_RULE=""
				MATCHED_IFACE=""
				for SEC in $(uci -q show pbr | grep '=policy' | cut -d'=' -f1); do
					EN=$(uci -q get "${SEC}.enabled")
					if [ "$EN" = "1" ]; then
						DESTS=$(uci -q get "${SEC}.dest_addr")
						for d in $DESTS; do
							if [ "$d" = "$TARGET" ] || [ "$d" = "$IP" ]; then
								MATCHED_RULE=$(uci -q get "${SEC}.name")
								MATCHED_IFACE=$(uci -q get "${SEC}.interface")
								break 2
							fi
						done
					fi
				done

				# Check against zapret nfqws DPI bypass
				if [ -z "$MATCHED_RULE" ] && pgrep nfqws >/dev/null 2>&1; then
					for hfile in /opt/zapret/ipset/*.txt; do
						if [ -f "$hfile" ] && grep -qs "^$TARGET" "$hfile" 2>/dev/null; then
							MATCHED_RULE="DPI Bypass -> Zapret (NFQWS packet desync)"
							MATCHED_IFACE="zapret"
							NEXTHOP="nfqws queue"
							break
						fi
					done
				fi

				json_init
				json_add_string "status" "ok"
				json_add_string "target" "$TARGET"
				json_add_string "ip" "$IP"
				json_add_string "rule" "${MATCHED_RULE:-Default System Routing}"
				json_add_string "interface" "${MATCHED_IFACE:-$OUT_DEV}"
				json_add_string "nexthop" "$NEXTHOP"
				json_dump
			;;

			pbr_rule_upsert)
			# Real CRUD for PBR domain policies: writes UCI pbr config, commits,
			# reloads the pbr service, and reports the actual reload exit code.
			R_ID=$(printf "%s\n" "$input" | jsonfilter -e '@.id' 2>/dev/null | tr -d ' \t\r\n')
			R_NAME=$(printf "%s\n" "$input" | jsonfilter -e '@.name' 2>/dev/null)
			R_ENABLED=$(printf "%s\n" "$input" | jsonfilter -e '@.enabled' 2>/dev/null)
			R_IFACE=$(printf "%s\n" "$input" | jsonfilter -e '@.interface' 2>/dev/null | tr -d ' \t\r\n')
			R_SRC=$(printf "%s\n" "$input" | jsonfilter -e '@.src_addr' 2>/dev/null | tr -d ' \t\r\n')
			R_DEST=$(printf "%s\n" "$input" | jsonfilter -e '@.dest_addr' 2>/dev/null | tr -d ' \t\r\n')
			R_PROTO=$(printf "%s\n" "$input" | jsonfilter -e '@.proto' 2>/dev/null | tr -d ' \t\r\n')

			# Sanitize section name: allow letters, digits, dash, underscore, dot
			SEC_NAME=""
			for tok in "$R_ID" "$R_NAME"; do
				[ -z "$tok" ] && continue
				cand=$(printf "%s" "$tok" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9._-')
				[ "$cand" = "$tok" ] || cand=$(printf "%s" "$cand" | tr ' ' '-' | tr -cd 'a-z0-9.-')
				if [ -n "$cand" ]; then SEC_NAME="$cand"; break; fi
			done
			# @policy[N] style ids are handled as positional references
			case "$R_ID" in
				@policy\[[0-9]*\]) SEC_REF="pbr.$R_ID" ;;
				*) SEC_REF="pbr.${SEC_NAME}" ;;
			esac

			if [ -z "$SEC_REF" ] || [ "$SEC_REF" = "pbr." ]; then
				return_error "Rule id or a name suitable for a UCI section is required"
			fi

			# Validate interface against known outbound targets
			case "$R_IFACE" in
				wan|wan6|zapret|singbox|sing-box|awg0|drop|tun*|wg*) : ;;
				"") return_error "Target interface is required" ;;
				*) if ! uci -q get "network.$R_IFACE" >/dev/null 2>&1; then
					return_error "Unknown target interface: $R_IFACE"
				fi ;;
			esac

			[ -z "$R_ENABLED" ] && R_ENABLED="1"
			case "$R_ENABLED" in
				true|1) EN_VAL="1" ;;
				*) EN_VAL="0" ;;
			esac

			# Verify the rule really lands in UCI before reporting success
			uci -q set "$SEC_REF=policy" || { return_error "uci rejected section name"; }
			[ -n "$R_NAME" ] && uci -q set "${SEC_REF}.name=${R_NAME}"
			uci -q set "${SEC_REF}.enabled=${EN_VAL}"
			uci -q set "${SEC_REF}.interface=${R_IFACE}"
			if [ -n "$R_SRC" ]; then uci -q set "${SEC_REF}.src_addr=${R_SRC}"; fi
			if [ -n "$R_DEST" ]; then uci -q set "${SEC_REF}.dest_addr=${R_DEST}"; fi
			if [ -n "$R_PROTO" ]; then uci -q set "${SEC_REF}.proto=${R_PROTO}"; fi

			if ! uci -q commit pbr; then
				uci -q revert pbr
				return_error "UCI commit failed for pbr config - rule NOT saved"
			fi

			# Confirm it reads back from committed config
			if ! uci -q show "$SEC_REF" >/dev/null 2>&1; then
				return_error "Rule committed but cannot be read back - state uncertain, check /etc/config/pbr"
			fi

			RELOAD_OUT=""
			RELOAD_CODE=0
			if [ -x /etc/init.d/pbr ]; then
				RELOAD_OUT=$(/etc/init.d/pbr reload 2>&1); RELOAD_CODE=$?
				[ "$RELOAD_CODE" -ne 0 ] && { RELOAD_OUT=$(/etc/init.d/pbr restart 2>&1); RELOAD_CODE=$?; }
			fi

			json_init
			json_add_string "status" "ok"
			json_add_string "section" "${SEC_REF#pbr.}"
			if [ "$RELOAD_CODE" -eq 0 ]; then APPLIED=1; else APPLIED=0; fi
			json_add_boolean "applied" "$APPLIED"
			[ -n "$RELOAD_OUT" ] && json_add_string "reload_output" "$RELOAD_OUT"
			json_add_int "reload_code" "$RELOAD_CODE"
			json_dump
		;;

		pbr_rule_delete)
			R_ID=$(printf "%s\n" "$input" | jsonfilter -e '@.id' 2>/dev/null | tr -d ' \t\r\n')
			if [ -z "$R_ID" ]; then
				return_error "Rule id is required"
			fi
			case "$R_ID" in
				@policy\[[0-9]*\]) SEC_REF="pbr.$R_ID" ;;
				*)
					SEC_NAME=$(printf "%s" "$R_ID" | tr 'A-Z' 'a-z' | tr -cd 'a-z0-9._-')
					SEC_REF="pbr.${SEC_NAME}"
					;;
			esac

			if ! uci -q show "$SEC_REF" >/dev/null 2>&1; then
				return_error "Rule '$R_ID' does not exist in /etc/config/pbr"
			fi
			if ! uci -q delete "$SEC_REF"; then
				return_error "uci delete failed for $SEC_REF"
			fi
			if ! uci -q commit pbr; then
				uci -q revert pbr
				return_error "UCI commit failed after delete - rule NOT removed"
			fi

			RELOAD_OUT=""
			RELOAD_CODE=0
			if [ -x /etc/init.d/pbr ]; then
				RELOAD_OUT=$(/etc/init.d/pbr reload 2>&1); RELOAD_CODE=$?
				[ "$RELOAD_CODE" -ne 0 ] && { RELOAD_OUT=$(/etc/init.d/pbr restart 2>&1); RELOAD_CODE=$?; }
			fi

			json_init
			json_add_string "status" "ok"
			if [ "$RELOAD_CODE" -eq 0 ]; then APPLIED=1; else APPLIED=0; fi
			json_add_boolean "applied" "$APPLIED"
			json_add_int "reload_code" "$RELOAD_CODE"
			[ -n "$RELOAD_OUT" ] && json_add_string "reload_output" "$RELOAD_OUT"
			json_dump
		;;

		arm_rollback)
				RAW_TIMEOUT=$(printf "%s\n" "$input" | jsonfilter -e '@.timeout' 2>/dev/null | tr -d ' \t\r\n')
				TIMEOUT=75
				case "$RAW_TIMEOUT" in
					''|*[!0-9]*) TIMEOUT=75 ;;
					*) TIMEOUT="$RAW_TIMEOUT" ;;
				esac
				if [ "$TIMEOUT" -le 10 ]; then TIMEOUT=75; fi

				# Clean up any existing armed watchdog process before starting a new one
				kill_active_watchdog

				mkdir -p /tmp/uci_rollback_backup/config /tmp/uci_rollback_backup/sing-box
				cp -rf /etc/config/* /tmp/uci_rollback_backup/config/ 2>/dev/null
				cp -rf /etc/sing-box/* /tmp/uci_rollback_backup/sing-box/ 2>/dev/null

				TOKEN=$(cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d '-' || date +%s%N)
				echo "$TOKEN" > /tmp/uci_rollback_token

				cat > /tmp/uci_watchdog.sh << 'EOF_WD'
#!/bin/sh
TOKEN="$1"
TIMEOUT="$2"

SLEEP_PID=""

cleanup() {
	trap - TERM INT HUP QUIT EXIT
	if [ -n "$SLEEP_PID" ]; then
		kill -9 "$SLEEP_PID" 2>/dev/null
	fi
	rm -f /tmp/uci_watchdog.pid /tmp/uci_watchdog.sleep_pid
	exit 0
}

trap cleanup TERM INT HUP QUIT

sleep "$TIMEOUT" &
SLEEP_PID=$!
echo "$SLEEP_PID" > /tmp/uci_watchdog.sleep_pid

wait "$SLEEP_PID" 2>/dev/null

if [ -f "/tmp/uci_rollback_token" ] && [ "$(cat /tmp/uci_rollback_token 2>/dev/null)" = "$TOKEN" ]; then
	logger -t uci-watchdog "Rollback timer expired without user confirmation! Restoring safe configs..."
	cp -rf /tmp/uci_rollback_backup/config/* /etc/config/ 2>/dev/null
	cp -rf /tmp/uci_rollback_backup/sing-box/* /etc/sing-box/ 2>/dev/null
	rm -rf /tmp/uci_rollback_backup /tmp/uci_rollback_token /tmp/uci_watchdog.pid /tmp/uci_watchdog.sleep_pid /tmp/uci_watchdog.sh
	/etc/init.d/network reload 2>/dev/null
	/etc/init.d/firewall reload 2>/dev/null
	/etc/init.d/pbr reload 2>/dev/null
		(/etc/init.d/sing-box restart && sleep 1 && /etc/init.d/pbr reload) >/dev/null 2>&1 &
	/etc/init.d/rpcd restart 2>/dev/null
	logger -t uci-watchdog "Rollback restoration complete."
fi

rm -f /tmp/uci_watchdog.pid /tmp/uci_watchdog.sleep_pid
EOF_WD
				chmod +x /tmp/uci_watchdog.sh
				sh /tmp/uci_watchdog.sh "$TOKEN" "$TIMEOUT" >/dev/null 2>&1 &
				WD_PID=$!
				echo "$WD_PID" > /tmp/uci_watchdog.pid

				json_init
				json_add_string "status" "armed"
				json_add_string "token" "$TOKEN"
				json_add_int "timeout" "$TIMEOUT"
				json_dump
			;;

			confirm_rollback)
				USER_TOKEN=$(printf "%s\n" "$input" | jsonfilter -e '@.token' 2>/dev/null | tr -d ' \r\n\t')

				if [ ! -f "/tmp/uci_rollback_token" ]; then
					return_error "No active rollback session armed"
				fi

				REAL_TOKEN=$(cat /tmp/uci_rollback_token 2>/dev/null | tr -d ' \r\n\t')
				if [ -z "$USER_TOKEN" ] || [ "$USER_TOKEN" != "$REAL_TOKEN" ]; then
					return_error "Invalid rollback token"
				fi

				# Deterministically kill watchdog process and all children (e.g. sleep)
				kill_active_watchdog

				rm -rf /tmp/uci_rollback_token /tmp/uci_rollback_backup
				rm -f /tmp/uci_watchdog.sh

				json_init
				json_add_string "status" "confirmed"
				json_add_string "message" "Rollback watchdog disarmed successfully"
				json_dump
			;;

			cancel_rollback)
				# Terminate watchdog immediately
				kill_active_watchdog

				if [ -d "/tmp/uci_rollback_backup" ]; then
					cp -rf /tmp/uci_rollback_backup/config/* /etc/config/ 2>/dev/null
					cp -rf /tmp/uci_rollback_backup/sing-box/* /etc/sing-box/ 2>/dev/null
					rm -rf /tmp/uci_rollback_backup /tmp/uci_rollback_token
					rm -f /tmp/uci_watchdog.sh
					/etc/init.d/network reload 2>/dev/null
					/etc/init.d/firewall reload 2>/dev/null
					/etc/init.d/pbr reload 2>/dev/null
		(/etc/init.d/sing-box restart && sleep 1 && /etc/init.d/pbr reload) >/dev/null 2>&1 &
				fi

				json_init
				json_add_string "status" "rolled_back"
				json_add_string "message" "Configuration reverted from backup"
				json_dump
			;;

			sub_decrypt_fetch)
				RAW_URL=$(printf "%s\n" "$input" | jsonfilter -e '@.url' 2>/dev/null | tr -d '\r\n\t ')
				RAW_KEY=$(printf "%s\n" "$input" | jsonfilter -e '@.api_key' 2>/dev/null | tr -d '\r\n\t ')

				if [ -z "$RAW_URL" ]; then
					return_error "Subscription URL parameter is required"
				fi

				# Validate URL scheme
				case "$RAW_URL" in
					http://*|https://*|happ://*) ;;
					*) return_error "Invalid URL scheme. Must be http://, https://, or happ://" ;;
				esac

				TARGET_URL="$RAW_URL"
				case "$RAW_URL" in
					happ://crypt*|happ://add/*)
						if [ -z "$RAW_KEY" ]; then
							return_error "Decryption API key is required for encrypted happ:// subscriptions"
						fi
						SAFE_ESC_URL=$(printf "%s" "$RAW_URL" | sed 's/"/\\"/g')
						DEC_RES=$(curl -sS --max-time 10 -X POST "https://happy-decoder.cc/api/v1/decrypt" \
							-H "Authorization: Bearer $RAW_KEY" \
							-H "Content-Type: application/json" \
							-d "{\"url\":\"$SAFE_ESC_URL\"}" 2>/dev/null)
						DEC_URL=$(echo "$DEC_RES" | jsonfilter -e '@.decryptedUrl' 2>/dev/null)
						[ -n "$DEC_URL" ] && TARGET_URL="$DEC_URL"
					;;
				esac

				# Direct fetch with Happ UA and 15s timeout
				SUB_RES=$(curl -sS -L -A "Happ/4.3.0" --max-time 15 "$TARGET_URL" 2>/dev/null)

				# Fallback to Happy Decoder if direct fetch returned empty and key was provided
				if [ -z "$SUB_RES" ] && [ -n "$RAW_KEY" ]; then
					SAFE_ESC_TARGET=$(printf "%s" "$TARGET_URL" | sed 's/"/\\"/g')
					SUB_RES=$(curl -sS --max-time 10 -X POST "https://happy-decoder.cc/api/fetch-sub" \
						-H "Authorization: Bearer $RAW_KEY" \
						-H "Content-Type: application/json" \
						-d "{\"url\":\"$SAFE_ESC_TARGET\",\"userAgent\":\"Happ/4.3.0\",\"hwid\":true}" 2>/dev/null)
				fi

				if [ -n "$SUB_RES" ]; then
					# Determine format: if it starts with '[', wrap in {"servers": ...} so rpcd accepts it
					FIRST_CHAR=$(printf "%s" "$SUB_RES" | sed 's/^[ \t\r\n]*//' | head -c 1)
					if [ "$FIRST_CHAR" = "[" ]; then
						printf '{"servers":%s}\n' "$SUB_RES"
					elif [ "$FIRST_CHAR" = "{" ]; then
						printf "%s\n" "$SUB_RES"
					else
						json_init
						json_add_string "raw" "$SUB_RES"
						json_dump
					fi
				else
					return_error "Failed to fetch subscription from remote provider"
				fi
			;;

			pbr_set_device_rule)
				RAW_IP=$(printf "%s\n" "$input" | jsonfilter -e '@.ip' 2>/dev/null | tr -d ' \t\r\n')
				RAW_MAC=$(printf "%s\n" "$input" | jsonfilter -e '@.mac' 2>/dev/null | tr -d ' \t\r\n')
				RAW_NAME=$(printf "%s\n" "$input" | jsonfilter -e '@.name' 2>/dev/null)
				RAW_IFACE=$(printf "%s\n" "$input" | jsonfilter -e '@.interface' 2>/dev/null | tr -d ' \t\r\n')
				DEV_ENABLED=$(printf "%s\n" "$input" | jsonfilter -e '@.enabled' 2>/dev/null | tr -d ' \t\r\n')

				# Validate IPv4 format
				DEV_IP=$(printf "%s" "$RAW_IP" | grep -E '^([0-9]{1,3}\.){3}[0-9]{1,3}$' || true)
				if [ -z "$DEV_IP" ]; then
					return_error "Invalid device IP address format"
				fi

				# Validate MAC if provided
				DEV_MAC=""
				if [ -n "$RAW_MAC" ]; then
					DEV_MAC=$(printf "%s" "$RAW_MAC" | grep -iE '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$' | tr 'A-F' 'a-f' || true)
					if [ -z "$DEV_MAC" ]; then
						return_error "Invalid device MAC address format"
					fi
				fi

				# Sanitize DEV_NAME (alphanumeric, spaces, dashes, underscores only)
				DEV_NAME=$(printf "%s" "$RAW_NAME" | sed 's/[^a-zA-Z0-9 _-]//g' | head -c 64)
				[ -z "$DEV_NAME" ] && DEV_NAME="Device-$DEV_IP"

				# Validate DEV_IFACE
				DEV_IFACE=""
				if [ -n "$RAW_IFACE" ] && [ "$RAW_IFACE" != "default" ]; then
					DEV_IFACE=$(printf "%s" "$RAW_IFACE" | grep -E '^[a-zA-Z0-9_.-]+$' || true)
					if [ -z "$DEV_IFACE" ]; then
						return_error "Invalid interface name format"
					fi
				fi

				SEC_NAME="client_$(echo "$DEV_IP" | tr '.' '_')"
				uci -q delete pbr."$SEC_NAME"
				if [ "$DEV_ENABLED" = "true" ] && [ -n "$DEV_IFACE" ] && [ "$DEV_IFACE" != "default" ]; then
					uci set pbr."$SEC_NAME"=policy
					uci set "pbr.$SEC_NAME.name=Device: ${DEV_NAME} (${DEV_IP})"
					uci set "pbr.$SEC_NAME.src_addr=$DEV_IP"
					uci set "pbr.$SEC_NAME.interface=$DEV_IFACE"
					uci set "pbr.$SEC_NAME.proto=all"
					uci set "pbr.$SEC_NAME.enabled=1"
				fi
				uci commit pbr
				RELOAD_OUT=$(/etc/init.d/pbr reload 2>&1)
				RELOAD_CODE=$?
				if [ "$RELOAD_CODE" -ne 0 ]; then
					logger -t orbix "pbr reload failed after device rule change: $RELOAD_OUT"
					return_error "Rule saved to UCI but PBR service reload failed: ${RELOAD_OUT:-exit $RELOAD_CODE}"
				fi

				if [ -n "$DEV_MAC" ]; then
					DHCP_SEC="host_$(echo "$DEV_MAC" | tr -d ':-')"
					uci -q delete dhcp."$DHCP_SEC"
					uci set dhcp."$DHCP_SEC"=host
					uci set dhcp."$DHCP_SEC".name="$DEV_NAME"
					uci set dhcp."$DHCP_SEC".mac="$DEV_MAC"
					uci set dhcp."$DHCP_SEC".ip="$DEV_IP"
					uci commit dhcp
					DNSMASQ_OUT=$(/etc/init.d/dnsmasq reload 2>&1)
					[ $? -ne 0 ] && logger -t orbix "dnsmasq reload failed after static lease: $DNSMASQ_OUT"
				fi

				json_init
				json_add_string "status" "ok"
				json_add_string "ip" "$DEV_IP"
				json_add_string "interface" "${DEV_IFACE:-default}"
				json_dump
			;;

			singbox_set_outbound)
				# Frontend sends the node as a JSON-encoded string under @.node; unwrap it
				NODE_JSON=$(printf "%s\n" "$input" | jsonfilter -e '@.node' 2>/dev/null)
				[ -z "$NODE_JSON" ] && NODE_JSON="$input"
				printf "%s\n" "$NODE_JSON" > /etc/sing-box/active_node.json 2>/dev/null

				RAW_SERVER=$(jsonfilter -i /etc/sing-box/active_node.json -e '@.server' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_PORT=$(jsonfilter -i /etc/sing-box/active_node.json -e '@.port' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_UUID=$(jsonfilter -i /etc/sing-box/active_node.json -e '@.uuid' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_FLOW=$(jsonfilter -i /etc/sing-box/active_node.json -e '@.flow' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_SNI=$(jsonfilter -i /etc/sing-box/active_node.json -e '@.sni' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_PUBKEY=$(jsonfilter -i /etc/sing-box/active_node.json -e '@.publicKey' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_SHORTID=$(jsonfilter -i /etc/sing-box/active_node.json -e '@.shortId' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_FP=$(jsonfilter -i /etc/sing-box/active_node.json -e '@.fingerprint' 2>/dev/null | head -n1 | tr -d ' \t\r\n')

				# Sanitize fields against configuration injection
				SERVER=$(printf "%s" "$RAW_SERVER" | grep -E '^([a-zA-Z0-9.-]+)$' || true)
				UUID=$(printf "%s" "$RAW_UUID" | grep -E '^[0-9a-fA-F-]{32,36}$' || true)
				SNI=$(printf "%s" "$RAW_SNI" | grep -E '^([a-zA-Z0-9.-]+)$' || true)
				PUBKEY=$(printf "%s" "$RAW_PUBKEY" | grep -E '^[a-zA-Z0-9_/-]{20,64}$' || true)
				SHORTID=$(printf "%s" "$RAW_SHORTID" | grep -E '^[a-zA-Z0-9]{2,16}$' || true)
				FP=$(printf "%s" "$RAW_FP" | grep -E '^[a-zA-Z0-9_.-]+$' || true)
				FLOW=$(printf "%s" "$RAW_FLOW" | grep -E '^[a-zA-Z0-9_.-]+$' || true)

				PORT="$RAW_PORT"
				case "$PORT" in
					''|*[!0-9]*) PORT=443 ;;
					*) if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then PORT=443; fi ;;
				esac

				[ -z "$FP" ] && FP="firefox"
				[ -z "$FLOW" ] && FLOW="xtls-rprx-vision"

				if [ -z "$SERVER" ] || [ -z "$UUID" ]; then
					rm -f /etc/sing-box/active_node.json
					return_error "Node payload is missing a valid server address or UUID - nothing was changed"
				fi

				generate_singbox_config
				GEN_CODE=$?
				case "$GEN_CODE" in
					0) ;;
					1) return_error "Generated sing-box config failed validation - previous config kept" ;;
					*) return_error "Config written but sing-box failed to restart - check the service" ;;
				esac

				json_init
				json_add_string "status" "ok"
				json_add_string "server" "$SERVER"
				json_add_int "port" "$PORT"
				json_dump
			;;

			wifi_reload)
				WIFI_OUT=$(/sbin/wifi reload 2>&1)
				WIFI_CODE=$?
				if [ "$WIFI_CODE" -ne 0 ]; then
					logger -t orbix "wifi reload failed: $WIFI_OUT"
					return_error "Wi-Fi reload failed: ${WIFI_OUT:-exit $WIFI_CODE}"
				fi
				json_init
				json_add_string "status" "ok"
				json_dump
			;;

			killswitch_set)
				KS_ENABLED=$(printf "%s\n" "$input" | jsonfilter -e '@.enabled' 2>/dev/null)
				KS_SCOPE=$(printf "%s\n" "$input" | jsonfilter -e '@.scope' 2>/dev/null)
				[ -z "$KS_SCOPE" ] && KS_SCOPE="vpn_devices"

				mkdir -p /etc/orbix /tmp/hosts /tmp/dnsmasq.d
				LAN_SUBNET=$(get_lan_subnet)
				WAN_IFACES=$(get_wan_interfaces)

				if [ "$KS_ENABLED" = "1" ] || [ "$KS_ENABLED" = "true" ]; then
					# Declarative ruleset: atomic apply, kernel errors surface to the UI
					NFT_TMP=$(mktemp)
					cat > "$NFT_TMP" <<EOF
table inet orbix_protection {
	chain forward {
		type filter hook forward priority -5; policy accept;
		ip daddr $LAN_SUBNET accept
		ip saddr $LAN_SUBNET ip daddr $LAN_SUBNET accept
		ct state established,related accept
		oifname { "singbox", "tun0", "awg0", "wg0" } accept
EOF
					PROTECTED_COUNT=0
					if [ "$KS_SCOPE" = "all" ]; then
						echo "		ip saddr $LAN_SUBNET oifname { $WAN_IFACES } counter drop" >> "$NFT_TMP"
					else
						for SEC in $(uci -q show pbr | grep '=policy' | cut -d'=' -f1); do
							EN=$(uci -q get "${SEC}.enabled")
							IFACE=$(uci -q get "${SEC}.interface")
							SRC=$(uci -q get "${SEC}.src_addr")
							if [ "$EN" = "1" ] && [ -n "$SRC" ]; then
								case "$IFACE" in
									singbox*|awg*|tun*|wg*)
										echo "		ip saddr $SRC oifname { $WAN_IFACES } counter drop" >> "$NFT_TMP"
										PROTECTED_COUNT=$((PROTECTED_COUNT + 1))
									;;
								esac
							fi
						done
					fi
					echo "	}" >> "$NFT_TMP"
					echo "}" >> "$NFT_TMP"

					NFT_ERR=$(nft -f "$NFT_TMP" 2>&1)
					NFT_CODE=$?
					rm -f "$NFT_TMP"
					if [ "$NFT_CODE" -ne 0 ]; then
						logger -t orbix "killswitch nft apply failed: $NFT_ERR"
						return_error "Kernel rejected kill-switch rules: $NFT_ERR"
					fi

					echo "{\"enabled\":true,\"scope\":\"$KS_SCOPE\",\"allow_lan\":true,\"lan_subnet\":\"$LAN_SUBNET\",\"protected_devices\":$PROTECTED_COUNT,\"updated_at\":$(date +%s)}" > /etc/orbix/killswitch.json
				else
					NFT_ERR=$(nft delete table inet orbix_protection 2>&1)
					NFT_CODE=$?
					if [ "$NFT_CODE" -ne 0 ] && ! echo "$NFT_ERR" | grep -qi "does not exist"; then
						logger -t orbix "killswitch nft teardown failed: $NFT_ERR"
						return_error "Failed to remove kill-switch rules: $NFT_ERR"
					fi
					echo "{\"enabled\":false,\"scope\":\"$KS_SCOPE\",\"allow_lan\":true,\"lan_subnet\":\"$LAN_SUBNET\",\"updated_at\":$(date +%s)}" > /etc/orbix/killswitch.json
				fi

				IS_EN=0
				[ "$KS_ENABLED" = "1" ] || [ "$KS_ENABLED" = "true" ] && IS_EN=1

				json_init
				json_add_string "status" "ok"
				json_add_boolean "enabled" "$IS_EN"
				json_add_string "scope" "$KS_SCOPE"
				json_add_string "lan_subnet" "$LAN_SUBNET"
				json_dump
			;;

			killswitch_status)
				IS_ENABLED=0
				SCOPE="vpn_devices"
				if [ -f /etc/orbix/killswitch.json ]; then
					STORED_EN=$(jsonfilter -i /etc/orbix/killswitch.json -e '@.enabled' 2>/dev/null)
					if [ "$STORED_EN" = "true" ] || [ "$STORED_EN" = "1" ]; then
						IS_ENABLED=1
					fi
					SCOPE=$(jsonfilter -i /etc/orbix/killswitch.json -e '@.scope' 2>/dev/null)
					[ -z "$SCOPE" ] && SCOPE="vpn_devices"
				fi

				IS_ACTIVE=0
				DROPPED=0
				NFT_OUT=$(nft list table inet orbix_protection 2>/dev/null)
				if [ -n "$NFT_OUT" ]; then
					IS_ACTIVE=1
					DROPPED=$(echo "$NFT_OUT" | grep "counter packets" | head -n 1 | awk '{for(i=1;i<=NF;i++) if($i=="packets") print $(i+1)}')
					[ -z "$DROPPED" ] && DROPPED=0
				fi

				json_init
				json_add_boolean "enabled" "$IS_ENABLED"
				json_add_string "scope" "$SCOPE"
				json_add_boolean "active" "$IS_ACTIVE"
				json_add_int "dropped_packets" "$DROPPED"
				json_add_boolean "blocked_wan" "$IS_ACTIVE"
				json_dump
			;;

			sub_save_cache)
				mkdir -p /etc/orbix
				printf "%s\n" "$input" | jsonfilter -e '@.data' 2>/dev/null > /etc/orbix/subscriptions.json
				json_init
				json_add_string "status" "ok"
				json_dump
			;;

			sub_get_cache)
				if [ -f /etc/orbix/subscriptions.json ] && [ -s /etc/orbix/subscriptions.json ]; then
					cat /etc/orbix/subscriptions.json
				else
					json_init
					json_add_object "data"
					json_close_object
					json_dump
				fi
			;;

			policy_apply)
				mkdir -p /etc/orbix
				[ -n "$input" ] && [ "$input" != "{}" ] && printf "%s\n" "$input" > /etc/orbix/policies.json

				# Clean up any legacy sinkhole or hosts files
				rm -f /tmp/hosts/orbix_policy_blocks /tmp/dnsmasq.d/orbix_policy_blocks.conf
				killall -SIGHUP dnsmasq 2>/dev/null || true
				nft delete table inet orbix_policies 2>/dev/null || true

				# Synchronize Sing-box with active policies and discord proxy
				generate_singbox_config
				GEN_CODE=$?
				case "$GEN_CODE" in
					0) ;;
					1) return_error "Policies saved but generated sing-box config failed validation - routing NOT changed" ;;
					*) return_error "Policies saved but sing-box failed to restart - routing may be stale" ;;
				esac

				BLOCKED_COUNT=$( [ -f /etc/orbix/policies.json ] && jsonfilter -i /etc/orbix/policies.json -e '@.blocked_domains[*]' 2>/dev/null | wc -l )

				json_init
				json_add_string "status" "ok"
				json_add_int "blocked_count" "${BLOCKED_COUNT:-0}"
				json_dump
			;;

			policy_status)
				if [ -f /etc/orbix/policies.json ]; then
					cat /etc/orbix/policies.json
				else
					json_init
					json_add_boolean "active" 0
					json_add_array "blocked_domains"
					json_close_array
					json_add_array "direct_domains"
					json_close_array
					json_add_array "proxy_domains"
					json_close_array
					json_add_int "rules_count" 0
					json_dump
				fi
			;;
			kid_status)
				kid_ensure
				kid_status_json
			;;

			kid_set_master)
				kid_ensure
				_KON=$(printf "%s\n" "$input" | jsonfilter -e '@.on' 2>/dev/null)
				_KON=$(kid_norm_on "$_KON")
				[ "$_KON" = "bad" ] && return_error "kid: bad on"
				uci -q set "panel-kid.main.master=$_KON"
				uci -q commit panel-kid
				/usr/sbin/panel-kid-apply
				kid_status_json
			;;

			kid_set_device)
				kid_ensure
				_KMAC=$(printf "%s\n" "$input" | jsonfilter -e '@.mac' 2>/dev/null | tr -d ' \r\n' | tr 'A-F' 'a-f')
				case "$_KMAC" in ??:??:??:??:??:??) ;; *) return_error "kid: bad mac" ;; esac
				_KON=$(printf "%s\n" "$input" | jsonfilter -e '@.on' 2>/dev/null)
				_KON=$(kid_norm_on "$_KON")
				[ "$_KON" = "bad" ] && return_error "kid: bad on"
				_KNAME=$(printf "%s\n" "$input" | jsonfilter -e '@.name' 2>/dev/null | tr -d '"'"'"'`$();|&<>\\' | cut -c1-40)
				_KSEC=""
				for _ks in $(uci -q show panel-kid 2>/dev/null | sed -n 's/^panel-kid\.\([A-Za-z0-9_-]*\)=kiddev$/\1/p'); do
					[ "$(uci -q get "panel-kid.$_ks.mac" 2>/dev/null)" = "$_KMAC" ] && _KSEC=$_ks
				done
				if [ -z "$_KSEC" ]; then
					_KSEC="kid_$(printf "%s" "$_KMAC" | tr -d ':')"
					uci -q set "panel-kid.$_KSEC=kiddev"
					uci -q set "panel-kid.$_KSEC.mac=$_KMAC"
				fi
				# 'on' means internet-for-device; paused is the inverse
				_KPAUSED=1; [ "$_KON" = "1" ] && _KPAUSED=0
				uci -q set "panel-kid.$_KSEC.paused=$_KPAUSED"
				[ -n "$_KNAME" ] && uci -q set "panel-kid.$_KSEC.name=$_KNAME"
				uci -q commit panel-kid
				/usr/sbin/panel-kid-apply
				kid_status_json
			;;

			kid_set_block)
				kid_ensure
				_KCAT=$(printf "%s\n" "$input" | jsonfilter -e '@.category' 2>/dev/null | tr -d ' \r\n')
				case "$_KCAT" in youtube|games|social|adult) ;; *) return_error "kid: unknown category" ;; esac
				_KON=$(printf "%s\n" "$input" | jsonfilter -e '@.on' 2>/dev/null)
				_KON=$(kid_norm_on "$_KON")
				[ "$_KON" = "bad" ] && return_error "kid: bad on"
				if [ "$_KON" = "1" ]; then
					uci -q add_list "panel-kid.main.blocks=$_KCAT" 2>/dev/null || true
				else
					uci -q del_list "panel-kid.main.blocks=$_KCAT" 2>/dev/null || true
				fi
				uci -q commit panel-kid
				/usr/sbin/panel-kid-apply
				kid_status_json
			;;

			kid_set_bedtime)
				kid_ensure
				_KON=$(printf "%s\n" "$input" | jsonfilter -e '@.on' 2>/dev/null)
				_KON=$(kid_norm_on "$_KON")
				[ "$_KON" = "bad" ] && return_error "kid: bad on"
				_KS=$(printf "%s\n" "$input" | jsonfilter -e '@.start' 2>/dev/null | tr -d ' \r\n')
				_KE=$(printf "%s\n" "$input" | jsonfilter -e '@.end' 2>/dev/null | tr -d ' \r\n')
				for _kv in "$_KS" "$_KE"; do
					case "$_kv" in
					[0-2][0-9]:[0-5][0-9])
						case "${_kv%%:*}" in 0[0-9]|1[0-9]|2[0-3]) ;; *) return_error "kid: bad time" ;; esac ;;
					*) return_error "kid: bad time (HH:MM expected)" ;;
					esac
				done
				uci -q set "panel-kid.main.auto_bedtime=$_KON"
				uci -q set "panel-kid.main.bedtime_start=$_KS"
				uci -q set "panel-kid.main.bedtime_end=$_KE"
				uci -q commit panel-kid
				/usr/sbin/panel-kid-apply
				kid_status_json
			;;

			sub_set_source)
				SRC_URL=$(printf "%s\n" "$input" | jsonfilter -e '@.url' 2>/dev/null | tr -d ' \r\n\t')
				SRC_KEY=$(printf "%s\n" "$input" | jsonfilter -e '@.api_key' 2>/dev/null | tr -d '\r\n\t')
				case "$SRC_URL" in
					http://*|https://*|happ://*) ;;
					*) return_error "Нужна корректная ссылка подписки (http/https/happ)" ;;
				esac
				mkdir -p /etc/orbix
				printf "%s" "$SRC_URL" > /etc/orbix/sub.url
				chmod 600 /etc/orbix/sub.url
				if [ -n "$SRC_KEY" ]; then
					printf "%s" "$SRC_KEY" > /etc/orbix/sub.key
					chmod 600 /etc/orbix/sub.key
				fi
				json_init
				json_add_string "status" "ok"
				json_add_string "message" "ссылка подписки сохранена на роутере"
				json_dump
			;;

			sub_refresh)
				PARSED=0
				LINKS=""
				R_URL=$(printf "%s\n" "$input" | jsonfilter -e '@.url' 2>/dev/null | tr -d ' \r\n\t')
				R_KEY=$(printf "%s\n" "$input" | jsonfilter -e '@.api_key' 2>/dev/null | tr -d '\r\n\t')
				[ -z "$R_URL" ] && [ -f /etc/orbix/sub.url ] && R_URL=$(cat /etc/orbix/sub.url)
				[ -z "$R_KEY" ] && [ -f /etc/orbix/sub.key ] && R_KEY=$(cat /etc/orbix/sub.key)
				if [ -z "$R_URL" ]; then
					return_error "Ссылка подписки на роутере не сохранена — введите её в разделе «Подписки» и синхронизируйте один раз"
				fi
				TARGET_URL="$R_URL"
				case "$R_URL" in
					happ://crypt*|happ://add/*)
						if [ -z "$R_KEY" ]; then
							return_error "Зашифрованная happ-ссылка: нужен API-ключ (раздел «Подписки»)"
						fi
						SAFE_ESC_URL=$(printf "%s" "$R_URL" | sed 's/"/\\"/g')
						DEC_RES=$(curl -sS --max-time 10 -X POST "https://happy-decoder.cc/api/v1/decrypt" -H "Authorization: Bearer ***" -H "Content-Type: application/json" -d "{\"url\":\"$SAFE_ESC_URL\"}" 2>/dev/null)
						DEC_URL=$(echo "$DEC_RES" | jsonfilter -e '@.decryptedUrl' 2>/dev/null)
						[ -n "$DEC_URL" ] && TARGET_URL="$DEC_URL"
					;;
				esac
				BODY=$(curl -sS -L --compressed -A "Happ/4.3.0" -4 --max-time 25 "$TARGET_URL" 2>/dev/null)
				if [ -z "$BODY" ]; then
					return_error "Ссылку загрузить не удалось (провайдер недоступен) — старый список сохранён"
				fi
				printf "%s" "$BODY" > /tmp/sub-body.raw
				SNIFF=$(printf "%s" "$BODY" | tr -d ' \t\r\n' | cut -c1)
				case "$SNIFF" in
					"["|"{")
						# sing-box/Xray JSON subscription (client-config array)
ucode -e '
							let fs = require("fs");
							let arr = json(fs.readfile("/tmp/sub-body.raw"));
							if (!arr) exit;
							if (type(arr) != "array") arr = [arr];
							let nodes = []; let skipped = 0; let seen = {};
							for (let x in arr) {
								let cands = [];
								if (x.outbounds) { for (let o in x.outbounds) push(cands, o); }
								if (x.protocol || x.type) push(cands, x);
								for (let ob in cands) {
									let proto = ob.protocol || ob.type || "";
									if (proto != "vless" && proto != "trojan" && proto != "shadowsocks" && proto != "ss" && proto != "hysteria2") continue;
									let server = ""; let port = 0; let uuid = ""; let flow = "";
									if (ob.settings && ob.settings.vnext && length(ob.settings.vnext) > 0) {
										let v = ob.settings.vnext[0];
										server = v.address || "";
										port = int(v.port || 0);
										if (v.users && length(v.users) > 0) { uuid = v.users[0].id || ""; flow = v.users[0].flow || ""; }
									} else {
										server = ob.server || "";
										port = int(ob.server_port || ob.port || 0);
										uuid = ob.uuid || "";
										flow = ob.flow || "";
									}
									if (server == "" || port <= 0) { skipped++; continue; }
						if ((proto == "vless" || proto == "vmess") && uuid == "") { skipped++; continue; }
									let key = server + ":" + (port + "");
									if (seen[key]) continue;
									seen[key] = 1;
									let ss = ob.streamSettings || {};
									let sec = ss.security || "none";
									let rl = ss.realitySettings || null;
									let tlsx = ss.tlsSettings || null;
									if (ob.tls && ob.tls.reality) { rl = ob.tls.reality; sec = "reality"; }
									if (rl) sec = "reality";
									let pbk = ""; let sid = ""; let sni = ""; let fp = "firefox";
									if (rl) { pbk = rl.publicKey || rl.public_key || ""; sid = rl.shortId || rl.short_id || ""; sni = rl.serverName || rl.server_name || ""; fp = rl.fingerprint || fp; }
									if (sni == "" && tlsx) sni = tlsx.serverName || tlsx.server_name || "";
									if (tlsx && tlsx.fingerprint) fp = tlsx.fingerprint;
									if (ob.tls && ob.tls.utls && ob.tls.utls.fingerprint) fp = ob.tls.utls.fingerprint;
									let name = x.remarks || ob.tag || ("node-" + (length(nodes) + 1));
									let transport = ss.network || ob.network || "tcp";
									let pw = ob.password || "";
						let meth = ob.method || "";
						let ob_tls = ob.tls || {};
						if (proto != "vless" && proto != "ss" && proto != "shadowsocks") {
							if (ob_tls.server_name) sni = ob_tls.server_name;
						}
						if (proto == "trojan" || proto == "hysteria2") { if (pw == "") { skipped++; continue; } }
						if (proto == "ss" || proto == "shadowsocks") { if (pw == "" || meth == "") { skipped++; continue; } }
						push(nodes, { id: "sub-" + (length(nodes) + ""), name: name, server: server, port: port, uuid: uuid, flow: flow, security: sec, sni: sni, fingerprint: fp, publicKey: pbk, shortId: sid, transport: transport, path: ss.path || ob.path || "", protocol: proto, password: pw, method: meth });
								}
							}
							fs.writefile("/tmp/sub-refresh-parsed.json", sprintf("%J", { nodes: nodes, skipped: skipped, bad: 0 }));
' 2>/dev/null
						NEW_CNT=$(jsonfilter -i /tmp/sub-refresh-parsed.json -e '@.nodes[*].name' 2>/dev/null | wc -l)
						if [ "${NEW_CNT:-0}" -lt 1 ]; then
							rm -f /tmp/sub-body.raw /tmp/sub-refresh-parsed.json
							return_error "В sing-box JSON-подписке нет поддерживаемых узлов — старый список сохранён"
						fi
						rm -f /tmp/sub-body.raw
						SKIPPED=${SKIPPED:-0}
						PARSED=1
						;;
					*vless://*|*trojan://*|*ss://*|*hy2://*|*hysteria2://*|*vmess://*) LINKS="$BODY" ;;
					*)
						DEC=$(printf "%s" "$BODY" | openssl base64 -d -A 2>/dev/null)
						case "$DEC" in
							*vless://*|*trojan://*|*ss://*|*hy2://*|*hysteria2://*|*vmess://*) LINKS="$DEC" ;;
							*)
								DEC2=$(printf "%s" "$BODY" | openssl enc -d -base64 -A 2>/dev/null)
								case "$DEC2" in
									*vless://*|*trojan://*|*ss://*|*hy2://*|*hysteria2://*|*vmess://*) LINKS="$DEC2" ;;
									*) return_error "В ответе нет известных ссылок (vless/trojan/ss/hysteria2) — старый список сохранён" ;;
								esac
							;;
						esac
					;;
				esac
				if [ "${PARSED:-0}" != "1" ]; then
					# normalize ss:// links (SIP002 b64 userinfo and legacy all-b64)
					# to plaintext ss://method:pass@host:port#name — ucode has no b64d
					LINKS=$(printf '%s\n' "$LINKS" | while IFS= read -r _l; do
						case "$_l" in
						ss://*)
							_rest=${_l#ss://}
							case "$_rest" in
							*@*)
								_head=${_rest%%@*}
								_tail=${_rest#*@}
								_info=$(printf '%s' "$_head" | openssl base64 -d -A 2>/dev/null)
								case "$_info" in
								*:*) printf 'ss://%s@%s\n' "$_info" "$_tail" ;;
								*) printf '%s\n' "$_l" ;;
								esac ;;
							*)
								_info=$(printf '%s' "$_rest" | openssl base64 -d -A 2>/dev/null)
								case "$_info" in
								*@*) printf 'ss://%s\n' "$_info" ;;
								*) printf '%s\n' "$_l" ;;
								esac ;;
							esac ;;
						*) printf '%s\n' "$_l" ;;
						esac
					done )
				printf "%s\n" "$LINKS" | ucode -e '
					let fs = require("fs");
					let body = fs.readfile("/dev/stdin") || "";
					let nodes = []; let skipped = 0; let bad = 0; let seen = {};
					for (let raw in split(body, "\n")) {
						let line = trim(raw);
						if (line == "") continue;
						let proto = "";
						for (let pl in ["vless://", "trojan://", "hysteria2://", "ss://"]) {
							if (like(line, pl + "*")) { proto = substr(pl, 0, length(pl) - 3); break; }
						}
						if (proto == "") { skipped++; continue; }
						let rest = substr(line, index(line, "://") + 3);
						let name = "node"; let main = rest;
						let h = index(rest, "#");
						if (h >= 0) { name = substr(rest, h + 1); main = substr(rest, 0, h); }
						let at = index(main, "@");
						if (at < 0) { bad++; continue; }
						let uuid = substr(main, 0, at); let hostport = substr(main, at + 1);
						let q = index(hostport, "?"); let hp = hostport; let qs = "";
						if (q >= 0) { hp = substr(hostport, 0, q); qs = substr(hostport, q + 1); }
						let c = index(hp, ":");
						if (c < 0) { bad++; continue; }
						let server = substr(hp, 0, c); let port = int(substr(hp, c + 1));
						if (port <= 0) { bad++; continue; }
						let p = {};
						for (let kv in split(qs, "&")) {
							let eq = index(kv, "=");
							if (eq > 0) p[substr(kv, 0, eq)] = urldecode(substr(kv, eq + 1));
						}
						let key = server + ":" + port;
						if (seen[key]) continue; seen[key] = 1;
						let rec = { id: "sub-" + ((length(nodes) + "")), name: name, server: server, port: port, protocol: proto,
							sni: p["sni"] || p["peer"] || p["host"] || "", security: "none" };
						if (proto == "vless") {
							if (uuid == "") { bad++; continue; }
							rec.uuid = uuid; rec.flow = p["flow"] || "";
							rec.security = p["security"] || "none";
							if (p["pbk"]) rec.security = "reality";
							rec.fingerprint = p["fp"] || "firefox"; rec.publicKey = p["pbk"] || ""; rec.shortId = p["sid"] || "";
							rec.transport = p["type"] || "tcp"; rec.path = p["path"] || "";
						} else if (proto == "trojan" || proto == "hysteria2") {
							if (uuid == "") { bad++; continue; }
							rec.password = uuid; rec.security = "tls";
							rec.fingerprint = p["fp"] || "";
						} else if (proto == "ss") {
							let ci = index(uuid, ":");
							if (ci < 0) { bad++; continue; }
							rec.method = substr(uuid, 0, ci); rec.password = substr(uuid, ci + 1);
							if (rec.method == "" || rec.password == "") { bad++; continue; }
						}
						push(nodes, rec);
					}
					fs.writefile("/tmp/sub-refresh-parsed.json", sprintf("%J", { nodes: nodes, skipped: skipped, bad: bad }));
				' 2>/dev/null
				NEW_CNT=$(jsonfilter -i /tmp/sub-refresh-parsed.json -e '@.nodes[*].name' 2>/dev/null | wc -l)
				fi
				if [ "${NEW_CNT:-0}" -lt 1 ]; then
					return_error "Ссылки не распарсились (0 узлов: vless/trojan/ss/hysteria2) — старый список сохранён"
				fi
				SKIPPED=$(jsonfilter -i /tmp/sub-refresh-parsed.json -e '@.skipped' 2>/dev/null | head -1)
				mkdir -p /etc/orbix
				[ -f /etc/orbix/subscriptions.json ] && cp /etc/orbix/subscriptions.json /root/subscriptions.pre-refresh.json
				OLD_SEL=$(jsonfilter -i /etc/orbix/subscriptions.json -e '@.metadata.selectionMode' 2>/dev/null | head -1)
				ucode -e '
					let fs = require("fs");
					let parsed = json(fs.readfile("/tmp/sub-refresh-parsed.json"));
					let old = json(fs.readfile("/etc/orbix/subscriptions.json") || "{}") || {};
					let out = { nodes: parsed.nodes, metadata: { lastUpdated: time(), selectionMode: old.metadata ? (old.metadata.selectionMode || "manual") : "manual" }, timestamp: time() };
					fs.writefile("/etc/orbix/subscriptions.json.new", sprintf("%J", out));
				' 2>/dev/null
				if [ ! -s /etc/orbix/subscriptions.json.new ]; then
					return_error "Запись кэша не удалась — старый список сохранён"
				fi
				mv /etc/orbix/subscriptions.json.new /etc/orbix/subscriptions.json
				chmod 600 /etc/orbix/subscriptions.json
				rm -f /tmp/sub-refresh-parsed.json
				setsid sh -c 'rm -f /tmp/panel-node-balancer.scan; /usr/sbin/panel-node-balancer force' >/dev/null 2>&1 < /dev/null &
				json_init
				json_add_string "status" "ok"
				json_add_int "nodes" "$NEW_CNT"
				json_add_int "skipped_other" "${SKIPPED:-0}"
				json_add_string "message" "список заменён: ${NEW_CNT} узлов; запущен скан за живыми"
				json_dump
			;;

			node_balancer_run)
				setsid sh -c 'rm -f /tmp/panel-node-balancer.scan; /usr/sbin/panel-node-balancer force' >/dev/null 2>&1 < /dev/null &
				json_init
				json_add_string "status" "ok"
				json_add_string "message" "проверка запущена; полный скан до 14 узлов займёт 1-2 минуты"
				json_dump
			;;

			node_balancer_status)
				ST=/tmp/panel-node-balancer.state.json
				json_init
				json_add_string "status" "ok"
				if [ -f "$ST" ]; then
					B_TS=$(jsonfilter -i "$ST" -e '@.ts' 2>/dev/null | head -1)
					B_SRV=$(jsonfilter -i "$ST" -e '@.active_server' 2>/dev/null | head -1)
					B_PORT=$(jsonfilter -i "$ST" -e '@.active_port' 2>/dev/null | head -1)
					B_SC=$(jsonfilter -i "$ST" -e '@.score' 2>/dev/null | head -1)
					B_SCAN=$(jsonfilter -i "$ST" -e '@.scanned' 2>/dev/null | head -1)
					B_BEST=$(jsonfilter -i "$ST" -e '@.best' 2>/dev/null | head -1)
					B_SW=$(jsonfilter -i "$ST" -e '@.switched' 2>/dev/null | head -1)
					B_MSG=$(jsonfilter -i "$ST" -e '@.message' 2>/dev/null | head -1)
					json_add_int "updated" "${B_TS:-0}"
					json_add_string "active_server" "${B_SRV:-}"
					json_add_string "active_port" "${B_PORT:-}"
					json_add_int "score" "${B_SC:-0}"
					json_add_int "scanned" "${B_SCAN:-0}"
					json_add_int "best" "${B_BEST:-0}"
					json_add_boolean "switched" "${B_SW:-0}"
					json_add_string "message" "${B_MSG:-}"
				else
					json_add_string "message" "балансировщик ещё не выполнялся (cron каждые 15 мин)"
					json_add_int "updated" 0
					json_add_int "score" 0
					json_add_int "best" 0
					json_add_int "scanned" 0
				fi
				SUBF=/etc/orbix/subscriptions.json
				if [ -f "$SUBF" ]; then
					B_TOTAL=$(jsonfilter -i "$SUBF" -e '@.nodes[*].name' 2>/dev/null | wc -l)
					json_add_int "sub_nodes" "${B_TOTAL:-0}"
				else
					json_add_int "sub_nodes" 0
				fi
				json_add_array "log"
				if [ -f /tmp/panel-node-balancer.log ]; then
					tail -n 12 /tmp/panel-node-balancer.log 2>/dev/null > /tmp/.nb-logtail
					while IFS= read -r LB; do
						json_add_string "" "$LB"
					done < /tmp/.nb-logtail
					rm -f /tmp/.nb-logtail
				fi
				json_close_array
				json_dump
			;;

			run_cmd)
				# Whitelisted diagnostic runner: file.exec does not exist in stock rpcd,
				# so panel views (Diagnostics, Software, Backup, DnsRouting) call this.
				CMD=$(printf "%s\n" "$input" | jsonfilter -e '@.command' 2>/dev/null | tr -d ' \t\r\n')
				ALLOWED="ping ping6 traceroute traceroute6 nslookup nslookup6 logread dmesg apk nft sysupgrade firstboot date uptime wg awg netstat ip"
				OK=0
				for A in $ALLOWED; do
					[ "$CMD" = "$A" ] && OK=1
				done
				if [ "$OK" -ne 1 ]; then
					return_error "Command '$CMD' is not on the diagnostics whitelist"
				fi

				ARGS=""
				BAD=0
				for P in $(printf "%s\n" "$input" | jsonfilter -e '@.params[*]' 2>/dev/null); do
					case "$P" in
						''|*[!A-Za-z0-9._/:=,+-]*) BAD=1 ;;
					esac
					[ "$BAD" -eq 1 ] && break
					ARGS="$ARGS $P"
				done
				if [ "$BAD" -eq 1 ]; then
					return_error "Parameters contain unsupported characters"
				fi

				ERR_FILE=$(mktemp)
				OUT=$($CMD $ARGS 2>"$ERR_FILE")
				CODE=$?
				ERR=$(cat "$ERR_FILE" 2>/dev/null)
				rm -f "$ERR_FILE"

				json_init
				json_add_string "status" "ok"
				json_add_int "code" "$CODE"
				json_add_string "stdout" "$OUT"
				json_add_string "stderr" "$ERR"
				json_dump
			;;
		esac
	;;
esac
