#!/usr/bin/env python3
"""
ORBIX CLI Controller (orbix-ctl)
Zero-dependency CLI tool for rapid management of OpenWrt Policy Engine,
Zapret2 DPI circumvention, Sing-box VLESS Reality, and AmneziaWG.
Communicates directly with native OpenWrt ubus JSON-RPC.
"""

import sys
import os
import json
import argparse
import urllib.request
import urllib.error

OPENWRT_HOST = os.environ.get("OPENWRT_HOST", "http://192.168.1.1")
OPENWRT_USER = os.environ.get("OPENWRT_USER", "root")
OPENWRT_PASS = os.environ.get("OPENWRT_PASS", "root")

class OrbixClient:
    def __init__(self, host=OPENWRT_HOST, user=OPENWRT_USER, password=OPENWRT_PASS):
        self.host = host.rstrip("/")
        self.user = user
        self.password = password
        self.session_id = None
        self.req_id = 1

    def login(self):
        payload = {
            "jsonrpc": "2.0",
            "id": self.req_id,
            "method": "call",
            "params": [
                "00000000000000000000000000000000",
                "session",
                "login",
                {"username": self.user, "password": self.password}
            ]
        }
        self.req_id += 1
        data = self._http_post(payload)
        res = data.get("result", [])
        if res and res[0] == 0 and "ubus_rpc_session" in res[1]:
            self.session_id = res[1]["ubus_rpc_session"]
            return self.session_id
        raise RuntimeError(f"Login failed: {data}")

    def call(self, obj, method, params=None):
        if not self.session_id:
            self.login()
        if params is None:
            params = {}

        payload = {
            "jsonrpc": "2.0",
            "id": self.req_id,
            "method": "call",
            "params": [self.session_id, obj, method, params]
        }
        self.req_id += 1
        data = self._http_post(payload)

        if "error" in data:
            raise RuntimeError(f"RPC Error: {data['error']}")
        
        result = data.get("result", [])
        if not result:
            return {}
        
        status, res_obj = result[0], result[1]
        if status == 6:  # Session expired
            self.session_id = None
            self.login()
            return self.call(obj, method, params)
        if status != 0:
            raise RuntimeError(f"Ubus call error code {status}")
        return res_obj

    def _http_post(self, payload):
        req = urllib.request.Request(
            f"{self.host}/ubus",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.URLError as e:
            raise RuntimeError(f"Cannot reach OpenWrt router at {self.host}: {e}")

def cmd_status(client, args):
    board = client.call("system", "board")
    info = client.call("system", "info")
    pol = client.call("circumvention", "policy_status")
    ks = client.call("circumvention", "killswitch_status")
    vless = client.call("circumvention", "vless_status")
    zapret = client.call("circumvention", "zapret_status")

    load = [round(x / 65536, 2) if x > 100 else x for x in info.get("load", [0, 0, 0])]
    mem_total = round(info.get("memory", {}).get("total", 0) / (1024 * 1024))
    mem_avail = round(info.get("memory", {}).get("available", info.get("memory", {}).get("free", 0)) / (1024 * 1024))

    print("\n=== ORBIX System & Circumvention Status ===")
    print(f"Hardware:    {board.get('model', 'Unknown')} ({board.get('release', {}).get('target', 'aarch64')})")
    print(f"Firmware:    {board.get('release', {}).get('description', 'OpenWrt 25.12')}")
    print(f"Uptime:      {info.get('uptime', 0) // 3600}h {(info.get('uptime', 0) % 3600) // 60}m | Load: {load}")
    print(f"RAM:         {mem_total - mem_avail} MB / {mem_total} MB used ({round((mem_total - mem_avail) / (mem_total or 1) * 100)}%)")
    print("------------------------------------------")
    print(f"Zapret2:     {'RUNNING' if zapret.get('running') else 'STOPPED'} (Strategy: {zapret.get('strategy', 'Default')})")
    print(f"Sing-box:    {'RUNNING' if vless.get('status') == 'ok' or vless.get('active') else 'ONLINE'} (Active Node: {vless.get('server', 'Configured')})")
    print(f"KillSwitch:  {'ACTIVE [BLOCKED WAN]' if ks.get('enabled') else 'OFF'} (Scope: {ks.get('scope', 'vpn_devices')})")
    print(f"Policies:    Proxy: {len(pol.get('proxy_domains', []))} | Direct: {len(pol.get('direct_domains', []))} | Blocked: {len(pol.get('blocked_domains', []))}")
    print("==========================================\n")

def cmd_policy_list(client, args):
    pol = client.call("circumvention", "policy_status")
    print("\n=== Active Policy Domain Lists ===")
    print(f"🔴 Blocked Domains ({len(pol.get('blocked_domains', []))}):")
    for d in sorted(pol.get("blocked_domains", [])):
        print(f"   • {d}")
    print(f"\n🛡️ Proxy (VPN) Domains ({len(pol.get('proxy_domains', []))}):")
    for d in sorted(pol.get("proxy_domains", [])):
        print(f"   • {d}")
    print(f"\n🇷🇺 Direct (RuNet / WAN) Domains ({len(pol.get('direct_domains', []))}):")
    for d in sorted(pol.get("direct_domains", [])):
        print(f"   • {d}")
    print()

def cmd_policy_add(client, args):
    pol = client.call("circumvention", "policy_status")
    blocked = set(pol.get("blocked_domains", []))
    direct = set(pol.get("direct_domains", []))
    proxy = set(pol.get("proxy_domains", []))

    domain = args.domain.strip().lower()
    # Remove from existing sets first
    blocked.discard(domain)
    direct.discard(domain)
    proxy.discard(domain)

    if args.target == "proxy":
        proxy.add(domain)
        action_name = "Proxy (VLESS Reality)"
    elif args.target == "direct":
        direct.add(domain)
        action_name = "Direct (WAN / Domestic DNS)"
    elif args.target == "block":
        blocked.add(domain)
        action_name = "Block (Sinkhole)"
    else:
        print(f"Unknown target: {args.target}")
        return

    res = client.call("circumvention", "policy_apply", {
        "blocked_domains": sorted(list(blocked)),
        "direct_domains": sorted(list(direct)),
        "proxy_domains": sorted(list(proxy))
    })
    print(f"✓ Domain '{domain}' assigned to {action_name}. Status: {res.get('status', 'ok')}")

def cmd_policy_remove(client, args):
    pol = client.call("circumvention", "policy_status")
    domain = args.domain.strip().lower()
    blocked = [d for d in pol.get("blocked_domains", []) if d != domain]
    direct = [d for d in pol.get("direct_domains", []) if d != domain]
    proxy = [d for d in pol.get("proxy_domains", []) if d != domain]

    res = client.call("circumvention", "policy_apply", {
        "blocked_domains": blocked,
        "direct_domains": direct,
        "proxy_domains": proxy
    })
    print(f"✓ Domain '{domain}' removed from policies. Status: {res.get('status', 'ok')}")

def cmd_device_list(client, args):
    pbr = client.call("circumvention", "pbr_status")
    rules = pbr.get("rules", [])

    print("\n=== Per-Device Routing Policies ===")
    print(f"{'Source Address / IP':24} {'Target Interface':18} {'Status':10} {'Policy Name'}")
    print("-" * 80)
    for r in rules:
        src = r.get("src_addr")
        if not src:
            continue
        iface = r.get("interface", "default")
        status = "Enabled" if r.get("enabled", True) else "Disabled"
        name = r.get("name", "")
        print(f"{src:24} {iface:18} {status:10} {name}")
    print()

def cmd_device_set(client, args):
    res = client.call("circumvention", "pbr_set_device_rule", {
        "ip": args.ip,
        "mac": args.mac or "",
        "name": args.name or f"Device {args.ip}",
        "interface": args.target,
        "enabled": not args.disabled
    })
    print(f"✓ Device {args.ip} routed to interface '{args.target}'. Status: {res.get('status', 'ok')}")

def cmd_zapret_status(client, args):
    status = client.call("circumvention", "zapret_status")
    print("\n=== Zapret2 DPI Circumvention Status ===")
    print(f"State:        {'RUNNING' if status.get('running') else 'STOPPED'}")
    print(f"Strategy:     {status.get('strategy', 'hostfakesplit')}")
    print(f"TCP Ports:    {status.get('ports_tcp', '80,443,2053,2083,8443')}")
    print(f"UDP Ports:    {status.get('ports_udp', '443,50000-50100')}")
    print(f"Hostlists:    Google: {status.get('google_hosts_count', 0)} | General: {status.get('general_hosts_count', 0)}")
    print()

def cmd_zapret_test(client, args):
    domain = args.domain
    print(f"Testing Zapret DPI desync against '{domain}'...")
    res = client.call("circumvention", "zapret_test_strategy", {
        "domain": domain,
        "strategy": args.strategy or ""
    })
    print(f"Result: {json.dumps(res, indent=2)}")

def cmd_vpn_status(client, args):
    awg = client.call("circumvention", "awg_status")
    vless = client.call("circumvention", "vless_status")

    print("\n=== VPN Tunnels Status ===")
    print(f"Sing-box VLESS Reality:")
    print(f"  Server:      {vless.get('server', 'N/A')}:{vless.get('port', 443)}")
    print(f"  SNI Mask:    {vless.get('sni', 'N/A')}")
    print(f"  Handshake:   {vless.get('status', 'online')}")
    print(f"\nAmneziaWG (awg0):")
    print(f"  Active:      {'UP' if awg.get('active') else 'DOWN'}")
    print(f"  Endpoint:    {awg.get('endpoint', 'N/A')}")
    print(f"  Jc/Jmin:     {awg.get('jc', 'N/A')} / {awg.get('jmin', 'N/A')}")
    print()

def cmd_vpn_set_node(client, args):
    node = {
        "server": args.server,
        "port": int(args.port),
        "uuid": args.uuid,
        "flow": args.flow or "xtls-rprx-vision",
        "sni": args.sni or args.server,
        "publicKey": args.pubkey or "",
        "shortId": args.shortid or "",
        "fingerprint": args.fingerprint or "firefox"
    }
    res = client.call("circumvention", "singbox_set_outbound", {"node": node})
    print(f"✓ Active VLESS node switched to {args.server}:{args.port}. Status: {res.get('status', 'ok')}")

def cmd_killswitch(client, args):
    if args.action == "status":
        ks = client.call("circumvention", "killswitch_status")
        print(f"KillSwitch Status: {'ENABLED' if ks.get('enabled') else 'DISABLED'}")
        print(f"Scope:             {ks.get('scope', 'vpn_devices')}")
        print(f"Blocked Packets:   {ks.get('dropped_packets', 0)}")
    elif args.action in ["on", "enable"]:
        res = client.call("circumvention", "killswitch_set", {
            "enabled": True,
            "scope": args.scope or "vpn_devices",
            "allow_lan": True
        })
        print(f"✓ KillSwitch ENABLED (Scope: {args.scope or 'vpn_devices'}). Status: {res.get('status', 'ok')}")
    elif args.action in ["off", "disable"]:
        res = client.call("circumvention", "killswitch_set", {"enabled": False})
        print(f"✓ KillSwitch DISABLED. Status: {res.get('status', 'ok')}")

def main():
    parser = argparse.ArgumentParser(description="ORBIX OpenWrt Fast Configuration CLI")
    subparsers = parser.add_subparsers(dest="command")

    # status
    subparsers.add_parser("status", help="Show overview of router, policies, Zapret, and VPN")

    # policy
    p_pol = subparsers.add_parser("policy", help="Manage domain policies")
    p_pol_sub = p_pol.add_subparsers(dest="subcommand")
    p_pol_sub.add_parser("list", help="List domain policies")
    
    p_add = p_pol_sub.add_parser("add", help="Add domain to a policy")
    p_add.add_argument("domain", help="Domain name (e.g. youtube.com)")
    p_add.add_argument("--target", choices=["proxy", "direct", "block"], default="proxy", help="Target action")

    p_rem = p_pol_sub.add_parser("remove", help="Remove domain from policies")
    p_rem.add_argument("domain", help="Domain name")

    # device
    p_dev = subparsers.add_parser("device", help="Manage per-device routing")
    p_dev_sub = p_dev.add_subparsers(dest="subcommand")
    p_dev_sub.add_parser("list", help="List device routing table")

    p_dev_set = p_dev_sub.add_parser("set", help="Assign device to route")
    p_dev_set.add_argument("--ip", required=True, help="Device IP address")
    p_dev_set.add_argument("--mac", help="Device MAC address")
    p_dev_set.add_argument("--name", help="Device name")
    p_dev_set.add_argument("--target", required=True, choices=["default", "wan", "singbox", "awg0", "zapret"], help="Outbound interface")
    p_dev_set.add_argument("--disabled", action="store_true", help="Disable this rule")

    # zapret
    p_zap = subparsers.add_parser("zapret", help="Manage Zapret2 DPI circumvention")
    p_zap_sub = p_zap.add_subparsers(dest="subcommand")
    p_zap_sub.add_parser("status", help="Zapret status")
    p_zap_test = p_zap_sub.add_parser("test", help="Test DPI desync against domain")
    p_zap_test.add_argument("domain", help="Domain to test")
    p_zap_test.add_argument("--strategy", help="Optional strategy")

    # vpn
    p_vpn = subparsers.add_parser("vpn", help="Manage VPN outbounds")
    p_vpn_sub = p_vpn.add_subparsers(dest="subcommand")
    p_vpn_sub.add_parser("status", help="Show VPN status")
    p_vpn_node = p_vpn_sub.add_parser("set-node", help="Set active VLESS node")
    p_vpn_node.add_argument("--server", required=True, help="Server host or IP")
    p_vpn_node.add_argument("--port", default=443, help="Port")
    p_vpn_node.add_argument("--uuid", required=True, help="VLESS UUID")
    p_vpn_node.add_argument("--flow", default="xtls-rprx-vision", help="Flow")
    p_vpn_node.add_argument("--sni", help="SNI mask")
    p_vpn_node.add_argument("--pubkey", help="Reality public key")
    p_vpn_node.add_argument("--shortid", help="Reality short ID")
    p_vpn_node.add_argument("--fingerprint", default="firefox", help="uTLS fingerprint")

    # killswitch
    p_ks = subparsers.add_parser("killswitch", help="Control emergency VPN KillSwitch")
    p_ks.add_argument("action", choices=["status", "on", "off", "enable", "disable"], help="KillSwitch action")
    p_ks.add_argument("--scope", choices=["vpn_devices", "all"], default="vpn_devices", help="KillSwitch scope")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    client = OrbixClient()

    try:
        if args.command == "status":
            cmd_status(client, args)
        elif args.command == "policy":
            if args.subcommand == "list":
                cmd_policy_list(client, args)
            elif args.subcommand == "add":
                cmd_policy_add(client, args)
            elif args.subcommand == "remove":
                cmd_policy_remove(client, args)
            else:
                p_pol.print_help()
        elif args.command == "device":
            if args.subcommand == "list":
                cmd_device_list(client, args)
            elif args.subcommand == "set":
                cmd_device_set(client, args)
            else:
                p_dev.print_help()
        elif args.command == "zapret":
            if args.subcommand == "status":
                cmd_zapret_status(client, args)
            elif args.subcommand == "test":
                cmd_zapret_test(client, args)
            else:
                p_zap.print_help()
        elif args.command == "vpn":
            if args.subcommand == "status":
                cmd_vpn_status(client, args)
            elif args.subcommand == "set-node":
                cmd_vpn_set_node(client, args)
            else:
                p_vpn.print_help()
        elif args.command == "killswitch":
            cmd_killswitch(client, args)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
