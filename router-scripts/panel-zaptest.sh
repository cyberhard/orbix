#!/bin/sh
# orbix zapret auto-test runner — mechanics ported from StressOzz/Zapret-Manager
# (do_test_run / _test_check_url / _test_recover patterns).
#
# Iterates candidate nfqws DPI-evasion strategies against a set of DPI-blocked
# domains, scores pass rate per strategy, ALWAYS restores the original
# /etc/config/zapret afterwards, and optionally applies the best strategy.
# Safety (from Zapret-Manager): config backup, control run with zapret stopped,
# stop-flag file, skip during node balancer? (no) — state files for UI polling.
#
# Usage:  panel-zaptest [--apply-best]
# Data:   /etc/orbix/zaptest-domains.txt   (name|https://url)
#         /etc/orbix/zaptest-strategies.txt (#NAME then one single-line opts)
# State:  /tmp/orbix-zaptest.{run,stop,log,results,state}

set -u

CONF=/etc/config/zapret
INITD=/etc/init.d/zapret
DIR=/etc/orbix
DOMS=$DIR/zaptest-domains.txt
CANDS=$DIR/zaptest-strategies.txt
RUN=/tmp/orbix-zaptest.run
STOP=/tmp/orbix-zaptest.stop
LOG=/tmp/orbix-zaptest.log
STATE=/tmp/orbix-zaptest.state
RESULTS=/tmp/orbix-zaptest.results
BAK=$DIR/zaptest.config.bak
OKF=/tmp/orbix-zaptest.ok.$$
PARALLEL=8
APPLY_BEST=0
[ "${1:-}" = "--apply-best" ] && APPLY_BEST=1

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$1" >> "$LOG"; }

bail() {
	log "FATAL: $1"
	printf '{"running":false,"error":"%s","ts":"%s"}\n' "$1" "$(date '+%F %T')" > "$STATE"
	cleanup_files
	exit 1
}

cleanup_files() { rm -f "$OKF"; }

restore_config() {
	# returns original config and zapret state, idempotent
	[ -s "$BAK" ] || return 0
	cp -f "$BAK" "$CONF"
	if [ "$WAS_RUNNING" = "0" ]; then
		$INITD stop >/dev/null 2>&1
	else
		$INITD restart >/dev/null 2>&1
	fi
	rm -f "$BAK"
	log "config restored, zapret running=$WAS_RUNNING"
}

state_json() { # $1 running $2 cur $3 idx $4 total [$5 extra-json]
	printf '{"running":%s,"cur":"%s","idx":%s,"total":%s,"ts":"%s"%s}\n' \
		"$1" "$2" "$3" "$4" "$(date '+%F %T')" "${5:+,$5}" > "$STATE"
}

test_url() { # $1 name $2 url
	_w=$(curl -sL --connect-timeout 4 --max-time 6 --speed-time 3 --speed-limit 1 \
		--range 0-65535 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) curl/8.0" \
		-o /dev/null -w '%{time_connect}' "$2" 2>/dev/null)
	rc=$?
	if [ "$rc" -eq 0 ]; then
		printf '1\n' >> "$OKF"
		log "[ OK ] $1"
	else
		why=dpi
		case "$rc" in
			6) why=dns ;;
			7) why=ip ;;
			28) case "$_w" in *[1-9]*) ;; *) why=ip ;; esac ;;
		esac
		log "[FAIL] $1 ($why)"
	fi
}

test_all() { # $1 label — one scored round over $DOMS
	: > "$OKF"
	running=0
	while IFS='|' read -r name url; do
		[ -n "${url:-}" ] || continue
		[ -f "$STOP" ] && break
		test_url "$name" "$url" &
		running=$((running + 1))
		if [ "$running" -ge "$PARALLEL" ]; then
			wait
			running=0
		fi
	done < "$DOMS"
	[ "$running" -gt 0 ] && wait
	ok=$(grep -c '^1$' "$OKF" 2>/dev/null || true)
	[ -n "$ok" ] || ok=0
	total=$(grep -c '|' "$DOMS" 2>/dev/null || true)
	[ -n "$total" ] || total=0
	printf 'S|%s|%s|%s|%s\n' "$1" "$ok" "$total" "$(date '+%F %T')" >> "$RESULTS"
	log "RESULT: $1 -> $ok/$total"
	rm -f "$OKF"
}

