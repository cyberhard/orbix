# Porting Zapret-Manager mechanisms into orbix

Date: 2026-11-18. Source: https://github.com/StressOzz/Zapret-Manager
(`ZapretManager_LuCI.sh` modules zapret/test/system). Mechanism semantics
were ported, the code is native to the orbix rpcd plugin style.

## 1. Flow Offloading fix (fw4/nftables)
- Problem: with `flow offloading` on, nfconntrack removes connections from
  the nft path before Zapret's NFQUEUE rule, so DPI-critical first packets
  never reach nfqws.
- Ported mechanism: guard `flow offload @ft;` in
  `/usr/share/firewall4/templates/ruleset.uc` with
  `ct original packets ge 30` (Zapret-Manager `_fw4_offload_set()` pattern).
- RPCD: `zapret_flowoff_status` (detects offload mode sw/hw/none from
  `firewall.@defaults[0].flow_offloading*`, zapret presence, fix presence),
  `zapret_flowoff_fix` (enable=true/false, idempotent, template backup,
  rollback if `fw4 reload` fails). Watchdog re-applies it if it disappears.
- UI: first card of `ZapretHealth` (Zapret -> Strategy page).

## 2. Strategy auto-test (nfqws) without killing the network
- `router-scripts/panel-zaptest.sh` (deployed to `/usr/sbin/panel-zaptest`):
  control round (zapret stopped) + each strategy from
  `/etc/orbix/zaptest-strategies.txt` (format: `#NAME` line + one opts
  line), checks from `/etc/orbix/zaptest-domains.txt` (`name|https://url`),
  parallel curl with `--max-time`, classification (dns/dpi/other), results
  `S|NAME|ok|total|ts`.
- Safety: original `/etc/config/zapret` backed up to
  `/etc/orbix/zaptest.config.bak`, restored via trap EXIT; stop file
  `/tmp/orbix-zaptest.stop`; stale-run recovery in
  `zapret_auto_status`/`zaptest_stop` (config is restored even if the runner
  was SIGKILLed). Default mode = tests only, `apply_best` optional.
- RPCD: `zapret_auto_test` / `zapret_auto_status` / `zaptest_stop`.
- UI: third card of `ZapretHealth` — progress, results table with the best
  row highlighted, control round shown, apply-best checkbox, stop, log.

## 3. NFQWS ports sync + no duplicate nft rules
- RPCD `zapret_ports_sync`: parses `--filter-tcp=`/`--filter-udp=` from the
  active `NFQWS_OPT`, unions with existing `NFQWS_PORTS_TCP/UDP`, normalizes
  (numeric pad-sort via awk because busybox `sort` lacks `-t/-k`), dedupes;
  writes only on real change and restarts zapret only when something was
  written. nft rules are re-rendered by zapret init from config, so
  duplicates cannot accumulate.
- Watchdog keeps ports in sync on every sweep.
- UI: second card of `ZapretHealth`.

## 4. Services watchdog (cron)
- `router-scripts/panel-services-watchdog.sh` -> `/usr/sbin/panel-services-watchdog`
  (Zapret-Manager `zm_watch` pattern, cron form):
  - rpcd: dead -> restart immediately; alive but ubus probe slow -> restart
    only on the second consecutive miss (marker `/tmp/.orbix-rpcd-slow`);
  - zapret: enabled in UCI but no `nfqws` process -> restart;
  - sing-box: enabled but no process -> restart;
  - re-applies the flowoff fix and re-syncs zapret ports;
  - pauses zapret checks while `/tmp/orbix-zaptest.run` exists.
  - state `/tmp/panel-watchdog.state.json`, log `/tmp/panel-watchdog.log`.
- RPCD: `watchdog_status` / `watchdog_set` (enable, interval_min 1..59,
  run_now). Cron entry carries the `# orbix-watchdog` marker.
- UI: `WatchdogCard` on System -> Startup Services.

## ACL
`rpcd-circumvention-acl.json`: read += `zapret_flowoff_status`,
`zapret_auto_status`, `watchdog_status`; write += `zapret_flowoff_fix`,
`zapret_ports_sync`, `zapret_auto_test`, `zaptest_stop`, `watchdog_set`.

## Verification
- `shellcheck -S error` clean for every `*.sh` in the repo.
- `npm run build` ok; `npm test` 31/31. tsc --noEmit: only pre-existing
  baseline errors (present at HEAD), none introduced.
- Live router: all four files deployed, rpcd restarted.
  `zapret_flowoff_status` -> offload none, fix not needed.
  `zapret_ports_sync` -> required ports derived from live strategy
  `Strategy_v6_by_StressOzz`, normalized/deduped, no change needed.
  Full auto-test run end-to-end via RPCD: control(zapret off)=2/5,
  fake_ttl3=4/5, fake_ttl5=4/5 (best), current_v6 ran; config md5 identical
  after the run (`md5sum -c` OK).
  Watchdog enabled at */5, first sweep: rpcd/zapret/ports/singbox all ok;
  nfqws and sing-box alive.
