# ORBIX — Security Audit Report

**Report Version:** 1.0.0  
**Audit Date:** 2026-11-14  
**Classification:** Technical Security Assessment  
**Target:** ORBIX Platform (`https://github.com/cyberhard/orbix`)  
**Scope:** Backend RPCD Services, ACL Permissions, Configuration Processing, Authentication, and Zero-Lockout Watchdog.

---

## 1. Executive Summary

A comprehensive security audit of ORBIX source code and backend mechanisms was performed, focusing on embedded Linux attack vectors:
- Command and shell injection via RPC parameters.
- Parameter tampering and configuration injection.
- Privilege escalation via overly broad RPCD ACLs.
- State desynchronization and race conditions in rollback watchdogs.
- Storage and transmission of cryptographic secrets and subscription URLs.

All identified vulnerabilities have been remediated with verifiable fixes and tested directly on the target embedded system.

---

## 2. Vulnerability Findings & Remediation Matrix

| ID | Vulnerability | Severity | Impact | Remediation Status |
|---|---|---|---|---|
| **SEC-01** | **Orphaned Watchdog & Race Condition in Rollback Mechanism** | **High** | Under Busybox `ash`, child background processes have `sh` as process comm. `killall uci_watchdog.sh` failed silently. If a second rollback was armed, the orphaned `sleep` expired and unexpectedly restored older configs. | **Fixed** (Track watchdog PID in `/tmp/uci_watchdog.pid`, kill child `sleep` process group on confirm/cancel). |
| **SEC-02** | **Overly Permissive RPCD ACL Permissions** | **High** | `rpcd-circumvention-acl.json` included destructive write methods (`awg_delete`, `arm_rollback`, `pbr_set_device_rule`) in the `read` permission group. | **Fixed** (Separated read vs write permissions strictly enforcing least privilege). |
| **SEC-03** | **Unsanitized Input in Network Probing (`zapret_test_strategy`, `pbr_trace`)** | **High** | Parameters `domain` and `target` lacked strict FQDN/IP regex validation. Could allow argument injection in curl, resolveip, or nslookup. | **Fixed** (Enforced POSIX FQDN & IPv4 regex validation; non-matching inputs rejected before execution). |
| **SEC-04** | **Unsanitized Node Parameters in `singbox_test_node`** | **Medium** | `server` and `port` inputs could contain flags or malformed ranges passed to curl. | **Fixed** (Strict host regex and integer bounds check `1 <= port <= 65535`). |
| **SEC-05** | **Configuration Injection in `singbox_set_outbound`** | **Medium** | Raw input embedded directly into JSON template via heredoc without escaping could break JSON syntax or inject directives. | **Fixed** (Strict sanitization of `SERVER`, `UUID`, `SNI`, `PUBKEY`, `SHORTID`, `FLOW`, and `FP` before generation). |
| **SEC-06** | **Escape Interpretation in `awg_import_conf`** | **Low** | `printf "%b"` was used to write WireGuard configs, interpreting escape sequences (`\c`, `\0`, etc.). | **Fixed** (Replaced with `printf "%s"`). |
| **SEC-07** | **Hardcoded Third-Party API Key in `sub_decrypt_fetch`** | **Medium** | Hardcoded Happy Decoder API key was baked into shell script. | **Fixed** (Removed hardcoded key; user-provided key required for encrypted subscriptions). |

---

## 3. Deep Dive: Remediated Issues

### 3.1 SEC-01: Zero-Lockout Watchdog Process Group Termination
**Vulnerability Details**:
When `arm_rollback` launched `sh /tmp/uci_watchdog.sh "$TOKEN" "$TIMEOUT" &`, the command `killall -q uci_watchdog.sh` was ineffective because the kernel reports the process name as `sh`. The background `sleep` subshell continued to live.

**Remediation**:
1. When launched, the script records the exact PID:
   ```sh
   sh /tmp/uci_watchdog.sh "$TOKEN" "$TIMEOUT" >/dev/null 2>&1 &
   WD_PID=$!
   echo "$WD_PID" > /tmp/uci_watchdog.pid
   ```
2. When confirming or cancelling, ORBIX discovers all child processes via `pgrep -P` and cleanly terminates both the subshell and the parent:
   ```sh
   if [ -f "/tmp/uci_watchdog.pid" ]; then
       WD_PID=$(cat /tmp/uci_watchdog.pid 2>/dev/null | tr -d ' \r\n')
       if [ -n "$WD_PID" ] && [ "$WD_PID" -gt 1 ] 2>/dev/null; then
           WD_CHILDREN=$(pgrep -P "$WD_PID" 2>/dev/null)
           [ -n "$WD_CHILDREN" ] && kill -9 $WD_CHILDREN 2>/dev/null
           kill -9 "$WD_PID" 2>/dev/null
       fi
       rm -f /tmp/uci_watchdog.pid
   fi
   ```
**Verification**: Verified on real OpenWrt kernel. Process list confirmed 100% clean termination upon confirmation.

### 3.2 SEC-02: RPCD ACL Least-Privilege Segmentation
**Remediation**:
`rpcd-circumvention-acl.json` was segmented so that read-only accounts cannot trigger mutating or destructive commands:
```json
{
  "circumvention": {
    "read": {
      "ubus": {
        "circumvention": [
          "awg_status",
          "zapret_status",
          "zapret_test_strategy",
          "vless_status",
          "singbox_test_node",
          "podkop_status",
          "pbr_status",
          "pbr_trace"
        ]
      }
    },
    "write": {
      "ubus": {
        "circumvention": [
          "awg_genkey",
          "awg_import_conf",
          "awg_delete",
          "podkop_update",
          "arm_rollback",
          "confirm_rollback",
          "cancel_rollback",
          "sub_decrypt_fetch",
          "singbox_set_outbound",
          "pbr_set_device_rule",
          "wifi_reload"
        ]
      }
    }
  }
}
```

### 3.3 SEC-03 & SEC-04: Strict Input Validation in RPCD Backend
All incoming user parameters are validated against strict whitelists before execution:
- **Domains & Hostnames**: `^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`
- **IPv4 Addresses**: `^([0-9]{1,3}\.){3}[0-9]{1,3}$`
- **MAC Addresses**: `^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$`
- **Port Numbers**: Validated integer range `1 <= port <= 65535`
- **Device Names**: Stripped to `[a-zA-Z0-9 _-]` only, preventing command substitution or UCI option injection.

---

## 4. Residual Risks & Next Steps
- **Web Session Storage**: The ubus session ID is stored in browser `localStorage`. To protect against potential XSS in third-party dependencies, Content-Security-Policy (CSP) headers should be enabled on the web server (`uhttpd`).
- **Encrypted Exports**: When exporting network configurations, users must be strongly advised to enable password-based AES-GCM encryption if sensitive WireGuard private keys or VLESS credentials are included.
