#!/bin/sh
# panel-node-balancer — контроль живости и автопереключение sing-box нод Happ-подписки.
# 15 мин: лёгкий троттл-тест активного узла через socks (пинг обманывается, трафик — нет).
# 12 ч (или при деградации): полный скан узлов подписки, выбор лучшего по пропускной,
# переключение с проверкой. Источник узлов: /etc/orbix/subscriptions.json.
CONF=/etc/sing-box/config.json
SUB=/etc/orbix/subscriptions.json
STATE=/tmp/panel-node-balancer.state.json
LOGF=/tmp/panel-node-balancer.log
STAMP=/tmp/panel-node-balancer.scan
LOCKD=/tmp/panel-node-balancer.lock
SOCKS=127.0.0.1:10808
TESTSOCK=127.0.0.1:10812
TESTD=/tmp/nb-run
MIN_BW=60000
FULLSCAN=43200
MAXSCAN=14
SPEEDURL="https://speed.cloudflare.com/__down?bytes="

log() {
	logger -t node-balancer "$1"
	echo "[$(date '+%F %T')] $1" >>"$LOGF"
}

# atomic lock with 25-min stale takeover
if ! mkdir "$LOCKD" 2>/dev/null; then
	OLD=$(stat -c %Y "$LOCKD" 2>/dev/null || echo 0)
	NOWX=$(date +%s)
	if [ $((NOWX - OLD)) -lt 600 ]; then exit 0; fi
	rm -rf "$LOCKD"; mkdir "$LOCKD" 2>/dev/null || exit 0
fi
trap 'rm -rf "$LOCKD"' EXIT

# cron self-install + починка задачи srs-списков (скачивалась через мёртвый прокси)
ensure_cron() {
	crontab -l 2>/dev/null | sed 's/^# panel-node:.*$//; /panel-node-balancer/d' | grep -v '^$' > /tmp/nb-cron || return 0
	if grep -q 'antizapret.srs' /tmp/nb-cron; then
		sed -i 's|-x socks5h://127.0.0.1:10808 -L -o /etc/sing-box/antizapret.srs.tmp|-4 -m 300 -L -o /etc/sing-box/antizapret.srs.tmp|' /tmp/nb-cron
	fi
	printf "%s\n# panel-node:begin\n*/15 * * * * /usr/sbin/panel-node-balancer >/dev/null 2>&1\n0 */12 * * * ubus call circumvention sub_refresh '{}' >/dev/null 2>&1 # orbix-sub-refresh\n# panel-node:end\n" "$(cat /tmp/nb-cron)" | crontab - 2>/dev/null || \
		printf "%s\n# panel-node:begin\n*/15 * * * * /usr/sbin/panel-node-balancer >/dev/null 2>&1\n0 */12 * * * ubus call circumvention sub_refresh '{}' >/dev/null 2>&1 # orbix-sub-refresh\n# panel-node:end\n" "$(cat /tmp/nb-cron)" > /var/spool/cron/crontabs/root
}

probe() {
	# $1 socks-host:port  $2 bytes  $3 seconds -> B/s (0 = fail)
	local sp
	sp=$(curl -s -m "$3" -x "socks5h://$1" -o /dev/null -w "%{speed_download}" "${SPEEDURL}${2}" 2>/dev/null)
	case "$sp" in (''|*[!0-9.]*) echo 0 ;; (*) printf '%.0f' "$sp" ;; esac
}

set_state() { # server port score scanned best switched message [proto] [lat]
	printf '{"ts":%s,"active_server":"%s","active_port":"%s","score":%s,"scanned":%s,"best":%s,"switched":%s,"protocol":"%s","latency_ms":"%s","message":"%s"}\n' \
		"$(date +%s)" "$1" "$2" "$3" "$4" "$5" "$6" "${8:-vless}" "${9:-0}" "$7" > "$STATE"
}

[ -f "$CONF" ] || { set_state "" "" 0 0 0 0 "нет конфига sing-box"; exit 1; }
ensure_cron

