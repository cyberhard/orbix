// Configuration Importer & Transactional Application Engine
// Handles JSON validation, decryption, hardware migration, and safe apply with rollback.

import { PanelExportPackage, PanelConfiguration } from "./schema";
import { ConfigValidator, ValidationResult } from "./validator";
import { BackupCrypto } from "./crypto";
import { ConfigMigrator, MigrationReport } from "./migrator";
import { ubusClient } from "@/lib/ubus-client";
import { usePolicyStore } from "@/store/policy-store";
import { useSubscriptionStore } from "@/store/subscription-store";
import { useDeviceRoutingStore } from "@/store/device-routing-store";
import { useI18nStore } from "@/store/i18n-store";
import { useThemeStore } from "@/store/theme-store";

export type ImportMode = "merge" | "replace" | "selective";

export interface ImportPreviewResult {
  validation: ValidationResult;
  configuration: PanelConfiguration;
  migrationReport: MigrationReport;
  rawPackage: PanelExportPackage;
}

export class ConfigImporter {
  /**
   * Parse, validate, and optionally decrypt an uploaded backup file.
   */
  public static async parseAndPreview(
    fileContent: string,
    password?: string
  ): Promise<ImportPreviewResult> {
    let parsed: any;
    try {
      parsed = JSON.parse(fileContent);
    } catch {
      throw new Error("Файл не является корректным JSON документом.");
    }

    const validation = ConfigValidator.validate(parsed);
    if (!validation.isValid) {
      throw new Error(`Ошибки валидации схемы: ${validation.errors.join("; ")}`);
    }

    let config: PanelConfiguration;

    // Handle Encrypted Package
    if (validation.isEncrypted) {
      if (!password) {
        throw new Error("ENCRYPTION_PASSWORD_REQUIRED");
      }
      if (!parsed.ciphertext || !parsed.crypto_metadata) {
        throw new Error("Зашифрованный файл поврежден или не содержит данных.");
      }

      const decryptedJsonStr = await BackupCrypto.decrypt(
        parsed.ciphertext,
        password,
        parsed.crypto_metadata
      );

      try {
        config = JSON.parse(decryptedJsonStr);
      } catch {
        throw new Error("Расшифрованные данные повреждены (некорректный JSON).");
      }

      // Re-validate decrypted configuration
      const decValidation = ConfigValidator.validate({
        ...parsed,
        is_encrypted: false,
        configuration: config,
      });

      if (!decValidation.isValid) {
        throw new Error(`Ошибки в расшифрованной конфигурации: ${decValidation.errors.join("; ")}`);
      }

      // Verify SHA-256 Checksum on decrypted content
      if (parsed.metadata?.checksum_sha256) {
        const hashOfDecrypted = await BackupCrypto.computeSha256(decryptedJsonStr);
        const hashPretty = await BackupCrypto.computeSha256(JSON.stringify(config, null, 2));
        if (
          hashOfDecrypted !== parsed.metadata.checksum_sha256 &&
          hashPretty !== parsed.metadata.checksum_sha256
        ) {
          throw new Error(
            `Ошибка проверки контрольной суммы (SHA-256 mismatch): данные конфигурации повреждены.`
          );
        }
      }
    } else {
      config = parsed.configuration as PanelConfiguration;

      // Verify SHA-256 Checksum for unencrypted package
      if (parsed.metadata?.checksum_sha256) {
        const hashPretty = await BackupCrypto.computeSha256(JSON.stringify(config, null, 2));
        const hashCompact = await BackupCrypto.computeSha256(JSON.stringify(config));
        if (
          hashPretty !== parsed.metadata.checksum_sha256 &&
          hashCompact !== parsed.metadata.checksum_sha256
        ) {
          validation.warnings.push("Контрольная сумма SHA-256 пакета отличается от сохраненной в метаданных.");
        }
      }
    }

    // Query live router hardware to analyze adaptation
    const [board, ifaces, radios, packages] = await Promise.all([
      ubusClient.getBoard().catch(() => ({} as any)),
      ubusClient.getInterfaces().catch(() => []),
      ubusClient.getWirelessDevices().catch(() => ({})),
      ubusClient.getPackages().catch(() => ({})),
    ]);

    const migrationReport = ConfigMigrator.analyze(
      config,
      board,
      ifaces,
      radios,
      packages,
      parsed.source?.model || "Экспортированный роутер"
    );

    return {
      validation,
      configuration: config,
      migrationReport,
      rawPackage: parsed,
    };
  }

