// Strict JSON Schema and Content Validator for OpenWrt Modern Panel Configs

import {
  CURRENT_SCHEMA_VERSION,
  PANEL_FORMAT_IDENTIFIER,
  PanelExportPackage,
  PanelConfiguration,
} from "./schema";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sectionsFound: string[];
  schemaVersion: number;
  isEncrypted: boolean;
  sourceDevice?: string;
  sourceOpenWrt?: string;
}

export class ConfigValidator {
  public static validate(rawJson: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sectionsFound: string[] = [];

    if (!rawJson || typeof rawJson !== "object") {
      return {
        isValid: false,
        errors: ["Invalid JSON payload: root must be a valid JSON object."],
        warnings: [],
        sectionsFound: [],
        schemaVersion: 0,
        isEncrypted: false,
      };
    }

    const pkg = rawJson as Partial<PanelExportPackage>;

    // 1. Format Identifier Check
    if (pkg.format !== PANEL_FORMAT_IDENTIFIER) {
      errors.push(
        `Invalid configuration format. Expected "${PANEL_FORMAT_IDENTIFIER}", received "${pkg.format || "unknown"}".`
      );
    }

    // 2. Schema Version Check
    const schemaVersion = pkg.schema_version || 0;
    if (typeof schemaVersion !== "number" || schemaVersion < 1) {
      errors.push("Missing or invalid schema_version number.");
    } else if (schemaVersion > CURRENT_SCHEMA_VERSION) {
      errors.push(
        `Unsupported schema version ${schemaVersion}. The current panel supports up to version ${CURRENT_SCHEMA_VERSION}. Please update the panel first.`
      );
    }

    // 3. Encrypted Payload Handling
    const isEncrypted = Boolean(pkg.is_encrypted);
    if (isEncrypted) {
      if (!pkg.ciphertext || typeof pkg.ciphertext !== "string") {
        errors.push("Encrypted configuration package is missing ciphertext.");
      }
      if (!pkg.crypto_metadata || pkg.crypto_metadata.algorithm !== "AES-GCM") {
        errors.push("Encrypted package contains missing or unsupported cryptographic metadata.");
      }
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sectionsFound: pkg.metadata?.included_sections || [],
        schemaVersion,
        isEncrypted: true,
        sourceDevice: pkg.source?.model,
        sourceOpenWrt: pkg.source?.openwrt_version,
      };
    }

    // 4. Unencrypted Configuration Validation
    if (!pkg.configuration || typeof pkg.configuration !== "object") {
      errors.push("Missing configuration object in unencrypted package.");
      return {
        isValid: false,
        errors,
        warnings,
        sectionsFound: [],
        schemaVersion,
        isEncrypted: false,
      };
    }

    const config = pkg.configuration as PanelConfiguration;

    // Validate individual sections
    if (config.general) {
      sectionsFound.push("general");
      if (typeof config.general.hostname !== "string") {
        warnings.push("general.hostname is not a valid string.");
      }
    }

    if (config.network) {
      sectionsFound.push("network");
      if (config.network.interfaces && !Array.isArray(config.network.interfaces)) {
        errors.push("network.interfaces must be an array.");
      }
    }

    if (config.devices) {
      sectionsFound.push("devices");
      if (config.devices.devices && !Array.isArray(config.devices.devices)) {
        errors.push("devices.devices must be an array.");
      }
    }

    if (config.policies) {
      sectionsFound.push("policies");
      if (!Array.isArray(config.policies.policies)) {
        errors.push("policies.policies must be an array.");
      } else {
        // Validate policy items
        for (let i = 0; i < config.policies.policies.length; i++) {
          const p = config.policies.policies[i];
          if (!p.id || !p.name || typeof p.priority !== "number" || !p.action) {
            errors.push(`Policy #${i} is malformed (missing id, name, priority, or action).`);
          }
        }
      }
    }

    if (config.vpn) {
      sectionsFound.push("vpn");
      if (config.vpn.outbound_groups && !Array.isArray(config.vpn.outbound_groups)) {
        errors.push("vpn.outbound_groups must be an array.");
      }
    }

    if (config.dns) {
      sectionsFound.push("dns");
      if (config.dns.split_dns_domains && !Array.isArray(config.dns.split_dns_domains)) {
        warnings.push("dns.split_dns_domains should be an array of domain suffixes.");
      }
    }

    if (config.zapret) {
      sectionsFound.push("zapret");
      if (typeof config.zapret.enabled !== "boolean") {
        warnings.push("zapret.enabled should be a boolean.");
      }
    }

    if (config.firewall) {
      sectionsFound.push("firewall");
      if (config.firewall.port_forwards && !Array.isArray(config.firewall.port_forwards)) {
        errors.push("firewall.port_forwards must be an array.");
      }
    }

    if (config.lists) {
      sectionsFound.push("lists");
    }

    if (config.diagnostics) {
      sectionsFound.push("diagnostics");
    }

    if (sectionsFound.length === 0) {
      warnings.push("Package contains an empty configuration with no recognized sections.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sectionsFound,
      schemaVersion,
      isEncrypted: false,
      sourceDevice: pkg.source?.model,
      sourceOpenWrt: pkg.source?.openwrt_version,
    };
  }
}