CUR_SRV=$(jsonfilter -i "$CONF" -e '@.outbounds[0].server' 2>/dev/null | head -1)
CUR_PORT=$(jsonfilter -i "$CONF" -e '@.outbounds[0].server_port' 2>/dev/null | head -1)
NOW=$(date +%s)
STAMP_T=$(stat -c %Y "$STAMP" 2>/dev/null || echo 0)

ASCORE=$(probe "$SOCKS" 262144 10)
NEED_SCAN=0
[ "${ASCORE:-0}" -lt "$MIN_BW" ] && NEED_SCAN=1
[ $((NOW - STAMP_T)) -ge "$FULLSCAN" ] && NEED_SCAN=1
[ "$1" = "force" ] && NEED_SCAN=1
CUR_PROTO=$(jsonfilter -i "$CONF" -e '@.outbounds[0].type' 2>/dev/null | head -1)
if [ "$NEED_SCAN" = "0" ]; then
	set_state "$CUR_SRV" "$CUR_PORT" "$ASCORE" 0 "$ASCORE" 0 "ок" "${CUR_PROTO:-vless}" 0
	exit 0
fi
log "проверка: активная нода ${CUR_SRV}:${CUR_PORT} = ${ASCORE} B/s (мин ${MIN_BW}); скан ${NEED_SCAN}"

# --- список узлов (только узлы с полными Reality-параметрами) ---
ucode -e '
let fs = require("fs");
let sub = json(fs.readfile("/etc/orbix/subscriptions.json") || "{}");
let nodes = sub.nodes || [];
for (let n in nodes) {
	if (!n.server || !n.port) continue;
	let proto = n.protocol || "vless";
	let sec = n.security || "reality";
	let pbk = n.publicKey || n.pbk || "";
	let sid = n.shortId || n.sid || "";
	let uuid = n.uuid || "";
	let pw = n.password || "";
	let meth = n.method || "";
	if (proto == "vless" && (uuid == "" || (sec == "reality" && pbk == ""))) continue;
	if ((proto == "trojan" || proto == "hysteria2" || proto == "ss") && pw == "") continue;
	if (proto == "ss" && meth == "") continue;
	print(join("	", [n.name || n.server, n.server, n.port, uuid, sec, n.sni || "", pbk, sid, n.fingerprint || "firefox", n.flow || "", proto, pw, meth]), "\n");
}
' 2>/dev/null > /tmp/nb-nodes

TOTAL=$(wc -l < "$SUB" 2>/dev/null; true)
FULL=$(wc -l < /tmp/nb-nodes)
if [ "$FULL" -lt 1 ]; then
	set_state "$CUR_SRV" "$CUR_PORT" "$ASCORE" 0 0 0 "в кэше подписки нет полных узлов (все протоколы) — обновите подписку в панели"
	log "ОШИБКА: в subscriptions.json нет полных узлов. Нужен ре-синк подписки из панели."
	exit 0
fi

