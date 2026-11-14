# ORBIX • Autonomous Engineering Standards & Architecture Rules
**Location:** `/AGENTS.md` & `.agents/rules/orbix-standards.md`  
**Applies To:** All autonomous agents, sub-agents, and developers contributing to `cyberhard/orbix`

---

## 1. Core Architecture & Philosophy

1. **Native OpenWrt Integration (Zero Mocks / Zero Stubs):**
   - ORBIX communicates directly with native OpenWrt subsystems: `ubus` (JSON-RPC), `UCI` configuration files, `sysfs`, and `/usr/libexec/rpcd/circumvention`.
   - Never introduce mock data generators or fake stubs in production paths. All hardware metrics, interfaces, Wi-Fi radios, and clients must derive from live ubus queries.

2. **Embedded Hardware Constraints (Flash & RAM Budgets):**
   - Target devices range from 16MB flash / 128MB RAM budget devices to 256MB flash / 1GB RAM flagship routers (MediaTek Filogic 820/830, x86_64, Qualcomm IPQ).
   - **Bundle Size Budget:** The production bundle in `dist/` must stay below **150 KB gzipped**.
   - **No Heavy 3D / Animation Libraries:** Libraries such as Three.js, D3.js, Lottie, or Framer Motion are **strictly prohibited**. Visual diagrams must use lightweight pure SVG and CSS transforms.
   - **Zero Router-Side Runtimes:** The router runs only standard `uhttpd` / `rpcd` / `ash`. Do not introduce NodeJS, Python, or Go binaries on the router side.

3. **Verification Protocol:**
   - Before completing any task, you must run and verify:
     ```sh
     npm test -- --run && npm run build
     ```
   - 100% of test suites must pass with zero failures and zero unhandled rejections.

---

## 2. Design System: Strict shadcn/ui Zinc

ORBIX adheres to a restrained, utilitarian, industrial hardware appliance aesthetic:

1. **Color Palette:**
   - Dark background: `bg-zinc-950` (`#09090b`)
   - Card surfaces: `bg-zinc-900/50` or `bg-zinc-950` with crisp `1px` `border-zinc-800` (`#27272a`)
   - Text hierarchy: High-contrast `text-zinc-100` for titles, `text-zinc-400` for body, `text-zinc-500` for captions
   - **No Loud Gradients:** Multi-color rainbow gradients (`from-purple-500 to-pink-500`) are strictly banned. Use subtle neutral tone shifts (`bg-zinc-900/40`) or translucent overlays.
2. **Semantic Status Indicators:**
   - Muted, low-opacity status pills:
     - Online / Success: `bg-emerald-500/10 text-emerald-400 border-emerald-500/20`
     - Warning / Syncing: `bg-amber-500/10 text-amber-400 border-amber-500/20`
     - Error / Down: `bg-rose-500/10 text-rose-400 border-rose-500/20`
3. **Typography & Monospace Rules:**
   - All IP addresses, MAC addresses, interface names (`phy0.1-ap0`, `br-lan`, `tun0`), port numbers, checksums, and terminal outputs **must strictly use** `font-mono tabular-nums`.

---

## 3. Product & UX: Persistent Simple vs. Expert Modes

All screens must conditionally adapt their complexity based on `usePolicyStore.getState().operatingMode`:

1. **Simple Mode (Consumer / Family Users):**
   - Mental model: *Intent-based*. Users choose what they want to achieve, not the underlying Linux mechanism.
   - Hide low-level kernel abstractions: raw device interfaces (`phy0.1-ap0`), `iproute2` table IDs, raw `nftables` sets, and WireGuard handshake timestamps.
   - Surface 1-click presets: YouTube 1080p/4K bypass, Discord voice unblock, RuNet Direct bypass, Smart Wi-Fi unified SSID with Band Steering, and 1-click full JSON backups.
2. **Expert Mode (Network Engineers):**
   - Mental model: *Direct imperative control*.
   - Expose granular parameters: raw PBR routing rules, fwmark values, Zapret2 `nfqws` queue numbers, AmneziaWG obfuscation parameters ($J_c, J_{min}, J_{max}, S_1, S_2, H_1-H_4$), VLESS Reality flow (`xtls-rprx-vision`), and raw `ubus` JSON inspection modals.

---

## 4. Backend & Security Protocols

1. **RPC ACL Isolation (`rpcd-circumvention-acl.json`):**
   - Never expose destructive methods to unauthenticated or read-only sessions.
   - Write actions (`zapret_restart`, `apply_policies`, `awg_save_config`, `sub_get_cache`) must remain in the `write` permission group.
2. **Watchdog & Rollback Protection:**
   - Any commit affecting firewall zones, network interfaces, or default routes must arm a 75-second rollback watchdog.
   - Calling `confirmRollback()` must synchronize with both `circumvention confirm_rollback` and OpenWrt native `uci confirm`.
3. **Shell Script Hardening (`rpcd-circumvention.sh`, `install.sh`):**
   - Always sanitize variables passed to `uci set` or `sing-box`.
   - Prevent command injection: never evaluate untrusted strings in `eval` or execute unsanitized URL downloads without `--proto =http,https`.
   - SSRF protection: block loopback and RFC1918 addresses in curl subscription fetchers.
4. **Cryptographic Standards:**
   - Configuration exports with secrets must use Web Crypto API `PBKDF2` (100,000 iterations, SHA-256) and `AES-256-GCM` with a 128-bit authentication tag.
