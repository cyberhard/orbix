# ORBIX — Core API Specification

## 1. Protocol & Transport

ORBIX communicates with the underlying OpenWrt system via JSON-RPC 2.0 over HTTP:
- **Endpoint**: `/ubus` (or `/cgi-bin/luci/rpc/ubus` on legacy LuCI systems)
- **Content-Type**: `application/json`
- **Standard Envelope**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "call",
    "params": ["<SESSION_ID>", "<OBJECT>", "<METHOD>", { ... }]
  }
  ```

---

## 2. Core RPC Objects

### 2.1 `session` (Authentication)
- **`login`**: Authenticates user against `/etc/shadow` and returns a 32-character session token.
  - Params: `{ "username": "root", "password": "<password>", "timeout": 86400 }`
- **`destroy`**: Terminates the active session.
  - Params: `{}`

### 2.2 `system` (Hardware & System Metrics)
- **`board`**: Retrieves hardware model, SoC, architecture, kernel, and OpenWrt release.
- **`info`**: Retrieves current uptime, memory metrics, and `/overlay` storage statistics.
- **`reboot`**: Reboots the router.

### 2.3 `file` (Native LuCI Independence Fallbacks)
- **`read`**: Reads local files (used to read `/tmp/dhcp.leases` and `/proc/net/arp` natively).
  - Params: `{ "path": "/tmp/dhcp.leases" }`
- **`stat`**: Checks file existence and permissions.

### 2.4 `network.interface` & `network.device` (Interface Management)
- **`dump`**: Lists all active and inactive network interfaces and IP addresses.
- **`status`**: Retrieves device-level RX/TX bytes and packet counters.

### 2.5 `network.wireless` & `iwinfo` (Wireless Management)
- **`status`**: Native netifd wireless radio and interface status.
- **`scan`**: Performs active Wi-Fi channel scan via `iwinfo`.
  - Params: `{ "device": "phy0.0-ap0" }`

### 2.6 `uci` (Unified Configuration Interface)
- **`get`**: Reads section values from `/etc/config/*`.
  - Params: `{ "config": "network", "section": "lan" }`
- **`set`**: Modifies or adds a configuration option.
- **`commit`**: Persists staged changes to disk.
- **`changes`**: Lists all uncommitted changes.

---

## 3. Custom ORBIX Backend: `circumvention` Object

Provided by `/usr/libexec/rpcd/circumvention` with strict ACL permissions:

| Method | Access | Parameters | Description |
|---|---|---|---|
| `zapret_status` | Read | `{}` | Returns NFQWS process status, active profiles, and hostlists. |
| `zapret_test_strategy` | Read | `{ "domain": "youtube.com" }` | Performs real TLS handshake probe measuring TCP connect, TLS time, and HTTP status. |
| `vless_status` | Read | `{}` | Returns Sing-box VLESS reality tunnel status and active node info. |
| `singbox_test_node` | Read | `{ "server": "1.2.3.4", "port": 443 }` | Probes TCP latency to remote VPN node. |
| `pbr_status` | Read | `{}` | Returns active Policy Based Routing rules and routing table marks. |
| `pbr_trace` | Read | `{ "target": "domain.com" }` | Resolves target IP and traces kernel routing decision (`ip route get`). |
| `arm_rollback` | Write | `{ "timeout": 75 }` | Creates `/etc/config` snapshot and arms background watchdog timer with PID tracking. |
| `confirm_rollback` | Write | `{ "token": "..." }` | Kills watchdog process tree and disarms rollback timer. |
| `cancel_rollback` | Write | `{}` | Restores snapshot configurations immediately and reloads services. |
| `singbox_set_outbound`| Write | `{ "server": "...", "uuid": "...", "publicKey": "..." }` | Generates safe `/etc/sing-box/config.json` and restarts service. |
| `pbr_set_device_rule` | Write | `{ "ip": "192.168.1.130", "interface": "singbox", "enabled": true }` | Sets device-specific PBR rule and static DHCP reservation. |
