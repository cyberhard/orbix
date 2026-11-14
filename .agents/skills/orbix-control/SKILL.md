---
name: orbix-control
description: Rapid configuration, telemetry, and live management of OpenWrt ORBIX panel, Policy-Based Routing (PBR), Zapret2 DPI circumvention, Sing-box VLESS Reality, and AmneziaWG via native MCP tools and CLI. Use when configuring routing policies, adding domains to proxy/direct lists, changing Zapret strategies, switching VPN nodes, assigning device routes, or checking router health.
---

# ORBIX OpenWrt Fast Configuration & Policy Management

This skill enables rapid, zero-downtime management of the **ORBIX OpenWrt Platform** running on the local router (`http://192.168.1.1`). It controls the native OpenWrt Policy Engine, Zapret2 DPI circumvention (`nfqws`), Sing-box (`tun` VLESS Reality), and AmneziaWG (`awg0`).

---

## 1. Quick Decision Matrix

| Task | Primary Method (MCP) | Fast CLI Alternative |
| :--- | :--- | :--- |
| **Check System & Routing Status** | `get_system_info`, `get_policies` | `orbix-ctl.py status` |
| **Add Domain to VPN Proxy** | `apply_policies(proxy_domains=[...])` | `orbix-ctl.py policy add <domain> --target proxy` |
| **Add Domain to Direct WAN / RuNet** | `apply_policies(direct_domains=[...])` | `orbix-ctl.py policy add <domain> --target direct` |
| **Block / Sinkhole Domain** | `apply_policies(blocked_domains=[...])` | `orbix-ctl.py policy add <domain> --target block` |
| **Assign Device to VPN / Direct** | `set_device_routing(ip, interface)` | `orbix-ctl.py device set --ip <ip> --target <iface>` |
| **Switch Active VLESS Reality Node** | `set_singbox_outbound(server, uuid, ...)` | `orbix-ctl.py vpn set-node --server ... --uuid ...` |
| **Test VLESS Node Ping / Handshake** | `test_singbox_node(server, port)` | `orbix-ctl.py vpn status` |
| **Import AmneziaWG Config** | `import_amneziawg(conf, apply=true)` | `ubus call circumvention awg_import_conf ...` |
| **Toggle Emergency KillSwitch** | `set_killswitch(enabled, scope)` | `orbix-ctl.py killswitch on/off` |
| **Test Zapret2 DPI Strategy** | `test_zapret_strategy(domain, methods)` | `orbix-ctl.py zapret test <domain>` |
| **Arm Zero-Lockout Watchdog** | `arm_rollback(timeout=75)` | `ubus call circumvention arm_rollback` |

---

## 2. Using the ORBIX CLI Helper (`orbix-ctl.py`)

A zero-dependency standalone CLI tool is bundled at:
`scripts/orbix-ctl.py` (or `/home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py`).

### CLI Usage:

```bash
# 1. Overall router, Zapret, VPN, and policy telemetry
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py status

# 2. List all active domain routing rules
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py policy list

# 3. Add domain to VLESS Reality proxy
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py policy add chatgpt.com --target proxy

# 4. Add domain to Direct WAN & Yandex DNS (bypasses VPN)
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py policy add kinopoisk.ru --target direct

# 5. Remove domain from policies
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py policy remove oldsite.com

# 6. List per-device routing policies
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py device list

# 7. Route a specific device (e.g. Phone 192.168.1.195) through Sing-box
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py device set --ip 192.168.1.195 --target singbox

# 8. Route a Smart TV directly through WAN
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py device set --ip 192.168.1.170 --name "Xiaomi TV" --target wan

# 9. Test Zapret DPI desync against YouTube / Discord
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py zapret test googlevideo.com

# 10. Switch active VLESS Reality node
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py vpn set-node \
  --server "node.liberty-nodes.online" \
  --port 8443 \
  --uuid "a487d472-ac9f-4cd5-b7bd-aadfb2d5ae9d" \
  --sni "ticket.rzd.ru" \
  --pubkey "DyaJbQTstATDS6roBW3zGNndY4NmGmGiO0Nxr-pD4gU" \
  --shortid "73f22a22c6d98dc9"

# 11. Manage KillSwitch
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py killswitch status
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py killswitch on --scope vpn_devices
python3 /home/quasar/.gemini/config/skills/orbix-control/scripts/orbix-ctl.py killswitch off
```

---

## 3. Using the ORBIX MCP Server (`openwrt-router`)

The MCP server is registered in `mcp.json` and runs via `npx tsx mcp-server/src/index.ts`. It provides structured tool execution for agents.

### Example MCP Workflows:

#### Workflow A: Dynamic Routing of Blocked Services
1. Inspect currently active policies using `get_policies`.
2. Append the blocked domain (e.g., `notion.so` or `claude.ai`) to `proxy_domains`.
3. Call `apply_policies` with the updated list.
4. Verify routing with `trace_pbr_route(target="notion.so")`.

#### Workflow B: Zero-Lockout Watchdog Safeguard
When modifying critical network or firewall settings:
1. Call `arm_rollback(timeout=75)`.
2. Apply changes via `set_device_routing` or `apply_uci_changes`.
3. Test connectivity (ping, DNS resolution).
4. If healthy, call `confirm_rollback()`. If the router crashes or drops connection, changes automatically revert after 75s.

---

## 4. Hard Constraints & Best Practices

1. **Domestic RuNet Protection:** Never route Russian domestic banking (`sberbank.ru`, `tbank.ru`, `vtb.ru`), state services (`gosuslugi.ru`), or Russian media (`*.yandex.ru`, `*.yandex.net`, `vk.com`) into foreign VPN proxies. They geoblock non-Russian IPs and must stay in `direct_domains`.
2. **Discord WebRTC Voice:** Discord voice and WebRTC RTP media run over UDP ports `50000-65535` directly to Discord CIDRs (`66.22.192.0/18`, `162.159.128.0/20`). These CIDRs must remain explicitly proxied in `sing-box` route rules.
3. **Zapret vs. VLESS:** Zapret operates directly on the ISP WAN interface via raw packet desync (`hostfakesplit`, `multisplit`). It works for TCP/TLS SNI throttling (YouTube). If an IP or protocol is completely dropped by BGP null-route (like Discord voice UDP on some ISPs), it must be routed via VLESS or AmneziaWG instead of Zapret.
