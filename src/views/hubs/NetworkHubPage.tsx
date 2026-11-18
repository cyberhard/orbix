// ORBIX • Network Hub — DHCP pools/static leases and DNS routing/upstreams on one tabbed page
import React from "react";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { useHashTab } from "@/components/layout/hash-tab";
import { useI18nStore } from "@/store/i18n-store";
import { DhcpDns } from "@/views/network/DhcpDns";
import { DnsRoutingCenter } from "@/views/dns/DnsRoutingCenter";

const TABS = ["dhcp", "dns"] as const;

export const NetworkHubPage: React.FC = () => {
  const { lang } = useI18nStore();
  const isRu = lang === "ru";
  const [tab, setTab] = useHashTab("dhcp", "dhcp", [...TABS]);

  return (
    <div className="space-y-2">
      <SectionTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "dhcp", label: isRu ? "DHCP: пулы и статика" : "DHCP: pools & statics" },
          { value: "dns", label: isRu ? "DNS: апстримы и защита" : "DNS: upstreams & leak guard" },
        ]}
      />
      {tab === "dhcp" && <DhcpDns />}
      {tab === "dns" && <DnsRoutingCenter />}
    </div>
  );
};
