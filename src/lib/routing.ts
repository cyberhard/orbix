// ORBIX • Route canonicalization — maps every historical hash route onto the
// 14-section hub layout, preserving `?tab=` deep links (imported by MainLayout and tests).

const CANONICAL_BASES = new Set([
  "overview", "clients", "policies", "vpn", "zapret", "kid",
  "interfaces", "wireless", "dhcp", "firewall",
  "diagnostics", "services", "software", "settings",
]);

// Every historical alias (and last-segment fallback) -> old base token
const ALIAS: Record<string, string> = {
  // Overview & status
  "overview": "overview", "status": "overview",
  "bandwidth": "bandwidth", "graphs": "bandwidth", "realtime": "bandwidth",
  // Clients & map
  "clients": "clients", "devices": "clients", "leases": "clients",
  "traffic": "traffic", "flow": "traffic", "topology": "traffic",
  // Routing
  "policies": "policies", "policy": "policies", "rules": "policies", "policy-rules": "policies",
  "routing-tiers": "routing-tiers", "tiers": "routing-tiers", "tier-engine": "routing-tiers",
  "lists": "lists", "categories": "lists", "feeds": "lists",
  "pbr": "pbr",
  // VPN
  "vpn": "vpn", "vpns": "vpn", "vpn-manager": "vpn",
  "subscriptions": "subscriptions", "subs": "subscriptions", "sub": "subscriptions", "happ": "subscriptions",
  "zapret": "zapret",
  "podkop": "podkop",
  // Network
  "interfaces": "interfaces", "vlans": "interfaces",
  "wireless": "wireless", "wifi": "wireless",
  "dhcp": "dhcp", "dhcp-dns": "dhcp",
  "dns": "dns", "smartdns": "dns", "dns-routing": "dns",
  "firewall": "firewall", "fw": "firewall", "firewall-rules": "firewall",
  // Diagnostics & logs
  "diagnostics": "diagnostics", "diag": "diagnostics",
  "explain": "explain", "why": "explain", "diagnose-route": "explain",
  "logs": "logs", "syslog": "logs",
  // System
  "general": "general", "settings": "settings",
  "admin": "admin", "ssh": "admin", "password": "admin",
  "software": "software", "packages": "software", "opkg": "software", "apk": "software",
  "services": "services", "startup": "services", "init": "services",
  "tasks": "tasks", "cron": "tasks", "crontab": "tasks",
  "backup": "backup", "flash": "backup", "restore": "backup",
  "install": "install", "catalog": "install", "firmware": "install", "devices-catalog": "install",
  // Misc
  "kid": "kid", "wizard": "wizard", "setup": "wizard",
};

// Old bases consolidated into hubs; value may carry a default tab query.
const REDIRECT: Record<string, string> = {
  "bandwidth": "overview",
  "traffic": "clients",
  "explain": "diagnostics?tab=explain",
  "logs": "diagnostics?tab=logs",
  "routing-tiers": "policies?tab=tiers",
  "pbr": "policies?tab=pbr",
  "lists": "policies?tab=lists",
  "dns": "dhcp?tab=dns",
  "subscriptions": "vpn?tab=subscriptions",
  "podkop": "services?tab=podkop",
  "tasks": "services?tab=cron",
  "general": "settings?tab=general",
  "admin": "settings?tab=admin",
  "backup": "settings?tab=backup",
  "install": "settings?tab=install",
};

/** Resolve any raw hash path ("network/firewall", "routing-tiers", ...) to canonical "route?query". */
export function canonicalizeHash(rawPath: string): string {
  const segments = rawPath.split("/").filter(Boolean);
  if (segments.length === 0) return "overview";
  const full = segments.join("/").toLowerCase();
  const last = segments[segments.length - 1].toLowerCase();

  let base = ALIAS[full] || ALIAS[last] || full;

  if (base === "wizard") return "wizard";

  // Keep any explicit tab query from the incoming hash (already applied by caller via merge)
  const redirectTarget = REDIRECT[base];
  if (redirectTarget) base = redirectTarget;
  else if (base === "settings") base = "settings?tab=general";
  else if (!CANONICAL_BASES.has(base)) base = "overview";

  return base;
}

/** Full canonical hash (with query and tab) for a raw location.hash; never returns leading "#". */
export function canonicalHashFromLocation(hash: string): string {
  let raw = hash.replace(/^#\/?/, "").trim();
  const [pathPart, queryPart] = raw.split("?");
  const base = canonicalizeHash(pathPart);
  if (base === "wizard") return "wizard";
  const [route, redirectQuery] = base.split("?");
  const incoming = new URLSearchParams(queryPart || "");
  const merged = new URLSearchParams(redirectQuery || "");
  // An explicit ?tab= in the source URL always wins over the redirect default
  const incomingTab = incoming.get("tab");
  if (incomingTab) merged.set("tab", incomingTab);
  for (const [k, v] of incoming.entries()) if (k !== "tab" && !merged.has(k)) merged.set(k, v);
  const qs = merged.toString();
  return qs ? `${route}?${qs}` : route;
}