  /**
   * Execute transactional application of imported configuration with rollback protection.
   */
  public static async apply(
    config: PanelConfiguration,
    report: MigrationReport,
    mode: ImportMode = "merge",
    selectedSections: string[] = [
      "general",
      "network",
      "devices",
      "policies",
      "vpn",
      "dns",
      "zapret",
      "firewall",
    ]
  ): Promise<{ success: boolean; rollbackToken: string; message: string }> {
    // 1. Adapt hardware configurations (e.g. resolve LAN/WAN IP collisions)
    const adaptedConfig = ConfigMigrator.adapt(config, report);

    // 2. Arm safety rollback watchdog on OpenWrt
    const armRes = await ubusClient.armRollback(75);
    const rollbackToken = armRes.token || "token";

    try {
      // 3. Apply General settings
      if (selectedSections.includes("general") && adaptedConfig.general) {
        const { hostname, timezone, zonename, language, theme, operating_mode } = adaptedConfig.general;
        if (hostname || timezone || zonename) {
          const sysVals: Record<string, unknown> = {};
          if (hostname) sysVals.hostname = hostname;
          if (timezone) sysVals.timezone = timezone;
          if (zonename) sysVals.zonename = zonename;
          await ubusClient.setUci("system", "@system[0]", sysVals);
          await ubusClient.commitUci("system");
        }

        if (language) useI18nStore.getState().setLang(language);
        if (theme) {
          const resolvedTheme =
            theme === "system"
              ? window.matchMedia?.("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
              : theme;
          useThemeStore.getState().setTheme(resolvedTheme as "dark" | "light");
        }
        if (operating_mode) usePolicyStore.getState().setOperatingMode(operating_mode);
      }

      // 4. Apply Policies & Categories
      if (selectedSections.includes("policies") && adaptedConfig.policies?.policies) {
        const pStore = usePolicyStore.getState();
        if (mode === "replace") {
          // Replace all policies
          for (const p of [...pStore.policies]) {
            pStore.deletePolicy(p.id);
          }
          for (const p of adaptedConfig.policies.policies) {
            pStore.addPolicy(p);
          }
        } else {
          // Merge
          const existingIds = new Set(pStore.policies.map((p) => p.id));
          for (const p of adaptedConfig.policies.policies) {
            if (!existingIds.has(p.id)) {
              pStore.addPolicy(p);
            }
          }
        }

        if (adaptedConfig.policies.categories) {
          for (const cat of adaptedConfig.policies.categories) {
            pStore.addCategory(cat);
          }
        }
      }

      // 5. Apply VPN & Subscriptions
      if (selectedSections.includes("vpn") && adaptedConfig.vpn) {
        const subStore = useSubscriptionStore.getState();
        if (adaptedConfig.vpn.subscription?.url && !adaptedConfig.vpn.subscription.url.includes("[REDACTED]")) {
          subStore.setUrl(adaptedConfig.vpn.subscription.url);
        }
        if (adaptedConfig.vpn.outbound_groups) {
          subStore.setOutboundGroups(adaptedConfig.vpn.outbound_groups);
        }
        if (adaptedConfig.vpn.kill_switch) {
          subStore.setKillSwitch(adaptedConfig.vpn.kill_switch);
        }
      }

      // 6. Apply Devices
      if (selectedSections.includes("devices") && adaptedConfig.devices) {
        const devStore = useDeviceRoutingStore.getState();
        for (const d of adaptedConfig.devices.devices) {
          if (d.ip && d.assigned_interface) {
            await devStore.setDeviceInterface(d.ip, d.assigned_interface as any);
          }
        }
      }

      // 7. Compile and commit policies into Sing-box / Zapret / PBR / Dnsmasq
      await usePolicyStore.getState().applyPoliciesToRouter();

      return {
        success: true,
        rollbackToken,
        message: "Конфигурация успешно применена. Проверьте работоспособность сети.",
      };
    } catch (err: any) {
      console.error("Configuration import apply failed:", err);
      // Attempt immediate cancel or let watchdog revert
      throw new Error(`Ошибка применения настроек: ${err.message}`);
    }
  }
}
