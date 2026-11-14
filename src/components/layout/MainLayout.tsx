import React, { useState, Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { UciStagingBar } from "./UciStagingBar";
import { DiffModal } from "./DiffModal";
import { CommandPalette } from "./CommandPalette";
import { RollbackModal } from "./RollbackModal";
import { useI18nStore } from "@/store/i18n-store";
import { usePolicyStore } from "@/store/policy-store";

// Views
import { Overview } from "@/views/status/Overview";
import { BandwidthGraph } from "@/views/status/BandwidthGraph";
import { ConnectedClients } from "@/views/status/ConnectedClients";
import { SystemLogs } from "@/views/status/SystemLogs";
import { TrafficFlow } from "@/views/traffic/TrafficFlow";
import { ExplainRoute } from "@/views/traffic/ExplainRoute";
import { PolicyEngineView } from "@/views/expert/PolicyEngineView";
import { SimplePolicyManager } from "@/views/simple/SimplePolicyManager";
import { CategoryListManager } from "@/views/lists/CategoryListManager";
import { DnsRoutingCenter } from "@/views/dns/DnsRoutingCenter";
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
import { HardwareCatalog } from "@/views/install/HardwareCatalog";
import { SetupWizardModal } from "@/views/wizard/SetupWizardModal";
import { useWizardStore } from "@/services/wizard/wizard-store";

export const MainLayout: React.FC = () => {
  // Read initial route from URL hash (e.g. #/subscriptions, #/wireless, #/traffic)
  const getRouteFromHash = () => {
    if (typeof window === "undefined") return "overview";
    const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
    if (hash === "graphs" || hash === "realtime") return "bandwidth";
    if (hash === "traffic" || hash === "flow" || hash === "topology") return "traffic";
    if (hash === "explain" || hash === "diagnose-route" || hash === "why") return "explain";
    if (hash === "policies" || hash === "policy" || hash === "rules" || hash === "policy-rules") return "policies";
    if (hash === "lists" || hash === "categories" || hash === "feeds") return "lists";
    if (hash === "dns" || hash === "smartdns" || hash === "dns-routing") return "dns";
    if (hash === "devices" || hash === "leases" || hash === "clients") return "clients";
    if (hash === "wifi" || hash === "wireless") return "wireless";
    if (hash === "vpns" || hash === "vpn-manager") return "vpn";
    if (hash === "subs" || hash === "sub" || hash === "happ") return "subscriptions";
    if (hash === "logs" || hash === "syslog") return "logs";
    if (hash === "fw" || hash === "firewall-rules") return "firewall";
    if (hash === "install" || hash === "catalog" || hash === "firmware" || hash === "devices-catalog") return "install";
    if (hash === "wizard" || hash === "setup") return "wizard";
    return hash || "overview";
  };

  const [currentRoute, setCurrentRouteState] = useState<string>(getRouteFromHash());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { t, lang } = useI18nStore();
  const { operatingMode } = usePolicyStore();

  const navigateTo = (route: string) => {
    if (route === "wizard") {
      useWizardStore.getState().openWizard();
      return;
    }
    if (typeof window !== "undefined") {
      window.location.hash = `#/${route}`;
    }
    setCurrentRouteState(route);
  };

  React.useEffect(() => {
    const onHashChange = () => {
      const route = getRouteFromHash();
      if (route === "wizard") {
        useWizardStore.getState().openWizard();
      }
      setCurrentRouteState(route);
    };
    window.addEventListener("hashchange", onHashChange);

    // Auto-launch wizard if requested in hash or first-run
    const initialRoute = getRouteFromHash();
    if (initialRoute === "wizard") {
      useWizardStore.getState().openWizard();
    }

    // If no hash present, default to #/overview
    if (window.location.hash === "" || window.location.hash === "#") {
      window.location.hash = "#/overview";
    }
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const getRouteTitle = (route: string) => {
    switch (route) {
      case "overview": return t.nav.overview;
      case "traffic": return t.nav.trafficTopology;
      case "explain": return t.nav.explainRoute;
      case "policies":
        return operatingMode === "simple"
          ? (lang === "ru" ? "Правила и маршруты" : "Routing Rules")
          : t.nav.unifiedPolicies;
      case "lists": return t.nav.categoryFeeds;
      case "dns": return t.nav.dnsCenter;
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
      case "install": return t.nav.installCatalog;
      case "wizard": return t.nav.setupWizard;
      default: return t.nav.overview;
    }
  };

  const renderView = () => {
    switch (currentRoute) {
      case "overview":
        return <Overview />;
      case "traffic":
        return <TrafficFlow />;
      case "explain":
        return <ExplainRoute />;
      case "policies":
        return operatingMode === "simple" ? <SimplePolicyManager /> : <PolicyEngineView />;
      case "lists":
        return <CategoryListManager />;
      case "dns":
        return <DnsRoutingCenter />;
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
      case "install":
        return <HardwareCatalog />;
      case "wizard":
        return <HardwareCatalog />;
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
      <SetupWizardModal />
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
