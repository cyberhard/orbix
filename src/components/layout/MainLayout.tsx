import React, { useState, Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { UciStagingBar } from "./UciStagingBar";
import { DiffModal } from "./DiffModal";
import { CommandPalette } from "./CommandPalette";
import { RollbackModal } from "./RollbackModal";
import { useI18nStore } from "@/store/i18n-store";

// Views
import { Overview } from "@/views/status/Overview";
import { BandwidthGraph } from "@/views/status/BandwidthGraph";
import { ConnectedClients } from "@/views/status/ConnectedClients";
import { SystemLogs } from "@/views/status/SystemLogs";
import { VpnManager } from "@/views/circumvention/VpnManager";
import { SubscriptionsView } from "@/views/circumvention/SubscriptionsView";
import { ZapretStrategyBuilder } from "@/views/circumvention/ZapretStrategyBuilder";
import { PodkopView } from "@/views/circumvention/PodkopView";
import { PbrView } from "@/views/circumvention/PbrView";
import { Interfaces } from "@/views/network/Interfaces";
import { Wireless } from "@/views/network/Wireless";
import { DhcpDns } from "@/views/network/DhcpDns";
import { Firewall } from "@/views/network/Firewall";
import { Diagnostics } from "@/views/network/Diagnostics";
import { GeneralSettings } from "@/views/system/GeneralSettings";
import { Administration } from "@/views/system/Administration";
import { Software } from "@/views/system/Software";
import { StartupServices } from "@/views/system/StartupServices";
import { ScheduledTasks } from "@/views/system/ScheduledTasks";
import { BackupFlash } from "@/views/system/BackupFlash";

export const MainLayout: React.FC = () => {
  // Read initial route from URL hash (e.g. #/subscriptions, #/wireless)
  const getRouteFromHash = () => {
    if (typeof window === "undefined") return "overview";
    const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
    if (hash === "graphs" || hash === "realtime" || hash === "traffic") return "bandwidth";
    if (hash === "devices" || hash === "leases") return "clients";
    if (hash === "wifi") return "wireless";
    return hash || "overview";
  };

  const [currentRoute, setCurrentRouteState] = useState<string>(getRouteFromHash());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { t } = useI18nStore();

  const navigateTo = (route: string) => {
    if (typeof window !== "undefined") {
      window.location.hash = `#/${route}`;
    }
    setCurrentRouteState(route);
  };

  React.useEffect(() => {
    const onHashChange = () => {
      const route = getRouteFromHash();
      setCurrentRouteState(route);
    };
    window.addEventListener("hashchange", onHashChange);
    // If no hash present, default to #/overview
    if (window.location.hash === "" || window.location.hash === "#") {
      window.location.hash = "#/overview";
    }
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const getRouteTitle = (route: string) => {
    switch (route) {
      case "overview": return t.nav.overview;
      case "bandwidth": return t.nav.realtimeGraphs;
      case "clients": return t.nav.connectedClients;
      case "logs": return t.nav.systemLogs;
      case "vpn": return t.nav.vpnManager;
      case "subscriptions": return t.nav.subscriptions;
      case "zapret": return t.nav.zapretBuilder;
      case "podkop": return t.nav.podkopServices;
      case "pbr": return t.nav.policyRouting;
      case "interfaces": return t.nav.interfacesVlans;
      case "wireless": return t.nav.wirelessRadios;
      case "dhcp": return t.nav.dhcpDns;
      case "firewall": return t.nav.firewall;
      case "diagnostics": return t.nav.diagnostics;
      case "general": return t.nav.generalSettings;
      case "admin": return t.nav.adminSsh;
      case "software": return t.nav.softwarePackages;
      case "services": return t.nav.startupServices;
      case "tasks": return t.nav.scheduledTasks;
      case "backup": return t.nav.backupFlash;
      default: return t.nav.overview;
    }
  };

  const renderView = () => {
    switch (currentRoute) {
      case "overview":
        return <Overview />;
      case "bandwidth":
        return <BandwidthGraph />;
      case "clients":
        return <ConnectedClients />;
      case "logs":
        return <SystemLogs />;
      case "vpn":
        return <VpnManager />;
      case "subscriptions":
        return <SubscriptionsView />;
      case "zapret":
        return <ZapretStrategyBuilder />;
      case "podkop":
        return <PodkopView />;
      case "pbr":
        return <PbrView />;
      case "interfaces":
        return <Interfaces />;
      case "wireless":
        return <Wireless />;
      case "dhcp":
        return <DhcpDns />;
      case "firewall":
        return <Firewall />;
      case "diagnostics":
        return <Diagnostics />;
      case "general":
        return <GeneralSettings />;
      case "admin":
        return <Administration />;
      case "software":
        return <Software />;
      case "services":
        return <StartupServices />;
      case "tasks":
        return <ScheduledTasks />;
      case "backup":
        return <BackupFlash />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        currentRoute={currentRoute}
        onSelectRoute={(r) => {
          navigateTo(r);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <Header
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          currentRouteTitle={getRouteTitle(currentRoute)}
        />

        <main className="flex-1 p-4 md:p-6 pb-20 overflow-y-auto">
          <div className="mx-auto max-w-7xl">
            <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading view...</div>}>
              <div key={currentRoute} className="animate-page-enter">
                {renderView()}
              </div>
            </Suspense>
          </div>
        </main>
      </div>

      <UciStagingBar />
      <DiffModal />
      <RollbackModal />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectRoute={(r) => {
          navigateTo(r);
          setPaletteOpen(false);
        }}
      />
    </div>
  );
};
