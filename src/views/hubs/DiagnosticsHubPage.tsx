// ORBIX • Diagnostics Hub — route explainer, network utilities, live system logs
import React from "react";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { useHashTab } from "@/components/layout/hash-tab";
import { useI18nStore } from "@/store/i18n-store";
import { ExplainRoute } from "@/views/traffic/ExplainRoute";
import { Diagnostics } from "@/views/network/Diagnostics";
import { SystemLogs } from "@/views/status/SystemLogs";

const TABS = ["explain", "tools", "logs"] as const;

export const DiagnosticsHubPage: React.FC = () => {
  const { lang } = useI18nStore();
  const isRu = lang === "ru";
  const [tab, setTab] = useHashTab("diagnostics", "explain", [...TABS]);

  return (
    <div className="space-y-2">
      <SectionTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "explain", label: isRu ? "Почему так пошёл?" : "Why this route?" },
          { value: "tools", label: isRu ? "Ping / Traceroute / DNS" : "Ping / Traceroute / DNS" },
          { value: "logs", label: isRu ? "Системные логи" : "System logs" },
        ]}
      />
      {tab === "explain" && <ExplainRoute />}
      {tab === "tools" && <Diagnostics />}
      {tab === "logs" && <SystemLogs />}
    </div>
  );
};
