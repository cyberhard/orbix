// Subscription parser: sing-box/Xray JSON, base64 blob, or raw link lists.
// Protocols: vless(+reality), trojan, shadowsocks (SIP002 & legacy),
// hysteria2, vmess. Mirrored by the router-side ucode parser in
// rpcd-circumvention.sh (sub_refresh) for offline cron updates.
import type { NodeSpec } from "./types";

function b64(s: string): string {
  const clean = String(s || "").replace(/\s+/g, "");
  if (!clean) return "";
  const g = globalThis as unknown as {
    Buffer?: { from: (b: string, e: "base64") => { toString(e: "utf8"): string } };
    atob?: (b: string) => string;
  };
  try {
    if (g.Buffer) return g.Buffer.from(clean, "base64").toString("utf8");
    if (g.atob) {
      const bin = g.atob(clean);
      try {
        return decodeURIComponent(encodeURIComponent(bin).replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))));
      } catch {
        return bin;
      }
    }
  } catch {
    return "";
  }
  return "";
}

function parseQuery(qs: string): Record<string, string> {
  const p: Record<string, string> = {};
  for (const kv of qs.split("&")) {
    const eq = kv.indexOf("=");
    if (eq > 0) p[kv.slice(0, eq)] = decodeURIComponent(kv.slice(eq + 1));
  }
  return p;
}

function splitName(raw: string): { main: string; name: string } {
  const h = raw.indexOf("#");
  if (h < 0) return { main: raw, name: "" };
  let name = raw.slice(h + 1);
  try {
    name = decodeURIComponent(name);
  } catch {
    /* keep raw */
  }
  return { main: raw.slice(0, h), name };
}

function hostPort(hp: string): { host: string; port: number } | null {
  const c = hp.lastIndexOf(":");
  if (c < 0) return null;
  const host = hp.slice(0, c).replace(/^\[|\]$/g, "");
  const port = Number(hp.slice(c + 1));
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return { host, port };
}

let autoId = 0;
const nid = (proto: string) => `${proto}-${Date.now().toString(36)}-${(autoId++).toString(36)}`;

