# ORBIX — Developer & Contributor Guide

## 1. Development Environment Setup

ORBIX is built with **React 19**, **TypeScript**, **Tailwind CSS**, and **Vite 8**, adhering strictly to the **shadcn/ui zinc** design system.

### 1.1 Requirements
- Node.js 20+ / 22+
- npm 10+
- Access to an OpenWrt router (or local OpenWrt VM / container) for live testing.

### 1.2 Local Setup
```sh
# Clone repository
git clone https://github.com/cyberhard/orbix.git
cd orbix

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

The Vite dev server proxies `/ubus` calls to `http://192.168.1.1` by default (configurable in `vite.config.ts`).

---

## 2. Testing Guidelines

Automated testing is mandatory for all new features and bug fixes:

```sh
# Run Vitest test suite
npm test
```

Test files reside in `tests/`:
- `tests/policy-engine.test.ts`: Policy compilation, category resolution, shadowing conflicts.
- `tests/config-management.test.ts`: Schema validation, backward compatibility, crypto, and migrator.
- `tests/hal.test.ts`: Hardware architecture classification and capability probing.
- `tests/security-validation.test.ts`: Input sanitization, port limits, and regex whitelisting.

---

## 3. Architecture Conventions

1. **No LuCI Lock-in**: Never call `luci-rpc` methods without providing a native OpenWrt fallback (using `file.read`, `network.wireless`, `iwinfo`, or `/proc/net/arp`).
2. **Strict Design Tokens**: Maintain the `shadcn/ui zinc` aesthetic. Never introduce colorful rainbow gradients, neon glows, or non-semantic saturated backgrounds.
3. **Safe Command Execution**: In backend shell scripts, never use `eval` or string concatenation without strict regex whitelisting.
4. **Deterministic Rollbacks**: Any action modifying network or firewall configuration must be wrapped in `arm_rollback` with PID tracking.
5. **Type Safety**: Maintain strict TypeScript typing. Do not use `any` when a domain model exists.
