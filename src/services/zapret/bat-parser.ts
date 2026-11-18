// Parser for zapret Windows launch scripts (.bat) from Flowseal/zapret-discord-youtube.
// Converts winws.exe (Linux nfqws-compatible) invocations into OpenWrt zapret
// NFQWS_OPT text + port lists + referenced file inventory. Pure functions, unit tested.

export interface BatFileRef {
  option: string;
  basename: string;
  routerPath: string;
  kind: "list" | "payload";
  status: "router_exists" | "uploaded" | "missing";
  domainCount?: number;
}

export interface ParsedZapretBat {
  engine: "winws" | "nfqws" | "winhost" | "badpin" | "unknown";
  portsTcp: string;
  portsUdp: string;
  sections: string[][];
  nfqwsOpt: string;
  fileRefs: BatFileRef[];
  warnings: string[];
  needsUpload: string[];
  companionDomains: Record<string, string[]>;
  inlineComment: string;
}

const ENGINE_RE = /(winws|nfqws|winhost|badpin)(\.exe)?$/i;
const FILE_OPTS = new Set([
  "--hostlist",
  "--hostlist-exclude",
  "--hostlist-mac",
  "--hostlist-auto",
  "--ipset",
  "--ipset-exclude",
]);
const PAYLOAD_OPT_RE = /^--dpi-desync-fake/;
const LIST_DIR = "/opt/zapret/ipset";
const FAKE_DIR = "/opt/zapret/files/fake";

function stripQuotes(t: string): string {
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

function tokenize(line: string): string[] {
  // Char scanner that understands quotes mixed into a single argument:
  //   --hostlist="lists\list general.txt"  ->  --hostlist=lists\list general.txt
  const out: string[] = [];
  let cur = "";
  let seen = false;
  for (const c of line) {
    if (c === '"' || c === "'") {
      seen = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (seen || cur) {
        out.push(cur);
        cur = "";
        seen = false;
      }
      continue;
    }
    cur += c;
    seen = true;
  }
  if (seen || cur) out.push(cur);
  return out;
}

function expandVars(blockLines: string[], warnings: string[]): string[] {
  const vars: Record<string, string> = {};
  const setRe = /^set\s+["']?([A-Za-z_][A-Za-z0-9_]*)=([^"'"]*)["']?/i;
  for (const l of blockLines) {
    const m = l.match(setRe);
    if (m) vars[m[1].toUpperCase()] = m[2];
  }
  // known harmless substitutions -> "" with a single aggregated warning
  const dropped = new Set<string>();
  const subst = (s: string): string => {
    let out = s;
    for (let i = 0; i < 5; i++) {
      const prev = out;
      out = out
        .replace(/%~dp0/g, "")
        .replace(/%~n0/g, "imported")
        .replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (_all, name: string) => {
          const k = name.toUpperCase();
          if (vars[k] !== undefined) return vars[k];
          if (["GAMEFILTER", "GAMEFILTERTCP", "GAMEFILTERUDP"].includes(k)) {
            dropped.add(name);
            return "";
          }
          dropped.add(name);
          return "";
        });
      if (out === prev) break;
    }
    return out;
  };
  const mapped = blockLines.map(subst);
  if (dropped.size > 0) {
    warnings.push(
      `Переменные не раскрыты (раскрыты как пусто): ${[...dropped].join(", ")}. Game-фильтры Windows в конфиг не переносятся.`
    );
  }
  return mapped;
}

function cleanPorts(v: string): string {
  return v
    .split(",")
    .map((p) => p.trim())
    .filter((p) => /^[0-9]+(-[0-9]+)?$/.test(p))
    .join(",");
}

function looksLikePath(v: string): boolean {
  return /\\/.test(v) || /^[A-Za-z]:/.test(v) || /\.(txt|lst|bin|domain|net)$/i.test(v);
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1];
}

// winhost.exe / badpin.exe -> nfqws flag translation (only mappings we are sure about)
const WINHOST_MAP: Record<string, string> = {
  "--port-tcp": "--filter-tcp",
  "--port-udp": "--filter-udp",
  "--filter": "--filter-l7",
  "--portbytes": "--filter-udp",
};
const WINHOST_DROP: Record<string, string> = {
  "--domain-set": "winhost режим домен-сет не переносится: используйте hostlist",
  "--no-ipv6": "аналог — DISABLE_IPV6 в конфиге zapret",
  "--daemon": "запуск как служба обрабатывает init.d на роутере",
};

