import { describe, it, expect } from "vitest";

describe("Security Validation & Input Sanitization Rules", () => {
  // Regexes matching the exact POSIX checks enforced in rpcd-circumvention.sh
  const FQDN_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  const IPV4_REGEX = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;
  const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

  function validateTarget(raw: string): boolean {
    const clean = raw.trim();
    if (IPV4_REGEX.test(clean)) {
      const octets = clean.split(".").map(Number);
      return octets.every((o) => o >= 0 && o <= 255);
    }
    return FQDN_REGEX.test(clean) && clean.length <= 253;
  }

  function validatePort(raw: number | string): boolean {
    if (typeof raw === "string" && !/^\d+$/.test(raw.trim())) {
      return false;
    }
    const port = typeof raw === "string" ? parseInt(raw, 10) : raw;
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  function sanitizeDeviceName(raw: string): string {
    return raw.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 64);
  }

  it("should accept valid domains and reject dangerous injection attempts", () => {
    expect(validateTarget("youtube.com")).toBe(true);
    expect(validateTarget("sub.domain.example.co.uk")).toBe(true);
    expect(validateTarget("192.168.1.1")).toBe(true);
    expect(validateTarget("10.0.0.1")).toBe(true);

    // Injection attacks
    expect(validateTarget("youtube.com; rm -rf /")).toBe(false);
    expect(validateTarget("youtube.com`whoami`")).toBe(false);
    expect(validateTarget("youtube.com$(reboot)")).toBe(false);
    expect(validateTarget("-o /etc/shadow")).toBe(false);
    expect(validateTarget("youtube.com|cat")).toBe(false);
    expect(validateTarget("999.999.999.999")).toBe(false);
  });

  it("should enforce strict port range validation", () => {
    expect(validatePort(80)).toBe(true);
    expect(validatePort(443)).toBe(true);
    expect(validatePort(65535)).toBe(true);
    expect(validatePort(1)).toBe(true);

    expect(validatePort(0)).toBe(false);
    expect(validatePort(70000)).toBe(false);
    expect(validatePort(-1)).toBe(false);
    expect(validatePort("443; reboot")).toBe(false);
    expect(validatePort("443-extra")).toBe(false);
  });

  it("should validate standard IEEE 802 MAC address representations", () => {
    expect(MAC_REGEX.test("B2:68:C5:3D:2E:52")).toBe(true);
    expect(MAC_REGEX.test("b2:68:c5:3d:2e:52")).toBe(true);
    expect(MAC_REGEX.test("b2-68-c5-3d-2e-52")).toBe(true);

    expect(MAC_REGEX.test("invalid-mac")).toBe(false);
    expect(MAC_REGEX.test("B2:68:C5:3D:2E")).toBe(false);
    expect(MAC_REGEX.test("B2:68:C5:3D:2E:52:AA")).toBe(false);
    expect(MAC_REGEX.test("B2:68:C5:3D:2E:GG")).toBe(false);
  });

  it("should sanitize device names removing shell metacharacters and UCI option delimiters", () => {
    expect(sanitizeDeviceName("Redmi Note 9")).toBe("Redmi Note 9");
    expect(sanitizeDeviceName("My-PC_2026")).toBe("My-PC_2026");
    expect(sanitizeDeviceName("PC; rm -rf / && echo 'pwned'")).toBe("PC rm -rf   echo pwned");
    expect(sanitizeDeviceName("Router\noption dummy 'hack'")).toBe("Routeroption dummy hack");
  });
});
