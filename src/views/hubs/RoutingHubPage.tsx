// ORBIX • Routing Hub — one page for all routing: L1/L2/L3 tiers, policies+PBR, domain lists
import React from "react";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { useHashTab } from "@/components/layout/hash-tab";
import { useI18nStore } from "@/store/i18n-store";
import { usePolicyStore } from "@/store/policy-store";
import { RoutingEngineView } from "@/views/circumvention/RoutingEngineView";
import { PolicyEngineView } from "@/views/expert/PolicyEngineView";
import { SimplePolicyManager } from "@/views/simple/SimplePolicyManager";
import { PbrView } from "@/views/circumvention/PbrView";
import { CategoryListManager } from "@/views/lists/CategoryListManager";

const TABS = ["tiers", "rules", "lists"] as const;

export const RoutingHubPage: React.FC = () => {
  const { lang } = useI18nStore();
  const { operatingMode } = usePolicyStore();
  const isRu = lang === "ru";
  const [tab, setTab] = useHashTab("policies", "tiers", [...TABS]);

  // Simple mode keeps the intent-based manager without technical tabs
  if (operatingMode === "simple") {
    return <SimplePolicyManager />;
  }

  return (
    <div className="space-y-2">
      <SectionTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "tiers", label: isRu ? "Уровни L1·L2·L3" : "L1·L2·L3 Tiers" },
          { value: "rules", label: isRu ? "Политики и PBR" : "Policies & PBR" },
          { value: "lists", label: isRu ? "Списки доменов" : "Domain Lists" },
        ]}
      />
      {tab === "tiers" && <RoutingEngineView />}
      {tab === "rules" && (
        <div className="space-y-8">
          <PolicyEngineView />
          <PbrView />
        </div>
      )}
      {tab === "lists" && <CategoryListManager />}
    </div>
  );
};
