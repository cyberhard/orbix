# Policy-Based Routing with Zapret2 (DPI Circumvention)

This document provides a comprehensive guide to the integration between **Zapret2 (`nfqws` / `tpws`)** and OpenWrt's **Policy-Based Routing (PBR)** subsystem within the Modern Admin Panel.

---

## 1. Architectural Concept

Traditionally, policy routing directs matching traffic to physical or virtual network interfaces (such as WAN or VPN tunnels like WireGuard/Sing-box). 

In this architecture, **Zapret** is integrated as a first-class routing target alongside VPN interfaces:
- **Direct WAN:** Unmodified outbound traffic.
- **VPN Tunnels (`awg0`, `singbox`):** Traffic routed through an encrypted tunnel with a remote exit IP.
- **Zapret (`zapret`):** Traffic that exits through the direct WAN, but is intercepted on the router by the `nfqws` packet desynchronization engine. Packets (such as TLS ClientHello or QUIC Initial) are mutated (split, faked, reordered, fragmented) to fool ISP DPI / TSPU filters while preserving the local WAN IP address.

```
                              ┌──────────────────────────────────┐
                              │  Client Request (e.g. YouTube)   │
                              └────────────────┬─────────────────┘
                                               │
                                               ▼
                              ┌──────────────────────────────────┐
                              │      OpenWrt Firewall (fw4)      │
                              │     nftables prerouting hook     │
                              └────────────────┬─────────────────┘
                                               │
                     ┌─────────────────────────┴─────────────────────────┐
                     │ Match PBR Rule Target                             │
                     ├─────────────────┬────────────────┬────────────────┤
                     ▼                 ▼                ▼                ▼
             ┌──────────────┐   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
             │ Target: wan  │   │Target: awg0 │  │Target: vless│  │Target:zapret│
             └───────┬──────┘   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
                     │                 │                │                │
                     │ Direct WAN      │ WireGuard (AWG)│ Sing-box TProxy│ Intercept into
                     │ No Obfuscation  │ Tunnel Exit    │ Reality Tunnel │ NFQUEUE 200
                     │                 │                │                │
                     ▼                 ▼                ▼                ▼
                 [Internet]       [Remote VPS]     [Remote VPS]      [nfqws / tpws]
                                                                     (Desync mutation:
                                                                      fake, split, fool)
                                                                         │
                                                                         ▼
                                                                     [Local WAN ISP]
```

---

## 2. Kernel & Firewall Mechanics (`nftables` / `fw4`)

When a rule is designated with target `interface = "zapret"`, the router's firewall engine applies specific packet marking and queue routing:

1. **IP / Domain Set Matching:**
   Domains matching the rule are resolved by `dnsmasq` and added to an nftables set (e.g. `@zapret_hosts`):
   ```nft
   set zapret_hosts {
       type ipv4_addr
       flags interval, timeout
   }
   ```

2. **NFQUEUE Steering Hook:**
   Packets destined for IPs in the set on TCP port 80/443 or UDP port 443/50000-65535 are steered into the Netfilter userspace queue `200`:
   ```nft
   chain pbr_prerouting {
       type filter hook prerouting priority mangle; policy accept;
       ip daddr @zapret_hosts tcp dport { 80, 443 } queue num 200 bypass
       ip daddr @zapret_hosts udp dport { 443, 50000-65535 } queue num 200 bypass
   }
   ```

3. **`nfqws` Packet Processing:**
   The `nfqws` daemon listens on queue 200:
   ```bash
   nfqws --qnum=200 --dpi-desync=fake,disorder --dpi-desync-split-pos=2 \
         --dpi-desync-fooling=md5sig,badseq --dpi-desync-repeats=2 \
         --dpi-desync-fake-tls=/opt/zapret/files/fake/tls_clienthello_iana_org.bin
   ```
   - If an SNI matches the target hostlist, `nfqws` injects desync payloads and releases mutated packets to the WAN gateway.
   - Non-matching packets pass through transparently with minimal overhead.

---

## 3. UCI Configuration Schema (`/etc/config/pbr`)

In OpenWrt's `/etc/config/pbr`, policies targeting Zapret are represented as:

```ini
config policy
    option name 'DPI Bypass (YouTube / Discord / Notion) -> Zapret2'
    option enabled '1'
    option dest_addr 'youtube.com googlevideo.com ytimg.com discord.com discordapp.com notion.so'
    option proto 'tcp udp'
    option interface 'zapret'
```

---

## 4. Configuring via the Modern Admin Panel

1. Open the **Policy Routing (PBR)** tab in the sidebar (`Маршрутизация (PBR)` in Russian).
2. Review the active Zapret banner:
   > **Движок Zapret2 интегрирован в маршрутизацию:** Трафик целевых доменов/IP направляется в очередь nfqws (nfqueue 200) для десинхронизации DPI.
3. In the **Routing Policies** table, add a new rule:
   - **Rule Name:** e.g. `Discord Voice & Video -> Zapret`
   - **Dest Domains / IP / Ports:** e.g. `discord.gg discord-media.net`
   - **Target Outbound:** Select `Zapret (DPI обход nfqws/tpws)`.
4. Click the `+` button.
5. In the floating UCI bar at the bottom, click **Save & Apply** (`Сохранить и применить`).

---

## 5. Verification & Live Route Tracing

You can verify how traffic resolves in real-time using either the web UI or ubus:

### Web UI Interactive Route Checker
Enter `youtube.com` into the **Interactive Route Checker & Packet Tracer** and click **Trace Route** (`Трассировать маршрут`). The panel displays:
- **Resolved IP:** `142.250.180.206`
- **Matched PBR Rule:** `DPI Bypass (YouTube / Discord / Notion) -> Zapret2`
- **Outbound Gateway:** Purple badge `Zapret (DPI Bypass)`
- **Next Hop / TProxy:** `nfqws queue 200 (packet desync)`

### Verification via Ubus CLI
```bash
ubus call circumvention pbr_trace '{"target":"youtube.com"}'
```
Output:
```json
{
  "target": "youtube.com",
  "ip": "142.250.180.206",
  "rule": "DPI Bypass (YouTube / Discord / Notion) -> Zapret2",
  "interface": "zapret",
  "nexthop": "nfqws queue 200 (packet desync)"
}
```

### Verification via MCP Tool
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"trace_pbr_route","arguments":{"target":"youtube.com"}}}' | npm run mcp
```
