// ORBIX • VPN Hub — Happ subscription control block on top, VPN manager (AWG/VLESS/Groups/Killswitch) below.
// Legacy /subscriptions?tab=subscriptions deep-links scroll the subscription block into view.
import React, { useEffect, useRef } from "react";
import { SubscriptionsView } from "@/views/circumvention/SubscriptionsView";
import { VpnManager } from "@/views/circumvention/VpnManager";
import { readHashTab } from "@/components/layout/hash-tab";

export const VpnHubPage: React.FC = () => {
  const subsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focusSubs = () => {
      if (readHashTab() === "subscriptions") {
        subsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    // run after layout + on later hash navigations
    const raf = requestAnimationFrame(focusSubs);
    window.addEventListener("hashchange", focusSubs);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("hashchange", focusSubs);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div ref={subsRef} id="subscriptions-block" className="scroll-mt-20">
        <SubscriptionsView embedded />
      </div>
      <VpnManager />
    </div>
  );
};
