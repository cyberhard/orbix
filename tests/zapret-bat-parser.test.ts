import { describe, it, expect } from "vitest";
import generalBat from "./fixtures/flowseal-general.bat?raw";
import {
  parseZapretBat,
  batNameToProfileName,
  importFileName,
  applyImportedFileNames,
} from "../src/services/zapret/bat-parser";

describe("parseZapretBat — real Flowseal general.bat", () => {
  const parsed = parseZapretBat(generalBat, {
    routerListFiles: ["list-general.txt", "list-google.txt", "ipset-all.txt"],
  });

  it("detects winws engine", () => {
    expect(parsed.engine).toBe("winws");
  });

  it("extracts wf ports and drops GameFilter vars", () => {
    expect(parsed.portsTcp).toBe("80,443,2053,2083,2087,2096,8443");
    expect(parsed.portsUdp).toBe("443,19294-19344,50000-50100");
    expect(parsed.warnings.some((w) => w.includes("GameFilter"))).toBe(true);
  });

  it("splits sections on --new", () => {
    // general.bat has 9 argument groups separated by --new ^
    expect(parsed.sections.length).toBeGreaterThanOrEqual(8);
    expect(parsed.nfqwsOpt).toContain("--new");
    expect(parsed.nfqwsOpt).not.toMatch(/\^/);
    expect(parsed.nfqwsOpt).not.toMatch(/\.exe/);
  });

  it("maps %LISTS% files to router ipset paths", () => {
    const opt = parsed.nfqwsOpt;
    expect(opt).toContain("--hostlist=/opt/zapret/ipset/list-general.txt");
    expect(opt).toContain("--hostlist=/opt/zapret/ipset/list-google.txt");
    expect(opt).not.toMatch(/%LISTS%/);
    expect(opt).not.toMatch(/%BIN%/);
    expect(opt).not.toMatch(/lists\\/);
  });

  it("maps %BIN% payloads to fake payload dir", () => {
    expect(parsed.nfqwsOpt).toContain("--dpi-desync-fake-quic=/opt/zapret/files/fake/quic_initial_www_google_com.bin");
  });

  it("flags lists missing on router as needing upload", () => {
    expect(parsed.needsUpload).toContain("list-general-user.txt");
    expect(parsed.fileRefs.find((f) => f.basename === "list-general.txt")?.status).toBe("router_exists");
  });

  it("inlines companion list domains when provided", () => {
    const p2 = parseZapretBat(generalBat, {
      companionFiles: { "list-general-user.txt": "example.com\n# comment\nrutube.ru\n" },
    });
    expect(p2.companionDomains["list-general-user.txt"]).toEqual(["example.com", "rutube.ru"]);
    expect(p2.fileRefs.find((f) => f.basename === "list-general-user.txt")?.status).toBe("uploaded");
    expect(p2.needsUpload).not.toContain("list-general-user.txt");
  });

  it("keeps --comment= and non-file options verbatim", () => {
    expect(parsed.nfqwsOpt).toContain("--dpi-desync=fake");
    expect(parsed.nfqwsOpt).toContain("--filter-l7=discord,stun");
    expect(parsed.nfqwsOpt).toContain("--hostlist-domains=discord.media");
  });
});

describe("parseZapretBat — odd input", () => {
  it("returns warning for non-launch scripts", () => {
    const p = parseZapretBat("@echo off\r\necho hello\r\n");
    expect(p.engine).toBe("unknown");
    expect(p.nfqwsOpt).toBe("");
    expect(p.warnings.length).toBeGreaterThan(0);
  });

  it("derives ports from filter options when no wf options present", () => {
    const bat = 'nfqws.exe --filter-tcp=443 --dpi-desync=fake ^\n--new --filter-udp=50000 --dpi-desync=fake';
    const p = parseZapretBat(bat, {});
    expect(p.engine).toBe("nfqws");
    expect(p.portsTcp).toBe("443");
    expect(p.portsUdp).toBe("50000");
  });

  it("translates a few known winhost flags", () => {
    const bat = "winhost.exe --domain-set=1 --port-tcp=443 --filter=tls --frag=s,1";
    const p = parseZapretBat(bat, {});
    expect(p.engine).toBe("winhost");
    expect(p.nfqwsOpt).toContain("--filter-tcp=443");
    expect(p.warnings.some((w) => w.includes("domain-set"))).toBe(true);
  });
});

describe("name helpers", () => {
  it("sanitizes profile names", () => {
    expect(batNameToProfileName("general (FAKE TLS AUTO).bat")).toBe("general-fake-tls-auto");
    expect(batNameToProfileName("1_rostelecom.bat")).toBe("1_rostelecom");
  });
  it("builds collision-safe import filenames", () => {
    expect(importFileName("general", "list general.txt")).toBe("zapret-import-general-list_general.txt");
  });
  it("rewrites opt paths through import mapping", () => {
    const p = parseZapretBat(generalBat, {});
    const { nfqwsOpt } = applyImportedFileNames(p, { "list-general.txt": "zapret-import-general-list-general.txt" });
    expect(nfqwsOpt).toContain("/opt/zapret/ipset/zapret-import-general-list-general.txt");
  });
});
