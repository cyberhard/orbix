#!/bin/sh
# rpcd-circumvention - Production OpenWrt rpcd backend for censorship circumvention, VPNs, and PBR.
# Strictly POSIX sh / BusyBox ash compliant. Uses jshn.sh for valid JSON serialization.

. /usr/share/libubox/jshn.sh

# Helper: return JSON error and exit 0 for rpcd
return_error() {
	json_init
	json_add_string "status" "error"
	json_add_string "message" "$1"
	json_dump
	exit 0
}

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

		json_add_object "zapret_test_strategy"
		json_add_string "domain" "str"
		json_add_string "strategy" "str"
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

		json_dump
		exit 0
	;;

	call)
		case "$2" in
			awg_status)
				AWG_CONF="/etc/wireguard/awg0.conf"
				UCI_EXISTS=$(uci -q get network.awg0)

				WG_BIN=""
				if which awg >/dev/null 2>&1; then
					WG_BIN="awg"
				elif which wg >/dev/null 2>&1; then
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
					[ -n "$P_HOST" ] && PEER_EP="$P_HOST:$P_PORT"
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
				if which awg >/dev/null 2>&1; then
					WG_BIN="awg"
				elif which wg >/dev/null 2>&1; then
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
				read input
				CONF=$(echo "$input" | jsonfilter -e '@.conf' 2>/dev/null)
				APPLY=$(echo "$input" | jsonfilter -e '@.apply' 2>/dev/null)
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

				PEER_HOST=$(echo "$ENDPOINT" | cut -d':' -f1)
				PEER_PORT=$(echo "$ENDPOINT" | cut -d':' -f2)
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
				pgrep nfqws >/dev/null 2>&1 && RUNNING=1

				ENABLED=0
				VAL=$(uci -q get zapret.main.NFQWS_ENABLE || uci -q get zapret.main.run_on_boot)
				[ "$VAL" = "1" ] && ENABLED=1

				FWTYPE=$(uci -q get zapret.main.FWTYPE || echo "nftables")
				MODE_FILTER=$(uci -q get zapret.main.MODE_FILTER || echo "hostlist")
				PORTS_TCP=$(uci -q get zapret.main.NFQWS_PORTS_TCP || echo "80,443")
				PORTS_UDP=$(uci -q get zapret.main.NFQWS_PORTS_UDP || echo "")
				NFQWS_OPT=$(uci -q get zapret.main.NFQWS_OPT)

				json_init
				json_add_boolean "running" "$RUNNING"
				json_add_boolean "enabled" "$ENABLED"
				json_add_string "fwtype" "$FWTYPE"
				json_add_string "mode_filter" "$MODE_FILTER"
				json_add_string "ports_tcp" "$PORTS_TCP"
				json_add_string "ports_udp" "$PORTS_UDP"

				# Profiles array parsed from configuration
				json_add_array "profiles"

				# Profile 1: TCP HTTPS
				json_add_object
				json_add_string "id" "zapret-tcp"
				json_add_string "name" "TCP HTTPS (NFQWS DPI Bypass)"
				json_add_boolean "enabled" "$ENABLED"
				json_add_string "mode" "nfqws"
				json_add_string "protocol" "tcp"
				json_add_string "ports" "$PORTS_TCP"

				# Methods
				json_add_array "methods"
				if echo "$NFQWS_OPT" | grep -q "hostfakesplit"; then
					json_add_string "" "hostfakesplit"
				elif echo "$NFQWS_OPT" | grep -q "multisplit"; then
					json_add_string "" "multisplit"
				else
					json_add_string "" "fake"
					json_add_string "" "disorder"
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
					json_add_string "" "fake"
					json_close_array
					json_add_array "hostlist"
					json_close_array
					json_add_array "exclude_list"
					json_close_array
					json_close_object
				fi

				json_close_array
				json_dump
			;;

			zapret_test_strategy)
				read input
				RAW_TARGET=$(echo "$input" | jsonfilter -e '@.domain' 2>/dev/null | tr -d ' \t\r\n')
				STRATEGY=$(echo "$input" | jsonfilter -e '@.strategy' 2>/dev/null | tr -d ' \t\r\n')
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

			vless_status)
				RUNNING=0
				pgrep sing-box >/dev/null 2>&1 && RUNNING=1

				ACTIVE_CONF="/etc/sing-box/active_node.json"
				MAIN_CONF="/etc/sing-box/config.json"

				json_init
				json_add_boolean "running" "$RUNNING"
				json_add_array "nodes"

				# Read real active node if persisted
				if [ -f "$ACTIVE_CONF" ]; then
					N_ID=$(jsonfilter -i "$ACTIVE_CONF" -e '@.id' 2>/dev/null)
					N_NAME=$(jsonfilter -i "$ACTIVE_CONF" -e '@.name' 2>/dev/null)
					N_SERVER=$(jsonfilter -i "$ACTIVE_CONF" -e '@.server' 2>/dev/null)
					N_PORT=$(jsonfilter -i "$ACTIVE_CONF" -e '@.port' 2>/dev/null)
					N_UUID=$(jsonfilter -i "$ACTIVE_CONF" -e '@.uuid' 2>/dev/null)
					N_SEC=$(jsonfilter -i "$ACTIVE_CONF" -e '@.security' 2>/dev/null)
					N_SNI=$(jsonfilter -i "$ACTIVE_CONF" -e '@.sni' 2>/dev/null)
					N_PBK=$(jsonfilter -i "$ACTIVE_CONF" -e '@.publicKey' 2>/dev/null)
					N_SID=$(jsonfilter -i "$ACTIVE_CONF" -e '@.shortId' 2>/dev/null)
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
				read input
				RAW_HOST=$(echo "$input" | jsonfilter -e '@.server' 2>/dev/null | tr -d ' \t\r\n')
				RAW_PORT=$(echo "$input" | jsonfilter -e '@.port' 2>/dev/null | tr -d ' \t\r\n')

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
				pgrep podkop >/dev/null 2>&1 && RUNNING=1

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
				read input
				RAW_TARGET=$(echo "$input" | jsonfilter -e '@.target' 2>/dev/null | tr -d ' \t\r\n')
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

				if [ -z "$IP" ] && which resolveip >/dev/null 2>&1; then
					IP=$(resolveip -4 -t 3 "$TARGET" 2>/dev/null | head -n1)
				fi
				if [ -z "$IP" ] && which nslookup >/dev/null 2>&1; then
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

			arm_rollback)
				read input
				RAW_TIMEOUT=$(echo "$input" | jsonfilter -e '@.timeout' 2>/dev/null | tr -d ' \t\r\n')
				TIMEOUT=75
				case "$RAW_TIMEOUT" in
					''|*[!0-9]*) TIMEOUT=75 ;;
					*) TIMEOUT="$RAW_TIMEOUT" ;;
				esac
				if [ "$TIMEOUT" -le 10 ]; then TIMEOUT=75; fi

				# Clean up any existing armed watchdog process before starting a new one
				if [ -f "/tmp/uci_watchdog.pid" ]; then
					OLD_PID=$(cat /tmp/uci_watchdog.pid 2>/dev/null | tr -d ' \r\n')
					if [ -n "$OLD_PID" ] && [ "$OLD_PID" -gt 1 ] 2>/dev/null; then
						OLD_CHILDREN=$(pgrep -P "$OLD_PID" 2>/dev/null)
						[ -n "$OLD_CHILDREN" ] && kill -9 $OLD_CHILDREN 2>/dev/null
						kill -9 "$OLD_PID" 2>/dev/null
					fi
					rm -f /tmp/uci_watchdog.pid
				fi

				mkdir -p /tmp/uci_rollback_backup/config /tmp/uci_rollback_backup/sing-box
				cp -rf /etc/config/* /tmp/uci_rollback_backup/config/ 2>/dev/null
				cp -rf /etc/sing-box/* /tmp/uci_rollback_backup/sing-box/ 2>/dev/null

				TOKEN=$(cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d '-' || date +%s%N)
				echo "$TOKEN" > /tmp/uci_rollback_token

				cat > /tmp/uci_watchdog.sh << 'EOF_WD'
#!/bin/sh
TOKEN="$1"
TIMEOUT="$2"
sleep "$TIMEOUT"
if [ -f "/tmp/uci_rollback_token" ] && [ "$(cat /tmp/uci_rollback_token 2>/dev/null)" = "$TOKEN" ]; then
	logger -t uci-watchdog "Rollback timer expired without user confirmation! Restoring safe configs..."
	cp -rf /tmp/uci_rollback_backup/config/* /etc/config/ 2>/dev/null
	cp -rf /tmp/uci_rollback_backup/sing-box/* /etc/sing-box/ 2>/dev/null
	rm -rf /tmp/uci_rollback_backup /tmp/uci_rollback_token /tmp/uci_watchdog.pid
	/etc/init.d/network reload 2>/dev/null
	/etc/init.d/firewall reload 2>/dev/null
	/etc/init.d/pbr reload 2>/dev/null
	/etc/init.d/sing-box restart 2>/dev/null
	/etc/init.d/rpcd restart 2>/dev/null
	logger -t uci-watchdog "Rollback restoration complete."
fi
rm -f /tmp/uci_watchdog.pid
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
				read input
				USER_TOKEN=$(echo "$input" | jsonfilter -e '@.token' 2>/dev/null | tr -d ' \r\n\t')

				if [ ! -f "/tmp/uci_rollback_token" ]; then
					return_error "No active rollback session armed"
				fi

				REAL_TOKEN=$(cat /tmp/uci_rollback_token 2>/dev/null | tr -d ' \r\n\t')
				if [ -z "$USER_TOKEN" ] || [ "$USER_TOKEN" != "$REAL_TOKEN" ]; then
					return_error "Invalid rollback token"
				fi

				# Deterministically kill watchdog process and all children (e.g. sleep)
				if [ -f "/tmp/uci_watchdog.pid" ]; then
					WD_PID=$(cat /tmp/uci_watchdog.pid 2>/dev/null | tr -d ' \r\n')
					if [ -n "$WD_PID" ] && [ "$WD_PID" -gt 1 ] 2>/dev/null; then
						WD_CHILDREN=$(pgrep -P "$WD_PID" 2>/dev/null)
						[ -n "$WD_CHILDREN" ] && kill -9 $WD_CHILDREN 2>/dev/null
						kill -9 "$WD_PID" 2>/dev/null
					fi
					rm -f /tmp/uci_watchdog.pid
				fi

				rm -rf /tmp/uci_rollback_token /tmp/uci_rollback_backup
				rm -f /tmp/uci_watchdog.sh

				json_init
				json_add_string "status" "confirmed"
				json_add_string "message" "Rollback watchdog disarmed successfully"
				json_dump
			;;

			cancel_rollback)
				# Terminate watchdog immediately
				if [ -f "/tmp/uci_watchdog.pid" ]; then
					WD_PID=$(cat /tmp/uci_watchdog.pid 2>/dev/null | tr -d ' \r\n')
					if [ -n "$WD_PID" ] && [ "$WD_PID" -gt 1 ] 2>/dev/null; then
						WD_CHILDREN=$(pgrep -P "$WD_PID" 2>/dev/null)
						[ -n "$WD_CHILDREN" ] && kill -9 $WD_CHILDREN 2>/dev/null
						kill -9 "$WD_PID" 2>/dev/null
					fi
					rm -f /tmp/uci_watchdog.pid
				fi

				if [ -d "/tmp/uci_rollback_backup" ]; then
					cp -rf /tmp/uci_rollback_backup/config/* /etc/config/ 2>/dev/null
					cp -rf /tmp/uci_rollback_backup/sing-box/* /etc/sing-box/ 2>/dev/null
					rm -rf /tmp/uci_rollback_backup /tmp/uci_rollback_token
					rm -f /tmp/uci_watchdog.sh
					/etc/init.d/network reload 2>/dev/null
					/etc/init.d/firewall reload 2>/dev/null
					/etc/init.d/pbr reload 2>/dev/null
					/etc/init.d/sing-box restart 2>/dev/null
				fi

				json_init
				json_add_string "status" "rolled_back"
				json_add_string "message" "Configuration reverted from backup"
				json_dump
			;;

			sub_decrypt_fetch)
				read input
				RAW_URL=$(echo "$input" | jsonfilter -e '@.url' 2>/dev/null | tr -d '\r\n\t ')
				RAW_KEY=$(echo "$input" | jsonfilter -e '@.api_key' 2>/dev/null | tr -d '\r\n\t ')

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
				read input
				RAW_IP=$(echo "$input" | jsonfilter -e '@.ip' 2>/dev/null | tr -d ' \t\r\n')
				RAW_MAC=$(echo "$input" | jsonfilter -e '@.mac' 2>/dev/null | tr -d ' \t\r\n')
				RAW_NAME=$(echo "$input" | jsonfilter -e '@.name' 2>/dev/null)
				RAW_IFACE=$(echo "$input" | jsonfilter -e '@.interface' 2>/dev/null | tr -d ' \t\r\n')
				DEV_ENABLED=$(echo "$input" | jsonfilter -e '@.enabled' 2>/dev/null | tr -d ' \t\r\n')

				# Validate IPv4 format
				DEV_IP=$(printf "%s" "$RAW_IP" | grep -E '^([0-9]{1,3}\.){3}[0-9]{1,3}$' || true)
				if [ -z "$DEV_IP" ]; then
					return_error "Invalid device IP address format"
				fi

				# Validate MAC if provided
				DEV_MAC=""
				if [ -n "$RAW_MAC" ]; then
					DEV_MAC=$(printf "%s" "$RAW_MAC" | grep -iE '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$' || true)
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
					uci set pbr."$SEC_NAME".name="Device: ${DEV_NAME} ($DEV_IP)"
					uci set pbr."$SEC_NAME".src_addr="$DEV_IP"
					uci set pbr."$SEC_NAME".interface="$DEV_IFACE"
					uci set pbr."$SEC_NAME".proto="all"
					uci set pbr."$SEC_NAME".enabled="1"
				fi
				uci commit pbr
				/etc/init.d/pbr reload >/dev/null 2>&1 &

				if [ -n "$DEV_MAC" ]; then
					DHCP_SEC="host_$(echo "$DEV_MAC" | tr -d ':-')"
					uci -q delete dhcp."$DHCP_SEC"
					uci set dhcp."$DHCP_SEC"=host
					uci set dhcp."$DHCP_SEC".name="$DEV_NAME"
					uci set dhcp."$DHCP_SEC".mac="$DEV_MAC"
					uci set dhcp."$DHCP_SEC".ip="$DEV_IP"
					uci commit dhcp
					/etc/init.d/dnsmasq reload >/dev/null 2>&1 &
				fi

				json_init
				json_add_string "status" "ok"
				json_add_string "ip" "$DEV_IP"
				json_add_string "interface" "${DEV_IFACE:-default}"
				json_dump
			;;

			singbox_set_outbound)
				read input
				# Save active node configuration in /etc/sing-box/active_node.json
				printf "%s\n" "$input" > /etc/sing-box/active_node.json 2>/dev/null

				RAW_SERVER=$(echo "$input" | jsonfilter -e '@.server' -e '@.node.server' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_PORT=$(echo "$input" | jsonfilter -e '@.port' -e '@.node.port' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_UUID=$(echo "$input" | jsonfilter -e '@.uuid' -e '@.node.uuid' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_FLOW=$(echo "$input" | jsonfilter -e '@.flow' -e '@.node.flow' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_SNI=$(echo "$input" | jsonfilter -e '@.sni' -e '@.node.sni' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_PUBKEY=$(echo "$input" | jsonfilter -e '@.publicKey' -e '@.node.publicKey' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_SHORTID=$(echo "$input" | jsonfilter -e '@.shortId' -e '@.node.shortId' 2>/dev/null | head -n1 | tr -d ' \t\r\n')
				RAW_FP=$(echo "$input" | jsonfilter -e '@.fingerprint' -e '@.node.fingerprint' 2>/dev/null | head -n1 | tr -d ' \t\r\n')

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

				if [ -n "$SERVER" ] && [ -n "$UUID" ]; then
					cat <<EOF > /etc/sing-box/config.json
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
      "stack": "mixed"
    },
    {
      "type": "mixed",
      "tag": "mixed-in",
      "listen": "127.0.0.1",
      "listen_port": 10808
    }
  ],
  "outbounds": [
    {
      "type": "vless",
      "tag": "proxy",
      "server": "$SERVER",
      "server_port": $PORT,
      "uuid": "$UUID",
      "flow": "$FLOW",
      "tls": {
        "enabled": true,
        "server_name": "${SNI:-$SERVER}",
        "utls": { "enabled": true, "fingerprint": "$FP" },
        "reality": {
          "enabled": $( [ -n "$PUBKEY" ] && echo "true" || echo "false" ),
          "public_key": "$PUBKEY",
          "short_id": "$SHORTID"
        }
      }
    },
    {
      "type": "direct",
      "tag": "direct"
    }
  ],
  "route": {
    "auto_detect_interface": true,
    "rules": [
      {
        "inbound": ["tun-in", "mixed-in"],
        "action": "route",
        "outbound": "proxy"
      }
    ],
    "final": "proxy"
  }
}
EOF
				fi

				/etc/init.d/sing-box restart >/dev/null 2>&1 &

				json_init
				json_add_string "status" "ok"
				json_dump
			;;

			wifi_reload)
				/sbin/wifi reload >/dev/null 2>&1 &
				json_init
				json_add_string "status" "ok"
				json_dump
			;;

			killswitch_set)
				read -r input
				KS_ENABLED=$(echo "$input" | jsonfilter -e '@.enabled' 2>/dev/null)
				KS_SCOPE=$(echo "$input" | jsonfilter -e '@.scope' 2>/dev/null)
				[ -z "$KS_SCOPE" ] && KS_SCOPE="vpn_devices"

				mkdir -p /etc/orbix /tmp/hosts /tmp/dnsmasq.d

				if [ "$KS_ENABLED" = "1" ] || [ "$KS_ENABLED" = "true" ]; then
					echo "{\"enabled\":true,\"scope\":\"$KS_SCOPE\",\"allow_lan\":true,\"updated_at\":$(date +%s)}" > /etc/orbix/killswitch.json
					nft add table inet orbix_protection 2>/dev/null
					nft 'add chain inet orbix_protection forward { type filter hook forward priority -5; policy accept; }' 2>/dev/null
					nft flush chain inet orbix_protection forward 2>/dev/null
					nft add rule inet orbix_protection forward ip daddr 192.168.1.0/24 accept 2>/dev/null
					nft add rule inet orbix_protection forward ip saddr 192.168.1.0/24 ip daddr 192.168.1.0/24 accept 2>/dev/null
					nft add rule inet orbix_protection forward ct state established,related accept 2>/dev/null
					nft 'add rule inet orbix_protection forward oifname { "tun0", "awg0" } accept' 2>/dev/null

					if [ "$KS_SCOPE" = "all" ]; then
						nft 'add rule inet orbix_protection forward ip saddr 192.168.1.0/24 oifname { "wan", "eth0" } counter drop' 2>/dev/null
						nft add table inet orbix_isolation 2>/dev/null
						nft 'add chain inet orbix_isolation dstnat { type nat hook prerouting priority dstnat - 10; policy accept; }' 2>/dev/null
						nft flush chain inet orbix_isolation dstnat 2>/dev/null
						nft add rule inet orbix_isolation dstnat iifname "br-lan" ip daddr != 192.168.1.1 tcp dport { 80, 8080 } redirect to :80 2>/dev/null

						cat << 'HOSTSEOF' > /tmp/hosts/orbix_isolated
192.168.1.1 vk.com www.vk.com m.vk.com
192.168.1.1 yandex.ru ya.ru www.yandex.ru
192.168.1.1 google.com www.google.com
192.168.1.1 youtube.com www.youtube.com
192.168.1.1 t.me web.telegram.org
192.168.1.1 instagram.com www.instagram.com
192.168.1.1 connectivitycheck.gstatic.com
192.168.1.1 detectportal.firefox.com
192.168.1.1 captive.apple.com
HOSTSEOF
						echo "address=/#/192.168.1.1" > /tmp/dnsmasq.d/orbix_isolation.conf
						chmod 644 /tmp/hosts/orbix_isolated /tmp/dnsmasq.d/orbix_isolation.conf 2>/dev/null
						killall -SIGHUP dnsmasq 2>/dev/null
					else
						nft delete table inet orbix_isolation 2>/dev/null
						rm -f /tmp/hosts/orbix_isolated /tmp/dnsmasq.d/orbix_isolation.conf
						killall -SIGHUP dnsmasq 2>/dev/null
					fi
				else
					echo "{\"enabled\":false,\"scope\":\"$KS_SCOPE\",\"allow_lan\":true,\"updated_at\":$(date +%s)}" > /etc/orbix/killswitch.json
					nft delete table inet orbix_protection 2>/dev/null
					nft delete table inet orbix_isolation 2>/dev/null
					rm -f /tmp/hosts/orbix_isolated /tmp/dnsmasq.d/orbix_isolation.conf
					killall -SIGHUP dnsmasq 2>/dev/null
				fi

				IS_EN=0
				[ "$KS_ENABLED" = "1" ] || [ "$KS_ENABLED" = "true" ] && IS_EN=1

				json_init
				json_add_string "status" "ok"
				json_add_boolean "enabled" "$IS_EN"
				json_add_string "scope" "$KS_SCOPE"
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
				read -r input
				mkdir -p /etc/orbix
				echo "$input" | jsonfilter -e '@.data' 2>/dev/null > /etc/orbix/subscriptions.json
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
		esac
	;;
esac