export function parseZapretBat(
  batText: string,
  opts: { routerListFiles?: string[]; companionFiles?: Record<string, string> } = {}
): ParsedZapretBat {
  const warnings: string[] = [];
  const routerLists = new Set(opts.routerListFiles ?? []);
  const companions: Record<string, string[]> = {};
  const rawCompanions = opts.companionFiles ?? {};

  const text = batText.replace(/\r\n?/g, "\n");
  const rawLines = text.split("\n").map((l) => l.trim());

  // Join continuation lines ("^") into blocks, drop comments/labels
  const blocks: string[] = [];
  let cur: string[] = [];
  let inBlock = false;
  for (const l of rawLines) {
    if (!l || /^rem\b/i.test(l) || /^::/.test(l) || /^goto\b/i.test(l) || /^label?\s/i.test(l) || /^echo\b/i.test(l) || /^cd\b/i.test(l) || /^chcp\b/i.test(l) || /^call\s+service/i.test(l) || /^taskkill/i.test(l)) {
      if (inBlock && cur.length) { blocks.push(cur.join(" ")); cur = []; inBlock = false; }
      continue;
    }
    if (/^\S*\s*\(\s*$/.test(l) || /^\)$/.test(l)) continue;
    if (l.endsWith("^")) {
      cur.push(l.slice(0, -1));
      inBlock = true;
    } else if (inBlock) {
      cur.push(l);
      blocks.push(cur.join(" "));
      cur = [];
      inBlock = false;
    } else {
      blocks.push(l);
    }
  }
  if (cur.length) blocks.push(cur.join(" "));

  const expanded = expandVars(blocks, warnings);

  // Find the invocation block containing the engine exe
  let engine: ParsedZapretBat["engine"] = "unknown";
  let tokens: string[] | null = null;
  for (const b of expanded) {
    const tk = tokenize(b);
    const exeIdx = tk.findIndex((t) => ENGINE_RE.test(basename(stripQuotes(t))));
    if (exeIdx >= 0) {
      const exe = basename(tk[exeIdx]).toLowerCase();
      if (exe.startsWith("winws")) engine = "winws";
      else if (exe.startsWith("nfqws")) engine = "nfqws";
      else if (exe.startsWith("winhost")) engine = "winhost";
      else if (exe.startsWith("badpin")) engine = "badpin";
      tokens = tk.slice(exeIdx + 1);
      break;
    }
  }
  if (!tokens) {
    warnings.push("В файле не найдено запускающей строки winws/nfqws/winhost/badpin — это не конфиг запуска zapret?");
    return {
      engine: "unknown", portsTcp: "", portsUdp: "", sections: [], nfqwsOpt: "",
      fileRefs: [], warnings, needsUpload: [], companionDomains: {}, inlineComment: "",
    };
  }
  if (engine === "winhost" || engine === "badpin") {
    warnings.push(`Движок ${engine} отличается от nfqws: часть флагов автоматически не конвертирована — проверьте результат вручную.`);
  }

  const sections: string[][] = [[]];
  let portsTcp = "";
  let portsUdp = "";
  const fileRefs: BatFileRef[] = [];
  const wfDropped = new Set<string>();
  const unconverted = new Set<string>();
  const emptyValued = new Set<string>();

  for (const rawTok of tokens) {
    let tok = rawTok;
    if (tok === "--new") {
      if (sections[sections.length - 1].length > 0) sections.push([]);
      continue;
    }
    const eq = tok.indexOf("=");
    const name = eq >= 0 ? tok.slice(0, eq) : tok;
    let value = eq >= 0 ? tok.slice(eq + 1) : "";

    // Options emptied by dropped Windows vars (e.g. --filter-tcp=%GameFilterTCP%) are invalid for nfqws
    if (eq >= 0 && value === "" && name.startsWith("--")) {
      emptyValued.add(name);
      continue;
    }

    if (engine === "winhost" || engine === "badpin") {
      if (WINHOST_DROP[name]) {
        warnings.push(`${name}: ${WINHOST_DROP[name]}`);
        continue;
      }
      if (WINHOST_MAP[name]) {
        sections[sections.length - 1].push(`${WINHOST_MAP[name]}=${value}`);
        continue;
      }
      if (name.startsWith("--") && !name.startsWith("--dpi") && !FILE_OPTS.has(name) && !["--filter-tcp", "--filter-udp", "--filter-l7"].includes(name)) {
        unconverted.add(name);
      }
    }

    if (name === "--wf-tcp") { portsTcp = cleanPorts(value); continue; }
    if (name === "--wf-udp") { portsUdp = cleanPorts(value); continue; }
    if (name.startsWith("--wf-")) { wfDropped.add(name); continue; }

    // File-valued options and payload files -> router paths
    if ((FILE_OPTS.has(name) || PAYLOAD_OPT_RE.test(name)) && looksLikePath(value)) {
      const bn = basename(value);
      const kind: BatFileRef["kind"] = PAYLOAD_OPT_RE.test(name) ? "payload" : "list";
      const routerPath = `${kind === "payload" ? FAKE_DIR : LIST_DIR}/${bn}`;
      let status: BatFileRef["status"] = "missing";
      if (kind === "list" && routerLists.has(bn)) status = "router_exists";
      if (rawCompanions[bn] !== undefined) {
        status = "uploaded";
        const doms = rawCompanions[bn]
          .replace(/\r\n?/g, "\n")
          .split("\n")
          .map((d) => d.trim())
          .filter((d) => d && !d.startsWith("#") && !d.startsWith(":"));
        companions[bn] = doms;
      }
      fileRefs.push({ option: name, basename: bn, routerPath, kind, status, domainCount: companions[bn]?.length });
      sections[sections.length - 1].push(`${name}=${routerPath}`);
      continue;
    }
    sections[sections.length - 1].push(tok);
  }

  if (wfDropped.size > 0) {
    warnings.push(`Отфильтровано только для WinFilter: ${[...wfDropped].join(", ")} (в OpenWrt фильтрацию задают NFQWS_PORTS_*).`);
  }
  if (emptyValued.size > 0) {
    warnings.push(`Пустые после раскрытия переменных опции убраны: ${[...emptyValued].join(", ")} (nfqws с пустым значением не запустится).`);
  }
  if (unconverted.size > 0) {
    warnings.push(`Не распознано и передано как есть: ${[...unconverted].sort().join(", ")}`);
  }

  // Fall back: derive ports from --filter-tcp/--filter-udp inside sections
  if (!portsTcp || !portsUdp) {
    const tcp: string[] = [];
    const udp: string[] = [];
    for (const s of sections) {
      for (const t of s) {
        let m = t.match(/^--filter-tcp=(.+)$/);
        if (m) tcp.push(cleanPorts(m[1]));
        m = t.match(/^--filter-udp=(.+)$/);
        if (m) udp.push(cleanPorts(m[1]));
      }
    }
    if (!portsTcp && tcp.length) portsTcp = [...new Set(tcp.join(",").split(","))].join(",");
    if (!portsUdp && udp.length) portsUdp = [...new Set(udp.join(",").split(","))].join(",");
  }

  const nonEmpty = sections.filter((s) => s.length > 0);
  const nfqwsOpt = nonEmpty
    .map((s) => s.join("\n"))
    .join("\n\n--new\n\n");

  const needsUpload = fileRefs
    .filter((f) => f.kind === "list" && f.status === "missing")
    .map((f) => f.basename);
  const missingPayload = fileRefs.filter((f) => f.kind === "payload" && f.status === "missing");
  if (missingPayload.length > 0) {
    warnings.push(
      `Файлы фейков на роутере не проверены (пакет zapret обычно кладёт стандартные в /opt/zapret/files/fake): ${missingPayload.map((f) => f.basename).join(", ")}`
    );
  }

  return {
    engine,
    portsTcp,
    portsUdp,
    sections: nonEmpty,
    nfqwsOpt,
    fileRefs,
    warnings,
    needsUpload: [...new Set(needsUpload)],
    companionDomains: companions,
    inlineComment: "",
  };
}