export function parseLink(link: string): NodeSpec | null {
  const line = String(link || "").trim();
  const { main, name } = splitName(line);
  if (!main.includes("://")) return null;
  const proto = main.slice(0, main.indexOf("://")).toLowerCase();
  const rest = main.slice(main.indexOf("://") + 3);
  try {
    if (proto === "vless") {
      const at = rest.indexOf("@");
      if (at < 0) return null;
      const uuid = rest.slice(0, at);
      const qIdx = rest.indexOf("?", at);
      const hpStr = qIdx < 0 ? rest.slice(at + 1) : rest.slice(at + 1, qIdx);
      const hp = hostPort(hpStr);
      if (!hp || !uuid) return null;
      const q = parseQuery(qIdx < 0 ? "" : rest.slice(qIdx + 1));
      return {
        id: nid("vless"), name: name || `${hp.host}`, protocol: "vless", server: hp.host, port: hp.port,
        uuid, flow: q.flow || "", security: q.pbk ? "reality" : q.security === "tls" ? "tls" : "none",
        sni: q.sni || q.host || "", pbk: q.pbk || "", sid: q.sid || "", fp: q.fp || "firefox",
        insecure: q.allowInsecure === "1" || q.allowInsecure === "true",
        transport: q.type || "tcp", path: q.path || "",
      };
    }
    if (proto === "trojan") {
      const at = rest.indexOf("@");
      if (at < 0) return null;
      const password = rest.slice(0, at);
      const qIdx = rest.indexOf("?", at);
      const hpStr = qIdx < 0 ? rest.slice(at + 1) : rest.slice(at + 1, qIdx);
      const hp = hostPort(hpStr);
      if (!hp || !password) return null;
      const q = parseQuery(qIdx < 0 ? "" : rest.slice(qIdx + 1));
      return {
        id: nid("trojan"), name: name || hp.host, protocol: "trojan", server: hp.host, port: hp.port,
        password, sni: q.sni || q.peer || q.host || "", fp: q.fp || "",
        insecure: q.allowInsecure === "1" || q.allowInsecure === "true", transport: q.type || "tcp", path: q.path || "",
      };
    }
    if (proto === "ss" || proto === "ss2022" || proto === "shadowsocks") {
      let method = "", password = "", hpStr = "";
      const qIdx = rest.indexOf("?");
      const qs = qIdx >= 0 ? rest.slice(qIdx + 1) : "";
      const body = qIdx >= 0 ? rest.slice(0, qIdx) : rest;
      const at = body.indexOf("@");
      if (at >= 0 && !body.slice(0, at).includes(":")) {
        // SIP002: b64(method:password)@host:port
        const info = b64(body.slice(0, at));
        const ci = info.indexOf(":");
        if (ci < 0) return null;
        method = info.slice(0, ci);
        password = info.slice(ci + 1);
        hpStr = body.slice(at + 1);
      } else if (at < 0) {
        // legacy: b64(method:password@host:port)
        const info = b64(body);
        const ci = info.indexOf("@");
        if (ci < 0) return null;
        const cred = info.slice(0, ci);
        hpStr = info.slice(ci + 1);
        const mIdx = cred.indexOf(":");
        if (mIdx < 0) return null;
        method = cred.slice(0, mIdx);
        password = cred.slice(mIdx + 1);
      } else {
        // plain method:password@host:port
        const cred = body.slice(0, at);
        const mIdx = cred.indexOf(":");
        if (mIdx < 0) return null;
        method = cred.slice(0, mIdx);
        password = cred.slice(mIdx + 1);
        hpStr = body.slice(at + 1);
      }
      const hp = hostPort(hpStr);
      if (!hp || !method || !password) return null;
      const q = parseQuery(qs);
      return {
        id: nid("ss"), name: name || hp.host, protocol: "ss", server: hp.host, port: hp.port,
        method, password, sni: q.sni || q.obfs || "",
      };
    }
    if (proto === "hysteria2" || proto === "hy2") {
      const at = rest.indexOf("@");
      if (at < 0) return null;
      const password = decodeURIComponent(rest.slice(0, at));
      const qIdx = rest.indexOf("?", at);
      const hpStr = qIdx < 0 ? rest.slice(at + 1) : rest.slice(at + 1, qIdx);
      const hp = hostPort(hpStr);
      if (!hp || !password) return null;
      const q = parseQuery(qIdx < 0 ? "" : rest.slice(qIdx + 1));
      return {
        id: nid("hysteria2"), name: name || hp.host, protocol: "hysteria2", server: hp.host, port: hp.port,
        password, sni: q.sni || q.peer || "",
        insecure: q.insecure === "1" || q.insecure === "true",
      };
    }
    if (proto === "vmess") {
      const j = JSON.parse(b64(rest) || "{}") as Record<string, string | number>;
      const host = String(j.add || "");
      const port = Number(j.port) || 0;
      if (!host || !port || !j.id) return null;
      return {
        id: nid("vmess"), name: name || String(j.ps || host), protocol: "vmess", server: host, port,
        uuid: String(j.id), security: String(j.tls || "") === "tls" ? "tls" : "none",
        sni: String(j.sni || j.host || ""),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export interface SubParseResult {
  nodes: NodeSpec[];
  skipped: number;
  format: "singbox-json" | "links" | "base64-links" | "unknown";
}

const SUP = /:\/\//;

export function parseSubscription(body: string): SubParseResult {
  const raw = String(body || "").trim();
  if (!raw) return { nodes: [], skipped: 0, format: "unknown" };

  // 1) sing-box / clash client JSON
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const doc = JSON.parse(raw) as Record<string, unknown>;
      const arr = Array.isArray(doc) ? doc : (doc.outbounds as Record<string, unknown>[]) ?? [doc];
      const nodes: NodeSpec[] = [];
      let skipped = 0;
      for (const ob of arr) {
        const list = Array.isArray(ob) ? ob : [ob];
        for (const oRaw of list) {
          const o = oRaw as Record<string, unknown>;
          const proto = String(o.type || o.protocol || "");
          const server = String(o.server || o.address || "");
          const port = Number(o.server_port ?? o.port ?? 0);
          const name = String(o.name || o.tag || o.remarks || server);
          if (!server || !port) { skipped++; continue; }
          if (proto === "vless") {
            const tls = (o.tls ?? {}) as Record<string, unknown>;
            const reality = (tls.reality ?? {}) as Record<string, unknown>;
            nodes.push({
              id: nid("vless"), name, protocol: "vless", server, port,
              uuid: String(o.uuid || ""), flow: String(o.flow || ""),
              security: reality.enabled || reality.public_key ? "reality" : tls.enabled ? "tls" : "none",
              sni: String((tls.server_name as string) || ""),
              pbk: String(reality.public_key || ""), sid: String(reality.short_id || ""),
              fp: String(((tls.utls as Record<string, unknown>)?.fingerprint as string) || "firefox"),
            });
          } else if (proto === "trojan") {
            const tls = (o.tls ?? {}) as Record<string, unknown>;
            nodes.push({ id: nid("trojan"), name, protocol: "trojan", server, port, password: String(o.password || ""), sni: String(tls.server_name || ""), insecure: !!tls.insecure });
          } else if (proto === "shadowsocks" || proto === "ss") {
            nodes.push({ id: nid("ss"), name, protocol: "ss", server, port, method: String(o.method || ""), password: String(o.password || "") });
          } else if (proto === "hysteria2") {
            const tls = (o.tls ?? {}) as Record<string, unknown>;
            nodes.push({ id: nid("hysteria2"), name, protocol: "hysteria2", server, port, password: String(o.password || ""), sni: String(tls.server_name || ""), insecure: !!tls.insecure });
          } else skipped++;
        }
      }
      return { nodes, skipped, format: nodes.length ? "singbox-json" : "unknown" };
    } catch {
      /* fall through to links */
    }
  }

  // 2) raw link list
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.some((l) => SUP.test(l))) {
    return collectLinks(lines);
  }
  // 3) base64 blob of links
  const dec = b64(raw);
  if (SUP.test(dec)) return collectLinks(dec.split("\n").map((l) => l.trim()).filter(Boolean));
  return { nodes: [], skipped: lines.length, format: "unknown" };
}

function collectLinks(lines: string[]): SubParseResult {
  const nodes: NodeSpec[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  for (const l of lines) {
    const n = parseLink(l);
    if (!n) { skipped++; continue; }
    const key = `${n.server}:${n.port}:${n.protocol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nodes.push(n);
  }
  return { nodes, skipped, format: nodes.length ? "links" : "unknown" };
}