# --- скаирование кандидатов ---
rm -f /tmp/nb-cands; : > /tmp/nb-cands
SCANNED=0
while IFS=$'\t' read -r N_NAME N_SRV N_PORT N_UUID N_SEC N_SNI N_PBK N_SID N_FP N_FLOW N_PROTO N_PW N_METH; do
	[ "$SCANNED" -ge "$MAXSCAN" ] && break
	[ "$N_SRV" = "$CUR_SRV" ] && [ "$N_PORT" = "$CUR_PORT" ] && continue
	SCANNED=$((SCANNED + 1))
	ucode -e '
	let fs = require("fs");
	let ob = { tag: "out", server: ARGV[1], server_port: int(ARGV[2]) };
	switch (ARGV[10]) {
	case "trojan":
		ob.type = "trojan"; ob.password = ARGV[11];
		ob.tls = { enabled: true, server_name: ARGV[5] || ARGV[1] };
		break;
	case "ss":
		ob.type = "shadowsocks"; ob.method = ARGV[12]; ob.password = ARGV[11];
		break;
	case "hysteria2":
		ob.type = "hysteria2"; ob.password = ARGV[11];
		ob.tls = { enabled: true, server_name: ARGV[5] || "" };
		break;
	default:
		ob.type = "vless"; ob.uuid = ARGV[3];
		ob.tls = { enabled: true, server_name: ARGV[5] || ARGV[1], utls: { enabled: true, fingerprint: ARGV[8] || "firefox" } };
		if (ARGV[4] == "reality") ob.tls.reality = { enabled: true, public_key: ARGV[6], short_id: ARGV[7] };
	}
	if (ARGV[10] == "vless" && ARGV[9] != "") ob.flow = ARGV[9];
	let cfg = { log: { level: "fatal" },
		inbounds: [ { type: "socks", tag: "tin", listen: "127.0.0.1", listen_port: 10812 } ],
		outbounds: [ ob ], route: { final: "out" } };
	fs.writefile("/tmp/nb-test.json", sprintf("%J", cfg));
	' "$0" "$N_SRV" "$N_PORT" "$N_UUID" "$N_SEC" "$N_SNI" "$N_PBK" "$N_SID" "$N_FP" "$N_FLOW" "$N_PROTO" "$N_PW" "$N_METH" 2>/dev/null
	if ! sing-box check -c /tmp/nb-test.json >/dev/null 2>&1; then
		log "пропуск ${N_NAME}: невалидный конфиг"
		continue
	fi
	mkdir -p "$TESTD"
	sing-box run -D "$TESTD" -c /tmp/nb-test.json >/dev/null 2>&1 &
	TPID=$!
	sleep 2
	SC=$(probe "$TESTSOCK" 262144 12)
	kill "$TPID" 2>/dev/null; sleep 1
	kill -9 "$TPID" 2>/dev/null
	LAT=$(curl -s -m 8 -x "socks5h://$TESTSOCK" -o /dev/null -w "%{time_total}" "https://www.gstatic.com/generate_204" 2>/dev/null | tr -d .)
	[ -z "$LAT" ] && LAT=0
	printf "%s	%s	%s	%s	%s	%s	%s	%s	%s	%s	%s	%s	%s	%s\n" "$SC" "$N_NAME" "$N_SRV" "$N_PORT" "$N_UUID" "$N_SEC" "$N_SNI" "$N_PBK" "$N_SID" "$N_FP" "$N_FLOW" "$N_PROTO" "$N_PW" "$N_METH" "$LAT" >> /tmp/nb-cands
	log "нода ${N_NAME}: ${SC} B/s lat=${LAT}ms proto=${N_PROTO}"
done < /tmp/nb-nodes
touch "$STAMP"

BEST=$(sort -rn /tmp/nb-cands 2>/dev/null | head -1)
BEST_SC=$(printf '%s' "$BEST" | cut -f1)
BEST_SC=${BEST_SC:-0}
log "скан ${SCANNED}: лучший ${BEST_SC} B/s, текущая ${ASCORE} B/s"

