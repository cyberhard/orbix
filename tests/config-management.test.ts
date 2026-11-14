import { describe, it, expect } from "vitest";
import { ConfigValidator } from "@/services/config/validator";
import { BackupCrypto } from "@/services/config/crypto";
import { ConfigMigrator } from "@/services/config/migrator";
import { ORBIX_FORMAT_IDENTIFIER, LEGACY_PANEL_FORMAT_IDENTIFIER, PanelExportPackage } from "@/services/config/schema";

describe("Configuration Management & Schema", () => {
  it("should validate a valid orbix-config package", () => {
    const validPkg: PanelExportPackage = {
      format: ORBIX_FORMAT_IDENTIFIER,
      schema_version: 1,
      orbix_version: "1.0.0",
      openwrt_version: "25.12",
      exported_at: new Date().toISOString(),
      export_type: "full",
      is_encrypted: false,
      source: {
        panel_version: "1.0.0",
        openwrt_version: "25.12",
        architecture: "aarch64",
        board_name: "netcraze,nc-1812",
        model: "Netcraze NC-1812",
        hostname: "ORBIX-Router",
      },
      metadata: {
        description: "Test Export",
        checksum_sha256: "test-hash",
        included_sections: ["general", "network"],
        excluded_sections: [],
        secrets_included: false,
      },
      configuration: {
        general: {
          hostname: "ORBIX-Router",
          timezone: "UTC",
          zonename: "UTC",
          ntp_enabled: true,
          ntp_servers: ["0.openwrt.pool.ntp.org"],
          language: "ru",
          theme: "dark",
          operating_mode: "simple",
          wizard_completed: true,
        },
      },
    };

    const res = ConfigValidator.validate(validPkg);
    expect(res.isValid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(res.schemaVersion).toBe(1);
  });

  it("should maintain backwards compatibility with legacy openwrt-modern-panel format", () => {
    const legacyPkg = {
      format: LEGACY_PANEL_FORMAT_IDENTIFIER,
      schema_version: 1,
      exported_at: new Date().toISOString(),
      export_type: "full",
      is_encrypted: false,
      source: {
        panel_version: "0.9.0",
        openwrt_version: "24.10",
        architecture: "aarch64",
        board_name: "generic",
        model: "Generic Router",
        hostname: "OpenWrt",
      },
      metadata: {
        description: "Legacy Backup",
        checksum_sha256: "dummy",
        included_sections: ["general"],
        excluded_sections: [],
        secrets_included: false,
      },
      configuration: {},
    };

    const res = ConfigValidator.validate(legacyPkg);
    expect(res.isValid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it("should reject packages with unknown format or future schema versions", () => {
    const invalidFormat = { format: "alien-router-backup", schema_version: 1 };
    expect(ConfigValidator.validate(invalidFormat).isValid).toBe(false);

    const futureVersion = { format: ORBIX_FORMAT_IDENTIFIER, schema_version: 999 };
    expect(ConfigValidator.validate(futureVersion).isValid).toBe(false);
  });

  it("should compute deterministic SHA-256 hashes synchronously", () => {
    const input = "ORBIX Network Platform 2026";
    const hash1 = BackupCrypto.sha256Sync(input);
    const hash2 = BackupCrypto.sha256Sync(input);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("should detect subnet conflicts between imported LAN and live WAN and adapt LAN IP", () => {
    const importedConfig = {
      network: {
        interfaces: [
          {
            role: "lan" as const,
            proto: "static" as const,
            ipaddr: "192.168.1.1",
            netmask: "255.255.255.0",
          },
        ],
      },
    };

    const currentBoard = {
      kernel: "6.6",
      hostname: "Router",
      system: "ARMv8",
      model: "Netcraze NC-1812",
      board_name: "nc-1812",
      rootfs_type: "squashfs",
      release: {
        distribution: "OpenWrt",
        version: "25.12",
        revision: "r1",
        target: "mediatek/filogic",
        description: "OpenWrt 25.12",
      },
    };

    const currentIfaces = [
      {
        interface: "wan",
        up: true,
        pending: false,
        available: true,
        autostart: true,
        dynamic: false,
        uptime: 100,
        l3_device: "eth0",
        proto: "dhcp",
        "ipv4-address": [{ address: "192.168.1.100", mask: 24 }],
      },
    ];

    const report = ConfigMigrator.analyze(
      importedConfig,
      currentBoard,
      currentIfaces,
      {},
      { "sing-box": "1.10.0" }
    );

    expect(report.subnetConflictDetected).toBe(true);
    expect(report.proposedLanIp).toBe("192.168.2.1");
    expect(report.items.some((i) => i.key === "lan_ip_conflict")).toBe(true);
  });
});
