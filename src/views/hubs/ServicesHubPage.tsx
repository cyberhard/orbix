// ORBIX • Services Hub — init scripts autostart, Podkop control (when installed), crontab planner
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { useHashTab, readHashTab } from "@/components/layout/hash-tab";
import { useI18nStore } from "@/store/i18n-store";
import { ubusClient } from "@/lib/ubus-client";
import { StartupServices } from "@/views/system/StartupServices";
import { ScheduledTasks } from "@/views/system/ScheduledTasks";
import { PodkopView } from "@/views/circumvention/PodkopView";

export const ServicesHubPage: React.FC = () => {
  const { lang } = useI18nStore();
  const isRu = lang === "ru";

  // Podkop tab appears only when the package is actually installed on the router
  const { data: podkop } = useQuery({
    queryKey: ["podkop-installed-probe"],
    queryFn: async () => {
      try {
        const cfg = await ubusClient.getPodkopConfig();
        return cfg?.installed === true || cfg?.installed === 1 || cfg?.status === "ok";
      } catch {
        return false;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const allowed = podkop ? ["init", "podkop", "cron"] : ["init", "cron"];
  const [tab, setTab] = useHashTab("services", "init", allowed);
  const activeTab = allowed.includes(tab) ? tab : "init";

  // /podkop deep-link may arrive before the install probe resolves — re-apply the tab once known
  React.useEffect(() => {
    if (podkop && readHashTab() === "podkop" && tab !== "podkop") setTab("podkop");
  }, [podkop, tab, setTab]);

  const items = [
    { value: "init", label: isRu ? "Автозапуск служб" : "Init services" },
    ...(podkop ? [{ value: "podkop", label: "Podkop" }] : []),
    { value: "cron", label: isRu ? "Планировщик (cron)" : "Scheduler (cron)" },
  ];

  return (
    <div className="space-y-2">
      <SectionTabs value={activeTab} onChange={setTab} items={items} />
      {activeTab === "init" && <StartupServices />}
      {activeTab === "podkop" && <PodkopView />}
      {activeTab === "cron" && <ScheduledTasks />}
    </div>
  );
};
