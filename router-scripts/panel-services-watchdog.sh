#!/bin/sh
# orbix services watchdog — periodic cron sweep.
# Mechanics ported from StressOzz/Zapret-Manager zm_watch:
#   * rpcd: restart when dead; when alive-but-hung, restart only on the SECOND
#     consecutive failure (marker file) so one slow bus does not bounce it
#   * zapret: restart when service enabled but nfqws processes are gone
#   * sing-box: restart when enabled but process is gone
#   * flow offloading: auto re-apply the zapret fw4 fix when it disappeared
#     (upgrade wiped template etc.) — same "popravka" as zapret_flowoff_fix
#   * zapret ports: keep NFQWS_PORTS_* in sync with the active strategy
# Skips zapret-touching checks while panel-zaptest runs (it stops zapret on
# purpose during its control round).
#
# Runs from cron: */N * * * * /usr/sbin/panel-services-watchdog # orbix-watchdog

set -u

TAG=orbix-watchdog
STATE=/tmp/panel-watchdog.state.json
LOGF=/tmp/panel-watchdog.log
SLOW=/tmp/.orbix-rpcd-slow
ZAPTEST_RUN=/tmp/orbix-zaptest.run
TPL=/usr/share/firewall4/templates/ruleset.uc

log() {
	printf '[%s] %s\n' "$(date '+%F %T')" "$1" >> "$LOGF"
	logger -t "$TAG" "$1" 2>/dev/null
}
# keep log small
if [ -f "$LOGF" ] && [ "$(wc -l < "$LOGF")" -gt 400 ]; then
	tail -n 300 "$LOGF" > "$LOGF.tmp" && mv "$LOGF.tmp" "$LOGF"
fi

checks=""
addc() { # $1 name $2 ok(1/0) [$3 action]
	[ -n "$checks" ] && checks="$checks,"
	if [ -n "${3:-}" ]; then
		checks="$checks{\"name\":\"$1\",\"ok\":$2,\"action\":\"$3\"}"
	else
		checks="$checks{\"name\":\"$1\",\"ok\":$2}"
	fi
}

zaptest_running() {
	[ -f "$ZAPTEST_RUN" ] || return 1
	p=$(cat "$ZAPTEST_RUN" 2>/dev/null || true)
	[ -n "${p:-}" ] && kill -0 "$p" 2>/dev/null
}

# ---------- rpcd (ZM rpcd_watch pattern) ----------
if ! pidof rpcd > /dev/null 2>&1; then
	log "rpcd not running — restarting"
	/etc/init.d/rpcd restart > /dev/null 2>&1
	addc rpcd 0 restart
elif ! ubus -t 5 list session > /dev/null 2>&1; then
	if [ -n "$(find "$SLOW" -mmin -5 2>/dev/null)" ]; then
		log "rpcd unresponsive twice — restarting"
		rm -f "$SLOW"
		/etc/init.d/rpcd restart > /dev/null 2>&1
		addc rpcd 0 restart
	else
		log "rpcd unresponsive once — marking"
		touch "$SLOW"
		addc rpcd 1 marked-slow
	fi
else
	rm -f "$SLOW"
	addc rpcd 1
fi

# ---------- zapret ----------
if zaptest_running; then
	log "zaptest running — skipping zapret checks"
	addc zapret 1 zaptest-skipped
else
	ZENABLED=0
	[ -x /etc/init.d/zapret ] && /etc/init.d/zapret enabled > /dev/null 2>&1 && ZENABLED=1
	if [ "$ZENABLED" = "1" ]; then
		EN=$(uci -q get zapret.config.NFQWS_ENABLE || true)
		if [ "$EN" = "0" ]; then
			addc zapret 1 disabled-in-config
		elif ! pidof nfqws > /dev/null 2>&1; then
			log "zapret enabled but nfqws not running — restarting"
			/etc/init.d/zapret restart > /dev/null 2>&1
			addc zapret 0 restart
		else
			addc zapret 1
		fi
		# flow offloading auto-sync (ZM _ft_zapret_sync)
		if [ "$(uci -q get firewall.@defaults[0].flow_offloading || true)" = "1" ] && \
		   [ -f "$TPL" ] && ! grep -q 'ct original packets ge 30 flow offload @ft;' "$TPL" 2>/dev/null; then
			log "flow offloading on, zapret fix missing — re-applying"
			ubus call circumvention zapret_flowoff_fix '{"enable":true}' > /dev/null 2>&1 && \
				addc flowoff 0 reapplied || addc flowoff 0 failed
		fi
	else
		addc zapret 1 not-enabled
	fi

	# ---------- zapret ports sync (ZM _zp_sync) ----------
	ubus call circumvention zapret_ports_sync > /dev/null 2>&1 && addc ports 1 || addc ports 0 failed
fi

# ---------- sing-box ----------
if [ -x /etc/init.d/sing-box ] && /etc/init.d/sing-box enabled > /dev/null 2>&1; then
	if ! pidof sing-box > /dev/null 2>&1; then
		log "sing-box enabled but not running — restarting"
		/etc/init.d/sing-box restart > /dev/null 2>&1
		addc singbox 0 restart
	else
		addc singbox 1
	fi
else
	addc singbox 1 not-enabled
fi

printf '{"ts":"%s","checks":[%s]}\n' "$(date '+%F %T')" "$checks" > "$STATE"
exit 0
