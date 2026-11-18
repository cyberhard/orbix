// ORBIX • MainLayout — hash router with a 14-section navigation and legacy URL redirects.
// Canonical routes: overview, clients, policies, vpn, zapret, kid, interfaces, wireless,
// dhcp, firewall, diagnostics, services, software, settings (+ wizard modal).
// Old routes redirect onto the new hubs, e.g. #/subscriptions -> #/vpn?tab=subscriptions.
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
import { TrafficFlow } from "@/views/traffic/TrafficFlow";
import { ConnectedClients } from "@/views/status/ConnectedClients";
import { RoutingHubPage } from "@/views/hubs/RoutingHubPage";
import { VpnHubPage } from "@/views/hubs/VpnHubPage";
import { NetworkHubPage } from "@/views/hubs/NetworkHubPage";
import { DiagnosticsHubPage } from "@/views/hubs/DiagnosticsHubPage";
import { ServicesHubPage } from "@/views/hubs/ServicesHubPage";
import { SettingsHubPage } from "@/views/hubs/SettingsHubPage";
import { ZapretStrategyBuilder } from "@/views/circumvention/ZapretStrategyBuilder";
import { KidView } from "@/views/kid/KidView";
import { Interfaces } from "@/views/network/Interfaces";
import { Wireless } from "@/views/network/Wireless";
import { Firewall } from "@/views/network/Firewall";
import { Software } from "@/views/system/Software";
import { SetupWizardModal } from "@/views/wizard/SetupWizardModal";
import { useWizardStore } from "@/services/wizard/wizard-store";
import { ErrorBoundary } from "./ErrorBoundary";
import { canonicalHashFromLocation } from "@/lib/routing";

export const MainLayout: React.FC = () => {
  const initial = canonicalHashFromLocation(typeof window !== "undefined" ? window.location.hash : "");
  const baseFromCanonical = (c: string) => (c.split("?")[0] || "overview") as string;

  const [currentRoute, setCurrentRouteState] = useState<string>(() =>
    initial === "wizard" ? "overview" : baseFromCanonical(initial)
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { t, lang } = useI18nStore();
  const { operatingMode } = usePolicyStore();

  const applyCanonical = (canonical: string) => {
    if (canonical === "wizard") {
      useWizardStore.getState().openWizard();
      return;
    }
    setCurrentRouteState(baseFromCanonical(canonical));
  };

  const navigateTo = (route: string) => {
    if (route === "wizard") {
      useWizardStore.getState().openWizard();
      return;
    }
    if (typeof window !== "undefined") {
      // assigning the hash triggers hashchange -> canonicalization below
      const next = `#/${route}`;
      if (window.location.hash === next) {
        applyCanonical(canonicalHashFromLocation(next));
      } else {
        window.location.hash = next;
      }
    }
  };

  React.useEffect(() => {
    const sync = () => {
      const canonical = canonicalHashFromLocation(window.location.hash);
      // rewrite legacy URLs onto their canonical form without adding history entries
      const wantHash = canonical === "wizard" ? "#/wizard" : `#/${canonical}`;
      if (window.location.hash !== wantHash) {
        window.history.replaceState(null, "", wantHash);
      }
      applyCanonical(canonical);
    };
    window.addEventListener("hashchange", sync);

    if (window.location.hash === "" || window.location.hash === "#") {
      window.location.hash = "#/overview";
    } else {
      sync();
    }
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const getRouteTitle = (route: string) => {
    switch (route) {
      case "overview": return t.nav.dashboard;
      case "clients": return t.nav.devicesMap;
      case "policies":
        return operatingMode === "simple"
          ? (lang === "ru" ? "Правила и маршруты" : "Routing Rules")
          : t.nav.routingHub;
      case "vpn": return t.nav.vpnSubs;
      case "zapret": return t.nav.zapretBuilder;
      case "interfaces": return t.nav.interfacesVlans;
      case "wireless": return t.nav.wirelessRadios;
      case "dhcp": return t.nav.dhcpDns;
      case "firewall": return t.nav.firewall;
      case "diagnostics": return t.nav.diagnosticsLogs;
      case "services": return t.nav.servicesTasks;
      case "software": return t.nav.softwarePackages;
      case "settings": return t.nav.settingsBackup;
      case "kid": return lang === "ru" ? "Пульт для детей" : "Kids remote";
      default: return t.nav.overview;
    }
  };

  const renderView = () => {
    switch (currentRoute) {
      case "overview":
        return (
          <div className="space-y-6">
            <Overview />
            <BandwidthGraph />
          </div>
        );
      case "clients":
        return (
          <div className="space-y-6">
            <TrafficFlow />
            <ConnectedClients />
          </div>
        );
      case "policies":
        return <RoutingHubPage />;
      case "vpn":
        return <VpnHubPage />;
      case "zapret":
        return <ZapretStrategyBuilder />;
      case "kid":
        return <KidView />;
      case "interfaces":
        return <Interfaces />;
      case "wireless":
        return <Wireless />;
      case "dhcp":
        return <NetworkHubPage />;
      case "firewall":
        return <Firewall />;
      case "diagnostics":
        return <DiagnosticsHubPage />;
      case "services":
        return <ServicesHubPage />;
      case "software":
        return <Software />;
      case "settings":
        return <SettingsHubPage />;
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
            <ErrorBoundary key={currentRoute}>
              <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading view...</div>}>
                <div key={currentRoute} className="animate-page-enter">
                  {renderView()}
                </div>
              </Suspense>
            </ErrorBoundary>
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
        onOpen={() => setPaletteOpen(true)}
        onSelectRoute={(r) => {
          navigateTo(r);
          setPaletteOpen(false);
        }}
      />
    </div>
  );
};
