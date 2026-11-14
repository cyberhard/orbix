// ORBIX Certificate Manager Subsystem
// Handles ACME DNS-01, User-provided SSL and ORBIX Private CA
import { ubusClient } from "@/lib/ubus-client";
import { CertificateStatus } from "@/types/captive";

export class CertificateManager {
  /**
   * Retrieves active TLS certificate status and metadata from router
   */
  public async getStatus(): Promise<CertificateStatus> {
    try {
      const res = await ubusClient.getCertStatus();
      return {
        installed: Boolean(res?.installed),
        subject: res?.subject || "Unknown",
        issuer: res?.issuer || "Unknown",
        san: res?.san || "",
        valid_from: res?.valid_from || 0,
        valid_to: res?.valid_to || 0,
        days_remaining: res?.days_remaining || 0,
        is_valid: Boolean(res?.is_valid),
      };
    } catch {
      return {
        installed: false,
        is_valid: false,
      };
    }
  }

  /**
   * Validates PEM-encoded certificate string
   */
  public validateCertificatePem(pem: string): { valid: boolean; error?: string } {
    if (!pem || typeof pem !== "string") {
      return { valid: false, error: "Empty certificate payload" };
    }
    const clean = pem.trim();
    if (!clean.includes("-----BEGIN CERTIFICATE-----") || !clean.includes("-----END CERTIFICATE-----")) {
      return { valid: false, error: "Invalid PEM certificate format (missing BEGIN/END markers)" };
    }
    return { valid: true };
  }

  /**
   * Validates PEM-encoded private key string
   */
  public validatePrivateKeyPem(pem: string): { valid: boolean; error?: string } {
    if (!pem || typeof pem !== "string") {
      return { valid: false, error: "Empty private key payload" };
    }
    const clean = pem.trim();
    const hasKeyHeader =
      clean.includes("-----BEGIN PRIVATE KEY-----") ||
      clean.includes("-----BEGIN RSA PRIVATE KEY-----") ||
      clean.includes("-----BEGIN EC PRIVATE KEY-----");

    if (!hasKeyHeader) {
      return { valid: false, error: "Invalid PEM private key format (missing BEGIN PRIVATE KEY header)" };
    }
    return { valid: true };
  }

  /**
   * Uploads custom certificate and private key with automatic rollback if webserver fails
   */
  public async uploadCustomCertificate(
    certPem: string,
    keyPem: string,
    domain?: string
  ): Promise<{ success: boolean; message: string }> {
    const certVal = this.validateCertificatePem(certPem);
    if (!certVal.valid) {
      return { success: false, message: certVal.error || "Invalid certificate" };
    }

    const keyVal = this.validatePrivateKeyPem(keyPem);
    if (!keyVal.valid) {
      return { success: false, message: keyVal.error || "Invalid private key" };
    }

    try {
      const res = await ubusClient.uploadCert(certPem.trim(), keyPem.trim(), domain);
      if (res?.status === "ok") {
        return { success: true, message: "Certificate installed and uhttpd reloaded successfully!" };
      }
      return { success: false, message: res?.message || "Failed to install certificate" };
    } catch (e: any) {
      return { success: false, message: e?.message || "Failed to upload certificate" };
    }
  }

  /**
   * Triggers certificate renewal (or Private CA generation)
   */
  public async renewCertificate(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await ubusClient.renewCert();
      if (res?.status === "ok") {
        return {
          success: true,
          message: `TLS certificate renewed successfully for ${res.domain || "portal"}!`,
        };
      }
      return { success: false, message: res?.message || "Renewal operation failed" };
    } catch (e: any) {
      return { success: false, message: e?.message || "Certificate renewal failed" };
    }
  }
}

export const certManager = new CertificateManager();