apply_strategy() { # $1 single-line NFQWS_OPT value
	uci -q set "zapret.config.NFQWS_OPT=$1" || return 1
	uci commit zapret
	busybox timeout 90 "$INITD" restart >/tmp/orbix-zaptest-restart.log 2>&1
	sleep 3
	return 0
}

files_ok() { # candidate opts $1: referenced /opt/zapret files must exist
	for tok in $1; do
		case "$tok" in
			*=/opt/zapret/*)
				f=${tok#*=}
				[ -f "$f" ] || return 1
				;;
		esac
	done
	return 0
}

# ---------- preflight ----------
[ -x "$INITD" ] || { echo "zapret init.d not found"; exit 1; }
[ -f "$CONF" ] || { echo "zapret config not found"; exit 1; }

if [ -f "$RUN" ]; then
	p=$(cat "$RUN" 2>/dev/null || true)
	if [ -n "${p:-}" ] && kill -0 "$p" 2>/dev/null; then
		echo "test already running (pid $p)"
		exit 1
	fi
fi
echo $$ > "$RUN"

# data files: self-install defaults (Zapret-Manager built-in set)
mkdir -p "$DIR"
if [ ! -s "$DOMS" ]; then
	cat > "$DOMS" <<'ZDOMS'
gosuslugi.ru|https://www.gosuslugi.ru
esia.gosuslugi.ru|https://esia.gosuslugi.ru
nalog.ru|https://nalog.ru
lkfl2.nalog.ru|https://lkfl2.nalog.ru
rutube.ru|https://rutube.ru
ntc.party|https://ntc.party/
instagram.com|https://instagram.com
facebook.com|https://facebook.com
rutracker.org|https://rutracker.org
nnmclub.to|https://nnmclub.to
rutor.info|https://rutor.info
openwrt.org|https://openwrt.org
discord.com|https://discord.com
x.com|https://x.com
forum.ru-board.com|https://forum.ru-board.com
play.google.com|https://play.google.com
ZDOMS
fi
if [ ! -s "$CANDS" ]; then
	# v1-v10 from Zapret-Manager Strategies.md, each on ONE line
	cat > "$CANDS" <<'ZCANDS'
#v1 split2+stun
--filter-tcp=443 --hostlist-exclude=/opt/zapret/ipset/zapret-hosts-user-exclude.txt --dpi-desync=split2 --dpi-desync-split-seqovl=681 --dpi-desync-split-seqovl-pattern=/opt/zapret/files/fake/stun.bin
#v2 fake,multisplit
--filter-tcp=443 --hostlist-exclude=/opt/zapret/ipset/zapret-hosts-user-exclude.txt --dpi-desync=fake,multisplit --dpi-desync-split-seqovl=681 --dpi-desync-split-pos=1 --dpi-desync-fooling=ts --dpi-desync-repeats=8 --dpi-desync-split-seqovl-pattern=/opt/zapret/files/fake/stun.bin --dpi-desync-fake-tls-mod=rnd,dupsid,sni=www.google.com
#v3 hostfakesplit ozon
--filter-tcp=443 --hostlist-exclude=/opt/zapret/ipset/zapret-hosts-user-exclude.txt --dpi-desync=hostfakesplit --dpi-desync-hostfakesplit-mod=host=ozon.ru --dpi-desync-repeats=4 --dpi-desync-fooling=ts,md5sig --dpi-desync-badseq-increment=0
#v4 multisplit seqovl582
--filter-tcp=443 --hostlist-exclude=/opt/zapret/ipset/zapret-hosts-user-exclude.txt --dpi-desync=multisplit --dpi-desync-split-seqovl=582 --dpi-desync-split-pos=1 --dpi-desync-split-seqovl-pattern=/opt/zapret/files/fake/stun.bin
#v5 fake,fakeddisorder
--filter-tcp=443 --hostlist-exclude=/opt/zapret/ipset/zapret-hosts-user-exclude.txt --dpi-desync=fake,fakeddisorder --dpi-desync-split-pos=1 --dpi-desync-fake-tls=/opt/zapret/files/fake/stun.bin --dpi-desync-fake-tls-mod=none --dpi-desync-fakedsplit-pattern=/opt/zapret/files/fake/tls_clienthello_www_google_com.bin --dpi-desync-fooling=badseq,badsum --dpi-desync-badseq-increment=0
#v6 hostfakesplit 2gis
--filter-tcp=443 --hostlist-exclude=/opt/zapret/ipset/zapret-hosts-user-exclude.txt --dpi-desync=hostfakesplit --dpi-desync-hostfakesplit-mod=host=i2.photo.2gis.com --dpi-desync-hostfakesplit-midhost=host-2 --dpi-desync-split-seqovl=726 --dpi-desync-fooling=badsum,badseq --dpi-desync-badseq-increment=0
#v7 fake,multisplit badseq
--filter-tcp=443 --hostlist-exclude=/opt/zapret/ipset/zapret-hosts-user-exclude.txt --dpi-desync=fake,multisplit --dpi-desync-split-seqovl=654 --dpi-desync-split-pos=1 --dpi-desync-fooling=badseq,badsum --dpi-desync-repeats=6
#v8 fake 4pda
--filter-tcp=443 --hostlist-exclude=/opt/zapret/ipset/zapret-hosts-user-exclude.txt --dpi-desync=fake --dpi-desync-fooling=ts --dpi-desync-fake-tls=/opt/zapret/files/fake/4pda.bin --dpi-desync-fake-tls-mod=none
#v9 hostfakesplit badseq
--filter-tcp=443 --hostlist-exclude=/opt/zapret/ipset/zapret-hosts-user-exclude.txt --dpi-desync=hostfakesplit --dpi-desync-fooling=badseq,badsum --dpi-desync-hostfakesplit-mod=host=ozon.ru --dpi-desync-badseq-increment=0
#v10 fake,split2 bootstrapcdn
--filter-tcp=443 --hostlist-exclude=/opt/zapret/ipset/zapret-hosts-user-exclude.txt --dpi-desync=fake,split2 --dpi-desync-split-pos=2 --dpi-desync-fake-tls=/opt/zapret/files/fake/tls_clienthello_www_google_com.bin --dpi-desync-hostfakesplit-mod=host=maxcdn.bootstrapcdn.com --dpi-desync-fake-tls-mod=rnd,sni=maxcdn.bootstrapcdn.com --dpi-desync-fooling=ts
ZCANDS
fi

# ---------- start ----------
: > "$LOG"
: > "$RESULTS"
rm -f "$STOP"
WAS_RUNNING=0
pidof nfqws > /dev/null 2>&1 && WAS_RUNNING=1
cp -f "$CONF" "$BAK" || bail "cannot backup config"
total_str=$(grep -c '^#' "$CANDS")
log "start: strategies=$total_str domains=$(grep -c '|' "$DOMS") was_running=$WAS_RUNNING apply_best=$APPLY_BEST"
state_json true "control" 0 "$total_str"

# control run: what passes WITHOUT zapret (ZM baseline: >=80% => false positives likely)
$INITD stop >/dev/null 2>&1
sleep 1
test_all "control (zapret off)"
$INITD start >/dev/null 2>&1
sleep 2

# per-strategy loop (one block = name line + opts line)
idx=0
name=""
while IFS= read -r line; do
	case "$line" in
		\#*)
			name=${line#\#}
			;;
		"") ;;
		*)
			[ -n "${name:-}" ] || continue
			[ -f "$STOP" ] && break
			idx=$((idx + 1))
			state_json true "$name" "$idx" "$total_str"
			if ! files_ok "$line"; then
				log "SKIP: $name (referenced fake/list files missing)"
				continue
			fi
			log "==> [$idx/$total_str] $name"
			if ! apply_strategy "$line"; then
				log "SKIP: $name (restart failed)"
				continue
			fi
			test_all "$name"
			;;
	esac
done < "$CANDS"

# ---------- restore ----------
if [ -f "$STOP" ]; then
	log "stopped by user, restoring config"
	rm -f "$STOP"
else
	log "done, restoring config"
fi
restore_config

best=$(awk -F'|' '$1=="S" { printf "%06d %s\n", $3 + 0, $0 }' "$RESULTS" | sort -r | cut -d' ' -f2- | grep -v '|control' | head -n 1)
bestname=${best#S|}; bestname=${bestname%%|*}

if [ "$APPLY_BEST" = "1" ] && [ -n "${bestname:-}" ]; then
	log "apply-best: $bestname"
	opts=$(awk -v n="#$bestname" '$0==n{getline; print; exit}' "$CANDS")
	if [ -n "$opts" ] && apply_strategy "$opts"; then
		log "applied best strategy: $bestname"
	else
		log "apply-best failed"
		bestname="apply-failed:$bestname"
	fi
fi

state_json false "done" "$idx" "$total_str" "\"best\":\"$bestname\""
log "finished best=$bestname"
rm -f "$RUN"
exit 0