# переключаем, если лучший заметно живее и хотя бы минимально годен
if [ "$BEST_SC" -ge "$MIN_BW" ] && [ "$BEST_SC" -gt "$((ASCORE * 2 + 10000))" ]; then
	B_NAME=$(printf '%s' "$BEST" | cut -f2)
	B_SRV=$(printf '%s' "$BEST" | cut -f3)
	B_PORT=$(printf '%s' "$BEST" | cut -f4)
	B_UUID=$(printf '%s' "$BEST" | cut -f5)
	B_SEC=$(printf '%s' "$BEST" | cut -f6)
	B_SNI=$(printf '%s' "$BEST" | cut -f7)
	B_PBK=$(printf '%s' "$BEST" | cut -f8)
	B_SID=$(printf '%s' "$BEST" | cut -f9)
	B_FP=$(printf '%s' "$BEST" | cut -f10)
	B_FLOW=$(printf '%s' "$BEST" | cut -f11)
	B_PROTO=$(printf '%s' "$BEST" | cut -f12)
	B_PW=$(printf '%s' "$BEST" | cut -f13)
	B_METH=$(printf '%s' "$BEST" | cut -f14)
	B_LAT=$(printf '%s' "$BEST" | cut -f15)
	cp "$CONF" /root/singbox.config.pre-balancer.json
	ucode -e '
	let fs = require("fs");
	let cfg = json(fs.readfile("/etc/sing-box/config.json"));
	let ob = { tag: "proxy", server: ARGV[1], server_port: int(ARGV[2]) };
	switch (ARGV[10]) {
	case "trojan":
		ob.type = "trojan"; ob.password = ARGV[11];
		ob.tls = { enabled: true, server_name: ARGV[5] || ARGV[1] };
		break;
	case "ss":
		ob.type = "shadowsocks"; ob.method = ARGV[12]; ob.password = ARGV[11];
		break;
	case "hysteria2":
		ob.type = "hysteria2"; ob.password = ARGV[11];
		ob.tls = { enabled: true, server_name: ARGV[5] || "" };
		break;
	default:
		ob.type = "vless"; ob.uuid = ARGV[3];
		ob.tls = { enabled: true, server_name: ARGV[5] || ARGV[1], utls: { enabled: true, fingerprint: ARGV[8] || "firefox" } };
		if (ARGV[4] == "reality") ob.tls.reality = { enabled: true, public_key: ARGV[6], short_id: ARGV[7] };
	}
	if (ARGV[10] == "vless" && ARGV[9] != "") ob.flow = ARGV[9];
	let repl = false;
	for (let i = 0; i < length(cfg.outbounds); i++) {
		if (cfg.outbounds[i].tag == "proxy") { cfg.outbounds[i] = ob; repl = true; }
	}
	if (!repl) push(cfg.outbounds, ob);
	fs.writefile("/etc/sing-box/config.json.tmp", sprintf("%J", cfg));
	' "$0" "$B_SRV" "$B_PORT" "$B_UUID" "$B_SEC" "$B_SNI" "$B_PBK" "$B_SID" "$B_FP" "$B_FLOW" "$B_PROTO" "$B_PW" "$B_METH" 2>/dev/null
	if sing-box check -c /etc/sing-box/config.json.tmp >/dev/null 2>&1; then
		mv /etc/sing-box/config.json.tmp "$CONF"
		printf '{"server":"%s","port":"%s","name":"%s","uuid":"%s","security":"%s","sni":"%s","publicKey":"%s","shortId":"%s","fingerprint":"%s","flow":"%s","protocol":"%s","password":"%s","method":"%s","latency_ms":"%s","auto_balancer":true}\n' "$B_SRV" "$B_PORT" "$B_NAME" "$B_UUID" "$B_SEC" "$B_SNI" "$B_PBK" "$B_SID" "$B_FP" "$B_FLOW" "$B_PROTO" "$B_PW" "$B_METH" "$B_LAT" > /etc/sing-box/active_node.json
		/etc/init.d/sing-box restart >/dev/null 2>&1
		sleep 4
		NEW_SC=$(probe "$SOCKS" 262144 10)
		if [ "$NEW_SC" -ge $((MIN_BW / 2)) ]; then
			log "ПЕРЕКЛЮЧЕНИЕ на ${B_NAME}: ${NEW_SC} B/s proto=${B_PROTO}"
			set_state "$B_SRV" "$B_PORT" "$NEW_SC" "$SCANNED" "$BEST_SC" 1 "переключено на ${B_NAME}" "$B_PROTO" "$B_LAT"
			exit 0
		fi
		log "после переключения ${NEW_SC} B/s — откат на прежнюю ноду"
		cp /root/singbox.config.pre-balancer.json "$CONF"
		/etc/init.d/sing-box restart >/dev/null 2>&1
		sleep 3
		set_state "$CUR_SRV" "$CUR_PORT" "$(probe "$SOCKS" 262144 10)" "$SCANNED" "$BEST_SC" 0 "переключение не улучшило — откат" "${CUR_PROTO:-vless}" 0
		exit 0
	fi
	log "кандидат ${B_NAME}: синтаксис конфига не прошёл check"
	cp /root/singbox.config.pre-balancer.json "$CONF" 2>/dev/null
fi

MSG="все узлы деградированы: лучший ${BEST_SC} B/s; замените подписку"
[ "$ASCORE" -ge "$MIN_BW" ] && MSG="ок (плановый скан ${SCANNED} нод)"
set_state "$CUR_SRV" "$CUR_PORT" "$ASCORE" "$SCANNED" "$BEST_SC" 0 "$MSG" "${CUR_PROTO:-vless}" 0
log "$MSG"