export function batNameToProfileName(fileName: string): string {
  const base = basename(fileName).replace(/\.bat$/i, "");
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "imported"
  );
}

// Router-safe upload filename: prefix with profile name to avoid clobbering package lists.
export function importFileName(profile: string, originalBasename: string): string {
  const safeOrig = basename(originalBasename).replace(/[^A-Za-z0-9._-]/g, "_");
  return `zapret-import-${profile}-${safeOrig}`.slice(0, 64);
}

// Rewrite parsed nfqwsOpt so that list file references point at imported names
export function applyImportedFileNames(
  parsed: ParsedZapretBat,
  mapping: Record<string, string>
): { nfqwsOpt: string; fileRefs: BatFileRef[] } {
  let opt = parsed.nfqwsOpt;
  const refs = parsed.fileRefs.map((f) => {
    if (f.kind === "list" && mapping[f.basename]) {
      const rp = `${LIST_DIR}/${mapping[f.basename]}`;
      opt = opt.split(f.routerPath).join(rp);
      return { ...f, routerPath: rp, status: "uploaded" as const };
    }
    return f;
  });
  return { nfqwsOpt: opt, fileRefs: refs };
}

export const ZAPRET_LIST_DIR = LIST_DIR;
export const ZAPRET_FAKE_DIR = FAKE_DIR;
