// ORBIX • Settings Hub — general settings, SSH/root admin, backup/rollback, firmware catalog
import React from "react";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { useHashTab } from "@/components/layout/hash-tab";
import { useI18nStore } from "@/store/i18n-store";
import { GeneralSettings } from "@/views/system/GeneralSettings";
import { Administration } from "@/views/system/Administration";
import { BackupFlash } from "@/views/system/BackupFlash";
import { HardwareCatalog } from "@/views/install/HardwareCatalog";

const TABS = ["general", "admin", "backup", "install"] as const;

export const SettingsHubPage: React.FC = () => {
  const { lang } = useI18nStore();
  const isRu = lang === "ru";
  const [tab, setTab] = useHashTab("settings", "general", [...TABS]);

  return (
    <div className="space-y-2">
      <SectionTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "general", label: isRu ? "Общие" : "General" },
          { value: "admin", label: isRu ? "SSH и доступ" : "SSH & access" },
          { value: "backup", label: isRu ? "Бэкап и откат" : "Backup & rollback" },
          { value: "install", label: isRu ? "Устройства и прошивки" : "Devices & firmware" },
        ]}
      />
      {tab === "general" && <GeneralSettings />}
      {tab === "admin" && <Administration />}
      {tab === "backup" && <BackupFlash />}
      {tab === "install" && <HardwareCatalog />}
    </div>
  );
};
