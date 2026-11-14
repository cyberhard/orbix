// Automated Unit and Integration Tests for ORBIX Captive Portal Subsystem
import { describe, it, expect } from "vitest";
import { captivePortalManager } from "../src/services/captive/captive-manager";
import { certManager } from "../src/services/captive/cert-manager";

describe("ORBIX Captive Portal Subsystem", () => {
  describe("Hostname Sanitization & Anti-Injection", () => {
    it("sanitizes plain alphanumeric hostnames with dots and hyphens", () => {
      expect(captivePortalManager.sanitizeHost("vk.com")).toBe("vk.com");
      expect(captivePortalManager.sanitizeHost("my-router.lan")).toBe("my-router.lan");
      expect(captivePortalManager.sanitizeHost("Gosuslugi.RU")).toBe("gosuslugi.ru");
    });

    it("strips HTTP protocols, ports, and URL paths", () => {
      expect(captivePortalManager.sanitizeHost("http://vk.com/feed")).toBe("vk.com");
      expect(captivePortalManager.sanitizeHost("https://gosuslugi.ru:8443/auth")).toBe("gosuslugi.ru");
      expect(captivePortalManager.sanitizeHost("http://192.168.1.1:8080/")).toBe("192.168.1.1");
    });

    it("neutralizes CRLF injection and HTTP response splitting vectors", () => {
      const malicious = "vk.com\r\nSet-Cookie: session=evil\r\n";
      const sanitized = captivePortalManager.sanitizeHost(malicious);
      expect(sanitized).not.toContain("\r");
      expect(sanitized).not.toContain("\n");
      expect(sanitized).toBe("vk.comset-cookie");
    });

    it("strips HTML tags and XSS injection vectors", () => {
      const xssHost = "<script>alert(1)</script>example.com";
      const sanitized = captivePortalManager.sanitizeHost(xssHost);
      expect(sanitized).not.toContain("<");
      expect(sanitized).not.toContain(">");
      expect(sanitized).toBe("scriptalert1");
    });

    it("returns 'unknown' for empty or null hosts", () => {
      expect(captivePortalManager.sanitizeHost("")).toBe("unknown");
      expect(captivePortalManager.sanitizeHost(null)).toBe("unknown");
      expect(captivePortalManager.sanitizeHost(undefined)).toBe("unknown");
    });
  });

  describe("Anti-Open-Redirect Safeguards", () => {
    it("permits trusted router management origins", () => {
      expect(captivePortalManager.isSafeInternalPortalUrl("http://192.168.1.1/#/errors/410")).toBe(true);
      expect(captivePortalManager.isSafeInternalPortalUrl("http://192.168.1.2/#/errors/402")).toBe(true);
      expect(captivePortalManager.isSafeInternalPortalUrl("http://localhost/#/overview")).toBe(true);
      expect(captivePortalManager.isSafeInternalPortalUrl("http://orbix.lan/#/captive")).toBe(true);
      expect(captivePortalManager.isSafeInternalPortalUrl("http://openwrt.lan/")).toBe(true);
      expect(captivePortalManager.isSafeInternalPortalUrl("http://custom-router.corp/#/errors/501", "custom-router.corp")).toBe(true);
    });

    it("rejects untrusted external domains and SSRF vectors", () => {
      expect(captivePortalManager.isSafeInternalPortalUrl("http://evil-attacker.com/steal")).toBe(false);
      expect(captivePortalManager.isSafeInternalPortalUrl("https://phishing.site/login")).toBe(false);
      expect(captivePortalManager.isSafeInternalPortalUrl("//attacker.com/evil")).toBe(false);
      expect(captivePortalManager.isSafeInternalPortalUrl("javascript:alert(1)")).toBe(false);
    });
  });

  describe("Certificate Manager Validation", () => {
    it("validates well-formed PEM certificates", () => {
      const validPem = `-----BEGIN CERTIFICATE-----\nMIIC+DCCAeCgAwIBAgIJAJ8g...==\n-----END CERTIFICATE-----`;
      expect(certManager.validateCertificatePem(validPem).valid).toBe(true);
    });

    it("rejects certificates missing PEM header/footer", () => {
      const invalid = "some random plain text without markers";
      const res = certManager.validateCertificatePem(invalid);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("missing BEGIN/END markers");
    });

    it("validates well-formed PEM private keys (RSA & EC)", () => {
      const rsaKey = `-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----`;
      const ecKey = `-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEI...\n-----END EC PRIVATE KEY-----`;
      const genericKey = `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----`;

      expect(certManager.validatePrivateKeyPem(rsaKey).valid).toBe(true);
      expect(certManager.validatePrivateKeyPem(ecKey).valid).toBe(true);
      expect(certManager.validatePrivateKeyPem(genericKey).valid).toBe(true);
    });

    it("rejects malformed private keys", () => {
      const badKey = "not-a-private-key";
      const res = certManager.validatePrivateKeyPem(badKey);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("missing BEGIN PRIVATE KEY header");
    });
  });
});
